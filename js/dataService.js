// ════════════════════════════════════════════════════════════════════
// js/dataService.js — PMC-TI-REN26 GH1
// DataService, DataMapper, StateMachine, normalizeRecord_F3, MockProvider, JSONProvider
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

function normalizeRecord_F3(r) {
  if (!r) return r;

  // RC-01 T9+T13: Normalizar nombres de campo en lectura desde Excel.
  // Si las columnas del Excel usan CamelCase (EqNvoTipo → eqnvotipo),
  // ExcelMapper.toJson produce campos sin guiones. Este bloque remapea
  // esos campos al formato interno con guiones (eq_nvo_tipo).
  var LOAD_ALIASES = {
    // ── Columnas cuyo nombre lowercase ≠ nombre interno del campo ──────
    // Excel UPPERCASE_UNDERSCORE → lowercase → alias → campo interno
    'estado_renovacion':      'estado',           // ESTADO_RENOVACION → estado
    'nombre_archivo_acta':    'nombre_archivo',   // NOMBRE_ARCHIVO_ACTA → nombre_archivo
    'fecha_acta_enviada':     'fecha_envio_acta', // FECHA_ACTA_ENVIADA → fecha_envio_acta
    'fecha_acta_firmada':     'fecha_firma_acta', // FECHA_ACTA_FIRMADA → fecha_firma_acta
    'calificacion_feedback':  'feedback',         // CALIFICACION_FEEDBACK → feedback

    // ── Aliases legacy CamelCase (compatibilidad Excel anterior) ────────
    'nombrecompleto':            'nombre',
    'title':                     'nombre',
    'centrocostos':              'ceco',
    'nivel':                     'nivel_usuario',
    'eqnvotipo':     'eq_nvo_tipo',    'eqnvomarca':    'eq_nvo_marca',
    'eqnvomodelo':   'eq_nvo_modelo',  'eqnvoserial':   'eq_nvo_serial',
    'eqnvoaf':       'eq_nvo_af',      'eqnvoplaca':    'eq_nvo_placa',
    'eqnvohostname': 'eq_nvo_hostname','eqnvoprocesador':'eq_nvo_procesador',
    'eqnvoram':      'eq_nvo_ram',     'eqnvodisco':    'eq_nvo_disco',
    'eqnvoso':       'eq_nvo_so',
    'eqanttipo':     'eq_ant_tipo',    'eqantmarca':    'eq_ant_marca',
    'eqantmodelo':   'eq_ant_modelo',  'eqantserial':   'eq_ant_serial',
    'eqantaf':       'eq_ant_af',      'eqantplaca':    'eq_ant_placa',
    'eqanthostname': 'eq_ant_hostname','eqantprocesador':'eq_ant_procesador',
    'eqantram':      'eq_ant_ram', 'eq_ant_memoria': 'eq_ant_ram', 'eqantdisco':    'eq_ant_disco',
    'eqantso':       'eq_ant_so',
    'casoenvio':         'caso_envio',
    'fechaenvio':        'fecha_envio',
    'fechaasignacion':   'fecha_entrega',
    'fechaenvioacta':    'fecha_envio_acta',
    'fechafirmaacta':    'fecha_firma_acta',
    'fechasolicituddevolucion': 'fecha_solicitud_devolucion',
    'fechatransito':     'fecha_transito',
    'fecharecepcionbodega': 'fecha_recepcion_bodega',
    'actaentregaurl':    'acta_entrega_url',
    'nombrearchivo':     'nombre_archivo',
    'estadoentregaequiponuevo': 'estado_entrega_equipo_nuevo',
    'disposicionfinal':  'disposicion_final',
    'observacionesdevolucion': 'observaciones_devolucion',
    'feedbackrecibido':  'feedback',
    'bloqueado':         'blocked',
    'categoriabloqueo':  'block_category',
    'estadoanteriorbloqueo': 'block_previous_state',
  };
  Object.keys(LOAD_ALIASES).forEach(function(src) {
    var dst = LOAD_ALIASES[src];
    if (r[src] !== undefined && r[dst] === undefined) {
      r[dst] = r[src];
      // No eliminar src — puede ser necesario para compatibilidad
    }
  });

  
  // ── Normalizar estado uppercase → canonical
  r.estado = StateMachine.normalize(r.estado || 'Pendiente');
  
  
  // ── Cédula como string
  if (r.cedula != null) r.cedula = String(r.cedula);
  
  // QA-03: acta_enviada y acta_firmada derivados de las fechas (columnas eliminadas del Excel)
  r.acta_enviada     = !!r.fecha_envio_acta;
  r.acta_firmada     = !!r.fecha_firma_acta;
  if (r.acta_entrega_url === undefined) r.acta_entrega_url = '';
  r.devuelto = siNoToBool(r.devuelto);
  
  // ── Equivalencias para legacy UI (que espera marca/modelo/serial sin prefijo eq_nvo_)
  // Los heredamos del nuevo, pero solo si no existían
  if (r.marca == null && r.eq_nvo_marca) r.marca = r.eq_nvo_marca;
  if (r.modelo == null && r.eq_nvo_modelo) r.modelo = r.eq_nvo_modelo;
  if (r.tipo == null && r.eq_nvo_tipo) r.tipo = r.eq_nvo_tipo;
  if (r.serial == null && r.eq_nvo_serial) r.serial = r.eq_nvo_serial;
  if (r.placa == null && r.eq_nvo_placa) r.placa = r.eq_nvo_placa;
  if (r.hostname == null && r.eq_nvo_hostname) r.hostname = r.eq_nvo_hostname;
  if (r.procesador == null && r.eq_nvo_procesador) r.procesador = r.eq_nvo_procesador;
  if (r.ram == null && r.eq_nvo_ram) r.ram = r.eq_nvo_ram;  // GH3.26: eq_nvo_memoria eliminado del Excel
  if (r.disco == null && r.eq_nvo_disco) r.disco = r.eq_nvo_disco;
  
  // ── Garantizar campos F3 nuevos
  if (r.eq_ant_disco == null) r.eq_ant_disco = '';  // GH3.26: EQ_ANT_DISCO — col U
  // GH3.28/GH3.29: campos Motor RAEE — solo inicializar, NUNCA recalcular
  // (GH3.29: RAEEEngine.calcular() PROHIBIDO fuera de saveRecord)
  if (r.lista_recoleccion == null) {
    r.lista_recoleccion = false;
  } else if (typeof r.lista_recoleccion === 'string') {
    var _lr = r.lista_recoleccion.toUpperCase().trim();
    r.lista_recoleccion = _lr === 'TRUE' || _lr === 'SI' || _lr === '1' || _lr === 'YES';
  } else { r.lista_recoleccion = !!r.lista_recoleccion; }
  if (r.eval_bateria        == null) r.eval_bateria        = '';
  if (r.eval_teclado        == null) r.eval_teclado        = '';
  if (r.eval_touchpad       == null) r.eval_touchpad       = '';
  if (r.eval_estetico       == null) r.eval_estetico       = '';
  if (r.recomendacion_raee  == null) r.recomendacion_raee  = '';
  if (r.motivo_raee         == null) r.motivo_raee         = '';
  if (r.motor_raee_version  == null) r.motor_raee_version  = '';
  if (r.fecha_evaluacion_raee    == null) r.fecha_evaluacion_raee    = '';
  if (r.usuario_evaluacion_raee  == null) r.usuario_evaluacion_raee  = '';  // GH3.29
  // lista_recoleccion boolean cast
  if (typeof r.lista_recoleccion === 'string') r.lista_recoleccion = r.lista_recoleccion.toUpperCase() === 'SI';
  if (r.eq_ant_af == null) r.eq_ant_af = '';
  if (r.eq_ant_placa == null) r.eq_ant_placa = '';
  if (r.eq_ant_clasif == null) r.eq_ant_clasif = '';
  if (r.eq_nvo_af == null) r.eq_nvo_af = '';
  if (r.evidencia_adjunta == null) r.evidencia_adjunta = false;
  if (r.nombre_archivo == null) r.nombre_archivo = '';
  // F3.6 · estado físico de entrega del equipo nuevo (entidad independiente del proceso)
  if (r.estado_entrega_equipo_nuevo == null) r.estado_entrega_equipo_nuevo = '';
  
  // ── Clasificación de obsolescencia (auto) si no está definida
  // F3.1 fix: usar classifyRecord() completo · F3.3 fix: NO requerir
  // eq_ant_procesador truthy — classify(null) ya devuelve explícitamente
  // 'Revisión manual', que es el resultado correcto cuando falta el dato
  // (antes el registro quedaba sin clasificar en absoluto, no "Revisión manual").
  if (!r.estado_eq_ant) {
    Object.assign(r, ObsolescenceService.classifyRecord(r));
    // GH3.24: log diagnóstico cuando debug=true
    if (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.debug) {
      console.error('[RAEE DIAG] ID:', r.id,
        '| Procesador:', r.eq_ant_procesador || '(vacío)',
        '| Clasificación:', r.clasificacion_obsolescencia,
        '| Generación:', r.generacion_cpu);
    }
  }
  
  // GH3.31 BLOQUE 1: Aliases de lectura — campo_interno ← columna_excel
  // Estos 5 campos tienen nombre distinto entre el código JS y la columna Excel.
  // ExcelMapper genera el nombre en minúsculas desde el header, pero el código
  // y el modal usan un nombre alternativo establecido históricamente.
  if (!r.alistamiento     && r.fecha_alistamiento)   r.alistamiento     = r.fecha_alistamiento;
  if (!r.fecha_envio_acta && r.fecha_acta_enviada)   r.fecha_envio_acta = r.fecha_acta_enviada;
  if (!r.fecha_firma_acta && r.fecha_acta_firmada)   r.fecha_firma_acta = r.fecha_acta_firmada;
  if (!r.observaciones    && r.observacion != null)  r.observaciones    = r.observacion;
  // estado_devolucion ← DEVUELTO (boolean): 'NO'→false→'' / 'SI'→true→'SI'
  if (r.estado_devolucion == null || r.estado_devolucion === '')
    r.estado_devolucion = r.devuelto ? 'SI' : 'NO';

  // ── Mapear "ciudad" lowercase amigable
  if (r.ciudad) r.ciudad = String(r.ciudad).toUpperCase().replace(/\s+/g, ' ').trim()
    .toLowerCase().replace(/(^|[\s\-\.\/])([\p{L}])/gu, (_, sp, c) => sp + c.toUpperCase())
    .replace(/\.\s*$/, '').trim();  // GH3.30: eliminar punto final ('Bogotá D.C.' → 'Bogotá D.C')
  
  // ── Audit y timeline si no existen (compat v8.1)
  if (!r.audit) r.audit = [];
  if (!r.timeline) r.timeline = [];
  if (typeof r.blocked !== 'boolean') r.blocked = (r.estado === StateMachine.states.BLOQUEADO);
  if (!r.block_reason) r.block_reason = '';
  if (!r.block_category) r.block_category = '';
  if (!r.block_previous_state) r.block_previous_state = '';
  if (!r.approval) r.approval = { status: null, by: null, at: null, reason: '' };
  
  // Timeline inicial si está vacío
  if (r.timeline.length === 0) {
    r.timeline.push({
      at: new Date().toISOString(),
      by: 'sistema', by_id: null,
      from: null, to: r.estado,
      note: 'Estado inicial al cargar el sistema',
    });
  }
  
  // ── F3 · Construir sub-objetos normalizados (equipoAnterior, equipoNuevo)
  RenovacionModel.rebuildShape(r);
  
  return r;
}

