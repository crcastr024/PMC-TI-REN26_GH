// ════════════════════════════════════════════════════════════════════
// js/provider.js — PMC-TI-REN26 GH1
// TableRegistry, ExcelMapper, WorkbookLoader, ExcelProvider, Write stack
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// js/provider.js — PMC-TI-REN26 GH1
// TableRegistry, ExcelMapper, WorkbookLoader, ExcelProvider, SyncManager, RefreshManager, ConflictDetector
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

const TableRegistry = {
  RENOVACIONES:   'PMC_RENOVACIONES',
  INVENTARIO:     'PMC_INVENTARIO',
  USUARIOS:       'PMC_USUARIOS',
  ROLES:          'PMC_ROLES',
  ROLES_PERMISOS: 'PMC_ROLES_PERMISOS',
  // GH3.18: CONFIG / PMC_CONFIG eliminado — tabla no existe y era dead code
  AUDITORIA:      'PMC_AUDITORIA',
  NOTIFICACIONES: 'PMC_NOTIFICACIONES',
  META:           'PMC_META',
};
window.TableRegistry = TableRegistry;

// ────────────────────────────────────────────────────────────────────
// MVP · ExcelMapper — matrix[][] ↔ JSON (sin reglas de negocio)
// ────────────────────────────────────────────────────────────────────
const ExcelMapper = (() => {
  // Normalizar un valor crudo de Excel al tipo correspondiente
  function castValue(raw, colName) {
    if (raw === null || raw === undefined || raw === '') return '';
    const s = String(raw).trim();
    if (s === '' || s.toLowerCase() === 'null') return '';
    // Booleanos
    if (s.toUpperCase() === 'TRUE'  || s === '1') return true;
    if (s.toUpperCase() === 'FALSE' || s === '0') {
      // Sólo cast a false si la columna es conocidamente booleana
      const boolCols = ['ACTA_ENVIADA','ACTA_FIRMADA','ES_BACKUP','FEEDBACK_RECIBIDO',
        'EVIDENCIA_ADJUNTA','BLOCKED','AUNTRABAJA','AUN_TRABAJA',
        '_DELETED','DEVUELTO','FEEDBACK_ENVIADO'];
      if (boolCols.some(b => colName && colName.toUpperCase().includes(b.replace('_','')))) return false;
    }
    // Número
    if (!isNaN(Number(s)) && s !== '') {
      const n = Number(s);
      // Solo cast numérico para columnas claramente numéricas
      const numCols = ['ID','FEEDBACK','_VERSION'];
      if (numCols.some(c => colName && colName.toUpperCase() === c)) return n;
    }
    return s;
  }

  return {
    /**
     * Convierte matrix[][] (headers en fila 0) a array de objetos JSON.
     * Los nombres de las columnas Excel se pasan a minúsculas para coincidir
     * con el schema del Dashboard.
     */
    toJson(headers, rows) {
      if (!Array.isArray(headers) || !Array.isArray(rows)) return [];
      return rows.map((row, rowIdx) => {
        const obj = {};
        headers.forEach((h, colIdx) => {
          if (!h) return;
          const field = String(h).trim().toLowerCase();
          obj[field] = castValue(row[colIdx], h);
        });
        return obj;
      }).filter(obj => {
        // Filtrar filas completamente vacías
        return Object.values(obj).some(v => v !== '' && v !== null && v !== undefined);
      });
    },

    /**
     * Convierte un objeto JSON a una fila de valores según los headers.
     * Usado por WorkbookWriter para construir el valor de cada celda.
     */
    toRow(record, headers) {
      return headers.map(h => {
        if (!h) return null;
        const field = String(h).trim().toLowerCase();
        const val = record[field];
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'boolean') return val ? 'SI' : 'NO';
        return val;
      });
    },

    /**
     * Calcula la letra de columna Excel (A, B, ..., Z, AA, AB, ...)
     * a partir de un índice 0-basado.
     */
    columnLetter(index) {
      let result = '';
      let i = index + 1;
      while (i > 0) {
        const mod = (i - 1) % 26;
        result = String.fromCharCode(65 + mod) + result;
        i = Math.floor((i - 1) / 26);
      }
      return result;
    },
  };
})();
window.ExcelMapper = ExcelMapper;

