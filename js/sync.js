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
  let _timer        = null;
  let _lastETag     = null;
  let _running      = false;
  let _interval     = 10000; // 10 segundos (MVP)
  let _versionCache = {};    // id → _version

  function isExcelMode() {
    return (window.APP_CONFIG && window.APP_CONFIG.dataSource === 'excel')
      && (window.APP_CONFIG.authenticationMode === 'msal');
  }

  async function tick() {
    if (_running) return;
    _running = true;
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
        TableRegistry.RENOVACIONES, ['ID', '_VERSION']
      ).catch(() => ({ headers: [], rows: [] }));

      if (headers.length === 0) { _running = false; return; }

      const idIdx  = headers.findIndex(h => h.toUpperCase() === 'ID');
      const verIdx = headers.findIndex(h => h.toUpperCase() === '_VERSION');

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
          if (h.toUpperCase() === '_VERSION') {
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
      EventBus.publish('provider.sync.finished', { changedIds, timestamp: Date.now() });

    } catch(err) {
      console.error('[SyncManager] tick error:', err.message);
      EventBus.publish('provider.sync.failed', { error: err.message });
    } finally {
      _running = false;
    }
  }

  return {
    start(intervalMs) {
      if (intervalMs) _interval = intervalMs;
      if (_timer) clearInterval(_timer);
      _timer = setInterval(tick, _interval);


      // RC1 GL-5: reducir polling cuando el tab está oculto (ahorro de red)
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            if (_timer) clearInterval(_timer);
            _timer = setInterval(tick, _interval * 6); // 60s cuando oculto

          } else {
            if (_timer) clearInterval(_timer);
            _timer = setInterval(tick, _interval);
            tick(); // tick inmediato al volver al tab

          }
        });
      }
    },
    stop() {
      if (_timer) clearInterval(_timer);
      _timer = null;

    },
    tick,
    isRunning:   () => !!_timer,
    setInterval: (ms) => { _interval = ms; },

    onReconnect: async function() {

      _lastETag = null; // forzar recarga
      await WriteQueue.flush();
      await tick();
    },
  };
})();
window.SynchronizationManager = SynchronizationManager;

// ────────────────────────────────────────────────────────────────────
