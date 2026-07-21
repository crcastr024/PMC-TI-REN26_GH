// ════════════════════════════════════════════════════════════════════
// STAB-v15 RC-2 · GH3.41 — AuditService (con hardening GH3.41.1)
// Servicio centralizado de auditoría a la hoja AUDITORIA del Excel Maestro.
//
// ARQUITECTURA
//   Capa de observación desacoplada. NO modifica Core, DataService,
//   GraphProvider, WorkbookWriter, DashboardStats, RBAC ni StateMachine.
//
// GH3.41.1 HARDENING
//   TASK 01 — Concurrencia id_log: recálculo justo antes del PATCH usando usedRange.
//   TASK 04 — abortSession() garantiza cierre limpio si finishSession falla.
//   TASK 05 — Cola offline persistente en localStorage; drain automático.
//   TASK 06 — ObjectId de MSAL capturado en diagnóstico interno.
//   TASK 07 — VALID_ORIGINS extendido con Aprobacion, Migracion, Importacion.
//
// API PÚBLICA (única superficie permitida)
//   AuditService.startSession(opts)  → sessionId string
//   AuditService.log(entry)          → boolean (false si igual)
//   AuditService.finishSession()     → Promise<{ok, written, skipped}>
//   AuditService.abortSession()      → cierra sin escribir (garantiza no-leak)
//   AuditService.logSystemEvent()    → LOGIN/LOGOUT/SINCRONIZACION/ERROR
//   AuditService.drainOfflineQueue() → reintenta persistidos (llamar en boot)
// ════════════════════════════════════════════════════════════════════

