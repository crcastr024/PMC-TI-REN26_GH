// ════════════════════════════════════════════════════════════════════
// js/utils.js — PMC-TI-REN26 GH1
// Estado global, EventBus, RBAC, STORAGE, utilidades puras, navegación
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// js/utils.js — PMC-TI-REN26 GH1
// Estado global, EventBus, RBAC, utilidades, notificaciones, UI helpers, navegación
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

// RC3 — js/app.js
// Lógica principal de la aplicación PMC-TI-REN26.
// Requisitos: config.js + msal-browser.min.js + init.js deben cargarse antes.
// No modificar: StateMachine, RBAC, DashboardFactory, WorkbookWriter, WriteContract,
//               GraphWriteValidator, WriteQueue, IDataProvider, normalizeRecord_F3.


'use strict';

const state = {
  view: 'resumen', reportFilter: null, editingId: null, theme: 'light',
  repFilters: { empresa: '', tipo: '', proyecto: '', tecnico: '' },
  notifFilter: 'all', recentlyUpdatedId: null,
  notifications: [],
  settings: {
    toast: true, browser: false, sound: true, highlight: true,
    events: { create: true, edit: true, state: true, acta: true, bodega: true }
  },
  audioCtx: null,
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap = (s) => {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  return s.replace(/(^|[\s\-\.\/])([\p{L}])/gu, (_, sp, c) => sp + c.toUpperCase());
};

// QA-03.1: Backup se detecta únicamente por nombre (sin columna ES_BACKUP)
const isBackup = (r) => !!(r && r.nombre && String(r.nombre).trim().toUpperCase().startsWith('BACKUP'));
window.isBackup = isBackup;

const getReal = () => {
  // STAB-v09.2 ÍTEM 5: técnico solo ve sus propios registros
  var _role      = window.state && state.user && (state.user.role || state.user.rol);
  var _esTecnico = window.state && state.user && state.user.esTecnico;
  var _base = window.USERS.filter(u => !isBackup(u));
  if (_role === 'tecnico' && _esTecnico) {
    return _base.filter(u => (u.tecnico||'').toLowerCase() === _esTecnico.toLowerCase());
  }
  return _base;
};
const getBackup = () => window.USERS.filter(u =>  isBackup(u));

const STORAGE = {
  theme: 'pmc_theme_v8', settings: 'pmc_settings_v8', notifications: 'pmc_notifications_v8'
};

function loadFromStorage(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch(e) { return fallback; }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { /* intentional: localStorage puede no estar disponible (privado) */ }
}


// ═══════════════════════════════════════════════════════════════════
// FOUNDATION LAYER · Fase 1 (invisible refactor)
// DataService · StateMachine · Permissions · Audit · User context
// ═══════════════════════════════════════════════════════════════════

// ─── USER CONTEXT ───
// En producción esto vendrá de Azure AD groups via MSAL.
// GH2.6: valores iniciales genéricos — MSAL los sobreescribe tras el login
state.user = {
  id:    'usuario',
  name:  'Usuario',
  email: 'usuario@empresa.com',
  role:  'visitante', // se resuelve en Bootstrap tras autenticación
};
window.USER = state.user; // legacy alias

// ─── PERMISSIONS · RBAC ───
const PERMISSIONS = {
  super_admin: {
    'renewal.view': true, 'renewal.edit': true, 'renewal.transition': true,
    'renewal.block': true, 'renewal.unblock': true,
    'renewal.create': true, 'renewal.delete': true,
    'renewal.submitApproval': true, 'renewal.approve': true, 'renewal.reject': true,
    'admin.view': true, 'admin.config': true,
    'system.users.crud': true, 'system.roles.crud': true, 'system.config': true,
    'data.restore': true, 'data.master': true,
    'panel.view': false, 'panel.preview': true,
    'audit.view': true, 'audit.export': true,
    'report.view': true, 'kpi.view': true, 'timeline.view': true,
  },
  gestor_activos: {
    'renewal.view': true, 'renewal.edit': true, 'renewal.transition': true,
    'renewal.block': true, 'renewal.unblock': true,
    'renewal.create': true, 'renewal.delete': false,    // no puede eliminar (spec)
    'renewal.submitApproval': true, 'renewal.approve': true, 'renewal.reject': true,
    'admin.view': true, 'admin.config': false,           // config global solo super_admin
    'system.users.crud': false, 'system.roles.crud': false, 'system.config': false,
    'data.restore': false, 'data.master': false,
    'panel.view': false, 'panel.preview': true,          // puede previsualizar Vista de Seguimiento
    'audit.view': true, 'audit.export': true,
    'report.view': true, 'kpi.view': true, 'timeline.view': true,
  },
  tecnico: {
    'renewal.view': true, 'renewal.edit': true, 'renewal.transition': true,
    'renewal.block': true, 'renewal.unblock': true,
    'renewal.create': false, 'renewal.delete': false,
    'renewal.submitApproval': true, 'renewal.approve': false, 'renewal.reject': false,
    'admin.view': false, 'admin.config': false,
    'system.users.crud': false, 'system.roles.crud': false, 'system.config': false,
    'data.restore': false, 'data.master': false,
    'panel.view': false, 'panel.preview': false,
    'audit.view': false, 'audit.export': false,
    'report.view': true, 'kpi.view': true, 'timeline.view': true,
  },
  visitante: {
    'renewal.view': true, 'renewal.edit': false, 'renewal.transition': false,
    'renewal.block': false, 'renewal.unblock': false,
    'renewal.create': false, 'renewal.delete': false,
    'renewal.submitApproval': false, 'renewal.approve': false, 'renewal.reject': false,
    'admin.view': false, 'admin.config': false,
    'system.users.crud': false, 'system.roles.crud': false, 'system.config': false,
    'data.restore': false, 'data.master': false,
    'panel.view': true,      // único rol con Vista de Seguimiento en sidebar
    'panel.preview': false,
    'audit.view': false, 'audit.export': false,
    // F3.7 · Permisos de lectura extendidos para visitante
    'report.view': true,     // puede consultar reportes ejecutivos
    'kpi.view': true,        // puede consultar KPIs y avance general
    'timeline.view': true,   // puede ver línea de tiempo del proyecto
  },
};

function can(action) {
  const role = state.user.role;
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms[action] === true;
}
window.can = can;
window.state = state;  // F3.5 · expuesto para contratos entre módulos y testabilidad

function requirePermission(action) {
  if (!can(action)) {
    toast('Sin permisos para esta acción (rol: ' + state.user.role + ')', 'warning');
    throw new Error('Permission denied: ' + action);
  }
}

// ─── STATE MACHINE · 11 estados + Bloqueado + Corrección ───
// F3.5 · STATES incluye ahora FEEDBACK directamente (antes se asignaba
// dinámicamente en F3 via StateMachine.states.FEEDBACK = 'Feedback').
// Eliminamos la asignación dinámica — la constante es la única fuente.
const STATES = {
  PENDIENTE:                 'Pendiente',
  ALISTAMIENTO:              'Alistamiento',
  PROGRAMADO:                'Programado',
  TRANSITO_NUEVO:            'En tránsito equipo nuevo',
  ENTREGADO_NUEVO:           'Entregado equipo nuevo',
  PENDIENTE_RECOGER:         'Pendiente devolución equipo anterior',
  TRANSITO_ANTERIOR:         'En tránsito equipo anterior',
  RECIBIDO_ANTERIOR:         'Equipo anterior recibido',
  COMPLETADA:                'Renovación completada',
  PENDIENTE_ACTA:            'Pendiente acta',           // GH3.42.8 NUEVO
  PENDIENTE_APROBACION:      'Pendiente aprobación',
  CORRECCION_REQUERIDA:      'Corrección requerida',
  CERRADO:                   'Cerrado',                  // GH3.42.8: mantenido para compat legacy, fuera del flujo activo
  FEEDBACK:                  'Feedback',
  BLOQUEADO:                 'Bloqueado',
  BACKUP:                    'BACKUP',
};

// Lineal happy path — GH3.42.9: Pendiente acta va ANTES de Renovación completada
const STATE_FLOW = [
  STATES.PENDIENTE, STATES.ALISTAMIENTO, STATES.PROGRAMADO,
  STATES.TRANSITO_NUEVO, STATES.ENTREGADO_NUEVO,
  STATES.PENDIENTE_RECOGER, STATES.TRANSITO_ANTERIOR, STATES.RECIBIDO_ANTERIOR,
  STATES.PENDIENTE_ACTA, STATES.COMPLETADA, STATES.PENDIENTE_APROBACION,
];

// Transiciones válidas: cada estado → lista de estados destino permitidos
// F3.5 · TRANSITIONS completa en Foundation. Incluye FEEDBACK y todas las
// transiciones extendidas. Elimina extendTransitions() que redefinía
// nextStates/isValidTransition después de su primera definición.
const TRANSITIONS = {
  [STATES.PENDIENTE]:            [STATES.ALISTAMIENTO, STATES.BLOQUEADO],
  [STATES.ALISTAMIENTO]:         [STATES.PROGRAMADO, STATES.BLOQUEADO],
  [STATES.PROGRAMADO]:           [STATES.TRANSITO_NUEVO, STATES.BLOQUEADO],
  [STATES.TRANSITO_NUEVO]:       [STATES.ENTREGADO_NUEVO, STATES.BLOQUEADO],
  [STATES.ENTREGADO_NUEVO]:      [STATES.PENDIENTE_RECOGER, STATES.BLOQUEADO],
  [STATES.PENDIENTE_RECOGER]:    [STATES.TRANSITO_ANTERIOR, STATES.BLOQUEADO],
  [STATES.TRANSITO_ANTERIOR]:    [STATES.RECIBIDO_ANTERIOR, STATES.BLOQUEADO],
  [STATES.RECIBIDO_ANTERIOR]:    [STATES.PENDIENTE_ACTA, STATES.BLOQUEADO],
  // GH3.42.9: tramo terminal correcto — Pendiente acta → Renovación completada → Pendiente aprobación
  [STATES.PENDIENTE_ACTA]:       [STATES.COMPLETADA, STATES.CORRECCION_REQUERIDA],
  [STATES.COMPLETADA]:           [STATES.PENDIENTE_APROBACION],
  [STATES.PENDIENTE_APROBACION]: [STATES.CORRECCION_REQUERIDA, STATES.FEEDBACK],
  [STATES.FEEDBACK]:             [],
  [STATES.CORRECCION_REQUERIDA]: STATE_FLOW.slice(0, 9),
  [STATES.CERRADO]:              [],
  [STATES.BLOQUEADO]:            STATE_FLOW.slice(0, 9),
  [STATES.BACKUP]:               [],
};

const StateMachine = {
  states: STATES,
  flow: STATE_FLOW,
  TRANSITIONS: TRANSITIONS,  // GH3.30: exportado para GraphWriteValidator y UI
  
  isValidTransition(from, to) {
    if (!from || !to) return false;
    if (from === to) return false;
    const allowed = TRANSITIONS[from] || [];
    return allowed.indexOf(to) >= 0;
  },
  
  nextStates(from) { return TRANSITIONS[from] || []; },
  
  nextInFlow(from) {
    const idx = STATE_FLOW.indexOf(from);
    if (idx < 0 || idx === STATE_FLOW.length - 1) return null;
    return STATE_FLOW[idx + 1];
  },
  
  isClosed(state) { return state === STATES.CERRADO; },
  isBlocked(state) { return state === STATES.BLOQUEADO; },
  isPendingApproval(state) { return state === STATES.PENDIENTE_APROBACION; },
  
  // Backward compat: estados v8 legacy se mapean
  // GH3.22 P4/P9: normalize() — aliases legacy + lookup insensible a mayúsculas
  // Permite que valores del Excel en MAYÚSCULAS (PENDIENTE, BACKUP) se normalicen
  // al valor canónico equivalente del modelo (Pendiente, BACKUP).
  normalize(legacyState) {
    if (!legacyState) return legacyState;
    // 1. Alias legacy explícitos (v8 → nombres completos actuales)
    const map = {
      'En tránsito':  STATES.TRANSITO_NUEVO,
      'Entregado':    STATES.ENTREGADO_NUEVO,
      'Completado':   STATES.CERRADO,
    };
    if (map[legacyState]) return map[legacyState];
    // 2. Exacto ya normalizado
    const canonical = Object.values(STATES);
    if (canonical.indexOf(legacyState) >= 0) return legacyState;
    // 3. Lookup insensible a mayúsculas (PENDIENTE → Pendiente, BACKUP → BACKUP)
    const lower = String(legacyState).toLowerCase();
    const match = canonical.find(s => s.toLowerCase() === lower);
    return match || legacyState;
  },
};
window.StateMachine = StateMachine;

// ─── AUDIT ───
function makeAuditEntry(by, field, before, after, meta) {
  return {
    at: new Date().toISOString(),
    by: by.name || by.id || 'sistema',
    by_id: by.id || null,
    field: field,
    before: before == null ? '' : before,
    after: after == null ? '' : after,
    meta: meta || null,
  };
}

function captureChanges(before, after) {
  const changes = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  allKeys.forEach(k => {
    if (k === 'audit' || k === 'timeline') return; // no auditar la propia auditoría
    const b = before[k], a = after[k];
    // Comparación por valor primitivo
    if (typeof b === 'object' || typeof a === 'object') return;
    if (b !== a) changes.push({ field: k, before: b, after: a });
  });
  return changes;
}

// ─── TIMELINE (eventos del proceso) ───
function makeTimelineEvent(by, from, to, note) {
  return {
    at: new Date().toISOString(),
    by: by.name || by.id || 'sistema',
    by_id: by.id || null,
    from: from || null,
    to: to || null,
    note: note || '',
  };
}

// ─── DATASERVICE · Abstracción intercambiable ───
const DataService = {
  // ── Read ──
  getRenewals(filter) {
    filter = filter || {};
    return window.USERS.filter(u => {
      // F3.9 · Excluir backups por defecto — getRenewals solo retorna registros activos
      if (isBackup(u)) return false; // QA-03.1: backup derivado de nombre
      if (filter.role === 'tecnico' && filter.assignedTo) {
        if ((u.tecnico || '').toLowerCase() !== filter.assignedTo.toLowerCase()) return false;
      }
      if (filter.empresa && u.empresa !== filter.empresa) return false;
      // GH3.37.1 Item 3: normalizar ciudades antes de comparar
      if (filter.ciudad) {
        var normCity = (window.CityNormalizer ? CityNormalizer.normalize(u.ciudad) : u.ciudad);
        var normFilter = (window.CityNormalizer ? CityNormalizer.normalize(filter.ciudad) : filter.ciudad);
        if (normCity !== normFilter) return false;
      }
      if (filter.estado && u.estado !== filter.estado) return false;
      if (filter.blocked === true && !u.blocked) return false;
      if (filter.blocked === false && u.blocked) return false;
      if (filter.excludeBackup && isBackup(u)) return false;
      return true;
    });
  },
  
  getRenewal(id) {
    return window.USERS.find(u => u.id === id) || null;
  },

  // GH3.37.1 Item 6: vista filtrada por rol — técnicos ven solo sus registros
  getVisibleRenewals(filter) {
    filter = filter || {};
    const role = (window.state && state.user && (state.user.role || state.user.rol)) || '';
    if (role === 'tecnico' && !filter._bypass_role_filter) {
      const tecName = (window.state && state.user && (state.user.tecnico || state.user.nombre || state.user.name)) || '';
      return this.getRenewals(Object.assign({}, filter, { role:'tecnico', assignedTo: tecName }));
    }
    return this.getRenewals(filter);
  },
  
  count(filter) { return this.getRenewals(filter).length; },
  
  // ── Mutate (con auditoría automática) ──
  updateRenewal(id, changes, user) {
    user = user || state.user;
    requirePermission('renewal.edit');
    const record = this.getRenewal(id);
    if (!record) throw new Error('Renewal not found: ' + id);
    
    // F3.9 · Lista blanca de campos PROTEGIDOS — nunca se sobrescriben vía changes.
    // audit[], timeline[], approval{} son escritos por los métodos dedicados.
    // clasificacion_obsolescencia y campos RAEE son escritos SOLO por ObsolescenceService.
    // equipoAnterior/equipoNuevo son sub-objetos calculados en runtime.
    const PROTECTED = new Set(['audit','timeline','approval','id',
      'clasificacion_obsolescencia','generacion_cpu','accion_requerida','accion_detalle',
      'estado_eq_ant','clasificacion_raee','_obsolescence_meta',
      'equipoAnterior','equipoNuevo']);
    const safeChanges = {};
    Object.keys(changes).forEach(k => {
      if (!PROTECTED.has(k)) safeChanges[k] = changes[k];
    });
    
    const before = {};
    Object.keys(safeChanges).forEach(k => { before[k] = record[k]; });
    
    const audit = captureChanges(before, safeChanges);
    Object.assign(record, safeChanges);
    this._appendAudit(record, audit.map(c => makeAuditEntry(user, c.field, c.before, c.after)));
    
    // F3 · Reconstruir el modelo normalizado tras cada update
    if (window.RenovacionModel) RenovacionModel.rebuildShape(record);
    
    return { record, audit };
  },
  
  createRenewal(data, user) {
    user = user || state.user;
    requirePermission('renewal.create');
    const maxId = window.USERS.length > 0 ? Math.max.apply(null, window.USERS.map(u => u.id)) : 0;
    const record = Object.assign({
      id: maxId + 1,
      estado: STATES.PENDIENTE, estado_entrega_equipo_nuevo: '',
      audit: [], timeline: [], blocked: false, block_reason: '', block_category: '',
      approval: { status: null, by: null, at: null, reason: '' },
      feedback: 0,
    }, data);
    record.audit.push(makeAuditEntry(user, '_created', null, 'Registro creado'));
    record.timeline.push(makeTimelineEvent(user, null, record.estado, 'Registro creado'));
    // F3 · Construir modelo normalizado al crear
    if (window.RenovacionModel) RenovacionModel.rebuildShape(record);
    window.USERS.push(record);
    return record;
  },
  
  // ── State transitions ──
  transitionState(id, newState, user, opts) {
    user = user || state.user;
    opts = opts || {};
    requirePermission('renewal.transition');
    const record = this.getRenewal(id);
    if (!record) throw new Error('Renewal not found: ' + id);
    
    const from = StateMachine.normalize(record.estado);
    const to = newState;
    
    if (!StateMachine.isValidTransition(from, to)) {
      throw new Error('Transición inválida: ' + from + ' → ' + to);
    }
    
    const before = { estado: record.estado };
    record.estado = to;
    
    this._appendAudit(record, [makeAuditEntry(user, 'estado', from, to, opts.meta)]);
    this._appendTimeline(record, makeTimelineEvent(user, from, to, opts.note || ''));
    
    // Si llegó a Completada, auto-mover a Pendiente Aprobación
    if (to === STATES.COMPLETADA && opts.autoSubmit !== false) {
      record.estado = STATES.PENDIENTE_APROBACION;
      this._appendAudit(record, [makeAuditEntry(user, 'estado', STATES.COMPLETADA, STATES.PENDIENTE_APROBACION, { auto: true })]);
      this._appendTimeline(record, makeTimelineEvent(user, STATES.COMPLETADA, STATES.PENDIENTE_APROBACION, 'Enviada automáticamente a aprobación'));
    }
    
    return record;
  },
  
  // ── Block / Unblock ──
  blockRenewal(id, reason, category, user) {
    user = user || state.user;
    requirePermission('renewal.block');
    const record = this.getRenewal(id);
    if (!record) throw new Error('Renewal not found: ' + id);
    if (!reason) throw new Error('El motivo del bloqueo es obligatorio');
    
    record.block_previous_state = record.estado; // para poder restaurar
    record.block_reason = reason;
    record.block_category = category || 'Otro';
    record.blocked = true;
    record.estado = STATES.BLOQUEADO;
    
    this._appendAudit(record, [
      makeAuditEntry(user, 'estado', record.block_previous_state, STATES.BLOQUEADO),
      makeAuditEntry(user, 'block_reason', '', reason),
    ]);
    this._appendTimeline(record, makeTimelineEvent(user, record.block_previous_state, STATES.BLOQUEADO, '🚧 ' + reason));
    
    return record;
  },
  
  unblockRenewal(id, note, user) {
    user = user || state.user;
    requirePermission('renewal.unblock');
    const record = this.getRenewal(id);
    if (!record) throw new Error('Renewal not found: ' + id);
    if (record.estado !== STATES.BLOQUEADO) throw new Error('El registro no está bloqueado');
    
    const target = record.block_previous_state || STATES.PENDIENTE;
    record.estado = target;
    record.blocked = false;
    
    this._appendAudit(record, [makeAuditEntry(user, 'estado', STATES.BLOQUEADO, target, { unblock: true })]);
    this._appendTimeline(record, makeTimelineEvent(user, STATES.BLOQUEADO, target, '✓ Desbloqueado: ' + (note || '')));
    
    record.block_reason = '';
    record.block_category = '';
    record.block_previous_state = '';
    
    return record;
  },
  
  // ── Approval workflow ──
  submitForApproval(id, user) {
    user = user || state.user;
    requirePermission('renewal.submitApproval');
    return this.transitionState(id, STATES.PENDIENTE_APROBACION, user);
  },
  
  approveRenewal(id, user) {
    user = user || state.user;
    requirePermission('renewal.approve');
    const record = this.getRenewal(id);
    if (!record) throw new Error('Renewal not found: ' + id);
    if (record.estado !== STATES.PENDIENTE_APROBACION) {
      throw new Error('Solo se aprueban renovaciones en estado Pendiente aprobación');
    }
    
    record.estado = STATES.CERRADO;
    record.approval = { status: 'approved', by: user.name, by_id: user.id, at: new Date().toISOString(), reason: '' };
    
    this._appendAudit(record, [makeAuditEntry(user, 'estado', STATES.PENDIENTE_APROBACION, STATES.CERRADO, { approved: true })]);
    this._appendTimeline(record, makeTimelineEvent(user, STATES.PENDIENTE_APROBACION, STATES.CERRADO, '✓ Aprobada'));
    
    return record;
  },
  
  rejectRenewal(id, reason, user) {
    user = user || state.user;
    requirePermission('renewal.reject');
    if (!reason) throw new Error('El motivo del rechazo es obligatorio');
    const record = this.getRenewal(id);
    if (!record) throw new Error('Renewal not found: ' + id);
    if (record.estado !== STATES.PENDIENTE_APROBACION) {
      throw new Error('Solo se rechazan renovaciones en estado Pendiente aprobación');
    }
    
    record.estado = STATES.CORRECCION_REQUERIDA;
    record.approval = { status: 'rejected', by: user.name, by_id: user.id, at: new Date().toISOString(), reason: reason };
    
    this._appendAudit(record, [
      makeAuditEntry(user, 'estado', STATES.PENDIENTE_APROBACION, STATES.CORRECCION_REQUERIDA, { rejected: true }),
      makeAuditEntry(user, 'rejection_reason', '', reason),
    ]);
    this._appendTimeline(record, makeTimelineEvent(user, STATES.PENDIENTE_APROBACION, STATES.CORRECCION_REQUERIDA, '✗ Rechazada: ' + reason));
    
    return record;
  },
  
  // ── Audit accessors ──
  getAuditLog(filter) {
    filter = filter || {};
    const all = [];
    window.USERS.forEach(u => {
      (u.audit || []).forEach(entry => {
        all.push(Object.assign({ recordId: u.id, recordName: u.nombre }, entry));
      });
    });
    let filtered = all;
    if (filter.recordId) filtered = filtered.filter(e => e.recordId === filter.recordId);
    if (filter.by_id) filtered = filtered.filter(e => e.by_id === filter.by_id);
    if (filter.field) filtered = filtered.filter(e => e.field === filter.field);
    if (filter.since) filtered = filtered.filter(e => e.at >= filter.since);
    return filtered.sort((a, b) => b.at.localeCompare(a.at));
  },
  
  getAuditFor(recordId) { return this.getAuditLog({ recordId }); },
  getTimelineFor(recordId) {
    const r = this.getRenewal(recordId);
    return r ? (r.timeline || []) : [];
  },
  
  // ── Pendings / Risks ──
  getPendingApprovals() {
    return this.getRenewals({ excludeBackup: true })
      .filter(r => r.estado === STATES.PENDIENTE_APROBACION);
  },
  
  getBlocked() {
    return this.getRenewals({ excludeBackup: true })
      .filter(r => r.estado === STATES.BLOQUEADO || r.blocked === true);
  },
  
  getMyQueue(userId) {
    return this.getRenewals({ excludeBackup: true })
      .filter(r => (r.tecnico || '').toLowerCase() === (userId || '').toLowerCase())
      .filter(r => r.estado !== STATES.CERRADO);
  },
  
  // ── Internal ──
  _appendAudit(record, entries) {
    if (!record.audit) record.audit = [];
    record.audit.push(...entries);
  },
  _appendTimeline(record, event) {
    if (!record.timeline) record.timeline = [];
    record.timeline.push(event);
  },
  
  // ── Subscription (futuro Graph) ──
  _subscribers: [],
  subscribe(cb) { this._subscribers.push(cb); return () => { this._subscribers = this._subscribers.filter(s => s !== cb); }; },
  _emit(event) { this._subscribers.forEach(cb => { try { cb(event); } catch(e) { /* intentional */ } }); },
  
  // ── Sync (mock por ahora, después GraphProvider) ──
  lastSync: null,
  async sync() {
    this.lastSync = new Date().toISOString();
    return { ok: true, at: this.lastSync, changed: 0 };
  },
  
  // ── Metadata ──
  provider: 'MockProvider', // se reemplaza por 'GraphProvider' en Fase 5
  version: '1.0',
};
window.DataService = DataService;

// ─── MIGRATION HELPER · agrega campos faltantes a registros legacy ───
function migrateRecord(r) {
  if (!r.audit) r.audit = [];
  if (!r.timeline) r.timeline = [];
  if (typeof r.blocked !== 'boolean') r.blocked = false;
  if (!r.block_reason) r.block_reason = '';
  if (!r.block_category) r.block_category = '';
  if (!r.block_previous_state) r.block_previous_state = '';
  if (!r.approval) r.approval = { status: null, by: null, at: null, reason: '' };
  // Inicializar timeline con el estado actual si está vacío
  if (r.timeline.length === 0 && r.estado) {
    r.timeline.push({
      at: new Date().toISOString(),
      by: 'sistema',
      by_id: null,
      from: null,
      to: r.estado,
      note: 'Estado inicial al cargar el sistema',
    });
  }
}
window.USERS.forEach(migrateRecord);



// ═══ AUDIO ═══
function getAudioCtx() {
  // GH3.39.1 P8: AudioContext solo se crea después del primer gesto del usuario
  if (!state._userGestureOccurred) return null;
  if (!state.audioCtx) {
    try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return null; }
  }
  return state.audioCtx;
}
// Marcar el primer gesto del usuario para habilitar AudioContext
if (typeof window !== 'undefined') {
  ['click','keydown','touchstart'].forEach(function(evt) {
    window.addEventListener(evt, function _unlockAudio() {
      if (window.state) state._userGestureOccurred = true;
      ['click','keydown','touchstart'].forEach(function(e2) {
        window.removeEventListener(e2, _unlockAudio);
      });
    }, { once: true });
  });
}
function playBeep(frequency, duration, type) {
  const ctx = getAudioCtx(); if (!ctx) return;
  // GH3.36: Chrome autoplay policy — AudioContext require gesto del usuario.
  // Si el contexto está suspendido (sin gesto aún), salir silenciosamente.
  // El sonido funcionará correctamente después de la primera interacción.
  if (ctx.state === 'suspended') { ctx.resume().catch(function(){ /* AudioContext resume ignorado — el sonido no se reproducirá hasta primer gesto */ }); return; }
  type = type || 'sine';
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.value = frequency; osc.type = type;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(); osc.stop(ctx.currentTime + duration);
}
function playSound(level) {
  if (!state.settings.sound) return;
  if (level === 'info') playBeep(880, 0.15, 'sine');
  else if (level === 'warning') { playBeep(660, 0.12, 'triangle'); setTimeout(() => playBeep(880, 0.15, 'triangle'), 130); }
  else if (level === 'critical') { playBeep(440, 0.18, 'sawtooth'); setTimeout(() => playBeep(370, 0.18, 'sawtooth'), 200); setTimeout(() => playBeep(440, 0.22, 'sawtooth'), 400); }
}
window.playSound = playSound;

