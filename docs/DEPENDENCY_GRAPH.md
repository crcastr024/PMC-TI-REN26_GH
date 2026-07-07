# DEPENDENCY_GRAPH.md — PMC-TI-REN26 GH3
Árbol de dependencias del proyecto

---

## Orden de carga (index.html)

```
1. config.js          → PRODUCTION_CONFIG (sin dependencias)
2. msal-browser.min.js → window.msal (sin dependencias)
3. init.js            → LOGOS, window globals (sin dependencias)
4. utils.js           → state, EventBus, RBAC, can() [usa msal implícito]
5. auth.js            → SessionManager, AuthProvider [usa msal, PRODUCTION_CONFIG]
6. graph.js           → GraphClient, GraphResolver, HealthCheckService [usa AuthProvider]
7. dataService.js     → DataService, StateMachine, normalizeRecord_F3 [usa state, can()]
8. provider.js        → WorkbookLoader, ExcelProvider, ExcelMapper [usa GraphClient, GraphResolver]
9. sync.js            → SynchronizationManager, ViewModelRegistry [usa WorkbookLoader, DataService]
10. refresh.js        → ConflictDetector, listeners [usa SynchronizationManager]
11. dashboard.js      → KPIService, DashboardFactory [usa DataService, StateMachine]
12. ui.js             → renderXxx, openXxx, saveRecord [usa DashboardFactory, DataService]
13. boot.js           → BootstrapManager, boot(), RC2_doLogin [usa todo lo anterior]
14. app.js            → DOMContentLoaded → boot() [entry point]
```

---

## Grafo de dependencias

```
PRODUCTION_CONFIG (config.js)
  └── AuthProvider (auth.js)
        ├── MSAL_CONFIG [usa tenantId, clientId, redirectUri]
        └── SessionManager [gestiona sesión de usuario]

GraphClient (graph.js)
  └── AuthProvider.getAccessToken()

GraphResolver (graph.js)
  └── GraphClient [resuelve siteId → driveId → itemId]

WorkbookLoader (provider.js)
  ├── GraphClient [acceso a Graph API]
  └── GraphResolver.getCache() [IDs en memoria]

ExcelProvider (provider.js)
  └── WorkbookLoader [lectura del Excel]

DataService (dataService.js)
  └── ExcelProvider [a través de IDataProvider]

BootstrapManager (boot.js)
  ├── GraphResolver.resolveAll() [primero]
  ├── WorkbookLoader.checkHealth()
  ├── WorkbookLoader.loadTable(PMC_USUARIOS)
  ├── WorkbookLoader.loadTable(PMC_ROLES_PERMISOS)
  ├── WorkbookLoader.loadTable(PMC_CONFIG)
  ├── SessionManager.createFromBootstrap()
  └── EventBus.publish('bootstrap.completed')

boot() → bootstrap.completed
  └── DataService.reloadFromProvider()
        └── ExcelProvider.loadData()
              └── WorkbookLoader.loadAll()

SynchronizationManager (sync.js)
  ├── WorkbookLoader.getWorkbookMeta() [detección de cambios]
  └── DataService.reloadFromProvider() [refresco de datos]

DashboardFactory (dashboard.js)
  └── DataService.getRenewals(), getKPIs(), etc.
```

---

## Módulos independientes (sin dependencias del proyecto)

- `config.js` — solo PRODUCTION_CONFIG
- `msal-browser.min.js` — SDK de Microsoft, solo usa window.msal

## Módulos críticos (del que depende todo lo demás)

- `config.js` — configuración raíz
- `auth.js` — autenticación (todo el flujo depende del token)
- `graph.js` — transporte (toda comunicación pasa por GraphClient)
- `provider.js` — acceso al Excel (fuente única de datos)
