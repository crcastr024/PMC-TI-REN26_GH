// ════════════════════════════════════════════════════════════════════
// js/sync.js — PMC-TI-REN26 GH1
// ViewModelRegistry, RefreshManager, SynchronizationManager
// ════════════════════════════════════════════════════════════════════

// MVP · ViewModelRegistry — Observer Pattern para refresh parcial
// ────────────────────────────────────────────────────────────────────
const ViewModelRegistry = (() => {
  const _observers = new Map(); // key → Set<{update, dispose}>
  return {
    register(key, observer) {
      if (!_observers.has(key)) _observers.set(key, new Set());
      _observers.get(key).add(observer);
      return () => { const s = _observers.get(key); if (s) s.delete(observer); };
    },
    notify(key, data) {
      const observers = _observers.get(key);
      if (!observers) return;
      observers.forEach(obs => { try { obs.update(data); } catch(e) { console.error('[VMR]', key, e); } });
    },
    notifyAll() {
      const all = DataService.getRenewals({});
      _observers.forEach((observers, key) => {
        if (key === 'renovaciones:all' || key === 'kpis') {
          observers.forEach(obs => { try { obs.update(all); } catch(e) { /* intentional: sync error no bloquea la UI */ } });
        }
      });
    },
    dispose(key) { _observers.delete(key); },
    clear()      { _observers.clear(); },
  };
})();
window.ViewModelRegistry = ViewModelRegistry;

// ────────────────────────────────────────────────────────────────────
// MVP · RefreshManager — actualización incremental del UI sin reload
// ────────────────────────────────────────────────────────────────────
const RefreshManager = (() => {
  function refreshRecord(id) {
    const record = DataService.getRenewal(id);
    if (!record) return;
    ViewModelRegistry.notify('renovacion:' + id, record);
    ViewModelRegistry.notify('renovaciones:all', DataService.getRenewals({}));
    ViewModelRegistry.notify('kpis', null);
    // Actualizar fila en la vista activa (compatibilidad con renderizado actual)
    if (window.state && state.view) {
      try {
        if (state.view === 'usuarios')     renderUsuarios  && renderUsuarios();
        else if (state.view === 'tecnicos')     renderTecnicos  && renderTecnicos();
        else if (state.view === 'resumen')      renderResumen   && renderResumen();
        else if (state.view === 'home-tecnico') renderHomeTecnico && renderHomeTecnico();
      } catch(e) { /* vista no está activa */ }
    }
  }

  function refreshRecords(ids) {
    if (!ids || ids.length === 0) return;
    ids.forEach(id => refreshRecord(id));
  }

  function refreshKPIs() {
    ViewModelRegistry.notify('kpis', null);
    try { if (window.renderResumen) renderResumen(); } catch(e) { /* intentional: sync error no bloquea la UI */ }
  }

  function refreshAll() {
    ViewModelRegistry.notifyAll();
    if (window.state && window.renderView) {
      try { renderView(state.view); } catch(e) { /* intentional: sync error no bloquea la UI */ }
    }
  }

  // Suscribirse a eventos relevantes
  EventBus.subscribe('provider.refresh', (e) => { refreshRecords(e && e.changedIds || []); });
  EventBus.subscribe('renewal.updated',  (e) => { if (e && e.id) refreshRecord(e.id); });

  return { refreshRecord, refreshRecords, refreshKPIs, refreshAll };
})();
window.RefreshManager = RefreshManager;