// ═══ BROWSER NOTIFICATIONS ═══
async function requestBrowserPermission() {
  if (!('Notification' in window)) { toast('Tu navegador no soporta notificaciones', 'warning'); return false; }
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}
function showBrowserNotification(title, message, level) {
  if (!state.settings.browser) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body: message, icon: window.LOGOS.horizontal_color,
      tag: 'pmc-' + Date.now(),
      requireInteraction: level === 'critical', silent: !state.settings.sound,
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), level === 'critical' ? 12000 : 6000);
  } catch(e) { console.error('[browser notif]', e); }
}

// ═══ NOTIFICATION SYSTEM ═══
function notify(opts) {
  const level = opts.level || 'info';
  const category = opts.category || 'system';
  if (category !== 'system' && state.settings.events && state.settings.events[category] === false) return;
  
  const n = {
    id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    level: level, category: category,
    title: opts.title || 'Notificación', message: opts.message || '',
    recordId: opts.recordId || null, read: false,
  };
  state.notifications.unshift(n);
  if (state.notifications.length > 200) state.notifications = state.notifications.slice(0, 200);
  saveToStorage(STORAGE.notifications, state.notifications);
  if (state.settings.toast) showToast(n);
  playSound(level);
  showBrowserNotification(n.title, n.message, level);
  updateNotifBadge();
  if (state.view === 'actividad') renderActivityLog();
  if (notifCenterOpen) renderNotifList();
}
window.notify = notify;

