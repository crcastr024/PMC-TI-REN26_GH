// ════════════════════════════════════════════════════════════════════
// js/app.js — PMC-TI-REN26 GH1
// Entry point: dispara boot() cuando el DOM está listo.
// Este archivo debe cargarse ÚLTIMO después de todos los módulos.
// ════════════════════════════════════════════════════════════════════

// GH1: iniciar la aplicación
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // El DOM ya está listo (carga diferida o script al final del body)
  boot();
}
