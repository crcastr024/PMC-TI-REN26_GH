// ════════════════════════════════════════════════════════════════════
// js/boot.js — PMC-TI-REN26 GH1
// BootstrapManager, boot(), RC2_doLogin, _showBootError, _bootCore
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

const BootstrapManager = (() => {

  let _completed = false;
  let _error     = null;

  // ── Utilidades de carga de tablas ────────────────────────────────────────
  async function _loadTable(tableName) {
    // WorkbookLoader es el único lector del Excel (invariante)
    const { headers, rows } = await WorkbookLoader.loadTable(tableName);
    if (!headers.length) return [];
    return ExcelMapper.toJson(headers, rows);
  }

  // ── Paso 3: Cargar usuarios del sistema y resolver rol ───────────────────
  async function _loadUsersAndResolveRole(userEmail) {

    const users = await _loadTable(TableRegistry.USUARIOS);
    window.SYSTEM_USERS = users;

    // Normalizar usuarios — campos mínimos
    users.forEach(u => {
      u.correo = (u.correo || u.email || u.username || '').toLowerCase().trim();
      u.rol    = u.rol || u.role || 'visitante';
    });

    // Resolver rol usando la función existente (lee SYSTEM_USERS)
    const role = F7_resolveRole(userEmail);

    return { users, role };
  }

  // ── Paso 4: Cargar permisos ──────────────────────────────────────────────
  async function _loadPermissions(role) {

    const rolesPermisos = await _loadTable(TableRegistry.ROLES_PERMISOS);
    window.ROLES        = await _loadTable(TableRegistry.ROLES);
    window.ROLES_PERMISOS = rolesPermisos;

    // Construir el objeto de permisos para el rol activo
    // Los permisos hardcoded en PERMISSIONS son el fallback si la tabla está vacía
    const fromTable = rolesPermisos.find(rp =>
      (rp.rol || rp.role || '').toLowerCase() === role.toLowerCase()
    );
    return fromTable
      ? (fromTable.permisos || fromTable.permissions || PERMISSIONS[role] || {})
      : (PERMISSIONS[role] || {});
  }

  // ── Paso 5: Cargar configuración ─────────────────────────────────────────
  async function _loadConfiguration() {

    const config = await _loadTable(TableRegistry.CONFIG);
    window.CONFIGURATION = config;

    // Parsear a objeto key:value y notificar a ConfigService
    const cfg = {};
    config.forEach(row => {
      if (row.clave || row.key) {
        cfg[row.clave || row.key] = row.valor || row.value;
      }
    });

    // Actualizar ConfigService si existe
    if (typeof ConfigService !== 'undefined' && ConfigService._updateConfig) {
      ConfigService._updateConfig(cfg);
    }
    return cfg;
  }

  // ── Paso 6+7: Crear sesión ───────────────────────────────────────────────
  function _createSession(account, role, permissions, config, token) {
    SessionManager.createFromBootstrap({
      username:    account.username || account.email || '',
      displayName: account.name || account.username || 'Usuario',
      email:       account.username || account.email || '',
      tenantId:    account.tenantId || (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.tenantId) || '',
      role,
      permissions,
      configuration: config,
      loginTime:   Date.now(),
      expiration:  Date.now() + (8 * 60 * 60 * 1000),
      authMode:    'msal',
      token:       token || null,    // RC2.5: token incluido en la sesión
    });
  }

  // ── run(): flujo completo del Bootstrap ──────────────────────────────────
  async function run(account, token) {
    if (_completed) {

      return;
    }

    try {


      // GH2.5: Resolver Site → Drive → Workbook dinámicamente (3 calls Graph)
      // Solo en modo excel. En mock mode, los IDs no son necesarios.
      const ds = (window.APP_CONFIG && window.APP_CONFIG.dataSource) || 'mock';
      if (ds === 'excel') {
        await GraphResolver.resolveAll();
      }

      // Verificar que WorkbookLoader puede acceder al workbook (ya con IDs resueltos)
      const health = await WorkbookLoader.checkHealth();
      if (!health.ok) {
        const e = new Error('[Bootstrap] Excel Maestro no disponible: ' + health.reason);
        e.code = 'BOOTSTRAP_EXCEL_UNAVAILABLE';
        e.retryable = true;
        throw e;
      }


      // Paso 3: usuarios + rol
      const { role } = await _loadUsersAndResolveRole(account.username || account.email || '');

      // Paso 4: permisos
      const permissions = await _loadPermissions(role);

      // Paso 5: configuración
      const config = await _loadConfiguration();

      // Paso 6: crear sesión RC2.5 completa
      _createSession(account, role, permissions, config, token);

      // Aplicar rol al estado de la UI
      SessionManager.applyToState();

      // Marcar completado y emitir evento
      _completed = true;

      EventBus.publish('bootstrap.completed', { role, user: account.username || account.email });

    } catch(err) {
      _error = err;
      console.error('[Bootstrap] error:', err.code || err.message);
      EventBus.publish('bootstrap.failed', { error: err.message, code: err.code });
      throw err;
    }
  }

  return {
    run,
    isCompleted: () => _completed,
    getError:    () => _error,
    reset:       () => { _completed = false; _error = null; },
  };
})();
window.BootstrapManager = BootstrapManager;