function showToast(n) {
  const wrap = $('toast-wrap');
  const icon = n.level === 'info'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    : n.level === 'warning'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  const div = document.createElement('div');
  div.className = 'toast ' + n.level;
  div.innerHTML = '<div class="toast-icon">' + icon + '</div><div class="toast-body"><div class="toast-title">' + esc(n.title) + '</div><div class="toast-msg">' + esc(n.message) + '</div></div><button class="toast-close" onclick="this.parentElement.classList.add(\'removing\');setTimeout(()=>this.parentElement.remove(),300)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  wrap.appendChild(div);
  const lifetime = n.level === 'critical' ? 8000 : (n.level === 'warning' ? 5000 : 3500);
  setTimeout(() => { div.classList.add('removing'); setTimeout(() => div.remove(), 300); }, lifetime);
}

function updateNotifBadge() {
  const unread = state.notifications.filter(n => !n.read).length;
  const total = state.notifications.length;
  const dot = $('notif-dot'); if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
  const badge = $('b-actividad');
  if (badge) { badge.textContent = total > 99 ? '99+' : total; badge.classList.toggle('alert', unread > 0); }
  const sub = $('notif-head-sub');
  if (sub) sub.textContent = unread > 0 ? unread + ' sin leer · ' + total + ' totales' : (total === 0 ? 'Sin notificaciones' : total + ' totales');
}

