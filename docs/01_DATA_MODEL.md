# Modelo de datos

## Registro de renovación (renewal record)

Cada registro corresponde a un colaborador y su proceso de renovación de equipo.

| Campo interno | Columna Excel | Tipo | Descripción |
|---|---|---|---|
| id | ID | number | Clave interna (fila Excel) |
| nombre | NOMBRE | string | Nombre del colaborador |
| empresa | EMPRESA | string | HBT | HGS |
| ciudad | CIUDAD | string | Ciudad de trabajo |
| tecnico | TECNICO | string | Técnico TI asignado |
| estado | ESTADO_RENOVACION | string | Estado en la máquina de estados REN26 |
| eq_ant_serial | EQ_ANT_SERIAL | string | Serial equipo anterior |
| eq_nvo_serial | EQ_NVO_SERIAL | string | Serial equipo nuevo |
| eq_nvo_af | EQ_NVO_AF | string | Activo Fijo equipo nuevo |
| fecha_entrega | FECHA_ENTREGA | date | Hito: equipo entregado al usuario |
| fecha_firma_acta | FECHA_ACTA_FIRMADA | date | Hito: acta firmada |
| fecha_solicitud_devolucion | FECHA_SOLICITUD_DEVOLUCION | date | Devolución iniciada |
| fecha_recepcion_bodega | FECHA_RECEPCION_BODEGA | date | Equipo recibido en bodega |
| lista_recoleccion | LISTA_RECOLECCION | boolean | Está en lista de recolección |
| estado_devolucion | ESTADO_DEVOLUCION | string | Estado del proceso de devolución |
| recomendacion_raee | RECOMENDACION_RAEE | string | Clasificación tecnológica |
| observaciones_devolucion | OBSERVACIONES_DEVOLUCION | string | Notas de devolución |
| version | VERSION | number | Control de concurrencia optimista |

## Registros Backup

Un registro es Backup cuando `nombre.trim().toUpperCase().startsWith('BACKUP')`.

Los registros Backup:
- **Sí** contribuyen a `totalEquipos`, `hbt/hgs`, `porEmpresa.total`
- **No** contribuyen a KPIs operativos (pendientes, proceso, entregados, etc.)

## DashboardStats.porEmpresa — invariante

```
porEmpresa[emp].total = porEmpresa[emp].operativos + porEmpresa[emp].backup
```

Esta igualdad es **invariante garantizado** por construcción en buildDashboardStats().
