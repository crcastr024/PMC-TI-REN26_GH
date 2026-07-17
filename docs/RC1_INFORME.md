# RC-1 — Release Candidate 1
# PMC-TI-REN26 Dashboard
# Heinsohn Business Technology
# Fecha: 17 de julio de 2026
# Responsable: Cristian Eduardo Castro Barros

---

## 1. Estado del Core (congelado)

| Componente | Archivo | Estado |
|---|---|---|
| DashboardStats Service | dashboard.js | ✅ CONGELADO |
| DataService | dataService.js | ✅ CONGELADO |
| GraphProvider / WriteContract | graph.js | ✅ CONGELADO |
| ApprovalService | boot.js | ✅ CONGELADO |
| Máquina de estados REN26 | boot.js | ✅ CONGELADO |
| RBAC | graph.js | ✅ CONGELADO |
| SynchronizationManager (RC-06/07) | sync.js | ✅ CONGELADO |
| WorkbookWriter | provider.js | ✅ CONGELADO |

## 2. DashboardStats Service

- buildDashboardStats() convertida en servicio singleton
- API: get(), compute(subset), invalidate(), refresh()
- Todos los renderers migrados a DashboardStats.get() o .compute()
- 0 llamadas directas a buildDashboardStats() en ui.js
- Cache TTL: 500ms
- invalidate() llamado automáticamente en saveRecord()

## 3. Consistencia de KPIs

| Vista | Fuente | Estado |
|---|---|---|
| Resumen | DashboardStats.get() | ✅ |
| Seguimiento (Panel Ejecutivo) | DashboardStats.compute(activos) | ✅ |
| Ejecutivos (Reportes) | DashboardStats.get() | ✅ |
| Por técnico | DashboardStats.compute(mine) | ✅ |
| Por ciudad | DashboardStats.compute(cityRecords) | ✅ |
| Devoluciones | DashboardStats.get() | ✅ |
| Aprobaciones | ApprovalService (estado === 'Pendiente aprobación') | ✅ |

## 4. Tabla de conciliación empresas (invariante verificado)

| Concepto | HBT | HGS | Total |
|---|---|---|---|
| Operativos | 84 | 58 | 142 |
| Backup | 3 | 1 | 4 |
| **Total** | **87** | **59** | **146** |
| Invariante op+bk=total | ✓ | ✓ | ✓ |

## 5. Integración

| Sistema | Estado | Nota |
|---|---|---|
| Excel Maestro (SharePoint) | ✅ | Columnas mapeadas en FIELD_COLUMN_ALIASES |
| Microsoft Graph API | ✅ | GET + PATCH operativos |
| MSAL (autenticación) | ✅ | Tenant 38f48feb configurado |
| ApprovalService | ✅ | Auto-enqueue en cambio de estado |
| PandaDoc (firma) | ⚠️ | Integración a nivel de URL, no API directa |

## 6. Calidad técnica

| Criterio | Estado |
|---|---|
| Suite de regresión permanente | ✅ 640/640 |
| QA funcional RC-1 (4 escenarios) | ✅ 56/56 |
| Sin errores de sintaxis JS | ✅ |
| Sin cálculos KPI duplicados | ✅ |
| Core congelado y documentado | ✅ 8 documentos en docs/ |
| Filtros rogue empresa eliminados | ✅ 0 encontrados |
| renderDevoluciones filtro oficial | ✅ lista_recoleccion + estado_devolucion |
| Modal "Solicitar validación" eliminado | ✅ |

## 7. UX — Recomendaciones (TASK 06)

Sin cambios de código. Solo observaciones para iteración futura:

1. **Densidad informativa alta** en el Panel Ejecutivo — considerar progressive disclosure (expandir secciones bajo demanda)
2. **Tabla técnicos** podría beneficiarse de sparklines o mini-barras para comparación visual rápida
3. **Vista Backup** carece de acción masiva (asignar a usuario) — útil para el proceso de reasignación
4. **Filtros** podrían persistirse en sessionStorage para mantener contexto entre navegaciones
5. **Responsive en tablet** (768-1024px): el sidebar y el main se solapan — evaluar hamburger menu
6. **Feedback de guardado**: el toast desaparece rápido (2.8s) — considerar 4s para acciones críticas
7. **Empty states** en Aprobaciones y Devoluciones son correctos — mantener el patrón en las demás vistas

## 8. Optimizaciones aplicadas (TASK 07)

| Optimización | Impacto |
|---|---|
| DashboardStats cache 500ms | Evita recálculos en renders consecutivos |
| invalidate() en saveRecord | Garantiza datos frescos post-guardado |
| porTecnico.actas en buildDashboardStats | Elimina 1 buildDashboardStats() por técnico en renderTecnicos |
| getBDS() como alias | Transición gradual sin romper compatibilidad |

## 9. Riesgos pendientes antes de producción

| Riesgo | Severidad | Mitigación |
|---|---|---|
| HTTP 403 en GitHub Pages (usuarios sin permisos SharePoint) | Alta | Solicitar acceso de lectura al Excel antes del deploy |
| Datos incompletos en Excel (sin técnico/ciudad) | Media | Vista Calidad de datos en Ejecutivos muestra el gap |
| Backup records con empresa null | Baja | buildDashboardStats filtra correctamente |
| Latencia Graph API > 3s | Baja | Loading state ya implementado |
| Conflicto de concurrencia simultaneo | Baja | RC-07 VERSION check operativo |

## 10. Criterios de salida a producción (QA final pendiente)

- [ ] QA campo por campo: 146 registros reales verificados
- [ ] QA flujo completo: al menos 3 registros llevados de Pendiente a Renovación completada
- [ ] QA devolución: 1 equipo con ciclo completo lista_recoleccion → recibido
- [ ] QA aprobación: 1 ciclo completo Pendiente aprobación → Aprobar → estado final
- [ ] QA multiusuario: 2 sesiones simultáneas sin corrupción de datos
- [ ] QA mobile: revisión en pantalla 375px

---

**Firma técnica RC-1:** STAB-v13 — Suite 640/640 — QA RC-1 56/56