let notifCenterOpen = false;
function toggleNotifCenter() { notifCenterOpen ? closeNotifCenter() : openNotifCenter(); }
window.toggleNotifCenter = toggleNotifCenter;
function openNotifCenter() { notifCenterOpen = true; $('notif-overlay').classList.add('open'); $('notif-center').classList.add('open'); renderNotifList(); }
window.openNotifCenter = openNotifCenter;
function closeNotifCenter() { notifCenterOpen = false; $('notif-overlay').classList.remove('open'); $('notif-center').classList.remove('open'); }
window.closeNotifCenter = closeNotifCenter;
function filterNotifs(filter, btn) { state.notifFilter = filter; $$('.notif-filter').forEach(f => f.classList.toggle('active', f.dataset.filter === filter)); renderNotifList(); }
window.filterNotifs = filterNotifs;

function renderNotifList() {
  const list = $('notif-list');
  let items = state.notifications;
  if (state.notifFilter === 'unread') items = items.filter(n => !n.read);
  else if (state.notifFilter !== 'all') items = items.filter(n => n.level === state.notifFilter);
  if (items.length === 0) {
    list.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg></div><div class="notif-empty-title">Sin notificaciones</div><div class="notif-empty-msg">' + (state.notifFilter === 'all' ? 'Las notificaciones aparecerán aquí cuando se actualicen registros' : 'Ningún resultado con este filtro') + '</div></div>';
    return;
  }
  const icon = (lv) => lv === 'info'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    : lv === 'warning'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  list.innerHTML = items.map(n => '<div class="notif-item ' + n.level + (n.read ? '' : ' unread') + '" onclick="onNotifClick(\'' + n.id + '\')"><div class="notif-item-icon">' + icon(n.level) + '</div><div class="notif-item-body"><div class="notif-item-title">' + esc(n.title) + '</div><div class="notif-item-msg">' + esc(n.message) + '</div><div class="notif-item-time">' + formatTime(n.timestamp) + '</div></div></div>').join('');
}

