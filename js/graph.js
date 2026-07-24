// ════════════════════════════════════════════════════════════════════
// js/graph.js — PMC-TI-REN26 GH1
// GraphClient, SharePointResolver, GraphCache, SP_FIELD_MAP, WriteContract, WorkbookWriter
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════

const GraphClient = (() => {
  // GH3.11: leer desde PRODUCTION_CONFIG (fuente única de verdad)
  const BASE_URL = (typeof window !== 'undefined' && window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.graphEndpoint) || 'https://graph.microsoft.com/v1.0';

  // ── Configuración interna ─────────────────────────────────────
  let _config = {
    timeoutMs:       30000,   // 30s timeout por request
    retryMax:        5,       // GH3.42.1: 5 reintentos (backoff 500ms/1s/2s/4s/8s = ~15s total) — tolera 504 recurrentes de Graph
    retryBaseDelayMs: 500,    // delay base para backoff exponencial
    scopes:          ['User.Read'], // mínimo F7.2; F7.3 añadirá Sites.ReadWrite.All
  };
  let _initialized = false;

  // ── Error mapping: HTTP → error interno ──────────────────────
  const HTTP_ERROR_MAP = {
    401: { code: 'AUTH_REQUIRED',       retryable: false, message: 'Token expirado o inválido' },
    403: { code: 'FORBIDDEN',           retryable: false, message: 'Sin permisos para esta operación' },
    404: { code: 'NOT_FOUND',           retryable: false, message: 'Recurso no encontrado en Graph' },
    408: { code: 'REQUEST_TIMEOUT',     retryable: true,  message: 'Tiempo de espera agotado en la solicitud' },
    409: { code: 'CONFLICT',            retryable: false, message: 'Conflicto en la operación' },
    429: { code: 'THROTTLED',           retryable: true,  message: 'Rate limit — reintentando' },
    500: { code: 'SERVER_ERROR',        retryable: true,  message: 'Error interno de Microsoft Graph' },
    502: { code: 'BAD_GATEWAY',         retryable: true,  message: 'Bad Gateway — Microsoft Graph inestable, reintentando' },
    503: { code: 'SERVICE_UNAVAILABLE', retryable: true,  message: 'Microsoft Graph no disponible' },
    504: { code: 'GATEWAY_TIMEOUT',     retryable: true,  message: 'Gateway timeout — Microsoft Graph tardó en responder, reintentando' },
  };

  function makeGraphError(status, body, context, retryAfterHeader) {
    const mapped = HTTP_ERROR_MAP[status] || { code: 'UNKNOWN', retryable: false, message: 'Error desconocido' };
    const err = new Error(`[GraphClient] ${mapped.code} (HTTP ${status}): ${mapped.message}`);
    err.graphCode    = mapped.code;
    err.httpStatus   = status;
    err.retryable    = mapped.retryable;
    err.context      = context;
    err.graphBody    = body;
    // GH3.42.6: Retry-After header (RFC 7231) — respetamos lo que Graph nos dice
    if (retryAfterHeader) {
      // Puede venir como número (segundos) o fecha HTTP
      const secs = parseInt(retryAfterHeader, 10);
      if (!isNaN(secs) && secs > 0) {
        err.retryAfterMs = Math.min(secs * 1000, 120000); // cap 2 min
      } else {
        // Formato HTTP-date
        const t = Date.parse(retryAfterHeader);
        if (!isNaN(t)) err.retryAfterMs = Math.min(Math.max(t - Date.now(), 0), 120000);
      }
    }
    return err;
  }

  // ── GH3.42.7: Circuit breaker para throttling sostenido ──────
  // Si Graph rechaza 5 requests con 429 en menos de 10s, pausamos TODAS
  // las escrituras 45s para evitar amplificar el throttle.
  let _throttleWindow = [];
  let _circuitOpenUntil = 0;

  function _recordThrottle() {
    const now = Date.now();
    _throttleWindow.push(now);
    // Mantener solo los últimos 10 segundos
    _throttleWindow = _throttleWindow.filter(t => now - t < 10000);
    if (_throttleWindow.length >= 5) {
      _circuitOpenUntil = now + 45000; // 45s de pausa
      _throttleWindow = [];
      console.warn('[GraphClient] Circuit breaker activado: pausa de 45s por throttle sostenido');
    }
  }
  function _isCircuitOpen() {
    return Date.now() < _circuitOpenUntil;
  }

  // ── Retry con backoff diferenciado ────────────────────────────
  async function withRetry(fn, attempt = 0) {
    // GH3.42.7: si el circuit está abierto, esperar hasta que cierre
    if (_isCircuitOpen()) {
      const wait = _circuitOpenUntil - Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.max(wait, 100)));
    }
    try {
      return await fn();
    } catch(err) {
      // GH3.42.7: registrar el 429 para el circuit breaker
      if (err.graphCode === 'THROTTLED') _recordThrottle();
      // GH3.42.7: CORS error tras redirect a officeapps.live.com → tratable como transitorio
      if (err.graphCode === 'NETWORK_ERROR' && err.message &&
          (err.message.indexOf('officeapps.live.com') >= 0 ||
           err.message.indexOf('CORS') >= 0)) {
        err.retryable = true;
      }
      if (!err.retryable || attempt >= _config.retryMax - 1) throw err;

      // Prioridad 1: si Graph envió Retry-After, respetarlo
      let delay;
      if (err.retryAfterMs && err.retryAfterMs > 0) {
        delay = err.retryAfterMs;
      } else {
        // Prioridad 2: backoff diferenciado por código de error
        const isThrottle = err.graphCode === 'THROTTLED';
        const baseMs = isThrottle ? 2000 : _config.retryBaseDelayMs;
        const maxMs  = isThrottle ? 60000 : 15000;
        const exp    = baseMs * Math.pow(2, attempt);
        const jitter = exp * 0.25 * (Math.random() * 2 - 1);
        delay        = Math.min(Math.round(exp + jitter), maxMs);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, attempt + 1);
    }
  }

  // ── GH3.42.6: Semáforo simple para limitar concurrencia contra Graph ──
  // Máximo 4 requests concurrentes → evita disparar throttle con múltiples PATCHes simultáneos
  const _concurrencyLimit = 4;
  let _inflight = 0;
  const _waiting = [];
  function _acquireSlot() {
    return new Promise(resolve => {
      if (_inflight < _concurrencyLimit) { _inflight++; resolve(); }
      else _waiting.push(resolve);
    });
  }
  function _releaseSlot() {
    _inflight--;
    if (_waiting.length > 0 && _inflight < _concurrencyLimit) {
      _inflight++;
      const next = _waiting.shift();
      next();
    }
  }

  // ── Token + fetch con timeout ─────────────────────────────────
  async function doRequest(method, path, body, extraScopes, extraHeaders) {
    // GH3.22 P1: extraHeaders permite inyectar workbook-session-id y otros headers custom
    extraHeaders = extraHeaders || {};
    const scopes = extraScopes || _config.scopes;
    let token;
    try {
      token = await AuthProvider.getAccessToken(scopes);
      if (!token && (window.APP_CONFIG && window.APP_CONFIG.authenticationMode) === 'msal') {
        throw makeGraphError(401, null, path);
      }
    } catch(e) {
      if (e.graphCode) throw e;
      const err = makeGraphError(401, null, path);
      err.originalError = e;
      throw err;
    }

    // Timeout wrapper
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), _config.timeoutMs)
      : null;

    // GH3.42.6: adquirir slot de concurrencia (máx 4 requests simultáneos a Graph)
    await _acquireSlot();

    try {
      const headers = {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'ConsistencyLevel': 'eventual',
        ...extraHeaders,   // GH3.22 P1: merge custom headers (ej: workbook-session-id)
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = { method, headers, signal: controller ? controller.signal : undefined };
      if (body && method !== 'GET') options.body = JSON.stringify(body);

      const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
      const response = await fetch(url, options);

      if (timer) clearTimeout(timer);

      if (!response.ok) {
        let errorBody = null;
        try { errorBody = await response.json(); } catch(e) { /* intentional: error ignorado en operación no crítica */ }
        // GH3.42.6: extraer Retry-After header y pasarlo a makeGraphError
        const retryAfterHeader = response.headers.get('Retry-After');
        throw makeGraphError(response.status, errorBody, path, retryAfterHeader);
      }

      if (response.status === 204) { _releaseSlot(); return null; }
      const result = await response.json();
      _releaseSlot();
      return result;

    } catch(err) {
      _releaseSlot();  // GH3.42.6: liberar slot también en error
      if (timer) clearTimeout(timer);
      if (err.graphCode) throw err;
      // Network error / abort
      // RC-1 Fix: clasificar DNS failure vs otros errores de red
      var isDnsFail = err.message && (
        err.message.indexOf('ERR_NAME_NOT_RESOLVED') >= 0 ||
        err.message.indexOf('ERR_INTERNET_DISCONNECTED') >= 0 ||
        err.message.indexOf('network error') >= 0
      );
      const netErr = new Error(`[GraphClient] NETWORK_ERROR: ${err.message}`);
      netErr.graphCode = err.name === 'AbortError' ? 'TIMEOUT' : (isDnsFail ? 'DNS_FAILURE' : 'NETWORK_ERROR');
      netErr.retryable = !isDnsFail; // DNS failure → no reintentar (inútil)
      netErr.retryable = true;
      netErr.context   = path;
      throw netErr;
    }
  }

  return {
    /** Inicializa el cliente con configuración opcional */
    initialize(config) {
      if (config) Object.assign(_config, config);
      _initialized = true;

      return true;
    },

    /** Ejecuta una petición arbitraria con retry automático */
    async request(method, path, body, scopes, extraHeaders) {
      if (!_initialized) this.initialize();
      return withRetry(() => doRequest(method, path, body, scopes, extraHeaders));
    },

    /** GET conveniente */
    async get(path, scopes)         { return this.request('GET',    path, null, scopes); },
    /** POST conveniente */
    async post(path, body, scopes, extraHeaders)  { return this.request('POST',   path, body, scopes, extraHeaders); },
    /** PATCH conveniente */
    async patch(path, body, scopes, extraHeaders) { return this.request('PATCH',  path, body, scopes, extraHeaders); },
    /** DELETE conveniente */
    async delete(path, scopes, extraHeaders)      { return this.request('DELETE', path, null, scopes, extraHeaders); },

    /** Descarga un archivo y retorna su contenido */
    async download(path, scopes) {
      const token = await AuthProvider.getAccessToken(scopes || _config.scopes);
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
      const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw makeGraphError(response.status, null, path);
      return response.blob();
    },

    /** Sube un archivo */
    async upload(path, content, contentType, scopes) {
      const token = await AuthProvider.getAccessToken(scopes || _config.scopes);
      const headers = {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': contentType || 'application/octet-stream',
      };
      const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
      const response = await fetch(url, { method: 'PUT', headers, body: content });
      if (!response.ok) throw makeGraphError(response.status, null, path);
      return response.status === 204 ? null : response.json();
    },

    /** Obtiene el token actual (delegado a AuthProvider) */
    async getToken(scopes) { return AuthProvider.getAccessToken(scopes || _config.scopes); },

    /** Refresca el token (delegado a AuthProvider) */
    async refreshToken()   { return AuthProvider.refresh(); },

    /** Paginación: recorre todas las páginas de @odata.nextLink */
    async getAll(path, scopes) {
      const items = [];
      let nextLink = path.startsWith('http') ? path : `${BASE_URL}${path}`;
      while (nextLink) {
        const page = await this.get(nextLink, scopes);
        if (!page) break;
        if (Array.isArray(page.value)) items.push(...page.value);
        nextLink = page['@odata.nextLink'] || null;
      }
      return items;
    },

    /** Batch: envía hasta 20 requests en una sola llamada */
    async batch(requests) {
      if (!Array.isArray(requests) || requests.length === 0) return [];
      const chunks = [];
      for (let i = 0; i < requests.length; i += 20) chunks.push(requests.slice(i, i + 20));
      const results = [];
      for (const chunk of chunks) {
        const body = { requests: chunk.map((r, i) => ({ id: String(i + 1), ...r })) };
        const resp = await this.post('/$batch', body);
        if (resp && resp.responses) results.push(...resp.responses);
      }
      return results;
    },

    /** Delta: obtiene cambios incrementales */
    async delta(path, deltaLink, scopes) {
      const url = deltaLink || (path.startsWith('http') ? path : `${BASE_URL}${path}`);
      return this.get(url, scopes);
    },

    _config,
    _isInitialized: () => _initialized,
  };
})();
window.GraphClient = GraphClient;

