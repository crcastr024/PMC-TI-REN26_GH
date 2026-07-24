// ════════════════════════════════════════════════════════════════════
// js/dashboard.js — PMC-TI-REN26 GH1
// KPIService, IntegrityService, DashboardFactory y todas las funciones de render
// Requisito: config.js + msal-browser.min.js deben cargarse antes.
// ════════════════════════════════════════════════════════════════════



// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// STAB-v09.1 TASK 1 — buildDashboardStats(users)
// ÚNICA fuente de verdad para todos los KPIs del sistema.
// Todos los renderers consumen este objeto.
// ════════════════════════════════════════════════════════════════════
function buildDashboardStats(users) {
  var all     = users || window.USERS || [];
  var backups = all.filter(function(u){ return isBackup(u); });
  var activos = all.filter(function(u){ return !isBackup(u); });

  // TASK 3 — estados canónicos de proceso (sin Pendiente, sin Completado/Cancelado)
  var PROC_ST = ['Alistamiento','Programado','En tránsito equipo nuevo',
    'Entregado equipo nuevo','Pendiente devolución equipo anterior',
    'En tránsito equipo anterior','Equipo anterior recibido',
    'Pendiente aprobación','Cerrado'];
  // Estados que significan "ya entregado" (hito acumulativo — no disminuye)
  var ENTREGADO_ST = ['Entregado equipo nuevo','Pendiente devolución equipo anterior',
    'En tránsito equipo anterior','Equipo anterior recibido',
    'Renovación completada','Pendiente aprobación','Cerrado',
    'Entregado','Completado'];

  var pendientes   = activos.filter(function(u){ return u.estado === 'Pendiente'; }).length;
  var proceso      = activos.filter(function(u){ return PROC_ST.indexOf(u.estado) >= 0; }).length;
  var entregados   = activos.filter(function(u){
    return u.fecha_entrega || ENTREGADO_ST.indexOf(u.estado) >= 0;
  }).length;
  var actas        = activos.filter(function(u){ return !!u.fecha_firma_acta; }).length;
  // GH3.42.5 FIX BUG REP-05: criterio unificado con setReport('finalizados')
  // Los 3 estados son terminales: Renovación completada, Cerrado, Finalizado
  var finalizados  = activos.filter(function(u){
    return u.estado === 'Renovación completada' || u.estado === 'Cerrado' || u.estado === 'Finalizado' || u.estado === 'Completado';
  }).length;
  var devoluciones = activos.filter(function(u){ return !!u.fecha_solicitud_devolucion; }).length;
  // STAB-v10.1 P1: nuevos KPIs operativos
  var enEnvio = activos.filter(function(u){ return u.estado === 'Programado' || u.estado === 'En tránsito equipo nuevo'; }).length;
  // GH3.42.9: nuevo KPI Pendiente acta (estado intermedio antes de Renovación completada)
  var pendienteActa = activos.filter(function(u){ return u.estado === 'Pendiente acta'; }).length;
  var devolucionesPendientes = activos.filter(function(u){ return (u.lista_recoleccion || !!u.fecha_solicitud_devolucion) && !u.fecha_recepcion_bodega; }).length;
  var raee         = activos.filter(function(u){ return u.recomendacion_raee === 'RAEE'; }).length;
  var reasignables = activos.filter(function(u){
    return u.recomendacion_raee === 'Reasignable' || u.recomendacion_raee === 'Reasignación interna';
  }).length;

  // Por empresa — breakdown completo (TASK 4)
  // ════════════════════════════════════════════════════════
  // STAB-v12.1: porEmpresa — objeto canónico único
  // operativos + backup = total  (invariante garantizado)
  // ════════════════════════════════════════════════════════
  var porEmpresa = {};
  ['HBT','HGS'].forEach(function(emp) {
    var euAll = all.filter(function(u){ return u.empresa === emp; });      // todos (87)
    var euOp  = activos.filter(function(u){ return u.empresa === emp; }); // activos (84)
    var euBk  = backups.filter(function(u){ return u.empresa === emp; }); // backup (3)
    var ent   = euOp.filter(function(u){ return u.fecha_entrega || ENTREGADO_ST.indexOf(u.estado) >= 0; });
    var fin   = euOp.filter(function(u){
      return u.estado === 'Renovación completada' || u.estado === 'Cerrado' || u.estado === 'Finalizado' || u.estado === 'Completado';
    });
    porEmpresa[emp] = {
      total:      euAll.length,  // invariante: operativos + backup
      operativos: euOp.length,   // solo activos (sin backup)
      backup:     euBk.length,   // solo backup
      pendientes: euOp.filter(function(u){ return u.estado === 'Pendiente'; }).length,
      proceso:    euOp.filter(function(u){ return PROC_ST.indexOf(u.estado) >= 0; }).length,
      envio:      euOp.filter(function(u){ return u.estado === 'Programado' || u.estado === 'En tránsito equipo nuevo'; }).length,
      entregados: ent.length,
      actas:      euOp.filter(function(u){ return !!u.fecha_firma_acta; }).length,
      cerrados:   fin.length,
      pct:        euOp.length ? Math.round(ent.length / euOp.length * 100) : 0,
    };
  });

  // Por tipo de equipo — GH3.42.20: nuevo breakdown (Torres/Portátiles)
  // Mismo patrón que porEmpresa. u.tipo ya viene normalizado (dataService.js:
  // fallback a eq_nvo_tipo si tipo no viene directo).
  var porTipo = {};
  ['PORTATIL','TORRE'].forEach(function(tipo) {
    var tAll = all.filter(function(u){ return (u.tipo||'').toUpperCase() === tipo; });
    var tOp  = activos.filter(function(u){ return (u.tipo||'').toUpperCase() === tipo; });
    var tBk  = backups.filter(function(u){ return (u.tipo||'').toUpperCase() === tipo; });
    var tEnt = tOp.filter(function(u){ return u.fecha_entrega || ENTREGADO_ST.indexOf(u.estado) >= 0; });
    porTipo[tipo] = {
      total:      tAll.length,
      operativos: tOp.length,
      backup:     tBk.length,
      entregados: tEnt.length,
      pct:        tOp.length ? Math.round(tEnt.length / tOp.length * 100) : 0,
    };
  });

  var porTecnico = {};
  activos.forEach(function(u) {
    var t = u.tecnico || 'Sin asignar';
    if (!porTecnico[t]) porTecnico[t] = { asignados:0, pendientes:0, proceso:0, enEnvio:0, entregados:0, actas:0, finalizados:0, pct:0 };
    var d = porTecnico[t];
    d.asignados++;
    if (u.estado === 'Pendiente') d.pendientes++;
    if (u.estado === 'Programado' || u.estado === 'En tránsito equipo nuevo') d.enEnvio++;
    if (PROC_ST.indexOf(u.estado) >= 0) d.proceso++;
    if (u.fecha_entrega || ENTREGADO_ST.indexOf(u.estado) >= 0) d.entregados++;
    if (!!u.fecha_firma_acta) d.actas++;
    if (u.estado === 'Renovación completada' || u.estado === 'Cerrado' || u.estado === 'Finalizado' || u.estado === 'Completado') d.finalizados++;
  });
  Object.keys(porTecnico).forEach(function(t) {
    var d = porTecnico[t];
    d.pct = d.asignados ? Math.round(d.entregados / d.asignados * 100) : 0;
  });

  // Por ciudad
  var porCiudad = {};
  activos.forEach(function(u) {
    var c = (window.CityNormalizer ? CityNormalizer.normalize(u.ciudad) : (u.ciudad||'Sin ciudad')).trim()||'Sin ciudad';
    porCiudad[c] = (porCiudad[c] || 0) + 1;
  });

  // Distribución de estados (TASK 7)
  var estados = {};
  activos.forEach(function(u) {
    var st = u.estado || 'Sin estado';
    estados[st] = (estados[st] || 0) + 1;
  });

  // STAB-v12 TASK 08: campos extendidos para Reporte Ejecutivo
  // Calidad de datos
  var calidad = {
    sinTecnico:  activos.filter(function(u){ return !u.tecnico; }).length,
    sinCiudad:   activos.filter(function(u){ return !u.ciudad; }).length,
    sinEmpresa:  activos.filter(function(u){ return !u.empresa; }).length,
    sinSerial:   activos.filter(function(u){ return !u.eq_ant_serial && !u.eq_nvo_serial; }).length,
    sinAF:       activos.filter(function(u){ return !u.eq_nvo_af && !u.eq_ant_af; }).length,
    sinActa:     activos.filter(function(u){ return !u.fecha_firma_acta; }).length,
    sinEnvio:    activos.filter(function(u){ return !u.programado && !u.fecha_entrega; }).length,
    total:       activos.length,
  };
  // Pipeline (estados en orden del flujo)
  var PIPELINE_ORDER = ['Pendiente','Alistamiento','Programado','En tránsito equipo nuevo',
    'Entregado equipo nuevo','Pendiente devolución equipo anterior','En tránsito equipo anterior',
    'Equipo anterior recibido','Pendiente aprobación','Renovación completada','Cerrado'];
  var pipelineRaw = {};
  activos.forEach(function(u){ var s=u.estado||'Sin estado'; pipelineRaw[s]=(pipelineRaw[s]||0)+1; });
  var pipeline = PIPELINE_ORDER.map(function(s){ return { estado:s, count:pipelineRaw[s]||0 }; });
  // Encontrar cuello de botella (estado con mayor acumulación en proceso)
  var bottle = pipeline.slice(1,-2).reduce(function(a,b){ return b.count > a.count ? b : a; }, pipeline[0]);
  // Riesgos ejecutivos
  var riesgos = {
    sinMovimiento:        activos.filter(function(u){ return u.estado === 'Pendiente'; }).length,
    pendienteAprobacion:  activos.filter(function(u){ return u.estado === 'Pendiente aprobación'; }).length,
    pendienteDevolucion:  activos.filter(function(u){ return u.lista_recoleccion && !u.fecha_recepcion_bodega; }).length,
    registrosIncompletos: activos.filter(function(u){ return !u.tecnico || !u.ciudad || !u.empresa; }).length,
  };
  // Aprobaciones
  var aprobaciones = {
    pendientes:  activos.filter(function(u){ return u.estado === 'Pendiente aprobación'; }).length,
    completadas: activos.filter(function(u){ return u.estado === 'Renovación completada' || u.estado === 'Cerrado' || u.estado === 'Finalizado' || u.estado === 'Completado'; }).length,
    rechazadas:  0, // depende de ApprovalService
  };

  // Distribución RAEE (TASK 6)
  var raeeDistrib = {};
  activos.forEach(function(u) {
    if (u.recomendacion_raee) {
      raeeDistrib[u.recomendacion_raee] = (raeeDistrib[u.recomendacion_raee] || 0) + 1;
    }
  });

  // hbt/hgs cuentan TODOS (incluyendo backup) — compatible con calculateProjectMetrics original
  // STAB-v12.1: aliases derivados de porEmpresa (fuente canónica)
  var hbt   = porEmpresa['HBT'] ? porEmpresa['HBT'].total      : 0;
  var hgs   = porEmpresa['HGS'] ? porEmpresa['HGS'].total      : 0;
  var hbtOp = porEmpresa['HBT'] ? porEmpresa['HBT'].operativos : 0;
  var hgsOp = porEmpresa['HGS'] ? porEmpresa['HGS'].operativos : 0;
  var hbtBk = porEmpresa['HBT'] ? porEmpresa['HBT'].backup     : 0;
  var hgsBk = porEmpresa['HGS'] ? porEmpresa['HGS'].backup     : 0;

  return {
    // Totales
    total:              activos.length,
    totalEquipos:       all.length,
    totalColaboradores: activos.length,
    totalBackups:       backups.length,
    hbt: hbt, hgs: hgs,
    hbtOperativos: hbtOp, hgsOperativos: hgsOp, // STAB-v10: solo activos
    hbtBackup:     hbtBk, hgsBackup:     hgsBk,  // STAB-v10: solo backup
    // KPIs por hito
    pendientes:   pendientes,
    proceso:      proceso,
    enProceso:    proceso,         // alias backward compat
    entregados:   entregados,
    actas:        actas,
    finalizados:  finalizados,
    backup:       backups.length,
    devoluciones: devoluciones,
    enEnvio: enEnvio,                           // P1: Programado + En tránsito equipo nuevo
    pendienteActa: pendienteActa,               // GH3.42.9: nuevo KPI Pendiente acta
    devolucionesPendientes: devolucionesPendientes, // P1: en lista recolección sin recibir
    raee:         raee,
    reasignables: reasignables,
    // Breakdowns
    porEmpresa:   porEmpresa,
    porTipo:      porTipo,       // GH3.42.20: Torres/Portátiles
    porTecnico:   porTecnico,
    porCiudad:    porCiudad,
    estados:      estados,
    raeeDistrib:  raeeDistrib,
    // STAB-v12 T08: campos extendidos
    calidad:      calidad,
    pipeline:     pipeline,
    cueloBotella: bottle,
    riesgos:      riesgos,
    aprobaciones: aprobaciones,
    // STAB-v15 TASK 07: cruces de empresa (activo ≠ empresa usuario)
    novedades: (window.CompanyMismatchService ? CompanyMismatchService.detectMismatch(all) : []),

    // ═══ GH3.42 — Métricas ejecutivas ═══════════════════════════════════
    proyecto:      _computeProyecto(activos, all),
    gauge:         _computeGauge(activos, entregados),
    productividad: _computeProductividad(activos, entregados),
    burnDown:      _computeBurnDown(activos),
    proyeccion:    _computeProyeccion(activos, entregados),
    porCiudadDetalle: _computePorCiudad(activos),
    destinoFinal:  _computeDestinoFinal(activos),
    // KPIs acumulativos por hito (para ejecutivo)
    kpisAcumulativos: {
      entregados:  entregados,   // ya es acumulativo (fecha_entrega || ENTREGADO_ST)
      actas:       actas,        // ya es acumulativo (fecha_firma_acta)
      finalizados: finalizados,  // Renovación completada + Cerrado
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// GH3.42 — Helpers de cálculo ejecutivo
// Constantes del proyecto REN26 (01/07/2026 → 15/08/2026)
// ═════════════════════════════════════════════════════════════════════
var REN26_INICIO = new Date('2026-07-01T00:00:00');
var REN26_FIN    = new Date('2026-08-15T23:59:59');
var REN26_META   = 146;

function _computeProyecto(activos, all) {
  var hoy         = new Date();
  var diasTotal   = Math.ceil((REN26_FIN - REN26_INICIO) / 86400000);
  var diasTrans   = Math.max(0, Math.min(diasTotal, Math.floor((hoy - REN26_INICIO) / 86400000)));
  var diasRest    = Math.max(0, diasTotal - diasTrans);
  var pctTiempo   = diasTotal > 0 ? Math.round(diasTrans / diasTotal * 100) : 0;
  // Semáforo por desviación
  var totalOp     = activos.length || 1;
  var entOp       = activos.filter(function(u){ return u.fecha_entrega || _hitoEntregado(u.estado); }).length;
  var pctReal     = Math.round(entOp / totalOp * 100);
  var desv        = pctReal - pctTiempo;
  var semaforo    = desv >= -5 ? 'verde' : desv >= -15 ? 'amarillo' : 'rojo';
  return {
    inicio:         REN26_INICIO,
    fin:            REN26_FIN,
    hoy:            hoy,
    diasTotal:      diasTotal,
    diasTranscurridos: diasTrans,
    diasRestantes:  diasRest,
    pctTiempo:      pctTiempo,
    pctReal:        pctReal,
    semaforo:       semaforo,
    inicioTxt:      _fmtDateShort(REN26_INICIO),
    finTxt:         _fmtDateShort(REN26_FIN),
    hoyTxt:         _fmtDateShort(hoy),
  };
}

function _hitoEntregado(estado) {
  return ['Entregado equipo nuevo','Pendiente devolución equipo anterior',
          'En tránsito equipo anterior','Equipo anterior recibido',
          'Renovación completada','Pendiente aprobación','Cerrado',
          'Entregado','Completado'].indexOf(estado) >= 0;
}

function _computeGauge(activos, entregados) {
  var hoy = new Date();
  var diasTotal = Math.ceil((REN26_FIN - REN26_INICIO) / 86400000);
  var diasTrans = Math.max(0, Math.min(diasTotal, Math.floor((hoy - REN26_INICIO) / 86400000)));
  var esperado = diasTotal > 0 ? Math.round(diasTrans / diasTotal * 100) : 0;
  var totalOp  = activos.length || 1;
  var real     = Math.round(entregados / totalOp * 100);
  var desv     = real - esperado;
  var estado   = desv >= -5 ? 'ok' : desv >= -15 ? 'warn' : 'critical';
  return {
    esperado:   esperado,
    real:       real,
    desviacion: desv,
    estado:     estado
  };
}

function _computeProductividad(activos, entregados) {
  var hoy = new Date();
  var diasTotal = Math.ceil((REN26_FIN - REN26_INICIO) / 86400000);
  var diasTrans = Math.max(1, Math.min(diasTotal, Math.floor((hoy - REN26_INICIO) / 86400000)));
  var diasRest  = Math.max(1, diasTotal - diasTrans);
  var totalOp   = activos.length || 1;
  var restantes = Math.max(0, totalOp - entregados);
  var promedioGlobal  = +(entregados / diasTrans).toFixed(2);
  // Promedio semanal: mismos entregados / semanas (aproximación conservadora)
  var semanas         = Math.max(1, diasTrans / 7);
  var promedioSemanal = +(entregados / semanas).toFixed(1);
  var ritmoNecesario  = +(restantes / diasRest).toFixed(2);
  // Entregados por día (histograma últimos 14 días)
  var histograma = _histogramaEntregas(activos, 14);
  return {
    equiposRestantes:  restantes,
    entregadosHoy:     histograma.length ? histograma[histograma.length - 1].count : 0,
    promedioGlobal:    promedioGlobal,
    promedioSemanal:   promedioSemanal,
    ritmoNecesario:    ritmoNecesario,
    histograma:        histograma,
    velocidadOK:       promedioGlobal >= ritmoNecesario,
  };
}

function _histogramaEntregas(activos, dias) {
  var out = [];
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  for (var i = dias - 1; i >= 0; i--) {
    var d = new Date(hoy); d.setDate(d.getDate() - i);
    var dNext = new Date(d); dNext.setDate(dNext.getDate() + 1);
    var c = activos.filter(function(u) {
      if (!u.fecha_entrega) return false;
      var fe = new Date(u.fecha_entrega);
      return fe >= d && fe < dNext;
    }).length;
    out.push({ fecha: _fmtDateShort(d), count: c });
  }
  return out;
}

function _computeBurnDown(activos) {
  // Serie temporal semanal: 01 Jul → 15 Ago
  var meta       = REN26_META;
  var diasTotal  = Math.ceil((REN26_FIN - REN26_INICIO) / 86400000);
  var hoy        = new Date(); hoy.setHours(23,59,59,999);
  var puntos     = [];
  var step       = 3; // cada 3 días
  for (var d = 0; d <= diasTotal; d += step) {
    var fecha    = new Date(REN26_INICIO); fecha.setDate(fecha.getDate() + d);
    var esperadoEntregados = Math.round(meta * (d / diasTotal));
    var esperadoRest       = meta - esperadoEntregados;
    var realRest = null;
    if (fecha <= hoy) {
      var entregadosHastaFecha = activos.filter(function(u) {
        if (!u.fecha_entrega && !_hitoEntregado(u.estado)) return false;
        if (!u.fecha_entrega) return true; // si hito pero sin fecha, contar hasta hoy
        return new Date(u.fecha_entrega) <= fecha;
      }).length;
      realRest = meta - entregadosHastaFecha;
    }
    puntos.push({
      fecha:        _fmtDateShort(fecha),
      esperado:     esperadoRest,
      real:         realRest,
      esFuturo:     fecha > hoy
    });
  }
  return puntos;
}

function _computeProyeccion(activos, entregados) {
  var hoy = new Date();
  var diasTrans = Math.max(1, Math.floor((hoy - REN26_INICIO) / 86400000));
  var totalOp   = activos.length || 1;
  var restantes = Math.max(0, totalOp - entregados);
  var velocidad = entregados / diasTrans;
  if (velocidad <= 0.05) return {
    fechaEstimada: null,
    fechaEstimadaTxt: 'Sin datos',
    diasAdelanto:  null,
    tipo:          'unknown'
  };
  var diasNecesarios = Math.ceil(restantes / velocidad);
  var fechaEstimada  = new Date(hoy); fechaEstimada.setDate(fechaEstimada.getDate() + diasNecesarios);
  var diffMs = fechaEstimada - REN26_FIN;
  var diasVsMeta = Math.round(diffMs / 86400000);
  return {
    fechaEstimada:     fechaEstimada,
    fechaEstimadaTxt:  _fmtDateShort(fechaEstimada),
    diasAdelanto:      -diasVsMeta,       // positivo = adelanto, negativo = retraso
    tipo:              diasVsMeta > 3 ? 'retraso' : diasVsMeta < -3 ? 'adelanto' : 'a-tiempo',
    velocidadDiaria:   +velocidad.toFixed(2)
  };
}

function _computePorCiudad(activos) {
  var out = {};
  var _hitEntregado = _hitoEntregado;
  activos.forEach(function(u) {
    var c = ((window.CityNormalizer ? CityNormalizer.normalize(u.ciudad) : (u.ciudad||'Sin ciudad')) || 'Sin ciudad').trim();
    if (!c) c = 'Sin ciudad';
    if (!out[c]) out[c] = { ciudad: c, total: 0, pendientes: 0, proceso: 0, entregados: 0, pct: 0 };
    out[c].total++;
    if (u.estado === 'Pendiente') out[c].pendientes++;
    else if (u.fecha_entrega || _hitEntregado(u.estado)) out[c].entregados++;
    else out[c].proceso++;
  });
  Object.keys(out).forEach(function(c) {
    out[c].pct = out[c].total ? Math.round(out[c].entregados / out[c].total * 100) : 0;
  });
  return out;
}

function _computeDestinoFinal(activos) {
  var conRecom = activos.filter(function(u){ return !!u.recomendacion_raee; });
  var total    = conRecom.length;
  var norm = function(v) {
    if (!v) return '';
    var s = String(v).toLowerCase();
    if (s.indexOf('raee') >= 0) return 'RAEE';
    if (s.indexOf('venta') >= 0) return 'Venta';
    if (s.indexOf('reasign') >= 0) return 'Reasignacion';
    if (s.indexOf('donac') >= 0) return 'Donacion';
    return 'Otro';
  };
  var out = { RAEE: 0, Venta: 0, Reasignacion: 0, Donacion: 0, Otro: 0, total: total };
  conRecom.forEach(function(u) { out[norm(u.recomendacion_raee)]++; });
  // Suma consistente: RAEE + Venta + Reasignacion + Donacion + Otro = total
  return out;
}

function _fmtDateShort(d) {
  if (!d) return '';
  var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return String(d.getDate()).padStart(2,'0') + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
}
window.buildDashboardStats = buildDashboardStats;

// ════════════════════════════════════════════════════════════════════
// STAB-v13 TASK 02 — DashboardStats Service (RC-1)
// Fuente única de estadísticas para todos los renderers.
// buildDashboardStats() es la implementación privada.
// Los renderers solo pueden usar DashboardStats.get() o .compute()
// ════════════════════════════════════════════════════════════════════
var DashboardStats = (function() {
  var _cache    = null;
  var _ts       = 0;
  var _TTL_MS   = 500;   // ms de validez del caché global

  return {
    /** Devuelve estadísticas globales (window.USERS). Resultado cacheado 500 ms. */
    get: function() {
      var now = Date.now();
      if (!_cache || (now - _ts) > _TTL_MS) {
        _cache = buildDashboardStats(window.USERS || []);
        _ts    = now;
      }
      return _cache;
    },

    /** Estadísticas sobre un subconjunto (no cacheadas). Usado por vistas filtradas. */
    compute: function(users) {
      return buildDashboardStats(users || []);
    },

    /** Fuerza recalculo en el próximo .get(). */
    invalidate: function() {
      _cache = null;
      _ts    = 0;
    },

    /** Recalcula y devuelve inmediatamente (sin esperar al TTL). */
    refresh: function() {
      this.invalidate();
      return this.get();
    },
  };
})();
window.DashboardStats = DashboardStats;

// getBDS() — alias legacy para compatibilidad transitoria
function getBDS(users) {
  return users && users !== (window.USERS||[]) ? DashboardStats.compute(users) : DashboardStats.get();
}
window.getBDS = getBDS;

// GH3.39.1 P2/P3 — calculateProjectMetrics()
// ÚNICA fuente de verdad para todos los dashboards.
// Todos los módulos deben consumir esta función.
// ════════════════════════════════════════════════════════════════════
// STAB-v13: getBDS() y cache migrado a DashboardStats Service

// STAB-v09.1: calculateProjectMetrics es ahora un wrapper de buildDashboardStats
function calculateProjectMetrics() {
  return buildDashboardStats(window.USERS || []);
}
window.calculateProjectMetrics = calculateProjectMetrics;

// ════════════════════════════════════════════════════════════════════
// GH3.37.1 Item 3 — CityNormalizer: fuente única de normalización de ciudades
// Convierte todas las variantes de una ciudad a una sola representación
// ════════════════════════════════════════════════════════════════════
const CityNormalizer = {
  _TABLE: {
    'bogota':        'Bogotá D.C.',
    'bogotá':        'Bogotá D.C.',
    'bogota dc':     'Bogotá D.C.',
    'bogotá dc':     'Bogotá D.C.',
    'bogota d.c':    'Bogotá D.C.',
    'bogotá d.c':    'Bogotá D.C.',
    'bogota d.c.':   'Bogotá D.C.',
    'bogotá d.c.':   'Bogotá D.C.',
    'medellin':      'Medellín',
    'medellín':      'Medellín',
    'barranquilla':  'Barranquilla',
    'cali':          'Cali',
    'bucaramanga':   'Bucaramanga',
    'pereira':       'Pereira',
    'manizales':     'Manizales',
    'ibague':        'Ibagué',
    'ibagué':        'Ibagué',
    'cucuta':        'Cúcuta',
    'cúcuta':        'Cúcuta',
    'santa marta':   'Santa Marta',
    'cartagena':     'Cartagena',
    'itagui':        'Itagüí',
    'itagüí':        'Itagüí',
    'envigado':      'Envigado',
    'bello':         'Bello',
    'mosquera':      'Mosquera',
  },
  normalize(city) {
    if (!city) return '';
    const key = String(city).trim()
                  .toLowerCase()
                  .replace(/\s+/g, ' ')
                  .replace(/\.\s*$/,'');  // quitar punto final
    return this._TABLE[key] || city.trim().replace(/\.\s*$/,'');
  },
  // Verifica si dos ciudades son la misma (normalizadas)
  equals(a, b) {
    return this.normalize(a) === this.normalize(b);
  },
};
window.CityNormalizer = CityNormalizer;

const KPIService = {
  
  calculate(records) {
    records = (records || []).filter(r => !isBackup(r));
    const total = records.length;
    
    const entregados = records.filter(r => {
      const e = (r.estado || '').toLowerCase();
      return e.indexOf('entregado equipo nuevo') >= 0 ||
             e.indexOf('completada') >= 0 ||
             e === 'cerrado' || e === 'feedback' ||
             e.indexOf('antiguo recibido') >= 0 ||
             e.indexOf('aprobaci') >= 0;
    }).length;
    
    const enProceso = records.filter(r => {
      const e = (r.estado || '').toLowerCase();
      return e === 'alistamiento' || e === 'programado' ||
             e.indexOf('tránsito') >= 0;
    }).length;
    
    const pendientes = records.filter(r => r.estado === 'Pendiente').length;
    const bloqueados = records.filter(r => r.estado === 'Bloqueado').length;
    const pendientesAprobacion = records.filter(r => r.estado === 'Pendiente aprobación').length;
    const cerrados = records.filter(r => r.estado === 'Cerrado').length;
    const correccion = records.filter(r => r.estado === 'Corrección requerida').length;
    const actasFirmadas = records.filter(r => r.acta_firmada === true).length;
    
      // GH3.28: KPIs Motor RAEE
    const destinoRAEE        = records.filter(r => r.recomendacion_raee === 'RAEE').length;
    const destinoDonacion    = records.filter(r => r.recomendacion_raee === 'Donacion').length;
    const destinoVenta       = records.filter(r => r.recomendacion_raee === 'Venta interna').length;
    const destinoReasign     = records.filter(r => r.recomendacion_raee === 'Reasignacion').length;
    const conEvaluacion      = records.filter(r => r.recomendacion_raee).length;
  return {
      total,
      entregados,
      enProceso,
      pendientes,
      bloqueados,
      pendientesAprobacion,
      cerrados,
      correccion,
      actasFirmadas,
      porcentajeAvance: total ? Math.round((entregados / total) * 100) : 0,
      porcentajeCierre: total ? Math.round((cerrados / total) * 100) : 0,
      // GH3.28: destinos RAEE
      destinoRAEE, destinoDonacion, destinoVenta, destinoReasign, conEvaluacion,
    };
  },
  
  // GH3.39.1 FC-10: tres fuentes independientes para conceptos distintos

  // Número total de equipos en el ciclo de renovación (incluyendo backups/repuestos)
  totalEquipos() {
    return (window.USERS || []).length;
  },

  // Número de colaboradores activos con equipo asignado (excluye backups)
  totalColaboradores() {
    return (window.USERS || []).filter(function(u){ return !isBackup(u); }).length;
  },

  // Alias de compatibilidad — delega a totalColaboradores()
  totalRenewals() {
    return this.totalColaboradores();
  },

  byEmpresa() {
    const result = {};
    ['HBT', 'HGS'].forEach(emp => {
      // GH3.39.1 FC-10: byEmpresa cuenta TODOS los equipos por empresa (incluyendo backups)
      // HBT=88, HGS=58 → total=146 (equipos, no colaboradores)
      const set = window.USERS.filter(r => r.empresa === emp);
      result[emp] = this.calculate(set);
    });
    return result;
  },
  
  byTecnico() {
    const techs = window.CONFIG.technicians.concat(['Sin asignar']);
    const result = {};
    techs.forEach(t => {
      const set = t === 'Sin asignar'
        ? window.USERS.filter(r => !r.tecnico)
        : window.USERS.filter(r => (r.tecnico || '').toLowerCase() === t.toLowerCase());
      result[t] = this.calculate(set);
    });
    return result;
  },
  
  raeeStats() {
    return ObsolescenceService.getStats();
  },
};

window.KPIService = KPIService;

// ═══════════════════════════════════════════════════════════════════
// F3 · NotificationService (fachada hacia el sistema notify() existente)
// API simple para módulos externos / migración futura
// ═══════════════════════════════════════════════════════════════════
const NotificationService = {
  show(messageOrOpts) {
    if (typeof messageOrOpts === 'string') {
      notify({ level: 'info', category: 'system', title: 'Sistema', message: messageOrOpts });
    } else {
      notify(messageOrOpts);
    }
  },
  info(title, message, recordId) { notify({ level: 'info', category: 'system', title, message, recordId }); },
  warning(title, message, recordId) { notify({ level: 'warning', category: 'system', title, message, recordId }); },
  critical(title, message, recordId) { notify({ level: 'critical', category: 'system', title, message, recordId }); },
};
window.NotificationService = NotificationService;

// ═══════════════════════════════════════════════════════════════════
// F3 · AuditService — Servicio real declarado en js/auditService.js
// El stub legacy fue eliminado en GH3.42 para evitar doble declaración.
// ═══════════════════════════════════════════════════════════════════


// ── 04_migration_states.js ──

// ═══════════════════════════════════════════════════════════════════
// F3 · Migration & StateMachine extension
// Normaliza el dataset del JSON al modelo interno + extiende StateMachine
// ═══════════════════════════════════════════════════════════════════

// Map: estados uppercase del JSON → estados oficiales del StateMachine
const STATE_NORMALIZE_MAP = {
  'PENDIENTE': StateMachine.states.PENDIENTE,
  'ALISTAMIENTO': StateMachine.states.ALISTAMIENTO,
  'PROGRAMADO': StateMachine.states.PROGRAMADO,
  'EN TRÁNSITO': StateMachine.states.TRANSITO_NUEVO,
  'EN TRANSITO': StateMachine.states.TRANSITO_NUEVO,
  'EN TRÁNSITO EQUIPO NUEVO': StateMachine.states.TRANSITO_NUEVO,
  'ENTREGADO': StateMachine.states.ENTREGADO_NUEVO,
  'ENTREGADO EQUIPO NUEVO': StateMachine.states.ENTREGADO_NUEVO,
  'PENDIENTE RECOGER EQUIPO ANTERIOR': StateMachine.states.PENDIENTE_RECOGER,
  'EN TRÁNSITO EQUIPO ANTERIOR': StateMachine.states.TRANSITO_ANTERIOR,
  'EN TRANSITO EQUIPO ANTERIOR': StateMachine.states.TRANSITO_ANTERIOR,
  'EQUIPO ANTIGUO RECIBIDO': StateMachine.states.RECIBIDO_ANTERIOR,
  'EQUIPO ANTERIOR RECIBIDO': StateMachine.states.RECIBIDO_ANTERIOR,
  'RENOVACIÓN COMPLETADA': StateMachine.states.COMPLETADA,
  'RENOVACION COMPLETADA': StateMachine.states.COMPLETADA,
  'COMPLETADO': StateMachine.states.COMPLETADA,
  'COMPLETADA': StateMachine.states.COMPLETADA,
  'PENDIENTE APROBACIÓN': StateMachine.states.PENDIENTE_APROBACION,
  'PENDIENTE APROBACION': StateMachine.states.PENDIENTE_APROBACION,
  'CORRECCIÓN REQUERIDA': StateMachine.states.CORRECCION_REQUERIDA,
  'CORRECCION REQUERIDA': StateMachine.states.CORRECCION_REQUERIDA,
  'CERRADO': StateMachine.states.CERRADO,
  'FEEDBACK': 'Feedback',
  'BLOQUEADO': StateMachine.states.BLOQUEADO,
  'BACKUP': StateMachine.states.BACKUP,
};

// F3.5 · FEEDBACK y todas las transiciones consolidadas en STATES/TRANSITIONS de Foundation (ver arriba).
// extendTransitions() eliminado — ya no es necesario.

// Normaliza el estado de un record
StateMachine.normalize = function(legacyState) {
  if (!legacyState) return StateMachine.states.PENDIENTE;
  const upper = String(legacyState).toUpperCase().trim();
  if (STATE_NORMALIZE_MAP[upper]) return STATE_NORMALIZE_MAP[upper];
  // ¿Ya está en formato canónico?
  const canonical = Object.values(StateMachine.states);
  if (canonical.indexOf(legacyState) >= 0) return legacyState;
  // fallback
  return legacyState;
};

// ═══════════════════════════════════════════════════════════════════
// F3 · Migración F3 de cada record del JSON al modelo interno
// ═══════════════════════════════════════════════════════════════════

// GH3.42: siNoToBool movida a utils.js para disponibilidad antes de dataService.js



// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// F3.6 · INVARIANTE ARQUITECTÓNICO — 4 entidades de estado independientes
// No deben colapsarse entre sí ni leerse una como sustituto de otra:
//
//   1. record.estado                        → ESTADO DEL PROCESO REN26
//      (StateMachine: Pendiente···Cerrado · gobierna el flujo operativo)
//
//   2. record.estado_entrega_equipo_nuevo   → ESTADO FÍSICO DEL EQUIPO NUEVO (F3.6)
//      (Pendiente / Alistado / En tránsito / Entregado / Completado)
//      Progresión logística del equipo nuevo, independiente del proceso.
//
//   3. record.estado_devolucion             → ESTADO FÍSICO DEL EQUIPO ANTERIOR (logística)
//      record.disposicion_final             → DESTINO FINAL del equipo anterior
//      (Venta interna empleado / Reasignación interna / Baja RAEE / Pendiente evaluación)
//
//   4. record.clasificacion_obsolescencia   → CLASIFICACIÓN DEL EQUIPO ANTERIOR
//      (generada EXCLUSIVAMENTE por ObsolescenceService.classify() · no editable manualmente)
//
// Ningún flujo debe escribir clasificacion_obsolescencia fuera de
// ObsolescenceService. Las 4 entidades son ortogonales.
// ═══════════════════════════════════════════════════════════════════

// F3 · MODELO NORMALIZADO (capa de adaptación)
// Transforma datos flat (eq_ant_*, eq_nvo_*) → modelo interno con sub-objetos
// La UI consume solamente el modelo normalizado.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// F3.1 · RelationsResolver
// Resuelve la relación Renovación <-> Inventario.
// Regla validada: cedula (renovación) == cedula_asignada (inventario).
// (eq_nvo_serial/serial NO es viable: 0% de las renovaciones tienen
// eq_nvo_serial poblado mientras el equipo no ha sido entregado).
// 133/146 inventario con match; los 13 restantes son stock sin asignar
// (cedula_asignada === 'Pendiente').
// ═══════════════════════════════════════════════════════════════════
const RelationsResolver = {
  
  /** Busca en window.INVENTORY el equipo asignado a este registro de renovación */
  findInventoryForRecord(record) {
    if (!record || !window.INVENTORY) return null;
    const cedula = record.cedula != null ? String(record.cedula).trim() : null;
    const usuario = record.usuario != null ? String(record.usuario).trim().toUpperCase() : null;
    
    if (cedula) {
      const byCedula = window.INVENTORY.find(i =>
        i.cedula_asignada != null &&
        String(i.cedula_asignada).trim() === cedula
      );
      if (byCedula) return byCedula;
    }
    if (usuario) {
      const byUsuario = window.INVENTORY.find(i =>
        i.usuario_asignado != null &&
        String(i.usuario_asignado).trim().toUpperCase() === usuario
      );
      if (byUsuario) return byUsuario;
    }
    return null;
  },
  
  /** Estadísticas del cruce, para auditoría/debug */
  getStats() {
    const total = (window.INVENTORY || []).length;
    let matched = 0, pendingStock = 0;
    (window.INVENTORY || []).forEach(i => {
      if (i.cedula_asignada === 'Pendiente' || i.cedula_asignada == null) { pendingStock++; return; }
      const ren = (window.USERS || []).find(r => String(r.cedula) === String(i.cedula_asignada));
      if (ren) matched++;
    });
    return { total, matched, pendingStock, unmatched: total - matched - pendingStock };
  },
};
window.RelationsResolver = RelationsResolver;

// ═══════════════════════════════════════════════════════════════════
// F3.5 · CONTRATOS DE VIEWMODEL
// Documentación explícita de las formas de datos que la UI consume.
// Estos no son clases — son contratos de forma (shape contracts).
// Cada ViewModel es producido por RenovacionModel.rebuildShape() y
// se accede desde los componentes sin lógica de negocio adicional.
//
// RenewalViewModel {
//   id, empresa, nombre, cedula, usuario, correo, ciudad,
//   ceco, proyecto, cargo, gerente, registro,
//   tecnico, estado, blocked, block_reason, block_category, block_previous_state,
//   disposicion_final, estado_devolucion,
//   clasificacion_obsolescencia, generacion_cpu, accion_requerida, accion_detalle,
//   evidencia_adjunta, nombre_archivo, acta_enviada, acta_firmada,
//   feedback, feedback_recibido,
//   audit: AuditEntry[], timeline: TimelineEvent[], approval: ApprovalRecord,
//   equipoAnterior: EquipoAnteriorViewModel,
//   equipoNuevo:    EquipoNuevoViewModel,
// }
//
// EquipoAnteriorViewModel { tipo, marca, modelo, af, serial, hostname, placa, procesador, memoria, so }
//
// EquipoNuevoViewModel {
//   tipo, marca, modelo, af, serial, hostname, placa, procesador, ram, memoria, disco, so,
//   id_inv, estado_inventario, fecha_asignacion          // de RelationsResolver + inventario_equipos
// }
//
// SystemUserViewModel { id, name, email, role, role_label, estado }
//   Producido por DataMapper.normalizeUsuarioSistema()
//
// ─── REGLA DE ACCESO ────────────────────────────────────────────
// La única ruta de datos válida es:
//   UI → DataService (+ ConfigService/StateMachine) → DataMapper/RelationsResolver → Provider
// Los componentes NO deben:
//   · leer window.USERS directamente (usar DataService.getRenewals())
//   · leer window.INVENTORY directamente (usar RelationsResolver)
//   · leer window.PMC_DATA directamente
//   · llamar a MockProvider/JSONProvider/SplitJsonProvider
//   · hardcodear valores que ConfigService expone
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// F3.9 · IntegrityService
// Valida integridad referencial del dataset en memoria.
// Solo lectura — detecta y reporta, nunca corrige automáticamente.
// ═══════════════════════════════════════════════════════════════════
const IntegrityService = {

  /** Ejecuta todas las validaciones y devuelve un reporte completo */
  validate() {
    const ren   = window.USERS || [];
    const inv   = window.INVENTORY || [];
    const issues = [];
    const stats  = {};

    const activos = ren.filter(r => !isBackup(r));
    stats.total         = ren.length;
    stats.activos        = activos.length;
    stats.backups        = ren.length - activos.length;

    // ── Cédulas duplicadas
    const cedMap = {};
    activos.forEach(r => {
      const c = String(r.cedula || '');
      if (!c) return;
      cedMap[c] = (cedMap[c] || 0) + 1;
    });
    const dupCeds = Object.entries(cedMap).filter(([,n]) => n > 1).map(([c]) => c);
    if (dupCeds.length) issues.push({ type: 'CEDULA_DUPLICADA', count: dupCeds.length, samples: dupCeds.slice(0,5) });
    stats.cedulas_duplicadas = dupCeds.length;

    // ── Seriales eq. anterior duplicados
    const serAntMap = {};
    activos.forEach(r => { if (r.eq_ant_serial) serAntMap[r.eq_ant_serial] = (serAntMap[r.eq_ant_serial]||0)+1; });
    const dupSerAnt = Object.entries(serAntMap).filter(([,n])=>n>1).map(([s])=>s);
    if (dupSerAnt.length) issues.push({ type: 'SERIAL_ANT_DUPLICADO', count: dupSerAnt.length, samples: dupSerAnt });
    stats.seriales_ant_duplicados = dupSerAnt.length;

    // ── Hostnames eq. anterior duplicados
    const hostMap = {};
    activos.forEach(r => { if (r.eq_ant_hostname) hostMap[r.eq_ant_hostname] = (hostMap[r.eq_ant_hostname]||0)+1; });
    const dupHosts = Object.entries(hostMap).filter(([,n])=>n>1).map(([h])=>h);
    if (dupHosts.length) issues.push({ type: 'HOSTNAME_ANT_DUPLICADO', count: dupHosts.length, samples: dupHosts });
    stats.hostnames_ant_duplicados = dupHosts.length;

    // ── Renovaciones sin técnico
    const sinTecnico = activos.filter(r => !r.tecnico).map(r => r.id);
    if (sinTecnico.length) issues.push({ type: 'SIN_TECNICO', count: sinTecnico.length, samples: sinTecnico.slice(0,10) });
    stats.sin_tecnico = sinTecnico.length;

    // ── Renovaciones sin procesador (→ Revisión manual RAEE)
    const sinProc = activos.filter(r => !r.eq_ant_procesador).map(r => r.id);
    stats.sin_procesador = sinProc.length;
    if (sinProc.length) issues.push({ type: 'SIN_PROCESADOR', count: sinProc.length, samples: sinProc.slice(0,5) });

    // ── Inventario sin renovación correspondiente
    const cedSet = new Set(activos.map(r => String(r.cedula || '')));
    const invSinRen = inv.filter(i => {
      const ca = String(i.cedula_asignada || '');
      return ca && ca !== 'Pendiente' && !cedSet.has(ca);
    }).map(i => i.id_inv);
    if (invSinRen.length) issues.push({ type: 'INV_SIN_RENOVACION', count: invSinRen.length, samples: invSinRen });
    stats.inv_sin_renovacion = invSinRen.length;

    // ── Seriales inventario duplicados (excluir placeholders)
    const serInvMap = {};
    inv.forEach(i => {
      if (i.serial && i.serial !== 'PENDIENTE') serInvMap[i.serial] = (serInvMap[i.serial]||0)+1;
    });
    const dupSerInv = Object.entries(serInvMap).filter(([,n])=>n>1).map(([s])=>s);
    if (dupSerInv.length) issues.push({ type: 'SERIAL_INV_DUPLICADO', count: dupSerInv.length, samples: dupSerInv });
    stats.seriales_inv_duplicados = dupSerInv.length;

    return {
      ok:       issues.length === 0,
      issues,
      stats,
      summary:  `${activos.length} activos · ${issues.length} problema(s) detectado(s)`,
    };
  },

  /** Genera un resumen legible para consola/log */
  report() {
    const result = this.validate();
    console.group('[IntegrityService]', result.summary);
    if (result.ok) {

    } else {
      result.issues.forEach(i => console.warn(i.type, ':', i.count, '→', i.samples));
    }
    console.groupEnd();
    return result;
  },
};
window.IntegrityService = IntegrityService;
// Stubs para vistas diferenciadas. La lógica de datos ya está lista
// (RBAC, DataService, ViewModels). F4 solo construye las vistas.
// ═══════════════════════════════════════════════════════════════════
const DashboardFactory = {
  // F3.7 · Contratos formales de ViewModel por rol

  /** TÉCNICO — su propia cola de trabajo */
  getTecnicoViewModel(tecnicoName) {
    const all = DataService.getRenewals({ role: 'tecnico', tecnico: tecnicoName });
    const kpi = KPIService.calculate(all);
    return {
      // datos base
      pendientes:       all.filter(r => r.estado === 'Pendiente'),
      misUsuarios:      all,
      // devoluciones solo propias (filtro por tecnico)
      misDevoluciones:  all.filter(r => r.eq_ant_serial || r.eq_ant_marca || r.estado_devolucion),
      // equipos en tránsito
      equiposTransito:  all.filter(r => r.estado && r.estado.toLowerCase().indexOf('tránsito') >= 0),
      // alertas: bloqueados + corrección requerida
      alertas:          all.filter(r => r.estado === 'Bloqueado' || r.estado === 'Corrección requerida'),
      // KPIs propios
      kpi,
    };
  },

  /** GESTOR DE ACTIVOS — visión operativa completa */
  getGestorViewModel() {
    const all = DataService.getRenewals({});
    return {
      avanceGeneral:    KPIService.calculate(all),
      kpis:             KPIService.calculate(all),
      ciudades:         (() => {
        const map = {};
        all.forEach(r => {
          const c = r.ciudad || 'Sin ciudad';
          if (!map[c]) map[c] = [];
          map[c].push(r);
        });
        return map;
      })(),
      tecnicos:         KPIService.byTecnico(),
      raee:             KPIService.raeeStats(),
      reportes:         all,
      pendingApproval:  DataService.getPendingApprovals(),
      blocked:          DataService.getBlocked(),
      all,
    };
  },

  /** VISITANTE — lectura pública, sin datos sensibles de gestión */
  getVisitanteViewModel() {
    const all = DataService.getRenewals({});
        // GH3.28: KPIs destino final
    const kpiAll = KPIService.calculate(all);
return {
      kpisPublicos: kpiAll,
      destinoFinal: {
        RAEE:         kpiAll.destinoRAEE || 0,
        Donacion:     kpiAll.destinoDonacion || 0,
        VentaInterna: kpiAll.destinoVenta || 0,
        Reasignacion: kpiAll.destinoReasign || 0,
        total:        kpiAll.conEvaluacion || 0,
      },
      reportes:         all,
      avanceGeneral: {
        total:          all.length,
        porcentaje:     KPIService.calculate(all).porcentajeAvance,
        byEmpresa:      KPIService.byEmpresa(),
      },
      // F3.7 · timeline: últimas 20 entradas de auditoría públicas
      timeline:         DataService.getAuditLog({}).slice(-20),
      raee:             KPIService.raeeStats(),
    };
  },
};
window.DashboardFactory = DashboardFactory;

// ═══════════════════════════════════════════════════════════════════
// F3.5 · PREPARACIÓN F5 — Módulo Inventario independiente
// ═══════════════════════════════════════════════════════════════════
const InventarioService = {
  // F5 · Stub — operaciones sobre window.INVENTORY
  getAll()          { return (window.INVENTORY || []).slice(); },
  getDisponibles()  { return (window.INVENTORY || []).filter(i => i.estado_inventario === 'Disponible'); },
  getByIdInv(id)    { return (window.INVENTORY || []).find(i => i.id_inv === id) || null; },
  getByCedula(ced)  { return (window.INVENTORY || []).find(i => String(i.cedula_asignada) === String(ced)) || null; },
  // F5 · Métodos de escritura (pendientes — requieren write-back a Provider)
  reservar(id_inv, renovacion_id)   { /* F5 pendiente */ },
  asignar(id_inv, cedula, usuario)  { /* F5 pendiente */ },
  baja(id_inv, motivo)              { /* F5 pendiente */ },
  reasignar(id_inv, nueva_cedula)   { /* F5 pendiente */ },
};
window.InventarioService = InventarioService;

// ═══════════════════════════════════════════════════════════════════
// F3.5 · PREPARACIÓN F7 — GraphProvider (MSAL + SharePoint)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// F7.2 · GraphClient
// Capa HTTP pura para Microsoft Graph API.
// Responsabilidad exclusiva: comunicación HTTP.
// No conoce: Dashboard, DataService, StateMachine, RBAC.
// Obtiene tokens siempre a través de AuthProvider.
// ═══════════════════════════════════════════════════════════════════
