// ════════════════════════════════════════════════════════════════════
// js/dataService.js — PMC-TI-REN26 GH1
// DataService, DataMapper, StateMachine, normalizeRecord_F3, MockProvider, JSONProvider
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

function normalizeRecord_F3(r) {
  if (!r) return r;
  
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
  if (r.lista_recoleccion   == null) r.lista_recoleccion   = false;
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
  if (r.disposicion_final == null) r.disposicion_final = '';
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
  const states   = StateMachine.flow.slice();
  const curState = record.estado;
  const curIdx   = states.indexOf(curState);
  const isBlocked = curState === StateMachine.states.BLOQUEADO;

  // ── Nombres cortos para el stepper QA-05 Task 1
  const SHORT = {
    'Pendiente':                            'Pendiente',
    'Alistamiento':                         'Alistamiento',
    'Programado':                           'Programado',
    'En tránsito equipo nuevo':             'Enviado',
    'Entregado equipo nuevo':               'Entregado',
    'Pendiente devolución equipo anterior': 'Recolección',
    'En tránsito equipo anterior':          'En tránsito',
    'Equipo anterior recibido':             'Recibido',
    'Renovación completada':                'Completado',
    'Pendiente aprobación':                 'Aprobación',
    'Cerrado':                              'Cerrado',
  };

  // ── Stepper horizontal compact
  let stepperHTML = '<div class="tl-compact">';
  states.forEach(function(st, idx) {
    var cls   = idx < curIdx  ? 'step-done'
              : idx === curIdx ? (isBlocked ? 'step-blocked' : 'step-current')
              :                  'step-pending';
    var icon  = idx < curIdx  ? '✓'
              : idx === curIdx ? (isBlocked ? '!' : String(idx + 1))
              :                  String(idx + 1);
    var label = SHORT[st] || st;
    stepperHTML += '<div class="tl-compact-step ' + cls + '" title="' + esc(st) + '">' +
      '<div class="tl-compact-node">' + icon + '</div>' +
      '<div class="tl-compact-label">' + esc(label) + '</div>' +
    '</div>';
    if (idx < states.length - 1) {
      stepperHTML += '<div class="tl-compact-connector ' + (idx < curIdx ? 'step-done' : 'step-pending') + '"></div>';
    }
  });
  stepperHTML += '</div>';

  // ── Banner estados especiales
  if (isBlocked) {
    stepperHTML += '<div class="tl-banner tl-banner-blocked">🚧 Bloqueado: ' + esc(record.block_reason || 'sin motivo') + '</div>';
  } else if (curState === StateMachine.states.CORRECCION_REQUERIDA) {
    stepperHTML += '<div class="tl-banner tl-banner-correction">✗ Corrección requerida' +
      (record._missing_items ? ' · falta: ' + record._missing_items.join(', ') : '') + '</div>';
  }

  // ── Historial vertical
  let historyHTML = '<div class="tl-history">';
  if (timeline.length === 0) {
    historyHTML += '<div class="tl-empty">Sin eventos registrados</div>';
  } else {
    const sorted = timeline.slice().sort(function(a, b) { return b.at.localeCompare(a.at); });
    sorted.forEach(function(ev, idx) {
      const isFirst = idx === 0;
      historyHTML += '<div class="tl-event' + (isFirst ? ' tl-event-current' : '') + '">' +
        '<div class="tl-event-dot"></div>' +
        '<div class="tl-event-body">' +
          '<div class="tl-event-head">' +
            '<strong>' + esc(ev.to || '—') + '</strong>' +
            (ev.from ? ' <span class="tl-event-from">desde ' + esc(ev.from) + '</span>' : '') +
          '</div>' +
          '<div class="tl-event-meta">' + formatDateEs(ev.at) + ' · ' + esc(ev.by || 'sistema') + '</div>' +
          (ev.note ? '<div class="tl-event-note">' + esc(ev.note) + '</div>' : '') +
        '</div>' +
      '</div>';
    });
  }
  historyHTML += '</div>';

  // GH3.28: Panel RAEE
  var raeePanel = '';
  if (record.recomendacion_raee) {
    var raeeColor = {
      'RAEE': '#C00000', 'Donacion': '#E65100',
      'Venta interna': '#2E7D32', 'Reasignacion': '#1565C0'
    }[record.recomendacion_raee] || '#555';
    var motorVer  = record.motor_raee_version   || 'v1';
    var evalDate  = record.fecha_evaluacion_raee ? formatDateEs(record.fecha_evaluacion_raee) : '—';
    var evalUser  = record.usuario_evaluacion_raee || '—';
    raeePanel =
      '<div style="margin-top:8px;padding:8px 14px;border-radius:var(--r-sm);background:#FFF7ED;border-left:3px solid ' + raeeColor + '">' +
        '<div style="font-size:10px;color:' + raeeColor + ';font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Clasificación RAEE · ' + esc(motorVer) + '</div>' +
        '<strong style="color:' + raeeColor + '">' + esc(record.recomendacion_raee) + '</strong>' +
        (record.motivo_raee ? '<div style="font-size:11px;color:#777;margin-top:4px">' + esc(record.motivo_raee) + '</div>' : '') +
        '<div style="font-size:10px;color:#999;margin-top:6px">Evaluado: ' + evalDate + ' · ' + esc(evalUser) + '</div>' +
      '</div>';
  }

  return stepperHTML + historyHTML + raeePanel;
}
window.renderTimelineHTML = renderTimelineHTML;