// ────────────────────────────────────────────────────────────────────
// MVP · WorkbookLoader — única puerta de entrada al Excel
// Lee tablas PMC_* via Graph API. No transforma ni normaliza datos.
// ────────────────────────────────────────────────────────────────────
const WorkbookLoader = (() => {
  // ── GH2.5: _getIds() — leer de GraphResolver (memoria) o fallback mock ──
  // En producción: GraphResolver.resolveAll() ya fue llamado por BootstrapManager
  // En mock mode: retorna strings vacíos (flujo mock no llega aquí)
  function _getIds() {
    if (typeof GraphResolver !== 'undefined' && GraphResolver.isResolved()) {
      return GraphResolver.getCache();  // IDs en memoria — no en config.js
    }
    // Fallback para mock mode y tests (driveId/itemId no vienen de config en prod)
    const PC = window.PRODUCTION_CONFIG || {};
    const sp = (window.APP_CONFIG && window.APP_CONFIG.sharePoint) || {};
    return {
      driveId: PC.driveId || sp.driveId || '',
      itemId:  PC.itemId  || sp.itemId  || '',
      siteId:  PC.siteId  || '',
    };
  }

  // Base path para el workbook — construido con IDs resueltos por GraphResolver
  function workbookBase() {
    const { driveId, itemId } = _getIds();
    if (!driveId || !itemId) return null;
    return `/drives/${driveId}/items/${itemId}/workbook`;
  }

  // RC1 GL-3: health check rápido del workbook
  async function checkHealth() {
    const { driveId, itemId } = _getIds();
    if (!driveId || !itemId) return { ok: false, reason: 'EXCEL_NOT_CONFIGURED', configured: false };
    try {
      const meta = await GraphClient.get(
        `/drives/${driveId}/items/${itemId}`,
        SCOPES
      );
      return { ok: true, eTag: meta && meta.eTag, name: meta && meta.name, lastModified: meta && meta.lastModifiedDateTime };
    } catch(e) {
      return { ok: false, reason: e.graphCode || e.code || e.message, httpStatus: e.httpStatus };
    }
  }

  const SCOPES = ['User.Read', 'Files.ReadWrite.All'];

  /**
   * Carga una tabla completa: headers (row 0) + datos.
   * Retorna: { headers: string[], rows: any[][] }
   */
  async function loadTable(tableName) {
    const base = workbookBase();
    if (!base) throw new Error('[WorkbookLoader] driveId o itemId no configurados');
    // GET /workbook/tables/{name}/range → values[0] = headers, values[1..] = datos
    const resp = await GraphClient.get(`${base}/tables/${tableName}/range`, SCOPES);
    if (!resp || !resp.values || resp.values.length === 0) {

      return { headers: [], rows: [] };
    }
    const headers = resp.values[0].map(h => String(h || '').trim());
    const rows    = resp.values.slice(1);
    return { headers, rows };
  }

  /**
   * Carga solo columnas específicas de una tabla (para delta sync eficiente).
   * Retorna: { headers: string[], rows: any[][] }
   */
  async function loadColumns(tableName, colNames) {
    const base = workbookBase();
    if (!base) throw new Error('[WorkbookLoader] driveId o itemId no configurados');
    const { headers, rows } = await loadTable(tableName);
    // Filtrar a solo las columnas solicitadas
    const indices = colNames.map(c => headers.findIndex(h => h.toUpperCase() === c.toUpperCase()))
                            .filter(i => i >= 0);
    const filteredHeaders = indices.map(i => headers[i]);
    const filteredRows    = rows.map(row => indices.map(i => row[i]));
    return { headers: filteredHeaders, rows: filteredRows };
  }

  /**
   * Obtiene metadata del workbook (eTag, lastModified).
   * Usado por SynchronizationManager para detección de cambios.
   */
  async function getWorkbookMeta() {
    const { driveId, itemId } = _getIds();
    if (!driveId || !itemId) return null;
    return GraphClient.get(`/drives/${driveId}/items/${itemId}`, SCOPES);
  }

  /**
   * Verifica que las tablas PMC_* existen en el workbook.
   * Retorna: { ok: boolean, missing: string[], found: string[] }
   */
  async function validateStructure() {
    const base = workbookBase();
    if (!base) return { ok: false, missing: Object.values(TableRegistry), found: [] };
    let allTables = [];
    try {
      const resp = await GraphClient.get(`${base}/tables`, SCOPES);
      allTables = (resp && resp.value || []).map(t => t.name);
    } catch(e) { return { ok: false, error: e.message, missing: Object.values(TableRegistry), found: [] }; }
    const required = [TableRegistry.RENOVACIONES, TableRegistry.INVENTARIO, TableRegistry.USUARIOS];
    const missing  = required.filter(t => !allTables.includes(t));
    return { ok: missing.length === 0, missing, found: allTables };
  }

  return {
    loadTable,
    loadColumns,
    getWorkbookMeta,
    validateStructure,
    workbookBase,
    checkHealth,
    _scopes: SCOPES,
  };
})();
window.WorkbookLoader = WorkbookLoader;

