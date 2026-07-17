# Motor de sincronización

## Componentes

| Componente | Archivo | Responsabilidad |
|---|---|---|
| SynchronizationManager | sync.js | Polling inteligente con eTag |
| RefreshManager | refresh.js | Coordina ciclos de refresco |
| DataService.reloadFromProvider() | dataService.js | Carga datos desde Graph |
| WorkbookWriter.writeRecord() | provider.js | PATCH a Excel |

## Ciclo RC-06 (polling inteligente)

```
requestTick(delay?)
  ↓ (debounce + lock _tickActive)
tick()
  ↓
DataService.reloadFromProvider()
  ↓  solo si eTag cambió en servidor
DataService.normalizeRecord() → window.USERS actualizado
  ↓
DashboardStats.invalidate()
  ↓
renderResumen() / renderPanel() según vista activa
```

## Intervalos adaptativos (RC-07)

| Modo | Intervalo |
|---|---|
| Usuario activo | 15 segundos |
| Usuario inactivo | 60 segundos |
| Pestaña oculta | 120 segundos |

## Control de concurrencia (RC-07)

Cada PATCH incluye el campo VERSION incrementado.
Si dos usuarios guardan simultáneamente → el segundo detecta conflicto por VERSION desincronizada → alerta → no sobreescribe silenciosamente.