function formatTime(iso) {
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return 'Hace ' + Math.floor(diff / 60) + ' min';
  if (diff < 86400) return 'Hace ' + Math.floor(diff / 3600) + ' h';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function onNotifClick(id) {
  const n = state.notifications.find(x => x.id === id);
  if (!n) return;
  n.read = true;
  saveToStorage(STORAGE.notifications, state.notifications);
  updateNotifBadge(); renderNotifList();
  if (n.recordId) { closeNotifCenter(); setTimeout(() => openEditModal(n.recordId), 300); }
}
window.onNotifClick = onNotifClick;

function markAllRead() {
  state.notifications.forEach(n => n.read = true);
  saveToStorage(STORAGE.notifications, state.notifications);
  updateNotifBadge(); renderNotifList();
}
window.markAllRead = markAllRead;

function clearActivityLog() {
  if (!confirm('¿Eliminar todo el historial de notificaciones?')) return;
  state.notifications = [];
  saveToStorage(STORAGE.notifications, state.notifications);
  updateNotifBadge(); renderNotifList();
  if (state.view === 'actividad') renderActivityLog();
  toast('Historial limpiado', 'info');
}
window.clearActivityLog = clearActivityLog;

function toast(msg, level) { notify({ level: level || 'info', category: 'system', title: 'Sistema', message: msg }); }

// ═══ SETTINGS ═══
function loadSettings() {
  const saved = loadFromStorage(STORAGE.settings, null);
  if (saved) Object.assign(state.settings, saved);
  if (!state.settings.events) state.settings.events = { create: true, edit: true, state: true, acta: true, bodega: true };
  applySettingsToUI();
}
function applySettingsToUI() {
  $('sw-toast').classList.toggle('on', state.settings.toast);
  $('sw-browser').classList.toggle('on', state.settings.browser);
  $('sw-sound').classList.toggle('on', state.settings.sound);
  $('sw-highlight').classList.toggle('on', state.settings.highlight);
  ['create', 'edit', 'state', 'acta', 'bodega'].forEach(evt => {
    const el = $('sw-evt-' + evt);
    if (el) el.classList.toggle('on', state.settings.events[evt]);
  });
}
async function toggleSetting(key, el) {
  if (key === 'browser' && !state.settings.browser) {
    const granted = await requestBrowserPermission();
    if (!granted) { toast('Permiso denegado por el navegador', 'warning'); return; }
    notify({ level: 'info', category: 'system', title: 'Notificaciones del navegador', message: 'Se activaron correctamente. Recibirás alertas incluso con la pestaña en segundo plano.' });
  }
  state.settings[key] = !state.settings[key];
  el.classList.toggle('on', state.settings[key]);
  saveToStorage(STORAGE.settings, state.settings);
}
window.toggleSetting = toggleSetting;
function toggleEventSetting(evt, el) {
  state.settings.events[evt] = !state.settings.events[evt];
  el.classList.toggle('on', state.settings.events[evt]);
  saveToStorage(STORAGE.settings, state.settings);
}
window.toggleEventSetting = toggleEventSetting;
function resetSettings() {
  if (!confirm('¿Restablecer todas las preferencias a valores por defecto?')) return;
  state.settings = { toast: true, browser: false, sound: true, highlight: true, events: { create: true, edit: true, state: true, acta: true, bodega: true } };
  saveToStorage(STORAGE.settings, state.settings);
  applySettingsToUI();
  toast('Preferencias restablecidas', 'info');
}
window.resetSettings = resetSettings;

// ═══ THEME ═══
function toggleTheme() { applyTheme(state.theme === 'light' ? 'dark' : 'light'); }
window.toggleTheme = toggleTheme;
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  saveToStorage(STORAGE.theme, theme);
  const iconSvg = theme === 'dark' 
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  $('theme-icon').innerHTML = iconSvg;
  if (state.view === 'resumen') renderMap();
}