// ────────────────────────────────────────────────────────────────────
// MVP · ExcelProvider — implementa IDataProvider sobre el Excel Maestro
// ────────────────────────────────────────────────────────────────────
const ExcelProvider = (() => {
  let _connected = false;

  // GH3.20: único criterio de disponibilidad del Excel — arquitectura GH2.5
  // WorkbookLoader y ExcelProvider comparten el mismo origen de verdad: GraphResolver.
  // APP_CONFIG.sharePoint.driveId/itemId no existen desde GH2.5 (ver diagnóstico GH3.19).
  function isExcelReady() {
    return typeof GraphResolver !== 'undefined' && GraphResolver.isResolved();
  }

  return {
    name:   'ExcelProvider',
    source: 'excel://Plan_Maestro_REN26_FINAL.xlsx',

    async initialize() {
      if (!GraphClient._isInitialized()) GraphClient.initialize();

      return true;
    },

    async connect() {
      if (!isExcelReady()) {

        return { connected: false, reason: 'EXCEL_NOT_CONFIGURED' };
      }
      try {
        const meta = await WorkbookLoader.getWorkbookMeta();
        _connected = !!meta;
        EventBus.publish('provider.connected', { name: this.name, mode: 'excel' });
        return { connected: _connected };
      } catch(e) {
        _connected = false;
        return { connected: false, error: e.message };
      }
    },

    isConnected() { return _connected; },

    async health() {
      try {
        const meta = await WorkbookLoader.getWorkbookMeta();
        return { healthy: !!meta, timestamp: Date.now() };
      } catch(e) { return { healthy: false, error: e.message }; }
    },

    /**
     * Carga todos los datos del Excel.
     * Si no está configurado el Excel: fallback a PMC_DATA embebido.
     */
    async loadData() {
      const isDebug = !!(window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.debug)
                   || !!(window.APP_CONFIG && window.APP_CONFIG.debug);

      if (!isExcelReady()) {
        if (isDebug) {

          return window.PMC_DATA || {};
        }
        // Producción: sin fallback automático. El error se propaga al boot().
        const err = new Error('[ExcelProvider] driveId / itemId no configurados. Completar PRODUCTION_CONFIG antes del Go Live.');
        err.code = 'EXCEL_NOT_CONFIGURED';
        err.retryable = false;
        throw err;
      }

      const t0 = Date.now();
      try {
        // Orden obligatorio: CONFIG → USUARIOS → INVENTARIO → RENOVACIONES
        const [
          metaResult,
          // GH3.22: configResult eliminado — coincide con los 5 promises del array
          usuariosResult,
          rolesResult,
          inventarioResult,
          renovacionesResult,
        ] = await Promise.allSettled([
          WorkbookLoader.loadTable(TableRegistry.META).catch(() => ({ headers: [], rows: [] })),
          // GH3.18: PMC_CONFIG eliminado — TableRegistry.CONFIG ya no existe
          WorkbookLoader.loadTable(TableRegistry.USUARIOS).catch(() => ({ headers: [], rows: [] })),
          WorkbookLoader.loadTable(TableRegistry.ROLES).catch(() => ({ headers: [], rows: [] })),
          WorkbookLoader.loadTable(TableRegistry.INVENTARIO).catch(() => ({ headers: [], rows: [] })),
          WorkbookLoader.loadTable(TableRegistry.RENOVACIONES),
        ]);

        function unwrap(r, fallback) {
          return r.status === 'fulfilled' ? r.value : { headers: [], rows: [] };
        }

        // GH3.18: configResult eliminado
        const usuarios  = unwrap(usuariosResult);
        const roles     = unwrap(rolesResult);
        const inv       = unwrap(inventarioResult);
        const ren       = unwrap(renovacionesResult);

        // Mapear con ExcelMapper
        const renovaciones    = ExcelMapper.toJson(ren.headers,      ren.rows);
        const inventario      = ExcelMapper.toJson(inv.headers,      inv.rows);
        const usuarios_sis    = ExcelMapper.toJson(usuarios.headers, usuarios.rows);
        // GH3.18: configuracion eliminado
        const rolesData       = ExcelMapper.toJson(roles.headers,    roles.rows);

        // Cachear headers para WorkbookWriter
        window._EXCEL_HEADERS = { RENOVACIONES: ren.headers, INVENTARIO: inv.headers };



        return {
          renovaciones,
          inventario_equipos: inventario,
          usuarios_sistema:   usuarios_sis.map(u => ({
            id_usuario: u.id_usuario || u.id,
            nombre:     u.nombre || u.name,
            correo:     u.correo || u.email,
            rol:        u.rol || u.role,
            estado:     u.estado || 'Activo',
          })),
          roles:           rolesData,
          roles_permisos:  [],
          configuracion:   [],  // GH3.18: eliminado
          auditoria:       [],
          notificaciones:  [],
        };
      } catch(err) {
        console.error('[ExcelProvider] loadData() error:', err.graphCode || err.code || err.message);
        EventBus.publish('provider.sync.failed', { error: err.message, code: err.code });
        const isDebug = !!(window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.debug)
                     || !!(window.APP_CONFIG && window.APP_CONFIG.debug);
        if (isDebug) {

          return window.PMC_DATA || {};
        }
        // Producción: propagar el error al boot() para mostrar pantalla de error
        throw err;
      }
    },

    async getRenovaciones()    { const d = await this.loadData(); return d.renovaciones || []; },
    async getInventario()      { const d = await this.loadData(); return d.inventario_equipos || []; },
    async getUsuariosSistema() { const d = await this.loadData(); return d.usuarios_sistema || []; },
    async getRoles()           { const d = await this.loadData(); return d.roles || []; },
    async getConfiguracion()   { const d = await this.loadData(); return d.configuracion || []; },

    /**
     * Escribe cambios de un registro en el Excel.
     * Delega a WorkbookWriter.
     */
    async writeRecord(id, changes) {
      return WorkbookWriter.writeRecord(id, changes);
    },
  };
})();
window.ExcelProvider = ExcelProvider;

