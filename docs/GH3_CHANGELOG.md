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

## GH3.42.19
- FIX CRÍTICO (autorizado por Cristian — toca "core congelado", provider.js):
  causa raíz definitiva de "estado no se guarda en Excel, vuelve al valor
  anterior al refrescar". `saveRecord()` (ui.js:2417) llama a `DataService.
  updateRenewal()`, que muta el registro EN MEMORIA (Object.assign sobre la
  misma referencia de window.USERS) ANTES de que `writeRecord()` (provider.js)
  lea `currentRecord` para decidir si un campo requerido realmente cambió.
  La comparación `String(newVal) === String(oldVal)` (GH3.42.7) SIEMPRE
  coincidía para tecnico/estado/empresa/cedula/nombre cuando de verdad
  cambiaban, porque `currentRecord` ya reflejaba el valor NUEVO — el campo
  se borraba del payload antes de llegar a Graph, sin error visible (el
  resto del guardado sí se completaba, toast de éxito incluido).
- Fix: se retira la rama `newVal===oldVal`. Se conserva SOLO `newEmpty &&
  oldEmpty` (el caso original que GH3.42.7 quería resolver — dato
  preexistente faltante, no una comparación contra el valor ya mutado).
  Confirmado con 3 casos simulados (node -e): cambio real ahora SÍ se
  envía; dato preexistente vacío sigue omitiéndose; borrado intencional
  de un campo requerido pasa a validateField(), que sigue rechazándolo
  ("Estado REN26 siempre debe tener un dato" — confirmado, esa protección
  vive en graph.js y es independiente de este fix).

### Auditoría solicitada por Cristian — hallazgos
1. **[CRÍTICO — corregido arriba]** El bug de esta entrada.
2. **[RIESGO, no corregido]** `submitBlock()` (boot.js) hace `DataService.
   updateRenewal(id, {estado:'Bloqueado', ...})` y LUEGO llama a
   `saveRecord()`, que re-lee el `<select id="m-estado">` del formulario —
   si ese select no refleja "Bloqueado" en ese momento (submitBlock no lo
   actualiza), saveRecord() podría reescribir encima con el valor que
   estuviera seleccionado antes de bloquear. No confirmado en vivo — requiere
   verificación y probablemente su propio fix/autorización aparte.
3. **[DEUDA TÉCNICA, sin impacto activo confirmado]** Existen DOS tablas
   `FIELD_COLUMN_ALIASES`: `window.FIELD_COLUMN_ALIASES` (init.js, ~40
   entradas, comentario dice "contrato oficial") y una `const` local en
   provider.js (5 entradas) que la sombrea por scope — la de init.js NUNCA
   se lee en ningún lado. Confirmado que no causa fallas activas hoy (los
   demás campos matchean por coincidencia case-insensitive sin necesitar
   alias), pero es confuso: alguien podría editar la tabla equivocada
   pensando que es la "oficial". Recomendado consolidar en una sola.
4. **[VERIFICADO OK]** `ALLOWED_FIELDS`/`PROTECTED_FIELDS`/`READONLY_FIELDS`
   (graph.js) — los 5 campos requeridos están correctamente en ALLOWED,
   sin conflicto en las otras dos listas.
5. **[VERIFICADO OK]** `WriteQueue.flush()` y `ConflictDetector` (cola
   offline y detección de conflictos) usan el mismo `WorkbookWriter.
   writeRecord()` ya corregido — se benefician del fix automáticamente,
   sin cambios adicionales necesarios.
6. **[NO RELACIONADO, informativo]** El warning de consola "Cross-Origin-
   Opener-Policy would block the window.closed call" (msal-browser.min.js)
   es benigno — MSAL usa `loginPopup()`, y el navegador bloquea la lectura
   de `.closed` sobre la ventana de login.microsoftonline.com (origen
   distinto). MSAL tiene su propio fallback interno; no afecta el login.
   No es corregible desde este lado (GitHub Pages es hosting estático, y
   el origen que dispara el warning es de Microsoft, no de esta app).

## GH3.42.20
- Nuevo KPI solicitado por Cristian: tarjeta "Torres" en Resumen (autorizado
  el cambio en dashboard.js — core congelado). No existía ningún breakdown
  por tipo de equipo (u.tipo solo se usaba para filtro/badge de tabla).
- `buildDashboardStats()`: agregado `porTipo` (PORTATIL/TORRE), mismo
  patrón que `porEmpresa` (total/operativos/backup/entregados/pct).
- `setTipoFilter(tipo)` (ui.js, capa modificable) — mismo patrón que
  `setStateFilter`, navega a Usuarios y aplica el filtro por tipo.
- Tarjeta "Torres" en el grid de Resumen (index.html), mismo estilo visual
  que las demás tarjetas, clic navega a Usuarios filtrado por TORRE.
- Verificado contra el Excel real: 21 torres de 146 equipos.
- No se agregó tarjeta de "Portátiles" — el pedido fue puntual para
  torres. El dato ya está disponible en porTipo['PORTATIL'] si se quiere
  agregar después, es una tarjeta más siguiendo el mismo patrón.

## GH3.42.21
- Completado el pedido de Cristian ("un KPI por tipo"): tarjeta
  "Portátiles" en Resumen, mismo patrón que Torres (GH3.42.20). No
  requirió tocar dashboard.js — porTipo['PORTATIL'] ya existía desde el
  cambio anterior. Solo capa modificable: index.html + ui.js.

## GH3.42.22
- FIX vista Ejecutivos/Reportes: la tarjeta "REP-01 · Alistamiento"
  mostraba `_bdsR.proceso` (agrupa 9 estados: Alistamiento + Programado +
  En tránsito + Entregado + Pendiente devolución + En tránsito anterior +
  Equipo anterior recibido + Pendiente aprobación + Cerrado), no el
  conteo específico de Alistamiento. Por eso el número de la tarjeta
  (ej. "9" con filtro TORRE) no coincidía con el detalle al hacer clic
  ("Sin resultados con los filtros actuales") — el detalle sí filtraba
  correctamente solo `estado==='Alistamiento'`, la tarjeta apuntaba al
  valor equivocado. Reportado por Cristian con captura real (filtro
  TORRE, 19 de 142 base).
- Fix: `r-alistamiento` ahora lee `_bdsR.estados['Alistamiento']`
  (mismo patrón ya usado en Resumen — `renderResumen()` usa
  `m.estados['Alistamiento']` para su propia tarjeta "En alistamiento").
- Hallazgo secundario del mismo tipo, corregido de una vez: `ENTREGADO_
  STATES` (local a `setReport()`, usado en el detalle de REP-04) no
  incluía 'Entregado'/'Completado' (legacy/genéricos), a diferencia de
  `ENTREGADO_ST` en dashboard.js — alineado para evitar el mismo tipo de
  discrepancia tarjeta-vs-detalle en "Entregados".

## GH3.42.23
- FIX (autorizado por Cristian — toca dashboard.js, core congelado):
  panel Seguimiento mostraba Pendientes(10) + En proceso(118) +
  Finalizados(11) = 139, pero Total equipos = 142 — faltaban 3.
  Reportado por Cristian con captura real (modo oscuro, filtros
  globales sin aplicar).
- Causa raíz: `PROC_ST` (usado para el KPI "En proceso" general, y los
  desgloses por empresa y por técnico — los 3 leen de la misma
  constante) tenía dos problemas:
  1. No incluía 'Pendiente acta' (estado agregado en GH3.42.8, nunca
     sumado aquí) — esos registros no contaban en Pendientes, En
     proceso NI Finalizados, cayendo en un hueco invisible.
  2. Incluía 'Cerrado', que TAMBIÉN está en el criterio de
     "Finalizados" — un registro Cerrado se contaba dos veces
     (En proceso Y Finalizados a la vez), contradiciendo la etiqueta
     "Exclusivo" del KPI.
- Fix: PROC_ST ahora es Alistamiento, Programado, En tránsito equipo
  nuevo, Entregado equipo nuevo, Pendiente devolución equipo anterior,
  En tránsito equipo anterior, Equipo anterior recibido, Pendiente
  acta, Pendiente aprobación (9 estados) — se quita Cerrado, se agrega
  Pendiente acta. Afecta consistentemente `proceso` (KPI general),
  `porEmpresa[emp].proceso` y `porTecnico[t].proceso` — una sola
  constante, los 3 se corrigen a la vez.
- Nota: Feedback/Bloqueado/Corrección requerida siguen sin contar en
  ninguno de los 3 buckets (Pendientes/Proceso/Finalizados) — igual que
  antes del fix, no es una regresión nueva. Son estados de excepción
  fuera del flujo feliz de 11 estados, no forman parte de esta
  aritmética de 3 categorías por diseño original.

## GH3.42.24
- FIX reportado por Cristian: equipo clasificado como RAEE por
  obsolescencia (Motor A — generación de procesador) mostraba
  "Reasignación" en el widget de evaluación física (Motor B —
  RAEEEngine, basado solo en batería/teclado/touchpad/estético).
- Causa raíz: ya existía una regla de reconciliación entre los dos
  motores ("RC-07 T3: Si Motor A Reasignable → forzar Reasignacion en
  Motor B"), pero era ASIMÉTRICA — solo cubría el caso "CPU reciente
  (Reasignable) gana sobre estado físico", nunca el caso inverso
  ("CPU obsoleto (RAEE) gana sobre estado físico"). Un equipo con
  procesador viejo pero condición física aceptable (batería Regular,
  resto Bueno) caía en la recomendación por defecto del motor físico
  ("Reasignación — estado general aceptable"), ignorando que Motor A ya
  lo había marcado RAEE.
- Impacto más allá del widget: `recomendacion_raee` (el campo que
  queda guardado) es el mismo que usa `_computeDestinoFinal()` en
  dashboard.js para el KPI "Destino Final" del panel Seguimiento — sin
  este fix, el equipo se hubiera contado como "Reasignación" en ese
  reporte ejecutivo, no como "RAEE", en toda la vida del registro.
- Fix: agregada la regla espejo — `estado_eq_ant === 'RAEE'` fuerza
  `recomendacion_raee = 'RAEE'`, igual que ya pasa con 'Reasignable'.
  Aplicado en los 2 lugares donde vive la regla original:
  `actualizarRecomendacion()` (vista previa en vivo, lo que se ve en el
  modal) y `saveRecord()` (lo que se persiste a Excel). No tocó
  archivos core congelado — ambos puntos están en ui.js.
- Verificado con los valores exactos de la captura (batería Regular,
  teclado/touchpad/estético Bueno): Motor B solo → "Reasignacion";
  con Motor A=RAEE y el fix → "RAEE".

## GH3.42.25
- A pedido de Cristian: la tarjeta "Torres" pasa de mostrar solo un
  número a abrir un reporte de seguimiento — dos listas (Entregadas /
  Pendientes) con nombre, ciudad, técnico y badge de estado por
  persona, para poder hacerle seguimiento puntual a quién falta.
- Nuevo modal `#torres-modal-bg` (index.html, mismo patrón visual que
  el resto de modales) + `openTorresReport()`/`closeTorresModal()`
  (ui.js). Criterio "entregado" alineado con `porTipo.entregados` de
  dashboard.js (fecha_entrega presente O estado en la lista de estados
  post-entrega) — sin necesidad de tocar dashboard.js, todo vive en la
  capa modificable.
