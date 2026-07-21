// ════════════════════════════════════════════════════════════════════
// STAB-v16 TASK 04 — CompanyMismatchService (regla AF)
// Motor reutilizable de detección de activos cruzados entre empresas.
// Reutilizable desde: Dashboard, Inventario, Reportes, Auditoría, QA.
//
// REGLAS OFICIALES:
//   Empresa del USUARIO: CECO que inicia con 'H' → HGS; cualquier otro → HBT
//   Empresa del EQUIPO:  AF que inicia con NÚMERO → HBT; con LETRA → HGS
//                        (los AF de HGS comienzan con 'AF-', ej: AF-932)
// ════════════════════════════════════════════════════════════════════
var CompanyMismatchService = (function() {
  'use strict';

  /**
   * Deriva la empresa del USUARIO a partir del CECO.
   * @param {string} ceco - Centro de Costo del usuario
   * @returns {'HGS'|'HBT'}
   */
  function detectUserCompany(ceco) {
    if (!ceco) return 'HBT';
    return String(ceco).trim().toUpperCase().charAt(0) === 'H' ? 'HGS' : 'HBT';
  }

  /**
   * Deriva la empresa del ACTIVO desde el AF.
   * Regla: AF numérico → HBT; AF que inicia con letra → HGS.
   * @param {Object} record
   * @returns {'HGS'|'HBT'|null}
   */
  function detectAssetCompany(record) {
    if (!record) return null;
    var af = record.eq_nvo_af || record.eq_ant_af || '';
    af = String(af).trim();
    if (!af) return null;
    var firstChar = af.charAt(0);
    // Dígito → HBT (AFs numéricos como 8991, 9088)
    if (firstChar >= '0' && firstChar <= '9') return 'HBT';
    // Letra → HGS (AFs con prefijo 'AF-')
    return 'HGS';
  }

  /**
   * Verifica si existe un cruce: empresa del activo ≠ empresa del usuario.
   * @param {Object} record
   * @returns {boolean}
   */
  function hasMismatch(record) {
    if (!record || !record.ceco) return false;
    var assetCompany = detectAssetCompany(record);
    if (!assetCompany) return false;
    var userCompany = detectUserCompany(record.ceco);
    return assetCompany !== userCompany;
  }

  /**
   * Genera el finding textual para un registro cruzado.
   * @param {Object} record
   * @returns {string}
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
   * @returns {Object[]} findings
   */
  function detectMismatch(records) {
    if (!Array.isArray(records)) return [];
    return records
      .filter(function(r) { return !isBackup(r) && hasMismatch(r); })
      .map(function(r) {
        return {
          id:             r.id,
          nombre:         r.nombre        || '—',
          empresa:        detectAssetCompany(r),
          empresaUsuario: detectUserCompany(r.ceco),
          ceco:           r.ceco          || '—',
          serial:         r.eq_nvo_serial || r.eq_ant_serial || '—',
          af:             r.eq_nvo_af     || r.eq_ant_af     || '—',
          ciudad:         r.ciudad        || '—',
          tecnico:        r.tecnico       || '—',
          estado:         r.estado        || '—',
          motivo:         generateFinding(r),
        };
      });
  }

  return {
    detectUserCompany:  detectUserCompany,
    detectAssetCompany: detectAssetCompany,
    hasMismatch:        hasMismatch,
    generateFinding:    generateFinding,
    detectMismatch:     detectMismatch,
  };
})();
window.CompanyMismatchService = CompanyMismatchService;
