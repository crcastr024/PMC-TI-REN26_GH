// ════════════════════════════════════════════════════════════════════
// js/ui.js — PMC-TI-REN26 GH1
// Rendering de vistas, modal de edición, filtros, reportes, aprobaciones
// ════════════════════════════════════════════════════════════════════

function renderResumen() {
  try {
  // GH3.39.2 P2/P3: ÚNICA fuente de verdad — calculateProjectMetrics()
  // STAB-v09.1 TASK 8: fuente única de verdad — buildDashboardStats()
  var m = window.DashboardStats ? DashboardStats.get() : calculateProjectMetrics();

  // STAB-v09.1 TASK 3: KPIs por hitos canónicos de buildDashboardStats
  const real        = getReal();
  const total       = m.totalColaboradores || 0;
  const entregados  = m.entregados   || 0;  // hito: fecha_entrega OR estado>=Entregado
  const alistamiento= (m.estados && m.estados['Alistamiento']) || 0;
  const proceso     = m.proceso      || m.enProceso || 0;
  const pendientes  = m.pendientes   || 0;
  const actas       = m.actas        || 0;  // hito: fecha_firma_acta
  const pct = m.totalColaboradores > 0 ? Math.round(entregados / m.totalColaboradores * 100) : 0;
  var _setText = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = (v !== undefined && v !== null) ? String(v) : ''; };
  
  _setText('h-users', m.totalColaboradores);
  _setText('h-pendientes', pendientes);
  _setText('h-proceso', proceso);
  _setText('h-entregados', entregados);
  _setText('h-pct', pct + '%');
  
  _setText('h-empresas', 'HBT + HGS'); // STAB-v10: sin números de empresa en hero
  var _lkpiC = document.getElementById('lkpi-colabs');
  if (_lkpiC) _lkpiC.textContent = m.totalColaboradores;
  var _lkpiCS = document.getElementById('lkpi-colabs-sub');
  if (_lkpiCS) _lkpiCS.textContent = 'colaboradores activos';
  var _lkpiE = document.getElementById('lkpi-empresas');
  if (_lkpiE) _lkpiE.textContent = 'HBT + HGS';
  
  const _allCount   = m.totalEquipos;
  const _backupCount = m.totalBackups;
  _setText('k-total',       _allCount);
  _setText('k-entregados',  entregados);
  _setText('k-pct',         pct + '%');
  _setText('k-alistamiento',alistamiento);
  _setText('k-pendientes',  pendientes);
  _setText('k-actas',       actas);
  // P1 STAB-v10.1: nuevas tarjetas operativas
  var _enEnvio = m.enEnvio || 0;
  var _devPend = m.devolucionesPendientes || 0;
  var _porApr  = window.ApprovalService ? ApprovalService.getQueue().length : 0;
  _setText('k-en-envio',       _enEnvio);
  _setText('k-pendiente-acta', m.pendienteActa || 0);   // GH3.42.9: nuevo KPI
  _setText('k-por-aprobar',    _porApr);
  _setText('k-dev-pendientes', _devPend);
  var _bcEl = document.getElementById('k-backup');
  if (_bcEl) _bcEl.textContent = _backupCount;
  var _bcSubEl = document.getElementById('k-backup-sub');
  // STAB-v12.1: usar porEmpresa.backup
  var _peAll = m.porEmpresa || {};
  if (_bcSubEl) _bcSubEl.textContent = ((_peAll['HBT']||{}).backup||0) + ' HBT · ' + ((_peAll['HGS']||{}).backup||0) + ' HGS (backup)';

  // STAB-v16 TASK 1: subtítulo del Total con desglose asignados + backup
  var _tSubEl = document.getElementById('k-total-sub');
  var _activosCount = (_allCount || 0) - (_backupCount || 0);
  if (_tSubEl) _tSubEl.textContent = _activosCount + ' asignados + ' + (_backupCount || 0) + ' backup';

  // STAB-v16 TASK 1: renovaciones completadas (Renovación completada + Cerrado)
  var _completadas = 0;
  if (m.estados) _completadas = (m.estados['Renovación completada']||0) + (m.estados['Cerrado']||0);
  _setText('k-completadas', _completadas);
  
  _setText('b-usuarios', _allCount);
  const provName = (DataService.providerName ? DataService.providerName() : 'Mock');
  // QA-04: LED + hora solamente
  var _ledEl = document.getElementById('sync-led');
  var _timeEl = document.getElementById('tb-sync');
  if (_timeEl) _timeEl.textContent = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (_ledEl) { _ledEl.classList.remove('led-ok','led-warn','led-err'); _ledEl.classList.add('led-ok'); }
  var _wrap = document.getElementById('tb-sync-wrap');
  if (_wrap) _wrap.title = 'Última sincronización: ' + new Date().toLocaleTimeString('es-CO') + ' · ' + provName;
  $('footer-date').textContent = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  $('footer-stats').textContent = _allCount + ' equipos · ' + (window.calculateProjectMetrics ? calculateProjectMetrics().totalColaboradores : uniqueUsers()) + ' usuarios';
  // GH3.38 FC-07: actualizar identidad del usuario autenticado
  if (window.state && state.user) {
    var _role = state.user.role || state.user.rol || '';
    var _roleLabel = {
      super_admin:'Super Admin','gestor_activos':'Gestor Activos',
      tecnico:'Técnico',consulta:'Consulta',visitante:'Visitante'
    }[_role] || _role;
    var _roleEl = document.getElementById('user-role');
    if (_roleEl) _roleEl.textContent = _roleLabel + ' · TI';
    var _avatarEl = document.getElementById('user-avatar');
    var _nombre = state.user.nombre || state.user.name || state.user.email || '';
    if (_avatarEl && _nombre) {
      var parts = _nombre.trim().split(' ');
      _avatarEl.textContent = ((parts[0]||'')[0]+(parts[1]||'')[0]).toUpperCase();
    }
  }
  
  renderEmpresaChart();
  renderTecnicoChart();
  if (window.updateStatsBar) updateStatsBar();

  renderMap();

  // GH3.42.3 TASK 01: aplicar regla hide-if-zero a tarjetas de alerta compacta
  document.querySelectorAll('#view-resumen [data-hide-if-zero]').forEach(function(card) {
    var targetId = card.getAttribute('data-hide-if-zero');
    var target = document.getElementById(targetId);
    if (!target) return;
    var raw = (target.textContent || '').trim();
    var v = parseInt(raw, 10);
    if (isNaN(v) || v === 0) card.classList.add('is-hidden');
    else card.classList.remove('is-hidden');
  });
  } catch(e) {
    console.error('[renderResumen]', e.message);
  }
}

function renderEmpresaChart() {
  // STAB-v09.1 TASK 4: usar buildDashboardStats para consistencia total
  var _bds = window.DashboardStats ? DashboardStats.get() : calculateProjectMetrics();
  const data = ['HBT', 'HGS'].map(emp => {
    // STAB-v12.1: fuente única porEmpresa
    var d = (_bds.porEmpresa && _bds.porEmpresa[emp]) || { total:0, operativos:0, backup:0, pendientes:0, proceso:0, envio:0, entregados:0, actas:0, cerrados:0, pct:0 };
    return {
      label: emp, total: d.total, operativos: d.operativos, backup: d.backup,
      entregados: d.entregados, proceso: d.proceso, envio: d.envio,
      actas: d.actas, pend: d.pendientes, cerrados: d.cerrados, pct: d.pct,
    };
  });

  $('empresa-chart').innerHTML = data.map(d => {
    const pct = d.pct; // viene de porEmpresa canónico
    return '<div class="chart-row">' +'<div class="chart-row-head">' +'<div class="chart-row-name">' + d.label + '</div>' +'<div class="chart-row-stat"><strong>' + d.total + '</strong> op · <span style="opacity:.6">' + d.backup + ' bk</span> · <strong>' + pct + '%</strong></div>' +'</div>' +'<div style="font-size:10px;color:var(--text-3);margin:2px 0;display:flex;gap:10px">' +'<span>Entregados: '+d.entregados+'</span>' +'<span>En proceso: '+d.proceso+'</span>' +'<span>Pendientes: '+d.pend+'</span>' +'</div>' +'<div class="chart-bar">' +(d.entregados ? '<div class="chart-bar-seg" style="width:' + (d.entregados/Math.max(d.total,1)*100) + '%;background:var(--green)"></div>' : '') +(d.proceso    ? '<div class="chart-bar-seg" style="width:' + (d.proceso/Math.max(d.total,1)*100)    + '%;background:var(--amb)"></div>' : '') +(d.pend       ? '<div class="chart-bar-seg" style="width:' + (d.pend/Math.max(d.total,1)*100)       + '%;background:var(--accent)"></div>' : '') +'</div>' +'</div>';
  }).join('');
}

function renderTecnicoChart() {
  const _roleT = window.state && state.user && (state.user.role || state.user.rol);
  const _esTecnicoT = window.state && state.user && state.user.esTecnico;
  // STAB-v09.2 ÍTEM 6: técnico solo ve su propia tarjeta
  const techs = (_roleT === 'tecnico' && _esTecnicoT)
    ? [_esTecnicoT]
    : window.CONFIG.technicians;
  const colors = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--text-4)'];
  // STAB-v09.1 TASK 5: usar buildDashboardStats para consistencia total
  var _bds2 = window.DashboardStats ? DashboardStats.compute(getReal()) : calculateProjectMetrics();
  var _ptMap = _bds2.porTecnico || {};
  const data = techs.map((t, i) => {
    // P0: lookup case-insensitive — Excel puede tener 'CRISTIAN' vs config 'Cristian'
    var _tKey2 = Object.keys(_ptMap).find(function(k){ return k.toLowerCase() === t.toLowerCase(); }) || t;
    var d = _ptMap[_tKey2] || { asignados:0, pendientes:0, proceso:0, entregados:0, finalizados:0, pct:0 };
    return { tec: t, color: colors[i], total: d.asignados,
      pendientes: d.pendientes, entregados: d.entregados, proceso: d.proceso, finalizados: d.finalizados, pct: d.pct };
  }).filter(d => d.total > 0);
  $('tecnico-chart').innerHTML = data.map(d => {
    return '<div class="chart-row">' +'<div class="chart-row-head"><div class="chart-row-name" style="font-weight:700">' + esc(d.tec) + '</div>' +'<div class="chart-row-val">' + d.total + ' asig · <span style="color:var(--accent)">' + d.entregados + ' entregados</span> · <strong>' + d.pct + '%</strong></div></div>' +'<div style="font-size:10px;color:var(--text-3);display:flex;gap:10px;margin:2px 0">' +'<span>Pend:' + d.pendientes + '</span><span>Proc:' + d.proceso + '</span><span style="color:var(--green)">Fin:' + d.finalizados + '</span>' +'</div>' +'<div class="chart-bar"><div class="chart-bar-seg" style="width:' + Math.min(d.entregados/Math.max(d.total,1)*100,100) + '%;background:' + d.color + '"></div></div>' +'</div>';
  }).join('');
}