// ═══════════════════════════════════════════════════════════════════
// F7.2 · SharePointResolver
// Resuelve dinámicamente las URLs de SharePoint y Microsoft Graph.
// No hardcodea IDs de sitio ni rutas.
// Recibe siteId y listId desde APP_CONFIG (configurables).
// ═══════════════════════════════════════════════════════════════════
const SharePointResolver = (() => {
  // Configuración — se poblará desde APP_CONFIG cuando esté disponible
  let _cfg = {
    tenantId:      (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.tenantId) || '',
    siteHostname:  null,  // ej: 'heinsohn.sharepoint.com'
    sitePath:      null,  // ej: '/sites/TI'
    siteId:        null,  // resuelto dinámicamente o configurado
    listId:        null,  // resuelto dinámicamente o configurado
    driveId:       null,
    listName:      'REN26_Renovaciones',
    initialized:   false,
  };

  function cfg() {
    // RC1 GL-2: PRODUCTION_CONFIG tiene prioridad (fuente única de IDs)
    const PC = window.PRODUCTION_CONFIG || {};
    if (PC.siteId)   _cfg.siteId  = PC.siteId;
    if (PC.driveId)  _cfg.driveId = PC.driveId;
    if (PC.tenantId) _cfg.tenantId = PC.tenantId;
    // APP_CONFIG.sharePoint como fallback
    if (window.APP_CONFIG && window.APP_CONFIG.sharePoint) {
      const sp = window.APP_CONFIG.sharePoint;
      Object.keys(sp).forEach(k => {
        if (sp[k] !== null && sp[k] !== undefined && !PC[k]) _cfg[k] = sp[k];
      });
    }
    return _cfg;
  }

  return {
    /** Inicializa el resolver (puede usarse para pre-cargar IDs) */
    initialize(config) {
      if (config) Object.assign(_cfg, config);
      _cfg.initialized = true;

    },

    /** Retorna el tenant ID */
    getTenant() { return cfg().tenantId; },

    /** Retorna la URL base del sitio SharePoint */
    getSite() {
      const c = cfg();
      if (c.siteId) return c.siteId;
      if (!c.siteHostname) return null;
      return `${c.siteHostname}:${c.sitePath || ''}`;
    },

    /** Retorna el path del Drive (/me/drive o /drives/{id}) */
    getDrive() {
      const c = cfg();
      if (c.driveId) return `/drives/${c.driveId}`;
      const site = this.getSite();
      if (!site) return '/me/drive';
      return `/sites/${site}/drive`;
    },

    /** Retorna el path de la biblioteca de documentos */
    getDocumentLibrary(libraryName) {
      const site = this.getSite();
      if (!site) return null;
      return `/sites/${site}/lists/${encodeURIComponent(libraryName || 'Documents')}`;
    },

    /** Retorna el path de la lista SharePoint de renovaciones */
    getList(listName) {
      const site = this.getSite();
      const c = cfg();
      if (!site) return null;
      const lId = c.listId || encodeURIComponent(listName || c.listName);
      return `/sites/${site}/lists/${lId}`;
    },

    /** Retorna el path de ítems de la lista */
    getListItems(listName) {
      const list = this.getList(listName);
      return list ? `${list}/items?expand=fields` : null;
    },

    /** Resuelve una ruta relativa a la raíz del sitio */
    resolvePath(relativePath) {
      const site = this.getSite();
      if (!site) return null;
      return `/sites/${site}${relativePath.startsWith('/') ? relativePath : '/' + relativePath}`;
    },

    /** Retorna la URL completa de la API del sitio (para metadata) */
    getSiteUrl() {
      const site = this.getSite();
      return site ? `/sites/${site}` : null;
    },

    /** Retorna true si el resolver está configurado con siteId real */
    isReady() {
      return !!(cfg().siteId || (cfg().siteHostname && cfg().sitePath));
    },

    _raw: () => cfg(),
  };
})();
window.SharePointResolver = SharePointResolver;

// ═══════════════════════════════════════════════════════════════════
// F7.3 · SP_FIELD_MAP
// Mapa único y canónico: nombre de columna SharePoint → campo JSON.
// Fuente de verdad para toda la capa de transformación Graph→Dashboard.
// Los InternalNames de SharePoint se confirman con el admin SP antes
// del primer despliegue con dataSource='graph'.
// ═══════════════════════════════════════════════════════════════════
const SP_FIELD_MAP = {
  // ── Datos del colaborador ──────────────────────────────────────
  'Title':                    'nombre',           // Columna título SP
  'Empresa':                  'empresa',
  'Cedula':                   'cedula',
  'NombreCompleto':           'nombre',           // Alias si Title no se usa
  'Usuario':                  'usuario',
  'Correo':                   'correo',
  'Ciudad':                   'ciudad',
  'Cargo':                    'cargo',
  'Gerente':                  'gerente',
  'CentroCostos':             'ceco',
  'Proyecto':                 'proyecto',
  'Nivel':                    'nivel_usuario',
  // ── Equipo nuevo ─────────────────────────────────────────────
  'EqNvoTipo':                'eq_nvo_tipo',
  'EqNvoMarca':               'eq_nvo_marca',
  'EqNvoModelo':              'eq_nvo_modelo',
  'EqNvoSerial':              'eq_nvo_serial',
  'EqNvoPlaca':               'eq_nvo_placa',
  'EqNvoHostname':            'eq_nvo_hostname',
  'EqNvoProcesador':          'eq_nvo_procesador',
  'EqNvoRam':                 'eq_nvo_ram',
  'EqNvoDisco':               'eq_nvo_disco',
  'DatoMaestro':              'dato_maestro',
  // ── Equipo anterior ──────────────────────────────────────────
  'EqAntTipo':                'eq_ant_tipo',
  'EqAntMarca':               'eq_ant_marca',
  'EqAntModelo':              'eq_ant_modelo',
  'EqAntSerial':              'eq_ant_serial',
  'EqAntAF':                  'eq_ant_af',
  'EqAntPlaca':               'eq_ant_placa',
  'EqAntHostname':            'eq_ant_hostname',
  'EqAntProcesador':          'eq_ant_procesador',
  'EqAntRam':                 'eq_ant_ram',
  'EqAntSO':                  'eq_ant_so',
  // ── Proceso (campos runtime gestionados por el dashboard) ─────
  'Tecnico':                  'tecnico',
  'Estado':                   'estado',
  'EstadoEntregaEquipoNuevo': 'estado_entrega_equipo_nuevo',
  'ActaEnviada':              'acta_enviada',
  'ActaEntregaUrl':           'acta_entrega_url',
  'EvidenciaAdjunta':         'evidencia_adjunta',
  'NombreArchivo':            'nombre_archivo',
  'FeedbackRecibido':         'feedback_recibido',
  'Observaciones':            'observaciones',
  'Alistamiento':             'alistamiento',
  'CasoEnvio':                'caso_envio',
  'FechaAsignacion':          'fecha_asignacion',
  'FechaEnvio':               'fecha_envio',
  'FechaEnvioActa':           'fecha_envio_acta',
  'FechaFirmaActa':           'fecha_firma_acta',
  'FechaSolicitudDevolucion': 'fecha_solicitud_devolucion',
  'FechaTransito':            'fecha_transito',
  'FechaRecepcionBodega':     'fecha_recepcion_bodega',
  'Bloqueado':                'blocked',
  'CategoriaBloqueo':         'block_category',
  'EstadoAnteriorBloqueo':    'block_previous_state',
  // ── Metadatos SP ─────────────────────────────────────────────
  'id':                       'sp_item_id',   // ID del ítem en SP (para PATCH en F7.4)
};
// Mapa inverso: campo JSON → nombre columna SP (para escritura F7.4)
const SP_FIELD_MAP_INVERSE = Object.fromEntries(
  Object.entries(SP_FIELD_MAP).map(([sp, json]) => [json, sp])
);
window.SP_FIELD_MAP = SP_FIELD_MAP;
window.SP_FIELD_MAP_INVERSE = SP_FIELD_MAP_INVERSE;

