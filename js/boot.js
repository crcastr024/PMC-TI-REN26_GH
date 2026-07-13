// ════════════════════════════════════════════════════════════════════
// js/boot.js — PMC-TI-REN26 GH1
// BootstrapManager, boot(), RC2_doLogin, _showBootError, _bootCore
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════
// GH3.37 — _applyRBAC: Control de acceso basado en roles
// ════════════════════════════════════════════════════════════════════
function _applyRBAC(role, userEmail) {
  // ── RBAC-01/02: Resolver nombre real del usuario desde PMC_USUARIOS ──────
  var sysUsers = window.SYSTEM_USERS || [];
  var lower    = (userEmail || '').toLowerCase().trim();
  // GH3.37.1 Item 5: prioridad Azure OID → email exacto → prefijo → UPN → fallback
  var account  = (window.state && state.user && state.user._msalAccount) || {};
  var oid      = account.localAccountId || account.homeAccountId || '';
  var sysUser  = (oid ? sysUsers.find(function(u){ return u.oid && u.oid === oid; }) : null)
              || sysUsers.find(function(u){ return u.correo && u.correo.toLowerCase() === lower; })
              || sysUsers.find(function(u) {
                   var pre = (u.correo || '').toLowerCase().split('@')[0];
                   return pre === lower.split('@')[0];
                 })
              || sysUsers.find(function(u){
                   return u.upn && u.upn.toLowerCase() === lower;
                 });

  // ── RBAC-05: Mostrar nombre real en el sidebar ────────────────────────────
  var displayName = (sysUser && (sysUser.nombre || sysUser.name)) || (userEmail || 'Usuario');
  var nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = displayName;
  // Actualizar state.user si no tiene nombre
  if (window.state && state.user && !state.user.nombre) state.user.nombre = displayName;

  // ── RBAC-02: Asignar técnico desde el Excel si está definido ──────────────
  if (sysUser && sysUser.tecnico) {
    if (window.state && state.user) state.user.esTecnico = sysUser.tecnico;
  }

  // ── RBAC-03: Ocultar vistas por rol ──────────────────────────────────────
  // roles técnico / consulta / visitante no acceden a vistas ejecutivas
  // GH3.39.1 FC-11: Técnico puede ver panel-ejecutivo — solo se restringe admin/permisos
  var RESTRICTED_VIEWS = ['aprobaciones', 'roles', 'configuracion', 'reportes-ejecutivos', 'administracion', 'permisos'];
  var isTecnico  = (role === 'tecnico');
  var isConsulta = (role === 'consulta' || role === 'visitante');
  var isRestricted = isTecnico || isConsulta;

  if (isRestricted) {
    // Ocultar items del nav para roles restringidos
    document.querySelectorAll('.sb-item').forEach(function(item) {
      var view = item.dataset && item.dataset.view;
      if (view && RESTRICTED_VIEWS.some(function(rv) { return view.indexOf(rv) >= 0; })) {
        item.style.display = 'none';
      }
    });
  }

  // ── RBAC-04: Ocultar el role-switcher para todos excepto Super Admin ──────
  var isSuperAdmin = (role === 'super_admin');
  var switcher = document.querySelector('[onclick*="switchRole"], #role-switcher-btn, .role-switcher-btn');
  var switcherMenu = document.getElementById('role-switcher-menu');
  var tbRoleLabel  = document.getElementById('tb-role-label');

  if (!isSuperAdmin) {
    // Ocultar completamente el role switcher (no solo deshabilitar)
    if (switcher)     switcher.style.display = 'none';
    if (switcherMenu) switcherMenu.style.display = 'none';
    // Ocultar el contenedor del switcher en el topbar
    var tbRoleContainer = tbRoleLabel && tbRoleLabel.parentElement;
    if (tbRoleContainer && tbRoleContainer.querySelector('[onclick*="switchRole"]')) {
      tbRoleContainer.style.display = 'none';
    }
    // Ocultar también el label de rol en el topbar si el toggle no existe
    if (tbRoleLabel && !isSuperAdmin) tbRoleLabel.style.display = 'none';
  }
}

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
  // GH3.18: _loadConfiguration() eliminada — CONFIGURATION fue dead code:
  // ConfigService inicializa (línea 927) ANTES de que _loadConfiguration() rellene
  // window.CONFIGURATION. _updateConfig no existía. 4 parámetros sin efecto real.
  // Ver análisis completo en GH3.18.

  // ── Paso 5+6: Crear sesión ───────────────────────────────────────────────
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

      // Paso 5+6: crear sesión RC2.5 completa
      // GH3.18: config eliminado — CONFIGURATION era dead code
      _createSession(account, role, permissions, {}, token);

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
  EventBus.subscribe('bootstrap.completed', async ({ role, user: _authUser }) => {
  const payload = { role, user: _authUser };

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

    // GH3.37 RBAC-01/02/03/04/05: Aplicar RBAC después de cargar datos
    _applyRBAC(role, payload && payload.user);

    // GH3.37.1 Item 12: Verificación de integridad post-boot (no bloquea)
    setTimeout(function() {
      if (window.IntegrityService) IntegrityService.verify();
    }, 500);
  });

  // ── Bootstrap fallido → error visible ────────────────────────────────────
  EventBus.subscribe('bootstrap.failed', ({ error, code }) => {
    if (loadingEl) loadingEl.style.display = 'none';
    _showBootError(error, code || 'BOOTSTRAP_ERROR', false);
  });

  // ── Modo de autenticación ─────────────────────────────────────────────────
  // GH3.37.4 BR-08: sin fallback a mock — MSAL siempre si APP_CONFIG no está listo
  const authMode = (window.APP_CONFIG && window.APP_CONFIG.authenticationMode) || 'msal';

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
    // GH3.37.4 BR-05: modo mock eliminado — no se permite iniciar sin autenticación
    console.error('[BOOT] authenticationMode no reconocido:', authMode, '— se requiere MSAL');
    _showBootError(
      'Modo de autenticación no válido. Se requiere Azure AD. Verifica la configuración.',
      'AUTH_MODE_INVALID',
      true
    );
    if (loadingEl) loadingEl.style.display = 'none';
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


