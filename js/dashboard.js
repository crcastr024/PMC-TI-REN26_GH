// ════════════════════════════════════════════════════════════════════
// js/dashboard.js — PMC-TI-REN26 GH1
// KPIService, IntegrityService, DashboardFactory y todas las funciones de render
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

const KPIService = {
  
  calculate(records) {
    records = (records || []).filter(r => !r.es_backup);
    const total = records.length;
    
    const entregados = records.filter(r => {
      const e = (r.estado || '').toLowerCase();
      return e.indexOf('entregado equipo nuevo') >= 0 ||
             e.indexOf('completada') >= 0 ||
             e === 'cerrado' || e === 'feedback' ||
             e.indexOf('antiguo recibido') >= 0 ||
             e.indexOf('aprobaci') >= 0;
    }).length;
    
    const enProceso = records.filter(r => {
      const e = (r.estado || '').toLowerCase();
      return e === 'alistamiento' || e === 'programado' ||
             e.indexOf('tránsito') >= 0;
    }).length;
    
    const pendientes = records.filter(r => r.estado === 'Pendiente').length;
    const bloqueados = records.filter(r => r.estado === 'Bloqueado').length;
    const pendientesAprobacion = records.filter(r => r.estado === 'Pendiente aprobación').length;
    const cerrados = records.filter(r => r.estado === 'Cerrado').length;
    const correccion = records.filter(r => r.estado === 'Corrección requerida').length;
    const actasFirmadas = records.filter(r => r.acta_firmada === true).length;
    
    return {
      total,
      entregados,
      enProceso,
      pendientes,
      bloqueados,
      pendientesAprobacion,
      cerrados,
      correccion,
      actasFirmadas,
      porcentajeAvance: total ? Math.round((entregados / total) * 100) : 0,
      porcentajeCierre: total ? Math.round((cerrados / total) * 100) : 0,
    };
  },
  
  byEmpresa() {
    const result = {};
    ['HBT', 'HGS'].forEach(emp => {
      const set = window.USERS.filter(r => r.empresa === emp);
      result[emp] = this.calculate(set);
    });
    return result;
  },
  
  byTecnico() {
    const techs = window.CONFIG.technicians.concat(['Sin asignar']);
    const result = {};
    techs.forEach(t => {
      const set = t === 'Sin asignar'
        ? window.USERS.filter(r => !r.tecnico)
        : window.USERS.filter(r => (r.tecnico || '').toLowerCase() === t.toLowerCase());
      result[t] = this.calculate(set);
    });
    return result;
  },
  
  raeeStats() {
    return ObsolescenceService.getStats();
  },
};

window.KPIService = KPIService;

// ═══════════════════════════════════════════════════════════════════
// F3 · NotificationService (fachada hacia el sistema notify() existente)
// API simple para módulos externos / migración futura
// ═══════════════════════════════════════════════════════════════════
const NotificationService = {
  show(messageOrOpts) {
    if (typeof messageOrOpts === 'string') {
      notify({ level: 'info', category: 'system', title: 'Sistema', message: messageOrOpts });
    } else {
      notify(messageOrOpts);
    }
  },
  info(title, message, recordId) { notify({ level: 'info', category: 'system', title, message, recordId }); },
  warning(title, message, recordId) { notify({ level: 'warning', category: 'system', title, message, recordId }); },
  critical(title, message, recordId) { notify({ level: 'critical', category: 'system', title, message, recordId }); },
};
window.NotificationService = NotificationService;

// ═══════════════════════════════════════════════════════════════════
// F3 · AuditService (fachada para módulos)
// La auditoría real se almacena en cada record.audit[] via DataService
// ═══════════════════════════════════════════════════════════════════
const AuditService = {
  add(change) {
    // change = { recordId, field, before, after, by? }
    const record = DataService.getRenewal(change.recordId);
    if (!record) return null;
    const user = change.by || state.user;
    DataService._appendAudit(record, [
      makeAuditEntry(user, change.field, change.before, change.after, change.meta),
    ]);
  },
  getAll() { return DataService.getAuditLog({}); },
  getByRecord(recordId) { return DataService.getAuditFor(recordId); },
  getByUser(userId) { return DataService.getAuditLog({ by_id: userId }); },
};
window.AuditService = AuditService;


// ── 04_migration_states.js ──

// ═══════════════════════════════════════════════════════════════════
// F3 · Migration & StateMachine extension
// Normaliza el dataset del JSON al modelo interno + extiende StateMachine
// ═══════════════════════════════════════════════════════════════════