// ═══════════════════════════════════════════════════════════════════
// F7.3 · GraphCache
// Cache en memoria para respuestas de Graph.
// TTL configurable. No usa localStorage. No persiste entre sesiones.
// ═══════════════════════════════════════════════════════════════════
const GraphCache = (() => {
  const _store   = new Map(); // key → { data, ts, ttl }
  const DEFAULT_TTL = 60000;  // 60s por defecto

  return {
    /** Guarda un valor con TTL en ms */
    set(key, data, ttl) {
      _store.set(key, { data, ts: Date.now(), ttl: ttl || DEFAULT_TTL });
    },

    /** Retorna el valor si existe y no expiró, o null */
    get(key) {
      const entry = _store.get(key);
      if (!entry) return null;
      if (entry.ttl <= 0 || Date.now() - entry.ts >= entry.ttl) {
        _store.delete(key);
        return null;
      }
      return entry.data;
    },

    /** Invalida una clave específica */
    invalidate(key) { _store.delete(key); },

    /** Fuerza recarga de una clave (invalida + retorna null para que el caller recargue) */
    refresh(key) { _store.delete(key); return null; },

    /** Limpia todo el cache */
    clear() { _store.clear(); },

    /** Retorna las claves activas (no expiradas) */
    keys() {
      const now = Date.now();
      return [..._store.entries()]
        .filter(([,v]) => now - v.ts <= v.ttl)
        .map(([k]) => k);
    },

    /** Estadísticas del cache */
    stats() {
      const now = Date.now();
      let live = 0, expired = 0;
      _store.forEach(v => { if (now - v.ts <= v.ttl) live++; else expired++; });
      return { live, expired, total: _store.size };
    },

    _ttlDefault: DEFAULT_TTL,
  };
})();
window.GraphCache = GraphCache;

// ═══════════════════════════════════════════════════════════════════
// F7.4.0 · WriteContract
// Contrato único de escritura. Toda operación de PATCH debe pasar
// por este contrato. Es la fuente de verdad para GraphWriteValidator.
// ═══════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// GH3.28 — RAEEEngine v1.0
// Motor RAEE para clasificación de destino final de equipos.
// Fuente única de reglas — NO distribuir lógica en UI ni otros módulos.
// ════════════════════════════════════════════════════════════════════
const RAEEEngine = (() => {
  const VERSION = '1.0';
  const VALID   = ['Excelente', 'Bueno', 'Regular', 'Malo'];
  const SCORES  = { 'Excelente': 4, 'Bueno': 3, 'Regular': 2, 'Malo': 1 };

  /**
   * Calcular recomendación de destino final.
   * @param {string} bateria
   * @param {string} teclado
   * @param {string} touchpad
   * @param {string} estetico
   * @returns {{ recomendacion, motivo, version, fechaEvaluacion }|null}
   */
  function calcular(bateria, teclado, touchpad, estetico) {
    const vals = [bateria, teclado, touchpad, estetico].filter(function(v) {
      return VALID.indexOf(v) >= 0;
    });
    if (vals.length === 0) return null;

    var malos    = vals.filter(function(v){ return v === 'Malo'; }).length;
    var regulares= vals.filter(function(v){ return v === 'Regular'; }).length;
    var avg      = vals.reduce(function(s,v){ return s + SCORES[v]; }, 0) / vals.length;

    var recomendacion, motivo;

    if (malos >= 2) {
      recomendacion = 'RAEE';
      motivo = malos + ' componentes en estado Malo — requiere disposicion especial (RAEE)';
    } else if (regulares >= 2) {
      recomendacion = 'Donacion';
      motivo = regulares + ' componentes en estado Regular — apto para donacion';
    } else if (avg >= 3 && malos === 0) {
      recomendacion = 'Venta interna';
      motivo = 'Promedio igual o superior a Bueno sin componentes Malo — apto para venta interna';
    } else {
      recomendacion = 'Reasignacion';
      motivo = 'Estado general aceptable — apto para reasignacion interna';
    }

    return {
      recomendacion:    recomendacion,
      motivo:           motivo,
      version:          VERSION,
      fechaEvaluacion:  new Date().toISOString().split('T')[0],
    };
  }

  /** Validar que los cuatro campos tienen valores válidos. */
  function validar(bateria, teclado, touchpad, estetico) {
    var campos = [
      { nombre: 'Bateria',  valor: bateria },
      { nombre: 'Teclado',  valor: teclado },
      { nombre: 'Touchpad', valor: touchpad },
      { nombre: 'Estetico', valor: estetico },
    ];
    var faltantes = campos.filter(function(c){ return VALID.indexOf(c.valor) < 0; });
    return {
      ok:       faltantes.length === 0,
      faltante: faltantes.map(function(c){ return c.nombre; }),
    };
  }

  /** Opciones válidas para los controles de UI. */
  function opciones() { return VALID.slice(); }

  return { calcular: calcular, validar: validar, opciones: opciones, VERSION: VERSION };
})();
window.RAEEEngine = RAEEEngine;

const WriteContract = (() => {
  // Campos que NUNCA deben ir a SharePoint
  // GH A1: es_backup y clasificacion_obsolescencia movidos a ALLOWED — deben persistir en Excel
  const PROTECTED_FIELDS = new Set([
    'audit', 'timeline', 'approval',
    'generacion_cpu', 'accion_requerida', 'accion_detalle',
    'estado_eq_ant', 'clasificacion_raee', '_obsolescence_meta',
    'equipoAnterior', 'equipoNuevo',
    'sp_item_id',                      // meta SP — no se escribe al campo real
    'recibido_bodega', 'equipo_devuelto', // derivados de formulario
  ]);

  // Campos de solo lectura (vienen del Excel/SAP — no se editan en el Dashboard)
  // QA-03: READONLY_FIELDS — columnas sin control UI en el nuevo Excel
  const READONLY_FIELDS = new Set([
    'id',                      // clave interna — nunca editar
    'fecha_devolucion',        // Bodega — sin control en formulario
    // TASK 13 fix: observaciones_devolucion TIENE control UI → removida de READONLY
  ]);

  // Campos sincronizables → SharePoint (whitelist oficial)
  // QA-03: ALLOWED_FIELDS — alineado al Excel Maestro definitivo
  // Columnas eliminadas del Excel: CLASIFICACION_OBSOLESCENCIA, ACTA_ENVIADA, ACTA_FIRMADA,
  // FECHA_ALISTAMIENTO, FECHA_ASIGNACION, FEEDBACK_RECIBIDO, ES_BACKUP
  // Columnas nuevas en Excel: EQ_NVO_SO, NOTAS_ALISTAMIENTO, FECHA_ENTREGA
  const ALLOWED_FIELDS = [
    // Sección 1 — Colaborador
    'empresa', 'nombre', 'cedula', 'usuario', 'correo', 'ciudad', 'ceco', 'proyecto',
    'cargo', 'gerente', 'nivel_usuario',
    // Sección 2 — Equipo anterior
    'eq_ant_tipo', 'eq_ant_marca', 'eq_ant_modelo', 'eq_ant_serial', 'eq_ant_af',
    'eq_ant_placa', 'eq_ant_hostname', 'eq_ant_procesador',
    'eq_ant_ram', 'eq_ant_disco', 'eq_ant_so',
    // Sección 4 — Equipo nuevo (+ eq_nvo_so nuevo en este Excel)
    'eq_nvo_tipo', 'eq_nvo_marca', 'eq_nvo_modelo', 'eq_nvo_serial', 'eq_nvo_af',
    'eq_nvo_placa', 'eq_nvo_hostname', 'eq_nvo_procesador', 'eq_nvo_ram', 'eq_nvo_disco',
    'eq_nvo_so',
    // Sección 5 — Proceso REN26
    'tecnico', 'estado', 'estado_entrega_equipo_nuevo',
    'notas_alistamiento',
    'caso_envio', 'fecha_envio', 'fecha_entrega',
    'fecha_envio_acta', 'fecha_firma_acta',
    'acta_entrega_url', 'nombre_archivo',
    'feedback',
    // Sección 7 — Devolución
    'estado_devolucion',
    'fecha_solicitud_devolucion', 'fecha_transito', 'fecha_recepcion_bodega',
    'lista_recoleccion',
    'observaciones_devolucion',  // TASK 13 fix: campo con control UI en formulario
    // Evaluación física y RAEE
    'eval_bateria', 'eval_teclado', 'eval_touchpad', 'eval_estetico',
    'recomendacion_raee', 'motivo_raee', 'motor_raee_version', 'fecha_evaluacion_raee',
    'usuario_evaluacion_raee',
  ];

  // Campos requeridos (no pueden ser null/vacío al escribir)
  const REQUIRED_FIELDS = new Set(['tecnico', 'estado', 'empresa', 'cedula', 'nombre']);

  // Tipos esperados por campo (para validación de tipo)
  // QA-03: FIELD_TYPES — alineado al Excel Maestro definitivo
  const FIELD_TYPES = {
    estado:                      'choice',
    estado_entrega_equipo_nuevo: 'choice',
    tecnico:                     'choice',
    acta_entrega_url:            'string',
    feedback:                    'number',
    fecha_envio:                 'date',
    fecha_envio_acta:            'date',
    fecha_firma_acta:            'date',
    fecha_solicitud_devolucion:  'date',
    fecha_transito:              'date',
    fecha_recepcion_bodega:      'date',
    fecha_entrega:               'date',   // QA-03: restaurado en nuevo Excel
    notas_alistamiento:          'string', // QA-03: reemplaza fecha_alistamiento
    eq_nvo_so:                   'string', // QA-03: nuevo en Excel
  };

  // Choices válidos por campo
  const VALID_CHOICES = {
    estado: Object.values(
      (typeof STATES !== 'undefined' ? STATES : {})
    ),
    estado_entrega_equipo_nuevo: (
      typeof ConfigService !== 'undefined'
        ? ConfigService.ESTADO_ENTREGA_EQ_NVO.filter(Boolean)
        : ['Pendiente','Alistado','En tránsito','Entregado','Completado']
    ),
    tecnico: (
      window.CONFIG && window.CONFIG.technicians
        ? window.CONFIG.technicians
        : ['Cristian','Santiago','Nicolas']
    ),
  };

  return {
    ALLOWED_FIELDS,
    PROTECTED_FIELDS,
    READONLY_FIELDS,
    REQUIRED_FIELDS,
    FIELD_TYPES,
    VALID_CHOICES,

    /** true si el campo puede escribirse a SP */
    isAllowed(field) { return ALLOWED_FIELDS.includes(field); },

    /** true si el campo está protegido (nunca escribe) */
    isProtected(field) { return PROTECTED_FIELDS.has(field); },

    /** true si el campo es de solo lectura (viene del Excel/SAP) */
    isReadonly(field) { return READONLY_FIELDS.has(field); },

    /** true si el campo es requerido */
    isRequired(field) { return REQUIRED_FIELDS.has(field); },

    /** Retorna los campos de un record que son escribibles */
    filterWritable(changes) {
      const safe = {};
      Object.keys(changes).forEach(k => {
        if (ALLOWED_FIELDS.includes(k)) safe[k] = changes[k];
      });
      return safe;
    },
  };
})();
window.WriteContract = WriteContract;

