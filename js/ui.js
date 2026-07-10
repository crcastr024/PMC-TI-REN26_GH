// ════════════════════════════════════════════════════════════════════
// js/ui.js — PMC-TI-REN26 GH1
// Rendering de vistas, modal de edición, filtros, reportes, aprobaciones
// ════════════════════════════════════════════════════════════════════

function renderResumen() {
  const real = getReal();
  const total = real.length;
  const entregados = real.filter(u => u.estado === 'Entregado' || u.estado === 'Completado').length;
  const alistamiento = real.filter(u => u.estado === 'Alistamiento').length;
  const proceso = real.filter(u => u.estado === 'Alistamiento' || u.estado === 'En tránsito').length;
  const pendientes = real.filter(u => u.estado === 'Pendiente').length;
  const actas = real.filter(u => u.acta_firmada).length;
  const pct = total > 0 ? Math.round(entregados / total * 100) : 0;
  
  $('h-users').textContent = uniqueUsers();
  $('h-pendientes').textContent = pendientes;
  $('h-proceso').textContent = proceso;
  $('h-entregados').textContent = entregados;
  $('h-pct').textContent = pct + '%';
  
  // GH3.37.1 Item 2: única fuente de verdad para empresas — KPIService.byEmpresa()
  const _byEmp = (window.KPIService && KPIService.byEmpresa) ? KPIService.byEmpresa() : {};
  const hbtCount = (_byEmp.HBT && _byEmp.HBT.total) || DataService.getRenewals({empresa:'HBT'}).length;
  const hgsCount = (_byEmp.HGS && _byEmp.HGS.total) || DataService.getRenewals({empresa:'HGS'}).length;
  $('h-empresas').textContent = 'HBT ' + hbtCount + ' · HGS ' + hgsCount;
  // GH3.38 FC-01/FC-05: actualizar landing KPIs (antes hardcodeados sin id)
  var _lkpiC = document.getElementById('lkpi-colabs');
  if (_lkpiC) _lkpiC.textContent = uniqueUsers();
  var _lkpiCS = document.getElementById('lkpi-colabs-sub');
  if (_lkpiCS) _lkpiCS.textContent = 'colaboradores activos';
  var _lkpiE = document.getElementById('lkpi-empresas');
  if (_lkpiE) _lkpiE.textContent = 'HBT ' + hbtCount + ' · HGS ' + hgsCount;
  
  $('k-total').textContent = total;
  const _allCount = DataService.count();
  const _backupCount = _allCount - total;
  $('k-total-sub').innerHTML = '<strong>' + _allCount + '</strong> totales · ' + _backupCount + ' backup';
  $('k-entregados').textContent = entregados;
  $('k-pct').textContent = pct + '%';
  $('k-alistamiento').textContent = alistamiento;
  $('k-pendientes').textContent = pendientes;
  $('k-actas').textContent = actas;
  
  $('b-usuarios').textContent = _allCount;
  const provName = (DataService.providerName ? DataService.providerName() : 'Mock');
  $('tb-sync').textContent = provName + ' · ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  $('footer-date').textContent = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  $('footer-stats').textContent = _allCount + ' equipos · ' + uniqueUsers() + ' usuarios';
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
  renderMap();
}

function renderEmpresaChart() {
  const data = ['HBT', 'HGS'].map(emp => {
    const all = DataService.getRenewals({ empresa: emp });
    return {
      label: emp, total: all.length,
      backup: all.filter(u => u.es_backup).length,
      // GH3.22 P8: estados canónicos + aliases legacy para consistencia
      entregados: all.filter(u => {
        const s = u.estado || '';
        return s === 'Entregado equipo nuevo' || s === 'Pendiente recoger equipo anterior' ||
               s === 'En tránsito equipo anterior' || s === 'Equipo antiguo recibido' ||
               s === 'Renovación completada' || s === 'Pendiente aprobación' ||
               s === 'Cerrado' || s === 'Entregado' || s === 'Completado';
      }).length,
      proceso: all.filter(u => {
        const s = u.estado || '';
        return s === 'Alistamiento' || s === 'Programado' ||
               s === 'En tránsito equipo nuevo' || s === 'En tránsito';
      }).length,
      pend: all.filter(u => u.estado === 'Pendiente').length,
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
      '</div></div></div>'; /* GH3.38 FC-03: cierre .modal-body-inner */
  }).join('');
}

function renderTecnicoChart() {
  const techs = window.CONFIG.technicians;
  const colors = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--text-4)'];
  const data = techs.map((t, i) => {
    const mine = t === 'Sin asignar'
      ? getReal().filter(u => !u.tecnico)
      : getReal().filter(u => (u.tecnico || '').toLowerCase() === t.toLowerCase());
    return { tec: t, color: colors[i], total: mine.length,
      entregados: mine.filter(u => u.estado === 'Entregado' || u.estado === 'Completado').length };
  }).filter(d => d.total > 0);
  $('tecnico-chart').innerHTML = data.map(d => {
    const pct = d.total > 0 ? Math.round(d.entregados / d.total * 100) : 0;
    return '<div class="chart-row"><div class="chart-row-head"><div class="chart-row-name">' + d.tec + '</div><div class="chart-row-stat"><strong>' + d.total + '</strong> · ' + pct + '%</div></div><div class="chart-bar"><div class="chart-bar-seg" style="width:' + pct + '%; background: ' + d.color + '"></div></div></div>';
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
      const blob = [u.nombre, u.cedula, u.usuario, u.correo, u.ciudad, u.serial, u.hostname, u.placa, u.proyecto, u.marca, u.modelo].join(' ').toLowerCase();
      if (blob.indexOf(q) < 0) return false;
    }
    return true;
  });
}