function loadLogos() {
  const splashLogo = $('splash-logo');
  if (splashLogo) splashLogo.src = window.LOGOS.horizontal_white;
  const landingLogo = $('landing-logo');
  if (landingLogo) landingLogo.src = window.LOGOS.horizontal_white;
  $('sb-logo-light').src = window.LOGOS.horizontal_color;
  $('sb-logo-dark').src = window.LOGOS.horizontal_white;
  $('footer-brand-logo').src = window.LOGOS.horizontal_white;
}


// ═══ NAVIGATION ═══
const VIEW_TITLES = {
  resumen: 'Resumen', usuarios: 'Usuarios', tecnicos: 'Por técnico',
  'tecnico-detail': 'Detalle del técnico',
  'aprobaciones': 'Aprobaciones',
  'panel': 'Seguimiento',                  // STAB-v09.2 ÍTEM 3: renombrado
  'home-tecnico': 'Mi Cola · Técnico',
  ciudades: 'Por ciudad', devoluciones: 'Devoluciones',
  reportes: 'Ejecutivos',                   // STAB-v09.2 ÍTEM 2
  backup: 'Equipos Backup',                 // STAB-v09.2 ÍTEM 8
  actividad: 'Actividad', ajustes: 'Ajustes'
};


// ════════════════════════════════════════════════════════════════════
// GH3.37.1 Item 4 — AuthorizationService
// Controla acceso por URL hash (#panel-ejecutivo, etc.) no solo por botones
// ════════════════════════════════════════════════════════════════════
const AuthorizationService = {
  // Vistas accesibles por rol (incluye substrings del view id)
  // GH3.39.1 FC-11: permisos actualizados — Técnico puede ver Vista de Seguimiento, Ciudades, Técnicos, Devoluciones
  _PERMISSIONS: {
    super_admin:    ['*'],
    gestor_activos: ['resumen','usuarios','reportes','actividad','configuracion','aprobaciones','backup','panel-ejecutivo','panel','ciudades','tecnico','devoluciones'],
    tecnico:        ['usuarios','resumen','actividad','panel','ciudades','tecnicos','devoluciones','reportes','backup','home-tecnico'],
    consulta:       ['usuarios','resumen'],
    visitante:      ['resumen'],
  },
  canAccess(viewId) {
    const role = (window.state && state.user && (state.user.role || state.user.rol)) || 'visitante';
    const perms = this._PERMISSIONS[role] || this._PERMISSIONS['visitante'];
    if (perms.includes('*')) return true;
    return perms.some(function(p){ return viewId === p || viewId.indexOf(p) >= 0; });
  },
};
window.AuthorizationService = AuthorizationService;