var AuditService = (function() {
  'use strict';

  // ── Catálogos ──────────────────────────────────────────────────────
  var VALID_ACTIONS = [
    'CREATE','UPDATE','DELETE','ASIGNAR','REASIGNAR','ENTREGA',
    'DEVOLUCION_SOLICITADA','DEVOLUCION_RECIBIDA','ACTA_GENERADA',
    'ACTA_FIRMADA','VALIDACION_SOLICITADA','APROBADO','RECHAZADO',
    'RENOVACION_COMPLETADA','SINCRONIZACION','LOGIN','LOGOUT','ERROR'
  ];
  // Aliases en español (aceptados como entrada; se normalizan al catálogo canónico)
  var ACTION_ALIASES = {
    'CREAR': 'CREATE',
    'EDITAR': 'UPDATE',
    'ELIMINAR': 'DELETE'
  };
  // GH3.41.1 TASK 07: catálogo extendido de orígenes
  var VALID_ORIGINS = [
    'Dashboard','Formulario','Sistema','Graph','Excel',
    'Sincronizacion','API','Aprobacion','Migracion','Importacion'
  ];
  var SHEET_NAME = 'AUDITORIA';
  var HEADERS = [
    'id_log','session_id','fecha','usuario','accion','origen','modulo',
    'registro','campo','valor_anterior','valor_nuevo','observacion','VERSION'
  ];
  var LS_QUEUE_KEY = 'PMC_AUDIT_QUEUE_v1';
  var SESSION_TIMEOUT_MS = 30000; // GH3.41.1 TASK 04: sesiones sin cerrar en 30s → auto-abort

  // ── Estado interno ─────────────────────────────────────────────────
  var _currentSession = null;
  var _sessionTimer   = null;
  var _lastIdLog      = null;
  var _bootstrapPromise = null;
  var _draining       = false;

  // ── Helpers ────────────────────────────────────────────────────────
  function _genSessionId() {
    var chars = '0123456789ABCDEF';
    var s = '';
    for (var i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * 16));
    return s;
  }

  function _nowISO() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '');
  }

  function _getVersionTag() {
    var cfg = window.PRODUCTION_CONFIG || {};
    return cfg.version || cfg.appVersion || 'GH3.41';
  }

  function _getUserLabel() {
    var user = (window.state && window.state.user) || {};
    return user.name || user.displayName || user.username || user.email || user.id || 'sistema';
  }

  // GH3.41.1 TASK 06: ObjectId estable de MSAL (para diagnóstico interno)
  function _getUserObjectId() {
    var user = (window.state && window.state.user) || {};
    // localAccountId es el ObjectId AAD estable; homeAccountId es también estable pero tenant-específico
    return user.localAccountId || user.homeAccountId || user.oid || user.id || null;
  }

  function _sameValue(a, b) {
    if (a === b) return true;
    // Vacíos: null/undefined/'' se consideran equivalentes entre sí
    var aEmpty = (a == null || a === '');
    var bEmpty = (b == null || b === '');
    if (aEmpty && bEmpty) return true;
    if (aEmpty !== bEmpty) return false; // uno vacío y el otro no → distintos (fix null≠0)
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    // Comparación numérica solo si ambos son numéricos válidos y no strings vacíos
    if (!isNaN(a) && !isNaN(b) && String(a).trim() !== '' && String(b).trim() !== '' &&
        String(Number(a)) === String(Number(b))) return true;
    return String(a) === String(b);
  }

  function _fmtValue(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.toISOString().replace(/\.\d{3}Z$/, '');
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  function _deriveAction(field, oldValue, newValue, recordAfter) {
    if (field === 'estado') {
      switch (newValue) {
        case 'Programado':                            return 'ASIGNAR';
        case 'Entregado equipo nuevo':                return 'ENTREGA';
        case 'Pendiente devolución equipo anterior':  return 'DEVOLUCION_SOLICITADA';
        case 'Equipo anterior recibido':              return 'DEVOLUCION_RECIBIDA';
        case 'Pendiente aprobación':                  return 'VALIDACION_SOLICITADA';
        case 'Renovación completada':                 return 'RENOVACION_COMPLETADA';
        case 'Cerrado':
          if (oldValue === 'Pendiente aprobación') return 'APROBADO';
          return 'RENOVACION_COMPLETADA';
        case 'Corrección requerida':                  return 'RECHAZADO';
      }
    }
    if (field === 'fecha_firma_acta'         && newValue) return 'ACTA_FIRMADA';
    if (field === 'fecha_envio_acta'         && newValue) return 'ACTA_GENERADA';
    if (field === 'acta_entrega_url'         && newValue && !oldValue) return 'ACTA_GENERADA';
    if (field === 'fecha_recepcion_bodega'   && newValue) return 'DEVOLUCION_RECIBIDA';
    if (field === 'fecha_solicitud_devolucion' && newValue && !oldValue) return 'DEVOLUCION_SOLICITADA';
    if (field === 'tecnico' && oldValue && newValue && oldValue !== newValue) return 'REASIGNAR';
    if (field === 'tecnico' && !oldValue && newValue) return 'ASIGNAR';
    return 'UPDATE';
  }

  // ── Bootstrap: cargar último id_log conocido ───────────────────────
  function _bootstrapLastIdLog() {
    if (_lastIdLog !== null) return Promise.resolve(_lastIdLog);
    if (_bootstrapPromise) return _bootstrapPromise;
    _bootstrapPromise = new Promise(function(resolve) {
      var lastId = 0;
      try {
        var auditRows = null;
        if (window._PMC_DATA && window._PMC_DATA.auditoria)  auditRows = window._PMC_DATA.auditoria;
        else if (window._PMC_DATA && window._PMC_DATA.AUDITORIA) auditRows = window._PMC_DATA.AUDITORIA;
        else if (window.HBT && window.HBT._auditoria) auditRows = window.HBT._auditoria;
        if (Array.isArray(auditRows)) {
          auditRows.forEach(function(row) {
            var id = row && (row.id_log || row.ID_LOG || row.idLog);
            if (id != null) { var n = Number(id); if (!isNaN(n) && n > lastId) lastId = n; }
          });
        }
      } catch (e) {
        console.warn('[AuditService] bootstrap id_log falló:', e && e.message);
      }
      _lastIdLog = lastId;
      resolve(_lastIdLog);
    });
    return _bootstrapPromise;
  }

  // ── Cola offline persistente ───────────────────────────────────────
  function _hasLocalStorage() {
    try { return typeof localStorage !== 'undefined'; } catch(e) { return false; }
  }

  function _readOfflineQueue() {
    if (!_hasLocalStorage()) return [];
    try {
      var raw = localStorage.getItem(LS_QUEUE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function _writeOfflineQueue(queue) {
    if (!_hasLocalStorage()) return false;
    try {
      // Guardar máximo 500 filas para no saturar
      var trimmed = queue.length > 500 ? queue.slice(-500) : queue;
      localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(trimmed));
      return true;
    } catch (e) {
      // Storage lleno o disabled → silencioso
      return false;
    }
  }

  function _enqueueOffline(entries) {
    var queue = _readOfflineQueue();
    entries.forEach(function(e) { queue.push(e); });
    _writeOfflineQueue(queue);
    try {
      if (window.EventBus && typeof EventBus.publish === 'function') {
        EventBus.publish('audit.buffered', { count: entries.length });
      }
    } catch (e2) { /* silencioso */ }
  }

  function drainOfflineQueue() {
    if (_draining) return Promise.resolve({ ok: true, skipped: 0, reason: 'already-draining' });
    var queue = _readOfflineQueue();
    if (queue.length === 0) return Promise.resolve({ ok: true, drained: 0 });
    // Solo drenar si Graph está disponible
    if (!window.GraphClient || !window.GraphResolver || typeof GraphResolver.getBase !== 'function') {
      return Promise.resolve({ ok: false, drained: 0, reason: 'no-graph' });
    }
    _draining = true;
    return _flushBatch(queue, true).then(function(res) {
      _draining = false;
      if (res && res.ok) {
        _writeOfflineQueue([]); // limpiar cola completamente
        return { ok: true, drained: queue.length };
      }
      return { ok: false, drained: 0, error: res && res.error };
    }).catch(function(err) {
      _draining = false;
      return { ok: false, drained: 0, error: err && err.message };
    });
  }

  // ── API pública ─────────────────────────────────────────────────────

  function startSession(opts) {
    opts = opts || {};
    // GH3.41.1 TASK 04: si había una sesión abierta, abortarla defensivamente
    if (_currentSession) {
      console.warn('[AuditService] sesión previa sin cerrar — abortando:', _currentSession.sessionId);
      abortSession();
    }
    var sessionId = _genSessionId();
    _currentSession = {
      sessionId:   sessionId,
      buffer:      [],
      startTs:     Date.now(),
      origen:      VALID_ORIGINS.indexOf(opts.origen) >= 0 ? opts.origen : 'Formulario',
      modulo:      opts.modulo     || 'Renovaciones',
      observacion: opts.observacion|| ''
    };
    // Timer defensivo: si la sesión no cierra en 30s, autoabort
    _sessionTimer = setTimeout(function() {
      if (_currentSession && _currentSession.sessionId === sessionId) {
        console.warn('[AuditService] timeout de sesión (30s) — auto-abort:', sessionId);
        abortSession();
      }
    }, SESSION_TIMEOUT_MS);
    _bootstrapLastIdLog();
    return sessionId;
  }

  function log(entry) {
    if (!_currentSession) {
      console.warn('[AuditService] log() sin startSession(). Ignorado.');
      return false;
    }
    if (!entry || entry.registro == null || !entry.campo) return false;
    if (_sameValue(entry.valor_anterior, entry.valor_nuevo)) return false;

    // Normalizar alias en español → canónico inglés
    var accion = entry.accion || _deriveAction(entry.campo, entry.valor_anterior, entry.valor_nuevo, entry.recordAfter);
    if (ACTION_ALIASES[accion]) accion = ACTION_ALIASES[accion];
    if (VALID_ACTIONS.indexOf(accion) < 0) accion = 'UPDATE';

    var origen = entry.origen || _currentSession.origen;
    if (VALID_ORIGINS.indexOf(origen) < 0) origen = 'Sistema';

    var obs = entry.observacion;
    if (!obs) obs = _currentSession.observacion || 'Actualización automática del sistema';

    _currentSession.buffer.push({
      // id_log se asigna en _flush, JUSTO ANTES del PATCH (TASK 01 hardening)
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

  function logSystemEvent(accion, opts) {
    if (ACTION_ALIASES[accion]) accion = ACTION_ALIASES[accion];
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
    return _flushBatch([entry], false);
  }

  function abortSession() {
    if (_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
    if (_currentSession) {
      // Si había buffer con datos, moverlos a la cola offline para no perder trazabilidad
      if (_currentSession.buffer.length > 0) {
        _enqueueOffline(_currentSession.buffer);
      }
      _currentSession = null;
    }
  }

  function finishSession() {
    if (_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
    if (!_currentSession) return Promise.resolve({ ok: true, written: 0, skipped: 0 });
    var session = _currentSession;
    _currentSession = null;
    if (session.buffer.length === 0) return Promise.resolve({ ok: true, written: 0, skipped: 0 });
    return _flushBatch(session.buffer, false);
  }

  /**
   * Escritura al Excel (append filas a AUDITORIA como UN SOLO batch).
   * @param {Array} entries
   * @param {boolean} isDrain - true si vienen de la cola offline (no reencolar en error)
   */
  function _flushBatch(entries, isDrain) {
    if (!entries || entries.length === 0) return Promise.resolve({ ok: true, written: 0, skipped: 0 });

    if (!window.GraphClient || !window.GraphResolver || typeof GraphResolver.getBase !== 'function') {
      if (!isDrain) {
        console.info('[AuditService] Modo mock — persistiendo en cola offline:', entries.length);
        _enqueueOffline(entries);
      }
      return Promise.resolve({ ok: true, written: 0, skipped: entries.length, mock: true });
    }

    return _bootstrapLastIdLog().then(function() {
      var base = GraphResolver.getBase();
      if (!base) {
        if (!isDrain) _enqueueOffline(entries);
        return { ok: false, written: 0, skipped: entries.length, reason: 'no-base' };
      }
      var sheetUrl = base + '/worksheets/' + SHEET_NAME;
      // GH3.41.1 TASK 01: leer usedRange JUSTO ANTES del PATCH, y asignar id_log
      // en función de la fila real disponible. Reduce ventana de race condition.
      return GraphClient.get(
        sheetUrl + '/usedRange(valuesOnly=true)?$select=address,rowCount',
        window.SCOPES || undefined, {}
      ).then(function(range) {
        var rowCount = (range && range.rowCount ? Number(range.rowCount) : 1);
        var startRow = rowCount + 1; // primera fila libre
        // id_log basado en la fila real: fila 2 = id_log 1, fila N = id_log N-1
        // Si _lastIdLog conocido > rowCount-1, usar _lastIdLog+1 (protege contra lecturas cacheadas)
        var idBaseline = Math.max(rowCount - 1, _lastIdLog || 0);
        entries.forEach(function(e, i) {
          e.id_log = idBaseline + 1 + i;
        });
        _lastIdLog = idBaseline + entries.length;

        // Construir rows en el orden exacto de HEADERS
        var rows = entries.map(function(e) {
          return HEADERS.map(function(h) { return e[h] != null ? e[h] : ''; });
        });
        var endRow  = startRow + rows.length - 1;
        var endCol  = _colLetter(HEADERS.length - 1);
        var address = 'A' + startRow + ':' + endCol + endRow;
        var patchUrl = sheetUrl + '/range(address=\'' + address + '\')';
        // UN SOLO PATCH para todo el batch (TASK 03 aprobado)
        return GraphClient.patch(patchUrl, { values: rows }, window.SCOPES || undefined, {})
          .then(function() {
            return { ok: true, written: rows.length, skipped: 0, address: address };
          });
      }).catch(function(err) {
        console.warn('[AuditService] flushBatch falló:', err && err.message);
        if (!isDrain) _enqueueOffline(entries);
        return { ok: false, written: 0, skipped: entries.length, error: err && err.message };
      });
    });
  }

  function _colLetter(idx) {
    var s = '';
    do { s = String.fromCharCode(65 + (idx % 26)) + s; idx = Math.floor(idx / 26) - 1; } while (idx >= 0);
    return s;
  }

  // ── Diagnóstico ─────────────────────────────────────────────────────
  function _diag() {
    return {
      hasSession:      !!_currentSession,
      sessionId:       _currentSession ? _currentSession.sessionId : null,
      bufferSize:      _currentSession ? _currentSession.buffer.length : 0,
      lastIdLog:       _lastIdLog,
      version:         _getVersionTag(),
      user:            _getUserLabel(),
      userObjectId:    _getUserObjectId(),         // TASK 06
      offlineQueueSize:_readOfflineQueue().length, // TASK 05
      isDraining:      _draining
    };
  }

  return {
    startSession:        startSession,
    log:                 log,
    finishSession:       finishSession,
    abortSession:        abortSession,       // TASK 04
    logSystemEvent:      logSystemEvent,
    drainOfflineQueue:   drainOfflineQueue,  // TASK 05
    _diag:               _diag,
    ACTIONS:             VALID_ACTIONS.slice(),
    ORIGINS:             VALID_ORIGINS.slice(),
    ACTION_ALIASES:      Object.freeze({...ACTION_ALIASES})
  };
})();
window.AuditService = AuditService;
