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

