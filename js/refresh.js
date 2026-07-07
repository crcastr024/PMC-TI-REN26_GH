// ════════════════════════════════════════════════════════════════════
// js/refresh.js — PMC-TI-REN26 GH1
// ConflictDetector, online/offline listeners
// ════════════════════════════════════════════════════════════════════

// MVP · ConflictDetector — detecta escritura concurrente por _VERSION
// ────────────────────────────────────────────────────────────────────
const ConflictDetector = {
  async check(id) {
    if (!(window.APP_CONFIG && window.APP_CONFIG.dataSource === 'excel')) return null;
    try {
      const { headers, rows } = await WorkbookLoader.loadColumns(
        TableRegistry.RENOVACIONES, ['ID', '_VERSION', '_UPDATED_BY']
      );
      const idIdx  = headers.findIndex(h => h.toUpperCase() === 'ID');
      const verIdx = headers.findIndex(h => h.toUpperCase() === '_VERSION');
      const byIdx  = headers.findIndex(h => h.toUpperCase() === '_UPDATED_BY');
      const row = rows.find(r => Number(r[idIdx]) === id);
      if (!row) return null;
      const remoteVersion = Number(row[verIdx] || 0);
      const localRecord   = DataService.getRenewal(id);
      const localVersion  = localRecord ? Number(localRecord._version || 0) : 0;
      if (remoteVersion > localVersion) {
        return {
          conflict: true,
          localVersion,
          remoteVersion,
          updatedBy: row[byIdx] || 'otro usuario',
        };
      }
      return null;
    } catch(e) { return null; }
  },
};
window.ConflictDetector = ConflictDetector;

// Registrar syncToProvider en DataService (escribe al Excel tras updateRenewal)
DataService.syncToProvider = async function(id, changes) {
  const ds = (window.APP_CONFIG && window.APP_CONFIG.dataSource) || 'mock';
  if (ds !== 'excel') return; // mock/json: sin escritura al Excel
  try {
    await ExcelProvider.writeRecord(id, changes);
  } catch(err) {
    console.error('[DataService.syncToProvider]', err.message);
    // Encolar para reintento si es retryable
    if (err.retryable !== false) WriteQueue.enqueue(id, changes, state && state.user);
    throw err;
  }
};

// Conectar red online/offline a SynchronizationManager
window.addEventListener('online',  () => { SynchronizationManager.onReconnect(); });
window.addEventListener('offline', () => { EventBus.publish('network.offline', { timestamp: Date.now() }); });