// Map: estados uppercase del JSON → estados oficiales del StateMachine
const STATE_NORMALIZE_MAP = {
  'PENDIENTE': StateMachine.states.PENDIENTE,
  'ALISTAMIENTO': StateMachine.states.ALISTAMIENTO,
  'PROGRAMADO': StateMachine.states.PROGRAMADO,
  'EN TRÁNSITO': StateMachine.states.TRANSITO_NUEVO,
  'EN TRANSITO': StateMachine.states.TRANSITO_NUEVO,
  'EN TRÁNSITO EQUIPO NUEVO': StateMachine.states.TRANSITO_NUEVO,
  'ENTREGADO': StateMachine.states.ENTREGADO_NUEVO,
  'ENTREGADO EQUIPO NUEVO': StateMachine.states.ENTREGADO_NUEVO,
  'PENDIENTE RECOGER EQUIPO ANTERIOR': StateMachine.states.PENDIENTE_RECOGER,
  'EN TRÁNSITO EQUIPO ANTERIOR': StateMachine.states.TRANSITO_ANTERIOR,
  'EN TRANSITO EQUIPO ANTERIOR': StateMachine.states.TRANSITO_ANTERIOR,
  'EQUIPO ANTIGUO RECIBIDO': StateMachine.states.RECIBIDO_ANTERIOR,
  'EQUIPO ANTERIOR RECIBIDO': StateMachine.states.RECIBIDO_ANTERIOR,
  'RENOVACIÓN COMPLETADA': StateMachine.states.COMPLETADA,
  'RENOVACION COMPLETADA': StateMachine.states.COMPLETADA,
  'COMPLETADO': StateMachine.states.COMPLETADA,
  'COMPLETADA': StateMachine.states.COMPLETADA,
  'PENDIENTE APROBACIÓN': StateMachine.states.PENDIENTE_APROBACION,
  'PENDIENTE APROBACION': StateMachine.states.PENDIENTE_APROBACION,
  'CORRECCIÓN REQUERIDA': StateMachine.states.CORRECCION_REQUERIDA,
  'CORRECCION REQUERIDA': StateMachine.states.CORRECCION_REQUERIDA,
  'CERRADO': StateMachine.states.CERRADO,
  'FEEDBACK': 'Feedback',
  'BLOQUEADO': StateMachine.states.BLOQUEADO,
  'BACKUP': StateMachine.states.BACKUP,
};

// F3.5 · FEEDBACK y todas las transiciones consolidadas en STATES/TRANSITIONS de Foundation (ver arriba).
// extendTransitions() eliminado — ya no es necesario.

// Normaliza el estado de un record
StateMachine.normalize = function(legacyState) {
  if (!legacyState) return StateMachine.states.PENDIENTE;
  const upper = String(legacyState).toUpperCase().trim();
  if (STATE_NORMALIZE_MAP[upper]) return STATE_NORMALIZE_MAP[upper];
  // ¿Ya está en formato canónico?
  const canonical = Object.values(StateMachine.states);
  if (canonical.indexOf(legacyState) >= 0) return legacyState;
  // fallback
  return legacyState;
};

// ═══════════════════════════════════════════════════════════════════
// F3 · Migración F3 de cada record del JSON al modelo interno
// ═══════════════════════════════════════════════════════════════════

function siNoToBool(v) {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return false;
  return String(v).trim().toUpperCase() === 'SI' || String(v).trim() === 'true';
}



// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// F3.6 · INVARIANTE ARQUITECTÓNICO — 4 entidades de estado independientes
// No deben colapsarse entre sí ni leerse una como sustituto de otra:
//
//   1. record.estado                        → ESTADO DEL PROCESO REN26
//      (StateMachine: Pendiente···Cerrado · gobierna el flujo operativo)
//
//   2. record.estado_entrega_equipo_nuevo   → ESTADO FÍSICO DEL EQUIPO NUEVO (F3.6)
//      (Pendiente / Alistado / En tránsito / Entregado / Completado)
//      Progresión logística del equipo nuevo, independiente del proceso.
//
//   3. record.estado_devolucion             → ESTADO FÍSICO DEL EQUIPO ANTERIOR (logística)
//      record.disposicion_final             → DESTINO FINAL del equipo anterior
//      (Venta interna empleado / Reasignación interna / Baja RAEE / Pendiente evaluación)
//
//   4. record.clasificacion_obsolescencia   → CLASIFICACIÓN DEL EQUIPO ANTERIOR
//      (generada EXCLUSIVAMENTE por ObsolescenceService.classify() · no editable manualmente)
//
// Ningún flujo debe escribir clasificacion_obsolescencia fuera de
// ObsolescenceService. Las 4 entidades son ortogonales.
// ═══════════════════════════════════════════════════════════════════