// ═══════════════════════════════════════════════════════════════════
// F7.4.0 · GraphWriteValidator
// Valida un payload antes de enviarlo a SharePoint.
// Si falla UNA validación: NO escribir.
// ═══════════════════════════════════════════════════════════════════
const GraphWriteValidator = (() => {
  function ok(field, message)  { return { valid: true,  field, message }; }
  function err(field, message) { return { valid: false, field, message }; }

  const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

  return {
    /**
     * Valida un campo individual contra el WriteContract.
     * @returns { valid, field, message }
     */
    validateField(field, value) {
      // 1. Campo protegido
      if (WriteContract.isProtected(field))
        return err(field, `Campo protegido — nunca se escribe: ${field}`);

      // 2. Campo no permitido (readonly o desconocido)
      if (!WriteContract.isAllowed(field))
        return err(field, `Campo no en la whitelist de escritura: ${field}`);

      // 3. Campo requerido no puede ser vacío
      if (WriteContract.isRequired(field)) {
        if (value === null || value === undefined || String(value).trim() === '')
          return err(field, `Campo requerido no puede ser vacío: ${field}`);
      }

      const type = WriteContract.FIELD_TYPES[field];
      // GH3.41.1: resolver choices en tiempo de validación, no en tiempo de carga
      // ConfigService no existe cuando graph.js inicializa su IIFE (#6 en carga)
      // pero sí existe cuando validateField() se ejecuta (boot.js carga en #13)
      const choices = (function() {
        if (field === 'estado_entrega_equipo_nuevo' && typeof ConfigService !== 'undefined')
          return ConfigService.ESTADO_ENTREGA_EQ_NVO.filter(Boolean);
        return WriteContract.VALID_CHOICES[field];
      })();

      // 4. Validación de tipo
      if (type === 'boolean') {
        if (value !== null && value !== undefined && typeof value !== 'boolean'
            && !['true','false','SI','NO','1','0'].includes(String(value)))
          return err(field, `${field} debe ser boolean, recibido: ${typeof value}`);
      }
      if (type === 'number') {
        if (value !== null && value !== undefined && isNaN(Number(value)))
          return err(field, `${field} debe ser numérico, recibido: ${value}`);
        if (field === 'feedback' && value !== null && (Number(value) < 0 || Number(value) > 5))
          return err(field, `feedback debe estar entre 0 y 5, recibido: ${value}`);
      }
      if (type === 'date') {
        if (value && !DATE_RE.test(String(value)))
          return err(field, `${field} no es fecha ISO válida: ${value}`);
      }

      // 5. Choice válido
      if (choices && choices.length > 0 && value !== null && value !== undefined && value !== '') {
        if (!choices.map(c => String(c)).includes(String(value)))
          return err(field, `${field} valor "${value}" no está en los choices válidos: [${choices.join(',')}]`);
      }

      return ok(field, `${field}: válido`);
    },

    /**
     * Valida un objeto de cambios completo.
     * @returns { valid, errors[], warnings[] }
     */
    validate(changes, record, user) {
      const errors = [], warnings = [];

      // RBAC: el usuario tiene permiso de escritura?
      if (typeof can === 'function' && !can('renewal.edit')) {
        errors.push({ field: '_rbac', message: `Rol ${(user || state.user).role} sin permiso renewal.edit` });
        return { valid: false, errors, warnings };
      }

      // Validar cada campo
      Object.entries(changes).forEach(([field, value]) => {
        const result = this.validateField(field, value);
        if (!result.valid) errors.push({ field: result.field, message: result.message });
      });

      // Integridad referencial: si hay campo que cambia el estado
      if (changes.estado && record) {
        const fromState  = record.estado;
        const toState    = changes.estado;
        if (fromState === toState) {
          // Mismo estado — no es un cambio real, solo advertencia
          warnings.push({ field: 'estado', message: `estado sin cambio: ${toState} → ${toState}` });
        } else {
          // GH3.42.18: super_admin/gestor_activos pueden hacer correcciones
          // administrativas fuera de la secuencia estándar (ej. sacar un
          // registro legacy de "Cerrado", o corregir un estado mal asignado).
          // isValidTransition() sigue rigiendo para el resto de roles (técnico),
          // que no debe poder saltarse pasos de su flujo diario. El valor de
          // "estado" en sí sigue validado como choice más arriba (VALID_CHOICES)
          // para TODOS los roles — esto libera únicamente el orden, no el valor.
          const _u = user || (window.state && state.user);
          const _role = _u && (_u.role || _u.rol);
          const _isAdminOverride = _role === 'super_admin' || _role === 'gestor_activos';
          const _validSeq = typeof StateMachine === 'undefined' || StateMachine.isValidTransition(fromState, toState);
          if (!_validSeq && !_isAdminOverride) {
            errors.push({ field: 'estado', message: `Transición inválida: ${fromState} → ${toState}` });
          } else if (!_validSeq && _isAdminOverride) {
            warnings.push({ field: 'estado', message: `Corrección administrativa fuera de flujo estándar: ${fromState} → ${toState} (rol ${_role})` });
          }
        }
      }

      // Advertencia: campos que viajan vacíos
      Object.entries(changes).forEach(([field, value]) => {
        if ((value === '' || value === null || value === undefined)
            && !WriteContract.isRequired(field)) {
          warnings.push({ field, message: `${field} viaja vacío — se escribirá null en SP` });
        }
      });

      return { valid: errors.length === 0, errors, warnings };
    },
  };
})();
window.GraphWriteValidator = GraphWriteValidator;