- Se conserva acceso a la tabla completa filtrable vía botón
  "Ver todas en Usuarios" dentro del modal (reutiliza setTipoFilter).
- Corregido en el camino, antes de entregar: usé `badgeClass()` como
  función global por error — en realidad vive en
  `ConfigService.badgeClass()`. Corregido y verificado con
  `node --check` antes de empaquetar.
- Verificado con dataset sintético (node -e): split entregadas/
  pendientes correcto contra 4 casos de prueba.

## GH3.42.26
- Fase 1 de la consolidación Seguimiento↔Ejecutivos (discutida con
  Cristian): las tarjetas de Seguimiento que tienen equivalente exacto
  en `setReport()` (Entregados, Actas firmadas, Finalizados,
  Pendientes, En envío) ahora son clickeables — navegan a Ejecutivos
  con el reporte correspondiente ya abierto, reutilizando 100% el motor
  de drill-down existente (0 código nuevo de renderizado de tabla).
- No se tocó dashboard.js — todo el bridge de filtros vive en ui.js
  (`_goToReport()`).
- Limitación conocida, documentada: los filtros de Seguimiento
  (PANEL_FILTERS: empresa/ciudad/proyecto/tecnico/estado/feedback) y
  los de Ejecutivos (state.repFilters: empresa/tipo/proyecto/tecnico)
  no son 1:1. Solo empresa/proyecto/tecnico se trasladan. Si hay un
  filtro de ciudad/estado/feedback activo en Seguimiento, el detalle en
  Ejecutivos no lo hereda.