// F3 · MODELO NORMALIZADO (capa de adaptación)
// Transforma datos flat (eq_ant_*, eq_nvo_*) → modelo interno con sub-objetos
// La UI consume solamente el modelo normalizado.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// F3.1 · RelationsResolver
// Resuelve la relación Renovación <-> Inventario.
// Regla validada: cedula (renovación) == cedula_asignada (inventario).
// (eq_nvo_serial/serial NO es viable: 0% de las renovaciones tienen
// eq_nvo_serial poblado mientras el equipo no ha sido entregado).
// 133/146 inventario con match; los 13 restantes son stock sin asignar
// (cedula_asignada === 'Pendiente').
// ═══════════════════════════════════════════════════════════════════
const RelationsResolver = {
  
  /** Busca en window.INVENTORY el equipo asignado a este registro de renovación */
  findInventoryForRecord(record) {
    if (!record || !window.INVENTORY) return null;
    const cedula = record.cedula != null ? String(record.cedula).trim() : null;
    const usuario = record.usuario != null ? String(record.usuario).trim().toUpperCase() : null;
    
    if (cedula) {
      const byCedula = window.INVENTORY.find(i =>
        i.cedula_asignada != null &&
        String(i.cedula_asignada).trim() === cedula
      );
      if (byCedula) return byCedula;
    }
    if (usuario) {
      const byUsuario = window.INVENTORY.find(i =>
        i.usuario_asignado != null &&
        String(i.usuario_asignado).trim().toUpperCase() === usuario
      );
      if (byUsuario) return byUsuario;
    }
    return null;
  },
  
  /** Estadísticas del cruce, para auditoría/debug */
  getStats() {
    const total = (window.INVENTORY || []).length;
    let matched = 0, pendingStock = 0;
    (window.INVENTORY || []).forEach(i => {
      if (i.cedula_asignada === 'Pendiente' || i.cedula_asignada == null) { pendingStock++; return; }
      const ren = (window.USERS || []).find(r => String(r.cedula) === String(i.cedula_asignada));
      if (ren) matched++;
    });
    return { total, matched, pendingStock, unmatched: total - matched - pendingStock };
  },
};
window.RelationsResolver = RelationsResolver;

