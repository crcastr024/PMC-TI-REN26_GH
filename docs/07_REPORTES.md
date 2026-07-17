# Módulo de Reportes

## REP-01 a REP-06 (Reportes operativos)

| ID | Nombre | Lógica |
|---|---|---|
| REP-01 | Alistamiento / Proceso | `buildDashboardStats(base).proceso` |
| REP-02 | Entregados | `buildDashboardStats(base).entregados` |
| REP-03 | Actas firmadas | `buildDashboardStats(base).actas` |
| REP-04 | Devoluciones | `buildDashboardStats(base).devoluciones` |
| REP-05 | Finalizados | `buildDashboardStats(base).finalizados` |
| REP-06 | Feedback | Registros con feedback > 0 |

## Reporte Ejecutivo (renderReportesEjecutivos)

Paneles disponibles (RC-1):
1. Cumplimiento por empresa (total, op, backup, pendientes, proceso, entregados, actas, %)
2. Ranking técnicos (todos los campos de porTecnico)
3. Pipeline REN26 con cuello de botella automático
4. Calidad de datos (campos vacíos por categoría)
5. Riesgos ejecutivos (sin movimiento, pendiente aprobación, etc.)

## Fuente de datos

Todos los reportes consumen `DashboardStats.get()` o `DashboardStats.compute(subset)`.
Ningún renderer calcula KPIs directamente.
