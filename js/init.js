// RC3 — js/init.js
// Inicialización global de variables y recursos.


// ── RC2.3: Datos embebidos eliminados — los datos operativos se cargan
// exclusivamente desde el Excel Maestro en SharePoint tras la autenticación.
// No existe ningún dato de renovaciones, inventario, usuarios, roles ni
// configuración en este archivo HTML. El Dashboard inicia completamente vacío.

// MVP P1: Los datos se cargan DESPUÉS del login via DataService.reloadFromProvider()
// PMC_DATA permanece como fallback para MockProvider en modo desarrollo/offline.
window.USERS        = [];  // Poblado en boot() → reloadFromProvider()
window.INVENTORY    = [];  // Poblado en boot() → reloadFromProvider()
window.SYSTEM_USERS = [];  // Poblado en boot() → reloadFromProvider()
window.ROLES        = [];  // Poblado en boot() → reloadFromProvider()
window.ROLES_PERMISOS = [];  // RC2: poblado por BootstrapManager tras autenticación
// GH3.18: CONFIGURATION eliminado — era dead code (análisis GH3.18)
window.LOGOS = {
  // RC3.2: Logos extraídos a assets/ — referencias a archivos externos
  horizontal_color: 'assets/logo-heinsohn-horizontal-color.png',
  horizontal_white: 'assets/logo-heinsohn-horizontal-white.png',
  vertical_color:   'assets/logo-heinsohn-vertical-color.png',
  vertical_white:   'assets/logo-heinsohn-vertical-white.png',
};
window.CONFIG = {
  appName: 'PMC-TI-REN26',
  appShort: 'PMC-REN26',
  technicians: ['CRISTIAN', 'SANTIAGO', 'NICOLAS'],  // GH3.22 P3: valores reales del Excel
  version: 'v8.8.4-RC1-PRODUCTION',
};

// ════════════════════════════════════════════════════════════════════
// GH3.25 — HBT Debug & Test namespace
// window.HBT.debug()          → estado completo del sistema
// window.HBT.fieldMap()       → tabla de mapeo Dashboard ↔ Excel
// window.HBT.testWrite(id)    → test de escritura con rollback
// window.HBT.verifyWrites     → true activa GET post-PATCH
// ════════════════════════════════════════════════════════════════════
window.HBT = (function() {
  var _state = {
    _lastWrite:      null,
    _lastAbort:      null,
    _lastValidation: null,
    _corruptData:    [],
    verifyWrites:    false,  // activar para GET de verificación post-PATCH
  };

  // ── P6: debug() ─────────────────────────────────────────────────
  _state.debug = function() {
    var PC  = window.PRODUCTION_CONFIG || {};
    var GR  = window.GraphResolver;
    var cache = (GR && GR.isResolved()) ? GR.getCache() : {};
    var hdrs  = (window._EXCEL_HEADERS && window._EXCEL_HEADERS.RENOVACIONES) || [];
    var info = {
      workbook:       PC.workbookRelativePath || '?',
      worksheet:      'RENOVACIONES',
      headersLoaded:  hdrs.length,
      graphResolved:  GR ? GR.isResolved() : false,
      driveId:        cache.driveId ? cache.driveId.substring(0,8)+'...' : null,
      itemId:         cache.itemId  ? cache.itemId.substring(0,8)+'...' : null,
      sessionUser:    (window.state && state.user) ? state.user.id : null,
      lastWrite:      _state._lastWrite,
      lastAbort:      _state._lastAbort,
      lastValidation: _state._lastValidation,
      corruptData:    _state._corruptData,
      timestamp:      new Date().toISOString(),
    };
    console.debug('[HBT DEBUG]\n' + JSON.stringify(info, null, 2));
    return info;
  };

  // ── P3: fieldMap() ──────────────────────────────────────────────
  // Tabla completa Dashboard campo → columna Excel → estado
  _state.fieldMap = function() {
    var hdrs  = (window._EXCEL_HEADERS && window._EXCEL_HEADERS.RENOVACIONES) || [];
    var ALLOWED = (window.WriteContract && window.WriteContract.ALLOWED_FIELDS)
                  ? window.WriteContract.ALLOWED_FIELDS
                  : ['ciudad','proyecto','tecnico','estado','caso_envio','fecha_envio',
                     'notas_alistamiento','fecha_entrega','eq_nvo_so'];

    console.debug('[HBT FIELD MAP] Headers Excel (' + hdrs.length + '):');
    var table = [];
    hdrs.forEach(function(h, idx) {
      if (!h) return;
      var field = String(h).trim().toLowerCase();
      var colLetter = (function(n) {
        var r=''; n++;
        while(n>0){var m=(n-1)%26; r=String.fromCharCode(65+m)+r; n=Math.floor((n-1)/26);}
        return r;
      })(idx);
      var writable = ALLOWED.indexOf(field) >= 0;
      var status   = writable ? 'BIDI ✓' : 'READ-ONLY';
      table.push({ campo: field, columna: colLetter, excel: h, writable: writable, status: status });
      console.debug('  ' + field.padEnd(35) + colLetter.padEnd(5) + status);
    });

    // Campos en ALLOWED sin columna Excel
    ALLOWED.forEach(function(f) {
      var found = hdrs.some(function(h){ return String(h||'').trim().toLowerCase()===f.toLowerCase(); });
      if (!found) {
        console.debug('  *** ' + f.padEnd(33) + '???  NO EXISTE EN EXCEL — campo descartado');
        table.push({ campo: f, columna: '???', excel: null, writable: false, status: 'SIN COLUMNA EN EXCEL' });
      }
    });
    return table;
  };

  // ── P7: testWrite(id) ────────────────────────────────────────────
  _state.testWrite = async function(id) {
    console.debug('[TEST WRITE] Inicio — id:', id);
    var WW = window.WorkbookWriter;
    if (!WW) { console.debug('[TEST WRITE] FAIL — WorkbookWriter no disponible'); return; }
    var DS = window.DataService;
    if (!DS) { console.debug('[TEST WRITE] FAIL — DataService no disponible'); return; }
    var record = DS.getRenewal ? DS.getRenewal(id) : null;
    if (!record) { console.debug('[TEST WRITE] FAIL — Registro', id, 'no encontrado'); return; }

    var originalCiudad = record.ciudad || '';
    var testValue = 'HBTTEST' + Date.now().toString().slice(-6);

    // Forzar verificación durante el test
    var prevVerify = _state.verifyWrites;
    _state.verifyWrites = true;

    try {
      // PATCH 1 — escribir valor de prueba
      console.debug('[TEST WRITE] PATCH 1: ciudad =', testValue);
      var r1 = await WW.writeRecord(id, { ciudad: testValue });
      var ok1 = r1 && r1.ok;
      console.debug('[TEST WRITE] PATCH 1:', ok1 ? 'OK' : 'FAIL', '|', r1 && r1.reason || '');
      var v1 = _state._lastWrite;
      console.debug('[TEST WRITE] GET 1:', v1 && v1.verifyOk ? 'OK — confirmado en Excel' : 'Sin verificación / MISMATCH');

      // PATCH 2 — restaurar valor original
      console.debug('[TEST WRITE] PATCH 2 (rollback): ciudad =', originalCiudad);
      var r2 = await WW.writeRecord(id, { ciudad: originalCiudad || ' ' });
      var ok2 = r2 && r2.ok;
      console.debug('[TEST WRITE] PATCH 2:', ok2 ? 'OK' : 'FAIL');
      var v2 = _state._lastWrite;
      console.debug('[TEST WRITE] GET 2:', v2 && v2.verifyOk ? 'OK — rollback confirmado' : 'Sin verificación / MISMATCH');

      var passed = ok1 && ok2;
      console.debug('[TEST WRITE] RESULTADO:', passed ? 'TEST OK ✓' : 'TEST FAIL ✗');
      return { patch1: ok1, get1: v1 && v1.verifyOk, patch2: ok2, get2: v2 && v2.verifyOk, passed };
    } finally {
      _state.verifyWrites = prevVerify;
    }
  };

  return _state;
})();