// ────────────────────────────────────────────────────────────────────
// MVP · WriteLock — lock por registro para evitar escrituras simultáneas
// ────────────────────────────────────────────────────────────────────
const WriteLock = (() => {
  const _locks = new Map(); // id → { acquiredAt, resolve[] }
  return {
    async acquire(id, timeoutMs = 10000) {
      if (!_locks.has(id)) { _locks.set(id, null); return true; }
      // Esperar a que se libere (cola de promesas)
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        const check = setInterval(() => {
          if (!_locks.has(id) || _locks.get(id) === null) {
            clearInterval(check); clearTimeout(timer);
            _locks.set(id, null);
            resolve(true);
          }
        }, 100);
      });
    },
    release(id) { _locks.delete(id); },
    isLocked(id) { return _locks.has(id); },
    forceRelease(id) { _locks.delete(id); },
  };
})();
window.WriteLock = WriteLock;

// ────────────────────────────────────────────────────────────────────
// MVP · WriteQueue — cola de escrituras para offline y throttle
// ────────────────────────────────────────────────────────────────────
const WriteQueue = (() => {
  const _queue   = [];
  const _failed  = [];
  let   _flushing = false;

  return {
    enqueue(id, changes, user) {
      _queue.push({ id, changes, user: user || (window.state && state.user), ts: Date.now(), attempts: 0 });
      EventBus.publish('write.started', { id, fields: Object.keys(changes) });
    },
    async flush() {
      if (_flushing || _queue.length === 0) return;
      _flushing = true;
      while (_queue.length > 0) {
        const item = _queue.shift();
        try {
          await WorkbookWriter.writeRecord(item.id, item.changes);
          EventBus.publish('write.finished', { id: item.id });
        } catch(e) {
          item.attempts++;
          if (item.attempts < 3 && e.retryable !== false) {
            _queue.push(item);
          } else {
            _failed.push({ ...item, error: e.message });
            EventBus.publish('write.failed', { id: item.id, error: e.message, retryable: false });
          }
        }
      }
      _flushing = false;
    },
    getPending()  { return _queue.slice(); },
    getFailed()   { return _failed.slice(); },
    clear()       { _queue.length = 0; _failed.length = 0; },
  };
})();
window.WriteQueue = WriteQueue;