// ═══════════════════════════════════════════════════════════════════
// F3.5 · CONTRATOS DE VIEWMODEL
// Documentación explícita de las formas de datos que la UI consume.
// Estos no son clases — son contratos de forma (shape contracts).
// Cada ViewModel es producido por RenovacionModel.rebuildShape() y
// se accede desde los componentes sin lógica de negocio adicional.
//
// RenewalViewModel {
//   id, empresa, nombre, cedula, usuario, correo, ciudad,
//   ceco, proyecto, cargo, gerente, registro,
//   tecnico, estado, blocked, block_reason, block_category, block_previous_state,
//   disposicion_final, estado_devolucion,
//   clasificacion_obsolescencia, generacion_cpu, accion_requerida, accion_detalle,
//   evidencia_adjunta, nombre_archivo, acta_enviada, acta_firmada,
//   feedback, feedback_recibido,
//   audit: AuditEntry[], timeline: TimelineEvent[], approval: ApprovalRecord,
//   equipoAnterior: EquipoAnteriorViewModel,
//   equipoNuevo:    EquipoNuevoViewModel,
// }
//
// EquipoAnteriorViewModel { tipo, marca, modelo, af, serial, hostname, placa, procesador, memoria, so }
//
// EquipoNuevoViewModel {
//   tipo, marca, modelo, af, serial, hostname, placa, procesador, ram, memoria, disco, so,
//   id_inv, estado_inventario, fecha_asignacion          // de RelationsResolver + inventario_equipos
// }
//
// SystemUserViewModel { id, name, email, role, role_label, estado }
//   Producido por DataMapper.normalizeUsuarioSistema()
//
// ─── REGLA DE ACCESO ────────────────────────────────────────────
// La única ruta de datos válida es:
//   UI → DataService (+ ConfigService/StateMachine) → DataMapper/RelationsResolver → Provider
// Los componentes NO deben:
//   · leer window.USERS directamente (usar DataService.getRenewals())
//   · leer window.INVENTORY directamente (usar RelationsResolver)
//   · leer window.PMC_DATA directamente
//   · llamar a MockProvider/JSONProvider/SplitJsonProvider
//   · hardcodear valores que ConfigService expone
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// F3.9 · IntegrityService
// Valida integridad referencial del dataset en memoria.
// Solo lectura — detecta y reporta, nunca corrige automáticamente.
// ═══════════════════════════════════════════════════════════════════
const IntegrityService = {

  /** Ejecuta todas las validaciones y devuelve un reporte completo */
  validate() {
    const ren   = window.USERS || [];
    const inv   = window.INVENTORY || [];
    const issues = [];
    const stats  = {};

    const activos = ren.filter(r => r.es_backup !== true && r.es_backup !== 'SI');
    stats.total         = ren.length;
    stats.activos        = activos.length;
    stats.backups        = ren.length - activos.length;

    // ── Cédulas duplicadas
    const cedMap = {};
    activos.forEach(r => {
      const c = String(r.cedula || '');
      if (!c) return;
      cedMap[c] = (cedMap[c] || 0) + 1;
    });
    const dupCeds = Object.entries(cedMap).filter(([,n]) => n > 1).map(([c]) => c);
    if (dupCeds.length) issues.push({ type: 'CEDULA_DUPLICADA', count: dupCeds.length, samples: dupCeds.slice(0,5) });
    stats.cedulas_duplicadas = dupCeds.length;

    // ── Seriales eq. anterior duplicados
    const serAntMap = {};
    activos.forEach(r => { if (r.eq_ant_serial) serAntMap[r.eq_ant_serial] = (serAntMap[r.eq_ant_serial]||0)+1; });
    const dupSerAnt = Object.entries(serAntMap).filter(([,n])=>n>1).map(([s])=>s);
    if (dupSerAnt.length) issues.push({ type: 'SERIAL_ANT_DUPLICADO', count: dupSerAnt.length, samples: dupSerAnt });
    stats.seriales_ant_duplicados = dupSerAnt.length;

    // ── Hostnames eq. anterior duplicados
    const hostMap = {};
    activos.forEach(r => { if (r.eq_ant_hostname) hostMap[r.eq_ant_hostname] = (hostMap[r.eq_ant_hostname]||0)+1; });
    const dupHosts = Object.entries(hostMap).filter(([,n])=>n>1).map(([h])=>h);
    if (dupHosts.length) issues.push({ type: 'HOSTNAME_ANT_DUPLICADO', count: dupHosts.length, samples: dupHosts });
    stats.hostnames_ant_duplicados = dupHosts.length;

    // ── Renovaciones sin técnico
    const sinTecnico = activos.filter(r => !r.tecnico).map(r => r.id);
    if (sinTecnico.length) issues.push({ type: 'SIN_TECNICO', count: sinTecnico.length, samples: sinTecnico.slice(0,10) });
    stats.sin_tecnico = sinTecnico.length;

    // ── Renovaciones sin procesador (→ Revisión manual RAEE)
    const sinProc = activos.filter(r => !r.eq_ant_procesador).map(r => r.id);
    stats.sin_procesador = sinProc.length;
    if (sinProc.length) issues.push({ type: 'SIN_PROCESADOR', count: sinProc.length, samples: sinProc.slice(0,5) });

    // ── Inventario sin renovación correspondiente
    const cedSet = new Set(activos.map(r => String(r.cedula || '')));
    const invSinRen = inv.filter(i => {
      const ca = String(i.cedula_asignada || '');
      return ca && ca !== 'Pendiente' && !cedSet.has(ca);
    }).map(i => i.id_inv);
    if (invSinRen.length) issues.push({ type: 'INV_SIN_RENOVACION', count: invSinRen.length, samples: invSinRen });
    stats.inv_sin_renovacion = invSinRen.length;

    // ── Seriales inventario duplicados (excluir placeholders)
    const serInvMap = {};
    inv.forEach(i => {
      if (i.serial && i.serial !== 'PENDIENTE') serInvMap[i.serial] = (serInvMap[i.serial]||0)+1;
    });
    const dupSerInv = Object.entries(serInvMap).filter(([,n])=>n>1).map(([s])=>s);
    if (dupSerInv.length) issues.push({ type: 'SERIAL_INV_DUPLICADO', count: dupSerInv.length, samples: dupSerInv });
    stats.seriales_inv_duplicados = dupSerInv.length;

    return {
      ok:       issues.length === 0,
      issues,
      stats,
      summary:  `${activos.length} activos · ${issues.length} problema(s) detectado(s)`,
    };
  },

  /** Genera un resumen legible para consola/log */
  report() {
    const result = this.validate();
    console.group('[IntegrityService]', result.summary);
    if (result.ok) {

    } else {
      result.issues.forEach(i => console.warn(i.type, ':', i.count, '→', i.samples));
    }
    console.groupEnd();
    return result;
  },
};
window.IntegrityService = IntegrityService;
// Stubs para vistas diferenciadas. La lógica de datos ya está lista
// (RBAC, DataService, ViewModels). F4 solo construye las vistas.
// ═══════════════════════════════════════════════════════════════════
const DashboardFactory = {
  // F3.7 · Contratos formales de ViewModel por rol

  /** TÉCNICO — su propia cola de trabajo */
  getTecnicoViewModel(tecnicoName) {
    const all = DataService.getRenewals({ role: 'tecnico', tecnico: tecnicoName });
    const kpi = KPIService.calculate(all);
    return {
      // datos base
      pendientes:       all.filter(r => r.estado === 'Pendiente'),
      misUsuarios:      all,
      // devoluciones solo propias (filtro por tecnico)
      misDevoluciones:  all.filter(r => r.eq_ant_serial || r.eq_ant_marca || r.estado_devolucion),
      // equipos en tránsito
      equiposTransito:  all.filter(r => r.estado && r.estado.toLowerCase().indexOf('tránsito') >= 0),
      // alertas: bloqueados + corrección requerida
      alertas:          all.filter(r => r.estado === 'Bloqueado' || r.estado === 'Corrección requerida'),
      // KPIs propios
      kpi,
    };
  },

  /** GESTOR DE ACTIVOS — visión operativa completa */
  getGestorViewModel() {
    const all = DataService.getRenewals({});
    return {
      avanceGeneral:    KPIService.calculate(all),
      kpis:             KPIService.calculate(all),
      ciudades:         (() => {
        const map = {};
        all.forEach(r => {
          const c = r.ciudad || 'Sin ciudad';
          if (!map[c]) map[c] = [];
          map[c].push(r);
        });
        return map;
      })(),
      tecnicos:         KPIService.byTecnico(),
      raee:             KPIService.raeeStats(),
      reportes:         all,
      pendingApproval:  DataService.getPendingApprovals(),
      blocked:          DataService.getBlocked(),
      all,
    };
  },

  /** VISITANTE — lectura pública, sin datos sensibles de gestión */
  getVisitanteViewModel() {
    const all = DataService.getRenewals({});
    return {
      kpisPublicos:     KPIService.calculate(all),
      reportes:         all,
      avanceGeneral: {
        total:          all.length,
        porcentaje:     KPIService.calculate(all).porcentajeAvance,
        byEmpresa:      KPIService.byEmpresa(),
      },
      // F3.7 · timeline: últimas 20 entradas de auditoría públicas
      timeline:         DataService.getAuditLog({}).slice(-20),
      raee:             KPIService.raeeStats(),
    };
  },
};
window.DashboardFactory = DashboardFactory;

