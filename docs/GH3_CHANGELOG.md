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

## GH3.42.28
Batch de cambios en la vista Seguimiento, a pedido de Cristian:

- **FIX CRÍTICO**: los 6 filtros globales (empresa/ciudad/proyecto/
  técnico/estado/feedback) actualizaban `PANEL_FILTERS` pero
  `renderPanelEjecutivo()` llamaba `DataService.getRenewals({})` con
  objeto vacío — ignoraba los filtros por completo. Toda la vista
  (hero, KPIs, cumplimiento, leaderboard, ciudades, donuts) se
  recalcula ahora sobre el subconjunto filtrado.
- **FIX adicional, mismo bug de raíz**: los dropdowns de empresa/
  ciudad/proyecto/técnico nunca se poblaban con opciones reales — solo
  tenían el placeholder "Todas las X". Sin esto, aunque el filtrado ya
  funcionara, no había nada que seleccionar. Agregado
  `_populatePanelFilters()`.
- Agregado contador "X de Y" (`#pf-count`) cuando hay algún filtro
  activo, igual que en Ejecutivos.
- REP-01/Alistamiento ahora también incluye "Programado" (antes solo
  estado==='Alistamiento' estricto, GH3.42.22) — mismo criterio
  aplicado en la tarjeta y en el detalle al hacer clic.
- Retirado Pipeline/Funnel de Seguimiento (HTML + llamada JS).
- "Cumplimiento por empresa" reemplazado por la MISMA construcción que
  usa Ejecutivos (`.exec-empresa-card`, 9 estadísticas) — antes eran
  dos versiones distintas (Seguimiento tenía `.exec-emp-card`, 5
  estadísticas).
- Leaderboard técnicos: ahora ocupa una fila completa (antes compartía
  fila con Cumplimiento por empresa/Ciudades).
- Ciudades: fila propia, separada del Leaderboard.
- FIX responsive encontrado en el camino: `.exec-empresa-grid` (9
  estadísticas en 6 columnas fijas) no tenía ningún breakpoint —
  afecta tanto Ejecutivos como Seguimiento, ambas usan esta misma
  clase. Agregado: 3 columnas a 1024px, 2 columnas a 640px.
- Verificado con simulación (node -e): 5 casos de filtrado combinado,
  todos correctos.

### Alcance de la revisión responsive/simetría
Se revisó y corrigió lo directamente relacionado con esta vista
(Cumplimiento por empresa, ahora compartido con Ejecutivos). No se
hizo una auditoría exhaustiva de "todos los cuadros" del resto de la
app — si se quiere ese alcance completo, es un trabajo aparte.

## GH3.42.29
- A pedido de Cristian: botón "Preparar datos para SharePoint
  (Recolecciones)" en la sección de evaluación física del modal.
  Reúne tipo + marca/modelo/serial/AF/placa/hostname del equipo
  devuelto, la clasificación técnica (Motor A) y la recomendación
  física ya reconciliada (Motor B), en un panel con texto listo para
  copiar (botón "Copiar todo", Clipboard API con fallback a
  document.execCommand).
- Formato del bloque de equipo verificado contra el ejemplo real de la
  captura ("PORTATIL" + "DELL LATITUDE 3400 FNCJJW2 7953 601827
  PO-4820-CJJW2") — coincide exacto asumiendo el orden marca→modelo→
  serial→AF→placa→hostname. Ese orden se infirió de un solo ejemplo —
  pedirle a Cristian que confirme si alguna vez sale desordenado.
- DECISIÓN EXPLÍCITA, no auto-completa "ESTADO FINAL" de SharePoint —
  no hay forma confirmada de mapear la recomendación del motor
  (RAEE/Donación/Venta interna/Reasignación) al choice exacto de esa
  lista (ej. "Obsoleto"). Se muestra la clasificación + recomendación
  como referencia para que el usuario seleccione el valor correcto él
  mismo, en vez de arriesgar un mapeo adivinado.
- REFACTOR en el camino: la reconciliación Motor A/Motor B (GH3.42.24 +
  GH3.42.27) vivía duplicada en `actualizarRecomendacion()` y
  `saveRecord()`. Agregar un tercer punto de uso para este botón hubiera
  repetido el mismo patrón de deriva que ya causó bugs esta sesión
  (Alistamiento GH3.42.22, PROC_ST GH3.42.23, ENTREGADO_STATES
  GH3.42.22) — se extrajo a `_reconciliarMotorRAEE()`, un solo lugar,
  los 3 puntos de uso la llaman igual.

## GH3.42.30
- Cambiado el formato del texto generado por "Preparar datos para
  SharePoint" al formato exacto pedido por Cristian (lista con
  viñetas ♦: Usuario, Modelo, HN, SN, Placa, Procesador, RAM, Disco,
  Bateria, Estetico, Touchpad, Funcional), con "Recomendacion RAEE"
  como encabezado.
- ASUNCIÓN A CONFIRMAR: "Funcional" se mapeó a `eval_teclado` (estado
  del teclado) — es el único de los 4 campos que alimentan
  `RAEEEngine.calcular()` (batería/teclado/touchpad/estético) que no
  tenía rótulo explícito en la lista que compartió Cristian. Si
  "Funcional" se refería a otra cosa, avisar para corregir.
- "Modelo" combina marca + modelo (ej. "DELL LATITUDE 3400") — no se
  pidió un campo "Marca" separado.
- Verificado con dataset de ejemplo (node -e): salida coincide con el
  formato exacto solicitado.

## GH3.42.31
- Integrado el componente "Meniscus Dock" (meniscus-dock.html, Cristian)
  como dock de acceso rápido — 5 vistas curadas (Resumen/Usuarios/
  Seguimiento/Actividad/Ajustes), animación de "bead" líquido con
  física de resorte manual (rAF) y filtro SVG "goo".
- Proceso: Council previo (Parte 2 del workflow) definió contenido y
  reutilización de goView(); Cristian confirmó pero retiró la condición
  "solo mobile" — el dock queda visible en todos los tamaños de pantalla.