// ════════════════════════════════════════════════════════════════════
// GH3.37.1 Item 7 — CPUFamilyParser
// Motor modular de identificación de arquitecturas de procesador.
// Extensible: agregar nuevas familias sin tocar el resto del código.
// ════════════════════════════════════════════════════════════════════
const CPUFamilyParser = {

  // Tabla de familias — orden importa (más específico primero)
  families: [
    {
      id: 'snapdragon_x',
      test: function(c) { return /snapdragon\s*x/i.test(c); },
      parse: function(c) {
        var elite = /elite/i.test(c);
        return { vendor:'Qualcomm', family: elite?'Snapdragon X Elite':'Snapdragon X Plus',
                 gen: elite?17:16, npu:true };
      },
    },
    {
      id: 'apple_silicon',
      test: function(c) { return /apple|\bm[1-9]\b/i.test(c) && !/intel|amd|ryzen/i.test(c); },
      parse: function(c) {
        var m = c.match(/\bM(\d+)\b/i);
        var n = m ? parseInt(m[1]) : 1;
        return { vendor:'Apple', family:'Apple M'+n, gen:10+n, npu:n>=3 };
      },
    },
    {
      id: 'intel_core_ultra_200',  // Lunar Lake / Arrow Lake — serie 200+
      test: function(c) {
        var m = c.match(/(?:ciu|core\s*ultra)\s*(?:\d\s*)?([2-9]\d{2})\b/i);
        return !!m;
      },
      parse: function(c) {
        var m = c.match(/(?:ciu|core\s*ultra)\s*(?:\d\s*)?([2-9]\d{2})/i);
        return { vendor:'Intel', family:'Core Ultra 200', gen:15, npu:true };
      },
    },
    {
      id: 'intel_core_ultra_100',  // Meteor Lake — serie 100
      test: function(c) { return /(?:ciu|core\s*ultra)/i.test(c); },
      parse: function(c) {
        return { vendor:'Intel', family:'Core Ultra 100', gen:14, npu:true };
      },
    },
    {
      id: 'amd_ryzen_ai',
      test: function(c) { return /ryzen\s*ai|amd\s*ai/i.test(c); },
      parse: function(c) {
        return { vendor:'AMD', family:'Ryzen AI', gen:15, npu:true };
      },
    },
    {
      id: 'amd_ryzen',
      test: function(c) { return /amd\s*r(yzen|i)|amdr/i.test(c); },
      parse: function(c) {
        var m = c.match(/ryzen\s*\d?\s*(\d{4})/i);
        if (m) {
          var rgen = Math.floor(parseInt(m[1]) / 1000);
          return { vendor:'AMD', family:'Ryzen', gen: 12 + Math.min(rgen-5, 4), npu:false };
        }
        return { vendor:'AMD', family:'Ryzen', gen:12, npu:false };
      },
    },
    {
      id: 'intel_nth_gen',
      test: function(c) { return /\d{1,2}(?:st|nd|rd|th)\s*gen/i.test(c); },
      parse: function(c) {
        var m = c.match(/(\d{1,2})(?:st|nd|rd|th)\s*gen/i);
        return { vendor:'Intel', family:'Core', gen: parseInt(m[1]), npu:false };
      },
    },
    {
      id: 'intel_core_classic',    // iX-YZZZZ modelo 4-5 dígitos
      test: function(c) { return /i[3579][- ]?\d{4,5}/i.test(c); },
      parse: function(c) {
        var m = c.match(/i[3579][- ]?(\d{4,5})/i);
        var num = m[1];
        var gen;
        if (num.length === 4) {
          var td = parseInt(num.substring(0,2));
          gen = (td >= 10 && td <= 19) ? td : parseInt(num[0]);
        } else {
          gen = parseInt(num.substring(0,2));
        }
        return { vendor:'Intel', family:'Core', gen:gen, npu:false };
      },
    },
  ],

  parse: function(processor) {
    if (!processor || typeof processor !== 'string') return null;
    // Normalizar: quitar marcas (R)/(TM) de Windows
    var clean = processor.replace(/\(R\)|\(TM\)|\(tm\)|\(r\)/gi, '')
                          .replace(/\s+/g, ' ').trim();
    for (var i=0; i<this.families.length; i++) {
      if (this.families[i].test(clean)) {
        var result = this.families[i].parse(clean);
        result.parsed = true;
        return result;
      }
    }
    return { vendor:null, family:null, gen:null, npu:false, parsed:false };
  },

  // Añadir una familia nueva en tiempo de ejecución (extensibilidad)
  register: function(familyDef) {
    this.families.unshift(familyDef);
  },
};
window.CPUFamilyParser = CPUFamilyParser;

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
    // GH3.37.1 Item 7: delegar al CPUFamilyParser modular
    if (window.CPUFamilyParser) {
      var r = CPUFamilyParser.parse(processor);
      if (r && r.parsed) {
        return { generacion: r.gen, vendor: r.vendor, family: r.family, npu: r.npu, parsed: true };
      }
      return { generacion: null, vendor: null, family: null, parsed: false };
    }
    
    const text = String(processor).trim();
    const lower = text.toLowerCase();
    // GH3.37 RAEE-05: Normalizar marcas registradas de Windows
    // "Intel(R) Core(TM) Ultra 7 155H" → "Intel Core Ultra 7 155H"
    const clean = text.replace(/\(R\)|\(TM\)|\(tm\)|\(r\)/gi, '').replace(/\s+/g, ' ').trim();
    const cleanLower = clean.toLowerCase();

    // ── GH3.37 RAEE-03: Snapdragon X (Qualcomm) ────────────────────────────
    // Snapdragon X Elite / Snapdragon X Plus → muy moderno 2024+
    if (/snapdragon\s*x/i.test(text)) {
      const isElite = /elite/i.test(text);
      return {
        generacion: isElite ? 17 : 16, // equivalente gen 16-17 (ARM, NPU integrada)
        vendor: 'Qualcomm',
        family: 'Snapdragon X' + (isElite ? ' Elite' : ' Plus'),
        npu: true,
        parsed: true,
      };
    }

    // ── Apple Silicon (M1, M2, M3, M4, M5, etc.) ────────────────────────────
    const apple = clean.match(/(?:chip\s+)?M(\d+)(?:\s+(?:Pro|Max|Ultra|Nano))?\b/i);
    if (apple) {
      const m = parseInt(apple[1]);
      return {
        generacion: 10 + m, // M1 = 11, M2 = 12, M3 = 13, M4 = 14
        vendor: 'Apple',
        family: 'Apple M' + m,
        npu: m >= 3, // M3+ tienen NPU integrada
        parsed: true,
      };
    }

    // ── GH3.37 RAEE-01: Intel Core Ultra (Meteor Lake / Lunar Lake / Arrow Lake)
    // GH3.37 RAEE-05: Soporta "(TM)" mediante clean
    const coreUltra = clean.match(/(?:ciu|core\s*ultra)\s*(\d)\s*(\d{3})/i);
    if (coreUltra) {
      const modelNum = parseInt(coreUltra[2]);
      // Serie 100 = Meteor Lake (2024), Serie 200 = Lunar/Arrow Lake (2024-2025)
      const series = modelNum < 200 ? 100 : 200;
      const gen    = series === 200 ? 15 : 14;
      return {
        generacion: gen,
        vendor: 'Intel',
        family: 'Core Ultra ' + (series === 200 ? '200' : '100'),
        npu: true, // Core Ultra tiene NPU integrada
        parsed: true,
      };
    }
    // Variante sin número de tier: "Core Ultra 155H", "Core Ultra 258V"
    const coreUltra2 = clean.match(/(?:ciu|core\s*ultra)\s*(\d{3})/i);
    if (coreUltra2) {
      const modelNum = parseInt(coreUltra2[1]);
      const gen = modelNum >= 200 ? 15 : 14;
      return { generacion: gen, vendor: 'Intel', family: 'Core Ultra', npu: true, parsed: true };
    }

    // ── GH3.37 RAEE-02: AMD Ryzen AI (Strix Point, Krackan, etc.) ───────────
    if (/ryzen\s*ai/i.test(clean) || /amd\s*ai/i.test(clean)) {
      return {
        generacion: 15, // Ryzen AI 300/400 = 2024-2025, equivalente Lunar Lake
        vendor: 'AMD',
        family: 'Ryzen AI',
        npu: true,
        parsed: true,
      };
    }
    
    // ── GH3.37 RAEE-02: AMD Ryzen (gen estándar) ────────────────────────────
    if (/amd\s*r(yzen|i)|amdr/i.test(clean)) {
      // Intentar extraer número de serie: Ryzen 7 7840U → 7840 → gen 7xxx → gen 2024
      const ryzenModel = clean.match(/ryzen\s*\d?\s*(\d{4})/i);
      if (ryzenModel) {
        const num = parseInt(ryzenModel[1]);
        const ryzenGen = Math.floor(num / 1000); // 7840 → 7
        return {
          generacion: 12 + Math.min(ryzenGen - 5, 4), // Ryzen 5xxx=gen12, 7xxx=gen13, 8xxx=gen14
          vendor: 'AMD',
          family: 'Ryzen',
          parsed: true,
        };
      }
      return { generacion: 12, vendor: 'AMD', family: 'Ryzen', parsed: true };
    }
    
    // ── "Nth Gen Intel" → ej: "11th Gen Intel Core" ─────────────────────────
    const nthGen = clean.match(/(\d{1,2})(?:st|nd|rd|th)\s*gen/i);
    if (nthGen) {
      return { generacion: parseInt(nthGen[1]), vendor: 'Intel', family: 'Core', parsed: true };
    }
    
    // ── "Intel Core iX Gen N" explícito ──────────────────────────────────────
    const explicitGen = clean.match(/i[3579]\s*gen\s*(\d{1,2})/i);
    if (explicitGen) {
      return { generacion: parseInt(explicitGen[1]), vendor: 'Intel', family: 'Core', parsed: true };
    }
    
    // ── Intel Core clásico con modelo: iX-YZZZZ (4-5 dígitos) ───────────────
    const intelModel = clean.match(/i[3579][- ]?(\d{4,5})/i);
    if (intelModel) {
      const num = intelModel[1];
      let gen;
      if (num.length === 4) {
        const twoDigit = parseInt(num.substring(0, 2));
        gen = (twoDigit >= 10 && twoDigit <= 19) ? twoDigit : parseInt(num[0]);
      } else {
        gen = parseInt(num.substring(0, 2));
      }
      return { generacion: gen, vendor: 'Intel', family: 'Core', parsed: true };
    }
    
    // ── Sin reconocimiento ────────────────────────────────────────────────────
    return { generacion: null, vendor: null, family: null, parsed: false };
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

