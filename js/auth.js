// ════════════════════════════════════════════════════════════════════
// js/auth.js — PMC-TI-REN26 GH1
// SessionManager, F7_resolveRole, AuthProvider, MSAL
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

const SessionManager = (() => {
  const STORAGE_KEY = 'pmc_session_v1';
  let _session = null;

  return {
    /**
     * RC2.5 — Crea una sesión completa desde el BootstrapManager.
     * Incluye: usuario, rol, permisos, configuración, token.
     */
    createFromBootstrap(data) {
      _session = {
        username:      data.username      || '',
        displayName:   data.displayName   || data.username || 'Usuario',
        email:         data.email         || data.username || '',
        tenantId:      data.tenantId      || '',
        role:          data.role          || 'visitante',
        permissions:   data.permissions   || {},
        configuration: data.configuration || {},
        authenticated: true,
        loginTime:     data.loginTime     || Date.now(),
        expiration:    data.expiration    || (Date.now() + 8 * 60 * 60 * 1000),
        authMode:      data.authMode      || 'msal',
        token:         data.token         || null,   // RC2.5: token MSAL incluido
      };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({...(_session), token: null})); } catch(e) { /* intentional: error no crítico */ }
      // Nunca persistir el token — solo en memoria

      return _session;
    },

    /**
     * Crea una sesión a partir de la cuenta MSAL (o datos mock).
     * @param {object} account — { username, name, localAccountId, tenantId }
     */
    create(account) {
      const role = F7_resolveRole(account.username || account.email || '');
      _session = {
        username:     account.username || account.email || '',
        displayName:  account.name || account.username || 'Usuario',
        email:        account.username || account.email || '',
        tenantId:     account.tenantId || window.APP_CONFIG._tenantId || '',
        role,
        permissions:  (window.PERMISSIONS && window.PERMISSIONS[role]) ? window.PERMISSIONS[role] : {},
        authenticated: true,
        loginTime:    Date.now(),
        expiration:   Date.now() + (8 * 60 * 60 * 1000), // 8h
        authMode:     window.APP_CONFIG.authenticationMode || 'mock',
      };
      // Persistir sesión (sin tokens — solo metadatos de sesión)
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({..._session, token: null})); } catch(e) { /* intentional: error no crítico */ } // RC2.5: token nunca persiste

      return _session;
    },

    /** Restaura la sesión desde sessionStorage si no ha expirado */
    restore() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !s.authenticated) return null;
        if (Date.now() > s.expiration) {
          this.destroy();
          return null;
        }
        _session = s;
        return s;
      } catch(e) { return null; }
    },

    /** Destruye la sesión activa */
    destroy() {
      _session = null;
      try { sessionStorage.removeItem(STORAGE_KEY); } catch(e) { /* intentional: error no crítico */ }

    },

    /** Retorna la sesión activa o null */
    get() { return _session; },

    /** Retorna true si la sesión es válida y no ha expirado */
    isValid() {
      return !!_session && _session.authenticated && Date.now() < _session.expiration;
    },

    /** Aplica la sesión al state.user del dashboard */
    applyToState() {
      if (!_session) return;
      state.user.id    = _session.username;
      state.user.name  = _session.displayName;
      state.user.email = _session.email;
      state.user.role  = _session.role;
      window.USER = state.user; // legacy alias
    },
  };
})();
window.SessionManager = SessionManager;

