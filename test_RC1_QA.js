/**
 * PMC-TI-REN26 — RC-1 QA Funcional
 * STAB-v13 TASK 04 — Flujos críticos del sistema
 * Ejecutar: node test_RC1_QA.js (desde /home/claude)
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const BUILD = path.join(__dirname, 'gh1_build', 'js');
function load(f) { return fs.readFileSync(path.join(BUILD, f), 'utf8'); }

// Contexto mínimo de navegador
const window = global;
global.document = {
  getElementById:()=>null, querySelector:()=>null,
  querySelectorAll:()=>({forEach:()=>{},length:0}),
  createElement:()=>({style:{},classList:{add:()=>{},remove:()=>{},toggle:()=>{}},appendChild:()=>{}}),
  body:{appendChild:()=>{}}, head:{appendChild:()=>{}},
  addEventListener:()=>{}, removeEventListener:()=>{},
};
try { Object.defineProperty(global,'navigator',{value:{onLine:true},writable:true,configurable:true}); } catch(e){}
const _mockStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
try { Object.defineProperty(global,'sessionStorage',{value:_mockStorage,writable:true,configurable:true}); } catch(e){}
try { Object.defineProperty(global,'localStorage',{value:_mockStorage,writable:true,configurable:true}); } catch(e){}
global.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})});
global.msal={PublicClientApplication:class{async initialize(){}getAllAccounts(){return[];}getActiveAccount(){return null;}}};
global.addEventListener=()=>{};global.removeEventListener=()=>{};
global.requestAnimationFrame=(fn)=>setTimeout(fn,16);
global.cancelAnimationFrame=clearTimeout;
global.CSS={escape:(s)=>s};
global.MutationObserver=class{observe(){}disconnect(){}};
global.USERS=[]; global.SYSTEM_USERS=[]; global.ROLES=[]; global.ROLES_PERMISOS=[];
global.Chart=function(){return{destroy:()=>{},update:()=>{}};};

// Cargar en orden
eval(load('config.js'));
eval(load('utils.js'));
eval(load('graph.js'));
eval(load('dataService.js'));
eval(load('provider.js'));
eval(load('sync.js'));
eval(load('refresh.js'));
eval(load('dashboard.js'));

// ── Runner ──────────────────────────────────────────────────────────
let passed=0, failed=0;
const errors=[];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ '+name); }
  catch(e) { failed++; errors.push(name+': '+e.message); console.log('  ✗ '+name+'\n    → '+e.message); }
}
function eq(a,b,msg) { if(a!==b) throw new Error((msg||'')+'  expected='+JSON.stringify(b)+' got='+JSON.stringify(a)); }
function ok(cond,msg) { if(!cond) throw new Error(msg||'Assertion failed'); }

function mkR(o) {
  return Object.assign({
    id:Math.random()*100000|0, empresa:'HBT', tecnico:'CRISTIAN',
    ciudad:'Bogotá', nombre:'Test User', estado:'Pendiente',
    eq_ant_serial:'SN001', eq_nvo_serial:'SN002',
    lista_recoleccion:false, estado_devolucion:null,
    fecha_entrega:null, fecha_firma_acta:null,
    fecha_solicitud_devolucion:null, fecha_recepcion_bodega:null,
    recomendacion_raee:null, version:1,
  }, o);
}
const bds = (u) => buildDashboardStats(u);

// ═══ CASO 1: Flujo operativo completo ══════════════════════════════
console.log('\n══ CASO 1: Flujo operativo completo ══');
const r1 = mkR({id:1});
test('C1.0 Pendiente: pendientes=1', () => { eq(bds([r1]).pendientes,1); });
test('C1.0 Pendiente: proceso=0',    () => { eq(bds([r1]).proceso,0); });
test('C1.0 Pendiente: entregados=0', () => { eq(bds([r1]).entregados,0); });
test('C1.0 Pendiente: total=1',      () => { eq(bds([r1]).total,1); });

r1.estado = 'Alistamiento';
test('C1.1 Alistamiento: pendientes=0', () => { eq(bds([r1]).pendientes,0); });
test('C1.1 Alistamiento: proceso=1',    () => { eq(bds([r1]).proceso,1); });
test('C1.1 Alistamiento: entregados=0', () => { eq(bds([r1]).entregados,0); });

r1.estado = 'Programado';
test('C1.2 Programado: enEnvio=1',  () => { eq(bds([r1]).enEnvio,1); });
test('C1.2 Programado: proceso=1',  () => { eq(bds([r1]).proceso,1); });

r1.estado = 'Entregado equipo nuevo';
test('C1.3 EntregadoEq: entregados=1 (hito estado)', () => { eq(bds([r1]).entregados,1); });
test('C1.3 EntregadoEq: proceso=1 (sigue)',          () => { eq(bds([r1]).proceso,1); });
test('C1.3 EntregadoEq: finalizados=0',              () => { eq(bds([r1]).finalizados,0); });

r1.fecha_entrega = '2026-03-15';
test('C1.4 fecha_entrega: entregados=1 (hito fecha)', () => { eq(bds([r1]).entregados,1); });

r1.fecha_firma_acta = '2026-03-20';
test('C1.5 fecha_firma_acta: actas=1',           () => { eq(bds([r1]).actas,1); });
test('C1.5 fecha_firma_acta: entregados sigue=1',() => { eq(bds([r1]).entregados,1); });

r1.estado = 'Renovación completada';
test('C1.6 Renovación: finalizados=1',         () => { eq(bds([r1]).finalizados,1); });
test('C1.6 Renovación: entregados=1 (cumula)', () => { eq(bds([r1]).entregados,1); });
test('C1.6 Renovación: actas=1 (cumula)',      () => { eq(bds([r1]).actas,1); });
test('C1.6 Renovación: pendientes=0',          () => { eq(bds([r1]).pendientes,0); });

// ═══ CASO 2: Backup ════════════════════════════════════════════════
console.log('\n══ CASO 2: Equipo Backup ══');
const r2 = mkR({id:2, nombre:'BACKUP HBT-001', empresa:'HBT'});
const rOp= mkR({id:3, empresa:'HBT', estado:'Pendiente'});
test('C2.1 solo backup: totalBackups=1',          () => { eq(bds([r2]).totalBackups,1); });
test('C2.1 solo backup: total (activos)=0',       () => { eq(bds([r2]).total,0); });
test('C2.1 solo backup: pendientes=0',            () => { eq(bds([r2]).pendientes,0); });
test('C2.1 solo backup: entregados=0',            () => { eq(bds([r2]).entregados,0); });
test('C2.1 solo backup: hbt=1 (afecta inventario)',() => { eq(bds([r2]).hbt,1); });
test('C2.1 solo backup: porEmpresa.HBT.total=1',  () => { eq(bds([r2]).porEmpresa['HBT'].total,1); });
test('C2.1 solo backup: porEmpresa.HBT.backup=1', () => { eq(bds([r2]).porEmpresa['HBT'].backup,1); });
test('C2.1 solo backup: operativos=0',            () => { eq(bds([r2]).porEmpresa['HBT'].operativos,0); });
const rmix = bds([rOp,r2]);
test('C2.2 mix op+bk: total=1',                   () => { eq(rmix.total,1); });
test('C2.2 mix op+bk: totalBackups=1',            () => { eq(rmix.totalBackups,1); });
test('C2.2 mix op+bk: totalEquipos=2',            () => { eq(rmix.totalEquipos,2); });
test('C2.2 mix op+bk: HBT.total=2',              () => { eq(rmix.porEmpresa['HBT'].total,2); });
test('C2.2 invariante HBT: op+bk=total',          () => {
  const e=rmix.porEmpresa['HBT'];
  eq(e.operativos+e.backup, e.total, 'op+bk≠total');
});

// ═══ CASO 3: Devolución ════════════════════════════════════════════
console.log('\n══ CASO 3: Devolución ══');
const r3 = mkR({id:4, lista_recoleccion:true, estado_devolucion:'Pendiente'});
test('C3.1 lista_recoleccion+Pendiente: devolucionesPendientes=1',
  () => { eq(bds([r3]).devolucionesPendientes,1); });
r3.estado_devolucion = 'Solicitada';
test('C3.2 Solicitada: devolucionesPendientes=1',
  () => { eq(bds([r3]).devolucionesPendientes,1); });
r3.fecha_recepcion_bodega = '2026-04-01';
test('C3.3 con fecha_recepcion_bodega: devolucionesPendientes=0',
  () => { eq(bds([r3]).devolucionesPendientes,0); });

// ═══ CASO 4: Aprobaciones ══════════════════════════════════════════
console.log('\n══ CASO 4: Aprobaciones ══');
const r4 = mkR({id:5, estado:'Pendiente aprobación'});
test('C4.1 Pend. aprobación: aprobaciones.pendientes=1',
  () => { eq(bds([r4]).aprobaciones.pendientes,1); });
test('C4.1 Pend. aprobación: riesgos.pendienteAprobacion=1',
  () => { eq(bds([r4]).riesgos.pendienteAprobacion,1); });
test('C4.1 Pend. aprobación: finalizados=0',
  () => { eq(bds([r4]).finalizados,0); });
r4.estado = 'Renovación completada';
test('C4.2 Renovación: aprobaciones.completadas=1',
  () => { eq(bds([r4]).aprobaciones.completadas,1); });
test('C4.2 Renovación: aprobaciones.pendientes=0',
  () => { eq(bds([r4]).aprobaciones.pendientes,0); });
test('C4.2 Renovación: finalizados=1',
  () => { eq(bds([r4]).finalizados,1); });

// ═══ INVARIANTES GLOBALES ══════════════════════════════════════════
console.log('\n══ INVARIANTES GLOBALES ══');
const rHGS = mkR({id:6, empresa:'HGS', estado:'Alistamiento'});
const rBkH = mkR({id:7, empresa:'HBT', nombre:'BACKUP HBT-002'});
const allRec = [mkR({id:8,empresa:'HBT',estado:'Pendiente'}), r2, rHGS, rBkH];
const sg = bds(allRec);
test('INV: total + totalBackups = totalEquipos',
  () => { eq(sg.total+sg.totalBackups, sg.totalEquipos); });
test('INV: hbt = porEmpresa.HBT.total',
  () => { eq(sg.hbt, sg.porEmpresa['HBT'].total); });
test('INV: hgs = porEmpresa.HGS.total',
  () => { eq(sg.hgs, sg.porEmpresa['HGS'].total); });
test('INV: Σ(hbt+hgs) = totalEquipos',
  () => { eq(sg.porEmpresa['HBT'].total+sg.porEmpresa['HGS'].total, sg.totalEquipos); });
test('INV: HBT op+bk=total', () => {
  const e=sg.porEmpresa['HBT']; eq(e.operativos+e.backup,e.total);
});
test('INV: HGS op+bk=total', () => {
  const e=sg.porEmpresa['HGS']; eq(e.operativos+e.backup,e.total);
});

// ═══ DashboardStats Service ════════════════════════════════════════
console.log('\n══ DashboardStats Service ══');
global.USERS = allRec;
test('SVC: DashboardStats existe',        () => { ok(typeof DashboardStats!=='undefined'); });
test('SVC: .get() es función',            () => { ok(typeof DashboardStats.get==='function'); });
test('SVC: .compute() es función',        () => { ok(typeof DashboardStats.compute==='function'); });
test('SVC: .invalidate() es función',     () => { ok(typeof DashboardStats.invalidate==='function'); });
test('SVC: .refresh() es función',        () => { ok(typeof DashboardStats.refresh==='function'); });
const sg2 = DashboardStats.get();
test('SVC: .get() retorna stats',         () => { ok(typeof sg2.total==='number'); });
test('SVC: .get() cacheado (2da=1ra)',    () => { ok(DashboardStats.get()===sg2); });
DashboardStats.invalidate();
test('SVC: tras invalidate() nueva inst', () => { ok(DashboardStats.get()!==sg2); });
test('SVC: .compute(subset) stats parcs', () => { eq(DashboardStats.compute([allRec[0]]).total,1); });

console.log('\n══════════════════════════════════════════');
console.log('  RC-1 QA · '+passed+'/'+(passed+failed)+' pruebas pasaron');
if (failed>0) { console.log('  FALLOS:'); errors.forEach(e=>console.log('  ✗ '+e)); }
else console.log('  ✅ RC-1 QA APROBADO — LISTO PARA RELEASE');
console.log('══════════════════════════════════════════');
process.exit(failed>0?1:0);
