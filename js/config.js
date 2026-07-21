// ════════════════════════════════════════════════════════════════════
// js/config.js — PMC-TI-REN26 GH2.5
// GH2.5.5: PRODUCTION_CONFIG reducido a coordenadas lógicas únicamente.
// Los IDs internos de SharePoint (siteId, driveId, itemId) son resueltos
// dinámicamente por GraphResolver en tiempo de ejecución.
// Nunca se persisten. Solo existen en memoria durante la sesión.
// ════════════════════════════════════════════════════════════════════
window.PRODUCTION_CONFIG = {
  // ── Microsoft Azure AD ──────────────────────────────────────────
  // clientId y tenantId son identificadores públicos para SPA (no secretos).
  // PKCE reemplaza al client secret en Authorization Code Flow.
  tenantId: '38f48feb-4b87-481f-bd79-c2d633594e2f',
  clientId: 'f7d07502-0540-41ed-ba45-be7fc9ede012',

  // ── Coordenadas lógicas de SharePoint ───────────────────────────
  // GH2.5: El Frontend solo conoce coordenadas lógicas (nombres humanos).
  // GraphResolver resuelve siteId → driveId → itemId en tiempo de ejecución.
  sharepointHost:       'hbt.sharepoint.com',
  siteName:             'RepositorioIT',
  workbookRelativePath: 'N1/PMC-TI/PMC-TI-REN26/02_Maestro/Plan_Maestro_REN26.xlsx',

  // ── Modo de operación ────────────────────────────────────────────
  authenticationMode: 'msal',   // GitHub Pages SPA: Azure AD via MSAL popup
  dataSource:         'excel',  // Excel Maestro en SharePoint como única BD

  // ── Comportamiento ───────────────────────────────────────────────
  refreshInterval: 10000,  // 10s entre polls de sincronización
  debug:           false,  // false = producción sin fallbacks

  // ── Infraestructura ──────────────────────────────────────────────
  // GH2.5: endpoints centralizados — no deben duplicarse en ningún módulo
  graphEndpoint:    'https://graph.microsoft.com/v1.0',

  // ── Metadatos de build ───────────────────────────────────────────
  _release:   'GH2.5',
  _buildDate: '2026-07-07',
  _version:   'v8.8.4-GH2.5',
  version:    'GH3.42',      // Sprint activo — usado por AuditService para columna VERSION
};