- "Total equipos", "En proceso" y "Backups" quedan SIN clic por ahora —
  no tienen caso equivalente exacto en setReport() (en particular "En
  proceso" es el agregado PROC_ST de 9 estados, no uno solo).
- Pendiente de decisión: retirar "Ejecutivos" del sidebar (paso 3 del
  plan acordado) queda condicionado a confirmar si alguien lo usa hoy
  para exportar/imprimir a un stakeholder externo.

## GH3.42.27
- REFINAMIENTO de GH3.42.24, a pedido de Cristian: obsolescencia (Motor
  A = RAEE) ya NO fuerza automáticamente "RAEE" en el resultado final.
  Regla correcta: un equipo obsoleto pero físicamente sano debe poder
  donarse o venderse internamente — solo va a RAEE si ADEMÁS está
  dañado físicamente (2+ componentes en Malo). Lo único que la
  obsolescencia descarta es "Reasignación" (no tiene sentido reasignar
  un equipo obsoleto a un usuario nuevo).
- Nueva lógica (misma que GH3.42.24, en los mismos 2 lugares —
  `actualizarRecomendacion()` y `saveRecord()`, ambos en ui.js):
  malos≥2 → RAEE; si no, regulares≥2 → Donación; si no → Venta interna.
  Umbrales idénticos a los que ya usa `RAEEEngine.calcular()` para el
  resto de equipos — no se inventaron números nuevos, solo se
  reutilizaron los ya establecidos.
- Verificado con 4 casos (node -e): el caso exacto de la captura
  (batería Regular, resto Bueno) pasa de "RAEE" a "Venta interna";
  un caso con 2 componentes Malo sigue yendo a RAEE; 3 Regular →
  Donación; condición perfecta → Venta interna (tampoco reasignable).