function goView(id) {
  if (!VIEW_TITLES[id]) return;
  // GH3.37.1 Item 4: bloquear navegación a vistas no autorizadas (no solo ocultar botones)
  if (window.AuthorizationService && !AuthorizationService.canAccess(id)) {
    console.error('[RBAC] Acceso denegado a vista:', id);
    return;
  }
  state.view = id;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + id));
  $$('.sb-item').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  $('crumb-view').textContent = VIEW_TITLES[id];
  scrollMainTop();
  renderView(id);
  // STAB Item 6: mostrar KPI header solo en vistas que lo definen
  var kpiViews = { resumen: true, panel: true };
  var kpiStrip = document.querySelector('.panel-kpi-strip') || document.getElementById('kpi-header');
  if (kpiStrip) kpiStrip.style.display = kpiViews[id] ? '' : 'none';
}
window.goView = goView;

function renderView(id) {
  try {
    switch(id) {
      case 'resumen': renderResumen(); break;
      case 'usuarios': renderUsuarios(); break;
      case 'tecnicos': renderTecnicos(); break;
      case 'ciudades': renderCiudades(); break;
      case 'devoluciones': renderDevoluciones(); break;
      case 'reportes': renderReportes(); break;
      case 'actividad': renderActivityLog(); break;
      case 'tecnico-detail': renderTecnicoDetail(); break;
      case 'aprobaciones': renderAprobaciones(); break;
      case 'panel': renderPanelEjecutivo(); break;
      case 'home-tecnico': renderHomeTecnico(); break;
      case 'backup': if (window.renderBackup) renderBackup(); break; // STAB-v09.2
    }
  } catch(e) { console.error('[renderView]', id, e); toast('Error en vista ' + id, 'warning'); }
}