// ═══════════════════════════════════════════════════════════════════
// F7.1 · AuthProvider
// Infraestructura de autenticación MSAL para Azure AD.
// No lee ni escribe datos. Solo gestiona identidad.
// Compatible con modo 'mock': si authenticationMode !== 'msal',
// todos los métodos retornan valores del estado actual sin invocar MSAL.
// ═══════════════════════════════════════════════════════════════════
const AuthProvider = (() => {
  // Credenciales del registro de app en Azure AD
  // ════════════════════════════════════════════════════════════════
// GH2.2: MSAL configuration — Microsoft Entra ID + GitHub Pages SPA
// Authorization Code Flow + PKCE (built-in MSAL Browser 3.x)
// Ref: https://learn.microsoft.com/en-us/entra/identity-platform/
//      tutorial-v2-javascript-auth-code
// ════════════════════════════════════════════════════════════════
const _PC_AUTH = (typeof window !== 'undefined' && window.PRODUCTION_CONFIG) || {};

const MSAL_CONFIG = {
    auth: {
      // GH2.2: clientId y tenantId son identificadores públicos (no secretos)
      // para aplicaciones SPA. El flujo PKCE no requiere client secret.
      clientId: _PC_AUTH.clientId || 'f7d07502-0540-41ed-ba45-be7fc9ede012',
      authority: 'https://login.microsoftonline.com/' +
                 (_PC_AUTH.tenantId || '38f48feb-4b87-481f-bd79-c2d633594e2f'),

      // RC1-HOTFIX-01: redirectUri dinámico — funciona en Netlify, GitHub Pages y localhost
      redirectUri: (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '/') || '/')
        : 'http://localhost',

      postLogoutRedirectUri: (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '/') || '/')
        : 'http://localhost',

      // GH2.2: navigateToLoginRequestUrl = false
      // Para flujo popup, MSAL no debe navegar de vuelta tras el login.
      // Evita redirecciones inesperadas en SPA de página única.
      navigateToLoginRequestUrl: false,

      // GH2.2: knownAuthorities — lista explícita de autoridades confiables
      // Previene ataques de autoridad no autorizada
      knownAuthorities: ['login.microsoftonline.com'],

      // GH2.2: protocolMode — AAD (estándar para Microsoft Entra ID)
      // Garantiza Authorization Code + PKCE en lugar de flujos obsoletos
      protocolMode: 'AAD',
    },

    cache: {
      // GH2.3: sessionStorage vs localStorage
      // DECISIÓN: sessionStorage
      // Razón: para una aplicación corporativa con acceso a datos financieros,
      // sessionStorage ofrece mayor seguridad que localStorage porque:
      //   1. El token se elimina al cerrar el tab/navegador
      //   2. No es accesible entre tabs del mismo origen (aislamiento)
      //   3. Reduce la ventana de exposición ante XSS
      //   4. Compatible con PKCE y Authorization Code Flow
      // Desventaja: el usuario debe loguearse al abrir una nueva sesión.
      // Aceptable para una herramienta corporativa interna.
      cacheLocation: 'sessionStorage',

      // storeAuthStateInCookie: false
      // No necesario en navegadores modernos. Solo para IE11 (obsoleto).
      storeAuthStateInCookie: false,
    },

    system: {
      // GH2.2: allowNativeBroker = false
      // Esta es una SPA en navegador, no una aplicación nativa.
      // El broker nativo (WAM) no aplica.
      allowNativeBroker: false,

      loggerOptions: {
        // GH2.7: solo errores MSAL en producción
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;  // NUNCA loguear PII
          if (level === 0) console.error('[MSAL Error]', message);
        },
        logLevel: 0,             // LogLevel.Error (0) en producción
        piiLoggingEnabled: false, // NUNCA habilitar en producción
      },
    },
  };

  // RC1 GL-2: Actualizar MSAL_CONFIG desde PRODUCTION_CONFIG (fuente única de IDs)
  if (typeof window !== 'undefined' && window.PRODUCTION_CONFIG) {
    const _PC = window.PRODUCTION_CONFIG;
    if (_PC.clientId) MSAL_CONFIG.auth.clientId = _PC.clientId;
    if (_PC.tenantId) MSAL_CONFIG.auth.authority = 'https://login.microsoftonline.com/' + _PC.tenantId;
  }

  // Scopes mínimos requeridos para lectura de identidad (NO para Graph todavía)
  const LOGIN_SCOPES = ['User.Read'];

  let _app = null;  // PublicClientApplication instance
  let _initialized = false;
  const _isMsal = () => window.APP_CONFIG && window.APP_CONFIG.authenticationMode === 'msal';

  return {
    /**
     * Inicializa MSAL. En modo mock, es un no-op.
     * Debe llamarse antes que cualquier otro método.
     */
    async initialize() {
      if (!_isMsal()) {

        _initialized = true;
        return true;
      }
      if (_initialized) return true;
      if (typeof msal === 'undefined') {
        console.error('[AuthProvider] MSAL SDK no disponible — verificar CDN');
        return false;
      }
      try {
        // GH3.34: logs de diagnóstico GH3.16 eliminados
        _app = new msal.PublicClientApplication(MSAL_CONFIG);
        await _app.initialize();
        _initialized = true;

        return true;
      } catch(e) {
        console.error('[AuthProvider] Error al inicializar MSAL:', e.message);
        return false;
      }
    },

    /**
     * Retorna true si hay una sesión activa.
     * En modo mock: siempre true.
     * En modo msal: verifica cuenta en MSAL cache.
     */
    isAuthenticated() {
      if (!_isMsal()) return true;
      if (!_app) return false;
      const accounts = _app.getAllAccounts();
      return accounts.length > 0;
    },

    /**
     * Inicia el flujo de login.
     * En modo mock: no-op, retorna cuenta mock.
     * En modo msal: loginPopup con PKCE.
     */
    async login() {
      if (!_isMsal()) {

        return { username: state.user.email, name: state.user.name, tenantId: '' };
      }
      if (!_app) throw new Error('AuthProvider no inicializado — llamar initialize() primero');
      try {
        const response = await _app.loginPopup({
          scopes: LOGIN_SCOPES,
          prompt: 'select_account',
        });

        return response.account;
      } catch(e) {
        if (e.errorCode === 'user_cancelled') {

          return null;
        }
        throw e;
      }
    },

    /**
     * Cierra sesión.
     * En modo mock: destruye SessionManager.
     * En modo msal: logoutPopup + destruye SessionManager.
     */
    async logout() {
      SessionManager.destroy();
      if (!_isMsal() || !_app) {

        return;
      }
      const account = this.getAccount();
      try {
        await _app.logoutPopup({ account });

      } catch(e) { /* intentional: estado no crítico — fallo silencioso */ }
    },

    /**
     * Retorna la cuenta activa de MSAL.
     * En modo mock: retorna state.user como objeto compatible.
     */
    getAccount() {
      if (!_isMsal() || !_app) {
        return { username: state.user.email, name: state.user.name, tenantId: '' };
      }
      const accounts = _app.getAllAccounts();
      return accounts.length > 0 ? accounts[0] : null;
    },

    /** Retorna el username (email) del usuario activo */
    getUsername() {
      const acct = this.getAccount();
      return acct ? (acct.username || acct.email || '') : '';
    },

    /** Retorna el nombre para mostrar */
    getDisplayName() {
      const acct = this.getAccount();
      return acct ? (acct.name || acct.username || 'Usuario') : 'Usuario';
    },

    /**
     * Obtiene un Access Token para los scopes solicitados.
     * En modo mock: retorna null (no hay token real).
     * En modo msal: intenta silent primero, popup como fallback.
     * NOTA: F7.1 no necesita tokens — solo identidad.
     * F7.2 usará este método para Graph.
     */
    async getAccessToken(scopes) {
      if (!_isMsal() || !_app) return null;
      const account = this.getAccount();
      if (!account) return null;
      try {
        const response = await _app.acquireTokenSilent({
          account,
          scopes: scopes || LOGIN_SCOPES,
        });
        // NUNCA persistir el token manualmente
        return response.accessToken;
      } catch(e) {
        if (e instanceof msal.InteractionRequiredAuthError) {
          const response = await _app.acquireTokenPopup({ scopes: scopes || LOGIN_SCOPES });
          return response.accessToken;
        }
        throw e;
      }
    },

    /**
     * Refresca el token silenciosamente.
     * En modo mock: no-op.
     */
    async refresh() {
      if (!_isMsal()) return true;
      const token = await this.getAccessToken(LOGIN_SCOPES);
      return !!token;
    },

    /**
     * RC2.5 — Obtiene el token de acceso para Graph API.
     * Alias de getAccessToken para BootstrapManager.
     */
    async getToken(scopes) {
      if (!_isMsal()) return null;
      return await this.getAccessToken(scopes || ['Files.ReadWrite.All', 'User.Read']);
    },

    // Exponer config para debug (sin secretos — SPA pública no tiene secret)
    _config: {
      clientId:  MSAL_CONFIG.auth.clientId,
      tenantId:  (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.tenantId) || '38f48feb-4b87-481f-bd79-c2d633594e2f',
      authority: MSAL_CONFIG.auth.authority,
      scopes:    LOGIN_SCOPES,
      pkce:      true, // PublicClientApplication usa PKCE por defecto
    },
  };
})();
window.AuthProvider = AuthProvider;