// ═══════════════════════════════════════════════════════════════════
// F7.4.0 · GraphPayloadBuilder
// Construye el payload listo para PATCH de Microsoft Graph.
// Usa SP_FIELD_MAP_INVERSE para mapear campos JSON → SP InternalName.
// Soporta dryRun: NO llama PATCH, solo genera el payload.
// ═══════════════════════════════════════════════════════════════════
const GraphPayloadBuilder = (() => {
  function normalizeValue(field, value) {
    const type = WriteContract.FIELD_TYPES[field];
    if (value === null || value === undefined || value === '') return null;
    if (type === 'boolean') return !!value || value === 'SI' || value === '1' || value === 'true';
    if (type === 'number')  return Number(value);
    return String(value);
  }

  return {
    /**
     * Construye el payload JSON para PATCH /sites/{siteId}/lists/{listId}/items/{itemId}/fields
     * @param {object} changes — campos del dashboard
     * @param {string} etag    — ETag del ítem (requerido para If-Match)
     * @returns { fields, headers, url, etag, dryRun }
     */
    build(changes, etag, dryRun) {
      // 1. Filtrar solo campos permitidos
      const writable = WriteContract.filterWritable(changes);

      // 2. Mapear JSON → SP InternalName usando SP_FIELD_MAP_INVERSE
      const spFields = {};
      Object.entries(writable).forEach(([jsonField, value]) => {
        const spField = (window.SP_FIELD_MAP_INVERSE || {})[jsonField] || jsonField;
        spFields[spField] = normalizeValue(jsonField, value);
      });

      // 3. Construir headers (If-Match es obligatorio — previene sobrescritura concurrente)
      const headers = {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'If-Match':      etag || '*', // '*' solo aceptable en modo dryRun o forzado explícito
      };
      if (!etag && !dryRun) {

      }

      return {
        fields:  spFields,
        headers,
        etag:    etag || null,
        dryRun:  !!dryRun,
        fieldCount: Object.keys(spFields).length,
        jsonFields: Object.keys(writable),
        spFields:   Object.keys(spFields),
      };
    },

    /**
     * Modo DryRun — NO hace PATCH.
     * Genera y loguea el payload completo para revisión.
     */
    dryRun(record, changes, etag) {
      const validation = GraphWriteValidator.validate(changes, record, state.user);
      const payload    = this.build(changes, etag, true);

      const report = {
        mode:       'dryRun',
        timestamp:  Date.now(),
        recordId:   record ? record.id : null,
        spItemId:   record ? record.sp_item_id : null,
        validation: { valid: validation.valid, errors: validation.errors, warnings: validation.warnings },
        payload:    payload,
        // URL hipotética (siteId y listId pendientes de configuración)
        url:        SharePointResolver.isReady()
          ? `${SharePointResolver.getList()}/items/${record && record.sp_item_id || '{itemId}'}/fields`
          : '[SharePointResolver no configurado]',
        method:     'PATCH',
        body:       JSON.stringify({ fields: payload.fields }),
        wouldWrite: validation.valid && !!(record && record.sp_item_id),
      };






      console.groupEnd();

      return report;
    },

    /**
     * comparePayload: verifica que la reconstrucción del payload
     * producido sea compatible con los datos del Dashboard.
     * Compara: changes → build → reconstruct → verify equivalencia.
     */
    comparePayload(changes, record) {
      const payload = this.build(changes, null, true);
      const inverse = window.SP_FIELD_MAP || {};
      const reconstructed = {};

      // Reconstruir: SP field → JSON field usando SP_FIELD_MAP
      Object.entries(payload.fields).forEach(([spField, value]) => {
        const jsonField = inverse[spField] || spField;
        reconstructed[jsonField] = value;
      });

      // Comparar campo a campo
      const differences = [];
      Object.entries(WriteContract.filterWritable(changes)).forEach(([jsonField, orig]) => {
        const rebuilt = reconstructed[jsonField];
        const origStr    = orig === null || orig === undefined ? '' : String(orig);
        const rebuiltStr = rebuilt === null || rebuilt === undefined ? '' : String(rebuilt);
        if (origStr !== rebuiltStr) {
          differences.push({ field: jsonField, original: orig, rebuilt });
        }
      });

      return {
        match:        differences.length === 0,
        differences,
        payload:      payload.fields,
        reconstructed,
      };
    },
  };
})();
window.GraphPayloadBuilder = GraphPayloadBuilder;
// Compara dos providers campo a campo y genera un reporte de diferencias.
// Solo lectura. No modifica datos.
// ═══════════════════════════════════════════════════════════════════
async function compareProviders(providerA, providerB) {
  const report = {
    summary: { equal: 0, different: 0, onlyInA: 0, onlyInB: 0, total: 0 },
    differences: [],
    timestamp: Date.now(),
  };

  let dataA, dataB;
  try { dataA = await providerA.loadData(); } catch(e) { dataA = null; }
  try { dataB = await providerB.loadData(); } catch(e) { dataB = null; }

  if (!dataA || !dataB) {
    report.error = 'No se pudo cargar datos de uno o ambos providers';
    return report;
  }

  const renA = (dataA.renovaciones || []);
  const renB = (dataB.renovaciones || []);
  report.summary.total = Math.max(renA.length, renB.length);

  // Indexar por id
  const idxA = {};
  renA.forEach(r => { idxA[r.id] = r; });
  const idxB = {};
  renB.forEach(r => { idxB[r.id] = r; });

  // Solo en A
  renA.filter(r => !idxB[r.id]).forEach(r => {
    report.summary.onlyInA++;
    report.differences.push({ type: 'ONLY_IN_A', id: r.id, nombre: r.nombre });
  });

  // Solo en B
  renB.filter(r => !idxA[r.id]).forEach(r => {
    report.summary.onlyInB++;
    report.differences.push({ type: 'ONLY_IN_B', id: r.id, nombre: r.nombre });
  });

  // En ambos — comparar campo a campo
  const COMPARE_FIELDS = ['nombre','empresa','cedula','tecnico','estado',
    'eq_ant_serial','eq_ant_procesador','eq_nvo_serial','eq_nvo_marca'];
  renA.filter(r => idxB[r.id]).forEach(rA => {
    const rB = idxB[rA.id];
    COMPARE_FIELDS.forEach(field => {
      const vA = rA[field], vB = rB[field];
      const isNull_A = vA === null || vA === undefined || vA === '';
      const isNull_B = vB === null || vB === undefined || vB === '';
      if (isNull_A !== isNull_B || (!isNull_A && !isNull_B && String(vA) !== String(vB))) {
        report.summary.different++;
        report.differences.push({
          type:  'VALUE_DIFF',
          id:    rA.id,
          field,
          valueA: vA,
          valueB: vB,
        });
      } else {
        report.summary.equal++;
      }
    });
  });

  return report;
}
window.compareProviders = compareProviders;

// Continúa con GraphProvider F7.3:
// Infraestructura completa de conexión con Microsoft Graph.
// F7.2: solo initialize/connect/health/testConnection/getMetadata.
// F7.3: implementará loadRenewals/saveRenewals/sync/CRUD.
// ═══════════════════════════════════════════════════════════════════
const GraphProvider = (() => {
  let _connected = false;
  let _metadata  = null;
  let _lastHealthCheck = null;

  // Scopes para SharePoint (se activan en F7.3)
  const SHAREPOINT_SCOPES = [
    'User.Read',
    // 'Sites.Read.All',       // F7.3 — lectura de listas
    // 'Sites.ReadWrite.All',  // F7.3 — escritura en listas
    // 'Files.ReadWrite.All',  // F7.3 — archivos (actas, evidencias)
  ];

  return {
    name:   'GraphProvider',
    source: 'sharepoint://Plan_Maestro_REN26.xlsx',

    // Credenciales (referencia — la autenticación real está en AuthProvider)
    _tenantId: (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.tenantId) || '',
    _clientId: (window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.clientId) || '',

    /**
     * Inicializa GraphProvider: prepara GraphClient y SharePointResolver.
     * No abre ninguna conexión todavía.
     */
    async initialize() {
      if (!GraphClient._isInitialized()) {
        GraphClient.initialize({
          scopes:           SHAREPOINT_SCOPES,
          timeoutMs:        30000,
          retryMax:         3,
          retryBaseDelayMs: 500,
        });
      }
      SharePointResolver.initialize(
        window.APP_CONFIG && window.APP_CONFIG.sharePoint
          ? window.APP_CONFIG.sharePoint
          : {}
      );

      return true;
    },

    /**
     * Intenta conectar con Microsoft Graph.
     * En modo mock: siempre retorna connected=true (sin red real).
     * En modo msal: verifica autenticación y obtiene token de prueba.
     */
    async connect() {
      const isMsal = window.APP_CONFIG && window.APP_CONFIG.authenticationMode === 'msal';
      if (!isMsal) {
        _connected = true;

        return { connected: true, mode: 'mock' };
      }

      if (!AuthProvider.isAuthenticated()) {

        return { connected: false, error: 'NOT_AUTHENTICATED' };
      }

      try {
        const token = await AuthProvider.getAccessToken(SHAREPOINT_SCOPES);
        _connected = !!token;

        return { connected: _connected, mode: 'msal' };
      } catch(err) {
        _connected = false;
        console.error('[GraphProvider] connect() error:', err.message);
        return { connected: false, error: err.graphCode || 'CONNECTION_ERROR', message: err.message };
      }
    },

    /**
     * Verifica el estado de salud del provider.
     * GET /me — el endpoint más ligero de Graph que confirma el token.
     */
    async health() {
      const isMsal = window.APP_CONFIG && window.APP_CONFIG.authenticationMode === 'msal';
      if (!isMsal) {
        return { healthy: true, mode: 'mock', timestamp: Date.now() };
      }
      try {
        const me = await GraphClient.get('/me');
        _lastHealthCheck = { healthy: true, user: me && me.userPrincipalName, timestamp: Date.now() };
        return _lastHealthCheck;
      } catch(err) {
        _lastHealthCheck = { healthy: false, error: err.graphCode, timestamp: Date.now() };
        return _lastHealthCheck;
      }
    },

    /**
     * Prueba la conexión completa: token + /me + sitio SharePoint (si configurado).
     */
    async testConnection() {
      const result = { token: false, me: false, site: false, list: false, timestamp: Date.now() };
      const isMsal = window.APP_CONFIG && window.APP_CONFIG.authenticationMode === 'msal';

      if (!isMsal) {
        result.token = result.me = true;
        result.note  = 'mock mode — sin verificación real';
        return result;
      }

      // 1. Token
      try {
        const token = await AuthProvider.getAccessToken(SHAREPOINT_SCOPES);
        result.token = !!token;
      } catch(e) { result.tokenError = e.message; }

      if (!result.token) return result;

      // 2. /me
      try {
        const me = await GraphClient.get('/me');
        result.me   = !!me;
        result.user = me && me.userPrincipalName;
      } catch(e) { result.meError = e.graphCode || e.message; }

      // 3. Sitio SharePoint (solo si está configurado)
      if (SharePointResolver.isReady()) {
        try {
          const siteUrl = SharePointResolver.getSiteUrl();
          const site = await GraphClient.get(siteUrl);
          result.site     = !!site;
          result.siteId   = site && site.id;
          result.siteName = site && site.displayName;
        } catch(e) { result.siteError = e.graphCode || e.message; }

        // 4. Lista de renovaciones (si el sitio se resolvió)
        if (result.site) {
          try {
            const listUrl = SharePointResolver.getList();
            const list = await GraphClient.get(listUrl);
            result.list     = !!list;
            result.listName = list && list.displayName;
          } catch(e) { result.listError = e.graphCode || e.message; }
        }
      } else {
        result.note = 'SharePointResolver no configurado — siteId/siteHostname pendiente';
      }

      return result;
    },

    /**
     * Obtiene metadata del entorno Graph (tenant, usuario, sitio).
     * Solo en modo MSAL. En mock retorna metadata simulada.
     */
    async getMetadata() {
      const isMsal = window.APP_CONFIG && window.APP_CONFIG.authenticationMode === 'msal';
      if (!isMsal) {
        return {
          mode:    'mock',
          user:    { displayName: state.user.name, email: state.user.email },
          tenant:  { id: this._tenantId },
          site:    null,
          version: 'v8.8.3-F7.4.0-write-engine',
        };
      }
      try {
        const [me, org] = await Promise.allSettled([
          GraphClient.get('/me'),
          GraphClient.get('/organization'),
        ]);
        _metadata = {
          mode:    'msal',
          user:    me.status === 'fulfilled' ? { displayName: me.value.displayName, email: me.value.userPrincipalName } : null,
          tenant:  org.status === 'fulfilled' && org.value.value[0] ? { id: org.value.value[0].id, name: org.value.value[0].displayName } : { id: this._tenantId },
          site:    SharePointResolver.isReady() ? { host: SharePointResolver._raw().siteHostname, path: SharePointResolver._raw().sitePath } : null,
          version: 'v8.8.3-F7.4.0-write-engine',
          timestamp: Date.now(),
        };
        return _metadata;
      } catch(err) {
        console.error('[GraphProvider] getMetadata error:', err.message);
        return null;
      }
    },

    /** Desconecta el provider (no cierra sesión MSAL — usar AuthProvider.logout()) */
    disconnect() {
      _connected       = false;
      _metadata        = null;
      _lastHealthCheck = null;

    },

    // ── Métodos de datos — F7.3 implementado ──────────────────
    /**
     * Carga todos los datos desde SharePoint via Graph.
     * En modo mock: retorna datos vacíos (MockProvider).
     * En modo msal + SharePointResolver.isReady(): lee de Graph.
     * Usa GraphCache con TTL de APP_CONFIG.refreshInterval.
     */
    async loadData() {
      const isMsal = window.APP_CONFIG && window.APP_CONFIG.authenticationMode === 'msal';
      const CACHE_KEY = 'graph_pmc_data';
      const TTL = (window.APP_CONFIG && window.APP_CONFIG.refreshInterval) || 60000;

      // ── Modo mock ─────────────────────────────────────────────
      if (!isMsal || !SharePointResolver.isReady()) {
        if (isMsal && !SharePointResolver.isReady()) {
          const e = new Error('[GraphProvider] SharePointResolver no configurado — producción requiere siteId y listId');
          e.code = 'GRAPH_NOT_CONFIGURED';
          throw e;
        }
      }

      // ── Cache hit ─────────────────────────────────────────────
      const cached = GraphCache.get(CACHE_KEY);
      if (cached) {

        return cached;
      }

      // ── Obtener datos de SharePoint ───────────────────────────
      const t0 = Date.now();
      try {
        // 1. Renovaciones (lista principal)
        const SCOPES = ['User.Read', 'Sites.Read.All'];
        const renovItems = await GraphClient.getAll(
          SharePointResolver.getListItems(), SCOPES
        );


        // 2. Transformar Graph → Dashboard usando SP_FIELD_MAP
        const renovaciones = renovItems.map((item, idx) => {
          const fields = item.fields || item;
          const record = { id: idx + 1, sp_item_id: item.id || null };
          // Mapear campos SP → JSON
          Object.entries(window.SP_FIELD_MAP || SP_FIELD_MAP).forEach(([spField, jsonField]) => {
            if (spField in fields && jsonField !== 'sp_item_id') {
              record[jsonField] = fields[spField];
            }
          });
          // Garantías mínimas
          if (!record.id) record.id = idx + 1;
          if (!record.estado) record.estado = 'PENDIENTE';
                  return record;
        });

        // 3. Tablas secundarias — provienen del Bootstrap (cargadas antes de este punto)
        const result = {
          renovaciones,
          inventario_equipos: [],
          usuarios_sistema:   window.SYSTEM_USERS || [],
          roles:              window.ROLES        || [],
          roles_permisos:     window.ROLES_PERMISOS || [],
          // GH3.18: CONFIGURATION eliminado
          auditoria:          [],
          notificaciones:     [],
        };

        // 4. Guardar en cache
        GraphCache.set(CACHE_KEY, result, TTL);

        return result;

      } catch(err) {
        console.error('[GraphProvider] loadData() error:', err.graphCode || err.message);
        EventBus.publish('provider.sync.failed', { error: err.message, code: err.code });
        throw err;
      }
    },
    async getRenovaciones()    { const d = await this.loadData(); return (d && d.renovaciones)       || []; },
    async getInventario()      { const d = await this.loadData(); return (d && d.inventario_equipos) || []; },
    async getUsuariosSistema() { const d = await this.loadData(); return (d && d.usuarios_sistema)   || []; },
    async getRoles()           { const d = await this.loadData(); return (d && d.roles)              || []; },
    async getConfiguracion()   { const d = await this.loadData(); return (d && d.configuracion)      || []; },

    // ── Estado ──────────────────────────────────────────────────
    isConnected()         { return _connected; },
    getLastHealthCheck()  { return _lastHealthCheck; },
    getCachedMetadata()   { return _metadata; },
    _scopes:              SHAREPOINT_SCOPES,
  };
})();
window.GraphProvider = GraphProvider;

