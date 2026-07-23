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

## GH3.42.13
- FIX CRÍTICO: Chart.js 4.4.1 nunca estaba incluido en index.html —
  ningún `<script>` lo cargaba. `window.Chart` era siempre `undefined`,
  así que las 4 guardas `if (!window.Chart) return` en ui.js hacían que
  Devoluciones, Destino Final, RAEE y Burndown fallaran en silencio
  (canvas vacío, sin error visible). Empaquetado localmente
  (js/chart.umd.min.js, mismo patrón que MSAL — sin CDN externo) e
  insertado antes de ui.js.
- Paleta de modo oscuro suavizada (menos negro/blanco puros — "amigable"):
  --bg, --bg-elev, --bg-card, --bg-card-hover, --bg-subtle, --border,
  --border-strong, --text-1..4 en `[data-theme="dark"]`. Topbar dark
  (antes rgba(5,5,8) hardcoded, ignoraba el token) alineado a la nueva
  paleta. Solo neutros — --accent y colores de marca/estado sin cambios.
- FIX `.tl-step-pending .tl-step-icon`: `background: white` hardcoded
  (responsive.css) → `var(--bg-card)`. En claro se disimulaba contra el
  modal blanco; en oscuro quedaba un círculo blanco encendido.
- Tooltip del avatar de usuario en sidebar colapsado: `data-tip` con
  nombre + rol (boot.js) + regla CSS análoga a `.sb-item::after`
  (components.css). Antes el nombre desaparecía por completo al
  colapsar (`.sb-user-info{display:none}`) sin ninguna forma de verlo.

### Hallazgo flagged, NO resuelto — requiere decisión
- Todo el bloque de Panel Ejecutivo/Seguimiento (`#view-panel`: Leaderboard,
  Devoluciones, Destino Final, Cuello de botella, Riesgos) usa un SEGUNDO
  sistema de tokens (`--ink/--paper/--brand`, exec-redesign.css) con
  decenas de hex fijo en línea, y ese sistema NUNCA se sobreescribe bajo
  `[data-theme="dark"]`. Esta vista queda permanentemente en estética
  "papel claro" sin importar el toggle de tema — parece intencional
  (el propio changelog GH3.42.2 dice "versión oscura → clara editorial").
  No se tocó: es un cambio mucho más grande y ambiguo que requiere
  confirmar si de verdad debe adaptarse a dark o si el "look editorial"
  es deliberado.

## GH3.42.14
- FIX REAL del hueco blanco en el sidebar al hacer scroll — el intento
  anterior (GH3.42.12, height:auto + sticky + grid-area) NO lo resolvió,
  confirmado por captura del usuario en producción. Causa raíz correcta:
  el sidebar dependía de cómo el grid calculaba la altura de SU PROPIA
  celda (filas "sidebar" = topbar+main), que nunca incluye la fila del
  footer — cualquier desajuste entre esa celda y el alto real de página
  deja hueco. Fix robusto: `.sidebar` sale del grid por completo, pasa a
  `position:fixed; top:0; left:0; height:100vh` — ancla al viewport,
  no depende de ningún cálculo de grid. El footer YA tenía compensación
  vía `margin-left` sincronizada con `body.sb-collapsed` (mecanismo
  preexistente, confirmado correcto) — no requirió cambios.
- Adaptado a modo oscuro TODO el sistema de tokens de Panel Ejecutivo
  (`--ink/--ink-2/--ink-3/--muted/--paper/--paper-2/--rule/--rule-2/
  --brand/--status-ok/warn/crit/idle`, exec-redesign.css). Afecta
  Leaderboard, tarjetas de ciudad, cuello de botella, riesgos, tarjetas
  de empresa — todo lo que usa esos tokens se adapta automáticamente,
  sin tocar cada componente individualmente. La franja "hero" (KPIs,
  semáforo) se mantiene oscura siempre, a propósito — se aisló
  `--ink` (que también servía de fondo del hero) para que el fondo del
  hero quede fijo mientras el resto del token sí cambia con el tema.
- Nota: components.css tiene duplicados de `.eec-*/.lb-*/.exec-city-*/
  .bot-*/.risk-item` con hex fijo (no tokens) — están shadowed/muertos,
  exec-redesign.css (carga después) gana con las versiones ya
  tokenizadas. No se tocaron por no tener efecto visual — quedan como
  deuda técnica menor (limpiar en otro sprint si se quiere).
