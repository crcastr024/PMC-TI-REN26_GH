// ════════════════════════════════════════════════════════════════════
// STAB-v15 RC-2 · GH3.41 — AuditService
// Servicio centralizado de auditoría a la hoja AUDITORIA del Excel Maestro.
//
// ARQUITECTURA
//   Capa de observación desacoplada. NO modifica Core, DataService,
//   GraphProvider, WorkbookWriter, DashboardStats, RBAC ni StateMachine.
//
// FLUJO
//   1. Después de una escritura exitosa a RENOVACIONES (syncToProvider.then):
//      AuditService.startSession()  → genera sessionId único
//      AuditService.log(entry)      → 1 entrada por campo modificado
//      AuditService.finishSession() → flush del buffer a la hoja AUDITORIA
//   2. Si Graph falla → NO se registra auditoría (sync.catch omite).
//
// API PÚBLICA (única superficie permitida)
//   AuditService.startSession(opts)  → sessionId string
//   AuditService.log(entry)          → agrega al buffer (retorna false si iguales)
//   AuditService.finishSession()     → Promise<{ok, written, skipped}>
//
// CATÁLOGO DE ACCIÓN
//   CREATE, UPDATE, DELETE, ASIGNAR, REASIGNAR, ENTREGA,
//   DEVOLUCION_SOLICITADA, DEVOLUCION_RECIBIDA, ACTA_GENERADA,
//   ACTA_FIRMADA, VALIDACION_SOLICITADA, APROBADO, RECHAZADO,
//   RENOVACION_COMPLETADA, SINCRONIZACION, LOGIN, LOGOUT, ERROR
//
// CATÁLOGO DE ORIGEN
//   Dashboard, Formulario, Sistema, Graph, Excel, Sincronizacion, API
//
// ID_LOG
//   Autoincremental sin reinicio ni reutilización. Se lee último de AUDITORIA
//   en el arranque de sesión y se incrementa localmente.
//
// VERSION (columna de la hoja AUDITORIA)
//   Se toma de PRODUCTION_CONFIG.version (versión de la app), NUNCA hardcode.
//
// COMPATIBILIDAD
//   No modifica DashboardStats, Reportes, KPIs, Refresh, MSAL, Graph,
//   ExcelProvider, ApprovalService ni StateMachine.
// ════════════════════════════════════════════════════════════════════