const RenovacionModel = {

  /** Normaliza un equipo anterior desde campos flat del dataset Excel */
  normalizeEquipoAnterior(record) {
    // F3.6 · clasificacion_obsolescencia proviene EXCLUSIVAMENTE de
    // ObsolescenceService (motor). No es editable manualmente desde UI.
    // af está dentro del sub-objeto equipoAnterior (no duplicado en sección 2).
    return {
      tipo:       record.eq_ant_tipo       || null,
      marca:      record.eq_ant_marca      || null,
      modelo:     record.eq_ant_modelo     || null,
      af:         record.eq_ant_af         || null,  // Activo Fijo anterior
      serial:     record.eq_ant_serial     || null,
      hostname:   record.eq_ant_hostname   || null,
      placa:      record.eq_ant_placa      || null,
      procesador: record.eq_ant_procesador || null,
      memoria:    record.eq_ant_ram         || null,
      so:         record.eq_ant_so         || null,
      // campos calculados por ObsolescenceService (solo lectura en UI)
      clasificacion: record.clasificacion_obsolescencia || null,
      generacion:    record.generacion_cpu               || null,
      accion:        record.accion_requerida             || null,
    };
  },
  
  /** Normaliza un equipo nuevo desde campos flat del dataset Excel */
  normalizeEquipoNuevo(record) {
    const inv = window.RelationsResolver ? RelationsResolver.findInventoryForRecord(record) : null;
    return {
      tipo:       record.eq_nvo_tipo       || (inv && inv.tipo) || null,
      marca:      record.eq_nvo_marca      || (inv && inv.marca) || null,
      modelo:     record.eq_nvo_modelo     || (inv && inv.modelo) || null,
      af:         record.eq_nvo_af         || (inv && inv.af) || null,
      serial:     record.eq_nvo_serial     || (inv && inv.serial) || null,
      hostname:   record.eq_nvo_hostname   || (inv && inv.hostname) || null,
      placa:      record.eq_nvo_placa      || (inv && inv.placa) || null,
      procesador: record.eq_nvo_procesador || (inv && inv.procesador) || null,
      ram:        record.eq_nvo_ram || record.eq_nvo_memoria || (inv && inv.ram) || null,
      memoria:    record.eq_nvo_ram || record.eq_nvo_memoria || (inv && inv.ram) || null,
      disco:      record.eq_nvo_disco      || (inv && inv.disco) || null,
      so:         record.eq_nvo_so         || (inv && inv.so) || null,
      // F3.1 · campos de inventario (preparación módulo F5)
      id_inv:            inv ? inv.id_inv : null,
      estado_inventario: inv ? inv.estado_inventario : null,
      fecha_asignacion:  inv ? inv.fecha_asignacion : null,
      // F3.6 · estado físico de entrega del equipo nuevo (entidad independiente del estado del proceso)
      estado_entrega: record.estado_entrega_equipo_nuevo || null,
    };
  },
  
  /** Reconstruye los sub-objetos normalizados de un record */
  rebuildShape(record) {
    if (!record) return record;
    record.equipoAnterior = this.normalizeEquipoAnterior(record);
    record.equipoNuevo = this.normalizeEquipoNuevo(record);
    return record;
  },
  
  /** Vuelve a sincronizar los campos flat desde los sub-objetos (inverso) */
  syncFlatFromShape(record) {
    if (!record) return record;
    if (record.equipoAnterior) {
      const ea = record.equipoAnterior;
      record.eq_ant_tipo = ea.tipo; record.eq_ant_marca = ea.marca; record.eq_ant_modelo = ea.modelo;
      record.eq_ant_af = ea.af; record.eq_ant_serial = ea.serial; record.eq_ant_hostname = ea.hostname;
      record.eq_ant_placa = ea.placa; record.eq_ant_procesador = ea.procesador;
      record.eq_ant_ram = ea.memoria; record.eq_ant_so = ea.so;
    }
    if (record.equipoNuevo) {
      const en = record.equipoNuevo;
      record.eq_nvo_tipo = en.tipo; record.eq_nvo_marca = en.marca; record.eq_nvo_modelo = en.modelo;
      record.eq_nvo_af = en.af; record.eq_nvo_serial = en.serial; record.eq_nvo_hostname = en.hostname;
      record.eq_nvo_placa = en.placa; record.eq_nvo_procesador = en.procesador;
      record.eq_nvo_ram = en.ram; record.eq_nvo_memoria = en.memoria;
      record.eq_nvo_disco = en.disco; record.eq_nvo_so = en.so;
    }
    return record;
  },
};
window.RenovacionModel = RenovacionModel;

// ═══════════════════════════════════════════════════════════════════
// F3 · HELPERS DE UI · formato consistente sin null/undefined
// ═══════════════════════════════════════════════════════════════════

/** Devuelve "MARCA MODELO" o "—" si el equipo no tiene datos */
function formatEquipo(equipo) {
  if (!equipo) return '—';
  const partes = [equipo.marca, equipo.modelo].filter(p => p && String(p).trim());
  return partes.length > 0 ? partes.join(' ') : '—';
}
window.formatEquipo = formatEquipo;