// ────────────────────────────────────────────────────────────────────
// MVP · SynchronizationManager — polling cada 10s, delta por _VERSION
// ────────────────────────────────────────────────────────────────────
const SynchronizationManager = (() => {
  let _timer         = null;
  let _lastETag      = null;
  let _running       = false;
  let _tickActive    = false;   // RC-06/07 TASK 9: lock global
  let _pendingTick   = null;    // RC-07 TASK 7: debounce requestTick
  let _versionCache  = {};      // id → VERSION (columna Excel)
  let _lastActivity  = 0;       // RC-07 TASK 6: timestamp última actividad
  // RC-1 Fix: detección de modo offline
  let _failStreak    = 0;       // fallos consecutivos de red
  const FAIL_OFFLINE_THRESHOLD = 3;     // después de 3 fallos → offline mode
  const INTERVAL_OFFLINE       = 300000; // 5 min — espera entre reintentos offline
  // RC-07 TASK 6 — Intervalos adaptativos
  var INTERVAL_INACTIVE = 60000;  // 60s — usuario inactivo
  var INTERVAL_ACTIVE   = 15000;  // 15s — actividad reciente (< 2 min)
  var INTERVAL_HIDDEN   = 120000; // 120s — pestaña oculta
  function _getInterval() {
    if (_failStreak >= FAIL_OFFLINE_THRESHOLD) return INTERVAL_OFFLINE; // modo offline
    if (typeof document !== 'undefined' && document.hidden) return INTERVAL_HIDDEN;
    if (Date.now() - _lastActivity < 120000) return INTERVAL_ACTIVE;
    return INTERVAL_INACTIVE;
  }

  function isExcelMode() {
    return (window.APP_CONFIG && window.APP_CONFIG.dataSource === 'excel')
      && (window.APP_CONFIG.authenticationMode === 'msal');
  }

  async function tick() {
    if (_running) return;
    if (_tickActive) return; // RC-06 TASK 6: lock global
    _running = true;
    _tickActive = true;
    try {
      EventBus.publish('provider.sync.started', { timestamp: Date.now() });

      if (!isExcelMode()) { _running = false; return; }

      // Nivel 1: Verificar eTag del workbook
      const meta = await WorkbookLoader.getWorkbookMeta().catch(() => null);
      if (!meta) { _running = false; return; }

      const currentETag = meta.eTag || meta['@odata.etag'] || null;
      if (currentETag && currentETag === _lastETag) {
        // Sin cambios
        EventBus.publish('provider.sync.finished', { changedIds: [], duration: 0, timestamp: Date.now() });
        _running = false;
        return;
      }
      _lastETag = currentETag;

      // Nivel 2: Descargar solo columnas ID + _VERSION
      const { headers, rows } = await WorkbookLoader.loadColumns(
        TableRegistry.RENOVACIONES, ['ID', 'VERSION']
      ).catch(() => ({ headers: [], rows: [] }));

      if (headers.length === 0) { _running = false; return; }

      const idIdx  = headers.findIndex(h => h.toUpperCase() === 'ID');
      const verIdx = headers.findIndex(h => h.toUpperCase() === 'VERSION');

      const changedIds = [];
      rows.forEach(row => {
        const id  = Number(row[idIdx]);
        const ver = Number(row[verIdx] || 0);
        if (!id) return;
        if (_versionCache[id] !== undefined && _versionCache[id] !== ver) {
          changedIds.push(id);
        }
        _versionCache[id] = ver;
      });

      if (changedIds.length === 0) {
        EventBus.publish('provider.sync.finished', { changedIds: [], duration: 0, timestamp: Date.now() });
        _running = false;
        return;
      }



      // Nivel 3: Descargar solo las filas modificadas y actualizar memoria
      const { headers: allHeaders, rows: allRows } = await WorkbookLoader.loadTable(
        TableRegistry.RENOVACIONES
      ).catch(() => ({ headers: [], rows: [] }));

      if (allHeaders.length > 0) {
        const allRecords = ExcelMapper.toJson(allHeaders, allRows);
        changedIds.forEach(id => {
          const newRecord = allRecords.find(r => Number(r.id) === id);
          if (!newRecord) return;
          const idx = window.USERS.findIndex(u => u.id === id);
          if (idx >= 0) {
            // Preservar campos runtime antes de sobrescribir
            const runtime = {
              audit: window.USERS[idx].audit,
              timeline: window.USERS[idx].timeline,
              approval: window.USERS[idx].approval,
              equipoAnterior: null, equipoNuevo: null,
            };
            Object.assign(window.USERS[idx], newRecord, runtime);
            normalizeRecord_F3(window.USERS[idx]);
          }
        });
        // Actualizar cache de versiones
        allHeaders.forEach((h, colIdx) => {
          if (h.toUpperCase() === 'VERSION') {
            allRows.forEach((row) => {
              const idColIdx = allHeaders.findIndex(h2 => h2.toUpperCase() === 'ID');
              if (idColIdx >= 0) _versionCache[Number(row[idColIdx])] = Number(row[colIdx] || 0);
            });
          }
        });
        window._EXCEL_HEADERS = { RENOVACIONES: allHeaders };
        GraphCache.invalidate('graph_pmc_data');
      }

      EventBus.publish('provider.refresh',      { changedIds, timestamp: Date.now() });
      _failStreak = 0; // RC-1 Fix: reset streak tras éxito
      EventBus.publish('provider.sync.finished', { changedIds, timestamp: Date.now() });

    } catch(err) {
      // RC-1 Fix: detectar errores de conectividad para backoff offline
      var isNetErr = err.graphCode === 'NETWORK_ERROR' || err.graphCode === 'DNS_FAILURE' ||
                     err.message.indexOf('ERR_NAME_NOT_RESOLVED') >= 0 ||
                     err.message.indexOf('Failed to fetch') >= 0 ||
                     err.message.indexOf('NETWORK_ERROR') >= 0;
      if (isNetErr) {
        _failStreak++;
        if (_failStreak === 1 || _failStreak % 5 === 0) {
          // Solo loguear en el primero y cada 5 para no inundar la consola
          console.warn('[SyncManager] Sin conectividad con Graph (' + _failStreak + ' intentos). Próximo reintento en ' + (_failStreak >= FAIL_OFFLINE_THRESHOLD ? '5min' : _getInterval()/1000 + 's') + '.');
        }
        if (_failStreak >= FAIL_OFFLINE_THRESHOLD) {
          EventBus.publish('provider.sync.offline', { streak: _failStreak });
        }
      } else {
        _failStreak = 0; // resetear si el error no es de red
        console.error('[SyncManager] tick error:', err.message);
        EventBus.publish('provider.sync.failed', { error: err.message });
      }
    } finally {
      _running = false;
      _tickActive = false; // RC-06 TASK 6: liberar lock
    }
  }

  // RC-07 TASK 6: scheduling adaptativo con setTimeout recursivo
  function _scheduleNext() {
    if (_timer) { clearTimeout(_timer); clearInterval(_timer); } // GH3.5: clearInterval compat
    _timer = setTimeout(async function() { await tick(); _scheduleNext(); }, _getInterval());
  }

  return {
    start() {
      _scheduleNext();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
            if (_timer) clearTimeout(_timer);
            tick().then(function() { _scheduleNext(); });
          }
        });
      }
    },
    stop() {
      if (_timer) clearTimeout(_timer);
      _timer = null;
    },
    tick,
    // RC-07 TASK 7: requestTick con debounce
    requestTick(delayMs) {
      delayMs = typeof delayMs === 'number' ? delayMs : 1500;
      if (_pendingTick) clearTimeout(_pendingTick);
      _pendingTick = setTimeout(function() { _pendingTick = null; tick(); }, delayMs);
    },
    // RC-07 TASK 6: registrar actividad → intervalo activo 15s
    recordActivity() {
      _lastActivity = Date.now();
      if (_timer) {
        clearTimeout(_timer);
        _timer = setTimeout(async function() { await tick(); _scheduleNext(); }, INTERVAL_ACTIVE);
      }
    },
    // RC-07 TASK 3: versión cacheada de un registro (sin llamada Graph)
    getCachedVersion(id) { return _versionCache[Number(id)]; },
    isTickActive:  () => _tickActive,
    isRunning:     () => !!_timer,
    onReconnect: async function() {
      _lastETag = null;
      await WriteQueue.flush();
      await tick();
    },
  };
})();
window.SynchronizationManager = SynchronizationManager;

// ────────────────────────────────────────────────────────────────────