function renderMap() {
  const svg = $('map-svg');
  if (!svg) return;
  // GH3.42.3 TASK 06: agregado tracking de avance por ciudad para color dinámico
  const cityMap = {};
  const cityEntregados = {};
  DataService.getRenewals({}).forEach(u => {
    const c = u.ciudad ? u.ciudad : 'Sin ciudad';
    cityMap[c] = (cityMap[c] || 0) + 1;
    const esHito = u.fecha_entrega ||
      ['Entregado equipo nuevo','Pendiente devolución equipo anterior',
       'En tránsito equipo anterior','Equipo anterior recibido',
       'Renovación completada','Pendiente aprobación','Cerrado',
       'Entregado','Completado'].indexOf(u.estado) >= 0;
    if (esHito) cityEntregados[c] = (cityEntregados[c] || 0) + 1;
  });
  const cities = Object.entries(cityMap).sort((a,b) => b[1] - a[1]);
  if (cities.length === 0) { svg.innerHTML = ''; return; }

  // Helper: determinar tono según % avance
  function _cityColor(pct) {
    if (pct >= 70) return { fill:'#1F5940', halo:'rgba(31,89,64,.20)', stop1:'#2E7D5A', stop2:'#1F5940' };  // verde
    if (pct >= 30) return { fill:'#A56617', halo:'rgba(165,102,23,.22)', stop1:'#D97706', stop2:'#A56617' }; // ámbar
    return                { fill:'#A51C2B', halo:'rgba(165,28,43,.20)', stop1:'#DC2626', stop2:'#A51C2B' };  // rojo
  }

  const cx = 600, cy = 270;
  const main = cities[0];
  const rest = cities.slice(1, 22);
  let content = '';

  // Líneas dashed de conexión (fondo)
  rest.forEach((c, i) => {
    const angle = (i / rest.length) * Math.PI * 2 - Math.PI / 2;
    const dist = 180 + (i % 3) * 60;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    content += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" stroke="rgba(150,150,150,.18)" stroke-width="1" stroke-dasharray="2,4"/>';
  });

  // Nodos periféricos con color por avance
  rest.forEach((c, i) => {
    const angle = (i / rest.length) * Math.PI * 2 - Math.PI / 2;
    const dist = 180 + (i % 3) * 60;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const radius = Math.max(10, Math.min(28, 10 + c[1] * 1.3));
    const cityEsc = esc(c[0]).replace(/'/g, "\\'");
    const ent = cityEntregados[c[0]] || 0;
    const pct = Math.round(ent / c[1] * 100);
    const col = _cityColor(pct);
    content += '<g class="city-node" style="cursor:pointer" onclick="filterByCity(\'' + cityEsc + '\')">' +
      '<title>' + esc(c[0]) + ' · ' + c[1] + ' equipos · ' + pct + '% avance</title>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (radius+8) + '" fill="' + col.halo + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" fill="' + col.fill + '" stroke="rgba(255,255,255,.9)" stroke-width="2"/>' +
      '<text x="' + x + '" y="' + (y + 4) + '" fill="white" text-anchor="middle" font-size="10" font-weight="700" style="font-family:ui-monospace,monospace">' + pct + '%</text>' +
      '<text x="' + x + '" y="' + (y + radius + 16) + '" fill="var(--ink-2,#1F2733)" text-anchor="middle" font-size="12" font-weight="600">' + esc(c[0]) + '</text>' +
      '<text x="' + x + '" y="' + (y + radius + 30) + '" fill="var(--muted,#6B6660)" text-anchor="middle" font-size="10">' + c[1] + ' eq.</text>' +
      '</g>';
  });

  // Nodo principal con color por avance
  const mr = Math.max(56, Math.min(90, 56 + main[1] * 0.4));
  const mainEsc = esc(main[0]).replace(/'/g, "\\'");
  const mainEnt = cityEntregados[main[0]] || 0;
  const mainPct = Math.round(mainEnt / main[1] * 100);
  const mainCol = _cityColor(mainPct);
  content += '<defs><radialGradient id="grad-main"><stop offset="0%" stop-color="' + mainCol.stop1 + '"/><stop offset="100%" stop-color="' + mainCol.stop2 + '"/></radialGradient></defs>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + (mr+18) + '" fill="none" stroke="' + mainCol.halo + '" stroke-width="1.5"><animate attributeName="r" values="' + (mr+18) + ';' + (mr+34) + ';' + (mr+18) + '" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/></circle>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + mr + '" fill="url(#grad-main)" stroke="white" stroke-width="3" style="cursor:pointer" onclick="filterByCity(\'' + mainEsc + '\')">' +
    '<title>' + esc(main[0]) + ' · ' + main[1] + ' equipos · ' + mainPct + '% avance</title>' +
    '</circle>' +
    '<text x="' + cx + '" y="' + (cy - 10) + '" fill="white" text-anchor="middle" font-size="18" font-weight="800" style="pointer-events:none">' + esc(main[0]) + '</text>' +
    '<text x="' + cx + '" y="' + (cy + 8) + '" fill="rgba(255,255,255,.85)" text-anchor="middle" font-size="12" font-weight="600" style="pointer-events:none;font-family:ui-monospace,monospace">' + mainPct + '%</text>' +
    '<text x="' + cx + '" y="' + (cy + 24) + '" fill="rgba(255,255,255,.75)" text-anchor="middle" font-size="10" style="pointer-events:none">' + main[1] + ' equipos</text>';
  svg.innerHTML = content;
}

function filterByCity(city) {
  goView('usuarios');
  setTimeout(() => { $('search-input').value = city; renderUsuarios(); }, 100);
}
window.filterByCity = filterByCity;
// Auditoria Final: filtro multi-estado para tarjeta 'En envío'
function setMultiStateFilter(estados) {
  goView('usuarios');
  setTimeout(function() {
    var sel = $('filter-estado');
    if (sel) { sel.value = ''; }
    // Filtrar manualmente en memoria
    if (window.state) state.multiStateFilter = estados;
    renderUsuarios();
  }, 100);
}
window.setMultiStateFilter = setMultiStateFilter;

function setStateFilter(estado) {
  if (window.state) state.multiStateFilter = null; // limpiar multi-filter
  goView('usuarios');
  setTimeout(() => { $('filter-estado').value = estado; renderUsuarios(); }, 100);
}
window.setStateFilter = setStateFilter;

// ═══ USUARIOS ═══
function populateProjectFilter(selectId) {
  const sel = $(selectId);
  if (!sel) return;
  const projects = Array.from(new Set(DataService.getRenewals({}).map(u => u.proyecto).filter(p => p))).sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los proyectos</option>' + projects.map(p => '<option' + (p === current ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
}

function getFiltered() {
  const q = ($('search-input') ? $('search-input').value : '').toLowerCase();
  const emp = $('filter-empresa') ? $('filter-empresa').value : '';
  const tipo = $('filter-tipo') ? $('filter-tipo').value : '';
  const tec = $('filter-tecnico') ? $('filter-tecnico').value : '';
  const proj = $('filter-proyecto') ? $('filter-proyecto').value : '';
  const est = $('filter-estado') ? $('filter-estado').value : '';
  return DataService.getRenewals({}).filter(u => {
    if (emp && u.empresa !== emp) return false;
    if (tipo && (u.tipo || '').toUpperCase() !== tipo) return false;
    if (tec && (u.tecnico || '').toLowerCase() !== tec.toLowerCase()) return false;
    if (proj && u.proyecto !== proj) return false;
    if (est && u.estado !== est) return false;
    // Auditoría Final: soporte de multiStateFilter (tarjeta En envío)
    if (window.state && state.multiStateFilter && state.multiStateFilter.length) {
      if (state.multiStateFilter.indexOf(u.estado) < 0) return false;
    }
    if (q) {
      const blob = [u.nombre, u.cedula, u.usuario, u.correo, u.ciudad, u.serial, u.hostname, u.placa, u.empresa, u.proyecto, u.eq_ant_af, u.eq_nvo_af, u.eq_ant_serial, u.eq_ant_hostname, u.eq_nvo_serial, u.eq_nvo_hostname, u.proyecto, u.marca, u.modelo].join(' ').toLowerCase();
      if (blob.indexOf(q) < 0) return false;
    }
    return true;
  });
}

// GH3.42.11: Helper para resolver el nombre del técnico logueado matcheando
// contra la lista real de técnicos (window.CONFIG.technicians). Matching flexible
// porque state.user.name puede ser "Cristian Castro" pero el técnico en Excel es "CRISTIAN".
function _resolveMyTecnicoName() {
  if (!window.state || !state.user) return null;
  var uRole = state.user.role || state.user.rol;
  if (uRole !== 'tecnico') return null;
  var uName = String(state.user.nombre || state.user.name || '').toLowerCase().trim();
  var uEmail = String(state.user.email || '').toLowerCase();
  var mailPrefix = uEmail ? uEmail.split('@')[0].split(/[._-]/)[0] : '';
  var techs = (window.CONFIG && window.CONFIG.technicians) || [];

  // 1. Match exacto por nombre completo
  var found = techs.find(function(t){ return t.toLowerCase() === uName; });
  if (found) return found;
  // 2. Match por primer nombre del usuario (Cristian Castro → "cristian")
  var firstName = uName.split(/\s+/)[0];
  if (firstName) {
    found = techs.find(function(t){ return t.toLowerCase() === firstName; });
    if (found) return found;
  }
  // 3. Match por prefix de email
  if (mailPrefix) {
    found = techs.find(function(t){ return t.toLowerCase() === mailPrefix; });
    if (found) return found;
    // 4. Substring: primer nombre técnico contenido en nombre usuario o viceversa
    found = techs.find(function(t){
      var tl = t.toLowerCase();
      return tl.indexOf(mailPrefix) >= 0 || mailPrefix.indexOf(tl) >= 0;
    });
    if (found) return found;
  }
  // 5. Fallback: nombre técnico contenido en nombre usuario (indexOf)
  found = techs.find(function(t){
    var tl = t.toLowerCase();
    return uName.indexOf(tl) >= 0 || tl.indexOf(firstName) >= 0;
  });
  return found || null;
}
window._resolveMyTecnicoName = _resolveMyTecnicoName;

function renderUsuarios() {
  populateProjectFilter('filter-proyecto');
  var _dataAll = getFiltered();

  // GH3.42.8: Excluir backups por defecto — esta vista es de equipos ASIGNADOS
  // (los backups tienen vista propia en 'view-backup')
  var data = _dataAll.filter(function(u){ return !isBackup(u); });

  // GH3.42.8/11: Si el rol es técnico, filtrar a solo sus equipos asignados
  var _uRole = window.state && state.user && (state.user.role || state.user.rol);
  if (_uRole === 'tecnico') {
    var _myTecName = _resolveMyTecnicoName();
    if (_myTecName) {
      data = data.filter(function(u){
        var t = String(u.tecnico || '').toLowerCase().trim();
        return t === _myTecName.toLowerCase() ||
               t.indexOf(_myTecName.toLowerCase()) >= 0 ||
               _myTecName.toLowerCase().indexOf(t) >= 0;
      });
    }
  }

  $('tbl-count').textContent = data.length + ' de ' + (window.calculateProjectMetrics ? calculateProjectMetrics().totalEquipos : DataService.count()) + ' registros';
  if (data.length === 0) {
    $('tbl-body').innerHTML = '<tr><td colspan="15"><div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div class="empty-title">Sin resultados</div><div class="empty-msg">Ajusta los filtros o búsqueda</div></div></td></tr>';
    return;
  }
  $('tbl-body').innerHTML = data.map(u => {
    const estCls = isBackup(u) ? 'badge-backup' : ConfigService.badgeClass(u.estado || 'pendiente');
    const tipoCls = (u.tipo || '').toUpperCase() === 'TORRE' ? 'badge-torre' : 'badge-portatil';
    const recentCls = (state.settings.highlight && state.recentlyUpdatedId === u.id) ? ' class="recently-updated"' : '';
    var _indicators = '';
    if (isBackup(u)) _indicators += '<span title="Backup" style="font-size:11px">🔒</span>';
    if (u.recomendacion_raee === 'RAEE') _indicators += '<span title="RAEE" style="color:#C00000;font-size:11px;font-weight:700">♻</span>';
    if (u.equipo_reasignable) _indicators += '<span title="Reasignable" style="color:var(--blue);font-size:11px">↩</span>';
    if ((u.estado === 'Renovación completada' || u.estado === 'Cerrado') && !(u.feedback > 0)) _indicators += '<span title="Feedback pendiente" style="color:var(--amber);font-size:11px">★</span>';
    if (!u.acta_firmada && (u.estado === 'Entregado equipo nuevo' || u.estado === 'Renovación completada')) _indicators += '<span title="Acta pendiente" style="color:#7c3aed;font-size:11px">📄</span>';
    return '<tr' + recentCls + ' onclick="openEditModal(' + u.id + ')">' +
      '<td class="td-id">' + u.id + '</td>' +
      '<td style="font-size:14px;white-space:nowrap;min-width:50px">' + (_indicators || '—') + '</td>' +
      '<td><span class="badge badge-' + u.empresa.toLowerCase() + '">' + esc(u.empresa) + '</span></td>' +
      '<td><span class="badge ' + tipoCls + '">' + esc(u.tipo || '—') + '</span></td>' +
      '<td class="td-strong">' + esc(u.nombre || (isBackup(u) ? 'BACKUP ' + u.empresa : '—')) + '</td>' +
      '<td class="td-soft">' + esc(u.ciudad || '—') + '</td>' +
      '<td class="td-soft" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(u.proyecto) + '">' + esc(u.proyecto || '—') + '</td>' +
      '<td class="td-soft">' + esc(formatEquipo(u.equipoNuevo)) + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.serial || '—') + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.placa || '—') + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.hostname || '—') + '</td>' +
      '<td class="td-soft">' + esc(u.tecnico || '—') + '</td>' +
      '<td><span class="badge ' + estCls + '">' + esc(u.estado || 'Pendiente') + '</span></td>' +
      '<td style="text-align:center">' + (u.acta_firmada ? '<span style="color:var(--green);font-weight:700">✓</span>' : '<span style="color:var(--text-4)">—</span>') + '</td>' +
      '<td class="td-actions" onclick="event.stopPropagation()">' +
        '<button class="row-action" onclick="openEditModal(' + u.id + ')" title="Editar">✏</button>' +
        '<button class="row-action" onclick="copyRecord(' + u.id + ')" title="Copiar info">📋</button>' +
        '<button class="row-action" onclick="showHistory(' + u.id + ')" title="Historial">⏱</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// ═══ TÉCNICOS ═══
function renderTecnicos() {
  const techs = window.CONFIG.technicians;
  const real = getReal();
  // GH3.42.11: usar helper unificado para matching robusto
  var _uRole = window.state && state.user && (state.user.role || state.user.rol);
  var _myTec = null;
  if (_uRole === 'tecnico') _myTec = _resolveMyTecnicoName();
  var _visibleTechs = _myTec ? [_myTec] : techs.filter(function(t){ return t !== 'Sin asignar'; });

  // STAB-v10.1 P0+P2: reutilizar buildDashboardStats por técnico
  var _bdsAll = window.DashboardStats ? DashboardStats.compute(real) : {};
  var _ptAll  = _bdsAll.porTecnico || {};

  // GH3.42.11: usar el mismo carrusel flashcard del leaderboard para consistencia visual
  var tecList = _visibleTechs.map(function(t) {
    var _tKey = Object.keys(_ptAll).find(function(k){ return k.toLowerCase() === t.toLowerCase(); }) || t;
    var _d = _ptAll[_tKey] || { asignados:0, pendientes:0, proceso:0, entregados:0, actas:0, finalizados:0, pct:0 };
    return Object.assign({ tec: t }, _d);
  }).filter(function(d){ return d.asignados > 0; })
    .sort(function(a,b){ return b.entregados - a.entregados; });

  var container = document.getElementById('tec-grid');
  if (!container) return;
  if (tecList.length === 0) {
    container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--muted,#6B6660);font-family:var(--font-body);font-size:13px">Sin técnicos con equipos asignados</div>';
    return;
  }
  // Al hacer click en la card se navega al detalle
  if (typeof _renderTecnicoCarousel === 'function') {
    _renderTecnicoCarousel(container, tecList);
    // Agregar click handler en cada card para openTecnicoDetail
    setTimeout(function(){
      container.querySelectorAll('.rc-card').forEach(function(card, i) {
        card.style.cursor = 'pointer';
        card.onclick = function(e){
          // no hacer nada si el click fue en un botón/dot de navegación
          if (e.target.closest('.rc-nav') || e.target.closest('.rc-arrow') || e.target.closest('.rc-dot')) return;
          openTecnicoDetail(tecList[i].tec);
        };
      });
    }, 50);
  }
}


function openTecnicoDetail(tecnico) {
  state.tecnicoDetail = tecnico;
  goView('tecnico-detail');
}
window.openTecnicoDetail = openTecnicoDetail;

function renderTecnicoDetail() {
  const tec = state.tecnicoDetail;
  if (!tec) { goView('tecnicos'); return; }
  
  const real = getReal();
  const mine = tec === 'Sin asignar'
    ? real.filter(u => !u.tecnico)
    : real.filter(u => (u.tecnico || '').toLowerCase() === tec.toLowerCase());
  
  const total = mine.length;
  const pend = mine.filter(u => u.estado === 'Pendiente').length;
  const alist = mine.filter(u => u.estado === 'Alistamiento').length;
  const proc = mine.filter(u => u.estado === 'Alistamiento' || u.estado === 'En tránsito' || u.estado === 'Programado' || (u.estado || '').indexOf('tránsito') >= 0).length;
  var _bdsD = window.DashboardStats ? DashboardStats.compute(mine) : {};
  const ent  = _bdsD.entregados || 0;  // P0: usa milestone logic
  const acta = _bdsD.actas      || 0;  // P0: usa milestone logic
  const pct  = total > 0 ? Math.round(ent / total * 100) : 0; // STAB-v11 TASK 03
  // Ciudad principal
  const ciudades = {};
  mine.forEach(u => { if (u.ciudad) ciudades[u.ciudad] = (ciudades[u.ciudad] || 0) + 1; });
  const sortedCity = Object.entries(ciudades).sort((a,b) => b[1] - a[1]);
  const ciudadesUnicas = sortedCity.length;
  const mainCity = sortedCity[0];
  
  const cls = tec.toLowerCase() === 'sin asignar' ? 'unassigned' : tec.toLowerCase();
  const initials = tec === 'Sin asignar' ? '—' : tec.substring(0, 2).toUpperCase();
  
  // Header
  const avatarEl = $('td-avatar');
  avatarEl.className = 'td-avatar ' + cls;
  avatarEl.textContent = initials;
  $('td-name').textContent = tec;
  $('td-meta').innerHTML = '<strong>' + total + '</strong> equipos · ' + pct + '% completado · ' + ciudadesUnicas + ' ciudades' + (mainCity ? ' · principal: <strong>' + mainCity[0] + '</strong>' : '');
  
  // Crumb
  $('crumb-view').textContent = 'Por técnico · ' + tec;
  
  // KPIs
  const kpis = [
    { label: 'Total asignados', val: total, cls: '', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' },
    { label: 'Pendientes', val: pend, cls: 'blu', icon: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
    { label: 'Alistamiento', val: alist, cls: 'amb', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
    { label: 'En proceso', val: proc, cls: 'pur', icon: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6"/></svg>' },
    { label: 'Completados', val: ent, cls: 'grn', icon: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' },
    { label: 'Actas firmadas', val: acta, cls: 'grn', icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
  ];
  
  $('td-kpis').innerHTML = kpis.map(k => 
    '<div class="metric-card ' + k.cls + '">' +
      '<div class="metric-card-head"><span class="metric-card-label">' + k.label + '</span>' +
      '<div class="metric-card-icon">' + k.icon + '</div></div>' +
      '<div class="metric-card-val">' + k.val + '</div>' +
      '<div class="metric-card-sub">' + (total > 0 ? Math.round(k.val/total*100) + '% del total' : '—') + '</div>' +
    '</div>'
  ).join('');
  
  // Tabla usuarios
  $('td-users-count').textContent = mine.length + ' usuarios asignados';
  if (mine.length === 0) {
    $('td-users').innerHTML = '<tr><td colspan="8"><div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/></svg></div><div class="empty-title">Sin usuarios asignados</div></div></td></tr>';
  } else {
    $('td-users').innerHTML = mine.map(u => {
      const estCls = ConfigService.badgeClass(u.estado || 'pendiente');
      return '<tr onclick="openEditModal(' + u.id + ')">' +
        '<td class="td-id">' + u.id + '</td>' +
        '<td><span class="badge badge-' + u.empresa.toLowerCase() + '">' + esc(u.empresa) + '</span></td>' +
        '<td class="td-strong">' + esc(u.nombre || '—') + '</td>' +
        '<td class="td-soft">' + esc(u.ciudad || '—') + '</td>' +
        '<td class="td-soft" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(u.proyecto) + '">' + esc(u.proyecto || '—') + '</td>' +
        '<td class="td-soft">' + esc(formatEquipo(u.equipoNuevo)) + '</td>' +
        '<td><span class="badge ' + estCls + '">' + esc(u.estado || 'Pendiente') + '</span></td>' +
        '<td style="text-align:center">' + (u.acta_firmada ? '<span style="color:var(--green);font-weight:700">✓</span>' : '<span style="color:var(--text-4)">—</span>') + '</td>' +
        '</tr>';
    }).join('');
  }
}
window.renderTecnicoDetail = renderTecnicoDetail;

// ═══ LANDING SCREEN ═══
function enterDashboard() {
  const landing = $('landing');
  if (!landing) return;
  landing.classList.add('entering');
  setTimeout(() => { landing.style.display = 'none'; }, 500);
  notify({ level: 'info', category: 'system', title: 'Sesión iniciada', message: 'Bienvenido, ' + state.user.name + ' · rol: ' + state.user.role });
}
window.enterDashboard = enterDashboard;

// ═══ PREVIEW VISITANTE (botón para super_admin / gestor_activos) ═══
// STAB-v10 TASK 8: previewVisitante eliminado previewVisitante;

// STAB-v10: updatePreviewButton eliminado

function updateAprobacionesItem() {
  const item = document.getElementById('sb-aprobaciones');
  if (!item) return;
  if (can('renewal.approve')) {
    item.style.display = '';
    const count = ApprovalService.getQueue().length;
    const badge = document.getElementById('b-aprobaciones');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.toggle('alert', count > 0);
    }
  } else {
    item.style.display = 'none';
  }
}
window.updateAprobacionesItem = updateAprobacionesItem;



// ═══ CIUDADES ═══
function renderCiudades() {
  // STAB-v16 TASK 2: ciudades con barras de progreso, entregados, pendientes, total, %
  var allRecords = DataService.getRenewals({});
  const cityMap = {};
  allRecords.forEach(u => {
    const c = u.ciudad ? u.ciudad : 'Sin ciudad';
    if (!cityMap[c]) cityMap[c] = { total:0, entregados:0, pendientes:0, backup:0 };
    cityMap[c].total++;
    if (isBackup(u)) cityMap[c].backup++;
    if (u.estado === 'Pendiente') cityMap[c].pendientes++;
    if (u.fecha_entrega || ['Entregado equipo nuevo','Pendiente devolución equipo anterior','En tránsito equipo anterior','Equipo anterior recibido','Renovación completada','Pendiente aprobación','Cerrado','Entregado','Completado'].indexOf(u.estado) >= 0) cityMap[c].entregados++;
  });
  const sorted = Object.entries(cityMap).sort((a,b) => b[1].total - a[1].total);
  $('cities-grid').innerHTML = sorted.map(entry => {
    const city = entry[0], s = entry[1];
    const pct = s.total > 0 ? Math.round(s.entregados / s.total * 100) : 0;
    const barCls = pct >= 80 ? 'grn' : pct >= 40 ? 'amb' : '';
    return '<div class="city-card" onclick="filterByCity(\'' + esc(city).replace(/\'/g,"\\\'") + '\')">' +
      '<div class="city-card-name">' + esc(city) + '</div>' +
      '<div class="city-card-total">' + s.total + '</div>' +
      '<div class="city-card-sub" style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;font-size:10px;margin-top:4px">' +
        '<span style="color:var(--green,#16A34A);font-weight:700">' + s.entregados + ' ent</span>' +
        '<span style="color:var(--accent);font-weight:700">' + s.pendientes + ' pend</span>' +
        (s.backup > 0 ? '<span style="color:var(--text-3)">' + s.backup + ' bk</span>' : '') +
        '<span style="font-weight:900">' + pct + '%</span>' +
      '</div>' +
      '<div class="op-bar" style="margin-top:6px;height:5px"><div class="op-bar-fill ' + barCls + '" style="width:0%" data-pct="' + pct + '"></div></div>' +
      '</div>';
  }).join('');
  setTimeout(function(){
    document.querySelectorAll('#cities-grid .op-bar-fill[data-pct]').forEach(function(b){
      b.style.width = b.dataset.pct + '%';
    });
  }, 100);
}

// ═══ DEVOLUCIONES ═══
function renderDevoluciones() {
  // F3.7 · RBAC: técnico solo ve sus propias devoluciones
  const isTecnico = state.user.role === 'tecnico';
  // STAB-v12 TASK 01: regla funcional oficial
  // lista_recoleccion === true AND estado_devolucion IN ('Pendiente', 'Solicitada')
  const EXCLUIR_DEV = ['Recibida en bodega','Equipo anterior recibido','Cerrada','Completada','Cancelada','No aplica'];
  const allReal = getReal().filter(u =>
    u.lista_recoleccion === true &&
    u.estado_devolucion &&
    (u.estado_devolucion === 'Pendiente' || u.estado_devolucion === 'Solicitada') &&
    EXCLUIR_DEV.indexOf(u.estado_devolucion) < 0
  );
  const data = isTecnico
    ? allReal.filter(u => (u.tecnico || '').toLowerCase() === (state.user.name || '').toLowerCase())
    : allReal;
  $('tbl-dev').innerHTML = data.length === 0
    ? '<tr><td colspan="8"><div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/></svg></div><div class="empty-title">Sin devoluciones registradas</div><div class="empty-msg">Los datos del equipo anterior se llenan en cada registro</div></div></td></tr>'
    : data.map(u => '<tr onclick="openEditModal(' + u.id + ')">' +
      '<td class="td-id">' + u.id + '</td>' +
      '<td class="td-strong">' + esc(u.nombre) + '</td>' +
      '<td class="td-soft">' + esc(u.ciudad) + '</td>' +
      '<td class="td-soft">' + esc(formatEquipo(u.equipoAnterior)) + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.eq_ant_serial || '—') + '</td>' +
      '<td><span class="badge ' + ConfigService.badgeClass(u.estado_devolucion || 'pendiente') + '">' + esc(u.estado_devolucion || 'Pendiente') + '</span></td>' +
      '<td style="text-align:center">' + (u.recibido_bodega ? '<span style="color:var(--green);font-weight:700">✓</span>' : '<span style="color:var(--text-4)">—</span>') + '</td>' +
      '<td style="text-align:center">' + (u.equipo_reasignable ? '<span style="color:var(--blue);font-weight:700">✓</span>' : '<span style="color:var(--text-4)">—</span>') + '</td>' +
      '</tr>').join('');
}

// ═══ REPORTES ═══
function getReportBase() {
  const f = state.repFilters;
  return getReal().filter(u => {
    if (f.empresa && u.empresa !== f.empresa) return false;
    if (f.tipo && (u.tipo || '').toUpperCase() !== f.tipo) return false;
    if (f.proyecto && u.proyecto !== f.proyecto) return false;
    if (f.tecnico && (u.tecnico || '').toLowerCase() !== f.tecnico.toLowerCase()) return false;
    return true;
  });
}

// STAB-v12 TASK 06 — renderReportesEjecutivos: Dashboard gerencial completo
function renderReportesEjecutivos() {
  var ejEl = document.getElementById('view-ejecutivos-content');
  if (!ejEl) return;
  var all   = window.DataService ? DataService.getRenewals({}) : [];
  // STAB-v16 TASK 12: _allStats sobre TODOS los registros (incluye backups) para totales oficiales
  var _allStats = window.DashboardStats ? DashboardStats.get() : {};
  // _bds sobre activos (sin backup) para pipeline, técnicos, riesgos
  var _bds  = window.DashboardStats ? DashboardStats.compute(all.filter(function(r){ return !isBackup(r); })) : {};
  var activos = all.filter(function(u){ return !isBackup(u); });

  // ── Panel 1: Cumplimiento por empresa (TASK 12: datos oficiales) ──
  // HBT: 85 asignados + 3 backup = 88 total
  // HGS: 57 asignados + 1 backup = 58 total
  var p1 = ['HBT','HGS'].map(function(emp) {
    var d = (_allStats.porEmpresa && _allStats.porEmpresa[emp]) ||
            { total:0, operativos:0, backup:0, pendientes:0, proceso:0, envio:0, entregados:0, actas:0, cerrados:0, pct:0 };
    return '<div class="exec-empresa-card">' +
      '<div class="exec-empresa-label">' + emp + '</div>' +
      '<div class="exec-empresa-grid">' +
      '<div><div class="exec-stat-v">' + d.operativos + '</div><div class="exec-stat-l">Asignados</div></div>' +
      '<div><div class="exec-stat-v">' + d.backup + '</div><div class="exec-stat-l">Backup</div></div>' +
      '<div><div class="exec-stat-v" style="color:var(--r);font-weight:900">' + d.total + '</div><div class="exec-stat-l"><strong>Total</strong></div></div>' +
      '<div><div class="exec-stat-v acc">' + d.pendientes + '</div><div class="exec-stat-l">Pendientes</div></div>' +
      '<div><div class="exec-stat-v amb">' + d.proceso + '</div><div class="exec-stat-l">Proceso</div></div>' +
      '<div><div class="exec-stat-v grn">' + d.entregados + '</div><div class="exec-stat-l">Entregados</div></div>' +
      '<div><div class="exec-stat-v">' + d.actas + '</div><div class="exec-stat-l">Actas</div></div>' +
      '<div><div class="exec-stat-v">' + d.cerrados + '</div><div class="exec-stat-l">Cerrados</div></div>' +
      '<div><div class="exec-stat-v grn" style="font-size:18px">' + d.pct + '%</div><div class="exec-stat-l">Avance</div></div>' +
      '</div>' +
      '<div class="exec-bar-wrap"><div class="exec-bar" style="width:0%" data-pct="' + d.pct + '"></div></div>' +
      '</div>';
  }).join('');

  // ── Panel 2: Ranking técnicos ──
  var ptAll = _bds.porTecnico || {};
  var tecRanking = Object.keys(ptAll).map(function(t){ var d=ptAll[t]; return Object.assign({tec:t},d); })
    .filter(function(d){ return d.asignados > 0; })
    .sort(function(a,b){ return b.pct - a.pct; });
  var p2 = '<table class="tbl"><thead><tr><th>Técnico</th><th>Asignados</th><th>Pendientes</th><th>Proceso</th><th>Envío</th><th>Entregados</th><th>Actas</th><th>Cerrados</th><th>%</th></tr></thead><tbody>' +
    tecRanking.map(function(d) {
      return '<tr><td class="td-strong">' + esc(d.tec) + '</td><td>' + d.asignados + '</td><td>' + d.pendientes + '</td><td>' + d.proceso + '</td><td>' + (d.enEnvio||0) + '</td><td style="color:var(--green)">' + d.entregados + '</td><td>' + (d.actas||0) + '</td><td>' + d.finalizados + '</td><td><strong>' + d.pct + '%</strong></td></tr>';
    }).join('') + '</tbody></table>';

  // ── Panel 3: Pipeline ──
  var pipe = _bds.pipeline || [];
  var pipeMax = pipe.reduce(function(a,b){ return Math.max(a,b.count); }, 1);
  var bottle = _bds.cueloBotella || {};
  var p3 = '<div class="exec-pipeline">' + pipe.map(function(s) {
    var pct = Math.round(s.count / pipeMax * 100);
    var isBottle = s.estado === bottle.estado && s.count > 0;
    return '<div class="pipe-step' + (isBottle ? ' pipe-bottle' : '') + '">' +
      '<div class="pipe-bar-wrap"><div class="pipe-bar" style="width:0%" data-pct="' + pct + '" data-bottle="' + isBottle + '"></div></div>' +
      '<div class="pipe-label">' + esc(s.estado.replace('equipo nuevo','').replace('equipo anterior','').trim()) + '</div>' +
      '<div class="pipe-count">' + s.count + '</div>' +
      '</div>';
  }).join('') + '</div>' + (bottle.estado ? '<div class="pipe-bottle-note">⚠ Cuello de botella: ' + esc(bottle.estado) + ' (' + (bottle.count||0) + ' equipos)</div>' : '');

  // STAB-v16 TASK 08: Panel Calidad de datos eliminado — sin valor operativo
  // ── Panel 5: Riesgos ──
  var ris = _bds.riesgos || {};
  var p5 = '<div class="exec-riesgos">' +
    [['Sin movimiento',ris.sinMovimiento,'Equipos en Pendiente sin avance'],
     ['Pend. aprobación',ris.pendienteAprobacion,'Esperando validación gerencia'],
     ['Pend. devolución',ris.pendienteDevolucion,'Lista recolección sin recibir'],
     ['Registros incompletos',ris.registrosIncompletos,'Sin técnico/ciudad/empresa']]
    .filter(function(r){ return (r[1]||0) > 0; })
    .map(function(r) {
      return '<div class="risk-row"><div class="risk-label">' + r[0] + '<span class="risk-sub">' + r[2] + '</span></div>' +
        '<div class="risk-count" style="color:' + ((r[1]||0) > 10 ? 'var(--accent)' : 'var(--amber)') + '">' + (r[1]||0) + '</div></div>';
    }).join('') + '</div>';

  // ── Construir HTML ──
  ejEl.innerHTML =
    '<div class="exec-section"><div class="exec-section-title">Cumplimiento por empresa</div>' + p1 + '</div>' +
    '<div class="exec-section"><div class="exec-section-title">Ranking técnicos</div>' + p2 + '</div>' +
    '<div class="exec-section"><div class="exec-section-title">Pipeline REN26</div>' + p3 + '</div>' +
    '<div class="exec-section"><div class="exec-section-title">Riesgos ejecutivos</div>' + p5 + '</div>';
  // Animar barras
  setTimeout(function() {
    ejEl.querySelectorAll('[data-pct]').forEach(function(b){
      b.style.width = b.dataset.pct + '%';
      if (b.dataset.bottle === 'true') b.style.background = 'var(--accent)';
    });
  }, 80);
}
window.renderReportesEjecutivos = renderReportesEjecutivos;

function renderReportes() {
  populateProjectFilter('rep-filter-proyecto');
  state.repFilters = {
    empresa: $('rep-filter-empresa').value || '',
    tipo: $('rep-filter-tipo').value || '',
    proyecto: $('rep-filter-proyecto').value || '',
    tecnico: $('rep-filter-tecnico').value || '',
  };
  const base = getReportBase();
  $('rep-base-count').textContent = base.length + ' de ' + (window.calculateProjectMetrics ? calculateProjectMetrics().totalColaboradores : getReal().length) + ' base';
  // Auditoria Final: usar buildDashboardStats para consistencia con Dashboard
  var _bdsR = window.DashboardStats ? DashboardStats.compute(base) : {};
  $('r-alistamiento').textContent = _bdsR.proceso    || 0; // proceso activo
  $('r-entregados').textContent   = _bdsR.entregados || 0;
  $('r-actas').textContent        = _bdsR.actas      || 0;
  $('r-devoluciones').textContent = _bdsR.devoluciones || 0;
  $('r-finalizados').textContent  = _bdsR.finalizados || 0;
  $('r-feedback').textContent     = base.filter(function(u){ return (u.feedback||0) > 0; }).length;
  // STAB-v12 TASK 06: tablero gerencial ejecutivo
  if (window.renderReportesEjecutivos) renderReportesEjecutivos();
}

function setReport(type, btn) {
  state.reportFilter = type;
  $$('.report-card').forEach(function(c) { c.classList.toggle('active', c.dataset.rep === type); });
  var base = getReportBase();
  var filtered = [], title = '';
  // BUG-02 fix: break en cada case para evitar fall-through
  // BUG-03 fix: state.repFilters inicializado con guard
  if (!state.repFilters) state.repFilters = {};
  // STAB-v16 TASK 7: cada reporte filtra EXCLUSIVAMENTE sus estados canónicos
  // Excepción: 'entregados' cuenta hito acumulativo (usuario recibió equipo aunque luego cambie)
  var ENTREGADO_STATES = ['Entregado equipo nuevo','Pendiente devolución equipo anterior',
                          'En tránsito equipo anterior','Equipo anterior recibido',
                          'Pendiente aprobación','Renovación completada','Cerrado'];
  var DEVOLUCION_STATES = ['Pendiente devolución equipo anterior','En tránsito equipo anterior','Equipo anterior recibido'];
  switch(type) {
    case 'alistamiento':
      filtered = base.filter(function(u){ return u.estado === 'Alistamiento'; });
      title = 'REP-01 · En alistamiento'; break;
    case 'envio':
      filtered = base.filter(function(u){ return u.estado === 'Programado' || u.estado === 'En tránsito equipo nuevo'; });
      title = 'REP-02 · En envío'; break;
    case 'pendientes':
      filtered = base.filter(function(u){ return u.estado === 'Pendiente'; });
      title = 'REP-03 · Pendientes'; break;
    case 'entregados':
      // HITO acumulativo: usuario recibió equipo aunque luego cambie de estado
      filtered = base.filter(function(u){ return !!u.fecha_entrega || ENTREGADO_STATES.indexOf(u.estado) >= 0; });
      title = 'REP-04 · Entregados'; break;
    case 'actas':
      filtered = base.filter(function(u){ return !!u.fecha_firma_acta; });
      title = 'REP-05 · Actas firmadas'; break;
    case 'devoluciones':
      filtered = base.filter(function(u){ return DEVOLUCION_STATES.indexOf(u.estado) >= 0; });
      title = 'REP-06 · Devoluciones'; break;
    case 'finalizados':
      // GH3.42.5 FIX: alineado con buildDashboardStats — 4 estados terminales
      filtered = base.filter(function(u){
        return u.estado === 'Renovación completada' || u.estado === 'Cerrado' || u.estado === 'Finalizado' || u.estado === 'Completado';
      });
      title = 'REP-07 · Finalizados'; break;
    case 'feedback':
      filtered = base.filter(function(u){ return (u.feedback||0) > 0; });
      title = 'REP-08 · Con feedback'; break;
    case 'raee':
      filtered = base.filter(function(u){ return !!u.recomendacion_raee; });
      title = 'REP-09 · Clasificación RAEE'; break;
    default:
      filtered = base;
      title = 'Reporte general'; break;
  }
  // BUG-01 fix: declarar activeFilters antes de usarlo
  var activeFilters = [];
  if (state.repFilters.empresa) activeFilters.push(state.repFilters.empresa);
  if (state.repFilters.tipo)    activeFilters.push(state.repFilters.tipo);
  if (state.repFilters.proyecto)activeFilters.push(state.repFilters.proyecto);
  if (state.repFilters.tecnico) activeFilters.push(state.repFilters.tecnico);
  var filterLabel = activeFilters.length > 0 ? ' · ' + activeFilters.join(' · ') : '';
  if (filtered.length === 0) {
    $('report-detail').innerHTML = '<div class="panel-head"><div><div class="panel-title">' + title + filterLabel + '</div><div class="panel-sub">Sin resultados con los filtros actuales</div></div></div>';
    return;
  }
  $('report-detail').innerHTML = '<div class="panel-head"><div><div class="panel-title">' + title + filterLabel + '</div><div class="panel-sub">' + filtered.length + ' registros</div></div></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Nombre</th><th>Estado</th><th>Empresa</th><th>Técnico</th><th>Ciudad</th></tr></thead><tbody>' +
    filtered.map(function(u) { return '<tr onclick="openEditModal('+u.id+')" style="cursor:pointer"><td class="td-id">'+u.id+'</td><td>'+esc(u.nombre||'—')+'</td><td>'+esc(u.estado||'—')+'</td><td>'+esc(u.empresa||'—')+'</td><td>'+esc(u.tecnico||'—')+'</td><td>'+esc(u.ciudad||'—')+'</td></tr>'; }).join('') +
    '</tbody></table></div>';
}
window.setReport = setReport;

function renderStarsDisplay(value) {
  if (!value || value <= 0) return '<span style="color:var(--text-4);font-size:11px">—</span>';
  return '<span class="stars-display">' + [1,2,3,4,5].map(n => '<span class="star' + (n <= value ? ' active' : '') + '">★</span>').join('') + '</span>';
}

// ═══ ACTIVITY LOG ═══
function renderActivityLog() {
  const typeF = $('act-filter-type') ? $('act-filter-type').value : '';
  const catF = $('act-filter-cat') ? $('act-filter-cat').value : '';
  let items = state.notifications;
  if (typeF) items = items.filter(n => n.level === typeF);
  if (catF) items = items.filter(n => n.category === catF);
  $('act-count').textContent = items.length + ' eventos';
  if (items.length === 0) {
    $('activity-timeline').innerHTML = '<div class="activity-empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><div class="empty-title">Sin actividad registrada</div><div class="empty-msg">Los eventos aparecerán aquí cuando se actualicen registros</div></div>';
    return;
  }
  $('activity-timeline').innerHTML = items.map(n => '<div class="activity-item ' + n.level + '"><div class="activity-item-time">' + formatTime(n.timestamp) + ' · ' + n.category.toUpperCase() + '</div><div class="activity-item-title">' + esc(n.title) + '</div><div class="activity-item-msg">' + esc(n.message) + '</div></div>').join('');
}


// ═══ MODAL: openEditModal con todas las secciones ═══
var _currentRecord = null;  // GH3.28: record activo del modal
// RC-03 T2: Convierte valor de fecha a formato yyyy-MM-dd para <input type="date">
// Acepta: serial Excel (46209), ISO string, yyyy-MM-dd, null, vacío
function toDateInput(val) {
  if (val === null || val === undefined || val === '') return '';
  // Número: serial Excel (días desde 1900-01-01)
  var n = Number(val);
  if (!isNaN(n) && n > 40000 && n < 100000) {
    // Offset 25569 = días entre 1900-01-01 y 1970-01-01 (epoch Unix)
    var d = new Date((n - 25569) * 86400000);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  // String: tomar solo la parte yyyy-MM-dd
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Intentar parsear como fecha
  var d2 = new Date(s);
  return isNaN(d2.getTime()) ? '' : d2.toISOString().slice(0, 10);
}
window.toDateInput = toDateInput;

function openEditModal(id) {
  const u = DataService.getRenewal(id);
  _currentRecord = u;  // GH3.28
  if (!u) return;
  state.editingId      = id;
  state.editingVersion = (u.version !== undefined ? Number(u.version) : -1); // RC-07 TASK 2
  // STAB-v09.2 ÍTEM 11: reiniciar scroll del modal al abrir
  setTimeout(function() {
    var mb = document.getElementById('modal-body');
    if (mb) mb.scrollTop = 0;
    var tl = document.querySelector('#seccion-timeline');
    if (tl) tl.scrollLeft = 0;
  }, 0);
  $('modal-eyebrow').textContent = isBackup(u) ? 'BACKUP ' + u.empresa : (u.empresa + ' · ' + (u.tipo || 'EQUIPO') + ' · ID ' + u.id);
  $('modal-title').textContent = (u.nombre || ('BACKUP ' + u.empresa)) + (u.serial ? ' · ' + u.serial : '');
  const projects = Array.from(new Set(DataService.getRenewals({}).map(x => x.proyecto).filter(p => p))).sort();
  const projectOpts = '<option value="">—</option>' + projects.map(p => '<option' + (u.proyecto === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
  // F3.5 · Niveles desde ConfigService (no hardcodeados en componente UI)
  const niveles = ConfigService.NIVELES_REGISTRO;
  const nivelOpts = '<option value="">—</option>' + niveles.map(n => '<option' + (u.nivel_usuario === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  // GH3.30 Bloque 12: mostrar solo transiciones válidas desde el estado actual
  // Previene selección de estados inalcanzables (2,7,8,9 desde PENDIENTE)
  var _allEstados = ConfigService.getFlow
    ? ConfigService.getFlow().concat([StateMachine.states.BACKUP])
    : ['Pendiente','Alistamiento','Programado','En tránsito equipo nuevo',
       'Entregado equipo nuevo','Pendiente devolución equipo anterior',
       'En tránsito equipo anterior','Equipo anterior recibido',
       'Pendiente acta','Pendiente aprobación','Renovación completada','Cerrado','BACKUP'];
  // RC-07: mostrar TODOS los estados disponibles (no restringir transiciones en el form)
  var estados = _allEstados.slice();
  // GH3.42.12: Renovación completada es visible/seleccionable SOLO para
  // super_admin o gestor_activos (GA). El resto de roles (técnico incluido)
  // llega como máximo hasta Pendiente aprobación. Restricción de UI —
  // no reemplaza validación de escritura en capas inferiores.
  var _rbacRole = window.state && state.user && (state.user.role || state.user.rol);
  if (['super_admin','gestor_activos'].indexOf(_rbacRole) < 0) {
    estados = estados.filter(function(e){ return e !== StateMachine.states.COMPLETADA; });
  }
  // Asegurar que el estado actual esté en la lista aunque no esté en _allEstados
  if (u.estado && estados.indexOf(u.estado) < 0) estados.unshift(u.estado);
  const estadoOpts = estados.map(e => '<option value="' + esc(e) + '"' + (u.estado === e ? ' selected' : '') + '>' + esc(e) + '</option>').join('');
  // F3.3 fix: la UI consume EXCLUSIVAMENTE el modelo normalizado (equipoNuevo),
  // nunca los campos planos legacy (u.marca/u.modelo/...) que nunca se completan.
  const eqNvo = u.equipoNuevo || {};
  // F3.6 · Estado de entrega del equipo nuevo desde ConfigService
  const entregaEqNvoOpts = ConfigService.ESTADO_ENTREGA_EQ_NVO
    .map(v => '<option value="' + v + '"' + (u.estado_entrega_equipo_nuevo === v ? ' selected' : '') + '>' + (v || '—') + '</option>').join('');
  const devEstados = ['No aplica', 'Pendiente', 'Solicitada', 'En tránsito', 'Recibida en bodega'];
  const devEstadoOpts = '<option value="">—</option>' + devEstados.map(e => '<option' + (u.estado_devolucion === e ? ' selected' : '') + '>' + e + '</option>').join('');
  
  $('modal-body').innerHTML = 
'<div class="form-section" id="seccion-timeline"><div class="form-section-head">Timeline REN26</div>' +
      '<div id="m-timeline-container">' + renderTimelineHTML(u) + '</div>' +
    '</div>' +
'<div class="form-section"><div class="form-section-head">1 · Datos del usuario</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Empresa</label><select class="form-select" id="m-empresa"><option' + (u.empresa === 'HBT' ? ' selected' : '') + '>HBT</option><option' + (u.empresa === 'HGS' ? ' selected' : '') + '>HGS</option></select></div>' +
      '<div class="form-group"><label class="form-label">Nivel del usuario</label><select class="form-select" id="m-nivel_usuario">' + nivelOpts + '</select></div>' +
      '<div class="form-group full"><label class="form-label">Nombre completo</label><input type="text" class="form-input" id="m-nombre" value="' + esc(u.nombre) + '"></div>' +
      '<div class="form-group"><label class="form-label">Cédula</label><input type="text" class="form-input" id="m-cedula" value="' + esc(u.cedula) + '"></div>' +
      '<div class="form-group"><label class="form-label">Usuario (login)</label><input type="text" class="form-input" id="m-usuario" value="' + esc(u.usuario) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Correo corporativo</label><input type="email" class="form-input" id="m-correo" value="' + esc(u.correo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Ciudad</label><input type="text" class="form-input" id="m-ciudad" value="' + esc(u.ciudad) + '"></div>' +
      '<div class="form-group"><label class="form-label">Centro de Costo (CECO)</label><input type="text" class="form-input" id="m-ceco" value="' + esc(u.ceco) + '" placeholder="Ej: S300022"></div>' +
      '<div class="form-group full"><label class="form-label">Proyecto</label><select class="form-select" id="m-proyecto">' + projectOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Cargo</label><input type="text" class="form-input" id="m-cargo" value="' + esc(u.cargo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Gerente directo</label><input type="text" class="form-input" id="m-gerente" value="' + esc(u.gerente) + '"></div>' +
    '</div></div>' +
    
    '<div class="form-section"><div class="form-section-head">2 · Equipo anterior</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Tipo</label><input type="text" class="form-input" id="m-eq_ant_tipo" value="' + esc(u.eq_ant_tipo) + '" placeholder="PORTATIL / TORRE"></div>' +
      '<div class="form-group"><label class="form-label">Marca</label><input type="text" class="form-input" id="m-eq_ant_marca" value="' + esc(u.eq_ant_marca) + '"></div>' +
      '<div class="form-group"><label class="form-label">Modelo</label><input type="text" class="form-input" id="m-eq_ant_modelo" value="' + esc(u.eq_ant_modelo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Serial</label><input type="text" class="form-input" id="m-eq_ant_serial" value="' + esc(u.eq_ant_serial) + '"></div>' +
      '<div class="form-group"><label class="form-label">Activo Fijo (AF)</label><input type="text" class="form-input" id="m-eq_ant_af" value="' + esc(u.eq_ant_af) + '" placeholder="Código AF"></div>' +
      '<div class="form-group"><label class="form-label">Placa</label><input type="text" class="form-input" id="m-eq_ant_placa" value="' + esc(u.eq_ant_placa) + '"></div>' +
      '<div class="form-group"><label class="form-label">Hostname</label><input type="text" class="form-input" id="m-eq_ant_hostname" value="' + esc(u.eq_ant_hostname) + '"></div>' +
      '<div class="form-group"><label class="form-label">Procesador</label><input type="text" class="form-input" id="m-eq_ant_procesador" value="' + esc(u.eq_ant_procesador) + '"></div>' +
      '<div class="form-group"><label class="form-label">Memoria (RAM)</label><input type="text" list="ram-opts" class="form-input" id="m-eq_ant_ram" value="' + esc(u.eq_ant_ram) + '"></div>' +
      '<div class="form-group"><label class="form-label">Disco duro (ant.)</label><input type="text" class="form-input" id="m-eq_ant_disco" value="' + esc(u.eq_ant_disco) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Sistema operativo</label><input type="text" class="form-input" id="m-eq_ant_so" value="' + esc(u.eq_ant_so) + '"></div>' +
    '</div>' +
  '</div>' + '</div>' +

    '<div class="form-section" id="seccion-raee-tecnologico"><div class="form-section-head">3 · Clasificación Tecnológica</div>' +
    (function() {
      // Motor A — ObsolescenceService — diseño renovado (RC-07)
      var cls    = u.estado_eq_ant             || '';
      var gen    = u.generacion_cpu             || '';
      var proc   = u.eq_ant_procesador          || '';
      var accion = u.accion_requerida           || '';
      var detalle = u.accion_detalle            || '';
      var vendor = (u._obsolescence_meta && u._obsolescence_meta.vendor) || '';
      var family = (u._obsolescence_meta && u._obsolescence_meta.family) || '';

      var MOTOR_SCHEME = {
        'RAEE':            { bg:'#FFEBEE', border:'#C00000', fg:'#C00000', ic:'⛔', acBg:'#FFEBEE' },
        'Reasignable':     { bg:'#F0FDF4', border:'#16A34A', fg:'#166534', ic:'↩',  acBg:'#DCFCE7' },
        'Revisión manual': { bg:'#FFFBEB', border:'#D97706', fg:'#92400E', ic:'?',  acBg:'#FEF3C7' },
      };
      var ms = MOTOR_SCHEME[cls] || { bg:'#FAFAFA', border:'#9CA3AF', fg:'#6B7280', ic:'—', acBg:'#F3F4F6' };

      if (!proc) {
        var noProc = ms;
        return '<div style="background:' + noProc.bg + ';border:1px solid ' + noProc.border + ';border-radius:10px;padding:14px 16px">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            '<div style="width:34px;height:34px;border-radius:50%;background:' + noProc.border + ';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0">' + noProc.ic + '</div>' +
            '<div>' +
              '<div style="font-size:13px;font-weight:700;color:' + noProc.fg + '">' + (cls || 'Sin clasificar') + '</div>' +
              '<div style="font-size:11px;color:#6B7280">Procesador no registrado</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-bottom:10px">' +
            '<div style="flex:1;background:#fff;border:1px solid ' + noProc.border + ';border-radius:6px;padding:6px 10px">' +
              '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + noProc.fg + ';margin-bottom:2px">Clasificación</div>' +
              '<div style="font-size:11px;font-weight:700;color:' + noProc.fg + '">' + (cls || 'Sin clasificar') + '</div>' +
            '</div>' +
            '<div style="flex:1;background:#fff;border:1px solid ' + noProc.border + ';border-radius:6px;padding:6px 10px">' +
              '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + noProc.fg + ';margin-bottom:2px">Generación</div>' +
              '<div style="font-size:11px;font-weight:700;color:' + noProc.fg + '">Sin determinar</div>' +
            '</div>' +
            '<div style="flex:1;background:#fff;border:1px solid ' + noProc.border + ';border-radius:6px;padding:6px 10px">' +
              '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + noProc.fg + ';margin-bottom:2px">Acción</div>' +
              '<div style="font-size:11px;font-weight:700;color:' + noProc.fg + '">' + (accion || 'Revisar') + '</div>' +
            '</div>' +
          '</div>' +
          (detalle ? '<div style="font-size:11px;color:#4B5563;margin-bottom:6px">' + esc(detalle) + '</div>' : '') +
          '<div style="font-size:10px;color:#9CA3AF;font-style:italic">Clasificación generada automáticamente por el motor de obsolescencia a partir del procesador del equipo anterior · no editable manualmente</div>' +
        '</div>';
      }

      // Procesador registrado — renderizar tarjeta completa
      var procLabel = proc + (vendor ? ' · ' + vendor : '') + (family ? ' ' + family : '');
      var genLabel  = gen ? 'Gen ' + gen : 'Sin determinar';
      var html =
        '<div style="background:' + ms.bg + ';border:1px solid ' + ms.border + ';border-radius:10px;padding:14px 16px">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
            '<div style="width:34px;height:34px;border-radius:50%;background:' + ms.border + ';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0">' + ms.ic + '</div>' +
            '<div>' +
              '<div style="font-size:13px;font-weight:700;color:' + ms.fg + '">' + esc(cls || 'Sin clasificar') + '</div>' +
              '<div style="font-size:11px;color:#6B7280">' + esc(procLabel) + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-bottom:10px">' +
            '<div style="flex:1;background:#fff;border:1px solid ' + ms.border + ';border-radius:6px;padding:6px 10px">' +
              '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + ms.fg + ';margin-bottom:2px">Clasificación</div>' +
              '<div style="font-size:11px;font-weight:700;color:' + ms.fg + '">' + esc(cls) + '</div>' +
            '</div>' +
            '<div style="flex:1;background:#fff;border:1px solid ' + ms.border + ';border-radius:6px;padding:6px 10px">' +
              '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + ms.fg + ';margin-bottom:2px">Generación</div>' +
              '<div style="font-size:11px;font-weight:700;color:' + ms.fg + '">' + esc(genLabel) + '</div>' +
            '</div>' +
            '<div style="flex:1;background:#fff;border:1px solid ' + ms.border + ';border-radius:6px;padding:6px 10px">' +
              '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + ms.fg + ';margin-bottom:2px">Acción</div>' +
              '<div style="font-size:11px;font-weight:700;color:' + ms.fg + '">' + esc(accion || '—') + '</div>' +
            '</div>' +
          '</div>' +
          (detalle ? '<div style="font-size:11px;color:#4B5563;margin-bottom:6px">' + esc(detalle) + '</div>' : '') +
          '<div style="font-size:10px;color:#9CA3AF;font-style:italic">Clasificación generada automáticamente por el motor de obsolescencia a partir del procesador del equipo anterior · no editable manualmente</div>' +
        '</div>';
      return html;
    })() +
    '</div>' +
    '<div class="form-section"><div class="form-section-head">4 · Equipo nuevo asignado</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="m-eq_nvo_tipo"><option value="">—</option><option' + ((eqNvo.tipo || '').toUpperCase() === 'PORTATIL' ? ' selected' : '') + '>PORTATIL</option><option' + ((eqNvo.tipo || '').toUpperCase() === 'TORRE' ? ' selected' : '') + '>TORRE</option></select></div>' +
      '<div class="form-group"><label class="form-label">Marca</label><input type="text" class="form-input" id="m-eq_nvo_marca" value="' + esc(eqNvo.marca) + '"></div>' +
      '<div class="form-group"><label class="form-label">Modelo</label><input type="text" class="form-input" id="m-eq_nvo_modelo" value="' + esc(eqNvo.modelo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Serial</label><input type="text" class="form-input" id="m-eq_nvo_serial" value="' + esc(eqNvo.serial) + '"></div>' +
      '<div class="form-group"><label class="form-label">Activo Fijo (AF)</label><input type="text" class="form-input" id="m-eq_nvo_af" value="' + esc(eqNvo.af) + '" placeholder="Código AF"></div>' +
      '<div class="form-group"><label class="form-label">Placa</label><input type="text" class="form-input" id="m-eq_nvo_placa" value="' + esc(eqNvo.placa) + '"></div>' +
      '<div class="form-group"><label class="form-label">Hostname</label><input type="text" class="form-input" id="m-eq_nvo_hostname" value="' + esc(eqNvo.hostname) + '"></div>' +
      '<div class="form-group"><label class="form-label">Procesador</label><input type="text" class="form-input" id="m-eq_nvo_procesador" value="' + esc(eqNvo.procesador) + '"></div>' +
      '<div class="form-group"><label class="form-label">Memoria (RAM)</label><input type="text" list="ram-opts" class="form-input" id="m-eq_nvo_ram" value="' + esc(eqNvo.ram) + '"></div>' +
      '<div class="form-group"><label class="form-label">Disco</label><input type="text" class="form-input" id="m-eq_nvo_disco" value="' + esc(eqNvo.disco) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Sistema operativo</label><input type="text" class="form-input" id="m-eq_nvo_so" value="' + esc(u.eq_nvo_so) + '" placeholder="Ej: Windows 11 Pro"></div>' +
    '</div></div>' +
    '<div class="form-section"><div class="form-section-head">5 · Estado REN26</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Técnico asignado</label><select class="form-select" id="m-tecnico">' + '<option value="">— Sin asignar —</option>' + (window.CONFIG.technicians || []).map(function(t){ return '<option value="' + esc(t) + '"' + ((u.tecnico||'').toLowerCase()===t.toLowerCase()?' selected':'') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">Estado proceso REN26</label><select class="form-select" id="m-estado">' + estadoOpts + '</select></div>' +
      // F3.6 · estado_entrega_equipo_nuevo: entidad física independiente del estado del proceso

      '<div class="form-group"><label class="form-label">Notas de alistamiento</label><input type="text" class="form-input" id="m-notas_alistamiento" value="' + esc(u.notas_alistamiento) + '" placeholder="Notas de alistamiento"></div>' +
      '<div class="form-group"><label class="form-label">Caso envío (mensajería)</label><input type="text" class="form-input" id="m-caso_envio" value="' + esc(u.caso_envio) + '" placeholder="Guía de mensajería"></div>' +
      '<div class="form-group"><label class="form-label">F. Envío</label><input type="date" class="form-input" id="m-fecha_envio" value="' + toDateInput(u.fecha_envio) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. Entrega</label><input type="date" class="form-input" id="m-fecha_entrega" value="' + toDateInput(u.fecha_entrega) + '"></div>' +
      '<div class="form-group full" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;background:var(--bg-subtle);border-radius:var(--r-sm)">' +
        '<div class="form-group" style="margin:0"><label class="form-label">F. envío acta</label><input type="date" class="form-input" id="m-fecha_envio_acta"' + (u.fecha_envio_acta ? ' value="' + toDateInput(u.fecha_envio_acta) + '"' : '') + '></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label">F. firma acta</label><input type="date" class="form-input" id="m-fecha_firma_acta"' + (u.fecha_firma_acta ? ' value="' + toDateInput(u.fecha_firma_acta) + '"' : '') + '></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label">Nombre del archivo</label><input type="text" class="form-input" id="m-nombre_archivo" value="' + esc(u.nombre_archivo||'') + '" placeholder="Ej: acta_juan_garcia.pdf"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label">URL del acta (SharePoint)</label><input type="url" class="form-input" id="m-acta_entrega_url" value="' + esc(u.acta_entrega_url||'') + '" placeholder="https://..."></div>' +
      '</div>' +
      '<div class="form-group full" style="text-align:center;margin-top:6px">' + (u.acta_entrega_url ? '<div style="text-align:center;margin-top:8px"><a href="' + esc(u.acta_entrega_url) + '" target="_blank" rel="noopener" class="btn" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:8px 18px">📄 Ver acta firmada</a></div>' : '') +
    '</div></div>' +
    '<div class="form-section" id="seccion-devolucion"><div class="form-section-head">6 · Devolución del equipo anterior</div>' +
    '<div style="padding:8px 0 10px;border-bottom:1px dashed var(--border);margin-bottom:10px">' +
            '<label class="form-check"><input type="checkbox" id="m-lista_recoleccion"' + (u.lista_recoleccion ? ' checked' : '') + '> Equipo agregado a lista de recoleccion</label>' +
    '</div>' +
    '<div id="dev-campos">' +
      '<div class="form-group"><label class="form-label">Estado de devolución</label><select class="form-select" id="m-estado_devolucion">' + devEstadoOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">F. Solicitud devolución</label><input type="date" class="form-input" id="m-fecha_solicitud_devolucion" value="' + toDateInput(u.fecha_solicitud_devolucion) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. en tránsito</label><input type="date" class="form-input" id="m-fecha_transito" value="' + toDateInput(u.fecha_transito) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. Recepción en Bodega</label><input type="date" class="form-input" id="m-fecha_recepcion_bodega" value="' + toDateInput(u.fecha_recepcion_bodega) + '"></div>' +
      '<p class="full" style="font-size:11px;color:var(--text-3);margin:0">La disposición final queda registrada en la Lista de Control de Recolecciones SharePoint.</p>' +
      '<div class="form-group full" style="margin-top:8px"><label class="form-label">Observaciones de devolución</label><textarea class="form-input" id="m-observaciones_devolucion" rows="2" placeholder="Estado del equipo al recibirlo, novedades...">' + esc(u.observaciones_devolucion||'') + '</textarea></div>' +
    '</div>' +
    '<div class="form-section" id="seccion-eval-fisica" style="margin-top:14px;border-top:1px dashed var(--border);padding-top:14px"><div class="form-section-head">7 · Evaluación Física del Equipo</div>' +
    '<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Registrar el estado físico del equipo recibido.</div>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Estado batería</label><select class="form-select" id="m-eval_bateria" onchange="actualizarRecomendacion()"><option value="">—</option>' + ['Excelente','Bueno','Regular','Malo'].map(function(o){return '<option value="'+o+'"'+(u.eval_bateria===o?' selected':'')+'>'+o+'</option>';}).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">Estado teclado</label><select class="form-select" id="m-eval_teclado" onchange="actualizarRecomendacion()"><option value="">—</option>' + ['Excelente','Bueno','Regular','Malo'].map(function(o){return '<option value="'+o+'"'+(u.eval_teclado===o?' selected':'')+'>'+o+'</option>';}).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">Estado touchpad</label><select class="form-select" id="m-eval_touchpad" onchange="actualizarRecomendacion()"><option value="">—</option>' + ['Excelente','Bueno','Regular','Malo'].map(function(o){return '<option value="'+o+'"'+(u.eval_touchpad===o?' selected':'')+'>'+o+'</option>';}).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">Estado estético</label><select class="form-select" id="m-eval_estetico" onchange="actualizarRecomendacion()"><option value="">—</option>' + ['Excelente','Bueno','Regular','Malo'].map(function(o){return '<option value="'+o+'"'+(u.eval_estetico===o?' selected':'')+'>'+o+'</option>';}).join('') + '</select></div>' +
    '</div>' +
    '<div id="m-motor-eval-container" style="margin-top:12px"><div id="m-recomendacion-display" style="display:none"></div><div id="m-motivo-raee-display" style="display:none"></div></div>' +
    '</div>' +
  '</div>' +
  '</div>' +

'<div class="form-section" id="audit-section">' +
  '<div class="form-section-head">Auditoría</div>' +
  '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
    '<div>' +
      '<div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Última actualización</div>' +
      '<div id="m-audit-date" style="font-size:13px;font-weight:700;color:var(--text-1)">' + (u.updated_at ? formatDateEs(u.updated_at) : '—') + '</div>' +
    '</div>' +
    '<div>' +
      '<div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Actualizado por</div>' +
      '<div id="m-audit-by" style="font-size:13px;color:var(--text-2)">' + esc(u.updated_by || '—') + '</div>' +
    '</div>' +
    '<div>' +
      '<div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Estado auditoría</div>' +
      '<div style="font-size:12px;font-weight:700">' + (u.VERSION ? '<span style="color:var(--accent)">v' + u.VERSION + '</span> · Cambios rastreados' : '<span style="color:var(--text-3)">Sin registros</span>') + '</div>' +
    '</div>' +
  '</div>' +
  '</div>';

// QA-05 Task 2 — Progressive disclosure: secciones por estado
function updateSectionVisibility(estado) {
  // Índice en el flow de estados
  var FLOW = ['Pendiente','Alistamiento','Programado',
              'En tránsito equipo nuevo','Entregado equipo nuevo',
              'Pendiente devolución equipo anterior','En tránsito equipo anterior',
              'Equipo anterior recibido','Renovación completada',
              'Pendiente aprobación','Cerrado'];
  var idx = FLOW.indexOf(estado);
  var isBlocked = (estado === 'Bloqueado');

  // Reglas de visibilidad por sección
  function showSec(id, visible) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = visible ? '' : 'none';
    el.style.opacity = visible ? '1' : '0';
    el.style.transition = 'opacity .2s';
  }

  // Sect 1 (datos usuario) + Sect 2 (eq ant): siempre visibles
  // Sect 3 (eq nuevo): visible desde Programado (idx >= 2)
  var seccion3 = document.querySelector('[class="form-section"] .form-section-head');
  // Usar querySelector por title del header (más robusto)
  document.querySelectorAll('.form-section').forEach(function(sec) {
    var head = sec.querySelector('.form-section-head');
    if (!head) return;
    var t = head.textContent.trim();
    // RC-06 T13: Reglas de visibilidad actualizadas
    if (t.indexOf('3 ·') === 0 || t.indexOf('Clasificación Tecnológica') >= 0) {
      // Sección 3: Motor tecnológico — siempre visible
      sec.style.display = '';
    } else if (t.indexOf('4 ·') === 0 || t.indexOf('Equipo nuevo') >= 0) {
      // Sección 4: Equipo nuevo — siempre visible
      sec.style.display = '';
    } else if (t.indexOf('5 ·') === 0 || t.indexOf('Estado REN26') >= 0) {
      // Sección 5: Estado — siempre visible
      sec.style.display = '';
    } else if (t.indexOf('6 ·') === 0 || t.indexOf('Devolución') >= 0) {
      // Sección 6: Devolución — siempre visible, gate via checkbox
      sec.style.display = '';
    } else if (t.indexOf('7 ·') === 0 || t.indexOf('Evaluación Física') >= 0) {
      // Sección 7: Evaluación física — siempre visible, gate via updateDevSection
      sec.style.display = '';
    } else if (t.indexOf('Calificación') >= 0 || t.indexOf('8 ·') === 0) {
      // Feedback: fuera del modal principal (RC-06 T12)
      sec.style.display = 'none';
    }
    // Sect 4 (seguimiento): siempre visible
    // Audit section: siempre visible
  });
}
window.updateSectionVisibility = updateSectionVisibility;

// QA-03: Reglas dinámicas del formulario
  (function applyModalRules() {
    var STATES_POST_ALIST = [
      'Programado','En tránsito equipo nuevo','Entregado equipo nuevo',
      'Pendiente devolución equipo anterior','En tránsito equipo anterior',
      'Equipo anterior recibido','Renovación completada','Pendiente aprobación',
      'Corrección requerida','Cerrado','Feedback','BACKUP'
    ];

    // ── R1: Lista de recolección → habilita/deshabilita sección Devolución ──
    function updateDevSection(checked) {
      var devCampos = document.getElementById('dev-campos');
      if (!devCampos) return;
      devCampos.querySelectorAll('input,select,textarea').forEach(function(el) {
        el.disabled = !checked;
        var grp = el.closest ? el.closest('.form-group') : null;
        if (grp) grp.style.opacity = checked ? '1' : '0.4';
      });
      // Sección 7 (Evaluación Física) depende de lista_recoleccion
      // Sección 3 (Clasificación Tecnológica) es display-only (Motor A) — siempre habilitada
      var evalFis = document.getElementById('seccion-eval-fisica');
      if (evalFis) {
        evalFis.style.opacity = checked ? '1' : '0.4';
        evalFis.querySelectorAll('input,select,textarea').forEach(function(el) {
          el.disabled = !checked;
        });
      }
    }
    var listaEl = $('m-lista_recoleccion');
    if (listaEl) {
      updateDevSection(listaEl.checked);
      listaEl.addEventListener('change', function() { updateDevSection(this.checked); });
    }

    // ── R2: Estado devolución → habilita solo la fecha relevante ──────────
    var DATE_MAP = {
      'Pendiente':          null,
      'No aplica':          null,
      'Solicitada':         'm-fecha_solicitud_devolucion',
      'En tránsito':        'm-fecha_transito',
      'Recibida en bodega': 'm-fecha_recepcion_bodega',
    };
    function updateDevDates(val) {
      // Solo habilitar fechas si lista_recoleccion está marcada
      var listaChecked = $('m-lista_recoleccion') && $('m-lista_recoleccion').checked;
      ['m-fecha_solicitud_devolucion','m-fecha_transito','m-fecha_recepcion_bodega'].forEach(function(id) {
        var el = $(id); if (!el) return;
        var active = listaChecked && DATE_MAP[val] === id;
        el.disabled = !active;
        var grp = el.closest ? el.closest('.form-group') : null;
        if (grp) grp.style.opacity = active ? '1' : '0.5';
      });
    }
    var estDevEl = $('m-estado_devolucion');
    if (estDevEl) {
      updateDevDates(estDevEl.value);
      estDevEl.addEventListener('change', function() { updateDevDates(this.value); });
    }

    // ── R3: Estado REN26 > Alistamiento → notas_alistamiento readonly ─────
    function updateNotasAlist(val) {
      var notasEl = $('m-notas_alistamiento');
      if (!notasEl) return;
      var locked = STATES_POST_ALIST.indexOf(val) >= 0;
      notasEl.readOnly = locked;
      notasEl.style.background = locked ? 'var(--bg-subtle)' : '';
      notasEl.style.color      = locked ? 'var(--text-3)' : '';
    }
    var estadoEl = $('m-estado');
    if (estadoEl) {
      updateNotasAlist(estadoEl.value);
      estadoEl.addEventListener('change', function() {
          updateNotasAlist(this.value);
          if (window.updateSectionVisibility) updateSectionVisibility(this.value);
        });
    }

    // ── R4: Feedback solo habilitado cuando estado = Renovación completada ─
    function updateFeedback(val) {
      var fbSec = document.getElementById('seccion-feedback');
      if (!fbSec) return;
      var enabled = val === 'Renovación completada';
      fbSec.querySelectorAll('.star').forEach(function(s) {
        s.style.cursor  = enabled ? 'pointer' : 'default';
        s.style.opacity = enabled ? '1' : '0.35';
        s._fbEnabled = enabled;
      });
      var hint = fbSec.querySelector('p');
      if (hint) hint.style.display = enabled ? 'none' : '';
    }
    if (estadoEl) {
      updateFeedback(estadoEl.value);
      estadoEl.addEventListener('change', function() { updateFeedback(this.value); });
    }

    // ── R5: Normalización de texto ─────────────────────────────────────────
    var UPPER_FIELDS = ['m-eq_ant_serial','m-eq_ant_hostname','m-eq_ant_placa','m-eq_ant_marca',
                        'm-eq_ant_modelo','m-eq_nvo_serial','m-eq_nvo_hostname','m-eq_nvo_placa',
                        'm-eq_nvo_marca','m-eq_nvo_modelo','m-eq_ant_af','m-eq_nvo_af'];
    UPPER_FIELDS.forEach(function(id) {
      var el = $(id); if (!el) return;
      el.addEventListener('blur', function() { this.value = this.value.toUpperCase(); });
    });

    // ── R6: Placa solo números ───────────────────────────────────────────────
    ['m-eq_ant_placa','m-eq_nvo_placa'].forEach(function(id) {
      var el = $(id); if (!el) return;
      el.addEventListener('input', function() { this.value = this.value.replace(/[^0-9]/g, ''); });
    });

    // ── R7: Disco auto-formato GB/TB ─────────────────────────────────────────
    ['m-eq_ant_disco','m-eq_nvo_disco'].forEach(function(id) {
      var el = $(id); if (!el) return;
      el.addEventListener('blur', function() {
        var v = this.value.trim();
        if (!v) return;
        if (/^[0-9]+$/i.test(v)) {
          var n = parseInt(v, 10);
          this.value = n >= 100 ? v + ' GB' : v + ' TB';
        } else if (!/gb|tb/i.test(v)) {
          this.value = v + ' GB';
        }
      });
    });

    // Task 2: initial visibility
    if (window.updateSectionVisibility && $('m-estado')) updateSectionVisibility($('m-estado').value);
  })();

  // QA-03: Datalist RAM para autocompletado DDR4/DDR5/LPDDR4/LPDDR5
  (function() {
    if (!document.getElementById('ram-opts')) {
      var dl = document.createElement('datalist'); dl.id = 'ram-opts';
      ['4GB DDR4','8GB DDR4','16GB DDR4','32GB DDR4',
       '8GB DDR5','16GB DDR5','32GB DDR5','64GB DDR5',
       '8GB LPDDR4','16GB LPDDR4','8GB LPDDR5','16GB LPDDR5','32GB LPDDR5'].forEach(function(v) {
        var o = document.createElement('option'); o.value = v; dl.appendChild(o);
      });
      document.body.appendChild(dl);
    }
  })();

// Inicializar estrellas
  const fbWidget = $('m-feedback-stars');
  if (fbWidget) {
    const init = parseInt(fbWidget.dataset.value || '0');
    fbWidget.querySelectorAll('.star').forEach(s => {
      const n = parseInt(s.dataset.star);
      s.textContent = n <= init ? '★' : '☆';
      s.addEventListener('click', function() {
        if (!this._fbEnabled) return;
        const v = parseInt(this.dataset.star);
        fbWidget.dataset.value = v;
        fbWidget.querySelectorAll('.star').forEach(st => {
          st.textContent = parseInt(st.dataset.star) <= v ? '★' : '☆';
        });
      });
    });
  }

  // GH3.24: CASO_ENVIO dinámico — si es 'Oficina', deshabilitar fecha_envio
  (function() {
    const _casoEl  = $('m-caso_envio');
    const _fechaEl = $('m-fecha_envio');
    if (!_casoEl || !_fechaEl) return;
    const _toggleFechaEnvio = function() {
      const isOficina = (_casoEl.value || '').trim().toLowerCase() === 'oficina';
      _fechaEl.disabled = isOficina;
      const _p = _fechaEl.closest ? _fechaEl.closest('.form-group') : null;
      if (_p) _p.style.opacity = isOficina ? '0.4' : '1';
      if (isOficina) _fechaEl.value = '';
    };
    _toggleFechaEnvio();
    _casoEl.addEventListener('input', _toggleFechaEnvio);
  })();


  // GH3.27 CAMBIO 5: Timeline en tiempo real — actualiza sin guardar
  (function() {
    var _estadoEl = $('m-estado');
    var _tlContainer = $('m-timeline-container');
    if (!_estadoEl || !_tlContainer) return;
    _estadoEl.addEventListener('change', function() {
      var tempU = {};
      for (var k in u) tempU[k] = u[k];
      tempU.estado = _estadoEl.value;
      _tlContainer.innerHTML = renderTimelineHTML(tempU);
      // GH3.37.1 Item 8: actualizar KPIs y Vista de Seguimiento sin cerrar el modal
      if (window.renderResumen) setTimeout(renderResumen, 0);
    });
  })();

  // GH3.27 CAMBIO 4: Motor de recomendación automática
  // GH3.28: actualizarRecomendacion usa exclusivamente RAEEEngine
window.actualizarRecomendacion = function() {
  var bat  = ($('m-eval_bateria')  || {}).value || '';
  var tec  = ($('m-eval_teclado')  || {}).value || '';
  var tou  = ($('m-eval_touchpad') || {}).value || '';
  var est  = ($('m-eval_estetico') || {}).value || '';
  var disp    = $('m-recomendacion-display');
  var motdisp = document.getElementById('m-motivo-raee-display');
  if (!disp) return;
  if (!bat && !tec && !tou && !est) { disp.style.display = 'none'; if (motdisp) motdisp.style.display='none'; return; }
  var resultado = (typeof RAEEEngine !== 'undefined') ? RAEEEngine.calcular(bat, tec, tou, est) : null;
  if (!resultado) { disp.style.display = 'none'; return; }
  // RC-07 T3: Si Motor A clasifica como Reasignable → Motor B debe ser Reasignacion
  if (window._currentRecord && window._currentRecord.estado_eq_ant === 'Reasignable') {
    resultado.recomendacion = 'Reasignacion';
    resultado.motivo = 'Motor A: procesador de generación reciente — equipo apto para reasignación.';
  }
  var colors = { 'RAEE': { bg: '#FFEBEE', fg: '#C00000' }, 'Donacion': { bg: '#FFF3E0', fg: '#E65100' },
    'Venta interna': { bg: '#E8F5E9', fg: '#2E7D32' }, 'Reasignacion': { bg: '#E3F2FD', fg: '#1565C0' } };
  var c = colors[resultado.recomendacion] || { bg: '#F5F5F5', fg: '#555' };
  // RC-06 T10: Motor Evaluación Física — panel enriquecido
  var container = document.getElementById('m-motor-eval-container');
  var icons = { 'RAEE': '⚠', 'Donacion': '♻', 'Venta interna': '💼', 'Reasignacion': '↩' };
  var icon = icons[resultado.recomendacion] || '⏳';
  disp.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:' + c.bg + ';border-left:4px solid ' + c.fg + ';border-radius:0 6px 6px 0">' +
    '<span style="font-size:20px">' + icon + '</span>' +
    '<div><div style="font-size:13px;font-weight:700;color:' + c.fg + '">' + (resultado.recomendacion) + '</div>' +
    '<div style="font-size:10px;color:#888">Motor RAEEEngine v' + resultado.version + '</div></div></div>';
  disp.style.display = '';
  if (motdisp) {
    motdisp.innerHTML = '<div style="padding:6px 14px;font-size:11px;color:#666;line-height:1.4">' + resultado.motivo + '</div>';
    motdisp.style.display = '';
  }
  if (container) container.style.display = '';
  var tlc = document.getElementById('m-timeline-container');
  if (tlc && _currentRecord) {
    var tmpR = Object.assign({}, _currentRecord, { recomendacion_raee: resultado.recomendacion, motivo_raee: resultado.motivo });
    tlc.innerHTML = renderTimelineHTML(tmpR);
  }
};
  // Llamar una vez si hay datos iniciales
  window.actualizarRecomendacion();

  $('modal-bg').classList.add('active');

  // QA-05: Inicializar dirty form tracking y validación
  
  if (window.attachFieldValidation) setTimeout(attachFieldValidation, 50);
}


// ── STAB: Renderers restaurados (renderAprobaciones, renderPanelEjecutivo, renderHomeTecnico) ──

function renderAprobaciones() {
  var records = window.DataService ? DataService.getRenewals({}) : [];
  var pendientes = records.filter(function(r) { return r.estado === 'Pendiente aprobación'; });
  var el = document.getElementById('aprob-count');
  if (el) el.textContent = pendientes.length + ' registro' + (pendientes.length !== 1 ? 's' : '') + ' pendientes';
  var content = document.getElementById('aprob-content');
  if (!content) return;
  if (!pendientes.length) {
    content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3)">No hay aprobaciones pendientes.</div>';
    return;
  }
  var rows = pendientes.map(function(r) {
    var id = String(r.id).replace(/'/g, '');
    return '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:8px 10px;font-weight:600">' + esc(r.nombre || '—') + '</td>' +
      '<td style="padding:8px 10px;text-align:center">' + esc(r.empresa || '—') + '</td>' +
      '<td style="padding:8px 10px;text-align:center">' + esc(r.tecnico || '—') + '</td>' +
      '<td style="padding:8px 10px;text-align:center"><span style="background:var(--amber-l);color:var(--amber);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">Pendiente</span></td>' +
      '<td style="padding:8px 10px;text-align:center"><button class="btn" style="font-size:10px;padding:4px 10px" onclick="openEditModal(' + id + ')">Revisar</button></td>' +
      '</tr>';
  }).join('');
  content.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--accent);color:#fff">' +
    '<th style="padding:8px 10px;text-align:left">Nombre</th><th style="padding:8px 10px">Empresa</th>' +
    '<th style="padding:8px 10px">Técnico</th><th style="padding:8px 10px">Estado</th><th style="padding:8px 10px">Acción</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}
window.renderAprobaciones = renderAprobaciones;

// STAB-v10 TASK 5 — Donut RAEE (Chart.js en pe-raee-canvas)
function renderRaeeDonut(stats) {
  var canvas = document.getElementById('pe-raee-canvas');
  if (!canvas) return;
  var raeeD = stats.raeeDistrib || {};
  // Mapear a 3 categorías oficiales
  var cats = {
    'RAEE':                  raeeD['RAEE'] || 0,
    'Reasignable':           (raeeD['Reasignable'] || 0) + (raeeD['Reasignación interna'] || 0),
    'Reutilizable/Obsoleto': raeeD['Reutilizable'] || raeeD['Obsoleto'] || raeeD['Venta interna empleado'] || raeeD['Venta interna'] || raeeD['Donación'] || raeeD['Donacion'] || 0,
  };
  // Añadir categorías no cubiertas
  Object.keys(raeeD).forEach(function(k) {
    if (!cats['RAEE'] && k === 'RAEE') cats['RAEE'] = raeeD[k];
    if (!['RAEE','Reasignable','Reasignación interna','Reutilizable','Obsoleto','Venta interna empleado','Venta interna','Donación','Donacion'].includes(k)) {
      cats[k] = (cats[k] || 0) + raeeD[k];
    }
  });
  var keys = Object.keys(cats).filter(function(k){ return cats[k] > 0; });
  var vals = keys.map(function(k){ return cats[k]; });
  var total = vals.reduce(function(a,b){ return a+b; }, 0);
  if (total === 0) { var ll = document.getElementById('pe-raee-labels'); if(ll) ll.innerHTML = '<div style="color:var(--text-3);font-size:11px;padding:12px 0">Sin evaluaciones</div>'; return; }
  var COLORS = ['#C00000','#1565C0','#2E7D32','#E65100','#7B1FA2'];
  if (canvas._chart) { canvas._chart.destroy(); delete canvas._chart; }
  if (typeof Chart === 'undefined') return;
  canvas.width = 120; canvas.height = 120;
  canvas._chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: keys, datasets: [{ data: vals, backgroundColor: keys.map(function(k,i){ return COLORS[i%COLORS.length]; }), borderWidth: 2, borderColor: 'var(--bg)' }] },
    options: {
      cutout: '68%', responsive: false, animation: { duration: 600 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c){ return c.label + ': ' + c.raw + ' (' + Math.round(c.raw/total*100) + '%)'; } } } }
    }
  });
  var ll = document.getElementById('pe-raee-labels');
  if (ll) ll.innerHTML = '<div style="font-size:18px;font-weight:900;text-align:center;color:var(--text-1)">' + total + '</div>' +
    '<div style="font-size:9px;color:var(--text-3);text-align:center;margin-bottom:8px">evaluados</div>' +
    keys.map(function(k,i){ return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">' +
      '<span style="width:9px;height:9px;border-radius:50%;background:'+COLORS[i%COLORS.length]+';flex-shrink:0"></span>' +
      '<span style="font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(k) + '</span>' +
      '<span style="font-size:10px;font-weight:700">' + cats[k] + '</span>' +
      '<span style="font-size:9px;color:var(--text-3)">' + Math.round(cats[k]/total*100) + '%</span></div>'; }).join('');
}
window.renderRaeeDonut = renderRaeeDonut;

// STAB-v10 TASK 6 — Distribución de estados (barras HTML)
function renderEstadosChart(stats) {
  var el = document.getElementById('pe-estados-list');
  if (!el) return;
  var estados = stats.estados || {};
  var keys = Object.keys(estados).sort(function(a,b){ return estados[b]-estados[a]; });
  var max = keys.length ? estados[keys[0]] : 1;
  el.innerHTML = keys.map(function(st) {
    var count = estados[st];
    var pct = max ? Math.round(count/max*100) : 0;
    return '<div style="margin-bottom:6px">' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">' +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">' + esc(st) + '</span>' +
      '<span style="font-weight:700;flex-shrink:0;margin-left:4px">' + count + '</span></div>' +
      '<div style="background:var(--bg-2,#f0f0f0);height:5px;border-radius:3px">' +
      '<div style="width:'+pct+'%;height:100%;background:var(--accent);border-radius:3px;transition:width .4s"></div></div>' +
      '</div>';
  }).join('') || '<div style="color:var(--text-3);font-size:11px">Sin datos de estado</div>';
}
window.renderEstadosChart = renderEstadosChart;

function renderPanelEjecutivo() {
  var role = window.state && state.user && (state.user.role || state.user.rol);
  var allowed = ['super_admin','gestor_activos','director_ti','gerencia','tecnico'];
  if (role && allowed.indexOf(role) < 0) {
    var vp = document.getElementById('view-panel');
    if (vp) vp.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3)">Vista no disponible para tu rol</div>';
    return;
  }
  var records   = window.DataService ? DataService.getRenewals({}) : [];
  var _allStats = window.DashboardStats ? DashboardStats.get() : {};
  var _stats    = window.DashboardStats ? DashboardStats.compute(records.filter(function(r){ return !isBackup(r); })) : {};
  var total     = _stats.total || 0;
  var set = function(id,v){ var e=document.getElementById(id); if(e) e.textContent = v; };

  // ─── Proyecto: fechas, días, semáforo ─────────────────────────────
  var P = _stats.proyecto || {};
  set('pe-fecha-inicio', P.inicioTxt || '01 Jul 2026');
  set('pe-fecha-fin',    P.finTxt    || '15 Ago 2026');
  set('pe-dias-trans',   P.diasTranscurridos + ' de ' + P.diasTotal);
  set('pe-dias-rest',    P.diasRestantes + ' días');
  var semEl = document.getElementById('pe-semaforo');
  if (semEl && P.semaforo) {
    semEl.className = 'exec-hero-semaforo sem-' + P.semaforo;
    var semTxt = { verde: 'A tiempo', amarillo: 'Riesgo', rojo: 'Crítico' }[P.semaforo] || '—';
    var st = semEl.querySelector('.sem-txt'); if (st) st.textContent = semTxt;
  }

  // ─── Proyección de finalización ───────────────────────────────────
  var proy = _stats.proyeccion || {};
  set('pe-fecha-estimada', proy.fechaEstimadaTxt || '—');
  var subFE = document.getElementById('pe-fecha-estimada-sub');
  if (subFE) {
    if (proy.diasAdelanto == null) subFE.textContent = 'Sin datos suficientes';
    else if (proy.tipo === 'a-tiempo') { subFE.textContent = 'En fecha'; subFE.className = 'ehm-sub grn'; }
    else if (proy.tipo === 'adelanto') { subFE.textContent = 'Adelanto ' + proy.diasAdelanto + ' días'; subFE.className = 'ehm-sub grn'; }
    else { subFE.textContent = 'Retraso ' + Math.abs(proy.diasAdelanto) + ' días'; subFE.className = 'ehm-sub accent'; }
  }

  // ─── KPIs acumulativos (hitos) ────────────────────────────────────
  var K = _stats.kpisAcumulativos || {};
  set('pe-total',       total);
  set('pe-completados', K.finalizados || 0);
  set('pe-proceso',     _stats.proceso     || 0);
  set('pe-pendientes',  _stats.pendientes  || 0);
  set('pe-actas',       K.actas       || 0);
  set('pe-entregados',  K.entregados  || 0);
  set('pe-en-envio',    _stats.enEnvio    || 0);
  set('pe-backup',      _allStats.totalBackups || 0);
  set('pe-cerrados',    K.finalizados || 0);
  var pct = total ? Math.round((K.entregados||0)/total*100) : 0;
  set('pe-prog-pct', pct+'%');
  var pf = document.getElementById('pe-prog-fill');
  if (pf) { pf.style.width='0%'; requestAnimationFrame(function(){ setTimeout(function(){ pf.style.width=pct+'%'; },50); }); }

  // ─── Gauge esperado vs real ───────────────────────────────────────
  var G = _stats.gauge || {esperado:0,real:0,desviacion:0,estado:'ok'};
  set('pe-gauge-esperado', G.esperado + '%');
  set('pe-gauge-real',     G.real + '%');
  var desvEl = document.getElementById('pe-gauge-desv');
  if (desvEl) {
    desvEl.textContent = (G.desviacion > 0 ? '+' : '') + G.desviacion + '%';
    desvEl.style.color = G.estado === 'ok' ? 'var(--green,#16A34A)' : G.estado === 'warn' ? 'var(--amber,#D97706)' : 'var(--accent,#A51C2B)';
  }
  _renderGaugeSVG('pe-gauge', G);

  // ─── Productividad ────────────────────────────────────────────────
  var PR = _stats.productividad || {};
  set('pe-prod-restantes', PR.equiposRestantes || 0);
  set('pe-prod-semanal',   PR.promedioSemanal || 0);
  set('pe-prod-global',    PR.promedioGlobal || 0);
  set('pe-prod-ritmo',     PR.ritmoNecesario || 0);
  var vEl = document.getElementById('pe-prod-veredicto');
  if (vEl) {
    if (PR.velocidadOK) {
      vEl.innerHTML = '<span class="vd-ok">Ritmo suficiente — proyecto en curso hacia meta 15 Ago</span>';
    } else {
      var gap = ((PR.ritmoNecesario || 0) - (PR.promedioGlobal || 0)).toFixed(2);
      vEl.innerHTML = '<span class="vd-warn">Ritmo insuficiente — faltan ' + gap + ' equipos/día para cumplir 15 Ago</span>';
    }
  }

  // ─── Burn Down Chart ──────────────────────────────────────────────
  _renderBurnDownChart(_stats.burnDown || []);

  // ─── Funnel Pipeline ──────────────────────────────────────────────
  // GH3.42.5 FIX: mostrar total del proyecto (146) con desglose activos/backup
  var totalProyecto = (_allStats.total || 0) + (_allStats.totalBackups || 0);
  _renderFunnelPipeline(_stats.pipeline || [], total, totalProyecto, _allStats.totalBackups || 0);

  // ─── Cumplimiento por empresa (cards) ─────────────────────────────
  var empEl = document.getElementById('pe-empresa-new');
  if (empEl) {
    empEl.innerHTML = ['HBT','HGS'].map(function(emp) {
      var d = (_allStats.porEmpresa && _allStats.porEmpresa[emp]) ||
        {total:0,operativos:0,backup:0,pendientes:0,proceso:0,entregados:0,actas:0,cerrados:0,pct:0};
      return '<div class="exec-emp-card">' +
        '<div class="eec-head"><span class="eec-name">'+emp+'</span><span class="eec-pct">'+d.pct+'%</span></div>' +
        '<div class="eec-total">Total <strong>'+d.total+'</strong> <span class="eec-sub">('+d.operativos+' oper. + '+d.backup+' bk)</span></div>' +
        '<div class="eec-grid">' +
          '<div><div class="eec-v accent">'+d.pendientes+'</div><div class="eec-l">Pend.</div></div>' +
          '<div><div class="eec-v amb">'+d.proceso+'</div><div class="eec-l">Proceso</div></div>' +
          '<div><div class="eec-v grn">'+d.entregados+'</div><div class="eec-l">Entreg.</div></div>' +
          '<div><div class="eec-v">'+(d.actas||0)+'</div><div class="eec-l">Actas</div></div>' +
          '<div><div class="eec-v grn">'+(d.cerrados||0)+'</div><div class="eec-l">Fin.</div></div>' +
        '</div>' +
        '<div class="op-bar"><div class="op-bar-fill grn" data-pct="'+Math.min(d.pct,100)+'" style="width:0%"></div></div>' +
      '</div>';
    }).join('');
    setTimeout(function(){empEl.querySelectorAll('.op-bar-fill[data-pct]').forEach(function(b){b.style.width=b.dataset.pct+'%';});},80);
  }

  // ─── Leaderboard técnicos — Carrusel flashcards (GH3.42.5) ───────
  var tecEl = document.getElementById('pe-tecnico-new');
  if (tecEl) {
    var ptMap = _stats.porTecnico || {};
    var tecList = Object.keys(ptMap).map(function(t){ return Object.assign({tec:t},ptMap[t]); })
      .filter(function(d){ return d.asignados>0; })
      .sort(function(a,b){ return b.entregados - a.entregados; });
    if (tecList.length === 0) {
      tecEl.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:16px 0;font-family:var(--font-data);letter-spacing:.05em">Sin datos de técnicos disponibles</div>';
    } else {
      _renderTecnicoCarousel(tecEl, tecList);
    }
  }

  // ─── Ciudades (tarjetas) ──────────────────────────────────────────
  var ciuEl = document.getElementById('pe-ciudades-cards');
  if (ciuEl) {
    var cList = Object.values(_stats.porCiudadDetalle || {})
      .sort(function(a,b){ return b.total - a.total; });
    ciuEl.innerHTML = cList.length ? cList.map(function(c){
      return '<div class="exec-city-card">' +
        '<div class="ecc-head"><span class="ecc-name">'+esc(c.ciudad)+'</span><span class="ecc-total">'+c.total+'</span></div>' +
        '<div class="ecc-stats">' +
          '<span class="acc">'+c.pendientes+' pend</span>' +
          '<span class="amb">'+c.proceso+' proc</span>' +
          '<span class="grn">'+c.entregados+' ent</span>' +
        '</div>' +
        '<div class="op-bar"><div class="op-bar-fill grn" data-pct="'+c.pct+'" style="width:0%"></div></div>' +
        '<div class="ecc-pct">'+c.pct+'%</div>' +
      '</div>';
    }).join('') : '<div style="color:var(--text-3);font-size:11px;padding:8px 0">Sin datos de ciudades</div>';
    setTimeout(function(){ciuEl.querySelectorAll('.op-bar-fill[data-pct]').forEach(function(b){b.style.width=b.dataset.pct+'%';});},110);
  }

  // ─── Distribución de estados ──────────────────────────────────────
  if (window.renderEstadosChart) renderEstadosChart(_stats);

  // ─── Devoluciones (donut + resumen) ───────────────────────────────
  var devPend = _stats.devolucionesPendientes || 0;
  var devTotal = _stats.devoluciones || 0;
  var devRec   = Math.max(0, devTotal - devPend);
  _renderDevolucionesDonut(devPend, devRec);
  var devEl = document.getElementById('pe-devoluciones-list');
  if (devEl) {
    devEl.innerHTML =
      '<div class="panel-stat-row"><span class="panel-stat-label" style="color:var(--accent)">Pend. recepción</span><span class="panel-stat-val accent">'+devPend+'</span></div>' +
      '<div class="panel-stat-row"><span class="panel-stat-label" style="color:var(--green)">Recibidas</span><span class="panel-stat-val grn">'+devRec+'</span></div>' +
      '<div class="panel-stat-row"><span class="panel-stat-label">Total iniciadas</span><span class="panel-stat-val">'+devTotal+'</span></div>';
  }

  // ─── Destino Final (donut) ────────────────────────────────────────
  var DF = _stats.destinoFinal || { RAEE:0, Venta:0, Reasignacion:0, Donacion:0, Otro:0, total:0 };
  set('pe-destino-total',   DF.total > 0 ? DF.total + ' con recomendación' : 'Sin recomendación asignada');
  set('pe-destino-raee',    DF.RAEE);
  set('pe-destino-venta',   DF.Venta);
  set('pe-destino-reasign', DF.Reasignacion);
  set('pe-destino-donacion',DF.Donacion);
  _renderDestinoDonut(DF);
  // Validación consistencia
  var _sum = (DF.RAEE||0) + (DF.Venta||0) + (DF.Reasignacion||0) + (DF.Donacion||0) + (DF.Otro||0);
  if (_sum !== DF.total && DF.total > 0) {
    console.warn('[DestinoFinal] suma incongruente:', _sum, 'vs total', DF.total);
  }

  // ─── Cuello de botella ────────────────────────────────────────────
  _renderCuelloBotella(_stats);

  // ─── Riesgos activos ──────────────────────────────────────────────
  _renderRiesgos(_stats, _allStats);

  // ─── Novedades (equipos cruzados) ─────────────────────────────────
  var novedades = _allStats.novedades || [];
  set('pe-novedades-count', novedades.length);
  var novListEl = document.getElementById('pe-novedades-list');
  if (novListEl) {
    if (novedades.length === 0) {
      novListEl.innerHTML = '<div style="color:var(--green);font-size:11px">Sin equipos cruzados detectados</div>';
    } else {
      novListEl.innerHTML = '<div style="overflow:auto;max-height:220px">' +
        '<table style="width:100%;border-collapse:collapse;font-size:10px">' +
        '<thead><tr style="background:var(--accent);color:#fff">' +
        '<th style="padding:4px 6px;text-align:left">Usuario</th>' +
        '<th style="padding:4px 6px">Emp.Usr</th>' +
        '<th style="padding:4px 6px">Emp.Act</th>' +
        '<th style="padding:4px 6px">AF</th>' +
        '<th style="padding:4px 6px">Serial</th>' +
        '<th style="padding:4px 6px">Ciudad</th>' +
        '</tr></thead><tbody>' +
        novedades.map(function(n,i){
          return '<tr style="background:'+(i%2===0?'var(--bg-2,#F9F9F9)':'#fff')+'">'+
            '<td style="padding:3px 6px">'+esc(n.nombre||'')+'</td>'+
            '<td style="padding:3px 6px;color:var(--accent);font-weight:700;text-align:center">'+esc(n.empresaUsuario||'')+'</td>'+
            '<td style="padding:3px 6px;color:var(--green);font-weight:700;text-align:center">'+esc(n.empresa||'')+'</td>'+
            '<td style="padding:3px 6px;text-align:center">'+esc(n.af||'')+'</td>'+
            '<td style="padding:3px 6px;text-align:center">'+esc(n.serial||'')+'</td>'+
            '<td style="padding:3px 6px">'+esc(n.ciudad||'')+'</td>'+
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
  }

  // ─── Aprobaciones ─────────────────────────────────────────────────
  var aprob = _stats.aprobaciones || {pendientes:0,completadas:0,rechazadas:0};
  set('pe-aprobaciones', aprob.pendientes || 0);
  set('pe-correccion',   aprob.rechazadas || 0);
  set('pe-bloqueados',   0);
}
window.renderPanelEjecutivo = renderPanelEjecutivo;

// ═══════════════════════════════════════════════════════════════════════
// GH3.42 — Helpers de render ejecutivo
// ═══════════════════════════════════════════════════════════════════════
function _renderGaugeSVG(elId, G) {
  var el = document.getElementById(elId);
  if (!el) return;
  var esperado = Math.max(0, Math.min(100, G.esperado || 0));
  var real     = Math.max(0, Math.min(100, G.real || 0));
  var color    = G.estado === 'ok' ? '#16A34A' : G.estado === 'warn' ? '#D97706' : '#A51C2B';
  // Semicircular gauge: arco de 180°
  function polar(pct) {
    var angle = (pct / 100) * 180 - 180; // -180° .. 0°
    var rad = angle * Math.PI / 180;
    return { x: 100 + 80 * Math.cos(rad), y: 100 + 80 * Math.sin(rad) };
  }
  var pExp = polar(esperado);
  var pReal = polar(real);
  function arcPath(pct, r) {
    var end = polar(pct);
    var large = pct > 50 ? 1 : 0;
    return 'M ' + (100 - r) + ' 100 A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + end.x + ' ' + end.y;
  }
  el.innerHTML =
    '<svg viewBox="0 0 200 130" width="100%" style="max-width:280px;display:block;margin:0 auto">' +
      '<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E5E7EB" stroke-width="18" stroke-linecap="round"/>' +
      '<path d="' + arcPath(real, 80) + '" fill="none" stroke="'+color+'" stroke-width="18" stroke-linecap="round" style="transition:stroke-dasharray 1.2s ease"/>' +
      '<line x1="100" y1="100" x2="' + pExp.x.toFixed(1) + '" y2="' + pExp.y.toFixed(1) + '" stroke="#475569" stroke-width="2" stroke-dasharray="3,3"/>' +
      '<circle cx="' + pExp.x.toFixed(1) + '" cy="' + pExp.y.toFixed(1) + '" r="4" fill="#475569"/>' +
      '<text x="100" y="90" text-anchor="middle" font-family="Inter Tight,sans-serif" font-size="34" font-weight="900" fill="'+color+'">' + real + '%</text>' +
      '<text x="100" y="115" text-anchor="middle" font-size="10" fill="#6B7280">Real vs '+esperado+'% esperado</text>' +
    '</svg>';
}

function _renderBurnDownChart(puntos) {
  var cv = document.getElementById('pe-burndown-chart');
  if (!cv || !window.Chart) return;
  if (cv._chart) cv._chart.destroy();
  var labels    = puntos.map(function(p){ return p.fecha; });
  var esperados = puntos.map(function(p){ return p.esperado; });
  var reales    = puntos.map(function(p){ return p.real; });
  cv._chart = new Chart(cv, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Meta ideal', data: esperados, borderColor: '#94A3B8', borderDash:[5,4], borderWidth:2, pointRadius:0, tension:0.1, fill:false },
        { label: 'Real (pendientes)', data: reales, borderColor: '#A51C2B', backgroundColor:'rgba(165,28,43,.1)', borderWidth:2.5, pointRadius:2.5, tension:0.2, fill:true, spanGaps:false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position:'bottom', labels:{ font:{size:10}, boxWidth:10, padding:6 } } },
      scales: {
        x: { ticks:{ font:{size:8}, maxRotation:0, autoSkip:true, maxTicksLimit:8 }, grid:{ display:false } },
        y: { beginAtZero:true, ticks:{ font:{size:9} }, grid:{ color:'#F3F4F6' }, title:{ display:true, text:'Equipos pendientes', font:{size:9} } }
      },
      animation: { duration:1200, easing:'easeOutQuart' }
    }
  });
}

function _renderFunnelPipeline(pipe, totalActivos, totalProyecto, totalBackup) {
  var el = document.getElementById('pe-funnel');
  if (!el) return;
  totalProyecto = totalProyecto || totalActivos;
  totalBackup   = totalBackup   || 0;
  var LABELS_MAP = {
    'Pendiente':'Pendientes',
    'Alistamiento':'Alistamiento',
    'Programado':'Programados',
    'En tránsito equipo nuevo':'En tránsito',
    'Entregado equipo nuevo':'Entregados',
    'Pendiente devolución equipo anterior':'Pend. devolución',
    'En tránsito equipo anterior':'Devolución tránsito',
    'Equipo anterior recibido':'Recepción bodega',
    'Pendiente aprobación':'Pend. aprobación',
    'Renovación completada':'Finalizados',
    'Cerrado':'Cerrado'
  };
  // Solo estados con datos
  var steps = pipe.filter(function(p){ return p.count > 0 || p.estado === 'Pendiente'; });
  if (!steps.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Sin datos de pipeline disponibles</div>';
    return;
  }
  var maxCount = steps.reduce(function(a,b){ return Math.max(a, b.count); }, 1);

  // ── Header: total con desglose ──
  var headerHtml =
    '<div class="fnl-header">' +
      '<div class="fnl-total-block">' +
        '<div class="fnl-total-num" id="fnl-count-total">0</div>' +
        '<div class="fnl-total-lbl">Total proyecto</div>' +
      '</div>' +
      '<div class="fnl-split">' +
        '<div class="fnl-split-item"><span class="fnl-split-v" id="fnl-count-act">0</span><span class="fnl-split-l">operativos</span></div>' +
        '<div class="fnl-split-sep">·</div>' +
        '<div class="fnl-split-item"><span class="fnl-split-v" id="fnl-count-bk">0</span><span class="fnl-split-l">backup</span></div>' +
      '</div>' +
    '</div>';

  // ── Trapezoides SVG animados ──
  // GH3.42.11: bandas más compactas para reducir tamaño total
  var STEP_H = 28;   // altura por banda (antes 42)
  var STEP_GAP = 3;  // separación entre bandas (antes 4)
  var W = 400;       // ancho total
  var svgH = steps.length * (STEP_H + STEP_GAP) + 8;
  var svgHtml = '<svg viewBox="0 0 ' + W + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" style="width:100%;display:block;overflow:visible;max-height:340px">' +
    '<defs>' +
      '<linearGradient id="fnl-grad-brand" x1="0%" y1="0%" x2="100%" y2="0%">' +
        '<stop offset="0%" stop-color="#A51C2B" stop-opacity=".08"/>' +
        '<stop offset="100%" stop-color="#A51C2B" stop-opacity=".28"/>' +
      '</linearGradient>' +
      '<linearGradient id="fnl-grad-fill" x1="0%" y1="0%" x2="100%" y2="0%">' +
        '<stop offset="0%" stop-color="#6A0F19"/>' +
        '<stop offset="50%" stop-color="#A51C2B"/>' +
        '<stop offset="100%" stop-color="#DC2626"/>' +
      '</linearGradient>' +
    '</defs>';

  steps.forEach(function(s, i) {
    var y = i * (STEP_H + STEP_GAP) + 6;
    var pctReal = totalActivos ? Math.round(s.count / totalActivos * 100) : 0;
    // Ancho del trapezoide (decrece con cada paso)
    var widthPct = 100 - (i * (55 / Math.max(steps.length - 1, 1)));  // decrece 55% a lo largo del funnel
    var barWidth = W * (widthPct / 100);
    var barX = (W - barWidth) / 2;
    // Ancho del fill (por count relativo al max)
    var fillPct = s.count / maxCount;
    var fillWidth = barWidth * fillPct;
    // Conversion rate desde el paso anterior
    var convRate = '';
    if (i > 0 && steps[i-1].count > 0) {
      var rate = Math.round(s.count / steps[i-1].count * 100);
      convRate = rate + '%';
    }

    svgHtml +=
      '<g class="fnl-svg-step" data-idx="' + i + '" data-count="' + s.count + '" data-pct-total="' + pctReal + '">' +
        // Fondo del trapezoide (siempre visible)
        '<rect x="' + barX + '" y="' + y + '" width="' + barWidth + '" height="' + STEP_H + '" fill="url(#fnl-grad-brand)" rx="2"/>' +
        // Fill animado (crece de 0 a fillWidth)
        '<rect class="fnl-svg-fill" x="' + barX + '" y="' + y + '" width="0" height="' + STEP_H + '" fill="url(#fnl-grad-fill)" rx="2" data-target-width="' + fillWidth + '" style="transition:width 1.1s cubic-bezier(.16,1,.3,1);transition-delay:' + (i * 80) + 'ms"/>' +
        // Borde derecho del trapezoide
        '<line x1="' + (barX + barWidth) + '" y1="' + y + '" x2="' + (barX + barWidth) + '" y2="' + (y + STEP_H) + '" stroke="#A51C2B" stroke-width="1" opacity=".3"/>' +
        // Texto: etiqueta izquierda
        '<text x="' + (barX + 10) + '" y="' + (y + STEP_H/2 + 4) + '" fill="#FAFAF8" font-size="11" font-weight="600" style="font-family:-apple-system,Segoe UI,sans-serif;pointer-events:none">' +
          esc(LABELS_MAP[s.estado] || s.estado) +
        '</text>' +
        // Texto: número derecha
        '<text x="' + (barX + barWidth - 10) + '" y="' + (y + STEP_H/2 - 1) + '" fill="#FAFAF8" font-size="12" font-weight="700" text-anchor="end" style="font-family:Charter,Georgia,serif;pointer-events:none" class="fnl-svg-count" data-target="' + s.count + '">' +
          '0' +
        '</text>' +
        // Texto: porcentaje debajo del número
        '<text x="' + (barX + barWidth - 10) + '" y="' + (y + STEP_H/2 + 10) + '" fill="rgba(250,250,248,.75)" font-size="8" font-weight="600" text-anchor="end" style="font-family:ui-monospace,monospace;pointer-events:none">' +
          pctReal + '% total' +
        '</text>';

    // Conversion rate flecha (entre bandas)
    if (i > 0 && convRate) {
      svgHtml +=
        '<g class="fnl-svg-arrow" style="opacity:0;animation:fnlArrowIn .4s ease-out ' + (i * 80 + 400) + 'ms forwards">' +
          '<line x1="' + (W/2) + '" y1="' + (y - STEP_GAP) + '" x2="' + (W/2) + '" y2="' + (y - 1) + '" stroke="#A51C2B" stroke-width="1" opacity=".5"/>' +
          '<text x="' + (W/2 + 5) + '" y="' + (y - 1) + '" fill="#6B6660" font-size="8" font-weight="600" style="font-family:ui-monospace,monospace">' + convRate + '</text>' +
        '</g>';
    }

    svgHtml += '</g>';
  });
  svgHtml += '</svg>';

  el.innerHTML = headerHtml + '<div class="fnl-svg-wrap">' + svgHtml + '</div>';

  // ── Animaciones: count-up del header + fill de trapezoides + count-up interno ──
  _funnelCountUp('fnl-count-total', totalProyecto, 900);
  setTimeout(function(){ _funnelCountUp('fnl-count-act', totalActivos, 750); }, 120);
  setTimeout(function(){ _funnelCountUp('fnl-count-bk',  totalBackup,   700); }, 240);

  // Fill de trapezoides
  setTimeout(function() {
    el.querySelectorAll('.fnl-svg-fill').forEach(function(rect) {
      rect.setAttribute('width', rect.dataset.targetWidth);
    });
  }, 100);

  // Count-up dentro de cada band SVG
  el.querySelectorAll('.fnl-svg-count').forEach(function(txt, idx) {
    var target = parseInt(txt.dataset.target, 10) || 0;
    setTimeout(function() {
      _funnelCountUpText(txt, target, 800);
    }, idx * 80 + 300);
  });
}

// Helper: count-up para elementos HTML por id
function _funnelCountUp(id, target, dur) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = performance.now();
  function tick(now) {
    var t = Math.min((now - start) / dur, 1);
    var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
// Helper: count-up para nodos <text> SVG
function _funnelCountUpText(node, target, dur) {
  var start = performance.now();
  function tick(now) {
    var t = Math.min((now - start) / dur, 1);
    var eased = 1 - Math.pow(1 - t, 3);
    node.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function _renderDevolucionesDonut(pend, rec) {
  var cv = document.getElementById('pe-devoluciones-donut');
  if (!cv || !window.Chart) return;
  if (cv._chart) cv._chart.destroy();
  var totalD = pend + rec;
  if (totalD === 0) {
    var ctx = cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('Sin devoluciones iniciadas', cv.width/2, cv.height/2);
    return;
  }
  cv._chart = new Chart(cv, {
    type: 'doughnut',
    data: {
      labels: ['Pend. recepción', 'Recibidas'],
      datasets: [{
        data: [pend, rec],
        backgroundColor: ['#A51C2B', '#16A34A'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position:'bottom', labels:{ font:{size:10}, boxWidth:10, padding:6 } },
        tooltip: { callbacks: { label: function(c){ return c.label + ': ' + c.parsed; }}}
      },
      animation: { duration: 1200, easing:'easeOutQuart' }
    }
  });
}

function _renderDestinoDonut(DF) {
  var cv = document.getElementById('pe-destino-donut');
  if (!cv || !window.Chart) return;
  if (cv._chart) cv._chart.destroy();
  if (!DF.total) {
    // GH3.42.11: estado vacío visual — círculo placeholder gris con texto centrado
    cv._chart = new Chart(cv, {
      type: 'doughnut',
      data: {
        labels: ['Sin datos'],
        datasets: [{
          data: [1],
          backgroundColor: ['#E5E7EB'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        animation: { duration: 600 }
      }
    });
    return;
  }
  cv._chart = new Chart(cv, {
    type: 'doughnut',
    data: {
      labels: ['Venta','Reasignación','Donación','RAEE'].concat(DF.Otro > 0 ? ['Otro'] : []),
      datasets: [{
        data: [DF.Venta, DF.Reasignacion, DF.Donacion, DF.RAEE].concat(DF.Otro > 0 ? [DF.Otro] : []),
        backgroundColor: ['#16A34A','#1565C0','#E65100','#C00000','#94A3B8'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position:'bottom', labels:{ font:{size:9}, boxWidth:9, padding:5 } }
      },
      animation: { duration: 1200, easing:'easeOutQuart' }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// GH3.42.5 — Carrusel flashcards de técnicos
// ═══════════════════════════════════════════════════════════════════════
function _renderTecnicoCarousel(container, tecList) {
  var state = { idx: 0, timer: null, autoplayMs: 6000 };
  container.classList.add('exec-tec-carousel-wrap');

  function _radialSVG(pct, size, stroke, colorFill, colorTrack) {
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" class="rc-ring">' +
      '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke="' + colorTrack + '" stroke-width="' + stroke + '"/>' +
      '<circle class="rc-ring-fill" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke="' + colorFill + '" stroke-width="' + stroke + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + c.toFixed(2) + '" stroke-linecap="round" transform="rotate(-90 ' + (size/2) + ' ' + (size/2) + ')" data-target-offset="' + offset.toFixed(2) + '" style="transition:stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)"/>' +
    '</svg>';
  }

  function _cardHTML(d, i, total) {
    var rank = String(i + 1).padStart(2, '0');
    var pctColor = d.pct >= 70 ? '#1F5940' : d.pct >= 30 ? '#A56617' : '#A51C2B';
    var initials = (d.tec || '?').split(/\s+/).map(function(w){ return w.charAt(0); }).join('').slice(0,2).toUpperCase();
    return '<div class="rc-card" data-idx="' + i + '">' +
        // Rank chip
        '<div class="rc-rank"><span class="rc-rank-num">' + rank + '</span><span class="rc-rank-lbl">de ' + total + '</span></div>' +
        // Header con avatar iniciales + nombre
        '<div class="rc-head">' +
          '<div class="rc-avatar" style="background:linear-gradient(135deg,' + pctColor + ',' + pctColor + '99)">' + initials + '</div>' +
          '<div class="rc-head-info">' +
            '<div class="rc-name">' + esc(d.tec) + '</div>' +
            '<div class="rc-role">Técnico responsable</div>' +
          '</div>' +
        '</div>' +
        // Radial + KPI grande
        '<div class="rc-body">' +
          '<div class="rc-radial">' +
            _radialSVG(d.pct, 140, 10, pctColor, 'rgba(216,213,206,.5)') +
            '<div class="rc-radial-inner">' +
              '<div class="rc-radial-pct" data-target="' + d.pct + '">0%</div>' +
              '<div class="rc-radial-lbl">de avance</div>' +
            '</div>' +
          '</div>' +
          '<div class="rc-stats-grid">' +
            '<div class="rc-stat"><span class="rc-stat-v">' + d.asignados + '</span><span class="rc-stat-l">Asignados</span></div>' +
            '<div class="rc-stat"><span class="rc-stat-v accent">' + d.pendientes + '</span><span class="rc-stat-l">Pendientes</span></div>' +
            '<div class="rc-stat"><span class="rc-stat-v amb">' + d.proceso + '</span><span class="rc-stat-l">En proceso</span></div>' +
            '<div class="rc-stat"><span class="rc-stat-v grn">' + d.entregados + '</span><span class="rc-stat-l">Entregados</span></div>' +
            '<div class="rc-stat"><span class="rc-stat-v">' + (d.actas || 0) + '</span><span class="rc-stat-l">Actas</span></div>' +
            '<div class="rc-stat"><span class="rc-stat-v grn">' + d.finalizados + '</span><span class="rc-stat-l">Finalizados</span></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  var carouselHTML =
    '<div class="rc-viewport">' +
      '<div class="rc-track" id="rc-track">' +
        tecList.map(function(d,i){ return _cardHTML(d, i, tecList.length); }).join('') +
      '</div>' +
    '</div>' +
    '<div class="rc-nav">' +
      '<button class="rc-arrow rc-prev" aria-label="Anterior">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>' +
      '</button>' +
      '<div class="rc-dots">' +
        tecList.map(function(_,i){ return '<button class="rc-dot' + (i===0?' active':'') + '" data-i="' + i + '" aria-label="Técnico ' + (i+1) + '"></button>'; }).join('') +
      '</div>' +
      '<button class="rc-arrow rc-next" aria-label="Siguiente">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>' +
      '</button>' +
    '</div>';

  container.innerHTML = carouselHTML;

  var track = container.querySelector('#rc-track');
  var dots  = container.querySelectorAll('.rc-dot');
  var cards = container.querySelectorAll('.rc-card');

  function _goTo(idx) {
    state.idx = ((idx % tecList.length) + tecList.length) % tecList.length;
    track.style.transform = 'translateX(-' + (state.idx * 100) + '%)';
    dots.forEach(function(d, i){ d.classList.toggle('active', i === state.idx); });
    // Animar el radial y count-up del pct al aparecer
    _animateCard(cards[state.idx]);
  }
  function _animateCard(card) {
    if (!card) return;
    var ring = card.querySelector('.rc-ring-fill');
    if (ring) {
      // Resetear e iniciar animación de nuevo
      var target = ring.dataset.targetOffset;
      ring.style.strokeDashoffset = ring.getAttribute('stroke-dasharray');
      requestAnimationFrame(function(){
        setTimeout(function(){ ring.style.strokeDashoffset = target; }, 40);
      });
    }
    var pctEl = card.querySelector('.rc-radial-pct');
    if (pctEl) {
      var target = parseInt(pctEl.dataset.target, 10) || 0;
      var start = performance.now();
      var dur = 1100;
      (function tick(now){
        var t = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        pctEl.textContent = Math.round(target * eased) + '%';
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    }
  }
  function _startAutoplay() {
    if (state.timer) clearInterval(state.timer);
    if (tecList.length <= 1) return;
    state.timer = setInterval(function(){ _goTo(state.idx + 1); }, state.autoplayMs);
  }
  function _stopAutoplay() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  // Event bindings
  container.querySelector('.rc-prev').onclick = function(){ _stopAutoplay(); _goTo(state.idx - 1); };
  container.querySelector('.rc-next').onclick = function(){ _stopAutoplay(); _goTo(state.idx + 1); };
  dots.forEach(function(d){
    d.onclick = function(){ _stopAutoplay(); _goTo(parseInt(d.dataset.i, 10) || 0); };
  });
  // Pausar autoplay al hover
  container.addEventListener('mouseenter', _stopAutoplay);
  container.addEventListener('mouseleave', _startAutoplay);
  // Swipe touch (mobile)
  var touchStartX = 0;
  container.addEventListener('touchstart', function(e){ touchStartX = e.touches[0].clientX; _stopAutoplay(); }, { passive:true });
  container.addEventListener('touchend', function(e){
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { _goTo(state.idx + (dx < 0 ? 1 : -1)); }
  });
  // Keyboard nav (focus dentro del carrusel)
  container.tabIndex = 0;
  container.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft')  { _stopAutoplay(); _goTo(state.idx - 1); }
    if (e.key === 'ArrowRight') { _stopAutoplay(); _goTo(state.idx + 1); }
  });

  // Init: animar primera card
  _goTo(0);
  _startAutoplay();
}

function _renderCuelloBotella(_stats) {
  var botEl = document.getElementById('pe-botella');
  var pipe   = _stats.pipeline || [];
  var total  = _stats.total || 0;
  var sorted = pipe.filter(function(p){ return p.count>0; }).sort(function(a,b){ return b.count-a.count; });
  if (!sorted.length) {
    botEl.innerHTML = '<div style="color:var(--text-3);font-size:11px;padding:8px 0">Sin registros en proceso</div>';
    return;
  }
  var top = sorted[0];
  var topPct = Math.round(top.count / Math.max(total,1) * 100);
  var impacto = topPct >= 30 ? 'ALTO' : topPct >= 15 ? 'MEDIO' : 'BAJO';
  var impColor = impacto === 'ALTO' ? 'var(--accent)' : impacto === 'MEDIO' ? 'var(--amber,#D97706)' : 'var(--green,#16A34A)';
  botEl.innerHTML =
    '<div class="bot-main">' +
      '<div class="bot-estado">'+esc(top.estado)+'</div>' +
      '<div class="bot-nums"><span class="bot-count">'+top.count+'</span><span class="bot-pct">'+topPct+'% del total</span></div>' +
      '<div class="bot-impact" style="color:'+impColor+'">Impacto '+impacto+'</div>' +
      '<div class="op-bar"><div class="op-bar-fill" data-pct="'+topPct+'" style="width:0%;background:'+impColor+'"></div></div>' +
    '</div>' +
    '<div class="bot-others">' +
    sorted.slice(1,5).map(function(p){
      var pp = Math.round(p.count/Math.max(total,1)*100);
      return '<div class="bot-row"><span>'+esc(p.estado)+'</span><span><strong>'+p.count+'</strong> · '+pp+'%</span></div>';
    }).join('') +
    '</div>';
  setTimeout(function(){botEl.querySelectorAll('.op-bar-fill[data-pct]').forEach(function(b){b.style.width=b.dataset.pct+'%';});},140);
}

function _renderRiesgos(_stats, _allStats) {
  var el = document.getElementById('pe-riesgos-list');
  if (!el) return;
  var ris  = _stats.riesgos || {};
  var cal  = _stats.calidad || {};
  var nov  = (_allStats.novedades || []).length;
  var items = [
    { l:'Equipos cruzados',       v: nov,                         c:'accent', d:'Novedades a resolver' },
    { l:'Pend. devolución',       v: ris.pendienteDevolucion,     c:'accent', d:'Lista recolección sin recibir' },
    { l:'Pend. aprobación',       v: ris.pendienteAprobacion,     c:'amb',    d:'Esperando validación gerencia' },
    { l:'Sin movimiento',         v: ris.sinMovimiento,           c:'amb',    d:'En Pendiente sin avance' },
    { l:'Sin técnico asignado',   v: cal.sinTecnico || 0,         c:'amb',    d:'Requiere asignación' },
    { l:'Sin serial',             v: cal.sinSerial || 0,          c:'amb',    d:'Falta serial en el registro' },
    { l:'Sin ciudad',             v: cal.sinCiudad || 0,          c:'amb',    d:'Falta ciudad en el registro' },
    { l:'Registros incompletos',  v: ris.registrosIncompletos,    c:'accent', d:'Múltiples campos vacíos' }
  ].filter(function(r){ return (r.v||0) > 0; });
  if (items.length === 0) {
    el.innerHTML = '<div style="color:var(--green);font-size:12px;padding:10px 0">✓ Sin riesgos activos detectados</div>';
    return;
  }
  el.innerHTML = items.map(function(r){
    return '<div class="risk-item">' +
      '<div class="ri-l"><strong>'+r.l+'</strong><span class="ri-d">'+r.d+'</span></div>' +
      '<div class="ri-v '+r.c+'">'+r.v+'</div>' +
    '</div>';
  }).join('');
}

function renderHomeTecnico() {
  var user = window.state && state.user;
  var tecName = user ? (user.name || user.displayName || '—') : '—';
  var av = document.getElementById('ht-avatar');
  if (av) {
    var parts = tecName.split(' ').filter(Boolean);
    av.textContent = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : tecName.slice(0,2).toUpperCase();
  }
  var set = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  set('ht-nombre', tecName);
  set('ht-meta', 'Técnico REN26 · PMC-TI');
  var records = window.DataService ? DataService.getRenewals({}) : [];
  var first = tecName.split(' ')[0].toLowerCase();
  var mios = first ? records.filter(function(r) { return r.tecnico && r.tecnico.toLowerCase().indexOf(first) >= 0; }) : [];
  var pend = mios.filter(function(r) { return r.estado === 'Pendiente' || r.estado === 'Alistamiento'; }).length;
  var proc = mios.filter(function(r) { return r.estado !== 'Pendiente' && r.estado !== 'Alistamiento' && r.estado !== 'Renovación completada' && r.estado !== 'Cerrado'; }).length;
  var list = mios.filter(function(r) { return r.estado === 'Renovación completada' || r.estado === 'Cerrado'; }).length;
  set('ht-pendientes', pend); set('ht-proceso', proc); set('ht-listos', list); set('ht-total', mios.length);
  var colaEl = document.getElementById('ht-cola-list');
  var cntEl  = document.getElementById('ht-cola-count');
  if (colaEl) {
    var activos = mios.filter(function(r) { return r.estado !== 'Cerrado'; });
    if (cntEl) cntEl.textContent = activos.length;
    colaEl.innerHTML = activos.length ? activos.map(function(r) {
      var id = String(r.id).replace(/'/g, '');
      return '<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px">' +
        '<div><strong>' + esc(r.nombre||'—') + '</strong><br><span style="color:var(--text-3)">' + esc(r.empresa||'—') + ' · ' + esc(r.ciudad||'—') + '</span></div>' +
        '<button class="btn" style="font-size:10px;padding:4px 10px" data-id="' + id + '" onclick="openEditModal(this.dataset.id)">Abrir</button></div>';
    }).join('') : '<div style="padding:20px;text-align:center;color:var(--text-3)">No hay registros asignados.</div>';
  }
}
window.renderHomeTecnico = renderHomeTecnico;

// ── RESTAURACIÓN STAB: funciones truncadas por accidente en este sprint ──────

// closeModal
function closeModal(force) {
  // RC-01 T17: DirtyForm eliminado
  var bg = document.getElementById('modal-bg');
  if (bg) bg.classList.remove('active');
  if (window.state) { state.editingId = null; state.editingVersion = undefined; } // RC-07 TASK 9
}
window.closeModal = closeModal;

// RC1-HOTFIX-01: cerrar modal de confirmación
function closeConfirmSave() {
  var bg = document.getElementById('confirm-save-bg');
  if (bg) bg.classList.remove('active');
}
window.closeConfirmSave = closeConfirmSave;

// _showSyncStatus
function _showSyncStatus(status) {
  var indicator = document.getElementById('sync-status-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'sync-status-indicator';
    indicator.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;z-index:9999;transition:opacity .4s';
    document.body.appendChild(indicator);
  }
  if (status === 'ok') {
    indicator.textContent = '✓ Sincronizado';
    indicator.style.background = 'var(--grn-l, #E8F5E9)';
    indicator.style.color = 'var(--grn, #2E7D32)';
    indicator.style.opacity = '1';
    setTimeout(function() { indicator.style.opacity = '0'; }, 3000);
  } else if (status === 'error') {
    indicator.textContent = '⚠ Error de sincronización';
    indicator.style.background = 'var(--red-l, #FFEBEE)';
    indicator.style.color = 'var(--red, #C00000)';
    indicator.style.opacity = '1';
  }
}
window._showSyncStatus = _showSyncStatus;

// saveRecord
function saveRecord() {
  var id = window.state && state.editingId;
  if (id == null) return;
  var u = window.DataService ? DataService.getRenewal(id) : null;
  if (!u) return;

  var fields = [
    'empresa','nombre','cedula','usuario','correo','ciudad','ceco','proyecto','cargo','gerente','nivel_usuario',
    'eq_ant_tipo','eq_ant_marca','eq_ant_modelo','eq_ant_serial','eq_ant_af','eq_ant_placa','eq_ant_hostname',
    'eq_ant_procesador','eq_ant_ram','eq_ant_disco','eq_ant_so',
    'eq_nvo_tipo','eq_nvo_marca','eq_nvo_modelo','eq_nvo_serial','eq_nvo_af','eq_nvo_placa','eq_nvo_hostname',
    'eq_nvo_procesador','eq_nvo_ram','eq_nvo_disco','eq_nvo_so',
    'tecnico','estado','estado_entrega_equipo_nuevo','notas_alistamiento','caso_envio',
    'fecha_envio','fecha_entrega','fecha_envio_acta','fecha_firma_acta','nombre_archivo',
    'estado_devolucion','fecha_solicitud_devolucion','fecha_transito','fecha_recepcion_bodega',
    'observaciones_devolucion',
    'lista_recoleccion','eval_bateria','eval_teclado','eval_touchpad','eval_estetico'
  ];
  var changes = {};
  fields.forEach(function(f) {
    var el = document.getElementById('m-' + f);
    if (!el) return;
    var val = el.type === 'checkbox' ? el.checked : el.value;
    if (f === 'tecnico' && val === '') {
      changes[f] = u.tecnico || '';
    } else {
      changes[f] = val;
    }
  });
  var acEl = document.getElementById('m-acta_entrega_url');
  changes.acta_entrega_url = (acEl ? acEl.value.trim() : '') || '';
  changes.recibido_bodega    = changes.estado_devolucion === 'Recibida en bodega';
  changes.equipo_devuelto    = changes.recibido_bodega;
  var fbStars = document.getElementById('m-feedback-stars');
  changes.feedback = fbStars ? parseInt(fbStars.dataset.value || '0') : 0;
  var naEl = document.getElementById('m-nombre_archivo');
  changes.nombre_archivo = (naEl ? naEl.value.trim() : '') || (u.nombre_archivo || '');

  try {
    if (changes.eval_bateria && changes.eval_teclado && changes.eval_touchpad && changes.eval_estetico) {
      if (typeof RAEEEngine !== 'undefined') {
        var _raeeResult = RAEEEngine.calcular(
          changes.eval_bateria, changes.eval_teclado,
          changes.eval_touchpad, changes.eval_estetico
        );
        // RC-07 T3: Si Motor A Reasignable → forzar Reasignacion en Motor B
        if (_raeeResult && u.estado_eq_ant === 'Reasignable') {
          _raeeResult.recomendacion = 'Reasignacion';
          _raeeResult.motivo = 'Motor A: procesador de generación reciente — reasignación.';
        }
        if (_raeeResult) {
          changes.recomendacion_raee     = _raeeResult.recomendacion;
          changes.motivo_raee            = _raeeResult.motivo;
          changes.motor_raee_version     = _raeeResult.version;
          changes.fecha_evaluacion_raee  = _raeeResult.fechaEvaluacion;
          changes.usuario_evaluacion_raee = (window.state && state.user && state.user.name) ||
                                            (window.state && state.user && state.user.id) || '';
        }
      }
    }

    // RC-07 TASK 3: verificar VERSION antes del PATCH (sin llamada Graph extra)
    var _formVer    = window.state && state.editingVersion !== undefined ? state.editingVersion : -1;
    var _cachedVer  = window.SynchronizationManager ? SynchronizationManager.getCachedVersion(id) : undefined;
    if (_formVer >= 0 && _cachedVer !== undefined && Number(_cachedVer) > Number(_formVer)) {
      // RC-07 TASK 4: CONFLICTO — otro usuario modificó el registro
      if (window.toast) toast('Conflicto: este registro fue actualizado por otro usuario mientras lo estabas editando. La información será recargada antes de continuar.', 'warning');
      if (window.closeModal) closeModal(true);
      var _conflictId = id;
      if (window.DataService && DataService.reloadFromProvider) {
        DataService.reloadFromProvider().then(function() {
          if (window.renderResumen) renderResumen();
          if (window.openEditModal) openEditModal(_conflictId);
        });
      }
      return;
    }

    // RC-07 TASK 5: incrementar VERSION en los cambios antes del PATCH
    var _currentU = window.DataService ? DataService.getRenewal(id) : null;
    if (_currentU) changes.version = (Number(_currentU.version) || 0) + 1;

    // ═══ GH3.41: Snapshot pre-PATCH para auditoría diferida ══════════
    // GH3.41.1 TASK 02: Deep clone para garantizar inmutabilidad.
    // Aunque los campos auditados son primitivos, el clone protege ante
    // futuras mutaciones del objeto _currentU en memoria.
    var _auditSnapshot = null;
    if (window.AuditService && _currentU) {
      _auditSnapshot = {};
      Object.keys(changes).forEach(function(k) {
        var v = _currentU[k];
        // Deep clone seguro: primitivos pasan directo, objetos/arrays via JSON
        if (v == null || typeof v !== 'object') {
          _auditSnapshot[k] = v;
        } else {
          try { _auditSnapshot[k] = JSON.parse(JSON.stringify(v)); }
          catch(e) { _auditSnapshot[k] = String(v); }
        }
      });
    }

    if (window.DataService) DataService.updateRenewal(id, changes, window.state && state.user);
    // STAB-v11 TASK 01: auto-enqueue cuando estado cambia a 'Pendiente aprobación'
    if (changes.estado === 'Pendiente aprobación' && window.ApprovalService && ApprovalService.requestValidation) {
      try { ApprovalService.requestValidation(id, window.state && state.user); }
      catch(e) { /* silencioso — puede no cumplir todos los checklist aún */ }
    }
    // RC-07 Fix 2: cerrar modal y refrescar inmediatamente
    if (window.closeModal) closeModal(true);
    if (window.DashboardStats) DashboardStats.invalidate(); // TASK 02: invalidar caché
    if (window.renderResumen) renderResumen();
    // RC-01 T12: _F7_FIELDS vacío — estado_entrega_equipo_nuevo
    // tiene entrada en SP_FIELD_MAP (EstadoEntregaEquipoNuevo).
    var _F7_FIELDS = new Set([]);
    var syncChanges = {};
    Object.keys(changes).forEach(function(k) {
      if (!_F7_FIELDS.has(k)) syncChanges[k] = changes[k];
    });

    if (window.DataService && DataService.syncToProvider) {
      if (window.state) state._syncInProgress = true;
      DataService.syncToProvider(id, syncChanges)
        .then(function() {
          // RC-06 TASK 5: no reloadFromProvider completo — requestTick con debounce
          // closeModal y renderResumen ya fueron llamados antes del PATCH (RC-07)
          if (window.state) state._syncInProgress = false;
          if (window.toast) toast('Guardado · Sincronizado', 'success');
          if (window._showSyncStatus) _showSyncStatus('ok');

          // ═══ GH3.41 + GH3.41.1 TASK 04: Auditoría con garantía de cierre ═
          // try/finally garantiza que la sesión SIEMPRE se cierre, aunque
          // log() lance excepción. Si finishSession falla en I/O, el buffer
          // se persiste automáticamente en la cola offline (TASK 05).
          if (window.AuditService && _auditSnapshot) {
            var _sessionOpened = false;
            try {
              AuditService.startSession({
                origen:      'Formulario',
                modulo:      'Renovaciones',
                observacion: 'Actualización desde formulario de edición'
              });
              _sessionOpened = true;
              Object.keys(changes).forEach(function(field) {
                // Excluir metadatos internos que no aportan trazabilidad
                if (field === 'version' || field === '_version') return;
                try {
                  AuditService.log({
                    registro:       id,
                    campo:          field,
                    valor_anterior: _auditSnapshot[field],
                    valor_nuevo:    changes[field]
                  });
                } catch(logErr) {
                  console.warn('[audit] log('+field+') falló:', logErr && logErr.message);
                }
              });
            } catch (auditErr) {
              console.warn('[audit] error no bloqueante:', auditErr && auditErr.message);
            } finally {
              if (_sessionOpened) {
                // finishSession devuelve una Promise; si rechaza no bloquea
                Promise.resolve()
                  .then(function() { return AuditService.finishSession(); })
                  .catch(function(e) {
                    console.warn('[audit] finishSession falló:', e && e.message);
                    // Defensa adicional: si finishSession no cerró la sesión, abortar
                    if (AuditService._diag && AuditService._diag().hasSession) {
                      AuditService.abortSession();
                    }
                  });
              }
            }
          }

          // Propagar a otros usuarios: 1 tick tras 1.5s de propagación Graph
          if (window.SynchronizationManager) {
            if (SynchronizationManager.recordActivity) SynchronizationManager.recordActivity(); // RC-07 TASK 6
            if (SynchronizationManager.requestTick)   SynchronizationManager.requestTick(1500); // RC-07 TASK 7
          }
        })
        .catch(function(err) {
          if (window.state) state._syncInProgress = false;
          if (window._showSyncStatus) _showSyncStatus('error');

          var msg = err && err.message ? String(err.message) : 'Error desconocido';
          var code = err && err.graphCode ? err.graphCode : 'UNKNOWN';

          // GH3.42.1: mensajes específicos por tipo de error
          if (code === 'CONFLICT') {
            // Otro usuario modificó el registro — recargar y avisar
            if (window.DataService && DataService.reloadFromProvider) DataService.reloadFromProvider();
            if (window.toast) toast('Conflicto: otro usuario modificó este registro. Recargando datos...', 'warning');
          } else if (code === 'GATEWAY_TIMEOUT' || code === 'BAD_GATEWAY' || code === 'SERVICE_UNAVAILABLE' || code === 'SERVER_ERROR' || code === 'REQUEST_TIMEOUT') {
            // Errores transitorios de Graph — el retry ya se agotó
            if (window.toast) toast('Microsoft Graph no respondió (HTTP ' + (err.httpStatus || '5xx') + '). Los cambios NO se guardaron. Vuelve a intentar en unos segundos.', 'critical');
          } else if (code === 'THROTTLED') {
            // GH3.42.6: mensaje específico con tiempo de espera si Graph lo indicó
            var wait = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : 60;
            if (window.toast) toast('Microsoft Graph aplicó rate limit por múltiples cambios simultáneos. Espera ' + wait + ' segundos antes de reintentar. Los cambios NO se guardaron.', 'critical');
          } else if (code === 'AUTH_REQUIRED') {
            if (window.toast) toast('Sesión expirada. Recarga la página para iniciar sesión nuevamente.', 'critical');
          } else if (code === 'FORBIDDEN') {
            if (window.toast) toast('Sin permisos para modificar este registro (RBAC).', 'critical');
          } else if (code === 'NETWORK_ERROR' || code === 'DNS_FAILURE' || code === 'TIMEOUT') {
            if (window.toast) toast('Sin conexión al servidor. Verifica tu red y reintenta.', 'critical');
          } else {
            if (window.toast) toast('Error al guardar: ' + msg.replace(/^\[GraphClient\]\s*/, ''), 'critical');
          }

          console.error('[SYNC ERROR]', code, '·', msg);

          // Registrar el ERROR en AuditService (no bloqueante)
          try {
            if (window.AuditService && AuditService.logSystemEvent) {
              AuditService.logSystemEvent('ERROR', {
                origen:      'Graph',
                modulo:      'Renovaciones',
                registro:    String(id),
                observacion: 'PATCH RENOVACIONES falló: ' + code + ' HTTP ' + (err.httpStatus || '?')
              });
            }
          } catch(auditErr) { /* intentional: audit no bloquea */ }
        });
    }
  } catch(e) {
    console.error('[saveRecord]', e);
    if (window.toast) toast('Error al guardar: ' + e.message, 'critical');
    return;
  }
}
window.saveRecord = saveRecord;

// F7_resolveRole — resolución de rol por email en SYSTEM_USERS
// Mapeo rol legible → clave interna
var _ROL_MAP = {
  'SUPER ADMIN':    'super_admin',
  'SUPERADMIN':     'super_admin',
  'SUPER_ADMIN':    'super_admin',
  'GESTOR ACTIVOS': 'gestor_activos',
  'GESTORACTIVOS':  'gestor_activos',
  'GESTOR_ACTIVOS': 'gestor_activos',
  'TECNICO':        'tecnico',
  'TÉCNICO':        'tecnico',
  'CONSULTA':       'consulta',
  'VISITANTE':      'visitante',
};
function F7_resolveRole(email) {
  if (!email || typeof email !== 'string' || email.trim() === '') return 'visitante';
  var users = window.SYSTEM_USERS || [];
  if (!users.length) return 'visitante';
  var lower = email.toLowerCase().trim();
  var match = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    // Soportar campo correo o email
    var userEmail = (u && (u.correo || u.email || '')) + '';
    if (userEmail.toLowerCase().trim() === lower) { match = u; break; }
  }
  if (!match) return 'visitante';
  var raw = (match.role || match.rol || '').toUpperCase().trim();
  return _ROL_MAP[raw] || raw.toLowerCase().replace(/\s+/g,'_') || 'visitante';
}
window.F7_resolveRole = F7_resolveRole;

// applyPanelFilter / clearPanelFilters
window.PANEL_FILTERS = {};
function applyPanelFilter(field, value) {
  window.PANEL_FILTERS = window.PANEL_FILTERS || {};
  if (value) { window.PANEL_FILTERS[field] = value; }
  else { delete window.PANEL_FILTERS[field]; }
  if (window.renderPanelEjecutivo) renderPanelEjecutivo();
}
window.applyPanelFilter = applyPanelFilter;

function clearPanelFilters() {
  window.PANEL_FILTERS = {};
  document.querySelectorAll('.panel-filter-sel').forEach(function(s) { s.value = ''; });
  if (window.renderPanelEjecutivo) renderPanelEjecutivo();
}
window.clearPanelFilters = clearPanelFilters;

// confirmarGuardado / cancelarGuardado / ejecutarGuardado — modal de confirmación de guardado
function confirmarGuardado() {
  var bg = document.getElementById('confirm-save-bg');
  if (bg) bg.classList.add('active');
}
window.confirmarGuardado = confirmarGuardado;

function cancelarGuardado() {
  var bg = document.getElementById('confirm-save-bg');
  if (bg) bg.classList.remove('active');
}
window.cancelarGuardado = cancelarGuardado;

function ejecutarGuardado() {
  cancelarGuardado();
  if (window.saveRecord) saveRecord();
}
window.ejecutarGuardado = ejecutarGuardado;

// toggleSidebar — contraer/expandir sidebar
function toggleSidebar() {
  var app     = document.querySelector('.app');
  var sidebar = document.querySelector('.sidebar');
  if (!app || !sidebar) return;
  var collapsed = sidebar.classList.toggle('collapsed');
  app.classList.toggle('sb-collapsed', collapsed);
  // RC-06 item 11: body class para que footer reaccione
  document.body.classList.toggle('sb-collapsed', collapsed);
  try { localStorage.setItem('sb_state', collapsed ? 'collapsed' : 'expanded'); } catch(e) { /* privado */ }
}
window.toggleSidebar = toggleSidebar;

// Restaurar estado del sidebar al cargar
(function initSidebarState() {
  // RC-06 item 10: poblar data-tip para tooltips con sidebar contraído
  setTimeout(function() {
    document.querySelectorAll('.sb-item').forEach(function(item) {
      var span = item.querySelector('span:first-of-type');
      if (span && !item.dataset.tip) item.setAttribute('data-tip', span.textContent.trim());
    });
  }, 100);
  try {
    var savedState = localStorage.getItem('sb_state');
    if (savedState === 'collapsed') {
      var app     = document.querySelector('.app');
      var sidebar = document.querySelector('.sidebar');
      if (app)     app.classList.add('sb-collapsed');
      if (sidebar) sidebar.classList.add('collapsed');
      document.body.classList.add('sb-collapsed');
    }
  } catch(e) { /* sin acceso a localStorage */ }
})();

// attachFieldValidation — validación de campos del formulario
window.attachFieldValidation = function() {
  // validación básica de campos requeridos en el modal
  document.querySelectorAll('#modal-body [required]').forEach(function(el) {
    el.addEventListener('blur', function() {
      var grp = el.closest('.form-group');
      if (grp) grp.classList.toggle('has-error', !el.value.trim());
    });
  });
};
// STAB-v10 TASK 1 — Vista Equipos Backup (layout nativo, mismo que Usuarios)
function renderBackup() {
  var vp = document.getElementById('view-backup');
  if (!vp) return;
  var allBackups = (window.USERS || []).filter(function(u) { return isBackup(u); });
  // Filtros
  var srch  = ((document.getElementById('bk-srch')           || {}).value || '').toLowerCase();
  var fEmp  = (document.getElementById('bk-filter-empresa')  || {}).value || '';
  var fTipo = (document.getElementById('bk-filter-tipo')     || {}).value || '';
  var fCiu  = (document.getElementById('bk-filter-ciudad')   || {}).value || '';
  var data  = allBackups.filter(function(u) {
    if (fEmp  && u.empresa !== fEmp) return false;
    if (fTipo && (u.eq_ant_tipo||'').toUpperCase() !== fTipo.toUpperCase()) return false;
    if (fCiu  && u.ciudad !== fCiu) return false;
    if (srch) {
      var hay = [u.nombre,u.eq_ant_serial,u.eq_ant_marca,u.eq_ant_modelo,u.ciudad,u.empresa,u.eq_ant_tipo].join(' ').toLowerCase();
      if (!hay.includes(srch)) return false;
    }
    return true;
  });
  var uniq = function(arr){ return arr.filter(function(v,i,a){ return v && a.indexOf(v)===i; }).sort(); };
  var pill = function(arr, id, ph, val) {
    return '<select class="filter-pill" id="'+id+'" onchange="renderBackup()">' +
      '<option value="">' + ph + '</option>' +
      arr.map(function(v){ return '<option'+(v===val?' selected':'')+'>'+esc(v)+'</option>'; }).join('') +
      '</select>';
  };
  // Estadísticas rápidas
  var hbtCount = allBackups.filter(function(u){ return u.empresa==='HBT'; }).length;
  var hgsCount = allBackups.filter(function(u){ return u.empresa==='HGS'; }).length;

  vp.innerHTML =
    '<div class="hero compact">' +
    '<div class="hero-inner">' +
    '<div class="hero-eyebrow">Repositorio de Hardware</div>' +
    '<h1 class="hero-title">Equipos <strong>Backup</strong></h1>' +
    '<p class="hero-sub">' + allBackups.length + ' equipos disponibles · HBT ' + hbtCount + ' · HGS ' + hgsCount + '</p>' +
    '</div></div>' +
    '<div class="section">' +
    '<div class="toolbar">' +
    '<div class="search-box">' +
    '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
    '<input type="text" id="bk-srch" placeholder="Buscar por nombre, serial, marca, modelo..." value="' + esc(srch) + '" oninput="renderBackup()" style="flex:1">' +
    '</div>' +
    pill(uniq(allBackups.map(function(u){return u.empresa;})), 'bk-filter-empresa', 'Todas las empresas', fEmp) +
    pill(uniq(allBackups.map(function(u){return u.eq_ant_tipo;})), 'bk-filter-tipo', 'Todos los tipos', fTipo) +
    pill(uniq(allBackups.map(function(u){return u.ciudad;})), 'bk-filter-ciudad', 'Todas las ciudades', fCiu) +
    '<span class="filter-count">' + data.length + ' de ' + allBackups.length + ' equipos</span>' +
    '</div>' +
    '<div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl">' +
    '<thead><tr>' +
    '<th>ID</th><th>Empresa</th><th>Marca</th><th>Modelo</th><th>Serial (nvo)</th><th>Serial (ant)</th><th>AF</th><th>Ciudad</th><th>Estado</th><th>Observaciones</th>' +
    '</tr></thead><tbody>' +
    (data.length === 0
      ? '<tr><td colspan="10"><div class="empty"><div class="empty-icon">📦</div><div class="empty-title">Sin equipos backup</div><div class="empty-sub">No hay equipos backup con los filtros actuales</div></div></td></tr>'
      : data.map(function(u) {
          var safeId = String(u.id).replace(/'/g,'');
          var estCls = ConfigService && ConfigService.badgeClass ? ConfigService.badgeClass(u.estado||'pendiente') : 'badge-neutral';
          // STAB-v16 TASK 03: backups en Excel solo tienen eq_nvo_* llenos
          var marca  = u.eq_nvo_marca  || u.eq_ant_marca  || '—';
          var modelo = u.eq_nvo_modelo || u.eq_ant_modelo || '—';
          var serNvo = u.eq_nvo_serial || '—';
          var serAnt = u.eq_ant_serial || '—';
          var af     = u.eq_nvo_af     || u.eq_ant_af     || '—';
          var obs    = u.observaciones_devolucion || u.notas_alistamiento || '—';
          return '<tr onclick="openEditModal('+safeId+')">' +
            '<td class="td-id">'+esc(u.id||'—')+'</td>' +
            '<td><span class="badge badge-'+(u.empresa||'').toLowerCase()+'">'+esc(u.empresa||'—')+'</span></td>' +
            '<td class="td-strong">'+esc(marca)+'</td>' +
            '<td>'+esc(modelo)+'</td>' +
            '<td class="td-mono">'+esc(serNvo)+'</td>' +
            '<td class="td-mono td-soft">'+esc(serAnt)+'</td>' +
            '<td class="td-mono">'+esc(af)+'</td>' +
            '<td class="td-soft">'+esc(u.ciudad||'—')+'</td>' +
            '<td><span class="badge '+estCls+'">'+esc(u.estado||'Pendiente')+'</span></td>' +
            '<td class="td-soft" style="font-size:11px">'+esc(obs)+'</td>' +
            '</tr>';
        }).join('')) +
    '</tbody></table></div></div>' +
    '</div>';
  // Focus en el buscador solo si no hay filtros activos
  var bkSrch = document.getElementById('bk-srch');
  if (bkSrch && !srch) bkSrch.focus();
}
window.renderBackup = renderBackup;;;


