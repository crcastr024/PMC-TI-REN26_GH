# DashboardStats Service

## Responsabilidad

Fuente única de estadísticas del sistema. Ningún renderer calcula KPIs directamente.

## API

```javascript
DashboardStats.get()          // Estadísticas globales (window.USERS), cacheadas 500ms
DashboardStats.compute(users) // Estadísticas para un subconjunto (no cacheadas)
DashboardStats.invalidate()   // Invalida el caché (llamar tras guardar datos)
DashboardStats.refresh()      // Invalida + recalcula inmediatamente
```

## Objeto retornado

```javascript
{
  // Totales
  total:            number, // activos (sin backup)
  totalEquipos:     number, // todos (activos + backup)
  totalBackups:     number, // solo backup
  totalColaboradores: number,
  hbt:              number, // total HBT (inc. backup)
  hgs:              number, // total HGS (inc. backup)

  // KPIs por hito (solo activos)
  pendientes:       number,
  proceso:          number,
  enEnvio:          number, // Programado + En tránsito equipo nuevo
  entregados:       number, // hito acumulativo
  actas:            number, // hito acumulativo
  finalizados:      number,
  devoluciones:     number,
  devolucionesPendientes: number,

  // Breakdowns
  porEmpresa:  { HBT: {...}, HGS: {...} },
  porTecnico:  { NOMBRE: {...} },
  porCiudad:   { ciudad: count },
  estados:     { estado: count },
  raeeDistrib: { categoria: count },

  // Campos extendidos (RC-1)
  calidad:     { sinTecnico, sinCiudad, sinEmpresa, sinSerial, sinActa },
  pipeline:    [ { estado, count } ],
  cueloBotella: { estado, count },
  riesgos:     { sinMovimiento, pendienteAprobacion, pendienteDevolucion, registrosIncompletos },
  aprobaciones:{ pendientes, completadas, rechazadas },
}
```

## Invariante porEmpresa

```
porEmpresa[emp].total = porEmpresa[emp].operativos + porEmpresa[emp].backup
```

Verificado por 56 pruebas en test_RC1_QA.js.
