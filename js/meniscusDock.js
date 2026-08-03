// ════════════════════════════════════════════════════════════════════
// GH3.42.31 — Meniscus Dock: acceso rápido curado (Resumen/Usuarios/
// Seguimiento/Actividad/Ajustes), animación de "bead" líquido con física
// de resorte manual (rAF), adaptada de meniscus-dock.html (Cristian).
//
// Diferencias respecto al archivo original que compartió Cristian:
// - Sin ".faces" (los textos "Home / Everything on one surface" del
//   demo) — "solo quiero la animación", cada vista ya tiene su propio
//   contenido real. Navega con goView() existente, no es un router nuevo.
// - --accent YA NO se pisa en documentElement/:root. El original hacía
//   document.documentElement.style.setProperty('--accent', ...) —
//   hubiera sobreescrito el --accent global de TODA la app (botones,
//   badges, focus rings) con el color del tab activo del dock. Aquí
//   queda escopeado a --mdock-accent, solo dentro de #mdock.
// - 5 colores originales (#c2f542/#4ec5f1/#ffa53d/#b98cff/#ff4fa0)
//   reemplazados por la familia roja de REN26 (pedido explícito).
// - Pausa el loop de requestAnimationFrame cuando document.hidden —
//   el original corría indefinidamente; costo de batería real en un
//   dock que ahora queda siempre visible (no solo mobile).
// - Guardia RBAC: no anima el bead hacia un tab si AuthorizationService
//   bloquearía esa navegación — evita que el bead se desincronice de
//   la vista realmente mostrada (ver Council: técnico no tiene acceso
//   a 'actividad' ni 'ajustes').
// - MeniscusDock.setActiveByView(id), enganchado en goView() (utils.js,
//   una línea) — sincroniza el bead si la navegación viene del sidebar.
// ════════════════════════════════════════════════════════════════════
(function () {
  var TABS = [
    { id: 'resumen',   label: 'Resumen',     accent: '#D30034' },
    { id: 'usuarios',  label: 'Usuarios',    accent: '#A51C2B' },
    { id: 'panel',     label: 'Seguimiento', accent: '#E8495C' },
    { id: 'actividad', label: 'Actividad',   accent: '#8B1420' },
    { id: 'ajustes',   label: 'Ajustes',     accent: '#6A0F19' },
  ];

  var dock = document.getElementById('mdock');
  var wrap = document.getElementById('mdock-wrap');
  if (!dock || !wrap) return;

  var bead     = document.getElementById('mdock-bead');
  var trail    = document.getElementById('mdock-trail');
  var beadIcon = document.getElementById('mdock-bead-icon');
  var tabs     = Array.prototype.slice.call(dock.querySelectorAll('.mdock-tab'));

  if (!bead || !trail || !beadIcon || tabs.length !== TABS.length) return;

  beadIcon.innerHTML = tabs[0].querySelector('svg').outerHTML;

  var active = 0;
  var pos = 0, vel = 0, target = 0;
  var dragging = false;
  var centers = [];
  var rafId = null;

  function canAccess(id) {
    // GH3.42.31: mismo guard que ya usa goView() — si no existe
    // AuthorizationService, se asume acceso permitido (comportamiento
    // por defecto del propio goView()).
    return !(window.AuthorizationService && !AuthorizationService.canAccess(id));
  }

  function measure() {
    var r = dock.getBoundingClientRect();
    var n = tabs.length;
    centers = tabs.map(function (_, i) { return (r.width / n) * (i + 0.5); });
    if (!dragging) { pos = centers[active]; target = centers[active]; }
  }
  window.addEventListener('resize', measure);

  function setActive(i, opts) {
    opts = opts || {};
    active = i;
    target = centers[i] != null ? centers[i] : target;
    var t = TABS[i];
    dock.style.setProperty('--mdock-accent', t.accent);
    tabs.forEach(function (el, idx) { el.classList.toggle('is-active', idx === i); });
    beadIcon.innerHTML = tabs[i].querySelector('svg').outerHTML;
    if (opts.snap) { pos = target; vel = 0; }
  }

  // Sincronización externa: si la navegación real cambió por otro medio
  // (sidebar, código), mueve el bead sin volver a llamar goView().
  window.MeniscusDock = {
    setActiveByView: function (viewId) {
      var i = TABS.findIndex(function (t) { return t.id === viewId; });
      if (i >= 0 && i !== active) setActive(i);
    },
  };

  var STIFF = 210, DAMP = 22, TRAIL_K = 0.22;
  var last = performance.now();
  var trailPos = 0;

  function tick(now) {
    var dt = Math.min((now - last) / 1000, 0.032);
    last = now;

    if (!dragging) {
      var acc = (target - pos) * STIFF - vel * DAMP;
      vel += acc * dt;
      pos += vel * dt;
    }
    trailPos += (pos - trailPos) * TRAIL_K;

    var speed = Math.abs(vel);
    var stretch = Math.min(speed / 900, 0.9);
    var w = 40 * (1 + stretch), h = 40 * (1 - stretch * 0.42);

    bead.style.width  = w + 'px';
    bead.style.height = h + 'px';
    bead.style.left   = pos + 'px';
    trail.style.left  = trailPos + 'px';

    var settle = 1 - Math.min(stretch * 2.2, 1);
    beadIcon.style.left    = pos + 'px';
    beadIcon.style.opacity = dragging ? 0 : settle;

    rafId = requestAnimationFrame(tick);
  }

  // Pausa el loop fuera de foco (pestaña oculta) — batería.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  });

  function navigate(i) {
    var id = TABS[i].id;
    if (!canAccess(id)) return; // RBAC: no anima ni navega si está bloqueado
    if (i !== active) setActive(i);
    if (window.goView) goView(id);
  }

  tabs.forEach(function (btn, i) {
    btn.addEventListener('click', function (e) {
      navigate(i);
      ripple(e.clientX, e.clientY);
    });
  });

  beadIcon.addEventListener('pointerdown', function (e) {
    dragging = true;
    beadIcon.setPointerCapture(e.pointerId);
    beadIcon.style.cursor = 'grabbing';
  });
  beadIcon.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var r = dock.getBoundingClientRect();
    var prev = pos;
    pos = Math.min(Math.max(e.clientX - r.left, 20), r.width - 20);
    vel = (pos - prev) / 0.016;
  });
  function release() {
    if (!dragging) return;
    dragging = false;
    var nearest = 0, best = Infinity;
    centers.forEach(function (c, i) { var d = Math.abs(c - pos); if (d < best) { best = d; nearest = i; } });
    beadIcon.style.cursor = 'grab';
    navigate(nearest);
  }
  beadIcon.addEventListener('pointerup', release);
  beadIcon.addEventListener('pointercancel', release);

  function ripple(x, y) {
    var r = dock.getBoundingClientRect();
    var el = document.createElement('div');
    el.className = 'mdock-ripple';
    el.style.left = (x - r.left) + 'px';
    el.style.top  = (y - r.top) + 'px';
    el.style.background = getComputedStyle(dock).getPropertyValue('--mdock-accent') || '#D30034';
    dock.appendChild(el);
    setTimeout(function () { el.remove(); }, 520);
  }

  requestAnimationFrame(function () {
    measure();
    setActive(0, { snap: true });
    rafId = requestAnimationFrame(tick);
  });
})();
