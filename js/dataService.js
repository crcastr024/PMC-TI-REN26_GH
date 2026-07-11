// ════════════════════════════════════════════════════════════════════
// js/dataService.js — PMC-TI-REN26 GH1
// DataService, DataMapper, StateMachine, normalizeRecord_F3, MockProvider, JSONProvider
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

function normalizeRecord_F3(r) {
  if (!r) return r;
  
  // ── Normalizar estado uppercase → canonical
  r.estado = StateMachine.normalize(r.estado || 'Pendiente');
  
  // ── Backup flag (boolean)
  r.es_backup = (r.es_backup === true) || (r.es_backup === 'SI') || r.estado === StateMachine.states.BACKUP;
  
  // ── Cédula como string
  if (r.cedula != null) r.cedula = String(r.cedula);
  
  // ── Booleanos SI/NO → boolean real
  r.acta_enviada     = siNoToBool(r.acta_enviada);
  r.acta_firmada     = siNoToBool(r.acta_firmada);
  if (r.acta_entrega_url === undefined) r.acta_entrega_url = '';
  r.feedback_enviado = siNoToBool(r.feedback_enviado);
  r.feedback_recibido = siNoToBool(r.feedback_recibido);
  r.devuelto = siNoToBool(r.devuelto);
  r.aun_trabaja = (r.aun_trabaja === null || r.aun_trabaja === undefined) ? true : siNoToBool(r.aun_trabaja);
  
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
  const states = StateMachine.flow.slice(); // 11 estados happy path
  const currentState = record.estado;
  const currentIdx = states.indexOf(currentState);
  
  // ── Top: progreso visual de los 11 estados
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
  
  // ── Historial vertical
  let historyHTML = '<div class="tl-history">';
  if (timeline.length === 0) {
    historyHTML += '<div class="tl-empty">Sin eventos registrados</div>';
  } else {
    const sorted = timeline.slice().sort((a, b) => b.at.localeCompare(a.at));
    sorted.forEach((ev, idx) => {
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
  
  // GH3.28: Panel de disposición RAEE cuando la recomendación es RAEE
  var raeePanel = '';
  if (record.recomendacion_raee) {
    var raeeColor = {
      'RAEE': '#C00000', 'Donacion': '#E65100',
      'Venta interna': '#2E7D32', 'Reasignacion': '#1565C0'
    }[record.recomendacion_raee] || '#555';
    raeePanel = (
      '<div style="margin-top:12px;padding:10px 14px;border-radius:var(--r-sm);' +
      'border-left:4px solid ' + raeeColor + ';background:#F9F9F9">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;' +
        'color:' + raeeColor + ';letter-spacing:.5px">Destino final recomendado</div>' +
        '<div style="font-size:15px;font-weight:900;color:' + raeeColor + ';margin-top:4px">' +
          (record.recomendacion_raee === 'RAEE' ? '⚠ ' : '') + esc(record.recomendacion_raee) +
        '</div>' +
        (record.motivo_raee ? '<div style="font-size:11px;color:#777;margin-top:3px">' + esc(record.motivo_raee) + '</div>' : '') +
      '</div>'
    );
    // Flujo RAEE especial cuando la recomendación es RAEE
    if (record.recomendacion_raee === 'RAEE') {
      var raeeSteps = [
        'Pendiente evaluacion RAEE',
        'Clasificacion RAEE',
        'Aprobacion RAEE',
        'Entrega RAEE',
        'Cierre',
      ];
      var raeeHtml = '<div style="margin-top:10px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#C00000;padding-bottom:6px">Flujo RAEE</div><div class="tl-progress" style="flex-wrap:wrap;gap:4px">';
      raeeSteps.forEach(function(st) {
        raeeHtml += '<div class="tl-step tl-step-pending" title="' + st + '">' +
          '<div class="tl-step-icon">○</div>' +
          '<div class="tl-step-label" style="font-size:9px">' + st + '</div>' +
          '</div>';
      });
      raeeHtml += '</div></div>';
      raeePanel += raeeHtml;
    }
  }
  return progressHTML + historyHTML + raeePanel;
}

// ═══════════════════════════════════════════════════════════════════
// OBSOLESCENCIA panel (clasificación RAEE)
// ═══════════════════════════════════════════════════════════════════
function renderObsolescencePanelHTML(record) {
  if (!record) return '';
  const cls = record.estado_eq_ant || 'Revisión manual';
  const isRaee = cls === 'RAEE';
  const isReas = cls === 'Reasignable';
  const cssClass = isRaee ? 'obs-raee' : (isReas ? 'obs-reas' : 'obs-manual');
  const icon = isRaee ? '⚠' : (isReas ? '✓' : '?');
  const accion = record.accion_requerida || ObsolescenceService.ACCION_MAP[cls] || 'Revisar';
  const accionCls = accion === 'Baja' ? 'obs-raee' : (accion === 'Reasignar' ? 'obs-reas' : 'obs-manual');
  const genTxt = record.generacion_cpu || record.eq_ant_generacion
    ? 'Gen ' + (record.generacion_cpu || record.eq_ant_generacion)
    : 'Sin determinar';
  
  return '<div class="obs-panel ' + cssClass + '">' +
    '<div class="obs-head">' +
      '<div class="obs-icon">' + icon + '</div>' +
      '<div class="obs-info">' +
        '<div class="obs-title">' + esc(cls) + '</div>' +
        '<div class="obs-sub">' + esc(record.eq_ant_procesador || 'Procesador no registrado') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="obs-chips">' +
      '<div class="obs-chip ' + cssClass + '"><span class="obs-chip-lbl">Clasificación</span><span class="obs-chip-val">' + esc(cls) + '</span></div>' +
      '<div class="obs-chip obs-chip-neutral"><span class="obs-chip-lbl">Generación</span><span class="obs-chip-val">' + esc(genTxt) + '</span></div>' +
      '<div class="obs-chip ' + accionCls + '"><span class="obs-chip-lbl">Acción</span><span class="obs-chip-val">' + esc(accion) + '</span></div>' +
    '</div>' +
    '<div class="obs-action">' + esc(record.accion_detalle || record.accion_requerida || '—') + '</div>' +
    '<div class="obs-footnote">Clasificación generada automáticamente por el motor de obsolescencia a partir del procesador del equipo anterior · no editable manualmente</div>' +
  '</div>';
}

// NOTA F3.2: la reclasificación manual fue retirada de la UI por decisión de negocio.
// La clasificación del equipo anterior se genera EXCLUSIVAMENTE por ObsolescenceService.classify()
// a partir del procesador (eq_ant_procesador). ObsolescenceService.overrideClassification()
// permanece en el servicio (sin punto de entrada en UI) por si una futura herramienta de
// administración (F6) requiriera corrección de datos con trazabilidad de auditoría.

// ═══════════════════════════════════════════════════════════════════
// CHECKLIST inline (preview en el modal)
// ═══════════════════════════════════════════════════════════════════
function renderChecklistHTML(record) {
  const ev = ApprovalService.evaluate(record);
  let html = '<div class="checklist-wrap">';
  html += '<div class="checklist-summary">' +
    '<strong>' + ev.okCount + '/' + ev.total + '</strong> puntos cumplidos' +
    (ev.allOk ? ' · ✓ Listo para solicitar validación' : ' · falta ' + (ev.total - ev.okCount)) +
  '</div>';
  html += '<div class="checklist-items">';
  ev.checklist.forEach(item => {
    html += '<div class="cl-item ' + (item.ok ? 'cl-ok' : 'cl-miss') + '">' +
      '<div class="cl-icon">' + (item.ok ? '✓' : '○') + '</div>' +
      '<div class="cl-body">' +
        '<div class="cl-label">' + esc(item.label) + '</div>' +
        '<div class="cl-desc">' + esc(item.description) + '</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════
// MODAL: Solicitar validación de cierre
// ═══════════════════════════════════════════════════════════════════
function openValidationModal(recordId) {
  recordId = recordId || state.editingId;
  if (!recordId) return;
  const record = DataService.getRenewal(recordId);
  if (!record) return;
  
  const can = ApprovalService.canRequestValidation(record, state.user);
  if (!can.ok) {
    openBlockExplanationModal(recordId, [can.reason]);
    return;
  }
  
  const ev = ApprovalService.evaluate(record);
  
  $('val-modal-title').textContent = 'Solicitar validación de cierre';
  $('val-modal-eyebrow').textContent = (record.nombre || 'ID ' + record.id) +
    ' · ' + (record.eq_nvo_serial || record.serial || 'sin serial');
  
  $('val-modal-body').innerHTML =
    '<div class="val-summary ' + (ev.allOk ? 'val-ok' : 'val-warn') + '">' +
      '<div class="val-summary-icon">' + (ev.allOk ? '✓' : '⚠') + '</div>' +
      '<div class="val-summary-text">' +
        '<strong>' + ev.okCount + '/' + ev.total + '</strong> puntos del checklist cumplidos<br>' +
        (ev.allOk
          ? 'La renovación pasará a <strong>Pendiente aprobación</strong>. Un Gestor de Activos deberá aprobarla para cerrar.'
          : '<strong>No se puede solicitar validación.</strong> Faltan ' + ev.missing.length + ' puntos obligatorios.') +
      '</div>' +
    '</div>' +
    renderChecklistHTML(record);
  
  const sendBtn = $('val-modal-send');
  if (ev.allOk) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Solicitar validación';
    sendBtn.classList.remove('btn-disabled');
  } else {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Incompleto — corrige antes de enviar';
    sendBtn.classList.add('btn-disabled');
  }
  
  state.validatingId = recordId;
  $('val-modal-bg').classList.add('active');
}
window.openValidationModal = openValidationModal;

function closeValidationModal() {
  $('val-modal-bg').classList.remove('active');
  state.validatingId = null;
}
window.closeValidationModal = closeValidationModal;

function submitValidation() {
  const id = state.validatingId;
  if (!id) return;
  try {
    const result = ApprovalService.requestValidation(id, state.user);
    closeValidationModal();
    if (result.ok) {
      notify({ level: 'info', category: 'state',
        title: '✓ Validación enviada',
        message: 'Renovación pasó a Pendiente aprobación. Espera revisión de Gestor de Activos.',
        recordId: id });
    } else {
      notify({ level: 'critical', category: 'state',
        title: '✗ Corrección requerida',
        message: result.evaluation.missing.length + ' puntos del checklist incompletos',
        recordId: id });
    }
    closeModal();
    renderView(state.view);
  } catch(e) {
    toast('Error: ' + e.message, 'critical');
  }
}
window.submitValidation = submitValidation;

// ═══════════════════════════════════════════════════════════════════
// MODAL: Bloquear renovación (motivo obligatorio)
// ═══════════════════════════════════════════════════════════════════
function openBlockModal(recordId) {
  recordId = recordId || state.editingId;
  if (!recordId) return;
  const record = DataService.getRenewal(recordId);
  if (!record) return;
  
  if (record.estado === StateMachine.states.BLOQUEADO) {
    // Ya bloqueado → abrir modal de desbloqueo
    openUnblockModal(recordId);
    return;
  }
  
  $('block-modal-eyebrow').textContent = (record.nombre || 'ID ' + record.id);
  state.blockingId = recordId;
  
  // Reset fields
  $('block-reason').value = '';
  // F3.5 · Categorías desde ConfigService (no hardcodeadas en HTML)
  const catSel = $('block-category');
  catSel.innerHTML = ConfigService.CATEGORIAS_BLOQUEO
    .map(c => '<option value="' + c.value + '">' + c.label + '</option>').join('');
  catSel.value = 'Otro';
  $('block-modal-bg').classList.add('active');
  setTimeout(() => $('block-reason').focus(), 100);
}
window.openBlockModal = openBlockModal;

function closeBlockModal() {
  $('block-modal-bg').classList.remove('active');
  state.blockingId = null;
}
window.closeBlockModal = closeBlockModal;

function submitBlock() {
  const id = state.blockingId;
  if (!id) return;
  const reason = ($('block-reason').value || '').trim();
  const category = $('block-category').value;
  if (!reason) { toast('El motivo del bloqueo es obligatorio', 'warning'); $('block-reason').focus(); return; }
  try {
    DataService.blockRenewal(id, reason, category, state.user);
    closeBlockModal();
    notify({ level: 'warning', category: 'state',
      title: '🚧 Renovación bloqueada',
      message: 'Motivo: ' + reason + ' · categoría: ' + category,
      recordId: id });
    closeModal();
    renderView(state.view);
  } catch(e) {
    toast('Error: ' + e.message, 'critical');
  }
}
window.submitBlock = submitBlock;

function openUnblockModal(recordId) {
  const record = DataService.getRenewal(recordId);
  if (!record) return;
  const note = prompt(
    'Desbloquear renovación\n\n' +
    'Motivo del bloqueo actual: ' + record.block_reason + '\n' +
    'Estado al que retornará: ' + (record.block_previous_state || 'Pendiente') + '\n\n' +
    'Nota del desbloqueo (queda en auditoría):',
    'Resuelto'
  );
  if (note === null) return;
  try {
    DataService.unblockRenewal(recordId, note || 'sin nota', state.user);
    notify({ level: 'info', category: 'state',
      title: '✓ Renovación desbloqueada',
      message: 'Estado restaurado: ' + record.estado,
      recordId });
    closeModal();
    renderView(state.view);
  } catch(e) {
    toast('Error: ' + e.message, 'critical');
  }
}
window.openUnblockModal = openUnblockModal;

// ═══════════════════════════════════════════════════════════════════
// MODAL: Explicación de bloqueo (faltan requisitos)
// ═══════════════════════════════════════════════════════════════════
function openBlockExplanationModal(recordId, reasons) {
  const record = DataService.getRenewal(recordId);
  const list = reasons.map(r => '<li>' + esc(r) + '</li>').join('');
  alert('No se puede continuar\n\n' + reasons.join('\n'));
}
window.openBlockExplanationModal = openBlockExplanationModal;

// ═══════════════════════════════════════════════════════════════════
// MODAL: Aprobar / Rechazar (solo gestor_activos / super_admin)
// ═══════════════════════════════════════════════════════════════════
function approveFromQueue(recordId) {
  if (!confirm('¿Aprobar el cierre de esta renovación?')) return;
  try {
    ApprovalService.approve(recordId, state.user);
    renderView(state.view);
  } catch(e) {
    toast('Error: ' + e.message, 'critical');
  }
}
window.approveFromQueue = approveFromQueue;

function rejectFromQueue(recordId) {
  const reason = prompt('Motivo del rechazo (obligatorio):\n\nEl técnico recibirá la notificación con esta razón y deberá corregir.');
  if (!reason || !reason.trim()) return;
  try {
    ApprovalService.reject(recordId, reason, state.user);
    renderView(state.view);
  } catch(e) {
    toast('Error: ' + e.message, 'critical');
  }
}
window.rejectFromQueue = rejectFromQueue;

// ═══════════════════════════════════════════════════════════════════
// VISTA: Aprobaciones pendientes
// ═══════════════════════════════════════════════════════════════════
function renderAprobaciones() {
  if (!can('renewal.approve')) {
    $('aprob-content').innerHTML = '<div class="empty">' +
      '<div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg></div>' +
      '<div class="empty-title">Sin permisos</div>' +
      '<div class="empty-msg">Solo Gestor de Activos y Super Admin pueden aprobar cierres</div></div>';
    $('aprob-count').textContent = '—';
    return;
  }
  
  const queue = ApprovalService.getQueue();
  const rejected = ApprovalService.getRejected();
  
  $('aprob-count').textContent = queue.length + ' pendientes · ' + rejected.length + ' en corrección';
  
  if (queue.length === 0 && rejected.length === 0) {
    $('aprob-content').innerHTML = '<div class="empty">' +
      '<div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '<div class="empty-title">Sin aprobaciones pendientes</div>' +
      '<div class="empty-msg">Las solicitudes de validación de cierre aparecerán aquí</div></div>';
    return;
  }
  
  let html = '';
  
  // Sección: Pendientes
  if (queue.length > 0) {
    html += '<div class="panel"><div class="panel-head"><div>' +
      '<div class="panel-title">Pendientes de aprobación</div>' +
      '<div class="panel-sub">' + queue.length + ' renovaciones con checklist completo esperando tu validación</div>' +
      '</div></div>';
    html += '<div class="aprob-grid">';
    queue.forEach(r => {
      const ev = ApprovalService.evaluate(r);
      html += '<div class="aprob-card" onclick="openEditModal(' + r.id + ')">' +
        '<div class="aprob-card-head">' +
          '<div><div class="aprob-card-code">ID ' + r.id + ' · ' + esc(r.empresa) + '</div>' +
          '<div class="aprob-card-name">' + esc(r.nombre || '—') + '</div></div>' +
          '<span class="badge badge-pendiente-aprobaci-n">' + ev.okCount + '/' + ev.total + '</span>' +
        '</div>' +
        '<div class="aprob-card-meta">' +
          esc(r.ciudad || '—') + ' · ' +
          esc(formatEquipo(r.equipoNuevo)) +
          ' · serial: ' + esc(r.eq_nvo_serial || r.serial || '—') +
        '</div>' +
        '<div class="aprob-card-meta">Técnico: <strong>' + esc(r.tecnico || '—') + '</strong></div>' +
        '<div class="aprob-card-actions">' +
          '<button class="btn btn-primary" onclick="event.stopPropagation(); approveFromQueue(' + r.id + ')">Aprobar</button>' +
          '<button class="btn" onclick="event.stopPropagation(); rejectFromQueue(' + r.id + ')">Rechazar</button>' +
          '<button class="btn btn-link" onclick="event.stopPropagation(); openEditModal(' + r.id + ')">Ver detalle</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div></div>';
  }
  
  // Sección: Corrección requerida
  if (rejected.length > 0) {
    html += '<div class="panel"><div class="panel-head"><div>' +
      '<div class="panel-title">En corrección</div>' +
      '<div class="panel-sub">' + rejected.length + ' renovaciones rechazadas que el técnico debe corregir</div>' +
      '</div></div>';
    html += '<div class="aprob-grid">';
    rejected.forEach(r => {
      const reason = (r.approval && r.approval.reason) ||
                     (r._missing_items ? r._missing_items.join(', ') : 'pendiente revisión');
      html += '<div class="aprob-card aprob-card-rejected" onclick="openEditModal(' + r.id + ')">' +
        '<div class="aprob-card-head">' +
          '<div><div class="aprob-card-code">ID ' + r.id + '</div>' +
          '<div class="aprob-card-name">' + esc(r.nombre || '—') + '</div></div>' +
          '<span class="badge badge-bloqueado">Corrección</span>' +
        '</div>' +
        '<div class="aprob-card-meta">Motivo: <strong>' + esc(reason) + '</strong></div>' +
        '<div class="aprob-card-meta">Técnico: <strong>' + esc(r.tecnico || '—') + '</strong></div>' +
      '</div>';
    });
    html += '</div></div>';
  }
  
  $('aprob-content').innerHTML = html;
}
window.renderAprobaciones = renderAprobaciones;




// ═══════════════════════════════════════════════════════════════════
// F4 · DASHBOARDS POR ROL
// ═══════════════════════════════════════════════════════════════════

// ── 1. Role switcher (herramienta de desarrollo) ────────────────
function toggleRoleSwitcher() {
  const menu = $('role-switcher-menu');
  if (menu) menu.classList.toggle('open');
}
window.toggleRoleSwitcher = toggleRoleSwitcher;

function switchRole(role, event) {
  // GH3.38 FC-06: solo Super Admin puede cambiar de rol
  var _currentRole = (window.state && state.user && (state.user.role || state.user.rol)) || '';
  if (_currentRole !== 'super_admin') {
    console.error('[RBAC] switchRole() denegado — rol:', _currentRole);
    if (event) event.stopPropagation();
    return;
  }
  if (event) { event.stopPropagation(); }
  state.user.role = role;
  $('role-switcher-menu') && $('role-switcher-menu').classList.remove('open');
  updateRoleBadge();
  updateSidebarByRole();
  updateAprobacionesItem();
  updatePreviewButton();
  // Redirigir a la vista por defecto del nuevo rol
  goViewByRole();
  notify({ level: 'info', category: 'system',
    title: 'Rol cambiado',
    message: 'Vista activa: ' + role.replace('_', ' ') });
}
window.switchRole = switchRole;

function updateRoleBadge() {
  const badge = $('tb-role-badge');
  const dot = $('tb-role-dot');
  const label = $('tb-role-label');
  if (!badge || !dot || !label) return;
  const role = state.user.role || 'visitante';
  const labels = {
    super_admin: 'Super Admin', gestor_activos: 'Gestor Activos',
    tecnico: 'Técnico', visitante: 'Visitante',
  };
  if (dot) { dot.className = 'role-dot ' + role; }
  if (label) { label.textContent = labels[role] || role; }
  // Marcar activo en el menú
  $$('.role-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.role === role);
  });
}
window.updateRoleBadge = updateRoleBadge;

// Cerrar menu si click fuera
document.addEventListener('click', (e) => {
  const badge = $('tb-role-badge');
  const menu = $('role-switcher-menu');
  if (badge && menu && !badge.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ── 2. Sidebar role-aware ───────────────────────────────────────
function updateSidebarByRole() {
  const role = state.user.role || 'visitante';
  const isTecnico  = role === 'tecnico';
  const isVisitante = role === 'visitante';
  const isGestor   = role === 'gestor_activos' || role === 'super_admin';

  // "Mi cola" — solo técnico
  const sbTec = $('sb-home-tecnico');
  if (sbTec) sbTec.style.display = isTecnico ? '' : 'none';

  // "Panel ejecutivo" — solo visitante (los otros roles usan el botón ojo del topbar)
  const sbPanel = $('sb-panel');
  if (sbPanel) sbPanel.style.display = isVisitante ? '' : 'none';

  // Para técnico: ocultar vistas de gestión que no le corresponden
  ['usuarios','tecnicos','ciudades','devoluciones','reportes'].forEach(v => {
    const el = document.querySelector('[data-view="' + v + '"]');
    if (el) el.style.display = isTecnico ? 'none' : '';
  });

  // Visitante: solo Panel ejecutivo + Reportes (puede ver reportes con report.view)
  if (isVisitante) {
    ['resumen','usuarios','tecnicos','ciudades','devoluciones',
     'actividad','ajustes'].forEach(v => {
      const el = document.querySelector('[data-view="' + v + '"]');
      if (el) el.style.display = 'none';
    });
    // reportes: visible para visitante (report.view = true)
    const repEl = document.querySelector('[data-view="reportes"]');
    if (repEl) repEl.style.display = '';
  }

  // Restaurar los items si no es técnico ni visitante
  if (isGestor) {
    $$('.sb-item[data-view]').forEach(el => {
      if (el.id !== 'sb-home-tecnico') el.style.display = '';
    });
  }

  // Badge cola técnico
  if (isTecnico) {
    const mine = DataService.getRenewals({ role: 'tecnico', tecnico: state.user.name });
    const badge = $('b-home-tecnico');
    if (badge) badge.textContent = mine.length || '—';
  }
}
window.updateSidebarByRole = updateSidebarByRole;

// ── 3. Redirección por rol ──────────────────────────────────────
function goViewByRole() {
  const role = state.user.role || 'visitante';
  // GH3.39.1 P7: cada rol va directamente a su vista permitida, sin pasar por vistas prohibidas
  var homeMap = {
    'super_admin':    'resumen',
    'gestor_activos': 'resumen',
    'tecnico':        'home-tecnico',
    'consulta':       'resumen',
    'visitante':      'resumen',
  };
  goView(homeMap[role] || 'resumen');
}
window.goViewByRole = goViewByRole;

// ── 4. Panel ejecutivo (renderizado) ───────────────────────────
function renderPanelEjecutivo() {
  const real = getReal();
  const kpi  = KPIService.calculate(real);
  const raee = KPIService.raeeStats();

  // Hero KPIs
  setText('pe-total', kpi.total);
  setText('pe-completados', kpi.entregados);
  setText('pe-proceso', kpi.enProceso);
  setText('pe-pendientes', kpi.pendientes);
  setText('pe-actas', real.filter(u => u.acta_firmada).length);
  setText('pe-pct-sub', kpi.porcentajeAvance + '% completado');
  setText('pe-prog-pct', kpi.porcentajeAvance + '%');
  const fill = $('pe-prog-fill');
  if (fill) setTimeout(() => { fill.style.width = kpi.porcentajeAvance + '%'; }, 100);

  // Empresas
  const byEmp = KPIService.byEmpresa();
  ['HBT','HGS'].forEach(emp => {
    const e = byEmp[emp] || { total: 0, entregados: 0, porcentajeAvance: 0 };
    const key = emp.toLowerCase();
    setText('pe-' + key + '-n', e.entregados + ' / ' + e.total);
    const pctEl = $('pe-' + key + '-pct');
    if (pctEl) {
      pctEl.textContent = e.porcentajeAvance + '%';
      pctEl.className = 'panel-stat-pct ' + (e.porcentajeAvance >= 70 ? 'grn' : e.porcentajeAvance >= 40 ? 'amb' : 'red');
    }
  });

  // Por técnico
  const byTec = KPIService.byTecnico();
  const tecEl = $('pe-por-tecnico');
  if (tecEl) {
    tecEl.innerHTML = Object.entries(byTec).filter(([t]) => t !== 'Sin asignar').map(([t, k]) =>
      '<div class="panel-stat-row">' +
        '<span class="panel-stat-label">' + esc(t) + '</span>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<span class="panel-stat-val">' + k.entregados + '</span>' +
          '<span class="panel-stat-pct ' + (k.porcentajeAvance >= 70 ? 'grn' : 'amb') + '">' + k.porcentajeAvance + '%</span>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  // RAEE donut (canvas nativo)
  const canvas = $('pe-raee-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const raeeData = [
      { label: 'RAEE', val: raee.RAEE, color: '#D30034' },
      { label: 'Reasignable', val: raee.Reasignable, color: '#16A34A' },
      { label: 'Revisión manual', val: raee['Revisión manual'], color: '#F59E0B' },
    ];
    const total_raee = raeeData.reduce((s, d) => s + d.val, 0) || 1;
    let start = -Math.PI / 2;
    ctx.clearRect(0, 0, 100, 100);
    raeeData.forEach(d => {
      const angle = (d.val / total_raee) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(50, 50);
      ctx.arc(50, 50, 42, start, start + angle);
      ctx.fillStyle = d.color; ctx.fill();
      start += angle;
    });
    // Donut hole
    ctx.beginPath(); ctx.arc(50, 50, 26, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#fff';
    ctx.fill();
    // Centro: total clasificados
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-1').trim() || '#0A0A0F';
    ctx.font = 'bold 16px Inter Tight, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(total_raee, 50, 50);

    const labelsEl = $('pe-raee-labels');
    if (labelsEl) {
      labelsEl.innerHTML = raeeData.map(d =>
        '<div class="raee-label-row">' +
          '<div class="raee-dot" style="background:' + d.color + '"></div>' +
          esc(d.label) +
          '<span class="raee-label-val">' + d.val + '</span>' +
        '</div>'
      ).join('');
    }
  }

  // Distribución de estados
  const estadoMap = {};
  real.forEach(u => { estadoMap[u.estado] = (estadoMap[u.estado] || 0) + 1; });
  const estadosEl = $('pe-estados-list');
  if (estadosEl) {
    estadosEl.innerHTML = Object.entries(estadoMap).sort((a,b) => b[1]-a[1]).slice(0,6).map(([est, n]) =>
      '<div class="panel-stat-row">' +
        '<span class="panel-stat-label">' + esc(est) + '</span>' +
        '<span class="panel-stat-val">' + n + '</span>' +
      '</div>'
    ).join('');
  }

  // Aprobaciones
  setText('pe-aprobaciones', kpi.pendientesAprobacion);
  setText('pe-correccion', kpi.correccion);
  setText('pe-bloqueados', kpi.bloqueados);

  // GH3.28: Tarjeta Destino Final
  if (typeof kpi.destinoRAEE !== 'undefined') {
    setText('pe-destino-raee',    kpi.destinoRAEE);
    setText('pe-destino-donacion', kpi.destinoDonacion);
    setText('pe-destino-venta',    kpi.destinoVenta);
    setText('pe-destino-reasign',  kpi.destinoReasign);
    var destTotal = $('pe-destino-total');
    if (destTotal) destTotal.textContent = kpi.conEvaluacion + ' con evaluacion';
  }
}
window.renderPanelEjecutivo = renderPanelEjecutivo;

// ── 5. Home técnico ─────────────────────────────────────────────
function renderHomeTecnico() {
  const tecnico = state.user.name;
  const all = getReal();
  const mine = all.filter(u => (u.tecnico || '').toLowerCase() === (tecnico || '').toLowerCase());

  // Calcular siguiente acción para cada renovación
  function nextAction(u) {
    const s = u.estado;
    const NEXT = {
      'Pendiente':                        'Iniciar alistamiento del equipo nuevo',
      'Alistamiento':                     'Confirmar equipo nuevo listo · cambiar a Programado',
      'Programado':                       'Coordinar fecha de entrega con el usuario',
      'En tránsito equipo nuevo':         'Confirmar entrega al usuario',
      'Entregado equipo nuevo':           'Coordinar recogida del equipo anterior',
      'Pendiente recoger equipo anterior':'Recoger el equipo anterior del usuario',
      'En tránsito equipo anterior':      'Confirmar recepción en bodega',
      'Equipo antiguo recibido':          'Registrar en bodega y solicitar validación de cierre',
      'Renovación completada':            'Solicitar validación de cierre',
      'Corrección requerida':             'Revisar los puntos rechazados y corregir',
      'Pendiente aprobación':             'En espera de aprobación del Gestor de Activos',
      'Feedback':                         'Solicitar encuesta de satisfacción al usuario',
      'Bloqueado':                        'Resolver el impedimento: ' + (u.block_reason || 'ver motivo'),
    };
    return NEXT[s] || '—';
  }

  // Initials del técnico
  const initials = (tecnico || 'T').split(' ').map(w => w[0] || '').slice(0,2).join('').toUpperCase() || 'T';
  setText('ht-avatar', initials);
  setText('ht-nombre', tecnico || 'Técnico');
  setText('ht-meta', mine.length + ' renovaciones asignadas');

  const kpi = KPIService.calculate(mine);
  setText('ht-pendientes', kpi.pendientes);
  setText('ht-proceso', kpi.enProceso);
  setText('ht-listos', kpi.entregados);
  setText('ht-total', kpi.total);

  // Bloqueados / Corrección
  const bloq = mine.filter(u => u.estado === 'Bloqueado' || u.estado === 'Corrección requerida');
  const blockedSec = $('ht-bloqueados-section');
  if (blockedSec) blockedSec.style.display = bloq.length ? '' : 'none';
  setText('ht-bloq-count', bloq.length + ' registros');
  const bloqList = $('ht-bloqueados-list');
  if (bloqList) {
    bloqList.innerHTML = bloq.map(u =>
      '<div class="queue-card ' + (u.estado === 'Bloqueado' ? 'blocked' : 'correction') + '" onclick="openEditModal(' + u.id + ')">' +
        '<div>' +
          '<div class="queue-card-name">' + esc(u.nombre || '—') + '</div>' +
          '<div class="queue-card-meta">' + esc(u.ciudad || '—') + ' · <span class="badge ' + ConfigService.badgeClass(u.estado) + '">' + esc(u.estado) + '</span></div>' +
        '</div>' +
        '<div class="queue-card-estado"></div>' +
        '<div class="queue-next-action">' + esc(nextAction(u)) + '</div>' +
      '</div>'
    ).join('');
  }

  // Cola de trabajo (todos los activos, ordenados por prioridad de flujo)
  const flowOrder = ConfigService.getFlow();
  const cola = mine.filter(u => u.estado !== 'Cerrado' && u.estado !== 'BACKUP')
    .sort((a, b) => {
      const ia = flowOrder.indexOf(a.estado); const ib = flowOrder.indexOf(b.estado);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  setText('ht-cola-count', cola.length + ' renovaciones activas');
  const colaList = $('ht-cola-list');
  if (colaList) {
    if (cola.length === 0) {
      colaList.innerHTML = '<div class="home-queue-empty">Sin renovaciones activas asignadas</div>';
    } else {
      colaList.innerHTML = cola.map(u =>
        '<div class="queue-card" onclick="openEditModal(' + u.id + ')">' +
          '<div>' +
            '<div class="queue-card-name">' + esc(u.nombre || '—') + '</div>' +
            '<div class="queue-card-meta">' +
              esc(u.ciudad || '—') + ' · ' + esc(formatEquipo(u.equipoNuevo) || 'Equipo pendiente asignar') +
            '</div>' +
          '</div>' +
          '<div class="queue-card-estado">' +
            '<span class="badge ' + ConfigService.badgeClass(u.estado) + '">' + esc(u.estado) + '</span>' +
          '</div>' +
          '<div class="queue-next-action">' + esc(nextAction(u)) + '</div>' +
        '</div>'
      ).join('');
    }
  }
}
window.renderHomeTecnico = renderHomeTecnico;

// ── Helpers locales ─────────────────────────────────────────────
function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = (val == null || val === '') ? '—' : val;
}

// ── 6. Conectar previewVisitante a la vista real ────────────────
window.previewVisitante = function() {
  if (!can('panel.preview') && !can('panel.view')) {
    toast('Sin permisos para el Panel Ejecutivo', 'warning');
    return;
  }
  goView('panel-ejecutivo'); // P7: id correcto para Panel Ejecutivo
};



// ════════════════════════════════════════════════════════════════════
// MVP 1.0 · P1–P8 · Motor de datos Excel-Centric
// Versión: v8.8.4-MVP-1.0-write-engine
// ════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────
// MVP · EventBus — desacoplamiento total entre capas
// ────────────────────────────────────────────────────────────────────
const EventBus = (() => {
  const _listeners = new Map();
  return {
    subscribe(event, handler) {
      if (!_listeners.has(event)) _listeners.set(event, new Set());
      _listeners.get(event).add(handler);
      return () => { const s = _listeners.get(event); if (s) s.delete(handler); };
    },
    publish(event, payload) {
      const handlers = _listeners.get(event);
      if (!handlers) return;
      handlers.forEach(h => { try { h(payload); } catch(e) { console.error('[EventBus]', event, e); } });
    },
    once(event, handler) {
      const unsub = this.subscribe(event, (payload) => { handler(payload); unsub(); });
    },
  };
})();
window.EventBus = EventBus;

// ────────────────────────────────────────────────────────────────────
// MVP · TableRegistry — nombres canónicos de las tablas PMC_*
// ────────────────────────────────────────────────────────────────────
