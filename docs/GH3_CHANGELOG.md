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

## GH3.42.15
- FIX vista "Por técnico" (#tec-grid): controles de navegación del
  carrusel (flechas + dots) renderizando en una columna vacía al lado
  de la tarjeta, en vez de debajo. Causa raíz: `.tec-grid` es CSS Grid
  legacy de ANTES del carrusel (`display:grid; grid-template-columns:
  repeat(auto-fit,minmax(320px,1fr))`, pensado para varias tarjetas
  simultáneas, GH3.42.11 reemplazó eso por el carrusel de 1 tarjeta a
  la vez pero nunca se actualizó este CSS). El carrusel solo mete 2
  hijos (.rc-viewport + .rc-nav) y el grid heredado los coloca como
  2 columnas en vez de apilarlos. Fix: `display:block` explícito en
  `.exec-tec-carousel-wrap` (tecnico-funnel.css, carga después de
  components.css, gana en cascada). Verificado que no afecta el otro
  punto de uso del mismo carrusel (#pe-tecnico-new en Seguimiento, que
  ya usaba flex-column correctamente — block se comporta igual para
  2 hijos simples).

## GH3.42.16
- FIX CRÍTICO: filtro de estado en vista Usuarios (#filter-estado) —
  3 de sus 6 opciones ("En tránsito", "Entregado", "Completado") devolvían
  SIEMPRE 0 resultados, sin importar los demás filtros. Causa raíz:
  `getFiltered()` comparaba `u.estado !== est` por igualdad EXACTA, pero
  el `<select>` (index.html) usa categorías agrupadas/cortas que no
  existen como valor literal en ningún registro (real: "En tránsito
  equipo nuevo/anterior", "Entregado equipo nuevo", "Renovación
  completada"/"Cerrado" — nunca literalmente "En tránsito"/"Entregado"/
  "Completado"). Solo "Pendiente"/"Alistamiento"/"BACKUP" coincidían por
  casualidad (etiqueta corta = valor real). Fix: matching agrupado —
  "Completado" usa el mismo criterio de "finalizados" ya establecido en
  el resto del código (Renovación completada/Cerrado/Finalizado/
  Completado); "En tránsito"/"Entregado" usan prefijo sobre el estado
  real. No se rediseñaron las categorías del select (haría falta
  para cubrir Programado/Pendiente devolución/Pendiente acta/Pendiente
  aprobación, que hoy no encajan en ningún bucket) — eso es una decisión
  de producto más grande, fuera de alcance de este fix puntual.

## GH3.42.17
- FIX CRÍTICO (autorizado explícitamente por Cristian — toca "core
  congelado", provider.js): incidente de throttling 429 sostenido +
  circuit breaker activado en producción. Causa raíz: `WorkbookWriter.
  writeRecord()` hacía un PATCH por CELDA individual en un loop
  secuencial — cada guardado de 1 registro disparaba mínimo 4 requests
  (campo editado + _VERSION + _UPDATED_AT + _UPDATED_BY), cada uno como
  llamada HTTP independiente a Graph. Con el volumen normal de uso esto
  agotaba el rate limit de Graph y activaba el circuit breaker (GH3.42.7).
- Fix: agrupar cellUpdates de columnas CONTIGUAS de la misma fila en un
  solo PATCH de rango (ej. `range(address='P28:R28')` con
  `values:[[v1,v2,v3]]`), en vez de 3 PATCHes sueltos. Mismo patrón ya
  usado y probado en AuditService.flushBatch ("UN SOLO PATCH para todo
  el batch — TASK 03 aprobado"). No cambia el contrato de escritura:
  mismas validaciones (Stage 1-2), mismo lock (Stage 3), mismo logging
  de auditoría y verificación post-PATCH (adaptada a leer por offset
  dentro del rango en vez de una sola celda).
- Confirmado contra el Excel maestro real: UPDATED_AT/UPDATED_BY/VERSION
  son columnas 60/61/62 — CONTIGUAS. Un guardado típico de 1 campo pasa
  de 4 PATCHes individuales a 2 (el campo editado + el batch de control),
  -50% de requests. Peor caso (campos totalmente dispersos): igual que
  antes, sin regresión.

## GH3.42.18
- FIX CRÍTICO (autorizado explícitamente por Cristian — toca "core
  congelado", graph.js): reportado por Cristian — cambios de estado a
  "Renovación completada" (desde un registro en "Cerrado") y a
  "Pendiente devolución equipo anterior" (Mercedes Peña) no persistían
  en el Excel; al refrescar volvía a aparecer el estado anterior.
- Causa raíz: `GraphWriteValidator.validate()` llama a `StateMachine.
  isValidTransition(fromState, toState)` y RECHAZA el guardado (lanza
  excepción, no escribe nada) si la transición no está en el mapa
  TRANSITIONS — para TODOS los roles por igual, incluido Super Admin.
  Caso 1 confirmado en código: `TRANSITIONS['Cerrado'] = []` — Cerrado
  es un estado legacy sin ninguna salida definida (desde GH3.42.8), así
  que cualquier intento de sacar un registro de Cerrado se rechazaba
  sin importar el destino. Caso 2 (Mercedes Peña): mismo mecanismo —
  "Pendiente devolución equipo anterior" solo es alcanzable desde
  "Entregado equipo nuevo" en el mapa; si su estado previo era otro,
  se rechazaba igual. El error SÍ generaba un toast (ui.js ya tenía el
  catch), pero el mensaje técnico ("Transición inválida: X → Y") no fue
  suficientemente claro/notorio.
- Fix: `super_admin`/`gestor_activos` ahora pueden hacer correcciones
  administrativas fuera de la secuencia estándar de TRANSITIONS (se
  registra como warning para trazabilidad, no bloquea el guardado).
  Técnico sigue restringido exactamente igual que antes — no puede
  saltarse pasos de su flujo diario. El valor de "estado" sigue
  validado como choice válido (VALID_CHOICES, Object.values(STATES))
  para TODOS los roles — el fix libera únicamente el ORDEN, no permite
  valores inválidos.
- Verificado con simulación de la lógica (node -e): super_admin en
  ambos casos reportados → sin error, warning solo informativo; técnico
  en la misma transición → sigue bloqueado; técnico en transición
  normal → sin cambios.
