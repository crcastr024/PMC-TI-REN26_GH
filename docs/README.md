# PMC-TI-REN26 Dashboard

## GH3.28 — Motor RAEE (Integración End-to-End)

### Nuevas columnas en Excel Maestro (después de DEVUELTO / AV)
- AW: LISTA_RECOLECCION
- AX: EVAL_BATERIA
- AY: EVAL_TECLADO
- AZ: EVAL_TOUCHPAD
- BA: EVAL_ESTETICO
- BB: RECOMENDACION_RAEE
- BC: MOTIVO_RAEE
- BD: MOTOR_RAEE_VERSION
- BE: FECHA_EVALUACION_RAEE

### RAEEEngine v1.0 (graph.js)
Reglas: RAEE (2+ Malo) > Donacion (2+ Regular) > Venta interna (avg>=3, sin Malo) > Reasignacion

### Flujo completo
Modal → RAEEEngine → DataService → WorkbookWriter → Graph → Excel → Reload → Dashboard → KPIs
