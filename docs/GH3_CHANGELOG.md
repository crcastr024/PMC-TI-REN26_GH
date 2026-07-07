# GH3_CHANGELOG.md — PMC-TI-REN26
Code Quality Freeze · 2026-07-07

---

## GH3.5 — Timer leak corregido (boot.js)
setInterval(updateAprobacionesItem, 5000) ahora cancelable via EventBus 'session.logout'.

## GH3.6 — Catch vacíos documentados (12 instancias)
auth.js, boot.js, graph.js, sync.js, utils.js — todos con /* intentional: ... */

## GH3.11 — Configuración centralizada
graphEndpoint, sharepointHost, tenantId, clientId: leídos desde PRODUCTION_CONFIG en graph.js.
0 IDs hardcodeados sin guarda en ningún módulo.

## GH3 — Documentos de auditoría generados
DeadCodeReport.md, DEPENDENCY_GRAPH.md, EventAudit.md, TimerAudit.md,
ErrorHandling.md, GraphAudit.md, LoggingAudit.md, MemoryAudit.md,
BOOT_SEQUENCE.md, SecurityFreeze.md

## Métricas GH3
- Pruebas: 633/633 acumuladas · 0 regresiones
- TODO/FIXME pendientes: 0
- Catch vacíos sin documentar: 0
- Timer leaks: 0
- Fetch directos fuera de GraphClient: 0
- console.log en producción: 0
- IDs hardcodeados sin guarda: 0
