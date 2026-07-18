# Arquitectura del sistema PMC-TI-REN26

## Visión general

SPA (Single Page Application) vanilla JavaScript sin frameworks, desplegada en Netlify y GitHub Pages. Lee y escribe datos de un Excel Maestro en SharePoint a través de Microsoft Graph API.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | JavaScript ES5/ES6 sin framework |
| Autenticación | MSAL.js (Microsoft Identity Platform) |
| Datos | Excel en SharePoint → Microsoft Graph API |
| Despliegue | Netlify (producción) / GitHub Pages (dev) |
| Firma digital | PandaDoc |

## Archivos Core (congelados RC-1)

```
js/
├── config.js          — Configuración de producción (tenantId, clientId, paths)
├── utils.js           — EventBus, helpers globales, navegación de vistas
├── graph.js           — GraphProvider, WriteContract, RBAC, StateMachine
├── dataService.js     — DataService (caché local, CRUD, normalización)
├── provider.js        — WorkbookWriter (escritura Excel via Graph)
├── sync.js            — SynchronizationManager (RC-06/RC-07: polling + eTag)
├── refresh.js         — RefreshManager (coordina ciclos de refresco)
├── dashboard.js       — buildDashboardStats(), DashboardStats Service
├── ui.js              — Renderers (todos consumen DashboardStats.get()/.compute())
└── boot.js            — Bootstrap, ApprovalService, StateMachine, MSAL
```

## Flujo de datos

```
SharePoint Excel
   ↓  GET (Graph API)
GraphProvider.loadTable()
   ↓
DataService.normalizeRecord()  →  window.USERS (caché local)
   ↓
DashboardStats.get()            →  stats globales
   ↓
Renderers (ui.js)               →  DOM
   ↑
Usuario modifica formulario
   ↓
saveRecord() → DataService.updateRenewal() → DashboardStats.invalidate()
   ↓
WorkbookWriter.writeRecord()    →  PATCH Graph API  →  Excel
   ↓
SynchronizationManager.requestTick() → reloadFromProvider() → ciclo reinicia
```

## Principios de diseño

- **Fuente única de verdad**: Excel Maestro en SharePoint
- **Caché local optimista**: window.USERS refleja el estado local; Graph es autoritativo
- **DashboardStats Service**: todos los KPIs provienen de una sola función
- **WriteContract**: lista blanca de campos permitidos para escritura
- **RBAC estricto**: roles definidos en el Excel, validados en cada operación
