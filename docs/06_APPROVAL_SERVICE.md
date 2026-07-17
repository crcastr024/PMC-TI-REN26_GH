# ApprovalService

## Responsabilidad

Gestión del flujo de aprobación del proceso REN26.

## Flujo oficial (RC-1)

```
Usuario cambia estado → "Pendiente aprobación"
  ↓
saveRecord() detecta el cambio de estado
  ↓
ApprovalService.requestValidation(id, user) automático
  ↓
Evalúa checklist de 6 puntos
  ↓
Si aprueba: estado queda en "Pendiente aprobación"
Si falla:   estado → "Corrección requerida" + razón
  ↓
renderAprobaciones() muestra registros con estado="Pendiente aprobación"
  ↓
Gestor TI / Director TI revisa → abre modal → Aprobar / Rechazar
  ↓
Aprobado → estado → "Renovación completada"
Rechazado → estado → "Corrección requerida"
```

## Checklist de 6 puntos

1. Equipo nuevo entregado (estado >= Entregado equipo nuevo + serial)
2. Equipo anterior recibido en bodega (fecha_recepcion_bodega)
3. Acta de entrega firmada (fecha_firma_acta)
4. Evidencia documental adjunta
5. Feedback del usuario registrado
6. Sin bloqueos activos

## Nota sobre el botón eliminado

El botón "Solicitar validación de cierre" fue eliminado en STAB-v12.
El único mecanismo para entrar a la cola es el cambio de estado.
No existe un segundo canal.