// ════════════════════════════════════════════════════════════════════
// GH3.37.1 Item 12 — Extender IntegrityService existente de dashboard.js
// NO redeclarar con const — causa SyntaxError en el browser (GH3.37.2)
// ════════════════════════════════════════════════════════════════════
(function() {
  // Esperar a que dashboard.js exponga window.IntegrityService
  // y agregar el método verify() si no existe
  function _extendIntegrityService() {
    var svc = window.IntegrityService;
    if (!svc) return;
    if (svc.verify) return; // ya extendido

    svc.verify = function() {
      var issues = [];

      try {
        if (!Array.isArray(window.USERS)) issues.push({ module:'USERS', msg:'window.USERS no es array' });
        else if (window.USERS.length === 0) issues.push({ module:'USERS', msg:'window.USERS vacío' });
      } catch(e) { issues.push({ module:'USERS', msg: e.message }); }

      try {
        if (!Array.isArray(window.SYSTEM_USERS)) issues.push({ module:'SYSTEM_USERS', msg:'no es array' });
      } catch(e) { issues.push({ module:'SYSTEM_USERS', msg: e.message }); }

      try {
        if (window.KPIService) {
          var kt = KPIService.totalRenewals();
          var manual = (window.USERS || []).filter(function(u){ return !u.es_backup; }).length;
          if (kt !== manual) issues.push({ module:'KPIs', msg:'totalRenewals mismatch: '+kt+' vs '+manual });
        }
      } catch(e) { issues.push({ module:'KPIs', msg: e.message }); }

      try {
        if (window.state && state.user) {
          var role = state.user.role || state.user.rol;
          if (!role) issues.push({ module:'RBAC', msg:'state.user sin rol' });
        }
      } catch(e) { issues.push({ module:'RBAC', msg: e.message }); }

      try {
        var hdrs = window._EXCEL_HEADERS;
        if (!hdrs || !hdrs.RENOVACIONES || hdrs.RENOVACIONES.length === 0) {
          issues.push({ module:'ExcelMapper', msg:'headers RENOVACIONES no cargados' });
        }
      } catch(e) { issues.push({ module:'ExcelMapper', msg: e.message }); }

      issues.forEach(function(issue) {
        console.error('[IntegrityService.verify]', issue.module + ':', issue.msg);
      });
      return { ok: issues.length === 0, issues: issues };
    };
  }

  // Extender inmediatamente si ya existe, o esperar al DOMContentLoaded
  if (window.IntegrityService) {
    _extendIntegrityService();
  } else {
    document.addEventListener('DOMContentLoaded', _extendIntegrityService);
  }
})();




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
      check: (r) => !!(r.fecha_firma_acta), // QA-03: derivado de fecha
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
      check: (r) => (r.feedback || 0) > 0, // QA-03: feedback_recibido eliminado
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

  // GH3.18: cfg eliminado — window.CONFIGURATION era dead code.
  // ConfigService se inicializa antes de que BootstrapManager cargue datos.
  // Los 4 parámetros tenían defaults hardcodeados que son los valores reales usados.

  // ── 1. Parámetros de negocio (valores fijos — fuente única: código)
  const RAEE_INTEL_THRESHOLD = 10;     // Gen Intel ≤ 10 = RAEE
  const ESTADO_INICIAL       = 'Pendiente';
  const ARCHIVO_MAESTRO      = 'Plan_Maestro_REN26.xlsx';
  const REFRESH_INTERVAL_MS  = (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.refreshInterval)
                               || 10000;  // GH3.18: leer de config.js (fuente única de verdad)

  // ── 2. Estados del proceso REN26 (fuente: StateMachine — se exponen aquí
  //       para que los componentes los lean sin importar StateMachine directamente)
  const getStates = () => ({
    ...STATES,
    FEEDBACK: StateMachine.states.FEEDBACK || 'Feedback',
  });
  const getFlow   = () => STATE_FLOW.slice();

  // ── 3. Clasificaciones RAEE — valores permitidos como enum
  // GH3.40.2 Task 4: catálogo oficial RAEE — 4 valores (el motor se actualiza en sprint posterior)
  const CLASIFICACIONES_RAEE = ['Reutilizar', 'Reasignar', 'RAEE', 'Revisión manual'];

  // ── 4. Disposición final del equipo anterior — valores permitidos
  // F3.6 · Disposición final — 4 valores del spec de negocio
  // GH3.40.2 Task 3: catálogo oficial de disposición final
  const DISPOSICION_FINAL_OPTS = [
    'Pendiente definir',
    'Reasignación interna',
    'RAEE',
    'Donación',
    'Venta',
    'Garantía',
    'Otro',
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

  };
})();
window.ConfigService = ConfigService;