function renderUsuarios() {
  populateProjectFilter('filter-proyecto');
  const data = getFiltered();
  $('tbl-count').textContent = data.length + ' de ' + DataService.count() + ' registros';
  if (data.length === 0) {
    $('tbl-body').innerHTML = '<tr><td colspan="13"><div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div class="empty-title">Sin resultados</div><div class="empty-msg">Ajusta los filtros o búsqueda</div></div></td></tr>';
    return;
  }
  $('tbl-body').innerHTML = data.map(u => {
    const estCls = u.es_backup ? 'badge-backup' : ConfigService.badgeClass(u.estado || 'pendiente');
    const tipoCls = (u.tipo || '').toUpperCase() === 'TORRE' ? 'badge-torre' : 'badge-portatil';
    const recentCls = (state.settings.highlight && state.recentlyUpdatedId === u.id) ? ' class="recently-updated"' : '';
    return '<tr' + recentCls + ' onclick="openEditModal(' + u.id + ')">' +
      '<td class="td-id">' + u.id + '</td>' +
      '<td><span class="badge badge-' + u.empresa.toLowerCase() + '">' + esc(u.empresa) + '</span></td>' +
      '<td><span class="badge ' + tipoCls + '">' + esc(u.tipo || '—') + '</span></td>' +
      '<td class="td-strong">' + esc(u.nombre || (u.es_backup ? 'BACKUP ' + u.empresa : '—')) + '</td>' +
      '<td class="td-soft">' + esc(u.ciudad || '—') + '</td>' +
      '<td class="td-soft" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(u.proyecto) + '">' + esc(u.proyecto || '—') + '</td>' +
      '<td class="td-soft">' + esc(formatEquipo(u.equipoNuevo)) + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.serial || '—') + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.placa || '—') + '</td>' +
      '<td class="td-soft td-mono">' + esc(u.hostname || '—') + '</td>' +
      '<td class="td-soft">' + esc(u.tecnico || '—') + '</td>' +
      '<td><span class="badge ' + estCls + '">' + esc(u.estado || 'Pendiente') + '</span></td>' +
      '<td style="text-align:center">' + (u.acta_firmada ? '<span style="color:var(--green);font-weight:700">✓</span>' : '<span style="color:var(--text-4)">—</span>') + '</td>' +
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
    toast('Sin permisos para previsualizar el Panel Ejecutivo', 'warning');
    return;
  }
  notify({
    level: 'info', category: 'system',
    title: 'Panel Ejecutivo · Vista previa',
    message: 'El Panel Ejecutivo (modo Visitante) estará disponible en la siguiente fase de desarrollo.'
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
    if (u.es_backup) cityMap[c].backup++;
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
  $('rep-base-count').textContent = base.length + ' de ' + getReal().length + ' base';
  $('r-alistamiento').textContent = base.filter(u => u.estado === 'Alistamiento').length;
  $('r-entregados').textContent = base.filter(u => u.estado === 'Entregado' || u.estado === 'Completado').length;
  $('r-actas').textContent = base.filter(u => u.acta_firmada).length;
  $('r-devoluciones').textContent = base.filter(u => u.recibido_bodega).length;
  $('r-finalizados').textContent = base.filter(u => u.estado === 'Completado' && u.acta_firmada).length;
  $('r-feedback').textContent = base.filter(u => (u.feedback || 0) > 0).length;
  if (state.reportFilter) setReport(state.reportFilter);
}

function setReport(type, btn) {
  state.reportFilter = type;
  $$('.report-card').forEach(c => c.classList.toggle('active', c.dataset.rep === type));
  const base = getReportBase();
  let filtered = [], title = '';
  switch(type) {
    case 'alistamiento': filtered = base.filter(u => u.estado === 'Alistamiento'); title = 'REP-01 · En Alistamiento'; break;
    case 'entregados': filtered = base.filter(u => u.estado === 'Entregado' || u.estado === 'Completado'); title = 'REP-02 · Entregados'; break;
    case 'actas': filtered = base.filter(u => u.acta_firmada); title = 'REP-03 · Actas firmadas'; break;
    case 'devoluciones': filtered = base.filter(u => u.recibido_bodega); title = 'REP-04 · Devoluciones recibidas'; break;
    case 'finalizados': filtered = base.filter(u => u.estado === 'Completado' && u.acta_firmada); title = 'REP-05 · Finalizados'; break;
    case 'feedback': filtered = base.filter(u => (u.feedback || 0) > 0); title = 'REP-06 · Con feedback'; break;
  }
  const activeFilters = [];
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
function openEditModal(id) {
  const u = DataService.getRenewal(id);
  _currentRecord = u;  // GH3.28
  if (!u) return;
  state.editingId = id;
  $('modal-eyebrow').textContent = u.es_backup ? 'BACKUP ' + u.empresa : (u.empresa + ' · ' + (u.tipo || 'EQUIPO') + ' · ID ' + u.id);
  $('modal-title').textContent = (u.nombre || ('BACKUP ' + u.empresa)) + (u.serial ? ' · ' + u.serial : '');
  
  const projects = Array.from(new Set(DataService.getRenewals({}).map(x => x.proyecto).filter(p => p))).sort();
  const projectOpts = '<option value="">—</option>' + projects.map(p => '<option' + (u.proyecto === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
  // F3.5 · Niveles desde ConfigService (no hardcodeados en componente UI)
  const niveles = ConfigService.NIVELES_REGISTRO;
  const nivelOpts = '<option value="">—</option>' + niveles.map(n => '<option' + (u.registro === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  // GH3.30 Bloque 12: mostrar solo transiciones válidas desde el estado actual
  // Previene selección de estados inalcanzables (2,7,8,9 desde PENDIENTE)
  var _allEstados = ConfigService.getFlow
    ? ConfigService.getFlow().concat([StateMachine.states.BACKUP])
    : ['Pendiente','Alistamiento','Programado','En tránsito equipo nuevo',
       'Entregado equipo nuevo','Pendiente recoger equipo anterior',
       'En tránsito equipo anterior','Equipo antiguo recibido',
       'Renovación completada','Pendiente aprobación','Cerrado','BACKUP'];
  var _validNext = (typeof StateMachine !== 'undefined' && u.estado)
    ? (StateMachine.TRANSITIONS[u.estado] || []).concat([u.estado])
    : _allEstados;
  // Si el estado actual no tiene transiciones definidas, mostrar todos
  if (_validNext.length <= 1) _validNext = _allEstados;
  var estados = _validNext.filter(function(s){ return _allEstados.indexOf(s) >= 0; });
  const estadoOpts = estados.map(e => '<option' + (u.estado === e ? ' selected' : '') + '>' + e + '</option>').join('');
  // F3.3 fix: la UI consume EXCLUSIVAMENTE el modelo normalizado (equipoNuevo),
  // nunca los campos planos legacy (u.marca/u.modelo/...) que nunca se completan.
  const eqNvo = u.equipoNuevo || {};
  // F3.6 · Estado de entrega del equipo nuevo desde ConfigService
  const entregaEqNvoOpts = ConfigService.ESTADO_ENTREGA_EQ_NVO
    .map(v => '<option value="' + v + '"' + (u.estado_entrega_equipo_nuevo === v ? ' selected' : '') + '>' + (v || '—') + '</option>').join('');
  const devEstados = ['Pendiente', 'Solicitada', 'En tránsito', 'Recibida en Bodega', 'Reasignado'];
  const devEstadoOpts = '<option value="">—</option>' + devEstados.map(e => '<option' + (u.estado_devolucion === e ? ' selected' : '') + '>' + e + '</option>').join('');
  // F3.2 · Disposición final del equipo anterior — entidad independiente de estado_devolucion
  // (logística de retorno) y de clasificacion_obsolescencia (motor RAEE). Decide el destino
  // final del activo una vez recibido en bodega.
  // F3.5 · Valores desde ConfigService — no hardcodeados en componente UI
  const dispFinalOpts_ = ConfigService.DISPOSICION_FINAL_OPTS;
  const dispFinalOpts = dispFinalOpts_.map(d => '<option value="' + d + '"' + (u.disposicion_final === d ? ' selected' : '') + '>' + (d || '—') + '</option>').join('');
  
  $('modal-body').innerHTML = '<div class="modal-body-inner">' +
'<div class="form-section"><div class="form-section-head">1 · Datos del usuario</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Empresa</label><select class="form-select" id="m-empresa"><option' + (u.empresa === 'HBT' ? ' selected' : '') + '>HBT</option><option' + (u.empresa === 'HGS' ? ' selected' : '') + '>HGS</option></select></div>' +
      '<div class="form-group full"><label class="form-label">Nombre completo</label><input type="text" class="form-input" id="m-nombre" value="' + esc(u.nombre) + '"></div>' +
      '<div class="form-group"><label class="form-label">Cédula</label><input type="text" class="form-input" id="m-cedula" value="' + esc(u.cedula) + '"></div>' +
      '<div class="form-group"><label class="form-label">Usuario (login)</label><input type="text" class="form-input" id="m-usuario" value="' + esc(u.usuario) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Correo corporativo</label><input type="email" class="form-input" id="m-correo" value="' + esc(u.correo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Ciudad</label><input type="text" class="form-input" id="m-ciudad" value="' + esc(u.ciudad) + '"></div>' +
      '<div class="form-group"><label class="form-label">Centro de Costo (CECO)</label><input type="text" class="form-input" id="m-ceco" value="' + esc(u.ceco) + '" placeholder="Ej: S300022"></div>' +
      '<div class="form-group full"><label class="form-label">Proyecto</label><select class="form-select" id="m-proyecto">' + projectOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Cargo</label><input type="text" class="form-input" id="m-cargo" value="' + esc(u.cargo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Gerente directo</label><input type="text" class="form-input" id="m-gerente" value="' + esc(u.gerente) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Registro / Nivel</label><select class="form-select" id="m-registro">' + nivelOpts + '</select></div>' +
    '</div></div>' +
    
    '<div class="form-section"><div class="form-section-head">2 · Equipo anterior</div><div class="form-grid-3">' +
      '<div class="form-group"><label class="form-label">Tipo</label><input type="text" class="form-input" id="m-eq_ant_tipo" value="' + esc(u.eq_ant_tipo) + '" placeholder="PORTATIL / TORRE"></div>' +
      '<div class="form-group"><label class="form-label">Marca</label><input type="text" class="form-input" id="m-eq_ant_marca" value="' + esc(u.eq_ant_marca) + '"></div>' +
      '<div class="form-group"><label class="form-label">Modelo</label><input type="text" class="form-input" id="m-eq_ant_modelo" value="' + esc(u.eq_ant_modelo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Activo Fijo (AF)</label><input type="text" class="form-input" id="m-eq_ant_af" value="' + esc(u.eq_ant_af) + '" placeholder="Código AF"></div>' +
      '<div class="form-group"><label class="form-label">Serial</label><input type="text" class="form-input" id="m-eq_ant_serial" value="' + esc(u.eq_ant_serial) + '"></div>' +
      '<div class="form-group"><label class="form-label">Placa</label><input type="text" class="form-input" id="m-eq_ant_placa" value="' + esc(u.eq_ant_placa) + '"></div>' +
      '<div class="form-group"><label class="form-label">Hostname</label><input type="text" class="form-input" id="m-eq_ant_hostname" value="' + esc(u.eq_ant_hostname) + '"></div>' +
      '<div class="form-group"><label class="form-label">Procesador</label><input type="text" class="form-input" id="m-eq_ant_procesador" value="' + esc(u.eq_ant_procesador) + '"></div>' +
      '<div class="form-group"><label class="form-label">Memoria (RAM)</label><input type="text" class="form-input" id="m-eq_ant_memoria" value="' + esc(u.eq_ant_memoria) + '"></div>' +
      '<div class="form-group"><label class="form-label">Disco duro (ant.)</label><input type="text" class="form-input" id="m-eq_ant_disco" value="' + esc(u.eq_ant_disco) + '"></div>' +
      '<div class="form-group"><label class="form-label">Sistema operativo</label><input type="text" class="form-input" id="m-eq_ant_so" value="' + esc(u.eq_ant_so) + '"></div>' +
    '</div></div>' +
    
    '<div class="form-section"><div class="form-section-head">3 · Obsolescencia y clasificación RAEE</div>' +
      renderObsolescencePanelHTML(u) +
    '</div>' +
    
    '<div class="form-section"><div class="form-section-head">4 · Equipo nuevo asignado</div><div class="form-grid-3">' +
      '<div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="m-eq_nvo_tipo"><option value="">—</option><option' + ((eqNvo.tipo || '').toUpperCase() === 'PORTATIL' ? ' selected' : '') + '>PORTATIL</option><option' + ((eqNvo.tipo || '').toUpperCase() === 'TORRE' ? ' selected' : '') + '>TORRE</option></select></div>' +
      '<div class="form-group"><label class="form-label">Marca</label><input type="text" class="form-input" id="m-eq_nvo_marca" value="' + esc(eqNvo.marca) + '"></div>' +
      '<div class="form-group"><label class="form-label">Modelo</label><input type="text" class="form-input" id="m-eq_nvo_modelo" value="' + esc(eqNvo.modelo) + '"></div>' +
      '<div class="form-group"><label class="form-label">Serial</label><input type="text" class="form-input" id="m-eq_nvo_serial" value="' + esc(eqNvo.serial) + '"></div>' +
      '<div class="form-group"><label class="form-label">Placa</label><input type="text" class="form-input" id="m-eq_nvo_placa" value="' + esc(eqNvo.placa) + '"></div>' +
      '<div class="form-group"><label class="form-label">Hostname</label><input type="text" class="form-input" id="m-eq_nvo_hostname" value="' + esc(eqNvo.hostname) + '"></div>' +
      '<div class="form-group"><label class="form-label">Procesador</label><input type="text" class="form-input" id="m-eq_nvo_procesador" value="' + esc(eqNvo.procesador) + '"></div>' +
      '<div class="form-group"><label class="form-label">Memoria (RAM)</label><input type="text" class="form-input" id="m-eq_nvo_ram" value="' + esc(eqNvo.ram) + '"></div>' +
      '<div class="form-group"><label class="form-label">Disco</label><input type="text" class="form-input" id="m-eq_nvo_disco" value="' + esc(eqNvo.disco) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Dato maestro SAP (AF)</label><input type="text" class="form-input" id="m-eq_nvo_af" value="' + esc(eqNvo.af) + '" placeholder="Código AF / dato maestro SAP"></div>' +
    '</div></div>' +
    
    '<div class="form-section"><div class="form-section-head">5 · Estado y seguimiento</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Técnico asignado</label><select class="form-select" id="m-tecnico">' + '<option value="">— Sin asignar —</option>' + (window.CONFIG.technicians || []).map(function(t){ return '<option value="' + esc(t) + '"' + ((u.tecnico||'').toLowerCase()===t.toLowerCase()?' selected':'') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">Estado proceso REN26</label><select class="form-select" id="m-estado">' + estadoOpts + '</select></div>' +
      // F3.6 · estado_entrega_equipo_nuevo: entidad física independiente del estado del proceso
      '<div class="form-group"><label class="form-label">Estado entrega equipo nuevo</label><select class="form-select" id="m-estado_entrega_equipo_nuevo">' + entregaEqNvoOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Alistamiento</label><input type="text" class="form-input" id="m-alistamiento" value="' + esc(u.alistamiento) + '" placeholder="Notas de alistamiento"></div>' +
      '<div class="form-group"><label class="form-label">Caso envío (mensajería)</label><input type="text" class="form-input" id="m-caso_envio" value="' + esc(u.caso_envio) + '" placeholder="Guía de mensajería"></div>' +
      '<div class="form-group"><label class="form-label">F. Asignación</label><input type="date" class="form-input" id="m-fecha_asignacion" value="' + esc(u.fecha_asignacion) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. Envío</label><input type="date" class="form-input" id="m-fecha_envio" value="' + esc(u.fecha_envio) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. Entrega</label><input type="date" class="form-input" id="m-fecha_entrega" value="' + esc(u.fecha_entrega) + '"></div>' +
      '<div class="form-group full" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;background:var(--bg-subtle);border-radius:var(--r-sm)">' +
        '<div><label class="form-check"><input type="checkbox" id="m-acta_enviada"' + (u.acta_enviada ? ' checked' : '') + '> Acta de entrega enviada</label></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label">F. envío acta</label><input type="date" class="form-input" id="m-fecha_envio_acta" value="' + esc(u.fecha_envio_acta) + '"></div>' +
        '<div><label class="form-check"><input type="checkbox" id="m-acta_firmada"' + (u.acta_firmada ? ' checked' : '') + '> Acta firmada</label></div>' +
        '<div class="form-group"><label class="form-label">URL del acta (SharePoint)</label><input type="url" class="form-input" id="m-acta_entrega_url" value="' + esc(u.acta_entrega_url || '') + '" placeholder="https://app.pandadoc.com/..."></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label">F. firma acta</label><input type="date" class="form-input" id="m-fecha_firma_acta" value="' + esc(u.fecha_firma_acta) + '"></div>' +
      '</div>' +
      '<div style="margin:4px 0">' + (u.acta_entrega_url ? '<a href="' + esc(u.acta_entrega_url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;font-size:12px">Acta de entrega</a>' : '') + '</div>' +
      '<hr style="border:none;border-top:1px dashed var(--border);margin:8px 0">' +
'<div class="form-grid">' +
        '<div class="form-group full" style="display:grid;grid-template-columns:auto 1fr;gap:14px;padding:14px;background:var(--bg-subtle);border-radius:var(--r-sm);align-items:center">' +
          '<div><label class="form-check"><input type="checkbox" id="m-evidencia_adjunta"' + (u.evidencia_adjunta ? ' checked' : '') + '> Evidencia adjunta</label></div>' +
          '<div class="form-group" style="margin:0"><label class="form-label">Nombre del archivo</label><input type="text" class="form-input" id="m-nombre_archivo" value="' + esc(u.nombre_archivo) + '" placeholder="Ej: Acta_Juan_Perez.pdf"></div>' +
    
  
      '<p style="font-size:11.5px;color:var(--text-3);margin-top:8px">En F7 se conectará a SharePoint para upload real del archivo. Por ahora solo se registra el nombre.</p>' +
          '</div></div>' +
'<div class="form-section"><div class="form-section-head">6 · Timeline del proceso</div>' +
      '<div id="m-timeline-container">' + renderTimelineHTML(u) + '</div>' +
    '</div>' +
    
    
'<div class="form-section"><div class="form-section-head">7 · Devolución del equipo anterior</div><div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Estado de devolución</label><select class="form-select" id="m-estado_devolucion">' + devEstadoOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">Disposición final del equipo</label><select class="form-select" id="m-disposicion_final">' + dispFinalOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">F. Solicitud devolución</label><input type="date" class="form-input" id="m-fecha_solicitud_devolucion" value="' + esc(u.fecha_solicitud_devolucion) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. en tránsito</label><input type="date" class="form-input" id="m-fecha_transito" value="' + esc(u.fecha_transito) + '"></div>' +
      '<div class="form-group"><label class="form-label">F. Recepción en Bodega</label><input type="date" class="form-input" id="m-fecha_recepcion_bodega" value="' + esc(u.fecha_recepcion_bodega) + '"></div>' +
      '<div class="form-group full"><label class="form-label">Observaciones generales</label><textarea class="form-textarea" id="m-observaciones" rows="3">' + esc(u.observaciones) + '</textarea></div>' +
      '<p class="full" style="font-size:11px;color:var(--text-3);margin:0">La disposición final queda registrada en auditoría (usuario, fecha, valor anterior/nuevo) al guardar.</p>' +
    '<div class="form-group full" style="margin-top:8px;padding:8px 12px;background:var(--bg-subtle);border-radius:var(--r-sm)">' +
      '<label class="form-check"><input type="checkbox" id="m-lista_recoleccion"' + (u.lista_recoleccion ? ' checked' : '') + '> Equipo agregado a lista de recoleccion</label>' +
    '</div>' +
    '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);padding:8px 0 4px">Evaluacion fisica del equipo</div>' +
    '<div class="form-grid">' +
      '<div class="form-group"><label class="form-label">Bateria</label><select class="form-select" id="m-eval_bateria" onchange="actualizarRecomendacion()"><option value="">--</option><option value="Excelente"' + (u.eval_bateria==='Excelente'?' selected':'') + '>Excelente</option><option value="Bueno"' + (u.eval_bateria==='Bueno'?' selected':'') + '>Bueno</option><option value="Regular"' + (u.eval_bateria==='Regular'?' selected':'') + '>Regular</option><option value="Malo"' + (u.eval_bateria==='Malo'?' selected':'') + '>Malo</option></select></div>' +
      '<div class="form-group"><label class="form-label">Teclado</label><select class="form-select" id="m-eval_teclado" onchange="actualizarRecomendacion()"><option value="">--</option><option value="Excelente"' + (u.eval_teclado==='Excelente'?' selected':'') + '>Excelente</option><option value="Bueno"' + (u.eval_teclado==='Bueno'?' selected':'') + '>Bueno</option><option value="Regular"' + (u.eval_teclado==='Regular'?' selected':'') + '>Regular</option><option value="Malo"' + (u.eval_teclado==='Malo'?' selected':'') + '>Malo</option></select></div>' +
      '<div class="form-group"><label class="form-label">Touchpad</label><select class="form-select" id="m-eval_touchpad" onchange="actualizarRecomendacion()"><option value="">--</option><option value="Excelente"' + (u.eval_touchpad==='Excelente'?' selected':'') + '>Excelente</option><option value="Bueno"' + (u.eval_touchpad==='Bueno'?' selected':'') + '>Bueno</option><option value="Regular"' + (u.eval_touchpad==='Regular'?' selected':'') + '>Regular</option><option value="Malo"' + (u.eval_touchpad==='Malo'?' selected':'') + '>Malo</option></select></div>' +
      '<div class="form-group"><label class="form-label">Estetico</label><select class="form-select" id="m-eval_estetico" onchange="actualizarRecomendacion()"><option value="">--</option><option value="Excelente"' + (u.eval_estetico==='Excelente'?' selected':'') + '>Excelente</option><option value="Bueno"' + (u.eval_estetico==='Bueno'?' selected':'') + '>Bueno</option><option value="Regular"' + (u.eval_estetico==='Regular'?' selected':'') + '>Regular</option><option value="Malo"' + (u.eval_estetico==='Malo'?' selected':'') + '>Malo</option></select></div>' +
    '</div>' +
    '<div id="m-recomendacion-display" style="margin-top:8px;padding:8px 14px;border-radius:var(--r-sm);background:#E8F5E9;color:#2E7D32;font-size:12px;font-weight:700;display:none"></div>' +
    '<div id="m-motivo-raee-display" style="margin-top:4px;padding:4px 14px;font-size:11px;color:#777;display:none"></div>' +
    '</div></div></div>'; /* GH3.38 FC-03 */
  
// Inicializar estrellas
  const fbWidget = $('m-feedback-stars');
  if (fbWidget) {
    const init = parseInt(fbWidget.dataset.value || '0');
    fbWidget.querySelectorAll('.star').forEach(s => {
      const n = parseInt(s.dataset.star);
      s.classList.toggle('active', n <= init);
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
      // GH3.37.1 Item 8: actualizar KPIs y Panel Ejecutivo sin cerrar el modal
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
  var colors = { 'RAEE': { bg: '#FFEBEE', fg: '#C00000' }, 'Donacion': { bg: '#FFF3E0', fg: '#E65100' },
    'Venta interna': { bg: '#E8F5E9', fg: '#2E7D32' }, 'Reasignacion': { bg: '#E3F2FD', fg: '#1565C0' } };
  var c = colors[resultado.recomendacion] || { bg: '#F5F5F5', fg: '#555' };
  disp.textContent = 'Recomendacion: ' + resultado.recomendacion;
  disp.style.display = ''; disp.style.background = c.bg; disp.style.color = c.fg;
  if (motdisp) { motdisp.textContent = resultado.motivo; motdisp.style.display = ''; }
  var tlc = document.getElementById('m-timeline-container');
  if (tlc && _currentRecord) {
    var tmpR = Object.assign({}, _currentRecord, { recomendacion_raee: resultado.recomendacion, motivo_raee: resultado.motivo });
    tlc.innerHTML = renderTimelineHTML(tmpR);
  }
};
  // Llamar una vez si hay datos iniciales
  window.actualizarRecomendacion();

  $('modal-bg').classList.add('active');
}

// GH3.37.1 Item 11 — Indicador visual de sincronización con Excel
function _showSyncStatus(status) {
  var indicator = document.getElementById('sync-status-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'sync-status-indicator';
    indicator.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;z-index:9999;transition:opacity 0.4s;opacity:0';
    document.body.appendChild(indicator);
  }
  if (status === 'ok') {
    indicator.textContent = '✓ Sincronizado con Excel';
    indicator.style.background = '#2E7D32';
    indicator.style.color = '#fff';
  } else if (status === 'conflict') {
    indicator.textContent = '⚠ Conflicto · Recargando...';
    indicator.style.background = '#F57F17';
    indicator.style.color = '#fff';
  }
  indicator.style.opacity = '1';
  setTimeout(function(){ indicator.style.opacity = '0'; }, 3000);
}
window._showSyncStatus = _showSyncStatus;

window.openEditModal = openEditModal;

function setStarRating(value) {
  const widget = $('m-feedback-stars');
  if (!widget) return;
  widget.dataset.value = value;
  widget.querySelectorAll('.star').forEach(s => {
    const n = parseInt(s.dataset.star);
    s.classList.toggle('active', n <= value);
  });
  const label = $('m-feedback-label');
  if (label) label.textContent = value > 0 ? value + ' / 5' : 'Sin encuesta';
}
window.setStarRating = setStarRating;

function closeModal() { $('modal-bg').classList.remove('active'); state.editingId = null; }
window.closeModal = closeModal;

function saveRecord() {
  const id = state.editingId;
  if (id == null) return;
  const u = DataService.getRenewal(id);
  if (!u) return;
  
  // Snapshot del estado anterior para detectar cambios
  const before = {
    estado: u.estado, estado_entrega_equipo_nuevo: u.estado_entrega_equipo_nuevo,
    acta_firmada: u.acta_firmada,
    recibido_bodega: u.recibido_bodega, equipo_reasignable: u.equipo_reasignable,
    nombre: u.nombre,
  };
  
  // Construir objeto de cambios desde el formulario
  const fields = [
    'empresa','nombre','cedula','usuario','correo','ciudad','ceco','proyecto','cargo','gerente','registro',
    'eq_ant_tipo','eq_ant_marca','eq_ant_modelo','eq_ant_serial','eq_ant_af','eq_ant_placa','eq_ant_hostname','eq_ant_procesador','eq_ant_memoria','eq_ant_so',
    'eq_nvo_tipo','eq_nvo_marca','eq_nvo_modelo','eq_nvo_serial','eq_nvo_af','eq_nvo_placa','eq_nvo_hostname','eq_nvo_procesador','eq_nvo_ram','eq_nvo_disco',
    'tecnico','estado','estado_entrega_equipo_nuevo','alistamiento','caso_envio','fecha_asignacion','fecha_envio','fecha_entrega','fecha_envio_acta','fecha_firma_acta',
    'estado_devolucion','disposicion_final','fecha_solicitud_devolucion','fecha_transito','fecha_recepcion_bodega','observaciones',
    // GH3.28: campos evaluación física y motor RAEE
    'lista_recoleccion','eval_bateria','eval_teclado','eval_touchpad','eval_estetico'
    // GH3.29: USUARIO_EVALUACION_RAEE se asigna automáticamente en el bloque RAEEEngine de saveRecord
  ];
  const changes = {};
  fields.forEach(f => {
    const el = $('m-' + f);
    if (!el) return;
    const val = el.value;
    // GH3.24: Para 'tecnico', si el select quedó vacío (sin selección)
    // mantener el valor original del registro — nunca sobrescribir con ''
    if (f === 'tecnico' && val === '') {
      changes[f] = u.tecnico || '';
    } else {
      changes[f] = val;
    }
  });
  changes.acta_enviada    = $('m-acta_enviada').checked;
  changes.acta_firmada    = $('m-acta_firmada').checked;
  changes.acta_entrega_url = ($('m-acta_entrega_url') ? $('m-acta_entrega_url').value.trim() : '') || '';
  // F3.6 · recibido_bodega y equipo_reasignable se derivan de los selects
  // (única fuente de verdad — no son checkboxes manuales)
  changes.recibido_bodega    = changes.estado_devolucion === 'Recibida en Bodega';
  changes.equipo_reasignable = changes.disposicion_final === 'Reasignación interna';
  changes.equipo_devuelto    = changes.recibido_bodega;
  const fbStars = $('m-feedback-stars');
  changes.feedback = fbStars ? parseInt(fbStars.dataset.value || '0') : 0;
  changes.es_backup = changes.estado === 'BACKUP';
  
  // Persistir vía DataService (registra auditoría automáticamente)
  try {
    // GH3.28: Si hay evaluación física completa, calcular con RAEEEngine y agregar a changes
    if (changes.eval_bateria && changes.eval_teclado && changes.eval_touchpad && changes.eval_estetico) {
      if (typeof RAEEEngine !== 'undefined') {
        var _raeeResult = RAEEEngine.calcular(
          changes.eval_bateria, changes.eval_teclado,
          changes.eval_touchpad, changes.eval_estetico
        );
        if (_raeeResult) {
          changes.recomendacion_raee    = _raeeResult.recomendacion;
          changes.motivo_raee           = _raeeResult.motivo;
          changes.motor_raee_version    = _raeeResult.version;
          changes.fecha_evaluacion_raee = _raeeResult.fechaEvaluacion;
          // GH3.29: auditoría del evaluador
          changes.usuario_evaluacion_raee = (state.user && state.user.name) || (state.user && state.user.id) || 'sistema';
        }
      }
    }
    DataService.updateRenewal(id, changes, state.user);
    // MVP P5 · Escribir al Excel Maestro (async, no bloquea la UI)
    if (DataService.syncToProvider) {
      // GH3.25 P2: Después de escribir → recargar desde Excel → re-render
      DataService.syncToProvider(id, changes)
        .then(function() {
          // Recarga desde el workbook real (no reutilizar objeto local)
          if (DataService.reloadFromProvider) {
            return DataService.reloadFromProvider().then(function(ok) {
              if (ok) {
                // Re-render vista actual desde datos frescos
                if (state.view === 'usuarios') renderUsuarios();
                else if (state.view === 'reportes') renderReportes();
                else renderResumen();
                // GH3.37.1 Item 11: confirmación visual
                toast('✓ Guardado · Sincronizado con Excel', 'success');
                if (window._showSyncStatus) _showSyncStatus('ok');
              }
            });
          }
        })
        .catch(function(err) {
          if (err && err.graphCode === 'CONFLICT') {
            // GH3.37.1 Item 11: recargar automáticamente en conflicto
            DataService.reloadFromProvider && DataService.reloadFromProvider();
            toast('Conflicto detectado. Recargando datos...', 'warning');
          } else {
            console.error('[SYNC ERROR]', err && err.message);
          }
        });
    }
  } catch(e) {
    console.error('[saveRecord]', e);
    toast('Error al guardar: ' + e.message, 'critical');
    return;
  }
  
  // Highlight de fila recientemente actualizada
  state.recentlyUpdatedId = u.id;
  setTimeout(() => { state.recentlyUpdatedId = null; if (state.view === 'usuarios') renderUsuarios(); }, 3500);
  
  closeModal();
  
  // ═══ DETECTAR Y NOTIFICAR CAMBIOS RELEVANTES ═══
  const userLabel = u.nombre || ('ID ' + u.id);
  
  if (before.estado !== u.estado) {
    const level = (u.estado === 'Entregado' || u.estado === 'Completado') ? 'warning' : 'info';
    notify({
      level: level, category: 'state',
      title: 'Cambio de estado',
      message: userLabel + ': ' + before.estado + ' → ' + u.estado,
      recordId: u.id,
    });
  }
  if (!before.acta_firmada && u.acta_firmada) {
    notify({
      level: 'info', category: 'acta',
      title: 'Acta firmada',
      message: userLabel + ' firmó el acta de entrega (PandaDoc)',
      recordId: u.id,
    });
  }
  if (!before.recibido_bodega && u.recibido_bodega) {
    notify({
      level: 'info', category: 'bodega',
      title: 'Equipo recibido en bodega',
      message: 'Equipo anterior de ' + userLabel + ' recibido físicamente',
      recordId: u.id,
    });
  }
  // Si no hubo eventos específicos, notificar como edición genérica
  if (before.estado === u.estado && before.acta_firmada === u.acta_firmada && before.recibido_bodega === u.recibido_bodega) {
    notify({
      level: 'info', category: 'edit',
      title: 'Registro actualizado',
      message: userLabel + ' · cambios guardados',
      recordId: u.id,
    });
  }
  
  renderView(state.view);
  if (state.view !== 'resumen') renderResumen();
}
window.saveRecord = saveRecord;

// GH3.27 CAMBIO 6: Diálogo de confirmación de guardado
window.confirmarGuardado = function() {
  // GH3.28: validar evaluacion fisica si se llenaron campos parcialmente
  var bat = ($('m-eval_bateria')  || {}).value || '';
  var tec = ($('m-eval_teclado')  || {}).value || '';
  var tou = ($('m-eval_touchpad') || {}).value || '';
  var est = ($('m-eval_estetico') || {}).value || '';
  if ((bat || tec || tou || est) && typeof RAEEEngine !== 'undefined') {
    var val = RAEEEngine.validar(bat, tec, tou, est);
    if (!val.ok) {
      alert('Evaluacion fisica incompleta. Por favor complete: ' + val.faltante.join(', '));
      return;
    }
  }

  var dlg = document.getElementById('confirm-dialog');
  var sum = document.getElementById('confirm-summary');
  if (!dlg || !sum) { saveRecord(); return; }

  // Leer valores del modal
  var estadoEl = $('m-estado');
  var tecnicoEl = $('m-tecnico');
  var recomEl = document.getElementById('m-recomendacion-display');

  var lines = [];
  if (estadoEl)   lines.push('<b>Estado:</b> ' + (estadoEl.value || '—'));
  if (tecnicoEl)  lines.push('<b>Tecnico:</b> ' + (tecnicoEl.value || '—'));
  if (recomEl && recomEl.style.display !== 'none')
    lines.push('<b>' + recomEl.textContent + '</b>');

  sum.innerHTML = lines.join('<br>') + '<br><br>¿Confirma que desea guardar estos cambios?';
  dlg.style.display = 'flex';
};

window.cancelarGuardado = function() {
  var dlg = document.getElementById('confirm-dialog');
  if (dlg) dlg.style.display = 'none';
};

window.ejecutarGuardado = function() {
  cancelarGuardado();
  saveRecord();
};


function openCreateModal() {
  // F7.0.1 · DataService.createRenewal calcula maxId internamente — no leer window.USERS directo
  const allForMax = DataService.getRenewals({});
  const maxId = allForMax.length > 0 ? Math.max.apply(null, allForMax.map(u => u.id)) : 0;
  const newRec = {
    id: maxId + 1, es_backup: false,
    empresa: 'HBT', perfil: '', nombre: '', cedula: '', usuario: '', correo: '',
    ciudad: '', ceco: '', proyecto: '', cargo: '', gerente: '', nivel: '',
    eq_ant_tipo: '', eq_ant_marca: '', eq_ant_modelo: '', eq_ant_serial: '',
    eq_ant_placa: '', eq_ant_hostname: '', eq_ant_procesador: '', eq_ant_memoria: '',
    eq_ant_so: '', eq_ant_clasificacion: '',
    tipo: 'PORTATIL', marca: '', modelo: '', serial: '', placa: '', hostname: '',
    procesador: '', ram: '', disco: '', dato_maestro: 'Pendiente', nombre_sap: '',
    tecnico: '', estado: 'Pendiente', alistamiento: '', caso_envio: '',
    fecha_asignacion: '', fecha_envio: '', fecha_entrega: '',
    acta_enviada: false, fecha_envio_acta: '', acta_firmada: false, fecha_firma_acta: '',
    feedback: 0,
    estado_devolucion: '', fecha_solicitud_devolucion: '', fecha_transito: '',
    fecha_recepcion_bodega: '', recibido_bodega: false, equipo_reasignable: false,
    equipo_devuelto: false, fecha_devolucion: '',
    observaciones: '',
  };
  // Usar DataService.createRenewal (registra auditoría)
  let created;
  try {
    created = DataService.createRenewal(newRec, state.user);
  } catch(e) {
    toast('Error al crear: ' + e.message, 'warning');
    return;
  }
  notify({ level: 'info', category: 'create', title: 'Registro creado', message: 'Nuevo equipo agregado (ID ' + created.id + ')', recordId: created.id });
  openEditModal(created.id);
}
window.openCreateModal = openCreateModal;

// ═══ BOOT ═══
// ═══════════════════════════════════════════════════════════════════
// F7.1 · F7_resolveRole — resolutor de roles para Azure AD
// Mapea username/email de Azure AD → role interno canónico.
// Es la única fuente de verdad para la resolución de roles en modo MSAL.
// Fuente: window.SYSTEM_USERS (usuarios_sistema.json) normalizado por DataMapper.
// ═══════════════════════════════════════════════════════════════════
function F7_resolveRole(username) {
  if (!username) return 'visitante';

  // Normalizar: acepta email completo o solo el prefijo de usuario
  const lower = String(username).trim().toLowerCase();

  // 1. Buscar en SYSTEM_USERS por email exacto
  const byEmail = (window.SYSTEM_USERS || []).find(u =>
    u.correo && u.correo.toLowerCase() === lower
  );
  if (byEmail) return DataMapper.toInternalRole(byEmail.rol);

  // 2. Buscar por prefijo de email (parte antes del @)
  const prefix = lower.split('@')[0];
  const byPrefix = (window.SYSTEM_USERS || []).find(u => {
    const userPrefix = (u.correo || '').toLowerCase().split('@')[0];
    return userPrefix === prefix;
  });
  if (byPrefix) return DataMapper.toInternalRole(byPrefix.rol);

  // 3. Buscar por nombre (case-insensitive)
  const byName = (window.SYSTEM_USERS || []).find(u =>
    u.nombre && u.nombre.toLowerCase().includes(prefix)
  );
  if (byName) return DataMapper.toInternalRole(byName.rol);

  // 4. Fallback: visitante (mínimo privilegio)

  return 'visitante';
}
window.F7_resolveRole = F7_resolveRole;

// ═══════════════════════════════════════════════════════════════════
// F7.1 · SessionManager
// Mantiene la sesión del dashboard: quién está logueado, cuándo,
// con qué rol y permisos. Completamente independiente de Graph.
// ═══════════════════════════════════════════════════════════════════

