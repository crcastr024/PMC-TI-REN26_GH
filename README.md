# PMC-TI REN26 — Dashboard de Renovación Tecnológica
**Heinsohn Business Technology** · v8.8.4-GH1

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://heinsohn.github.io/pmc-ti-ren26/)

---

## Arquitectura

```
Navegador (GitHub Pages)
       ↓
  Microsoft Login (MSAL)
       ↓
  Azure AD → Token
       ↓
  Microsoft Graph API
       ↓
  SharePoint → Excel Maestro
  Plan_Maestro_REN26.xlsx
       ↓
    Dashboard
```

**GitHub Pages** aloja el código.  
**SharePoint** almacena el Excel Maestro (única base de datos).  
**Microsoft Graph** es el mecanismo de transporte (no almacena datos).

---

## Estructura del proyecto

```
PMC-TI-REN26-Dashboard/
├── index.html              HTML principal
├── 404.html                SPA fallback para GitHub Pages
├── .nojekyll               Deshabilitar Jekyll
├── .gitignore
├── manifest.json
├── README.md
├── css/
│   ├── styles.css          Design tokens y estilos base
│   ├── components.css      Componentes UI
│   └── responsive.css      Responsive y animaciones
├── js/
│   ├── config.js           ← EDITAR AQUÍ (IDs de Azure/SharePoint)
│   ├── msal-browser.min.js MSAL SDK v3.28.1 (local)
│   ├── init.js             Inicialización de variables globales
│   ├── utils.js            Estado, EventBus, RBAC, utilidades
│   ├── auth.js             SessionManager, AuthProvider, MSAL
│   ├── graph.js            GraphClient, SharePointResolver, WriteContract
│   ├── dataService.js      DataService, StateMachine, normalizeRecord_F3
│   ├── provider.js         WorkbookLoader, ExcelProvider, SyncManager
│   ├── dashboard.js        KPIService, DashboardFactory, renders
│   └── boot.js             BootstrapManager, boot(), login handler
└── assets/
    ├── logo-heinsohn.svg
    ├── logo-heinsohn-horizontal-color.png
    ├── logo-heinsohn-horizontal-white.png
    ├── logo-heinsohn-vertical-color.png
    ├── logo-heinsohn-vertical-white.png
    ├── favicon.ico
    ├── favicon.svg
    └── loader.svg
```

---

## Instalación y ejecución local

```bash
# Clonar el repositorio
git clone https://github.com/heinsohn/pmc-ti-ren26.git
cd pmc-ti-ren26

# Servir localmente (cualquier servidor estático)
python3 -m http.server 5500
# o: npx serve . -p 5500
# o: usar VS Code Live Server

# Abrir: http://localhost:5500
```

Para desarrollo sin SharePoint real:
1. Editar `js/config.js`
2. Cambiar `authenticationMode: 'mock'`
3. Cambiar `dataSource: 'mock'`

---

## Configuración — js/config.js

**Único archivo a editar para cambiar el entorno.**

```javascript
window.PRODUCTION_CONFIG = {
  tenantId: '38f48feb-...',    // Azure AD Tenant
  clientId: 'f7d07502-...',    // App Registration Client ID
  siteId:   '...',             // SharePoint Site ID
  driveId:  '...',             // Drive ID (OneDrive/SharePoint)
  itemId:   '...',             // Excel Maestro Item ID
  authenticationMode: 'msal', // 'mock' para desarrollo
  dataSource:         'excel', // 'mock' para desarrollo
  debug:              false,
  // redirectUri: ''           // Calculado automáticamente
};
```

---

## Publicación en GitHub Pages

### Paso 1 — Crear repositorio GitHub
1. Ir a https://github.com/new
2. Nombre: `pmc-ti-ren26` (o el que prefieras)
3. Visibilidad: Private (recomendado para app corporativa)
4. NO inicializar con README (ya tiene uno)

### Paso 2 — Subir el código
```bash
cd PMC-TI-REN26-Dashboard/
git init
git add .
git commit -m "GH1: Dashboard PMC-TI-REN26 listo para GitHub Pages"
git remote add origin https://github.com/heinsohn/pmc-ti-ren26.git
git push -u origin main
```

### Paso 3 — Activar GitHub Pages
1. Repositorio → Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main** / **(root)**
4. Save

URL resultante: `https://heinsohn.github.io/pmc-ti-ren26/`

### Paso 4 — Configurar Azure AD
Agregar la URL de GitHub Pages como Redirect URI:
1. Azure Portal → App Registrations → PMC-TI-REN26 Dashboard → Authentication
2. Agregar: `https://heinsohn.github.io/pmc-ti-ren26/`
3. Agregar: `http://localhost:5500` (para desarrollo)
4. Save

### Paso 5 — Verificar
1. Abrir `https://heinsohn.github.io/pmc-ti-ren26/`
2. Debe aparecer la pantalla de login Microsoft
3. Login → Bootstrap → Dashboard con datos del Excel

---

## Configuración de SharePoint

**SharePoint NO hospeda el Dashboard.**  
SharePoint solo almacena el Excel Maestro.

```
heinsohn.sharepoint.com/sites/TI → Documentos
└── PMC-TI-REN26/
    └── 02_Maestro/
        └── Plan_Maestro_REN26.xlsx  ← ÚNICA BD
```

Los IDs para acceder al Excel están en `js/config.js`:
- `siteId`: ID del sitio SharePoint
- `driveId`: ID del drive
- `itemId`: ID del archivo Excel

---

## Actualizar el Dashboard

```bash
# Modificar el código
git add .
git commit -m "Actualización: descripción del cambio"
git push

# GitHub Pages se actualiza automáticamente en ~1-2 minutos
```

---

## Proceso de rollback

```bash
# Ver historial de commits
git log --oneline

# Revertir al commit anterior
git revert HEAD
git push

# O forzar un commit específico (usar con cuidado)
git reset --hard <commit-hash>
git push --force
```

---

## Verificación desde consola del navegador

```javascript
BootstrapManager.isCompleted()    // true post-login
state.user.role                   // rol del usuario actual
window.SYSTEM_USERS.length        // usuarios del Excel
window.USERS.length               // renovaciones cargadas (146+)
SynchronizationManager.isRunning() // true (polling activo)
WorkbookLoader.checkHealth().then(console.log)  // estado del Excel
```

---

*Heinsohn Business Technology · Coordinación TI · Cristian Castro*
