// ════════════════════════════════════════════════════════════════════
// js/ui.js — PMC-TI-REN26 GH1
// Rendering de vistas, modal de edición, filtros, reportes, aprobaciones
// ════════════════════════════════════════════════════════════════════

function renderResumen() {
  try {
  // GH3.39.2 P2/P3: ÚNICA fuente de verdad — calculateProjectMetrics()
  // STAB-v09.1 TASK 8: fuente única de verdad — buildDashboardStats()
  var m = window.buildDashboardStats ? buildDashboardStats(window.USERS || []) : calculateProjectMetrics();

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
  
  _setText('h-empresas', 'HBT ' + m.hbt + ' \u00b7 HGS ' + m.hgs);
  var _lkpiC = document.getElementById('lkpi-colabs');
  if (_lkpiC) _lkpiC.textContent = m.totalColaboradores;
  var _lkpiCS = document.getElementById('lkpi-colabs-sub');
  if (_lkpiCS) _lkpiCS.textContent = 'colaboradores activos';
  var _lkpiE = document.getElementById('lkpi-empresas');
  if (_lkpiE) _lkpiE.textContent = 'HBT ' + m.hbt + ' \u00b7 HGS ' + m.hgs;
  
  const _allCount   = m.totalEquipos;
  const _backupCount = m.totalBackups;
  _setText('k-total',       _allCount);
  _setText('k-entregados',  entregados);
  _setText('k-pct',         pct + '%');
  _setText('k-alistamiento',alistamiento);
  _setText('k-pendientes',  pendientes);
  _setText('k-actas',       actas);
  var _bcEl = document.getElementById('k-backup');
  if (_bcEl) _bcEl.textContent = _backupCount;
  var _bcSubEl = document.getElementById('k-backup-sub');
  if (_bcSubEl) _bcSubEl.textContent = m.hbt + ' HBT · ' + m.hgs + ' HGS (backup)';
  
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
  } catch(e) {
    console.error('[renderResumen]', e.message);
  }
}

