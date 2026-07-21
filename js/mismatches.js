// ════════════════════════════════════════════════════════════════════
// STAB-v15 TASK 05 — CompanyMismatchService
// Motor reutilizable de detección de activos cruzados entre empresas.
// Reutilizable desde: Dashboard, Inventario, Reportes, Auditoría, QA.
// ════════════════════════════════════════════════════════════════════
var CompanyMismatchService = (function() {
  'use strict';

  /**
   * Deriva la empresa del USUARIO a partir del CECO.
   * Regla oficial: ceco que inicia con 'H' → HGS; cualquier otro → HBT.
   * @param {string} ceco - Centro de Costo del usuario
   * @returns {'HGS'|'HBT'}
   */
  function detectUserCompany(ceco) {
    if (!ceco) return 'HBT'; // default si no hay ceco
    return String(ceco).trim().toUpperCase().startsWith('H') ? 'HGS' : 'HBT';
  }

  /**
   * Deriva la empresa del ACTIVO desde el campo oficial del registro.
   * NUNCA se infiere por usuario, técnico, ciudad ni ceco.
   * @param {Object} record
   * @returns {string} empresa propietaria del activo
   */
  function detectAssetCompany(record) {
    return (record && record.empresa) ? String(record.empresa).trim().toUpperCase() : 'HBT';
  }

  /**
   * Verifica si existe un cruce: empresa del activo ≠ empresa del usuario.
   * @param {Object} record
   * @returns {boolean}
   */
  function hasMismatch(record) {
    if (!record || !record.ceco) return false;
    var assetCompany = detectAssetCompany(record);
    var userCompany  = detectUserCompany(record.ceco);
    return assetCompany !== userCompany;
  }

  /**
   * Genera el finding textual para un registro cruzado.
   * @param {Object} record
   * @returns {string} descripción del cruce
   */
  function generateFinding(record) {
    var assetCompany = detectAssetCompany(record);
    var userCompany  = detectUserCompany(record.ceco);
    return 'Activo propiedad de ' + assetCompany +
           ' asignado a colaborador de ' + userCompany + '.';
  }

  /**
   * Detecta todos los registros con empresa cruzada en un array.
   * NO modifica datos. Solo genera alertas.
   * @param {Object[]} records
   * @returns {Object[]} array de findings [{id, nombre, empresa, empresaUsuario, serial, af, ciudad, tecnico, estado, motivo}]
   */
  function detectMismatch(records) {
    if (!Array.isArray(records)) return [];
    return records
      .filter(function(r) { return !isBackup(r) && hasMismatch(r); })
      .map(function(r) {
        return {
          id:            r.id,
          nombre:        r.nombre        || '—',
          empresa:       detectAssetCompany(r),  // empresa propietaria del activo
          empresaUsuario:detectUserCompany(r.ceco), // empresa del usuario (derivada del ceco)
          ceco:          r.ceco          || '—',
          serial:        r.eq_ant_serial || r.eq_nvo_serial || '—',
          af:            r.eq_ant_af     || r.eq_nvo_af     || '—',
          ciudad:        r.ciudad        || '—',
          tecnico:       r.tecnico       || '—',
          estado:        r.estado        || '—',
          motivo:        generateFinding(r),
        };
      });
  }

  return {
    detectUserCompany: detectUserCompany,
    detectAssetCompany: detectAssetCompany,
    hasMismatch: hasMismatch,
    generateFinding: generateFinding,
    detectMismatch: detectMismatch,
  };
})();
window.CompanyMismatchService = CompanyMismatchService;