// ── RC2.7: RC2_doLogin() — handler del botón de login ────────────────────
async function RC2_doLogin() {
  const btn = document.getElementById('rc2-login-btn');
  const errEl = document.getElementById('rc2-login-error');
  if (btn) { btn.disabled = true; btn.textContent = 'Iniciando sesión...'; }
  if (errEl) errEl.style.display = 'none';

  try {
    const account = await AuthProvider.login();
    if (!account) throw new Error('Login cancelado o sin respuesta');

    // Obtener token después del login exitoso
    let token = null;
    try { token = await AuthProvider.getToken(); } catch(e) { /* intentional: fallo no crítico en boot */ }

    // Ocultar pantalla de login
    const loginEl = document.getElementById('rc2-login-screen');
    if (loginEl) loginEl.style.display = 'none';

    // Mostrar loading
    const loadingEl = document.getElementById('mvp-loading-screen');
    if (loadingEl) loadingEl.style.display = 'flex';

    // Ejecutar Bootstrap
    await BootstrapManager.run(account, token);

  } catch(err) {
    if (errEl) {
      errEl.textContent = 'Error al iniciar sesión: ' + (err.message || 'intente de nuevo');
      errEl.style.display = 'block';
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión con Microsoft'; }
    console.error('[RC2_doLogin] error:', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// RC2 — boot() reescrito
// Flujo definitivo:
//   MSAL → Bootstrap (usuarios+roles+config) → bootstrap.completed → datos negocio
//
// NUNCA carga datos de negocio antes del evento bootstrap.completed.
// NUNCA muestra el Dashboard a un usuario no autenticado.
// ═══════════════════════════════════════════════════════════════════════════
async function boot() {


  const loadingEl = document.getElementById('mvp-loading-screen');
  const loginEl   = document.getElementById('rc2-login-screen');

  // ── RC2.6: Cuando Bootstrap completa → cargar datos de negocio ──────────
  EventBus.subscribe('bootstrap.completed', async ({ role }) => {

    if (loadingEl) loadingEl.style.display = 'flex';
    try {
      // Solo aquí se llama ExcelProvider.loadData() (RC2.6)
      const loadOk = await DataService.reloadFromProvider();
      if (!loadOk) console.warn('[BOOT] reloadFromProvider() retornó false');


      // Iniciar sincronización automática (RC1 GL-5 preservado)
      SynchronizationManager.start((window.APP_CONFIG && window.APP_CONFIG.refreshInterval) || 10000);


    } catch(err) {
      console.error('[BOOT] error cargando datos de negocio:', err.code || err.message);
      const isConfig = err.code === 'EXCEL_NOT_CONFIGURED' || err.code === 'DATASOURCE_NOT_CONFIGURED';
      _showBootError(err.message, err.code, isConfig);
      if (loadingEl) loadingEl.style.display = 'none';
      return;
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
    _bootCore();
  });

  // ── Bootstrap fallido → error visible ────────────────────────────────────
  EventBus.subscribe('bootstrap.failed', ({ error, code }) => {
    if (loadingEl) loadingEl.style.display = 'none';
    _showBootError(error, code || 'BOOTSTRAP_ERROR', false);
  });

  // ── Modo de autenticación ─────────────────────────────────────────────────
  const authMode = (window.APP_CONFIG && window.APP_CONFIG.authenticationMode) || 'mock';

  if (authMode === 'msal') {
    // ── PRODUCCIÓN: flujo MSAL completo ─────────────────────────────────────
    try {
      const initialized = await AuthProvider.initialize();
      if (!initialized) {
        _showBootError('MSAL no pudo inicializarse — verificar configuración de Azure AD.', 'MSAL_INIT_FAILED', true);
        return;
      }

      if (AuthProvider.isAuthenticated()) {
        // Usuario ya autenticado (token en caché) → ir directo al Bootstrap

        if (loadingEl) loadingEl.style.display = 'flex';
        const account = AuthProvider.getAccount();
        let token = null;
        try { token = await AuthProvider.getToken(); } catch(e) { /* intentional: fallo no crítico en boot */ }
        await BootstrapManager.run(account, token);

      } else {
        // RC2.7: No autenticado → mostrar pantalla de login
        // El Dashboard permanece completamente vacío

        if (loadingEl) loadingEl.style.display = 'none';
        if (loginEl)   loginEl.style.display = 'flex';
        // El flujo continúa cuando el usuario hace clic en "Iniciar sesión"
        // → RC2_doLogin() → BootstrapManager.run() → bootstrap.completed → aquí
      }

    } catch(err) {
      console.error('[BOOT] error en autenticación MSAL:', err.message);
      _showBootError(err.message, err.code || 'MSAL_ERROR', false);
      if (loadingEl) loadingEl.style.display = 'none';
    }

  } else {
    // ── DESARROLLO: modo mock — Bootstrap inmediato sin MSAL ────────────────

    if (loadingEl) loadingEl.style.display = 'flex';

    const mockAccount = { username: state.user.email, name: state.user.name, tenantId: '' };

    // En modo mock, Bootstrap carga tablas vacías (no hay Excel) y usa los
    // PERMISSIONS hardcodeados como fallback
    try {
      const restored = SessionManager.restore();
      if (!restored) {
        // Crear sesión mock directamente
        SessionManager.create(mockAccount);
        SessionManager.applyToState();
      } else {
        SessionManager.applyToState();
      }
      // En mock, emitir bootstrap.completed directamente con rol del estado
      EventBus.publish('bootstrap.completed', {
        role: state.user.role,
        user: state.user.email,
      });
    } catch(err) {
      console.error('[BOOT] mock bootstrap error:', err.message);
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }
}

function _bootCore() {

  
  // Cargar tema, settings y notificaciones desde localStorage
  let savedTheme = loadFromStorage(STORAGE.theme, 'light');
  applyTheme(savedTheme);
  loadSettings();
  state.notifications = loadFromStorage(STORAGE.notifications, []);
  updateNotifBadge();
  loadLogos();
  
  // Landing hero — número de colaboradores único calculado en runtime
  const heroColabs = document.getElementById('hero-colabs');
  if (heroColabs) heroColabs.textContent = uniqueUsers();

  // Sidebar nav
  $$('.sb-item').forEach(t => t.addEventListener('click', () => goView(t.dataset.view)));
  
  // Filtros usuarios
  ['search-input','filter-empresa','filter-tipo','filter-tecnico','filter-proyecto','filter-estado'].forEach(id => {
    const el = $(id);
    if (el) { el.addEventListener('input', renderUsuarios); el.addEventListener('change', renderUsuarios); }
  });
  
  // Filtros reportes
  ['rep-filter-empresa','rep-filter-tipo','rep-filter-proyecto','rep-filter-tecnico'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', renderReportes);
  });
  
  // Filtros actividad
  ['act-filter-type','act-filter-cat'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', renderActivityLog);
  });
  
  goView('resumen');
  
  // Landing screen: NO se oculta automáticamente, requiere click en CTA
  // Atajo: Enter o Esc también activan enterDashboard
  document.addEventListener('keydown', (e) => {
    const landing = $('landing');
    if (landing && landing.style.display !== 'none' && !landing.classList.contains('entering')) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        enterDashboard();
      }
    }
  });
  // Botón preview visitante (visible solo para roles que tienen panel.preview)
  updatePreviewButton();
  updateAprobacionesItem();
  updateRoleBadge();
  updateSidebarByRole();
  // GH3.5: timer gestionado para evitar fuga de recursos
  const _approvalTimer = setInterval(updateAprobacionesItem, 5000);
  // El timer se cancela automáticamente cuando el usuario cierra la sesión
  EventBus.subscribe('session.logout', () => {
    clearInterval(_approvalTimer);
  });
  
  // Scroll-to-top
  const mainEl = $('main-scroll');
  const scrollBtn = $('scroll-top-btn');
  if (mainEl && scrollBtn) {
    mainEl.addEventListener('scroll', () => scrollBtn.classList.toggle('visible', mainEl.scrollTop > 300));
  }
  
  // Notificación inicial de carga
  setTimeout(() => {
    notify({ level: 'info', category: 'system', title: 'Sistema cargado', message: window.USERS.length + ' registros · ' + uniqueUsers() + ' usuarios únicos · listo para operar' });
  }, 1200);
  



}



// ── 01_obsolescence.js ──

// ═══════════════════════════════════════════════════════════════════
// F3 · ObsolescenceService
// Clasifica equipos según procesador → RAEE | Reasignable | Revisión manual
// Regla: Intel gen ≤ 10 → RAEE
// Soporta: Intel Core (i3/i5/i7/i9), Intel Core Ultra, Apple Silicon, AMD Ryzen
// ═══════════════════════════════════════════════════════════════════

const ObsolescenceService = {
  
  config: {
    raee_intel_threshold: 10, // Intel gen ≤ 10 = RAEE
  },
  
  // F3.1 · Acción requerida es un enum fijo, separado de la clasificación.
  ACCION_MAP: {
    'RAEE': 'Baja',
    'Reasignable': 'Reasignar',
    'Revisión manual': 'Revisar',
  },
  
  ACCION_DETALLE_MAP: {
    'RAEE': 'Enviar a baja tecnológica · obsoleto según política Intel ≤ gen ',
    'Reasignable': 'Disponible para evaluación y eventual reasignación',
    'Revisión manual': 'Validar manualmente el equipo · información insuficiente para clasificar',
  },
  
  /**
   * Extrae la generación de un procesador.
   * Retorna {generacion, vendor, family, raee_eligible}
   */
  parseGeneration(processor) {
    if (!processor || typeof processor !== 'string') {
      return { generacion: null, vendor: null, family: null, parsed: false };
    }
    
    const text = String(processor).trim();
    const lower = text.toLowerCase();
    
    // ── Apple Silicon (M1, M2, M3, M4, M5, etc.)
    // Apple M1 = equiv ~11, M2 = ~12, todos son modernos
    const apple = text.match(/(?:chip\s+)?M(\d+)\b/i);
    if (apple) {
      const m = parseInt(apple[1]);
      return {
        generacion: 10 + m, // M1 = 11, M2 = 12, M3 = 13...
        vendor: 'Apple',
        family: 'M' + m,
        parsed: true,
      };
    }
    
    // ── Intel Core Ultra (CiU, CIU, Core Ultra)
    // Modelo serie 100/200 = Meteor Lake/Arrow Lake (gen 14+)
    const coreUltra = text.match(/(?:ciu|core\s*ultra)\s*\d?[-\s]*(\d{3})/i);
    if (coreUltra) {
      return {
        generacion: 14, // Core Ultra series 1 = gen 14 equiv
        vendor: 'Intel',
        family: 'Core Ultra',
        parsed: true,
      };
    }
    
    // ── AMD Ryzen (cualquier Ryzen es moderno)
    if (/amd\s*r(yzen|i)|amdr/i.test(text)) {
      return {
        generacion: 12, // equivalencia conservadora con Intel gen 12+
        vendor: 'AMD',
        family: 'Ryzen',
        parsed: true,
      };
    }
    
    // ── "Nth Gen Intel" → ej: "11th Gen Intel(R) Core(TM)"
    const nthGen = text.match(/(\d{1,2})(?:st|nd|rd|th)\s*gen/i);
    if (nthGen) {
      return {
        generacion: parseInt(nthGen[1]),
        vendor: 'Intel',
        family: 'Core',
        parsed: true,
      };
    }
    
    // ── "Intel Core iX Gen N" explícito
    const explicitGen = text.match(/i[3579]\s*gen\s*(\d{1,2})/i);
    if (explicitGen) {
      return {
        generacion: parseInt(explicitGen[1]),
        vendor: 'Intel',
        family: 'Core',
        parsed: true,
      };
    }
    
    // ── Intel Core con modelo: iX-YZZZZ (4-5 dígitos)
    // i7-1165G7 → 1165 → gen 11 (primer 1-2 dígitos)
    // i7-10510U → 10510 → gen 10
    // i5-8250U → 8250 → gen 8
    // i9-13900K → 13900 → gen 13
    const intelModel = text.match(/i[3579][- ]?(\d{4,5})/i);
    if (intelModel) {
      const num = intelModel[1];
      let gen;
      if (num.length === 4) {
        // 4 dígitos: el primer dígito es la generación (Y → 8250 = gen 8)
        gen = parseInt(num[0]);
      } else {
        // 5 dígitos: los primeros 2 son la generación (10510 = gen 10)
        gen = parseInt(num.substring(0, 2));
      }
      return {
        generacion: gen,
        vendor: 'Intel',
        family: 'Core',
        parsed: true,
      };
    }
    
    // ── Sin reconocimiento
    return {
      generacion: null,
      vendor: null,
      family: null,
      parsed: false,
    };
  },
  
  /**
   * Clasifica un procesador en RAEE, Reasignable o Revisión manual.
   * Retorna objeto completo con generacion, clasificacion, accion.
   */
  classify(processor) {
    const parsed = this.parseGeneration(processor);
    
    let clasificacion, generacion, vendor, family;
    
    if (!parsed.parsed) {
      clasificacion = 'Revisión manual';
      generacion = null; vendor = null; family = null;
    } else if (parsed.vendor === 'Intel' && parsed.family === 'Core' &&
        parsed.generacion <= this.config.raee_intel_threshold) {
      clasificacion = 'RAEE';
      generacion = parsed.generacion; vendor = parsed.vendor; family = parsed.family;
    } else {
      clasificacion = 'Reasignable';
      generacion = parsed.generacion; vendor = parsed.vendor; family = parsed.family;
    }
    
    const accion = this.ACCION_MAP[clasificacion];
    const accionDetalle = this.ACCION_DETALLE_MAP[clasificacion] +
      (clasificacion === 'RAEE' ? this.config.raee_intel_threshold : '');
    
    return {
      procesador: processor || '',
      generacion: generacion,
      vendor: vendor,
      family: family,
      // F3.1 · campos separados (contrato nuevo)
      clasificacion_obsolescencia: clasificacion,
      generacion_cpu: generacion,
      accion_requerida: accion,        // enum fijo: Baja | Reasignar | Revisar
      accion_detalle: accionDetalle,   // texto descriptivo para UI
      // legacy (compat v8.3 — no romper código existente)
      clasificacion: clasificacion,
      accion: accionDetalle,
    };
  },
  
  /**
   * Reclasifica un registro completo y devuelve los campos a actualizar.
   */
  classifyRecord(record) {
    if (!record) return null;
    const result = this.classify(record.eq_ant_procesador);
    return {
      eq_ant_generacion: result.generacion,
      estado_eq_ant: result.clasificacion,
      clasificacion_raee: result.clasificacion === 'RAEE',
      // F3.1 · campos separados
      clasificacion_obsolescencia: result.clasificacion_obsolescencia,
      generacion_cpu: result.generacion_cpu,
      accion_requerida: result.accion_requerida,
      accion_detalle: result.accion_detalle,
      _obsolescence_meta: {
        vendor: result.vendor,
        family: result.family,
        auto_classified: true,
      },
    };
  },
  
  /**
   * Override manual de la clasificación (con auditoría).
   */
  overrideClassification(recordId, newClassification, user, reason) {
    const valid = ['RAEE', 'Reasignable', 'Revisión manual'];
    if (valid.indexOf(newClassification) < 0) {
      throw new Error('Clasificación inválida: ' + newClassification);
    }
    const record = DataService.getRenewal(recordId);
    if (!record) throw new Error('Registro no encontrado');
    
    const before = {
      estado_eq_ant: record.estado_eq_ant,
      clasificacion_raee: record.clasificacion_raee,
      accion_requerida: record.accion_requerida,
    };
    const accion = this.ACCION_MAP[newClassification];
    const accionDetalle = this.ACCION_DETALLE_MAP[newClassification] +
      (newClassification === 'RAEE' ? this.config.raee_intel_threshold : '') + ' · clasificación manual';
    const changes = {
      estado_eq_ant: newClassification,
      clasificacion_raee: newClassification === 'RAEE',
      clasificacion_obsolescencia: newClassification,
      accion_requerida: accion,
      accion_detalle: accionDetalle,
      _obsolescence_meta: {
        manual_override: true,
        override_reason: reason || '',
        override_by: user.name || user.id,
        override_at: new Date().toISOString(),
      },
    };
    
    DataService.updateRenewal(recordId, changes, user);
    return { before, after: changes };
  },
  
  /**
   * Análisis bulk: estadísticas del dataset por clasificación.
   */
  getStats() {
    const stats = { RAEE: 0, Reasignable: 0, 'Revisión manual': 0, total: 0 };
    window.USERS.forEach(r => {
      if (r.es_backup) return;
      stats.total++;
      const cls = r.estado_eq_ant || 'Revisión manual';
      if (stats[cls] !== undefined) stats[cls]++;
    });
    return stats;
  },
};

window.ObsolescenceService = ObsolescenceService;


// ── 02_approval.js ──

// ═══════════════════════════════════════════════════════════════════
// F3 · ApprovalService
// Maneja el checklist obligatorio de cierre + solicitud de validación
// 6 puntos: eq nuevo entregado · eq antiguo recibido · acta firmada
//           · evidencia adjunta · información completa · feedback registrado
// ═══════════════════════════════════════════════════════════════════

const ApprovalService = {
  
  /** Los 6 puntos del checklist obligatorio */
  CHECKLIST_RULES: [
    {
      id: 'eq_nvo_entregado',
      label: 'Equipo nuevo entregado',
      description: 'Estado >= Entregado equipo nuevo · serial registrado',
      check: (r) => {
        const estado = (r.estado || '').toLowerCase();
        const isDelivered = estado.indexOf('entregado') >= 0 ||
                           estado.indexOf('recoger') >= 0 ||
                           estado.indexOf('antiguo recibido') >= 0 ||
                           estado.indexOf('completada') >= 0 ||
                           estado.indexOf('aprobaci') >= 0 ||
                           estado === 'cerrado' ||
                           estado === 'feedback';
        return isDelivered && !!(r.eq_nvo_serial || r.serial);
      },
    },
    {
      id: 'eq_ant_recibido',
      label: 'Equipo anterior recibido físicamente',
      description: 'Confirmación en bodega · fecha registrada',
      check: (r) => !!(r.recibido_bodega || r.equipo_devuelto ||
                       (r.devuelto && r.devuelto !== 'NO') ||
                       (r.fecha_recepcion_bodega) ||
                       (r.fecha_devolucion)),
    },
    {
      id: 'acta_firmada',
      label: 'Acta de entrega firmada',
      description: 'PandaDoc · firma del usuario receptor',
      check: (r) => !!(r.acta_firmada === true || r.acta_firmada === 'SI'),
    },
    {
      id: 'evidencia_adjunta',
      label: 'Evidencia documental adjunta',
      description: 'Archivo de soporte (foto / pdf / acta escaneada)',
      check: (r) => !!(r.evidencia_adjunta === true && r.nombre_archivo),
    },
    {
      id: 'info_completa',
      label: 'Información del equipo nuevo completa',
      description: 'Serial, modelo, AF, placa, hostname',
      check: (r) => {
        const fields = [
          r.eq_nvo_serial || r.serial,
          r.eq_nvo_modelo || r.modelo,
          r.eq_nvo_marca || r.marca,
          r.eq_nvo_hostname || r.hostname,
        ];
        // Al menos 3 de 4 llenos
        return fields.filter(Boolean).length >= 3;
      },
    },
    {
      id: 'feedback_registrado',
      label: 'Feedback del usuario registrado',
      description: 'Encuesta de satisfacción (1-5 estrellas)',
      check: (r) => (r.feedback || 0) > 0 || (r.feedback_recibido && r.feedback_recibido !== 'NO'),
    },
  ],
  
  /**
   * Evalúa los 6 puntos contra un registro.
   * Retorna {checklist: [{id, label, ok}], allOk: bool, missing: []}
   */
  evaluate(record) {
    const checklist = this.CHECKLIST_RULES.map(rule => ({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      ok: !!rule.check(record),
    }));
    const missing = checklist.filter(c => !c.ok);
    return {
      checklist: checklist,
      allOk: missing.length === 0,
      missing: missing,
      okCount: checklist.length - missing.length,
      total: checklist.length,
    };
  },
  
  /**
   * Verifica si el registro puede solicitar validación de cierre.
   * Requiere: estado >= "Equipo antiguo recibido" y permiso.
   */
  canRequestValidation(record, user) {
    if (!can('renewal.submitApproval')) return { ok: false, reason: 'Sin permisos para solicitar cierre' };
    if (!record) return { ok: false, reason: 'Registro no encontrado' };
    if (record.estado === StateMachine.states.CERRADO) return { ok: false, reason: 'La renovación ya está cerrada' };
    if (record.estado === StateMachine.states.PENDIENTE_APROBACION) return { ok: false, reason: 'Ya está pendiente de aprobación' };
    if (record.estado === StateMachine.states.BLOQUEADO) return { ok: false, reason: 'El registro está bloqueado, primero desbloquéalo' };
    return { ok: true };
  },
  
  /**
   * Solicita validación de cierre. Si el checklist es 6/6:
   * → estado pasa a "Pendiente aprobación"
   * Si falta algún punto:
   * → estado pasa a "Corrección requerida" + razón
   */
  requestValidation(recordId, user) {
    user = user || state.user;
    const record = DataService.getRenewal(recordId);
    if (!record) throw new Error('Registro no encontrado');
    
    const can = this.canRequestValidation(record, user);
    if (!can.ok) throw new Error(can.reason);
    
    const evaluation = this.evaluate(record);
    
    if (evaluation.allOk) {
      // Todo cumple → Pendiente aprobación
      const fromState = record.estado;
      record.estado = StateMachine.states.PENDIENTE_APROBACION;
      DataService._appendAudit(record, [
        makeAuditEntry(user, 'estado', fromState, StateMachine.states.PENDIENTE_APROBACION,
          { trigger: 'requestValidation', checklist: '6/6 cumplido' }),
      ]);
      DataService._appendTimeline(record, makeTimelineEvent(user, fromState, StateMachine.states.PENDIENTE_APROBACION,
        '✓ Validación solicitada · checklist 6/6 cumplido · esperando aprobación'));
      
      record.validacion_solicitada_at = new Date().toISOString();
      record.validacion_solicitada_por = user.name || user.id;
      
      notify({
        level: 'warning', category: 'state',
        title: 'Validación de cierre solicitada',
        message: (record.nombre || 'ID ' + record.id) + ' · pendiente de aprobación por Gestor de Activos',
        recordId: record.id,
      });
      
      return { ok: true, status: 'pending_approval', evaluation, record };
      
    } else {
      // Falta algo → Corrección requerida
      const fromState = record.estado;
      record.estado = StateMachine.states.CORRECCION_REQUERIDA;
      record._missing_items = evaluation.missing.map(m => m.label);
      
      DataService._appendAudit(record, [
        makeAuditEntry(user, 'estado', fromState, StateMachine.states.CORRECCION_REQUERIDA,
          { trigger: 'requestValidation', missing: evaluation.missing.map(m => m.id) }),
      ]);
      DataService._appendTimeline(record, makeTimelineEvent(user, fromState, StateMachine.states.CORRECCION_REQUERIDA,
        '✗ Validación rechazada por checklist · falta: ' + evaluation.missing.map(m => m.label).join(' · ')));
      
      notify({
        level: 'critical', category: 'state',
        title: 'Corrección requerida',
        message: 'Faltan ' + evaluation.missing.length + ' de 6 puntos del checklist',
        recordId: record.id,
      });
      
      return { ok: false, status: 'correction_required', evaluation, record };
    }
  },
  
  /**
   * Aprobación final por gestor_activos/super_admin.
   * Solo aplica si el registro está en "Pendiente aprobación".
   */
  approve(recordId, user) {
    user = user || state.user;
    requirePermission('renewal.approve');
    const record = DataService.getRenewal(recordId);
    if (!record) throw new Error('Registro no encontrado');
    if (record.estado !== StateMachine.states.PENDIENTE_APROBACION) {
      throw new Error('Solo se aprueban renovaciones en estado Pendiente aprobación');
    }
    
    // Re-validar checklist en el momento de aprobar (por seguridad)
    const evaluation = this.evaluate(record);
    if (!evaluation.allOk) {
      throw new Error('No se puede aprobar: ' + evaluation.missing.length + ' puntos del checklist están incompletos');
    }
    
    record.estado = StateMachine.states.CERRADO;
    record.approval = {
      status: 'approved',
      by: user.name,
      by_id: user.id,
      at: new Date().toISOString(),
      reason: '',
    };
    
    DataService._appendAudit(record, [
      makeAuditEntry(user, 'estado', StateMachine.states.PENDIENTE_APROBACION, StateMachine.states.CERRADO,
        { approved: true }),
    ]);
    DataService._appendTimeline(record, makeTimelineEvent(user,
      StateMachine.states.PENDIENTE_APROBACION, StateMachine.states.CERRADO, '✓ Cierre aprobado por ' + user.name));
    
    notify({
      level: 'info', category: 'state',
      title: 'Renovación cerrada',
      message: (record.nombre || 'ID ' + record.id) + ' · aprobada y cerrada',
      recordId: record.id,
    });
    
    return record;
  },
  
  /**
   * Rechazo con motivo obligatorio.
   */
  reject(recordId, reason, user) {
    user = user || state.user;
    requirePermission('renewal.reject');
    if (!reason || !reason.trim()) throw new Error('El motivo del rechazo es obligatorio');
    const record = DataService.getRenewal(recordId);
    if (!record) throw new Error('Registro no encontrado');
    if (record.estado !== StateMachine.states.PENDIENTE_APROBACION) {
      throw new Error('Solo se rechazan renovaciones en estado Pendiente aprobación');
    }
    
    record.estado = StateMachine.states.CORRECCION_REQUERIDA;
    record.approval = {
      status: 'rejected',
      by: user.name,
      by_id: user.id,
      at: new Date().toISOString(),
      reason: reason,
    };
    
    DataService._appendAudit(record, [
      makeAuditEntry(user, 'estado', StateMachine.states.PENDIENTE_APROBACION, StateMachine.states.CORRECCION_REQUERIDA,
        { rejected: true, reason: reason }),
    ]);
    DataService._appendTimeline(record, makeTimelineEvent(user,
      StateMachine.states.PENDIENTE_APROBACION, StateMachine.states.CORRECCION_REQUERIDA,
      '✗ Cierre rechazado: ' + reason));
    
    notify({
      level: 'critical', category: 'state',
      title: 'Cierre rechazado',
      message: (record.nombre || 'ID ' + record.id) + ' · motivo: ' + reason,
      recordId: record.id,
    });
    
    return record;
  },
  
  /**
   * Devuelve todos los registros en Pendiente aprobación.
   */
  getQueue() {
    return window.USERS.filter(r =>
      !r.es_backup &&
      r.estado === StateMachine.states.PENDIENTE_APROBACION
    );
  },
  
  /**
   * Devuelve registros en Corrección requerida (volvieron a manos del técnico).
   */
  getRejected() {
    return window.USERS.filter(r =>
      !r.es_backup &&
      r.estado === StateMachine.states.CORRECCION_REQUERIDA
    );
  },
};

window.ApprovalService = ApprovalService;


// ── 03_kpi_notif_config.js ──

// ═══════════════════════════════════════════════════════════════════
// F3 · APP_CONFIG (configuración global)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// F3.5 · ConfigService — fuente única de reglas modificables
// Lee CONFIGURACION.json (ya embebido en window.CONFIGURATION) para
// parámetros de negocio. APP_CONFIG (infraestructura) se mantiene separado.
// Ningún componente visual debe hardcodear estas reglas — las consume
// desde aquí para que cambios de configuración no requieran editar UI.
// ═══════════════════════════════════════════════════════════════════
const ConfigService = (() => {

  // Leer CONFIGURACION.json una vez
  const cfg = {};
  if (window.CONFIGURATION && Array.isArray(window.CONFIGURATION)) {
    window.CONFIGURATION.forEach(c => { cfg[c.Parametro] = c.Valor; });
  }

  // ── 1. Parámetros de negocio (provienen de CONFIGURACION.json)
  const RAEE_INTEL_THRESHOLD = parseInt(cfg['generacion_raee_intel'] || '10', 10);
  const ESTADO_INICIAL       = cfg['estado_inicial']     || 'Pendiente';
  const ARCHIVO_MAESTRO      = cfg['archivo_maestro']    || 'Plan_Maestro_REN26.xlsx';
  const REFRESH_INTERVAL_MS  = (() => {
    const v = cfg['refresh_dashboard'] || '20 segundos';
    const n = parseInt(v, 10);
    return (isNaN(n) ? 20 : n) * 1000;
  })();

  // ── 2. Estados del proceso REN26 (fuente: StateMachine — se exponen aquí
  //       para que los componentes los lean sin importar StateMachine directamente)
  const getStates = () => ({
    ...STATES,
    FEEDBACK: StateMachine.states.FEEDBACK || 'Feedback',
  });
  const getFlow   = () => STATE_FLOW.slice();

  // ── 3. Clasificaciones RAEE — valores permitidos como enum
  const CLASIFICACIONES_RAEE = ['RAEE', 'Reasignable', 'Revisión manual'];

  // ── 4. Disposición final del equipo anterior — valores permitidos
  // F3.6 · Disposición final — 4 valores del spec de negocio
  const DISPOSICION_FINAL_OPTS = [
    '',
    'Venta interna empleado',
    'Reasignación interna',
    'Baja RAEE',
    'Pendiente evaluación',
  ];

  // F3.6 · Estado de entrega del equipo nuevo — entidad física independiente del proceso REN26
  const ESTADO_ENTREGA_EQ_NVO = [
    '',
    'Pendiente',
    'Alistado',
    'En tránsito',
    'Entregado',
    'Completado',
  ];

  // ── 5. Categorías de bloqueo
  const CATEGORIAS_BLOQUEO = [
    { value: 'Usuario',       label: 'Usuario no contesta / no disponible' },
    { value: 'Logística',     label: 'Logística / envío' },
    { value: 'Equipo',        label: 'Equipo nuevo defectuoso / faltante' },
    { value: 'Documentación', label: 'Documentación / acta' },
    { value: 'Aprobación',    label: 'Aprobación externa pendiente' },
    { value: 'Otro',          label: 'Otro' },
  ];

  // ── 6. Helper: clase CSS de badge a partir de un estado
  //       Centraliza el patrón toLowerCase().replace(/\s/g,'-') que estaba
  //       duplicado 4 veces en el código.
  const badgeClass = (estado, prefix = 'badge-') => {
    if (!estado) return prefix + 'pendiente';
    return prefix + String(estado).toLowerCase().replace(/[\s/]+/g, '-');
  };

  // ── 7. Registros de nivel de renovación (Registro/Nivel) — 5 valores reales
  const NIVELES_REGISTRO = [
    'Nivel 1 - Analista / Operativo (Asistentes, recepción, apoyo administrativo y cargos operativos).',
    'Nivel 2 - Consultor / Profesional (Consultores, PMO, coordinadores y personal con contacto frecuente con clientes o gestión de proyectos).',
    'Nivel 3 - Desarrollo / Técnico Especializado (Desarrolladores, ingenieros y personal técnico que ejecuta compilaciones, entornos virtuales, bases de datos o herramientas especializadas).',
    'Nivel 4 - Diseño / Creativo',
    'Nivel 5 - Gerencial / VIP (Gerencia, dirección, presidencia y cargos estratégicos que requieren alta movilidad, seguridad avanzada y representación corporativa).',
  ];

  return {
    // Parámetros de CONFIGURACION.json
    RAEE_INTEL_THRESHOLD,
    ESTADO_INICIAL,
    ARCHIVO_MAESTRO,
    REFRESH_INTERVAL_MS,

    // Enums de negocio
    CLASIFICACIONES_RAEE,
    DISPOSICION_FINAL_OPTS,
    ESTADO_ENTREGA_EQ_NVO,
    CATEGORIAS_BLOQUEO,
    NIVELES_REGISTRO,

    // Helpers UI
    badgeClass,

    // Accesores de estado (para que F4/F5 no importe StateMachine directamente)
    getStates,
    getFlow,

    // Fuente cruda (para debug/admin)
    _raw: cfg,
  };
})();
window.ConfigService = ConfigService;

// Sincronizar ObsolescenceService con el threshold de CONFIGURACION.json
// (antes estaba hardcodeado en 10; ahora lo lee ConfigService que viene del JSON)
if (window.ObsolescenceService) {
  ObsolescenceService.config.raee_intel_threshold = ConfigService.RAEE_INTEL_THRESHOLD;
}


// ════════════════════════════════════════════════════════════════════
// RC1 · PRODUCTION_CONFIG — única fuente de verdad para IDs y modos
// Todos los IDs de Microsoft y el modo de operación se definen aquí.
// No existen IDs ni modos de autenticación en ningún otro lugar.
// ════════════════════════════════════════════════════════════════════
// PRODUCTION_CONFIG cargado desde js/config.js (RC3.3)
// Toda la app lee desde window.PRODUCTION_CONFIG

window.APP_CONFIG = (() => {
  // RC1: APP_CONFIG se construye desde PRODUCTION_CONFIG (fuente única de verdad)
  const PC = window.PRODUCTION_CONFIG || {};
  return {
    applicationName: 'PMC-TI REN26',
    environment:     PC.dataSource === 'excel' ? 'production' : 'development',
    dataSource:           PC.dataSource         || 'mock',
    authenticationMode:   PC.authenticationMode || 'mock',
    debug:                PC.debug              || false,
    sharePoint: {
      siteId:       PC.siteId       || null,
      driveId:      PC.driveId      || null,
      itemId:       PC.itemId       || null,
      siteHostname: null,
      sitePath:     null,
      listId:       null,
      listName:     'REN26_Renovaciones',
    },
    refreshInterval:    PC.refreshInterval    || 10000,
    notifications:      true,
    notificationSound:  true,
    raee_intel_threshold: 10,
    archivoMaestro:     PC.workbookName       || 'Plan_Maestro_REN26.xlsx',
    version:            PC._version           || 'v8.8.4-RC1',
    tenantId:           PC.tenantId,
    clientId:           PC.clientId,
  };
})();
// F3.5 · Sincronizar refreshInterval desde CONFIGURACION.json (via ConfigService)
window.APP_CONFIG.refreshInterval = ConfigService.REFRESH_INTERVAL_MS;
window.APP_CONFIG.raee_intel_threshold = ConfigService.RAEE_INTEL_THRESHOLD;

// ═══════════════════════════════════════════════════════════════════
// F3 · KPIService (métricas agregadas, dominio puro)
// ═══════════════════════════════════════════════════════════════════