function scrollMainTop() {
  const main = $('main-scroll');
  if (main && typeof main.scrollTo === 'function') main.scrollTo({ top: 0, behavior: 'smooth' });
}
window.scrollMainTop = scrollMainTop;

function uniqueUsers() {
  // GH3.39.1 FC-10: delega a totalColaboradores() — fuente canónica de colaboradores (141)
  if (window.KPIService && KPIService.totalColaboradores) return KPIService.totalColaboradores();
  if (window.KPIService && KPIService.totalRenewals) return KPIService.totalRenewals();
  return (window.USERS||[]).filter(function(u){ return !isBackup(u); }).length;
}

// ═══ RESUMEN ═══

// ════════════════════════════════════════════════════════════════════
// EventBus — Canal de mensajes desacoplado (Pub/Sub)
// HOTFIX: Restaurado aquí tras eliminación accidental en QA-05 Task 1.
// Debe cargarse antes de sync.js, provider.js y boot.js.
// ════════════════════════════════════════════════════════════════════
const EventBus = (function() {
  var _subs = {};
  var _log  = [];  // últimos 50 eventos para diagnóstico

  function publish(event, payload) {
    _log.push({ event: event, payload: payload, at: new Date().toISOString() });
    if (_log.length > 50) _log.shift();
    var handlers = _subs[event];
    if (!handlers || handlers.length === 0) return;
    // slice() para iterar sobre una copia — handlers que se auto-eliminan en su callback
    handlers.slice().forEach(function(fn) {
      try { fn(payload); } catch(e) { /* intentional: handler error no bloquea el canal */ }
    });
  }

  function subscribe(event, handler) {
    if (!_subs[event]) _subs[event] = [];
    _subs[event].push(handler);
    return function unsubscribe() {
      if (_subs[event]) {
        _subs[event] = _subs[event].filter(function(h) { return h !== handler; });
      }
    };
  }

  return { publish: publish, subscribe: subscribe, _log: _log };
})();
window.EventBus = EventBus;

// GH3.42 — siNoToBool: normaliza valores SI/NO del Excel a boolean.
// Movida desde dashboard.js para estar disponible antes de dataService.js.
function siNoToBool(v) {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return false;
  var s = String(v).trim().toUpperCase();
  return s === 'SI' || s === 'SÍ' || s === 'TRUE' || s === '1' || s === 'YES';
}
window.siNoToBool = siNoToBool;
