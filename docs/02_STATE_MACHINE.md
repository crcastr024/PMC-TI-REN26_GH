# Máquina de estados REN26

## Flujo oficial

```
Pendiente
  ↓
Alistamiento
  ↓
Programado         ← enEnvio (con "En tránsito equipo nuevo")
  ↓
En tránsito equipo nuevo
  ↓
Entregado equipo nuevo    ← HITO: fecha_entrega (acumulativo)
  ↓
Pendiente devolución equipo anterior
  ↓
En tránsito equipo anterior
  ↓
Equipo anterior recibido
  ↓
Pendiente aprobación      ← ApprovalService.requestValidation()
  ↓
Renovación completada     ← finalizados
  ↓
Cerrado
```

## Definición en código

```javascript
// boot.js — StateMachine.states
PENDIENTE:               'Pendiente'
ALISTAMIENTO:            'Alistamiento'
PROGRAMADO:              'Programado'
EN_TRANSITO_NVO:         'En tránsito equipo nuevo'
ENTREGADO_NVO:           'Entregado equipo nuevo'
PEND_DEVOLUCION:         'Pendiente devolución equipo anterior'
EN_TRANSITO_ANT:         'En tránsito equipo anterior'
RECIBIDO_BODEGA:         'Equipo anterior recibido'
PENDIENTE_APROBACION:    'Pendiente aprobación'
RENOVACION_COMPLETADA:   'Renovación completada'
CERRADO:                 'Cerrado'
```

## KPIs acumulativos

Los hitos son acumulativos (no disminuyen cuando el proceso avanza):

| KPI | Regla |
|---|---|
| entregados | `fecha_entrega != vacío` OR `estado >= Entregado equipo nuevo` |
| actas | `fecha_firma_acta != vacío` |
| finalizados | `estado === Renovación completada` OR `Completado` |

## Aprobación automática

Cuando `saveRecord()` guarda `estado = 'Pendiente aprobación'`:
1. `DataService.updateRenewal()` actualiza el estado local
2. `ApprovalService.requestValidation(id, user)` evalúa el checklist
3. Si aprueba → el registro aparece en `renderAprobaciones()`