- Colores: los 5 acentos originales del demo (#c2f542/#4ec5f1/#ffa53d/
  #b98cff/#ff4fa0) reemplazados por la familia roja REN26, a pedido
  explícito (reemplaza la restricción dura original del brief, que
  pedía mantenerlos fijos — se documenta el cambio de instrucción).
- Sin las ".faces" de texto del demo original ("solo quiero la
  animación") — cada vista real ya tiene su propio contenido.
- FIX crítico encontrado antes de integrar: el original hacía
  `document.documentElement.style.setProperty('--accent', ...)` — habría
  sobreescrito el token `--accent` GLOBAL de toda la app (botones,
  badges, focus rings) con el color del tab activo del dock. Se
  escopeó a `--mdock-accent`, propio de `#mdock`, sin tocar ningún
  token existente.
- FIX de arquitectura: no se creó un segundo router — el dock llama a
  `goView()` existente. Se agregó un gancho de una línea en `goView()`
  (utils.js) para sincronizar el bead cuando la navegación viene del
  sidebar (`MeniscusDock.setActiveByView`).
- Guardia RBAC agregada (no estaba en el original): técnico no tiene
  acceso a 'actividad' ni 'ajustes' — el dock ahora verifica
  `AuthorizationService.canAccess()` antes de animar el bead hacia esos
  tabs, evitando que quede desincronizado de la vista realmente
  mostrada si `goView()` bloquea la navegación.
- Mejora de rendimiento agregada (no estaba en el original): el loop de
  `requestAnimationFrame` se pausa con `document.hidden` — el dock ahora
  es permanente (no solo mobile), correr el loop indefinidamente en
  background era un costo de batería innecesario.
- Sin tocar: dataService.js, graph.js, provider.js, refresh.js,
  dashboard.js, sync.js, auditService.js, mismatches.js (core
  congelado, respetado). Sin tocar ningún `[data-theme="dark"]`
  existente — el dock mantiene su propia estética oscura fija en
  ambos modos de la app, mismo criterio que los tooltips globales.
- Clases CSS nuevas prefijadas `mdock-` — verificado sin colisión con
  el resto del proyecto antes de escribir.
- Archivos: index.html (markup + filtro SVG goo, nuevos, sin reemplazar
  bloques existentes), css/components.css (bloque nuevo anexado),
  js/meniscusDock.js (nuevo), js/utils.js (1 línea en goView()).

### Verificado
- `node --check` en los 19 archivos JS (18 + meniscusDock.js nuevo).
- Balance de llaves en los 7 CSS — sin discrepancias.
- Simulación de guardia RBAC (node -e): técnico correctamente bloqueado
  de actividad/ajustes, super_admin con acceso completo, mapeo de
  índices de tabs correcto.
- **Pendiente de confirmación visual tras deploy** — no hay navegador
  en este entorno para verificar la física del bead en vivo.

### Riesgos / decisiones abiertas, no resueltas
- El dock ahora es permanente y no tiene forma de ocultarse — no se
  agregó botón de cierre/colapso por no haber sido pedido. Si resulta
  intrusivo, decir y se agrega.
- Los tabs "Actividad"/"Ajustes" siguen siendo VISIBLES para técnico
  (solo se bloquea la navegación); no se filtran/ocultan del dock por
  rol, a diferencia del sidebar que sí los oculta con display:none.
  Si se quiere el mismo comportamiento, es un cambio adicional.

## GH3.42.32
- Calibrado el fondo general de modo oscuro (`--bg`) contra el sitio
  real de Heinsohn (heinsohn.co/co, captura del modo oscuro real
  compartida por Cristian) — de `#0B0B10` a `#08080B`, más cerca del
  negro auténtico de marca.
- NO se tocó `--bg-elev`/`--bg-card` (superficies con texto/datos:
  inputs, tarjetas) — ahí sigue aplicando el criterio "más amigable"
  de GH3.42.14 (evitar fatiga visual en un dashboard denso de
  tarjetas/tablas). Son dos criterios distintos que conviven: fondo
  general más fiel a marca, superficies de contenido más suaves.
- No se pudo leer la paleta exacta vía `web_fetch` a heinsohn.co/co —
  el tool solo devuelve texto extraído, sin CSS ni colores. Se usó la
  captura visual real que compartió Cristian en su lugar.
- Sin cambios en --accent/--brand — ya están en la familia roja
  correcta, usados como acento (no como fondo sólido), consistente
  con cómo se usa el rojo en el sitio real.

## GH3.42.33
Dos bugs de contraste en modo oscuro, reportados por Cristian con
capturas reales (vista "Por técnico" y widget "Avance esperado vs real").

- **FIX severo — hero ilegible en 8 vistas** (Usuarios, Por técnico, Por
  ciudad, Devoluciones, Reportes, Actividad, Ajustes, Aprobaciones):
  `.view .hero.compact` (global-refinement.css) usaba `background:
  var(--ink, #0A0E14)`. Este hero es oscuro SIEMPRE por diseño (el texto
  de adentro está hardcodeado en blanco: #FAFAF8, rgba(255,255,255,.5/.6)).
  Cuando `--ink` pasó a ser CLARO en modo oscuro (GH3.42.14, para servir
  de color de texto en la sección "papel" de Seguimiento), este OTRO uso
  se rompió: fondo casi blanco + texto blanco encima = ilegible. Mismo
  tipo de colisión que ya se corrigió una vez para `#view-panel
  .panel-hero` — esta segunda instancia se escapó porque vive en un
  archivo distinto (global-refinement.css) que no se auditó en su
  momento. Fix: fondo fijo `#0A0E14`, igual criterio que la vez anterior.
- **FIX contraste — etiquetas invisibles en tarjeta de técnico**
  (carrusel Leaderboard): `.rc-stat` usaba `background: rgba(255,255,255,.5)`
  fijo — en dark mode da un box gris-claro medio, y `.rc-stat-l`
  (`color: var(--muted)`, gris medio en dark) pierde casi todo el
  contraste contra ese fondo. Cambiado a `var(--paper-2, ...)` — mismo
  aspecto en claro, fondo realmente oscuro en dark.
- **FIX contraste — gauge "Avance esperado vs real"**: `_renderGaugeSVG()`
  dibujaba el track (`#E5E7EB`), el marcador/línea punteada y el
  subtítulo (`#475569`/`#6B7280`) con hex fijo vía atributos XML
  (`stroke=`/`fill=`), que NO resuelven `var()`. Cambiados a `style=`
  (que sí resuelve CSS custom properties) con `var(--border-strong)`/
  `var(--text-3)` — el track claro se quedaba claro sobre tarjeta
  oscura, y los grises oscuros del marcador/subtítulo no tenían
  contraste contra un fondo oscuro. De paso, alineado el swatch
  "Esperado" de la leyenda (hex fijo `#94A3B8`) al mismo token.
- Patrón repetido en los 3 hallazgos: colores fijos (hex u overlays
  rgba) que no responden al toggle de tema, en componentes que SÍ
  necesitaban adaptarse (a diferencia de los que correctamente se
  mantienen oscuros siempre — heroes, tooltips).

## GH3.42.34
A pedido de Cristian, sobre la vista Ejecutivos/Reportes y Seguimiento.

- **FIX encontrado en la captura**: franja angosta "fantasma" entre
  REP-01 y REP-02 (mismo ícono que REP-01, sin número ni título).
  Causa: `#view-reportes .reports-grid` usaba `grid-template-columns:
  repeat(auto-fill, minmax(180px,1fr))` — con un número fijo de
  tarjetas (6, ahora 8), `auto-fill` puede dejar una columna sobrante
  angosta cuando el ancho disponible no calza exacto. Cambiado a
  `auto-fit`, que colapsa cualquier columna sobrante a cero.
- Agregado **REP-07 · En tránsito (equipo nuevo)** — conteo estricto de
  `estado==='En tránsito equipo nuevo'`.
- Agregado **REP-08 · Pend. devolución** — `Pendiente devolución equipo
  anterior` + `En tránsito equipo anterior` (los 2 estados exactos que
  pidió Cristian).
- **AVISO, no resuelto por decisión de Cristian**: REP-08 se superpone
  con REP-04 "Devoluciones" (ya existente), que cubre esos MISMOS 2
  estados más "Equipo anterior recibido". Se creó igual porque se pidió
  explícitamente con ese alcance más angosto — queda a decisión de
  Cristian si REP-04 sigue siendo necesario o se reemplaza.
- Nota de numeración interna (preexistente, no corregida): el "title"
  interno de cada reporte (usado en el encabezado del detalle) no
  coincide con el número REP-XX visible en la tarjeta desde antes de
  este cambio (ej. "Devoluciones" se ve como REP-04 pero decía
  "REP-06" internamente). REP-07/REP-08 nuevos usan REP-10/REP-11
  internamente para no chocar con los ya existentes — es un parche
  puntual, no una corrección de la numeración vieja.
- Agregado filtro **"Tipo"** (PORTATIL/TORRE) a los filtros globales de
  Seguimiento — dropdown nuevo (`#pf-tipo`), poblado dinámicamente,
  sumado a `_matchPF()` y al contador de filtros activos.
- Verificado: `node --check`, balance de llaves en 7 CSS, simulación de
  los 2 nuevos reportes con dataset sintético (2/2 casos correctos).

## GH3.42.35
- A pedido de Cristian: reordenadas las 8 tarjetas de Ejecutivos/Reportes
  según la secuencia real de estados del flujo REN26 — Alistamiento →
  En tránsito (nuevo) → Entregados → Pend. devolución → Devoluciones →
  Actas firmadas → Finalizados → Feedback.
- Renumeradas REP-01..08 consistente con el nuevo orden visual. De paso
  se cierra la inconsistencia interna/visible que había quedado
  documentada como pendiente en GH3.42.34 (el "title" interno de
  `setReport()` ya no coincidía con el número mostrado en la tarjeta).
- Los 3 reportes sin tarjeta visible ('envio','pendientes','raee',
  alcanzables solo por código, no por UI) quedaron renumerados al final
  (REP-09/10/11) para no chocar con los 8 visibles.
- Sin cambios de comportamiento — mismos data-rep/id/onclick/filtros,
  solo posición en el grid y el texto "REP-XX" mostrado/interno.
- Verificado: `node --check`, conteo de tarjetas (8, sin duplicados ni
  huecos en REP-01..08).

## GH3.42.36
Primer paso de la consolidación Resumen/Seguimiento/Ejecutivos
(análisis de redundancia con Cristian, enfoque de presentación de
datos — pirámide invertida). Cambios seguros y reversibles; nada se
eliminó.

- **Resumen reordenado**: 7 tarjetas clave primero (Total equipos,
  Pendientes, Entregados, Por aprobar, Pendiente acta, Dev. pendientes,
  Renovaciones completadas — las que definen avance o requieren acción),
  divisor "Detalle operativo", luego las 6 restantes (En alistamiento,
  En envío, Actas firmadas, Backups, Torres, Portátiles). Mismos ids/
  onclick/data-tip en las 13 — solo posición y jerarquía visual.
- **"Ejecutivos" retirado del menú principal** — `display:none` en el
  `.sb-item`, la vista sigue funcionando y se alcanza por clic desde
  las 8 tarjetas de Seguimiento (enlace ya construido en GH3.42.26).
  Verificado que RBAC (boot.js) no tiene ninguna referencia que
  reactive este ítem para algún rol.
- Verificado: `node --check`, conteo de `.sb-item` (13) y `.metric-card`
  (13) sin cambios — confirma que no se perdió ningún elemento.

### Pendiente, sin resolver
- La pregunta del Council anterior sigue sin respuesta explícita: si
  alguna de las 3 vistas se usa para exportar/imprimir a un
  stakeholder externo. Se procedió asumiendo que no, dado que "retirar
  del menú" es 100% reversible (una línea de CSS) si resulta que sí.
- Destino final de "Resumen" como vista propia (¿se queda tal cual,
  se repropone para otra audiencia, o se retira también?) — no se
  decidió en este paso, es la siguiente conversación.

## GH3.42.37
Encontrado en vivo, probando el sitio real desplegado en modo oscuro
(confirmando que GH3.42.34/35 SÍ está desplegado, GH3.42.36 todavía no).

- **FIX nuevo**: `--bg-2` es un token FANTASMA — nunca se definió en
  ningún archivo CSS del proyecto. Todo lo que lo usaba caía siempre a
  su valor de fallback fijo (`#f9f9f9`/`#f0f0f0`), ignorando el modo
  oscuro por completo. Afectaba 4 componentes:
  - `.exec-empresa-card` ("Cumplimiento por empresa" en Seguimiento y
    Ejecutivos) — confirmado visualmente: card blanca flotando en una
    página por lo demás oscura.
  - `.pipe-bar-wrap` (fondo de las barras del Pipeline REN26, Ejecutivos)
  - `.risk-row` (filas de Riesgos Ejecutivos)
  - `.op-empresa-block` (bloque de empresa en Resumen)
  - Los 4 cambiados a `var(--paper-2, ...)`, que sí tiene valores
    reales para ambos modos (`#F1F0EC` claro / `#1D1D27` oscuro).
- Verificado en vivo, en el sitio real desplegado (login con cuenta de
  Cristian, toggle claro/oscuro real): confirma que los fixes de
  GH3.42.33 (hero de Por técnico, etiquetas de estadísticas, gauge de
  Seguimiento) funcionan correctamente. Este nuevo bug (--bg-2) NO
  estaba corregido — es un hallazgo nuevo de esta sesión de pruebas.
- Confirmado también: el sitio desplegado tiene GH3.42.35 (REP-01..08
  reordenados, grid auto-fit sin franja fantasma) pero NO GH3.42.36
  (Ejecutivos todavía visible en el sidebar) — falta desplegar esa
  versión o una posterior.

## GH3.42.38
- Retirado por completo el Meniscus Dock (GH3.42.31) — a pedido de
  Cristian. Duplicaba navegación ya cubierta por el sidebar
  (Resumen/Usuarios/Seguimiento/Actividad/Ajustes en ambos lados) sin
  aportar algo que el sidebar no tuviera ya.
- Eliminado: markup + filtro SVG goo (index.html), bloque CSS completo
  (`.mdock-*`, components.css), archivo js/meniscusDock.js, gancho de
  sincronización en goView() (utils.js).
- Verificado: sin referencias residuales a mdock/meniscus en ningún
  archivo. `node --check` en todo el proyecto. Balance de llaves en
  7 CSS sin discrepancias.

## GH3.42.39
Continuación de la revisión "mirada de gerente" — a pedido de Cristian.

- **Reordenado**: "Cuello de botella" y "Riesgos activos" ahora viven
  justo después del hero/filtros en Seguimiento, antes de Gauge/
  Productividad/Burndown. Antes vivían al final de la página (FILA 5,
  después de Cumplimiento/Leaderboard/Ciudades/Devoluciones/Destino) —
  un director veía el badge "RIESGO" del hero sin su "por qué" a la
  vista, a menos que bajara 4 pantallas completas.
- Contenido sin cambios — mismos ids (`#pe-botella`, `#pe-riesgos-list`),
  solo posición.
- **Decisión revisada, no ejecutada**: NO se migra el mapa de ciudades
  de Resumen a Seguimiento (propuesta de GH3.42 anterior). Seguimiento
  ya tiene la sección "Ciudades" (20+ tarjetas) más la vista dedicada
  "Por ciudad" — el mapa muestra la misma información en otra forma
  visual. Migrarlo habría reintroducido la misma duplicación que esta
  consolidación busca eliminar.
- Verificado: sin ids duplicados (`#pe-botella`/`#pe-riesgos-list`
  aparecen exactamente 1 vez cada uno — dos copias hubieran hecho que
  `renderPanelEjecutivo()` solo actualizara la primera, dejando la
  segunda siempre vacía). Balance global de `<div>` (631=631).
  `node --check` en todo el proyecto.

## GH3.42.40
- Retirado "Por ciudad" del sidebar — a mi criterio (Cristian lo dejó
  abierto), continuando la revisión "mirada de gerente". Misma
  información que ya muestra la sección "Ciudades" de Seguimiento (23
  ciudades, mismo desglose entregados/pendientes/%) — sin un modo de
  consumo distinto que lo justifique como destino de navegación
  aparte. A diferencia de "Por técnico" (carrusel de una tarjeta a la
  vez, sí distinto del Leaderboard continuo), esto es la misma grilla
  completa con tarjetas más grandes — no un caso de uso diferente.
- Mismo tratamiento reversible que "Ejecutivos" (GH3.42.36):
  `display:none`, nada se borró, la vista sigue funcionando.
- Verificado: rol "visitante" tiene 'ciudades' en su whitelist RBAC,
  pero también 'panel' (Seguimiento) — que ya muestra la misma
  información. Ocultar el ítem no quita acceso a ningún dato.
  Confirmado que ningún RBAC en boot.js reactiva este ítem para
  ningún rol. `node --check` en todo el proyecto. Conteo de
  `.sb-item`: 13, sin cambios.

## GH3.42.41
A pedido de Cristian ("no la he entendido") — evaluación del gráfico
Burn Down en Seguimiento.

- **Diagnóstico**: medía "equipos pendientes" (bajando = bien) — la
  única métrica de todo el dashboard donde ir bien se ve como una
  línea que BAJA. Todo el resto usa "subir = bien" (Avance global 65%,
  Entregados 93). Además usaba terminología agile ("Burn Down") ajena
  al resto de la app. Se detectó también superposición conceptual con
  el gauge "Avance esperado vs real" — mismo concepto (ritmo real vs
  ideal), pero el gauge es una foto de hoy y el burndown es la
  trayectoria completa en el tiempo — no son redundantes, son
  complementarios (foto vs. película).
- **Decisión (Cristian aceptó la recomendación)**: resignificar, no
  eliminar. Cambios:
  - `_computeBurnDown()` (dashboard.js — **AUTORIZADO**, aceptación
    explícita de la recomendación de invertir el eje): ahora devuelve
    "% avance acumulado" ascendente en vez de "equipos pendientes"
    descendente. Mismos nombres de campo (esperado/real) — único
    consumidor (`_renderBurnDownChart`) verificado antes del cambio.
  - `_renderBurnDownChart()` (ui.js): etiquetas "Meta ideal"/"Real
    (pendientes)" → "Esperado"/"Real" (mismo lenguaje que el gauge).
    Línea "Real" de rojo a verde (es el avance real, no una alerta —
    el rojo queda para la desviación, igual criterio que el gauge).
    Eje Y en % (0-100) en vez de conteo abierto.
  - Título de la tarjeta: "Burn Down" → "Avance en el tiempo".
- Verificado: `node --check`. Simulación con dataset sintético (93
  entregados repartidos en el tiempo) — ambas series ascienden
  correctamente, fechas futuras devuelven `real:null` como se espera.

## GH3.42.42
FIX crítico de datos — encontrado mientras verificaba GH3.42.41 en
producción (Cristian autorizó extender el fix a la segunda función).

- **Causa raíz confirmada con datos reales**: `fecha_entrega` llega del
  Excel como número serial crudo (ej. "46220") en vez de una fecha
  reconocible por `new Date()`. `new Date("46220")` lo interpreta como
  el AÑO 46220, no como una fecha de 2026 — confirmado vía consola en
  el sitio real desplegado: 46220 en serial de Excel = 17 jul 2026,
  fecha perfectamente válida dentro del proyecto.
- Afectaba EN SILENCIO, desde antes de esta sesión:
  - `_histogramaEntregas()` — alimenta el histograma de "Productividad"
    en Seguimiento. Nunca contaba ningún registro con fecha en formato
    serial — devolvía conteos artificialmente bajos/vacíos.
  - `_computeBurnDown()` (recién resignificada en GH3.42.41) — por esto
    la línea "Real" se veía plana cerca de 10% en vez de acercarse al
    65% real: casi todos los registros con `fecha_entrega` poblada
    (79 de 146) nunca pasaban la comparación de fecha.
- **Fix**: helper compartido `_parseFechaExcel()` — detecta si el valor
  es un número serial de Excel (rango 20000-60000, fechas ~2009-2036) y
  lo convierte correctamente vía el epoch de Excel (1899-12-30);
  si no, usa `new Date()` normal. Usado en ambas funciones.
- Verificado: helper probado contra los 5 valores reales extraídos en
  vivo del sitio desplegado (46220/46209/46225/46226/46227) — los 5
  convierten a las fechas correctas (jul 2026, dentro del rango del
  proyecto). También probado con fecha ISO normal y valores vacíos/null.
  `node --check` en todo el proyecto.

## GH3.42.43
Dos correcciones puntuales a pedido de Cristian.

- **FIX — badge de Actividad inflado por ruido de sistema**:
  `updateNotifBadge()` contaba TODAS las notificaciones, incluidas
  "Sesión iniciada"/"Sistema cargado" (category:'system') — cada login
  o recarga subía el número sin que hubiera nada que revisar. Se
  excluyen del CONTEO (badge, punto rojo, subtítulo del centro de
  notificaciones) — el registro completo de Actividad sigue mostrando
  todo, sin perder trazabilidad de auditoría.
- **FIX — encabezado "Acciones" fuera de la tabla de Usuarios**:
  etiqueta HTML mal cerrada (`</tr<th...`, faltaba el `>`) hacía que el
  navegador sacara esa celda de la fila de encabezados, mostrándola
  como texto flotante encima de la tabla en vez de como última columna
  alineada con los íconos de acción. Corregido: la celda ahora vive
  dentro de la misma `<tr>` que el resto de encabezados.
- Verificado: `node --check`. Sin ocurrencias restantes de `</tr<` en
  el proyecto.

## GH3.42.44
Reemplazado el carrusel de "Por técnico" por una grilla de tarjetas
con anillo de actividad (estética Apple Watch/Fitness) — a pedido de
Cristian, evaluado en el chat con maquetas antes de implementar.

- **Nueva función `_renderTecnicoGrid()`** (js/ui.js) — grilla
  responsive (`repeat(auto-fit, minmax(220px,1fr))`, se adapta si hay
  más de 3 técnicos en el futuro), tarjetas con fondo oscuro fijo
  (mismo criterio que heroes/tooltips — no depende del tema
  claro/oscuro de la app), anillo SVG grueso con animación de llenado,
  número que cuenta al mismo ritmo, entrada en cascada (150ms entre
  tarjeta y tarjeta), respeta `prefers-reduced-motion`.
- **Colores por desempeño**, no arbitrarios por persona — mismos
  umbrales que ya usaba el carrusel viejo: verde ≥70%, ámbar 30-69%,
  rojo <30%.
- **Alcance deliberadamente acotado**: solo cambia `renderTecnicos()`
  ("Por técnico"). El Leaderboard de Seguimiento (`pe-tecnico-new`)
  sigue usando `_renderTecnicoCarousel()` sin ningún cambio — no era
  parte de este pedido, y es un componente compartido que no se debía
  tocar sin que se pidiera explícitamente.
- CSS nuevo con prefijo `tg-` (tecnico-funnel.css, bloque nuevo al
  final) para no colisionar con las clases `.rc-*` del carrusel.
- Verificado: `node --check`, balance de llaves en 7 CSS, simulación
  con los 3 técnicos reales (colores e iniciales correctos).

## GH3.42.45
Auditoría propia de GH3.42.44 con las skills `emil-design-eng` y
`review-animations` — a pedido de Cristian ("¿es lo mejor que puedes
hacer?"). 2 fallas reales encontradas y corregidas.

- **FIX — la animación se repetía en cada visita**: entrar a "Por
  técnico" varias veces al día repetía completa la secuencia de 2+
  segundos cada vez. Regla de frecuencia de `emil-design-eng`: algo
  visto ocasionalmente puede tener animación completa, pero algo visto
  varias veces al día no debería sentirse lento por repetición. Fix:
  flag `window._tgHasAnimated` — solo la primera vez por sesión anima;
  después, valores finales al instante (mismo camino que ya existía
  para `prefers-reduced-motion`).
- **FIX — reduced-motion no era realmente "más suave, no cero"**: la
  tarjeta seguía desplazándose (`translateY`) bajo esa preferencia,
  solo se desactivaba el anillo/número. Regla explícita de
  `review-animations`: reduced-motion debe conservar opacidad, quitar
  movimiento espacial. Fix: `@media (prefers-reduced-motion: reduce)`
  ahora también anula el `transform` de la tarjeta.
- **Verificado, no corregido (transparencia)**: `stroke-dashoffset` no
  es una propiedad 100% GPU como `transform`/`opacity` — hallazgo
  técnicamente válido, pero para un solo círculo (no una lista
  repetida) el costo real es insignificante. Se documenta, no se
  cambia.
- Verificado: `node --check` en todo el proyecto, balance de llaves en
  7 CSS.

## GH3.42.46
Navegación por secciones en el formulario de edición — evaluado y
mostrado en el chat antes de implementar, a pedido de Cristian ("me
gusta, sin embargo mantengamos el timeline").

- **Timeline REN26 sin tocar** — el nav nuevo vive aparte, debajo,
  como pidió explícitamente Cristian.
- **`buildFormSectionNav()`** (js/ui.js) — construye los 7 tabs leyendo
  el DOM real (`.form-section` visibles, excluyendo Timeline y
  Auditoría) en vez de una lista fija. Si alguna sección se oculta por
  reglas de estado (`updateSectionVisibility`), su tab desaparece con
  ella automáticamente — se llama después de fijar visibilidad, tanto
  al abrir el modal como al cambiar el estado en vivo.
- Clic en un tab hace scroll suave a la sección; el tab activo se
  resalta solo mientras se hace scroll manual (tracking por posición).
- **Corrección sobre mi propia maqueta anterior**: al revisar el
  código real encontré 2 nombres de sección que había aproximado mal
  ("Equipo actual" → en realidad "Equipo anterior") y una sección
  completa que no había visto (5 · Estado REN26, entre "Equipo nuevo
  asignado" y "Devolución"). El nav final usa los 7 nombres reales.
- CSS nuevo (`.form-nav-tabs`, `.form-nav-tab`) con tokens existentes
  (`--accent`, `--bg-elev`, `--bg-card`, `--text-2`, `--bg-card-hover`)
  verificados uno por uno antes de usarlos — no repetir el bug de
  `--bg-2` (GH3.42.37).
- Sticky bajo el Timeline, con márgenes negativos para pegarse al
  borde real de scroll del modal, no 22px más abajo por el padding del
  contenedor.
- Verificado: `node --check`, balance de llaves en 7 CSS, simulación
  de generación de etiquetas con los 7 textos reales exactos.

## GH3.42.47
Dos correcciones al formulario, reportadas por Cristian con captura.

- **FIX real (no cosmético)**: el clic en un tab de sección hacía
  `scrollIntoView()`, pero el navegador no sabe que `.form-nav-tabs` es
  sticky — el salto dejaba el encabezado y las primeras etiquetas de
  la sección destino tapados detrás de la barra fija. Se veía "5 ·
  Estado REN26" y las etiquetas TÉCNICO/ESTADO desaparecidas, solo los
  valores de los campos sueltos. Fix: `scroll-margin-top: 56px` en
  `.form-section` — el navegador ahora reserva ese espacio en
  cualquier salto a una sección, sin tocar la lógica de scroll en JS.
- Campos del formulario (`.form-input`, `.form-select`,
  `.form-textarea`) con esquinas más redondeadas — `var(--r-sm)` (6px)
  → `var(--r-md)` (10px).
- Verificado: balance de llaves en 7 CSS, `node --check`.

## GH3.42.48
Bug crítico encontrado y corregido — reportado por Cristian ("da clic
sobre la tarjeta de los técnicos y mira lo que sucede"). No era menor:
la vista completa "Por técnico → detalle" probablemente nunca funcionó
para nadie, en ningún navegador, desde que existe.

- **Causa raíz**: `</div>` duplicado en index.html (línea 943) cerraba
  `<main id="main-scroll">` prematuramente. Todo lo que venía después
  en el HTML (`#view-tecnico-detail`, `#view-home-tecnico`, y
  potencialmente otras vistas) terminaba como hijo directo de `<body>`
  en vez de vivir dentro de `#main-scroll` — el contenido SÍ se
  renderizaba (confirmado: 30871 caracteres en el DOM, sin errores de
  consola) pero aparecía empujado una pantalla completa hacia abajo,
  invisible sin scroll manual. Encontrado inspeccionando el DOM en
  vivo (`parentElement.id`, balance de `<div>` línea por línea) —
  balance global de 631 aperturas/630 cierres delató la causa exacta.
- **Fix**: eliminado el `</div>` sobrante. Verificado en vivo
  (inyectado directo en el sitio desplegado antes de esperar
  redeploy): SANTIAGO detalle ahora muestra hero, 6 KPIs y tabla de 48
  usuarios asignados — completo.
- **De paso, mismo patrón de bug que ya until esta sesión ha corregido
  3 veces**: `.hero-sub strong` (número de equipos, ciudad principal)
  usaba `var(--text-1)`, invisible en modo claro contra el fondo
  oscuro fijo de este hero — mismo tipo de colisión que GH3.42.14/33.
  Se agregó el override que faltaba (`.view .hero.compact .hero-sub
  strong { color: #fff }`), siguiendo el mismo patrón ya establecido
  para `.hero-title strong`.
- **También corregido en la misma sesión**: `scrollMainTop()`
  reseteaba `#main-scroll`, pero el scroll real de la página vive en
  `<html>`/document — confirmado con `document.scrollingElement` en
  vivo. Ahora resetea ambos.
- **Pendiente, sin impacto visible conocido**: balance global de
  `<div>` en index.html quedó en 631/630 (un div sin cerrar en algún
  otro punto del archivo, no identificado con precisión). No causa
  síntoma visible — los navegadores cierran divs huérfanos al final
  del documento sin romper el layout. Se documenta para no perderlo
  de vista, no se persiguió exhaustivamente dado el bajo riesgo.
- Verificado: `node --check`, balance de llaves en 7 CSS, balance
  local del bloque view-panel (167=167, antes 167/168).

## GH3.42.49
Continuación de la prueba de GH3.42.48 — Chrome se desconectó a media
verificación. Confirmado en vivo (antes del corte): NICOLAS y SANTIAGO
renderizan completo, el fix estructural de GH3.42.48 está desplegado y
funciona. CRISTIAN seguía en blanco — causa DISTINTA, no la misma.

- **Hallazgo, sin confirmar en vivo (Chrome se desconectó)**: 2
  lugares en ui.js hacían `u.empresa.toLowerCase()` sin verificar que
  `empresa` exista — si algún registro asignado a un técnico tiene el
  campo vacío, esto lanza un error que `renderView()` atrapa
  (`console.error`) pero deja el render de esa vista a medias
  (confirmado que el catch existe; no confirmado que sea la causa
  exacta de lo que le pasa a CRISTIAN, por el corte de conexión).
  Afectaba `renderUsuarios()` (línea 549) y `renderTecnicoDetail()`
  (línea 767).
- **Fix aplicado de todas formas**: es una fragilidad real
  independiente de si es la causa exacta — `(u.empresa || '')` en
  ambos lugares, con fallback `'—'` en el texto mostrado.
- **Pendiente de verificación en vivo** — no se pudo confirmar si esto
  resuelve el caso específico de CRISTIAN antes de que se cortara la
  conexión con Chrome. Necesita reconfirmación tras el próximo push.
- Verificado: `node --check`. Sin otras ocurrencias del mismo patrón
  sin protección en el archivo.

## GH3.42.50
FIX real sobre GH3.42.47 — Cristian reportó con captura que el
problema seguía pasando "scroleando", no haciendo clic en un tab.

- **Causa exacta**: `scroll-margin-top` (GH3.42.47) solo protege el
  salto disparado por `scrollIntoView()` — es decir, únicamente
  cuando se hace CLIC en un tab. Al scrollear manualmente (rueda del
  mouse, barra de scroll), esa propiedad no interviene en absoluto. El
  margen real entre secciones (`.form-section`, 20px) era menor que la
  altura de la barra sticky de tabs (~56px) — al pasar de una sección
  a otra scrolleando, el encabezado de la siguiente quedaba tapado
  antes de que el margen terminara de liberar espacio.
- **Fix**: `.form-section` margin-bottom de 20px → 60px — mayor que la
  barra sticky, así el hueco entre secciones siempre "absorbe" la
  altura de la barra antes de que aparezca cualquier encabezado o
  etiqueta, sin importar cómo se llegue ahí (clic o scroll manual).
- Verificado en vivo (inyectado antes de escribir el reporte, en
  PC-Oficina): scrolleado manualmente el formulario completo de
  "Juan Pablo Lopez Gutierrez" — secciones 4 y 7 confirmadas sin
  ningún solapamiento, encabezados y etiquetas siempre visibles.
- De paso confirmado en la misma prueba: esquinas redondeadas de
  GH3.42.47 y encabezado "Acciones" corregido de GH3.42.43, ambos
  funcionando en producción.

## GH3.42.51
Aplicado en TODOS los lugares donde aparecen Pendientes/Proceso/
Entregados juntos — a pedido de Cristian, extendiendo el análisis de
la tarjeta de técnico a toda la app.

- **Causa de fondo (recordatorio)**: "Entregados" es un hito
  acumulativo (`fecha_entrega` o estado ∈ ENTREGADO_ST) que se
  superpone con "En proceso" (estado ∈ PROC_ST) — 5 de los 9 estados
  de PROC_ST también están en ENTREGADO_ST. No son categorías
  paralelas; "Entregados" es un corte transversal DENTRO de "En
  proceso". Mostrarlos como cajas hermanas del mismo peso visual
  sugiere que deberían sumar al total y no lo hacen — de ahí la
  confusión que señaló Cristian.
- **Fix — mismo criterio en los 4 lugares**: "Entregados" fusionado
  como sub-línea anidada (└, más chico, color discreto) dentro de la
  celda/fila de "En proceso", en vez de celda/fila hermana:
  - `_renderTecnicoGrid()` — grilla de anillos de actividad, "Por
    técnico" (`.tg-stat-nested`).
  - `.exec-empresa-card` — "Cumplimiento por empresa", **2 copias**
    (Ejecutivos y Seguimiento, unificadas desde GH3.42.28) —
    `.exec-stat-nested`.
  - `.rc-stat` — carrusel compartido, Leaderboard de Seguimiento
    (`_renderTecnicoCarousel`, sin tocar en GH3.42.44 por alcance —
    esta corrección sí aplica porque el pedido ahora es "donde se
    muestren estos datos") — `.rc-stat-nested`.
  - Hero de Resumen — eliminada la caja "Entregados" independiente,
    fusionada en la caja de "En proceso". De paso corregido el
    subtítulo "Alistamiento + envío", que era inexacto (el dato real
    de `m.proceso` llega hasta "Pendiente aprobación", no solo esos 2
    estados).
- **No tocado, decisión explícita**: la tabla "Cumplimiento por
  técnico" (columnas Asignados/Pendientes/Proceso/Envío/Entregados/
  Actas/Cerrados/%) — es tabular, cada columna ya tiene su propio
  encabezado individual; el problema de "cajas hermanas iguales" no
  aplica al mismo formato. La fila 7 de "metric-card" de Resumen
  tampoco — ahí "Entregados" no tiene una caja "Proceso" al lado (esa
  vive en "Detalle operativo" como "En alistamiento"/"En envío"
  separados), y ya tenía tooltip explicando la naturaleza acumulativa.
- Verificado en vivo (inyectado antes de empaquetar): "Cumplimiento
  por empresa" en Seguimiento — "64 Proceso" con "└ 65 entreg."
  debajo, más chico y discreto, tal como se diseñó. `node --check` en
  todo el proyecto, balance de llaves en 7 CSS.

## GH3.42.52
AUTORIZADO — Cristian pidió explícitamente que todos los cálculos de
fecha del proyecto cuenten solo días hábiles en Colombia (sin sábados,
domingos ni festivos nacionales), no días calendario.

- **Festivos 2026 confirmados con búsqueda web** (no inventados de
  memoria) — fuentes: Pulzo, Semana, RCN, calendario-colombia.com,
  festivos.com.co, todas coinciden en las fechas dentro/cerca de la
  ventana del proyecto: 13 jul (Virgen de Chiquinquirá, festivo NUEVO
  2026 por Ley 2578), 20 jul (Independencia), 7 ago (Batalla de
  Boyacá), 17 ago (Asunción de la Virgen, trasladada de 15 ago).
  Lista completa de 19 festivos 2026 incluida para cálculos que se
  extiendan más allá de agosto.
- **Motor nuevo**: `_esDiaHabilCO()`, `_diasHabilesEntre()`,
  `_sumarDiasHabilesCO()` (dashboard.js) — excluyen sábado/domingo y
  los festivos de la lista.
- **6 cálculos reemplazados**, todos en dashboard.js:
  - `_computeProyecto()` — días transcurridos/restantes/% tiempo.
  - `_computeGauge()` — % esperado del gauge "Avance esperado vs real".
  - `_computeProductividad()` — ritmo necesario; además el divisor de
    "promedio semanal" pasó de 7 a 5 (una semana laboral son 5 días
    hábiles, no 7 días calendario).
  - `_computeBurnDown()` — el eje sigue recorriendo fechas calendario
    (misma densidad visual de siempre, cada 3 días) pero el % esperado
    se calcula sobre días hábiles transcurridos hasta cada fecha — la
    línea se aplana en fin de semana/festivo en vez de seguir subiendo.
  - `_computeProyeccion()` — "fecha estimada de finalización" ahora
    avanza en días hábiles reales (nunca cae en sábado/domingo/festivo).
- Verificado en vivo con la fecha real de hoy (6 ago 2026, inyectado
  antes de empaquetar): 30 días hábiles totales del proyecto (vs 46
  calendario), 24 transcurridos hasta hoy (vs 35 calendario). También
  verificado con simulación en Node: los 3 festivos julio-agosto se
  excluyen correctamente, un lunes normal cuenta como hábil, un sábado
  no, y la proyección de fecha salta correctamente fin de semana y
  festivo (10 días hábiles desde el 4 ago aterrizan en el 20 ago,
  verificado a mano día por día).
- **Aviso importante**: esto cambia los números mostrados (días
  transcurridos, restantes, fecha estimada, ritmo necesario) aunque
  los datos del proyecto no cambiaron — solo cambia cómo se mide el
  tiempo. Es un cambio de metodología esperado y pedido explícitamente,
  no un error.
- Verificado: `node --check` en todo el proyecto. Sin llaves CSS
  tocadas (cambio 100% en JS).

## GH3.42.53
Solo bump de versión visible en la app (footer y pantalla de carga) —
GH3.42.52 no tenía ningún cambio de contenido pendiente de subir, y
GitHub Desktop no detectaba ninguna diferencia contra el commit
anterior. Necesario para generar un commit real y disparar una corrida
nueva de despliegue, dado el incidente de GitHub Actions/Pages del 6
de agosto (ver conversación — corrida #98 quedó atascada 5+ horas).

- Footer: "v8.4.4 (F3.5 reorden de secciones)" → "v8.4.6 (F3.7 días
  hábiles Colombia)" — refleja el cambio funcional real más reciente.
- Pantalla de carga: "v8.8.4-MVP-1.0" → "v8.8.5-MVP-1.0".
- Sin cambios de lógica — `node --check` y balance de llaves sin
  diferencias respecto a GH3.42.52.

## GH3.42.54
AUTORIZADO — rediseño de "Por técnico" en 2 pistas (equipo nuevo /
equipo anterior, solo si aplica) + indicador general "Renovación
completa", a pedido explícito de Cristian con análisis previo en el
chat (enfoque de científico de datos presentando a gerencia).

- **`porTecnico` (dashboard.js) extendido** con: `alistamiento`,
  `progresoNuevo` (equipo nuevo); `aplicaDevolucion`, `devPendientes`,
  `devProgreso`, `devRecibidos` (equipo anterior, solo cuando
  `eq_ant_tipo` está lleno y `estado_devolucion !== 'No aplica'`);
  `renovacionCompleta`/`pctCompleta` (objetivos que aplican a CADA
  registro, todos cumplidos).
- **Lectura de datos reales confirmada con Cristian**: `estado_devolucion`
  tiene un valor literal `"NO"` en 71 registros (67 con equipo anterior
  real cargado) — se lee como "pendiente sin iniciar trámite", igual
  que `'Pendiente'`. Solo `'No aplica'` explícito (o `eq_ant_tipo`
  vacío) excluye un registro de la pista de equipo anterior.
- **Anillo redefinido**: ahora representa `pctCompleta` (Renovación
  completa), no el hito acumulativo de "entregados" — es el indicador
  general que combina ambas pistas, tal como se pidió.
- **Tarjeta rediseñada** (`_renderTecnicoGrid`, ui.js): 2 secciones
  ("Equipo nuevo": Alistamiento/En progreso/Entregados └ Actas;
  "Equipo anterior": Pendientes/En progreso/Recibidos, oculta por
  completo si no aplica a ningún equipo del técnico) + footer
  "Renovación completa: X de Y". Orden de tarjetas actualizado a
  `renovacionCompleta` (antes `entregados`).
- **Alcance acotado, igual criterio que GH3.42.44**: solo "Por
  técnico". El Leaderboard de Seguimiento sigue con el carrusel
  compartido — no se tocó.
- Verificado en vivo con los 3 técnicos reales (inyectado antes de
  empaquetar): SANTIAGO — 34 entregados, **0 actas firmadas**, 0 de 48
  con Renovación completa. Hallazgo real, no simulado: el cuello de
  botella de Santiago es firma de actas, no entrega — invisible en el
  modelo anterior, visible de inmediato en este.
- Verificado: simulación en Node contra 10 registros sintéticos
  (verificación manual registro por registro, coincide exacto).
  `node --check`, balance de llaves en 7 CSS.

## GH3.42.55
Ajuste sobre GH3.42.54, tras revisión visual — Cristian eligió opción
2: sacar "Actas firmadas" del anidado.

- "Actas firmadas" vuelve a ser fila hermana de Alistamiento/En
  progreso/Entregados, mismo peso visual — antes era una sub-línea
  chica y apagada, y en el caso de Santiago (0 actas) esa era
  justamente la causa raíz del 0% de Renovación completa, escondida
  en el texto más pequeño de toda la tarjeta.
- **Agregado por mi cuenta, no pedido explícitamente**: si Actas=0
  Y Entregados>0 (hay algo por firmar y no se ha firmado nada), el
  número se pinta en rojo — mismo criterio que ya usa "Pendientes".
  Si Entregados también es 0, no hay nada que firmar aún, así que no
  se marca en rojo (no sería una alerta real).
- No verificado en vivo esta vez — la conexión con Chrome se cortó a
  media prueba. Verificado por lectura de código y consistencia con
  el patrón ya confirmado en GH3.42.54.
- `node --check` OK.

## GH3.42.56
FIX real, reportado por Cristian con captura — cambió el estado de un
equipo a "BACKUP" y el registro se quedó en Usuarios en vez de pasar
a Equipos Backup.

- **Causa exacta**: `isBackup()` (utils.js) solo revisaba el campo
  `nombre` (empieza con "BACKUP") — nunca revisaba `estado`, aunque
  "BACKUP" es una opción válida y ofrecida en el desplegable de
  estado (confirmado: aparece en las listas de estados de ui.js).
  La app ofrece una opción que no hacía lo que prometía.
- **Fix**: `isBackup()` ahora también es verdadero si
  `estado === 'BACKUP'` (además de la condición de `nombre` que ya
  existía, sin quitarla).
- Verificado antes de tocar: la tabla de Equipos Backup ya tenía
  lógica de respaldo (`eq_nvo_marca || eq_ant_marca`, etc.) —
  anticipaba que un registro pudiera llegar sin datos de "equipo
  anterior". El fix no deja columnas vacías ni confusas.
- Verificado en vivo: registro real con estado simulado a 'BACKUP' →
  `isBackup()` pasa de `false` a `true` con el fix.
- **Nota para Cristian**: el registro 42 real está ahora en
  "Alistamiento", no "BACKUP" — el cambio de la captura no quedó
  guardado. Hay que volver a marcarlo tras subir este fix.
- `isBackup()` se usa en muchos lugares (filtros de Usuarios, stats
  de dashboard, Equipos Backup) — el fix se propaga automáticamente
  a todos sin tocar cada lugar por separado.
- Verificado: `node --check`.

## GH3.42.57
Confirmado con Cristian — "Funcional" en el texto de SharePoint
(Recolecciones) sí era el teclado, tal como había asumido en
GH3.42.30 sin confirmación. Etiqueta corregida: "♦ Funcional:" →
"♦ Teclado:". Mismo dato (eval_teclado), sin cambios de lógica.
Verificado: `node --check`.

## GH3.42.58
FIX real, reportado por Cristian con captura — etiquetas de campo
desaparecidas y fragmentos de texto sueltos al scrollear en el
formulario.

- **Causa confirmada y reproducida en vivo**: el clic en un tab hacía
  `scrollIntoView({behavior:'smooth'})` — si el usuario scrolleaba
  manualmente MIENTRAS esa animación seguía corriendo, los dos scrolls
  competían y terminaban en una posición distinta a la esperada, con
  el tab "activo" desincronizado del contenido realmente visible.
- **Fix**: `behavior: 'smooth'` → `'auto'` (instantáneo) — sin ventana
  de animación, no hay nada con qué competir.
- **Segunda hipótesis, sin confirmar por reproducción directa**: el
  modal tiene su propia animación de entrada de 0.35s (`transform:
  scale()+translateY()`) — mientras corre, cualquier elemento sticky
  dentro (la barra de tabs) puede calcular mal su posición, por una
  limitación conocida de CSS (un transform en un ancestro rompe el
  contexto de position:sticky). Ventana de riesgo: 0.35s justo al
  abrir el modal. No corregido — arreglarlo bien sacrifica la
  animación de entrada actual. Pendiente de confirmar con Cristian si
  el glitch ocurrió justo al abrir el modal o durante scroll normal.
- Verificado: `node --check`.

## GH3.42.59
"Caso envío (Mensajería)" ahora solo acepta dígitos o la palabra
"OFICINA" (forzada a mayúsculas mientras se escribe) — pedido de
Cristian, cuidando no romper la lógica existente (GH3.24) que
deshabilita "F. Envío" cuando el valor es "Oficina".

- Validación en tiempo real (evento `input`): dígitos puros se dejan
  igual; cualquier prefijo válido de "OFICINA" se normaliza a
  mayúsculas; cualquier otra cosa revierte al último valor válido.
- **Corregido antes de empaquetar**: `lastValid` se inicializa con el
  valor YA GUARDADO del campo al abrir el formulario — sin esto, la
  primera corrección en un registro existente revertía a vacío en vez
  de al valor guardado (encontrado en mi propia implementación antes
  de entregarlo).
- Verificado: `node --check`. Simulación de 6 casos (valor existente +
  tecla inválida, dígitos, "oficina" minúscula, "OFICINA" mayúscula,
  basura, mezcla número+letra) — los 6 se comportan correcto.

## GH3.42.60
AUTORIZADO — fuente única de verdad para "equipo anterior recibido",
tras auditoría pedida por Cristian ("un director debe entender la
información, y que no se contradiga en ninguna parte").

- **Contradicción original confirmada**: 3 campos distintos
  rastreaban el mismo hecho — `estado==='Equipo anterior recibido'`
  (31, snapshot), `estado_devolucion==='Recibida en bodega'` (62,
  incompleto), `fecha_recepcion_bodega` (67, el más confiable).
- **Reencuadre importante**: "Cuello de botella" y "Devoluciones" NO
  estaban midiendo lo mismo, y eso está bien — uno mide "atascados
  ahora en este paso" (snapshot), el otro "recibidos en total"
  (acumulado). El problema real no era que debieran ser el mismo
  número, sino que (a) uno de los mecanismos estaba genuinamente
  incompleto, y (b) las etiquetas no aclaraban que eran preguntas
  distintas.
- **Fix**: `fecha_recepcion_bodega` como fuente única para "recibido"
  en `devolucionesRecibidas`, `devoluciones` (total), `devolucionesPendientes`
  (dashboard.js) y `porTecnico.devRecibidos` (GH3.42.54).
- **Segunda grieta encontrada al verificar (no al adivinar)**: 2
  registros tienen `fecha_recepcion_bodega` pero nunca tuvieron
  `fecha_solicitud_devolucion` (hueco de captura). Esto hacía que
  "Total" (solo solicitud) se quedara corto — "Total" ahora es
  solicitud O recepción, garantizando Recibidas + Pendientes = Total
  siempre, por construcción, no por coincidencia.
- "Cuello de botella" relabeled: "Atascados en: [estado]" + nota
  aclaratoria, para que no se lea como un acumulado.
- **Hallazgo retirado tras verificación más profunda**: pensé que las
  Torres nunca tenían evaluación física completa por un desajuste de
  tipo de equipo en el formulario. Error mío — revisé `tipo` (equipo
  nuevo) en vez de `eq_ant_tipo` (equipo evaluado). En los datos
  reales, `eq_ant_tipo` solo tiene valores "PORTATIL" y "N/A" — cero
  Torres como equipo anterior en toda la base. La razón real de 0/18
  evaluaciones: esos 18 registros simplemente no han llegado todavía
  a la etapa de evaluación (equipo viejo sin recibir). No es un bug,
  no se tocó el formulario.
- Verificado en vivo, con datos reales, en cada paso: 67 recibidas,
  77 total, 10 pendientes, suma exacta. `node --check`.

## GH3.42.61
Toggle prominente de tipo de equipo en Seguimiento — responde al
pedido explícito de Cristian de "revisar a nivel general y luego a
nivel de Portátil y de Torre".

- **Descubrimiento antes de construir nada**: el filtro "Todos los
  tipos" YA EXISTÍA y ya recalculaba correctamente TODO Seguimiento
  (KPIs del hero, Cuello de botella, Riesgos activos, etc.) — solo
  estaba escondido entre otros 6 filtros, poco visible para un
  director que quiere algo directo. No se construyó ningún cálculo
  nuevo — se reutilizó `applyPanelFilter('tipo', ...)` tal cual.
- **Nuevo**: 3 botones grandes ("Vista general", "Portátiles",
  "Torres") justo debajo de "Avance global", antes de la barra de
  filtros — sincronizados en ambas direcciones con el desplegable
  `pf-tipo` existente (`_setTipoToggle()`, `_onTipoSelectChange()`).
- Verificado en vivo: Portátiles → Total 140→122, Entregados 129→114,
  Cuello de botella 44→35 (y de "Impacto ALTO" a "MEDIO"), Riesgos
  activos "Pend. devolución" 32→24 — cascada completa y correcta en
  toda la vista, confirmada con clic real en el botón.
- `node --check`, balance de llaves en 7 CSS, balance del bloque HTML
  nuevo confirmado (el desbalance de 1 en todo el archivo es el mismo
  hueco preexistente, sin síntoma visible, ya documentado desde antes).

## GH3.42.62
AUTORIZADO — "Cuello de botella" y "Riesgos activos" movidos DENTRO
del hero oscuro fijo de Seguimiento, antes de la barra de filtros.
Aprobado por Cristian tras ver la maqueta en el chat.

- **Por qué**: antes vivían después de los 7 filtros (GH3.42.39) — un
  director tenía que cruzar esa fila para llegar al "por qué". Ahora
  el "qué" (KPIs) y el "por qué" quedan juntos en el hero, sin la fila
  de filtros en medio. Los filtros son herramienta de exploración, no
  parte del vistazo inicial.
- **Encontrado al implementar, no al adivinar**: mi primer intento
  dejó el bloque técnicamente FUERA de `.panel-hero` (como hermano de
  toda la vista, que sí cambia con el tema) — en modo claro se habría
  visto con texto claro sobre fondo claro. Corregido moviendo el
  cierre real de `panel-hero-inner`/`panel-hero` para que el toggle y
  el bloque nuevo queden genuinamente dentro.
- **Segundo hallazgo real, mismo patrón que `--bg-2` (GH3.42.37)**:
  `--paper-2` nunca estaba definido en ningún tema — `.risk-item:hover`
  y otro selector muerto lo usaban con fallback fijo, sin síntoma
  visible mientras esa tarjeta solo vivía sobre fondo claro. Corregido
  definiéndolo en ambos temas (claro: `#F7F7F8`, oscuro: `#1D1D27`).
- **Tercer hallazgo — clases muertas encontradas por error**: al
  buscar en el CSS en vez del DOM real, encontré `.risk-row`/
  `.risk-label`/`.risk-sub`/`.risk-count` — una implementación vieja,
  nunca usada (el HTML real usa `.risk-item`/`.ri-l`/`.ri-d`/`.ri-v`).
  Mis primeros overrides apuntaban a las clases muertas y no hacían
  nada visible — corregido apuntando a las clases reales. Las clases
  muertas no se eliminaron (no rompen nada, no valía la pena el
  riesgo de tocar código no relacionado en este cambio).
- Colores de las 2 tarjetas dentro del hero fijados con `rgba(255,255,255,..)`
  literal, no tokens de tema — independientes del modo claro/oscuro
  por diseño, igual criterio que el resto del hero (GH3.42.14).
- Verificado en vivo: `.bot-estado`, `.ri-l strong`, `.ri-d` — los 3
  confirmados con zoom antes y después del fix, texto claramente
  legible. Balance de divs sin cambios respecto al hueco preexistente
  (631/630, documentado desde antes, sin síntoma). `node --check`,
  balance de llaves en 7 CSS.

## GH3.42.63
AUTORIZADO — Resumen recibe el mismo trabajo que ya se hizo en
Seguimiento, a pedido de Cristian ("realiza algo con la vista de
resumen").

- **Hallazgo original, nunca corregido hasta ahora** (de muy atrás en
  esta sesión): Resumen no tenía ningún indicador de si el proyecto
  iba a tiempo o retrasado — un director veía "94% avance" sin saber
  si eso era bueno. Seguimiento ya lo resolvió hace varias versiones;
  Resumen se quedó atrás.
- **Fix**: badge "● A tiempo / Riesgo / Crítico" junto al eyebrow del
  hero, y 5ª tarjeta "Días restantes" (con la fecha estimada como
  subtítulo) en la fila de KPIs. Usa exactamente `m.proyecto.semaforo`
  y `m.proyeccion.fechaEstimadaTxt` — el MISMO campo y mapeo de texto
  que ya usa el badge de Seguimiento (línea ~1964 de ui.js) — no se
  introduce un semáforo nuevo ni una segunda fuente de verdad.
- **Segunda contradicción de nombres encontrada y corregida**:
  "Pend. devolución" en Riesgos activos (Seguimiento, usa
  `lista_recoleccion`) y "Dev. pendientes" en Resumen (usa
  `fecha_solicitud_devolucion`) son 2 señales legítimamente distintas
  — una más temprana/amplia (lista de recolección), otra más estricta
  (solicitud formal) — pero el nombre parecido invitaba a compararlas
  como si fueran la misma. Renombrado a "En lista, sin recibir" en
  Riesgos activos para que la diferencia sea explícita, sin forzar
  ambos números a coincidir (perdería la señal temprana que
  "Riesgos activos" existe para dar).
- **Error propio encontrado y corregido antes de entregar**: mi
  primera edición del HTML dejó divs de cierre sobrantes por un
  descuido al escribir el reemplazo — detectado con el chequeo de
  balance de siempre, corregido antes de seguir. Balance final:
  633/632 (subió +2/+2 desde 631/630 por mi contenido nuevo,
  correctamente balanceado — el hueco de 1 preexistente no cambió).
- El hero de Resumen es oscuro fijo (`--hero-bg`, sin variante clara)
  — badge con colores fijos, mismo criterio que toda la app.
- Verificado en vivo (inyectado antes de empaquetar): badge "A
  TIEMPO" en verde, "Días restantes: 2 · Estimado: 18 Ago 2026"
  correctos. `node --check`, balance de llaves en 7 CSS.

## GH3.42.64-66
4 pedidos de Cristian en una sola ronda.

### GH3.42.64 — Modal ya no se cierra al hacer clic afuera
Quitado `onclick="if(event.target===this)closeModal()"` del overlay
del formulario de edición (`#modal-bg`) — confirmado que este id se
usa EXCLUSIVAMENTE para ese modal, sin efectos colaterales. Las únicas
salidas ahora son: X (arriba), Cancelar, o Guardar cambios. Nota: el
comentario en el código decía "DirtyForm eliminado" — ya existió antes
una protección similar que alguien quitó; esta vez se restringe el
disparador de cierre, no se agrega un diálogo de confirmación.

### GH3.42.65 — Filtros en "Por técnico" + auditoría de consistencia
- **Auditoría pedida por Cristian**: verificado en vivo que entregados,
  pendientes, proceso, finalizados y actas coinciden EXACTOS entre el
  agregado general (`m.xxx`) y la suma por técnico
  (`sum(porTecnico[t].xxx)`) — 131=131, 0=0, 111=111, 29=29, 37=37.
  Única diferencia real: 146 total vs 140 asignados a técnicos — 6
  equipos backup, ya aclarado en su propio sub-texto, no es un bug.
- **Filtros nuevos**: Empresa y Tipo en "Por técnico", reutilizando
  las mismas clases visuales de Seguimiento (`.panel-filter-*`).
- **Refactor de soporte**: `computePorTecnico(activos)` extraída como
  función independiente en dashboard.js (antes vivía inline dentro de
  `buildDashboardStats`), expuesta en `window` — permite recalcular
  sobre un subconjunto filtrado sin duplicar la lógica. `PROC_ST`/
  `ENTREGADO_ST` subidos a nivel de módulo para que ambas funciones
  los compartan.
- Verificado en vivo: filtro HBT → 38+28+17=83, coincide exacto con
  el total conocido de HBT sin backups.

### GH3.42.66 — Columna de calificación en Aprobaciones
La tabla de "Aprobaciones pendientes" no mostraba la calificación
(estrellas) en absoluto. Agregada columna "Calificación" con el mismo
patrón ★/☆ que ya usa el resto de la app (`u.feedback`, 0-5), y "Sin
calificar" en cursiva cuando no hay feedback. Verificado con datos
sintéticos (no había registros reales pendientes al momento de
probar): 4★, 5★ y "Sin calificar" se ven correctos.

Verificado en las 3: `node --check` en dashboard.js y ui.js, balance
de divs sin cambios respecto al hueco preexistente (635/634, +2/+2 por
el filtro nuevo).

## GH3.42.67
Aclaración de Cristian sobre la columna de calificación agregada en
GH3.42.66: la califica el usuario final, no nosotros, y llega después
de completar la renovación — no es algo que quedó a medias de
nuestro lado.

- "Sin calificar" → "Pendiente del usuario" (con tooltip: "Se solicita
  al usuario al completar la renovación"). Mismo criterio que ya usa
  la tabla de Usuarios para su indicador ★ de "Feedback pendiente"
  (Renovación completada/Cerrado sin feedback) — no se inventa un
  concepto nuevo, se alinea el lenguaje con el que ya existía.
- Verificado: `node --check`.

## GH3.42.68
KPI de "Feedback pendiente" agregado a Resumen — pedido explícito de
Cristian, extendiendo la aclaración de GH3.42.67.

- **Cálculo**: `feedbackPendiente` en `buildDashboardStats()` —
  renovaciones en 'Renovación completada' o 'Cerrado' sin
  `feedback > 0`. Mismo criterio exacto que el indicador ★ "Feedback
  pendiente" que ya existía por registro en la tabla de Usuarios
  (línea ~560 de ui.js) — no se inventa un concepto nuevo, se suma
  como KPI lo que ya se señalizaba individualmente.
- **Tarjeta nueva** en "Detalle operativo" de Resumen, junto a "Actas
  firmadas" (con quien está más relacionado) — mismo formato
  `metric-card`, color ámbar (pendiente/atención), ícono de estrella.
- **Hallazgo real al verificar**: 0 registros en toda la base tienen
  `feedback > 0` — los 29 "Feedback pendiente" son el 100% de las
  renovaciones completadas. Ningún usuario ha calificado todavía.
- Verificado en vivo (recarga limpia, sin artefactos de pruebas
  anteriores): tarjeta única, bien posicionada, valor 29 correcto.
  `node --check` en ambos archivos, balance de divs sin cambios
  respecto al hueco preexistente (640/639, +5/+5 por el bloque nuevo).

## GH3.42.69
Quitada la tarjeta "En proceso" del hero de Seguimiento — pedido
explícito de Cristian, no era entendible (se superpone con
Entregados, ya que PROC_ST incluye estados posteriores a la entrega —
tema discutido varias veces en esta sesión).

- Ocultada con `display:none` en vez de eliminada — el JS sigue
  escribiendo en `pe-proceso` sin romper nada, solo se quitó de la
  vista. Verificado en vivo.

## GH3.42.70
FIX real, reportado por Cristian con captura — "Cuello de botella"
mostraba "Atascados en: Renovación completada", que no tiene sentido
(es un estado terminal, no un obstáculo).

- **Causa exacta**: existían 2 lógicas de cuello de botella distintas
  y en conflicto. `dashboard.js` calculaba una variable `bottle` que
  SÍ excluía correctamente los estados terminales/no-iniciados
  (`pipeline.slice(1,-2)`) — pero esa variable nunca se usaba en
  ningún lado. La función que realmente pinta la tarjeta
  (`_renderCuelloBotella`, ui.js) hacía su propio ordenamiento sobre
  TODOS los 11 estados del pipeline, sin excluir nada — por eso
  "Renovación completada" (con muchos registros simplemente porque el
  proyecto avanza) se elegía como si fuera un atasco.
- **Fix**: excluidos `'Pendiente'`, `'Renovación completada'`,
  `'Cerrado'` directamente en `_renderCuelloBotella` — no tiene
  sentido llamarle "atasco" a algo que ya terminó, ni a algo que ni
  siquiera empezó.
- Verificado con los números exactos de la captura de Cristian: con el
  fix, el cuello de botella real pasa a ser "Pendiente devolución
  equipo anterior" (36, 26%) — coincide exacto con el primer ítem de
  la lista de "otros" que ya se veía debajo, confirmando que ESE
  siempre fue el atasco real.
- `node --check`. No se tocó la variable `bottle` de dashboard.js (no
  se usa en ningún lado; queda como código muerto, no se eliminó para
  no ampliar el alcance de este fix puntual).

## GH3.42.71
Las 3 tarjetas que Cristian pidió — Equipos nuevos / Equipos antiguos /
Actas, con Portátiles y Torres lado a lado dentro de cada una.
Especificación confirmada punto por punto en el chat antes de construir.

- **Equipos nuevos**: En tránsito (Alistamiento+Programado+En tránsito
  equipo nuevo) / Entregados (hito acumulativo ya establecido).
- **Equipos antiguos** (excluye "no aplica" — sin eq_ant_tipo o
  estado_devolucion='No aplica'): Pendientes = estado_devolucion en
  'Pendiente' o 'NO' (confirmado: no era 'No aplica', que sigue
  significando "no le corresponde devolver nada"). En tránsito =
  Solicitada + En tránsito (Cristian confirmó mantener esta categoría,
  el tachado de su mensaje no aplicaba). Recibido = fecha_recepcion_
  bodega (fuente única de verdad, GH3.42.60).
- **Actas** (solo sobre equipos YA entregados — decisión propuesta y
  aceptada): Pendiente crear = sin fecha_envio_acta. Por firmar = con
  fecha_envio_acta, sin fecha_firma_acta. Firmadas = ambas fechas.
  (Nota: existen 2 pares de nombres de columna con datos idénticos —
  fecha_envio_acta/fecha_acta_enviada y fecha_firma_acta/fecha_acta_
  firmada, 71 y 58 registros respectivamente en ambos — se usan los
  primeros, que ya usa el resto de la app).
- **`computeTarjetasSeguimiento(activos)`** nueva en dashboard.js,
  reutilizando ENTREGADO_ST (nivel de módulo desde GH3.42.65).
- **Ubicación**: sección nueva justo después del hero, antes de la
  barra de filtros — decisión propia (Cristian delegó este punto).
- **Hallazgo al implementar**: estas tarjetas NO pueden usar la
  variable `records` de `renderPanelEjecutivo()` — esa ya tiene el
  filtro de tipo aplicado (GH3.42.34/61), así que si alguien tiene
  "Portátiles" activo en el toggle, la columna de Torres saldría en
  cero. Se armó `_matchPFsinTipo` — mismos filtros (empresa/ciudad/
  proyecto/técnico/estado/feedback) pero sin el de tipo, para que
  estas 3 tarjetas siempre muestren ambos lados.
- **Verificación honesta**: Chrome no se pudo conectar en esta sesión
  (Cristian pidió el de casa, no llegó a autorizarse). Verificado con
  simulación exhaustiva en Node (7 registros sintéticos, rastreo
  manual campo por campo, todos coinciden exacto) y cruce de los 16
  IDs generados por JS contra el HTML (todos coinciden). NO verificado
  visualmente en navegador real — pendiente de confirmar en la próxima
  conexión.
- `node --check` en ambos archivos, balance de llaves en 7 CSS,
  balance de divs (+38/+38, mismo hueco preexistente sin cambios).

## GH3.42.72
Quitada "En proceso" también del hero de Resumen — mismo pedido que
ya se hizo para Seguimiento (GH3.42.69). Reemplazada por "Entregados"
como tarjeta propia (antes vivía anidada debajo de "En proceso" con
"└ X ya entregados").

- Confirmado seguro: `_setText` ya valida `if(el)` antes de escribir,
  así que dejar de tener el id `h-proceso` en el HTML no rompe nada.
- Encontrada una tercera ocurrencia de "En proceso" en "Home Técnico"
  (vista personal de un técnico al iniciar sesión) — NO se tocó,
  pendiente de revisar junto con Cristian cuando lleguemos a esa vista
  en la revisión 1 a 1.
- Verificado: balance de divs sin cambios (678/677).

## GH3.42.73
Eliminada "Cuello de botella" completa del hero de Seguimiento —
decisión conjunta con Cristian tras analizarla en detalle en el chat.

- **Por qué**: (1) la lista de "otros" mezclaba pasos normales del
  flujo (Equipo anterior recibido, Entregado equipo nuevo) con
  atascos, como si compitieran — pero "recibido" y "entregado" son
  lo que queremos, no un problema; (2) duplicaba "En lista, sin
  recibir" de Riesgos activos con nombre distinto y número
  ligeramente distinto, diciendo lo mismo dos veces; (3) "Impacto
  ALTO/MEDIO" aparecía sin referencia de qué es cada nivel; (4) el
  único atasco real accionable ("devolución equipo anterior") ya está
  en Riesgos activos y en las 3 tarjetas nuevas por tipo (GH3.42.71).
- **Fix**: eliminado el div wrapper, la tarjeta y su div interno.
  "Riesgos activos" pasa a ocupar el ancho completo del hero
  (contenedor cambió de `panel-grid-2` a solo `panel-hero-embed`).
- Verificado en vivo: hero se ve limpio y aireado, Riesgos activos
  con "Equipos cruzados 2" y "En lista, sin recibir 32" bien
  visibles. Balance de divs correcto: 675/674 (−3/−3 desde 678/677,
  eliminados exactamente los 3 divs esperados; mismo hueco
  preexistente sin cambios).
- **No tocado**: la variable `bottle` en dashboard.js y la función
  `_renderCuelloBotella` en ui.js quedan como código muerto (ya no
  hay elemento en el DOM que las llame). No se eliminaron para
  acotar el alcance de este cambio — pueden limpiarse en otra pasada
  específica de code cleanup.