/** Devuelve valor o "—" para evitar undefined/null en UI */
function fmt(v) {
  if (v == null || v === '') return '—';
  return String(v);
}
window.fmt = fmt;

// ═══════════════════════════════════════════════════════════════════
// F3 · DATA PROVIDERS (intercambiables)
// MockProvider (actual) · JSONProvider (F6 archivo externo) · GraphProvider (F7)
// La UI nunca habla con providers directamente, solo con DataService.
// ═══════════════════════════════════════════════════════════════════

const MockProvider = {
  name: 'MockProvider',
  source: 'embedded:window.PMC_DATA',
  
  async loadData() {
    // RC2: MockProvider solo disponible con dataSource='mock' (desarrollo)
    // En producción (dataSource='excel') DataService.getProvider() nunca retorna MockProvider
    return window.PMC_DATA || {renovaciones:[],inventario_equipos:[],usuarios_sistema:[],roles:[],roles_permisos:[],configuracion:[]};
  },
  async getRenovaciones() {
    return (window.PMC_DATA && window.PMC_DATA.renovaciones) || [];
  },
  async getInventario() {
    return (window.PMC_DATA && window.PMC_DATA.inventario_equipos) || [];
  },
  async getUsuariosSistema() {
    return (window.PMC_DATA && window.PMC_DATA.usuarios_sistema) || [];
  },
  async getRoles() {
    return (window.PMC_DATA && window.PMC_DATA.roles) || [];
  },
  async getConfiguracion() {
    return (window.PMC_DATA && window.PMC_DATA.configuracion) || [];
  },
};
window.MockProvider = MockProvider;