var AuditService = (function() {
  'use strict';

  // ── Constantes ─────────────────────────────────────────────────────
  var VALID_ACTIONS = [
    'CREATE','UPDATE','DELETE','ASIGNAR','REASIGNAR','ENTREGA',
    'DEVOLUCION_SOLICITADA','DEVOLUCION_RECIBIDA','ACTA_GENERADA',
    'ACTA_FIRMADA','VALIDACION_SOLICITADA','APROBADO','RECHAZADO',
    'RENOVACION_COMPLETADA','SINCRONIZACION','LOGIN','LOGOUT','ERROR'
  ];
  var VALID_ORIGINS = [
    'Dashboard','Formulario','Sistema','Graph','Excel','Sincronizacion','API'
  ];
  var SHEET_NAME = 'AUDITORIA';
  // Orden EXACTO de columnas según especificación del sprint
  var HEADERS = [
    'id_log','session_id','fecha','usuario','accion','origen','modulo',
    'registro','campo','valor_anterior','valor_nuevo','observacion','VERSION'
  ];

  // ── Estado interno ─────────────────────────────────────────────────
  var _currentSession = null; // { sessionId, buffer:[], startTs, origen }
  var _lastIdLog = null;      // último id_log conocido; -1 hasta bootstrap
  var _bootstrapping = false; // en proceso de leer último id_log
  var _bootstrapPromise = null;

  // ── Helpers ────────────────────────────────────────────────────────
  function _genSessionId() {
    // Formato: 8 caracteres hex uppercase — ej "6E91B8AF"
    var chars = '0123456789ABCDEF';
    var s = '';
    for (var i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * 16));
    return s;
  }

  function _nowISO() {
    // Formato: 2026-07-21T14:38:55 (sin milisegundos, sin Z)
    return new Date().toISOString().replace(/\.\d{3}Z$/, '');
  }

  function _getVersionTag() {
    // VERSION de la app, no del registro
    var cfg = window.PRODUCTION_CONFIG || {};
    return cfg.version || cfg.appVersion || 'GH3.41';
  }

  function _getUserLabel() {
    var user = (window.state && window.state.user) || {};
    return user.name || user.displayName || user.email || user.id || 'sistema';
  }

  function _sameValue(a, b) {
    // Comparación laxa: null/undefined/'' son equivalentes; números y strings coincidentes; fechas ISO
    if (a === b) return true;
    if ((a == null || a === '') && (b == null || b === '')) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    // Números como strings
    if (!isNaN(a) && !isNaN(b) && String(Number(a)) === String(Number(b))) return true;
    return String(a) === String(b);
  }

  function _fmtValue(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.toISOString().replace(/\.\d{3}Z$/, '');
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  /**
   * Deriva la acción canónica del cambio.
   * @param {string} field - nombre interno del campo
   * @param {*} oldValue
   * @param {*} newValue
   * @param {Object} recordAfter - registro completo tras el cambio
   */
  function _deriveAction(field, oldValue, newValue, recordAfter) {
    // Cambios de estado → hitos del proceso
    if (field === 'estado') {
      switch (newValue) {
        case 'Programado':                       return 'ASIGNAR';
        case 'Entregado equipo nuevo':           return 'ENTREGA';
        case 'Pendiente devolución equipo anterior': return 'DEVOLUCION_SOLICITADA';
        case 'Equipo anterior recibido':         return 'DEVOLUCION_RECIBIDA';
        case 'Pendiente aprobación':             return 'VALIDACION_SOLICITADA';
        case 'Renovación completada':            return 'RENOVACION_COMPLETADA';
        case 'Cerrado':
          if (oldValue === 'Pendiente aprobación') return 'APROBADO';
          return 'RENOVACION_COMPLETADA';
        case 'Corrección requerida':             return 'RECHAZADO';
      }
    }
    // Fechas de hitos operativos
    if (field === 'fecha_firma_acta'      && newValue) return 'ACTA_FIRMADA';
    if (field === 'fecha_envio_acta'      && newValue) return 'ACTA_GENERADA';
    if (field === 'acta_entrega_url'      && newValue && !oldValue) return 'ACTA_GENERADA';
    if (field === 'fecha_recepcion_bodega'&& newValue) return 'DEVOLUCION_RECIBIDA';
    if (field === 'fecha_solicitud_devolucion' && newValue && !oldValue) return 'DEVOLUCION_SOLICITADA';
    // Cambio de técnico = REASIGNAR (solo si había un técnico previo)
    if (field === 'tecnico' && oldValue && newValue && oldValue !== newValue) return 'REASIGNAR';
    if (field === 'tecnico' && !oldValue && newValue) return 'ASIGNAR';
    // Default
    return 'UPDATE';
  }

  // ── Bootstrap: cargar último id_log de la hoja AUDITORIA ──────────
  function _bootstrapLastIdLog() {
    if (_lastIdLog !== null) return Promise.resolve(_lastIdLog);
    if (_bootstrapPromise) return _bootstrapPromise;
    _bootstrapping = true;
    _bootstrapPromise = (function() {
      // Estrategia: leer los datos de auditoria vía DataService (ya carga la hoja)
      var lastId = 0;
      try {
        // Los datos de la hoja AUDITORIA los carga workbook.loadData()
        // en window._PMC_DATA.auditoria (o similar). Buscamos en varias fuentes.
        var auditRows = null;
        if (window._PMC_DATA && window._PMC_DATA.auditoria) auditRows = window._PMC_DATA.auditoria;
        else if (window._PMC_DATA && window._PMC_DATA.AUDITORIA) auditRows = window._PMC_DATA.AUDITORIA;
        else if (window.HBT && window.HBT._auditoria) auditRows = window.HBT._auditoria;

        if (Array.isArray(auditRows) && auditRows.length > 0) {
          auditRows.forEach(function(row) {
            var id = row && (row.id_log || row.ID_LOG || row.idLog);
            if (id != null) { var n = Number(id); if (!isNaN(n) && n > lastId) lastId = n; }
          });
        }
      } catch (e) {
        console.warn('[AuditService] bootstrap id_log falló, usando 0:', e && e.message);
      }
      _lastIdLog = lastId;
      _bootstrapping = false;
      return _lastIdLog;
    })();
    return _bootstrapPromise;
  }

  // ── API pública ─────────────────────────────────────────────────────

  /**
   * Inicia una sesión de auditoría. Un save de N campos = 1 sessionId común.
   * @param {Object} opts - { origen, modulo, observacion }
   * @returns {string} sessionId
   */
  function startSession(opts) {
    opts = opts || {};
    var sessionId = _genSessionId();
    _currentSession = {
      sessionId:  sessionId,
      buffer:     [],
      startTs:    Date.now(),
      origen:     VALID_ORIGINS.indexOf(opts.origen) >= 0 ? opts.origen : 'Formulario',
      modulo:     opts.modulo     || 'Renovaciones',
      observacion:opts.observacion|| ''
    };
    // Bootstrap async — no bloquea; se resuelve en finishSession
    _bootstrapLastIdLog();
    return sessionId;
  }

  /**
   * Registra un cambio en el buffer de la sesión actual.
   * NO registra si valor_anterior === valor_nuevo.
   * @param {Object} entry
   *   { registro, campo, valor_anterior, valor_nuevo, accion?, origen?, observacion?, recordAfter? }
   * @returns {boolean} true si se agregó, false si se descartó por sin cambio real
   */
  function log(entry) {
    if (!_currentSession) {
      console.warn('[AuditService] log() sin startSession(). Ignorado:', entry && entry.campo);
      return false;
    }
    if (!entry || entry.registro == null || !entry.campo) {
      console.warn('[AuditService] log() sin registro/campo. Ignorado.');
      return false;
    }
    // Regla oficial: sin cambio real → NO registrar
    if (_sameValue(entry.valor_anterior, entry.valor_nuevo)) return false;

    var accion = entry.accion || _deriveAction(entry.campo, entry.valor_anterior, entry.valor_nuevo, entry.recordAfter);
    if (VALID_ACTIONS.indexOf(accion) < 0) accion = 'UPDATE';

    var origen = entry.origen || _currentSession.origen;
    if (VALID_ORIGINS.indexOf(origen) < 0) origen = 'Sistema';

    // observacion NUNCA null
    var obs = entry.observacion;
    if (!obs) obs = _currentSession.observacion || 'Actualización automática del sistema';

    _currentSession.buffer.push({
      session_id:     _currentSession.sessionId,
      fecha:          _nowISO(),
      usuario:        _getUserLabel(),
      accion:         accion,
      origen:         origen,
      modulo:         entry.modulo || _currentSession.modulo,
      registro:       String(entry.registro),
      campo:          entry.campo,
      valor_anterior: _fmtValue(entry.valor_anterior),
      valor_nuevo:    _fmtValue(entry.valor_nuevo),
      observacion:    obs,
      VERSION:        _getVersionTag()
    });
    return true;
  }

  /**
   * Registra un evento del sistema sin cambios de campo (LOGIN, LOGOUT, SINCRONIZACION, ERROR).
   * No requiere startSession/finishSession; se envía como sesión aislada.
   * @param {string} accion - LOGIN|LOGOUT|SINCRONIZACION|ERROR
   * @param {Object} opts - { registro?, observacion?, origen? }
   */
  function logSystemEvent(accion, opts) {
    if (VALID_ACTIONS.indexOf(accion) < 0) accion = 'ERROR';
    opts = opts || {};
    var sid = _genSessionId();
    var origen = VALID_ORIGINS.indexOf(opts.origen) >= 0 ? opts.origen : 'Sistema';
    var entry = {
      session_id:     sid,
      fecha:          _nowISO(),
      usuario:        _getUserLabel(),
      accion:         accion,
      origen:         origen,
      modulo:         opts.modulo || 'Sistema',
      registro:       String(opts.registro || '0'),
      campo:          opts.campo || '',
      valor_anterior: '',
      valor_nuevo:    '',
      observacion:    opts.observacion || 'Evento del sistema',
      VERSION:        _getVersionTag()
    };
    // Enviar como buffer de 1 fila sin usar la sesión activa
    return _flush([entry]);
  }

  /**
   * Cierra la sesión actual y escribe el buffer a AUDITORIA.
   * @returns {Promise<{ok, written, skipped}>}
   */
  function finishSession() {
    if (!_currentSession) return Promise.resolve({ ok: true, written: 0, skipped: 0 });
    var session = _currentSession;
    _currentSession = null;
    if (session.buffer.length === 0) return Promise.resolve({ ok: true, written: 0, skipped: 0 });
    return _flush(session.buffer);
  }

  /**
   * Escritura al Excel (append filas a la hoja AUDITORIA).
   * @param {Array} entries - buffer de filas
   * @returns {Promise}
   */
  function _flush(entries) {
    if (!entries || entries.length === 0) return Promise.resolve({ ok: true, written: 0, skipped: 0 });

    // Sin GraphClient / GraphResolver → modo mock (no falla, solo warn)
    if (!window.GraphClient || !window.GraphResolver || typeof GraphResolver.getBase !== 'function') {
      console.info('[AuditService] Modo mock — sin escritura real. Entries:', entries.length);
      _publishForOfflineReplay(entries);
      return Promise.resolve({ ok: true, written: 0, skipped: entries.length, mock: true });
    }

    return _bootstrapLastIdLog().then(function() {
      // Asignar id_log incremental
      entries.forEach(function(e) { _lastIdLog += 1; e.id_log = _lastIdLog; });

      var base = GraphResolver.getBase();
      if (!base) {
        console.warn('[AuditService] GraphResolver.getBase() vacío. Skip.');
        _publishForOfflineReplay(entries);
        return { ok: false, written: 0, skipped: entries.length, reason: 'no-base' };
      }
      // Append via tables API (más simple y seguro que calcular rangos)
      // Endpoint: POST /worksheets/{SHEET_NAME}/tables/{TABLE_NAME}/rows/add
      // Fallback: si no hay tabla, usar range append por índice.
      var rows = entries.map(function(e) {
        return HEADERS.map(function(h) { return e[h] != null ? e[h] : ''; });
      });

      // Estrategia principal: usar range append. Necesitamos saber la última fila con datos.
      // Delegamos en un endpoint estándar de Graph: usedRange para obtener el rango actual.
      var sheetUrl = base + '/worksheets/' + SHEET_NAME;
      return GraphClient.get(sheetUrl + '/usedRange(valuesOnly=true)?$select=address,rowCount',
                              window.SCOPES || undefined, {})
        .then(function(range) {
          // range.rowCount incluye la fila header
          var startRow = (range && range.rowCount ? Number(range.rowCount) : 1) + 1;
          var endRow   = startRow + rows.length - 1;
          var endCol   = _colLetter(HEADERS.length - 1); // 0-indexed → 12 → 'M'
          var address  = 'A' + startRow + ':' + endCol + endRow;
          var patchUrl = sheetUrl + '/range(address=\'' + address + '\')';
          return GraphClient.patch(patchUrl, { values: rows }, window.SCOPES || undefined, {})
            .then(function() {
              return { ok: true, written: rows.length, skipped: 0, address: address };
            });
        })
        .catch(function(err) {
          console.warn('[AuditService] flush falló:', err && err.message);
          _publishForOfflineReplay(entries);
          return { ok: false, written: 0, skipped: entries.length, error: err && err.message };
        });
    });
  }

  // Publicar buffer al EventBus para posible replay offline (no bloquea)
  function _publishForOfflineReplay(entries) {
    try {
      if (window.EventBus && typeof EventBus.publish === 'function') {
        EventBus.publish('audit.buffered', { count: entries.length, entries: entries });
      }
    } catch (e) { /* silencioso */ }
  }

  // Convierte índice 0-based a letra Excel (0→A, 25→Z, 26→AA)
  function _colLetter(idx) {
    var s = '';
    do { s = String.fromCharCode(65 + (idx % 26)) + s; idx = Math.floor(idx / 26) - 1; } while (idx >= 0);
    return s;
  }

  // ── Diagnóstico (opcional; no altera el sistema) ────────────────────
  function _diag() {
    return {
      hasSession:   !!_currentSession,
      sessionId:    _currentSession ? _currentSession.sessionId : null,
      bufferSize:   _currentSession ? _currentSession.buffer.length : 0,
      lastIdLog:    _lastIdLog,
      version:      _getVersionTag(),
      user:         _getUserLabel()
    };
  }

  return {
    startSession:    startSession,
    log:             log,
    finishSession:   finishSession,
    logSystemEvent:  logSystemEvent,
    // Solo para diagnóstico — no forma parte del contrato público
    _diag:           _diag,
    // Exponer catálogos como readonly
    ACTIONS:         VALID_ACTIONS.slice(),
    ORIGINS:         VALID_ORIGINS.slice()
  };
})();
window.AuditService = AuditService;