// ── RC-01 P1: Mapeo campo interno → columna Excel (CamelCase)
// Usado por WorkbookWriter cuando la columna Excel NO está en lowercase-underscore.
// Si el Excel usa UPPERCASE_UNDERSCORE (EQ_NVO_TIPO), este alias no se activa
// porque ExcelFieldName.toLowerCase() coincide directamente con el campo interno.
// Si el Excel usa CamelCase (EqNvoTipo), este alias permite encontrar la columna.
window.FIELD_COLUMN_ALIASES = {
  // Nombre completo del colaborador
  'nombre':          'NombreCompleto',    // SP_FIELD_MAP: Title→nombre y NombreCompleto→nombre
  // Equipo nuevo
  'eq_nvo_tipo':     'EqNvoTipo',
  'eq_nvo_marca':    'EqNvoMarca',
  'eq_nvo_modelo':   'EqNvoModelo',
  'eq_nvo_serial':   'EqNvoSerial',
  'eq_nvo_placa':    'EqNvoPlaca',
  'eq_nvo_hostname': 'EqNvoHostname',
  'eq_nvo_procesador': 'EqNvoProcesador',
  'eq_nvo_ram':      'EqNvoRam',
  'eq_nvo_disco':    'EqNvoDisco',
  'eq_nvo_so':       'EqNvoSO',
  'dato_maestro':    'DatoMaestro',
  // Equipo anterior
  'eq_ant_tipo':     'EqAntTipo',
  'eq_ant_marca':    'EqAntMarca',
  'eq_ant_modelo':   'EqAntModelo',
  'eq_ant_serial':   'EqAntSerial',
  'eq_ant_af':       'EqAntAF',
  'eq_ant_placa':    'EqAntPlaca',
  'eq_ant_hostname': 'EqAntHostname',
  'eq_ant_procesador': 'EqAntProcesador',
  'eq_ant_memoria':  'EqAntRam',
  'eq_ant_disco':    'EqAntDisco',
  'eq_ant_so':       'EqAntSO',
  // Devolución
  'lista_recoleccion': 'LISTA_RECOLECCION',   // guard CamelCase
  'observaciones_devolucion': 'ObservacionesDevolucion',
  // Registro
  'ceco':            'CentroCostos',
  'registro':        'NIVEL_USUARIO',
  // Estado y seguimiento
  'estado_entrega_equipo_nuevo': 'EstadoEntregaEquipoNuevo',
  'estado':           'ESTADO_RENOVACION',  // Excel: ESTADO_RENOVACION
  'caso_envio':      'CasoEnvio',
  'fecha_envio':     'FechaEnvio',
  'fecha_entrega':   'FechaAsignacion',
  'fecha_envio_acta': 'FECHA_ACTA_ENVIADA',
  'fecha_firma_acta': 'FECHA_ACTA_FIRMADA',
  'fecha_solicitud_devolucion': 'FechaSolicitudDevolucion',
  'fecha_transito':  'FechaTransito',
  'fecha_recepcion_bodega': 'FechaRecepcionBodega',
  // Documentos
  'acta_entrega_url':  'ActaEntregaUrl',
  'nombre_archivo':    'NOMBRE_ARCHIVO_ACTA',
  'disposicion_final': 'DisposicionFinal',
  // Feedback y evidencia
  'feedback':          'CALIFICACION_FEEDBACK',
  'evidencia_adjunta': 'EvidenciaAdjunta',
};