const JSONProvider = {
  name: 'JSONProvider',
  source: './data/plan_maestro_ren26.json',
  _cache: null,
  _loadPromise: null,
  
  async loadData() {
    if (this._cache) return this._cache;
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = (async () => {
      try {
        const res = await fetch(this.source, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        this._cache = data;

        return data;
      } catch(e) {

        // RC2: JSONProvider solo para desarrollo — no aplica en producción (excel mode)
        this._cache = window.PMC_DATA || {renovaciones:[], inventario_equipos:[], usuarios_sistema:[], roles:[], roles_permisos:[], configuracion:[]};
        return this._cache;
      }
    })();
    return this._loadPromise;
  },
  async getRenovaciones() {
    const d = await this.loadData();
    return (d && d.renovaciones) || [];
  },
  async getInventario() {
    const d = await this.loadData();
    return (d && d.inventario_equipos) || [];
  },
  async getUsuariosSistema() {
    const d = await this.loadData();
    return (d && d.usuarios_sistema) || [];
  },
  async getRoles() {
    const d = await this.loadData();
    return (d && d.roles) || [];
  },
  async getConfiguracion() {
    const d = await this.loadData();
    return (d && d.configuracion) || [];
  },
  invalidateCache() { this._cache = null; this._loadPromise = null; },
};
window.JSONProvider = JSONProvider;

// ═══════════════════════════════════════════════════════════════════
// F3.1 · DataMapper
// Traduce etiquetas externas (ROLES.json en MAYÚSCULAS) a las claves
// internas canónicas usadas por el RBAC (super_admin/gestor_activos/
// tecnico/visitante). Se mantienen los 4 roles internos como fuente
// de verdad para permisos granulares (16+ permisos); ROLES.json/
// ROLES_PERMISOS.json describen el mismo modelo a grano grueso
// (ALL/CREATE_UPDATE_DELETE_APPROVE/UPDATE_ASSIGNED/VIEW_ONLY) — se
// usan como metadata de catálogo, no para resolver permisos en runtime.
// ═══════════════════════════════════════════════════════════════════
const DataMapper = {
  ROLE_MAP: {
    // Variantes externas → rol interno canónico
    'SUPER ADMIN':        'super_admin',
    'SUPER_ADMIN':        'super_admin',
    'ADMINISTRADOR':      'super_admin',
    'ADMIN':              'super_admin',
    'LIDER TI':           'super_admin',
    'LIDER DE PROYECTOS': 'super_admin',
    'GESTOR ACTIVOS':     'gestor_activos',
    'GESTOR_ACTIVOS':     'gestor_activos',
    'GESTOR IT':          'gestor_activos',
    'COORDINADOR TI':     'gestor_activos',
    'GESTOR':             'gestor_activos',
    'TECNICO':            'tecnico',
    'TÉCNICO':            'tecnico',
    'CONSULTA':           'consulta',
    'VISITANTE':          'visitante',
  },
  
  /** "SUPER ADMIN" -> "super_admin" (clave interna canónica para can()/PERMISSIONS) */
  toInternalRole(externalRole) {
    if (!externalRole) return 'visitante';
    const upper = String(externalRole).trim().toUpperCase();
    return this.ROLE_MAP[upper] || String(externalRole).trim().toLowerCase().replace(/\s+/g, '_');
  },
  
  /** Normaliza un registro de USUARIOS_SISTEMA.json al shape interno */
  normalizeUsuarioSistema(raw) {
    return {
      id: raw.id_usuario,
      name: raw.nombre,
      email: raw.correo,
      role: this.toInternalRole(raw.rol),
      role_label: raw.rol,       // etiqueta original, para mostrar en UI
      estado: raw.estado,
    };
  },
};
window.DataMapper = DataMapper;

// ═══════════════════════════════════════════════════════════════════
// F3.1 · SplitJsonProvider
// Variante de JSONProvider que consume el Data Layer separado en 8
// archivos (REN26_JSON_LAYER) en lugar de un único JSON combinado.
// Misma interfaz pública que MockProvider/JSONProvider — intercambiable
// vía APP_CONFIG.dataSource sin tocar el resto de la app.
// ═══════════════════════════════════════════════════════════════════
const SplitJsonProvider = {
  name: 'SplitJsonProvider',
  sources: {
    renovaciones:       './data/renovaciones.json',
    inventario_equipos: './data/inventario_equipos.json',
    usuarios_sistema:   './data/usuarios_sistema.json',
    roles:              './data/roles.json',
    roles_permisos:     './data/roles_permisos.json',
    auditoria:          './data/auditoria.json',
    notificaciones:     './data/notificaciones.json',
    configuracion:      './data/configuracion.json',
  },
  _cache: null,
  _loadPromise: null,
  
  async loadData() {
    if (this._cache) return this._cache;
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = (async () => {
      try {
        const keys = Object.keys(this.sources);
        const fetched = await Promise.all(
          keys.map(k => fetch(this.sources[k], { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error(k + ': HTTP ' + r.status); return r.json(); }))
        );
        const data = {};
        keys.forEach((k, i) => { data[k] = fetched[i]; });
        // Normalizar shape: usuarios_sistema con roles mapeados a clave interna
        data.usuarios_sistema_raw = data.usuarios_sistema;
        data.usuarios_sistema = data.usuarios_sistema.map(u => DataMapper.normalizeUsuarioSistema(u));
        this._cache = data;

        return data;
      } catch(e) {

        this._cache = {renovaciones:[],inventario_equipos:[],usuarios_sistema:[],roles:[],roles_permisos:[],configuracion:[]};
        return this._cache;
      }
    })();
    return this._loadPromise;
  },
  async getRenovaciones() { const d = await this.loadData(); return (d && d.renovaciones) || []; },
  async getInventario() { const d = await this.loadData(); return (d && d.inventario_equipos) || []; },
  async getUsuariosSistema() { const d = await this.loadData(); return (d && d.usuarios_sistema) || []; },
  async getRoles() { const d = await this.loadData(); return (d && d.roles) || []; },
  async getConfiguracion() { const d = await this.loadData(); return (d && d.configuracion) || []; },
  invalidateCache() { this._cache = null; this._loadPromise = null; },
};
window.SplitJsonProvider = SplitJsonProvider;

// ════════════════════════════════════════════════════════════════════════
// GH2.5.6 — GraphResolver
// Responsabilidad única: resolver Site → Drive → Workbook dinámicamente.
// No conoce: Dashboard, Bootstrap, DataService, ExcelMapper, UI.
// Los IDs resueltos viven ÚNICAMENTE en memoria durante la sesión.
// Nunca se persisten en sessionStorage, localStorage, cookies, config.js.
// ════════════════════════════════════════════════════════════════════════
const GraphResolver = (() => {
  const SCOPES = ['User.Read', 'Files.ReadWrite.All'];

  // ── Cache en memoria (GH2.5.4) ──────────────────────────────────────
  // Privado, no exportado, no accesible desde fuera del IIFE.
  let _cache = { siteId: null, driveId: null, itemId: null, resolved: false };

  // ── GH2.5.1: Resolver siteId dinámicamente ───────────────────────────
  // GET /sites/{hostname}:/sites/{siteName}
  async function resolveSite(sharepointHost, siteName) {
    const resp = await GraphClient.get(
      '/sites/' + sharepointHost + ':/sites/' + siteName,
      SCOPES
    );
    if (!resp || !resp.id) {
      throw new Error('[GraphResolver] Site no encontrado: ' + siteName + ' en ' + sharepointHost);
    }
    return resp.id;
  }

  // ── GH2.5.2: Resolver driveId dinámicamente ──────────────────────────
  // GET /sites/{siteId}/drive  (biblioteca de documentos predeterminada)
  async function resolveDrive(siteId) {
    const resp = await GraphClient.get('/sites/' + siteId + '/drive', SCOPES);
    if (!resp || !resp.id) {
      throw new Error('[GraphResolver] Drive no encontrado para site: ' + siteId);
    }
    return resp.id;
  }

  // ── GH2.5.3: Resolver itemId dinámicamente ───────────────────────────
  // GET /drives/{driveId}/root:/{workbookRelativePath}
  // El Dashboard NUNCA conoce el itemId previamente.
  async function resolveWorkbook(driveId, workbookRelativePath) {
    const resp = await GraphClient.get(
      '/drives/' + driveId + '/root:/' + workbookRelativePath,
      SCOPES
    );
    if (!resp || !resp.id) {
      throw new Error('[GraphResolver] Workbook no encontrado: ' + workbookRelativePath);
    }
    return resp.id;
  }

  // ── resolveAll(): orquesta la resolución completa ────────────────────
  // Llama 3 veces a Graph API la primera vez. Las siguientes: cache en memoria.
  // Performance: ~300-900ms de latencia adicional en el primer login.
  async function resolveAll() {
    if (_cache.resolved) return Object.assign({}, _cache);

    const PC = window.PRODUCTION_CONFIG || {};
    const sharepointHost       = PC.sharepointHost       || 'hbt.sharepoint.com';
    const siteName             = PC.siteName             || '';
    const workbookRelativePath = PC.workbookRelativePath || '';

    if (!siteName || !workbookRelativePath) {
      const e = new Error('[GraphResolver] sharepointHost, siteName y workbookRelativePath son requeridos en PRODUCTION_CONFIG');
      e.code = 'GRAPH_RESOLVER_NOT_CONFIGURED';
      throw e;
    }

    const siteId  = await resolveSite(sharepointHost, siteName);
    const driveId = await resolveDrive(siteId);
    const itemId  = await resolveWorkbook(driveId, workbookRelativePath);

    // GH2.5.4: IDs solo en memoria — nunca a storage
    _cache = { siteId, driveId, itemId, resolved: true };
    return Object.assign({}, _cache);
  }

  // API pública
  return {
    resolveAll,
    getCache:    () => Object.assign({}, _cache),
    isResolved:  () => _cache.resolved,
    reset:       () => { _cache = { siteId: null, driveId: null, itemId: null, resolved: false }; },
  };
})();
window.GraphResolver = GraphResolver;


// ════════════════════════════════════════════════════════════════════════
// GH2.5.7 — HealthCheckService
// Diagnóstico completo del stack: MSAL → Token → Graph → Site → Drive →
// Workbook → Excel → Bootstrap → SynchronizationManager.
// Solo diagnóstico — nunca modifica datos.
// No visible para usuarios normales. Solo para soporte técnico.
// ════════════════════════════════════════════════════════════════════════
const HealthCheckService = (() => {
  const STATUS = { OK: 'OK', WARNING: 'WARNING', ERROR: 'ERROR' };

  function item(status, detail) {
    return { status, detail: detail || '' };
  }

  async function check() {
    const result = { timestamp: new Date().toISOString(), components: {} };
    const C = result.components;

    // 1. MSAL
    try {
      const isInit = typeof window.AuthProvider !== 'undefined';
      C.msal = isInit
        ? item(STATUS.OK, 'AuthProvider inicializado')
        : item(STATUS.ERROR, 'AuthProvider no disponible');
    } catch(e) { C.msal = item(STATUS.ERROR, e.message); }

    // 2. Token
    try {
      const isAuth = window.AuthProvider && window.AuthProvider.isAuthenticated();
      C.token = isAuth
        ? item(STATUS.OK, 'Sesión MSAL activa')
        : item(STATUS.WARNING, 'No autenticado — flujo de login pendiente');
    } catch(e) { C.token = item(STATUS.ERROR, e.message); }

    // 3. Graph API
    try {
      const me = await window.GraphClient.get('/me', ['User.Read']);
      C.graph = me && me.id
        ? item(STATUS.OK, 'Graph responde · usuario: ' + (me.mail || me.userPrincipalName || me.id))
        : item(STATUS.WARNING, 'Graph respondió sin datos de usuario');
    } catch(e) { C.graph = item(STATUS.ERROR, '[' + (e.graphCode || e.code || 'ERR') + '] ' + e.message); }

    // 4. Site (GraphResolver)
    try {
      const cache = window.GraphResolver && window.GraphResolver.getCache();
      C.site = (cache && cache.siteId)
        ? item(STATUS.OK, 'siteId resuelto (en memoria)')
        : item(STATUS.WARNING, 'siteId no resuelto aún — ejecutar GraphResolver.resolveAll()');
    } catch(e) { C.site = item(STATUS.ERROR, e.message); }

    // 5. Drive
    try {
      const cache = window.GraphResolver && window.GraphResolver.getCache();
      C.drive = (cache && cache.driveId)
        ? item(STATUS.OK, 'driveId resuelto (en memoria)')
        : item(STATUS.WARNING, 'driveId no resuelto aún');
    } catch(e) { C.drive = item(STATUS.ERROR, e.message); }

    // 6. Workbook (itemId)
    try {
      const cache = window.GraphResolver && window.GraphResolver.getCache();
      C.workbook = (cache && cache.itemId)
        ? item(STATUS.OK, 'itemId resuelto (en memoria)')
        : item(STATUS.WARNING, 'itemId no resuelto aún');
    } catch(e) { C.workbook = item(STATUS.ERROR, e.message); }

    // 7. Excel (estructura de tablas)
    try {
      if (window.WorkbookLoader && window.GraphResolver && window.GraphResolver.isResolved()) {
        const health = await window.WorkbookLoader.checkHealth();
        C.excel = health.ok
          ? item(STATUS.OK, 'Excel accesible · eTag: ' + (health.eTag || '-'))
          : item(STATUS.ERROR, health.reason || 'checkHealth falló');
      } else {
        C.excel = item(STATUS.WARNING, 'GraphResolver no resuelto — Excel no verificado');
      }
    } catch(e) { C.excel = item(STATUS.ERROR, e.message); }

    // 8. Bootstrap
    try {
      const done = window.BootstrapManager && window.BootstrapManager.isCompleted();
      C.bootstrap = done
        ? item(STATUS.OK, 'Bootstrap completado · rol: ' + (window.state && window.state.user && window.state.user.role))
        : item(STATUS.WARNING, 'Bootstrap no completado');
    } catch(e) { C.bootstrap = item(STATUS.ERROR, e.message); }

    // 9. SynchronizationManager
    try {
      const running = window.SynchronizationManager && window.SynchronizationManager.isRunning();
      C.sync = running
        ? item(STATUS.OK, 'Sincronización activa · intervalo: ' + ((window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.refreshInterval) || '?') + 'ms')
        : item(STATUS.WARNING, 'Sincronización no activa');
    } catch(e) { C.sync = item(STATUS.ERROR, e.message); }

    // Resumen
    const statuses = Object.values(C).map(c => c.status);
    result.overall = statuses.some(s => s === STATUS.ERROR)   ? STATUS.ERROR
                   : statuses.some(s => s === STATUS.WARNING) ? STATUS.WARNING
                   : STATUS.OK;
    return result;
  }

  return { check, STATUS };
})();
window.HealthCheckService = HealthCheckService;


// ════════════════════════════════════════════════════════════════════════
// GH2.5.8 — BUILD_INFO
// Solo para diagnóstico técnico — nunca visible para usuarios normales.
// Accesible desde consola del navegador: BUILD_INFO
// ════════════════════════════════════════════════════════════════════════
const BUILD_INFO = Object.freeze({
  version:     'v8.8.4-GH2.5',
  buildDate:   '2026-07-07',
  msalVersion: '3.28.1',      // @azure/msal-browser
  graphApi:    'v1.0',        // Microsoft Graph API version
  mode:        'GitHub Pages', // entorno de despliegue
  release:     'GH2.5',
  description: 'Dynamic SharePoint ID resolution',
  // Los siguientes campos se pueden actualizar en CI/CD:
  commitHash:  '',  // Agregar en pipeline: git rev-parse --short HEAD
  buildNumber: '',  // Agregar en pipeline
});
window.BUILD_INFO = BUILD_INFO;


/** Selector de provider según APP_CONFIG.dataSource */
DataService.getProvider = function() {
  const ds    = (window.APP_CONFIG && window.APP_CONFIG.dataSource) || 'mock';
  const debug = !!(window.PRODUCTION_CONFIG && window.PRODUCTION_CONFIG.debug)
             || !!(window.APP_CONFIG && window.APP_CONFIG.debug);

  // RC1: ExcelProvider es el único proveedor de producción
  if (ds === 'excel') {
    if (!window.ExcelProvider) throw new Error('[DataService] ExcelProvider no disponible');
    return window.ExcelProvider;
  }

  // Proveedores alternativos: solo en modo debug/desarrollo
  if (ds === 'json')       return JSONProvider;
  if (ds === 'json-split') return SplitJsonProvider;
  if (ds === 'graph' && window.GraphProvider) return window.GraphProvider;

  // MockProvider: solo en dataSource='mock' (explícito) o debug=true
  if (ds === 'mock') return MockProvider;
  if (debug) {

    return MockProvider;
  }

  // Producción sin dataSource configurado → error
  const err = new Error('[DataService] dataSource no configurado para producción. Establecer PRODUCTION_CONFIG.dataSource.');
  err.code = 'DATASOURCE_NOT_CONFIGURED';
  throw err;
};
DataService.providerName = function() { return this.getProvider().name; };

/** Wrapper: getRenovaciones desde el provider activo + normalización automática */
DataService.fetchRenovaciones = async function() {
  const provider = this.getProvider();
  const raw = await provider.getRenovaciones();
  raw.forEach(r => RenovacionModel.rebuildShape(r));
  return raw;
};

/** Reload completo desde el provider activo (futuro F7 con auto-sync) */
DataService.reloadFromProvider = async function() {
  const provider = this.getProvider();
  const data = await provider.loadData();
  if (!data) return false;
  // RC2: PMC_DATA no se actualiza en producción — dato operativo viene solo de Excel
  window.USERS        = (data.renovaciones       || []).slice(); // MVP P1: copia — no referencia
  window.INVENTORY    = (data.inventario_equipos || []).slice();
  window.SYSTEM_USERS = (data.usuarios_sistema   || []).slice();
  // Re-migrar y re-normalizar
  window.USERS.forEach(normalizeRecord_F3);

  return true;
};