// GH3.18: ObsolescenceService.config.raee_intel_threshold = 10 (hardcodeado, sin cambio)


// ════════════════════════════════════════════════════════════════════
// RC1 · PRODUCTION_CONFIG — única fuente de verdad para IDs y modos
// Todos los IDs de Microsoft y el modo de operación se definen aquí.
// No existen IDs ni modos de autenticación en ningún otro lugar.
// ════════════════════════════════════════════════════════════════════
// PRODUCTION_CONFIG cargado desde js/config.js (RC3.3)
// Toda la app lee desde window.PRODUCTION_CONFIG

// ════════════════════════════════════════════════════════════════════
// GH3.39.3 Fase 3 — Panel de Diagnóstico (Ctrl+Shift+D)
// Panel oculto de soporte técnico — no visible para usuarios finales
// ════════════════════════════════════════════════════════════════════
(function() {
  var _diagOpen = false;

  function _formatMs(ms) {
    return ms == null ? '—' : ms < 1000 ? ms + 'ms' : (ms/1000).toFixed(2) + 's';
  }

  function _buildDiagHTML() {
    var m = window.calculateProjectMetrics ? calculateProjectMetrics() : null;
    var users = window.USERS || [];
    var sysU  = window.SYSTEM_USERS || [];
    var cfg   = window.PRODUCTION_CONFIG || window.APP_CONFIG || {};
    var hbt   = window.HBT || {};
    var st    = window.state || {};
    var now   = new Date().toLocaleTimeString('es-CO');

    var lastSync   = hbt._lastWrite   ? hbt._lastWrite.time   : '—';
    var lastValid  = hbt._lastValidation ? hbt._lastValidation.ts : '—';
    var writeOk    = hbt._lastWrite   ? (hbt._lastWrite.verifyOk !== false ? '✓' : '✗') : '—';
    var provName   = window.DataService && DataService.providerName ? DataService.providerName() : 'desconocido';

    var eventLog = [];
    if (window.EventBus && EventBus._log) {
      eventLog = EventBus._log.slice(-10).reverse();
    }

    return [
      '<div id="__diag-panel__" style="position:fixed;top:0;right:0;width:380px;max-height:100vh;',
      'overflow-y:auto;background:#0f1117;color:#e0e0e0;font-family:monospace;font-size:11px;',
      'z-index:99999;padding:16px;box-shadow:-4px 0 24px rgba(0,0,0,.6);border-left:3px solid #C00000;">',

      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">',
      '<b style="color:#C00000;font-size:13px">⚙ Panel de Diagnóstico</b>',
      '<span style="color:#888;font-size:10px">Ctrl+Shift+D para cerrar</span>',
      '</div>',

      '<div style="color:#888;margin-bottom:8px">',
      now + ' · v' + (cfg.version || cfg.appVersion || 'GH3.39.3'),
      '</div>',

      '<div style="background:#1a1e2e;padding:8px;border-radius:4px;margin-bottom:8px">',
      '<b style="color:#7ec8e3">DATOS</b><br>',
      'Equipos totales: <b style="color:#fff">' + (m ? m.totalEquipos : users.length) + '</b><br>',
      'Colaboradores: <b style="color:#fff">' + (m ? m.totalColaboradores : '—') + '</b><br>',
      'Backups: <b style="color:#fff">' + (m ? m.totalBackups : '—') + '</b><br>',
      'HBT: <b style="color:#fff">' + (m ? m.hbt : '—') + '</b> · ',
      'HGS: <b style="color:#fff">' + (m ? m.hgs : '—') + '</b><br>',
      'window.USERS.length: <b style="color:#fff">' + users.length + '</b><br>',
      'window.SYSTEM_USERS.length: <b style="color:#fff">' + sysU.length + '</b>',
      '</div>',

      '<div style="background:#1a1e2e;padding:8px;border-radius:4px;margin-bottom:8px">',
      '<b style="color:#7ec8e3">SESIÓN</b><br>',
      'Usuario: <b style="color:#fff">' + (st.user && st.user.email || '—') + '</b><br>',
      'Rol: <b style="color:#fff">' + (st.user && (st.user.role||st.user.rol) || '—') + '</b><br>',
      'Vista: <b style="color:#fff">' + (st.view || '—') + '</b><br>',
      'SyncInProgress: <b style="color:' + (st._syncInProgress ? '#f90' : '#0f0') + '">' + (st._syncInProgress ? 'SÍ' : 'NO') + '</b>',
      '</div>',

      '<div style="background:#1a1e2e;padding:8px;border-radius:4px;margin-bottom:8px">',
      '<b style="color:#7ec8e3">PROVEEDOR</b><br>',
      'Provider: <b style="color:#fff">' + provName + '</b><br>',
      'authMode: <b style="color:#fff">' + (cfg.authenticationMode || '—') + '</b><br>',
      'dataSource: <b style="color:#fff">' + (cfg.dataSource || '—') + '</b><br>',
      'debug: <b style="color:#fff">' + (cfg.debug === true ? 'ON' : 'OFF') + '</b>',
      '</div>',

      '<div style="background:#1a1e2e;padding:8px;border-radius:4px;margin-bottom:8px">',
      '<b style="color:#7ec8e3">ÚLTIMA SINCRONIZACIÓN</b><br>',
      'Tiempo: <b style="color:#fff">' + lastSync + '</b><br>',
      'Verificación: <b style="color:#fff">' + writeOk + '</b><br>',
      'Última validación: <b style="color:#fff">' + lastValid + '</b>',
      '</div>',

      '<div style="background:#1a1e2e;padding:8px;border-radius:4px;margin-bottom:8px">',
      '<b style="color:#7ec8e3">EXCEL / HEADERS</b><br>',
      'RENOVACIONES cols: <b style="color:#fff">' +
        (window._EXCEL_HEADERS && _EXCEL_HEADERS.RENOVACIONES ? _EXCEL_HEADERS.RENOVACIONES.length : '—') + '</b><br>',
      'WorkbookBase: <b style="color:#fff">' + (window.workbookBase && workbookBase() ? '✓ resuelto' : '✗ no disponible') + '</b>',
      '</div>',

      '<div style="background:#1a1e2e;padding:8px;border-radius:4px;margin-bottom:8px">',
      '<b style="color:#7ec8e3">INTEGRIDAD</b><br>',
      (function() {
        try {
          var v = window.IntegrityService ? IntegrityService.verify() : null;
          if (!v) return 'IntegrityService: no disponible';
          return 'ok: <b style="color:' + (v.ok ? '#0f0' : '#f00') + '">' + (v.ok ? 'PASS' : 'FAIL') + '</b>' +
            (v.issues && v.issues.length ? '<br>Errores: ' + v.issues.map(function(i){return i.module;}).join(', ') : '');
        } catch(e) { return 'IntegrityService: ' + e.message; }
      })(),
      '</div>',

      '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #333;color:#555;font-size:9px">',
      'PMC-TI-REN26 · GH3.39.3 · Heinsohn Business Technology',
      '</div>',
      '</div>'
    ].join('');
  }

  function _openDiag() {
    var existing = document.getElementById('__diag-panel__');
    if (existing) { existing.remove(); _diagOpen = false; return; }
    document.body.insertAdjacentHTML('beforeend', _buildDiagHTML());
    _diagOpen = true;
  }

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      _openDiag();
    }
  });

  // Exponer para diagnóstico desde consola
  window._diagPanel = { open: _openDiag, build: _buildDiagHTML };
})();


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
// GH3.18: refreshInterval viene de config.js via PRODUCTION_CONFIG (APP_CONFIG ya lo tiene)
// raee_intel_threshold: ObsolescenceService usa su propio valor hardcodeado (10)

// ═══════════════════════════════════════════════════════════════════
// F3 · KPIService (métricas agregadas, dominio puro)
// ═══════════════════════════════════════════════════════════════════
