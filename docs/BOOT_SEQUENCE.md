# BOOT_SEQUENCE.md — PMC-TI-REN26 GH3
Secuencia de arranque — verificación formal

---

## Flujo completo boot()

```
DOMContentLoaded
  → boot()
      ├── EventBus.subscribe('bootstrap.completed', ...)  [1 vez]
      ├── EventBus.subscribe('bootstrap.failed', ...)     [1 vez]
      │
      ├── authMode === 'msal'?
      │     SÍ:
      │       ├── AuthProvider.initialize()              [1 vez]
      │       ├── AuthProvider.isAuthenticated()?
      │       │     SÍ: (token en caché MSAL)
      │       │       └── BootstrapManager.run(account, token)
      │       │     NO:
      │       │       └── mostrar rc2-login-screen → esperar RC2_doLogin()
      │       │
      │       RC2_doLogin():
      │         └── AuthProvider.login()  → popup MSAL → token
      │               └── BootstrapManager.run(account, token)
      │     NO (mock mode):
      │       └── SessionManager.create(mockAccount)
      │             └── EventBus.publish('bootstrap.completed')
      │
      bootstrap.completed event:
        └── DataService.reloadFromProvider()    [1 vez]
              └── ExcelProvider.loadData()
                    └── WorkbookLoader.loadAll()
                          ├── PMC_RENOVACIONES
                          └── PMC_INVENTARIO
        └── SynchronizationManager.start()      [1 vez]
        └── _bootCore()                          [1 vez]
```

## BootstrapManager.run() interno

```
BootstrapManager.run(account, token)
  ├── GraphResolver.resolveAll()            [1 vez — 3 calls Graph]
  │     ├── resolveSite(sharepointHost, siteName)
  │     ├── resolveDrive(siteId)
  │     └── resolveWorkbook(driveId, workbookRelativePath)
  ├── WorkbookLoader.checkHealth()          [1 vez]
  ├── WorkbookLoader.loadTable(USUARIOS)    [1 vez]
  ├── F7_resolveRole(email)
  ├── WorkbookLoader.loadTable(ROLES_PERMISOS) [1 vez]
  ├── WorkbookLoader.loadTable(ROLES)       [1 vez]
  ├── WorkbookLoader.loadTable(CONFIG)      [1 vez]
  ├── SessionManager.createFromBootstrap()  [1 vez]
  ├── SessionManager.applyToState()         [1 vez]
  └── EventBus.publish('bootstrap.completed') [1 vez]
```

## Garantías formales

| Garantía | Estado |
|---|---|
| Cada componente se ejecuta exactamente una vez | ✓ |
| No existen dobles inicializaciones | ✓ (_completed flag en BootstrapManager) |
| No existen condiciones de carrera | ✓ (async/await secuencial) |
| No existen llamadas redundantes a Graph | ✓ (GraphResolver cachea en memoria) |
| Dashboard no renderiza antes del login | ✓ (rc2-login-screen bloquea) |
| Datos no cargan antes del Bootstrap | ✓ (reloadFromProvider solo en bootstrap.completed) |
