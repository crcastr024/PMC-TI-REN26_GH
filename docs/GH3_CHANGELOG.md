# GH3_CHANGELOG.md — PMC-TI-REN26
Code Quality Freeze · 2026-07-07

---

## GH3.5 — Timer leak corregido (boot.js)
setInterval(updateAprobacionesItem, 5000) ahora cancelable via EventBus 'session.logout'.

## GH3.6 — Catch vacíos documentados (12 instancias)
auth.js, boot.js, graph.js, sync.js, utils.js — todos con /* intentional: ... */

## GH3.11 — Configuración centralizada
graphEndpoint, sharepointHost, tenantId, clientId: leídos desde PRODUCTION_CONFIG en graph.js.
0 IDs hardcodeados sin guarda en ningún módulo.

## GH3 — Documentos de auditoría generados
DeadCodeReport.md, DEPENDENCY_GRAPH.md, EventAudit.md, TimerAudit.md,
ErrorHandling.md, GraphAudit.md, LoggingAudit.md, MemoryAudit.md,
BOOT_SEQUENCE.md, SecurityFreeze.md

## Métricas GH3
- Pruebas: 633/633 acumuladas · 0 regresiones
- TODO/FIXME pendientes: 0
- Catch vacíos sin documentar: 0
- Timer leaks: 0
- Fetch directos fuera de GraphClient: 0
- console.log en producción: 0
- IDs hardcodeados sin guarda: 0

## GH3.28
- RAEEEngine: motor de clasificacion (RAEE/Donacion/Venta interna/Reasignacion)
- 9 nuevas columnas en Excel Maestro
- KPIs de destino final en Dashboard
- Tarjeta Destino Final en Panel Ejecutivo
- Timeline con panel RAEE y flujo especial
- Validacion antes de guardar (evaluacion fisica completa)
- Integracion completa Modal->Graph->Excel->Dashboard

## GH3.42.12
- FIX sidebar: `height:auto` restaura corrección GH3.38 FC-08 (revertida en algún
  sprint posterior) — eliminaba el hueco blanco al hacer scroll hasta el footer.
- FIX tooltips sidebar colapsado: agregado `data-tip` a los 13 `.sb-item`
  (el CSS `::after{content:attr(data-tip)}` ya existía, RC-06, pero sin el
  atributo HTML nunca mostraba texto). Bonus: `id="sb-panel"` duplicado
  (nav + footer) renombrado a `sb-panel-foot` en la instancia del footer.
- FIX crítico ExcelMapper.castValue() (provider.js): el registro ID=1 se
  casteaba a boolean `true` porque `s==='1'` se evaluaba antes que la
  columna numérica ID. Se excluyen ID/CALIFICACION_FEEDBACK/VERSION del
  cast booleano.
- Reorden STATE_FLOW/TRANSITIONS (utils.js): Pendiente acta → Pendiente
  aprobación → Renovación completada (terminal). RBAC: "Renovación
  completada" solo seleccionable por super_admin/gestor_activos en el
  modal de edición (ui.js); el resto de roles llega hasta Pendiente
  aprobación. El estado actual del registro siempre se preserva visible.
- NIVELES_REGISTRO (boot.js) acortado — se retiran las descripciones
  extendidas, alineado con la migración ya aplicada en el Excel maestro.
- Dark mode: tokens `--green-l/--blue-l/--amber-l/--purple-l/--accent-l`
  (overlays al 10%, invisibles sobre `--bg-card` oscuro) reciben alpha
  mayor en `[data-theme="dark"]`. 7 badges con hex fijo (nunca adaptado
  a dark) tokenizados: violet, orange, purple2, green2, red, teal.
- Agregado `.badge-pendiente-acta` — no tenía NINGÚN color asignado desde
  que el estado se introdujo en GH3.42.8.
- Fixes aplicados en components.css + responsive.css (última en cascada,
  pisa components.css en varios selectores de badge con igual especificidad).

### Riesgos abiertos (no resueltos, requieren decisión de negocio)
- Excel maestro con NIVEL_USUARIO migrado a medias (mezcla forma larga/
  corta en Niveles 2, 3 y 5 — 52/146 registros). Riesgo de que el modal
  muestre Nivel en blanco para esos registros hasta que se re-seleccione.
- `GraphProvider.loadData()` (graph.js, SharePoint List items + SP_FIELD_MAP)
  es código muerto — la ruta real de producción es ExcelProvider +
  WorkbookLoader sobre `usedRange` (ver 05_GRAPH_PROVIDER.md).
- Inconsistencia preexistente: badge-pendiente-aprobación es ámbar en
  components.css pero azul en responsive.css (gana azul, no se tocó).