// MVP P1: normalización se aplica en DataService.reloadFromProvider()



// F3.9 · Integridad referencial al arrancar (solo reporta, no modifica)
if (window.IntegrityService) IntegrityService.report();


// ── 05_ui_components.js ──

// ═══════════════════════════════════════════════════════════════════
// F3 · UI Components nuevas
// - renderTimeline(record)
// - renderObsolescencePanel(record)
// - renderChecklistInline(record)
// - openBlockModal(recordId)
// - openValidationModal(recordId)
// - openRejectModal(recordId)
// - renderAprobaciones (vista)
// ═══════════════════════════════════════════════════════════════════

// ── Helper formato fecha en español
function formatDateEs(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch(e) { return iso; }
}

// ═══════════════════════════════════════════════════════════════════
// TIMELINE de un registro (estado actual + historial)
// ═══════════════════════════════════════════════════════════════════
function renderTimelineHTML(record) {
  if (!record) return '';

  const timeline = record.timeline || [];
  const states = StateMachine.flow.slice(); // 11 estados happy path
  const currentState = record.estado;
  const currentIdx = states.indexOf(currentState);

  // ── Progreso visual de los 11 estados (timeline original)
  let progressHTML = '<div class="tl-progress">';
  states.forEach((st, idx) => {
    let cls = 'tl-step';
    if (idx < currentIdx) cls += ' tl-step-done';
    else if (idx === currentIdx) cls += ' tl-step-current';
    else cls += ' tl-step-pending';

    const icon = idx < currentIdx ? '✓' : (idx === currentIdx ? '●' : '○');
    progressHTML += '<div class="' + cls + '" title="' + esc(st) + '">' +
      '<div class="tl-step-icon">' + icon + '</div>' +
      '<div class="tl-step-label">' + esc(st) + '</div>' +
      '</div>';
  });
  progressHTML += '</div>';

  // Estados especiales fuera del happy path
  if (currentState === StateMachine.states.BLOQUEADO) {
    progressHTML += '<div class="tl-banner tl-banner-blocked">🚧 Bloqueado: ' + esc(record.block_reason || 'sin motivo') + '</div>';
  } else if (currentState === StateMachine.states.CORRECCION_REQUERIDA) {
    progressHTML += '<div class="tl-banner tl-banner-correction">✗ Corrección requerida' +
      (record._missing_items ? ' · falta: ' + record._missing_items.join(', ') : '') + '</div>';
  }

  let historyHTML = ''; // RC-07: historial eliminado del formulario

  return progressHTML;
}
window.renderTimelineHTML  = renderTimelineHTML;
window.normalizeRecord_F3  = normalizeRecord_F3;  // Exportado para tests y sync.js