// ═══════════════════════════════════════════════════════════════════
// F3.5 · PREPARACIÓN F5 — Módulo Inventario independiente
// ═══════════════════════════════════════════════════════════════════
const InventarioService = {
  // F5 · Stub — operaciones sobre window.INVENTORY
  getAll()          { return (window.INVENTORY || []).slice(); },
  getDisponibles()  { return (window.INVENTORY || []).filter(i => i.estado_inventario === 'Disponible'); },
  getByIdInv(id)    { return (window.INVENTORY || []).find(i => i.id_inv === id) || null; },
  getByCedula(ced)  { return (window.INVENTORY || []).find(i => String(i.cedula_asignada) === String(ced)) || null; },
  // F5 · Métodos de escritura (pendientes — requieren write-back a Provider)
  reservar(id_inv, renovacion_id)   { console.warn('[F5 PENDIENTE] InventarioService.reservar'); },
  asignar(id_inv, cedula, usuario)  { console.warn('[F5 PENDIENTE] InventarioService.asignar'); },
  baja(id_inv, motivo)              { console.warn('[F5 PENDIENTE] InventarioService.baja'); },
  reasignar(id_inv, nueva_cedula)   { console.warn('[F5 PENDIENTE] InventarioService.reasignar'); },
};
window.InventarioService = InventarioService;

// ═══════════════════════════════════════════════════════════════════
// F3.5 · PREPARACIÓN F7 — GraphProvider (MSAL + SharePoint)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// F7.2 · GraphClient
// Capa HTTP pura para Microsoft Graph API.
// Responsabilidad exclusiva: comunicación HTTP.
// No conoce: Dashboard, DataService, StateMachine, RBAC.
// Obtiene tokens siempre a través de AuthProvider.
// ═══════════════════════════════════════════════════════════════════