// RC1 GL-1 · Pantalla de error de arranque (producción)
function _showBootError(message, code, isConfig) {
  const el = document.getElementById('rc1-boot-error');
  if (!el) return;
  const isConfigError = isConfig || (code === 'EXCEL_NOT_CONFIGURED' || code === 'DATASOURCE_NOT_CONFIGURED');
  el.innerHTML = `
    <div style="max-width:560px;background:#fff;border-radius:12px;padding:40px;box-shadow:0 8px 32px rgba(0,0,0,.18);text-align:center">
      <div style="font-size:40px;margin-bottom:16px">${isConfigError ? '⚙' : '⚠'}</div>
      <div style="font-size:20px;font-weight:700;color:#D30034;margin-bottom:12px">
        ${isConfigError ? 'Configuración pendiente' : 'No se pudo conectar con el Excel Maestro'}
      </div>
      <div style="font-size:13px;color:#555;margin-bottom:20px;line-height:1.6">
        ${isConfigError
          ? 'Completar <strong>PRODUCTION_CONFIG</strong> con siteId, driveId e itemId antes del Go Live.'
          : 'El Dashboard no pudo cargar datos del Excel Maestro en SharePoint.'}
      </div>
      <div style="background:#f5f5f5;border-radius:6px;padding:12px;font-family:monospace;font-size:11px;color:#333;text-align:left;margin-bottom:20px;word-break:break-all">
        <strong>Código:</strong> ${code || 'UNKNOWN'}<br>
        <strong>Detalle:</strong> ${message || ''}
      </div>
      ${isConfigError ? `
        <div style="font-size:12px;color:#777;border-top:1px solid #eee;padding-top:16px">
          Ver <strong>README_DEPLOY.md</strong> y <strong>CONFIGURATION.md</strong> del paquete RC1.
        </div>` : `
        <button onclick="location.reload()" style="background:#D30034;color:#fff;border:none;border-radius:6px;padding:10px 24px;font-size:13px;cursor:pointer;margin-right:8px">Reintentar</button>
        <button onclick="document.getElementById('rc1-boot-error').style.display='none'" style="background:#f0f0f0;color:#333;border:none;border-radius:6px;padding:10px 24px;font-size:13px;cursor:pointer">Continuar offline</button>
      `}
    </div>`;
  el.style.display = 'flex';
}



// ════════════════════════════════════════════════════════════════════════════
// RC2.4 — BootstrapManager
// Responsabilidad exclusiva:
//   1. Esperar autenticación MSAL
//   2. Obtener identidad Microsoft (email + nombre + token)
//   3. Leer PMC_USUARIOS_SISTEMA  → resolver rol
//   4. Leer PMC_ROLES_PERMISOS    → construir RBAC
//   5. Leer PMC_CONFIGURACION     → construir ConfigService
//   6. Crear Session con datos completos
//   7. Emitir bootstrap.completed
//
// NO carga renovaciones, inventario, reportes.
// NO renderiza el Dashboard.
// NO es el boot() anterior.
// ════════════════════════════════════════════════════════════════════════════