// ────────────────────────────────────────────────────────────────────
// MVP · WorkbookWriter — escribe celdas específicas en el Excel
// Stage 1: Validación → 2: OptimisticUpdate → 3: Lock → 4: VersionCheck
// → 5: Session → 6: PATCH → 7: CloseSession → 8: PostCommit
// ────────────────────────────────────────────────────────────────────
const WorkbookWriter = (() => {
  const SCOPES = ['User.Read', 'Files.ReadWrite.All'];

  function workbookBase() {
    return WorkbookLoader.workbookBase();
  }

  async function acquireSession() {
    const base = workbookBase();
    if (!base) throw new Error('[WorkbookWriter] workbook no configurado');
    const resp = await GraphClient.post(`${base}/createSession`, { persistChanges: true }, SCOPES);
    return resp && resp.id;
  }

  async function closeSession(sessionId) {
    if (!sessionId) return;
    const base = workbookBase();
    try {
      await GraphClient.delete(`${base}/sessions/${sessionId}`, SCOPES);
    } catch(e) { console.warn('[WorkbookWriter] closeSession error (ignorado):', e.message); }
  }

  /**
   * Escribe los campos de un registro en la tabla PMC_RENOVACIONES.
   * Solo escribe campos autorizados por WriteContract.
   */
  async function writeRecord(id, changes) {
    // Stage 1: Filtrar y validar (SIEMPRE — incluso en mock)
    const safeChanges = WriteContract.filterWritable(changes);
    if (Object.keys(safeChanges).length === 0) {
      return { ok: true, noChanges: true };
    }

    // Stage 2 (siempre, incluso en mock): validar RBAC y reglas de negocio
    const validation = GraphWriteValidator.validate(safeChanges, DataService.getRenewal(id), window.state && state.user);
    if (!validation.valid) {
      const err = new Error('[WorkbookWriter] validación fallida: ' + validation.errors.map(e => e.message).join('; '));
      err.retryable = false;
      throw err;
    }

    if (!workbookBase()) {
      // Modo mock: solo en memoria, sin escritura real

      return { ok: true, mock: true };
    }
    if (Object.keys(safeChanges).length === 0) {

      return { ok: true, noChanges: true };
    }

    // validation ya ejecutado en Stage 2
    // Stage 3: Lock
    const locked = await WriteLock.acquire(id);
    if (!locked) throw new Error('[WorkbookWriter] timeout esperando lock para id=' + id);

    let sessionId = null;
    const t0 = Date.now();

    try {
      // Stage 3: Obtener headers para calcular posiciones de columnas
      const headers = (window._EXCEL_HEADERS && window._EXCEL_HEADERS.RENOVACIONES) || [];
      if (headers.length === 0) throw new Error('[WorkbookWriter] headers no cargados — llama loadData() primero');

      // Row number en Excel: row 1 = headers, row 2 = id=1, row N+1 = id=N
      const rowNum = id + 1;

      // Construir lista de { cellAddress, value }
      const cellUpdates = [];
      const user = (window.state && state.user) || { name: 'sistema', email: 'sistema' };
      const now  = new Date().toISOString();

      // Campos del usuario
      Object.entries(safeChanges).forEach(([field, value]) => {
        const colIdx = headers.findIndex(h => String(h).trim().toLowerCase() === field.toLowerCase());
        if (colIdx < 0) { console.warn('[WorkbookWriter] columna no encontrada:', field); return; }
        cellUpdates.push({
          address: `${ExcelMapper.columnLetter(colIdx)}${rowNum}`,
          value: value === null || value === undefined || value === '' ? null : value,
        });
      });

      // Campos de control automáticos: _VERSION += 1, _UPDATED_AT, _UPDATED_BY
      const versionIdx = headers.findIndex(h => String(h).trim().toUpperCase() === '_VERSION');
      const updAtIdx   = headers.findIndex(h => String(h).trim().toUpperCase() === '_UPDATED_AT');
      const updByIdx   = headers.findIndex(h => String(h).trim().toUpperCase() === '_UPDATED_BY');

      if (versionIdx >= 0) {
        const record = DataService.getRenewal(id);
        const currentVersion = (record && record._version) ? Number(record._version) : 0;
        cellUpdates.push({ address: `${ExcelMapper.columnLetter(versionIdx)}${rowNum}`, value: currentVersion + 1 });
        // Actualizar en memoria también
        if (record) record._version = currentVersion + 1;
      }
      if (updAtIdx >= 0) cellUpdates.push({ address: `${ExcelMapper.columnLetter(updAtIdx)}${rowNum}`, value: now });
      if (updByIdx >= 0) cellUpdates.push({ address: `${ExcelMapper.columnLetter(updByIdx)}${rowNum}`, value: user.email || user.name });

      if (cellUpdates.length === 0) return { ok: true, noChanges: true };

      // Stage 4: Adquirir sesión
      sessionId = await acquireSession();
      const sessionHeaders = { 'workbook-session-id': sessionId };

      // Stage 5: PATCH cada celda — con workbook-session-id para sesión persistente
      const base = workbookBase();
      const sheetName = 'RENOVACIONES';
      for (const upd of cellUpdates) {
        await GraphClient.patch(
          `${base}/worksheets/${sheetName}/range(address='${upd.address}')`,
          { values: [[upd.value]] },
          SCOPES,
          sessionHeaders   // GH3.22 P2: inyectar workbook-session-id en cada PATCH
        );
      }

      // Stage 6: Cerrar sesión
      await closeSession(sessionId);
      sessionId = null;

      // Stage 7: Post-commit
      WriteLock.release(id);
      GraphCache.invalidate('graph_pmc_data');
      EventBus.publish('renewal.updated',         { id, changes: safeChanges, source: 'server' });
      EventBus.publish('provider.write.success',  { id, fields: Object.keys(safeChanges), duration: Date.now()-t0 });

      const duration = Date.now()-t0;


      return { ok: true, cellsWritten: cellUpdates.length, duration: Date.now()-t0 };

    } catch(err) {
      // Rollback: limpiar sesión y lock
      if (sessionId) await closeSession(sessionId).catch(() => {});
      WriteLock.forceRelease(id);
      EventBus.publish('provider.write.failed', { id, error: err.graphCode || err.message, retryable: err.retryable !== false });
      throw err;
    }
  }

  return { writeRecord, acquireSession, closeSession };
})();
window.WorkbookWriter = WorkbookWriter;

// ────────────────────────────────────────────────────────────────────