function renderEmpresaChart() {
  // STAB-v09.1 TASK 4: usar buildDashboardStats para consistencia total
  var _bds = window.buildDashboardStats ? buildDashboardStats(getReal()) : calculateProjectMetrics();
  const data = ['HBT', 'HGS'].map(emp => {
    var d = (_bds.porEmpresa && _bds.porEmpresa[emp]) || { total:0, pendientes:0, proceso:0, entregados:0, finalizados:0, pct:0 };
    return {
      label: emp, total: d.total, backup: 0,
      entregados: d.entregados, proceso: d.proceso, pend: d.pendientes, finalizados: d.finalizados, pct: d.pct
    };
  });
  $('empresa-chart').innerHTML = data.map(d => {
    const pct = d.total > 0 ? Math.round(d.entregados / d.total * 100) : 0;
    return '<div class="chart-row"><div class="chart-row-head"><div class="chart-row-name">' + d.label + '</div><div class="chart-row-stat"><strong>' + d.total + '</strong> equipos · ' + d.entregados + ' entregados (<strong>' + pct + '%</strong>)</div></div><div class="chart-bar">' +
      (d.entregados ? '<div class="chart-bar-seg" style="width:' + (d.entregados/d.total*100) + '%; background: var(--green)"></div>' : '') +
      (d.proceso ? '<div class="chart-bar-seg" style="width:' + (d.proceso/d.total*100) + '%; background: var(--amber)"></div>' : '') +
      (d.pend ? '<div class="chart-bar-seg" style="width:' + (d.pend/d.total*100) + '%; background: var(--blue)"></div>' : '') +
      (d.backup ? '<div class="chart-bar-seg" style="width:' + (d.backup/d.total*100) + '%; background: #FCD34D"></div>' : '') +
      '</div><div class="chart-legend"><div class="chart-legend-item"><span class="chart-legend-dot" style="background: var(--green)"></span>Entregados ' + d.entregados + '</div><div class="chart-legend-item"><span class="chart-legend-dot" style="background: var(--amber)"></span>En proceso ' + d.proceso + '</div><div class="chart-legend-item"><span class="chart-legend-dot" style="background: var(--blue)"></span>Pendientes ' + d.pend + '</div>' +
      (d.backup ? '<div class="chart-legend-item"><span class="chart-legend-dot" style="background: #FCD34D"></span>Backup ' + d.backup + '</div>' : '') +
      '</div></div>';
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
  var _bds2 = window.buildDashboardStats ? buildDashboardStats(getReal()) : calculateProjectMetrics();
  var _ptMap = _bds2.porTecnico || {};
  const data = techs.map((t, i) => {
    var d = _ptMap[t] || { asignados:0, pendientes:0, proceso:0, entregados:0, finalizados:0, pct:0 };
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
  const cityMap = {};
  DataService.getRenewals({}).forEach(u => {
    const c = u.ciudad ? u.ciudad : 'Sin ciudad';
    cityMap[c] = (cityMap[c] || 0) + 1;
  });
  const cities = Object.entries(cityMap).sort((a,b) => b[1] - a[1]);
  if (cities.length === 0) { svg.innerHTML = ''; return; }
  const cx = 600, cy = 270;
  const main = cities[0];
  const rest = cities.slice(1, 22);
  let content = '';
  rest.forEach((c, i) => {
    const angle = (i / rest.length) * Math.PI * 2 - Math.PI / 2;
    const dist = 180 + (i % 3) * 60;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    content += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" stroke="rgba(211,0,52,0.15)" stroke-width="1" stroke-dasharray="2,4"/>';
  });
  rest.forEach((c, i) => {
    const angle = (i / rest.length) * Math.PI * 2 - Math.PI / 2;
    const dist = 180 + (i % 3) * 60;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const radius = Math.max(10, Math.min(28, 10 + c[1] * 1.3));
    const cityEsc = esc(c[0]).replace(/'/g, "\\'");
    content += '<g style="cursor:pointer" onclick="filterByCity(\'' + cityEsc + '\')">' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (radius+8) + '" fill="rgba(211,0,52,0.15)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" fill="rgba(211,0,52,0.88)" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>' +
      '<text x="' + x + '" y="' + (y + radius + 18) + '" fill="white" text-anchor="middle" font-size="12" font-weight="700">' + esc(c[0]) + '</text>' +
      '<text x="' + x + '" y="' + (y + radius + 33) + '" fill="rgba(255,255,255,0.6)" text-anchor="middle" font-size="10">' + c[1] + ' eq.</text>' +
      '</g>';
  });
  const mr = Math.max(56, Math.min(90, 56 + main[1] * 0.4));
  const mainEsc = esc(main[0]).replace(/'/g, "\\'");
  content += '<defs><radialGradient id="grad-main"><stop offset="0%" stop-color="#FF1A55"/><stop offset="100%" stop-color="#A5002A"/></radialGradient></defs>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + (mr+18) + '" fill="none" stroke="rgba(211,0,52,0.35)" stroke-width="1.5"><animate attributeName="r" values="' + (mr+18) + ';' + (mr+34) + ';' + (mr+18) + '" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite"/></circle>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + mr + '" fill="url(#grad-main)" stroke="white" stroke-width="3" style="cursor:pointer" onclick="filterByCity(\'' + mainEsc + '\')"/>' +
    '<text x="' + cx + '" y="' + (cy - 6) + '" fill="white" text-anchor="middle" font-size="18" font-weight="800">' + esc(main[0]) + '</text>' +
    '<text x="' + cx + '" y="' + (cy + 16) + '" fill="rgba(255,255,255,0.9)" text-anchor="middle" font-size="12" font-weight="600">' + main[1] + ' equipos</text>';
  svg.innerHTML = content;
}

function filterByCity(city) {
  goView('usuarios');
  setTimeout(() => { $('search-input').value = city; renderUsuarios(); }, 100);
}
window.filterByCity = filterByCity;
function setStateFilter(estado) {
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
    if (q) {
      const blob = [u.nombre, u.cedula, u.usuario, u.correo, u.ciudad, u.serial, u.hostname, u.placa, u.empresa, u.proyecto, u.eq_ant_af, u.eq_nvo_af, u.eq_ant_serial, u.eq_ant_hostname, u.eq_nvo_serial, u.eq_nvo_hostname, u.proyecto, u.marca, u.modelo].join(' ').toLowerCase();
      if (blob.indexOf(q) < 0) return false;
    }
    return true;
  });
}

function renderUsuarios() {
  populateProjectFilter('filter-proyecto');
  const data = getFiltered();
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
  $('tec-grid').innerHTML = techs.map(t => {
    const mine = t === 'Sin asignar' 
      ? real.filter(u => !u.tecnico)
      : real.filter(u => (u.tecnico || '').toLowerCase() === t.toLowerCase());
    const total = mine.length;
    const pend = mine.filter(u => u.estado === 'Pendiente').length;
    const proc = mine.filter(u => u.estado === 'Alistamiento' || u.estado === 'En tránsito').length;
    const ent = mine.filter(u => u.estado === 'Entregado' || u.estado === 'Completado').length;
    const acta = mine.filter(u => u.acta_firmada).length;
    const pct = total > 0 ? Math.round(ent / total * 100) : 0;
    const cls = t.toLowerCase() === 'sin asignar' ? 'unassigned' : t.toLowerCase();
    const initials = t === 'Sin asignar' ? '—' : t.substring(0, 2).toUpperCase();
    return '<div class="tec-card ' + cls + '" onclick="openTecnicoDetail(\'' + t.replace(/\'/g, "\\\'") + '\')" style="cursor:pointer"><div class="tec-head"><div class="tec-avatar">' + initials + '</div><div><div class="tec-name">' + t + '</div><div class="tec-meta">' + total + ' equipos asignados · click para detalle</div></div></div><div class="tec-stats"><div class="tec-stat"><div class="tec-stat-label">Pendientes</div><div class="tec-stat-val">' + pend + '</div></div><div class="tec-stat"><div class="tec-stat-label">En proceso</div><div class="tec-stat-val amb">' + proc + '</div></div><div class="tec-stat"><div class="tec-stat-label">Entregados</div><div class="tec-stat-val grn">' + ent + '</div></div><div class="tec-stat"><div class="tec-stat-label">Actas</div><div class="tec-stat-val blu">' + acta + '</div></div></div><div class="tec-progress"><div class="tec-progress-bar" style="width: ' + pct + '%"></div></div><div class="tec-progress-text">' + pct + '% completado</div></div>';
  }).join('');
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
  const ent = mine.filter(u => u.estado === 'Entregado' || u.estado === 'Completado' || u.estado === 'Cerrado' || (u.estado || '').indexOf('Entregado') >= 0).length;
  const acta = mine.filter(u => u.acta_firmada).length;
  const pct = total > 0 ? Math.round(ent / total * 100) : 0;
  
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
function previewVisitante() {
  if (!can('panel.preview')) {
    toast('Sin permisos para previsualizar el Vista de Seguimiento', 'warning');
    return;
  }
  notify({
    level: 'info', category: 'system',
    title: 'Vista de Seguimiento · Vista previa',
    message: 'El Vista de Seguimiento (modo Visitante) estará disponible en la siguiente fase de desarrollo.'
  });
}
window.previewVisitante = previewVisitante;

function updatePreviewButton() {
  const btn = $('btn-preview-visitante');
  if (btn) btn.style.display = can('panel.preview') ? 'flex' : 'none';
}

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
  const cityMap = {};
  DataService.getRenewals({}).forEach(u => {
    const c = u.ciudad ? u.ciudad : 'Sin ciudad';
    if (!cityMap[c]) cityMap[c] = { total: 0, entregados: 0, backup: 0 };
    cityMap[c].total++;
    if (isBackup(u)) cityMap[c].backup++;
    if (u.estado === 'Entregado' || u.estado === 'Completado') cityMap[c].entregados++;
  });
  const sorted = Object.entries(cityMap).sort((a,b) => b[1].total - a[1].total);
  $('cities-grid').innerHTML = sorted.map(entry => {
    const city = entry[0], s = entry[1];
    const pct = s.total > 0 ? Math.round(s.entregados / s.total * 100) : 0;
    return '<div class="city-card" onclick="filterByCity(\'' + esc(city).replace(/'/g, "\\'") + '\')"><div class="city-head"><div class="city-name">' + esc(city) + '</div><div class="city-count">' + s.total + '</div></div><div class="city-meta">' + s.entregados + ' entregados' + (s.backup ? ' · ' + s.backup + ' backup' : '') + ' (' + pct + '%)</div><div class="city-bar"><div class="city-bar-fill" style="width: ' + pct + '%"></div></div></div>';
  }).join('');
}

// ═══ DEVOLUCIONES ═══
function renderDevoluciones() {
  // F3.7 · RBAC: técnico solo ve sus propias devoluciones
  const isTecnico = state.user.role === 'tecnico';
  const allReal = getReal().filter(u => u.eq_ant_serial || u.eq_ant_marca || u.estado_devolucion);
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
  $('r-alistamiento').textContent = base.filter(u => u.estado && u.estado !== 'Pendiente').length;
  $('r-entregados').textContent   = base.filter(u => u.fecha_entrega || u.fecha_envio_acta || u.fecha_firma_acta || u.acta_entrega_url).length;
  $('r-actas').textContent        = base.filter(u => u.fecha_firma_acta).length;
  $('r-devoluciones').textContent = base.filter(u => u.fecha_solicitud_devolucion).length;
  $('r-finalizados').textContent  = base.filter(u => u.estado === 'Completado').length;
  $('r-feedback').textContent     = base.filter(u => (u.feedback || 0) > 0).length;
  if (state.reportFilter) setReport(state.reportFilter);
}

function setReport(type, btn) {
  state.reportFilter = type;
  $$('.report-card').forEach(c => c.classList.toggle('active', c.dataset.rep === type));
  const base = getReportBase();
  let filtered = [], title = '';
  switch(type) {
    case 'alistamiento': filtered = base.filter(u => u.estado && u.estado !== 'Pendiente'); title = 'REP-01 · Alistamiento (cualquier avance)'; break;
    case 'entregados':   filtered = base.filter(u => u.fecha_entrega||u.fecha_envio_acta||u.fecha_firma_acta||u.acta_entrega_url); title = 'REP-02 · Entregados'; break;
    case 'actas':        filtered = base.filter(u => u.fecha_firma_acta); title = 'REP-03 · Actas firmadas'; break;
    case 'devoluciones': filtered = base.filter(u => u.fecha_solicitud_devolucion); title = 'REP-04 · Proceso devolución iniciado'; break;
    case 'finalizados':  filtered = base.filter(u => u.estado === 'Completado'); title = 'REP-05 · Finalizados'; break;
    case 'feedback':     filtered = base.filter(u => (u.feedback||0) > 0); title = 'REP-06 · Con feedback'; break;
    case 'raee':         filtered = base.filter(u => u.recomendacion_raee); title = 'REP-07 · Clasificación Tecnológica'; break;
  }
  if (state.repFilters.empresa) activeFilters.push(state.repFilters.empresa);
  if (state.repFilters.tipo) activeFilters.push(state.repFilters.tipo);
  if (state.repFilters.proyecto) activeFilters.push(state.repFilters.proyecto);
  if (state.repFilters.tecnico) activeFilters.push(state.repFilters.tecnico);
  const filterLabel = activeFilters.length > 0 ? ' · ' + activeFilters.join(' · ') : '';
  
  if (filtered.length === 0) {
    $('report-detail').innerHTML = '<div class="panel-head"><div><div class="panel-title">' + title + filterLabel + '</div></div></div><div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/></svg></div><div class="empty-title">Sin registros</div><div class="empty-msg">No hay equipos en esta categoría con los filtros aplicados</div></div>';
    return;
  }
  $('report-detail').innerHTML = '<div class="panel-head"><div><div class="panel-title">' + title + filterLabel + '</div><div class="panel-sub">' + filtered.length + ' registros</div></div></div><div class="tbl-wrap" style="border:none;border-radius:0;box-shadow:none"><div class="tbl-scroll"><table class="tbl"><thead><tr><th>ID</th><th>Emp</th><th>Tipo</th><th>Nombre</th><th>Ciudad</th><th>Proyecto</th><th>Técnico</th><th>Estado</th>' + (type === 'feedback' ? '<th>Feedback</th>' : '<th>Acta</th>') + '</tr></thead><tbody>' +
    filtered.map(u => '<tr onclick="openEditModal(' + u.id + ')"><td class="td-id">' + u.id + '</td><td><span class="badge badge-' + u.empresa.toLowerCase() + '">' + esc(u.empresa) + '</span></td><td><span class="badge badge-' + ((u.tipo || '').toUpperCase() === 'TORRE' ? 'torre' : 'portatil') + '">' + esc(u.tipo) + '</span></td><td class="td-strong">' + esc(u.nombre) + '</td><td class="td-soft">' + esc(u.ciudad) + '</td><td class="td-soft">' + esc(u.proyecto) + '</td><td class="td-soft">' + esc(u.tecnico) + '</td><td><span class="badge ' + ConfigService.badgeClass(u.estado) + '">' + esc(u.estado) + '</span></td><td style="text-align:center">' + (type === 'feedback' ? renderStarsDisplay(u.feedback) : (u.acta_firmada ? '✓' : '—')) + '</td></tr>').join('') + '</tbody></table></div></div>';
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
       'Renovación completada','Pendiente aprobación','Cerrado','BACKUP'];
  // RC-07: mostrar TODOS los estados disponibles (no restringir transiciones en el form)
  var estados = _allEstados.slice();
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
      '<td style="padding:8px 10px;text-align:center"><button class="btn" style="font-size:10px;padding:4px 10px" data-id="' + id + '" onclick="openEditModal(this.dataset.id)">Revisar</button></td>' +
      '</tr>';
  }).join('');
  content.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--accent);color:#fff">' +
    '<th style="padding:8px 10px;text-align:left">Nombre</th><th style="padding:8px 10px">Empresa</th>' +
    '<th style="padding:8px 10px">Técnico</th><th style="padding:8px 10px">Estado</th><th style="padding:8px 10px">Acción</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}
window.renderAprobaciones = renderAprobaciones;

function renderPanelEjecutivo() {
  var role = window.state && state.user && (state.user.role || state.user.rol);
  // STAB-v09.2 ÍTEM 3+4: técnico puede ver Seguimiento
  var allowed = ['super_admin', 'gestor_activos', 'director_ti', 'gerencia', 'tecnico'];
  if (role && allowed.indexOf(role) < 0) {
    var vp = document.getElementById('view-panel');
    if (vp) vp.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3)">Vista no disponible para este rol.</div>';
    return;
  }
  var records = window.DataService ? DataService.getRenewals({}) : [];
  var total = records.length;
  var done  = records.filter(function(r) { return r.estado === 'Renovación completada' || r.estado === 'Cerrado'; }).length;
  var proc  = records.filter(function(r) { return r.estado !== 'Pendiente' && r.estado !== 'Renovación completada' && r.estado !== 'Cerrado'; }).length;
  var pend  = records.filter(function(r) { return r.estado === 'Pendiente'; }).length;
  var actas = records.filter(function(r) { return !!r.acta_entrega_url; }).length;
  var aprob = records.filter(function(r) { return r.estado === 'Pendiente aprobación'; }).length;
  var pct   = total ? Math.round(done / total * 100) : 0;
  var set = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  set('pe-total', total); set('pe-completados', done); set('pe-proceso', proc);
  set('pe-pendientes', pend); set('pe-actas', actas); set('pe-aprobaciones', aprob);
  var pf = document.getElementById('pe-prog-fill'); if (pf) pf.style.width = pct + '%';
  set('pe-prog-pct', pct + '%');
  var hbt = records.filter(function(r) { return r.empresa === 'HBT'; }).length;
  var hgs = records.filter(function(r) { return r.empresa === 'HGS'; }).length;
  set('pe-hbt-n', hbt); set('pe-hgs-n', hgs);
  if (total) { set('pe-hbt-pct', Math.round(hbt/total*100)+'%'); set('pe-hgs-pct', Math.round(hgs/total*100)+'%'); }
  var ptEl = document.getElementById('pe-por-tecnico');
  if (ptEl) {
    var byTec = {};
    records.forEach(function(r) { var t = r.tecnico || 'Sin asignar'; byTec[t] = (byTec[t] || 0) + 1; });
    ptEl.innerHTML = Object.keys(byTec).sort().map(function(t) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px"><span>' + esc(t) + '</span><strong>' + byTec[t] + '</strong></div>';
    }).join('');
  }
  // STAB-v09.1 TASK 6+7: usar buildDashboardStats para RAEE y estados
  var _stats = window.buildDashboardStats ? buildDashboardStats(records.filter(function(r){ return !isBackup(r); })) : {};
  var _raeeD = _stats.raeeDistrib || {};
  var _estD  = _stats.estados || {};
  // Destino RAEE
  set('pe-destino-raee',    _raeeD['RAEE']                    || 0);
  set('pe-destino-venta',   _raeeD['Venta interna empleado']  || _raeeD['Venta interna'] || 0);
  set('pe-destino-reasign', _raeeD['Reasignable']             || _raeeD['Reasignación interna'] || 0);
  set('pe-destino-donacion',_raeeD['Donación']                || _raeeD['Donacion'] || 0);
  // Distribución de estados (TASK 7)
  var peEstEl = document.getElementById('pe-estados-list');
  if (peEstEl) {
    var stKeys = Object.keys(_estD).sort();
    peEstEl.innerHTML = stKeys.length ? stKeys.map(function(st) {
      return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border-light)">'+
        '<span style="font-size:11px">'+esc(st)+'</span>'+
        '<span style="font-size:11px;font-weight:700">'+_estD[st]+'</span></div>';
    }).join('') : '<div style="color:var(--text-3);font-size:11px">Sin datos</div>';
  }
  // Distribución RAEE completa (TASK 6)
  var peRaeeEl = document.getElementById('pe-raee-labels');
  if (peRaeeEl) {
    var rKeys = Object.keys(_raeeD).sort();
    peRaeeEl.innerHTML = rKeys.length ? rKeys.map(function(r) {
      return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border-light)">'+
        '<span style="font-size:11px">'+esc(r)+'</span>'+
        '<span style="font-size:11px;font-weight:700">'+_raeeD[r]+'</span></div>';
    }).join('') : '<div style="color:var(--text-3);font-size:11px">Sin clasificación</div>';
  }
}
window.renderPanelEjecutivo = renderPanelEjecutivo;

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
      if (window.toast) toast('⚠ Conflicto: este registro fue actualizado por otro usuario mientras lo estabas editando. La información será recargada antes de continuar.', 'warning');
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

    if (window.DataService) DataService.updateRenewal(id, changes, window.state && state.user);
    // RC-07 Fix 2: cerrar modal y refrescar inmediatamente
    if (window.closeModal) closeModal(true);
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
          if (window.toast) toast('✓ Guardado · Sincronizado', 'success');
          if (window._showSyncStatus) _showSyncStatus('ok');
          // Propagar a otros usuarios: 1 tick tras 1.5s de propagación Graph
          if (window.SynchronizationManager) {
            if (SynchronizationManager.recordActivity) SynchronizationManager.recordActivity(); // RC-07 TASK 6
            if (SynchronizationManager.requestTick)   SynchronizationManager.requestTick(1500); // RC-07 TASK 7
          }
        })
        .catch(function(err) {
          if (window.state) state._syncInProgress = false;
          if (err && err.graphCode === 'CONFLICT') {
            if (window.DataService && DataService.reloadFromProvider) DataService.reloadFromProvider();
            if (window.toast) toast('Conflicto detectado. Recargando datos...', 'warning');
          } else {
            console.error('[SYNC ERROR]', err && err.message);
          }
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
// STAB-v09.1 TASK 2+10 — Vista Equipos Backup (completa, como renderUsuarios)
function renderBackup() {
  var vp = document.getElementById('view-backup');
  if (!vp) return;
  var allBackups = (window.USERS || []).filter(function(u) { return isBackup(u); });
  // Filtros
  var srch  = ((document.getElementById('bk-srch')     || {}).value || '').toLowerCase();
  var fEmp  = (document.getElementById('bk-filter-empresa') || {}).value || '';
  var fTipo = (document.getElementById('bk-filter-tipo')    || {}).value || '';
  var fMar  = (document.getElementById('bk-filter-marca')   || {}).value || '';
  var fCiu  = (document.getElementById('bk-filter-ciudad')  || {}).value || '';
  var data  = allBackups.filter(function(u) {
    if (fEmp  && u.empresa !== fEmp) return false;
    if (fTipo && (u.eq_ant_tipo||'').toUpperCase() !== fTipo.toUpperCase()) return false;
    if (fMar  && !(u.eq_ant_marca||'').toLowerCase().includes(fMar)) return false;
    if (fCiu  && u.ciudad !== fCiu) return false;
    if (srch) {
      var hay = [u.nombre,u.eq_ant_serial,u.eq_ant_marca,u.eq_ant_modelo,u.ciudad,u.empresa].join(' ').toLowerCase();
      if (!hay.includes(srch)) return false;
    }
    return true;
  });
  var uniq = function(arr){ return arr.filter(function(v,i,a){ return v && a.indexOf(v)===i; }); };
  var opts = function(arr,sel,ph) {
    return '<option value="">'+(ph||'Todos')+'</option>'+uniq(arr).sort().map(function(v) {
      return '<option'+(v===sel?' selected':'')+'>'+esc(v)+'</option>';
    }).join('');
  };
  vp.innerHTML =
    '<div class="panel-head"><div><div class="panel-title">Equipos Backup disponibles</div>' +
    '<div class="panel-sub">' + data.length + ' de ' + allBackups.length + ' equipos backup</div></div></div>' +
    '<div class="filter-row" style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<input id="bk-srch" class="form-input" style="min-width:180px" placeholder="Buscar..." value="'+esc(srch)+'" oninput="renderBackup()">' +
    '<select id="bk-filter-empresa" class="form-select" style="min-width:100px" onchange="renderBackup()">' + opts(allBackups.map(function(u){return u.empresa;}),fEmp,'Empresa') + '</select>' +
    '<select id="bk-filter-tipo"    class="form-select" style="min-width:100px" onchange="renderBackup()">' + opts(allBackups.map(function(u){return u.eq_ant_tipo;}),fTipo,'Tipo') + '</select>' +
    '<input  id="bk-filter-marca"   class="form-input"  style="min-width:120px" placeholder="Marca..." value="'+esc(fMar)+'" oninput="renderBackup()">' +
    '<select id="bk-filter-ciudad"  class="form-select" style="min-width:120px" onchange="renderBackup()">' + opts(allBackups.map(function(u){return u.ciudad;}),fCiu,'Ciudad') + '</select>' +
    '</div>' +
    '<div class="table-wrap"><table class="main-table"><thead><tr>' +
    '<th>ID</th><th>Empresa</th><th>Tipo</th><th>Marca</th><th>Modelo</th><th>Serial</th><th>Ciudad</th><th>Estado</th><th></th>' +
    '</tr></thead><tbody>' +
    (data.length === 0
      ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-3)">Sin equipos backup disponibles</td></tr>'
      : data.map(function(u) {
          var safeId = String(u.id).replace(/'/g,'');
          return '<tr class="clickable" onclick="openEditModal('+safeId+')">'+
            '<td class="td-id">'+esc(u.id||'—')+'</td>'+
            '<td>'+esc(u.empresa||'—')+'</td>'+
            '<td>'+esc(u.eq_ant_tipo||'—')+'</td>'+
            '<td>'+esc(u.eq_ant_marca||'—')+'</td>'+
            '<td>'+esc(u.eq_ant_modelo||'—')+'</td>'+
            '<td style="font-family:monospace">'+esc(u.eq_ant_serial||'—')+'</td>'+
            '<td>'+esc(u.ciudad||'—')+'</td>'+
            '<td><span class="badge badge-'+({Pendiente:'warn','Renovación completada':'ok','Completado':'ok'}[u.estado]||'neutral')+'">'+esc(u.estado||'—')+'</span></td>'+
            '<td><button class="btn btn-sm" onclick="event.stopPropagation();openEditModal('+safeId+')">Ver</button></td>'+
            '</tr>';
        }).join('')) +
    '</tbody></table></div>';
  if (document.getElementById('bk-srch')) document.getElementById('bk-srch').focus();
}
window.renderBackup = renderBackup;;


