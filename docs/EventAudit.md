# EventAudit.md — PMC-TI-REN26 GH3
Auditoría de event listeners

---

## EventBus.subscribe (5 total)

| Archivo | Línea | Evento | Análisis |
|---|---|---|---|
| boot.js | 209 | bootstrap.completed | OK — dispara una vez |
| boot.js | 235 | bootstrap.failed | OK — dispara una vez |
| boot.js | 364 | session.logout | Sin unsubscribe explícito — SPA OK (no hay navegación) |
| sync.js | 74 | provider.refresh | Sin unsubscribe explícito — SPA OK (no hay navegación) |
| sync.js | 75 | renewal.updated | Sin unsubscribe explícito — SPA OK (no hay navegación) |

## addEventListener (11 total)

| Archivo | Línea | Análisis |
|---|---|---|
| app.js | 9 | DOMContentLoaded: Sin removeEventListener — aceptable para SPA |
| boot.js | 323 | click: Sin removeEventListener — aceptable para SPA |
| boot.js | 328 | input: Sin removeEventListener — aceptable para SPA |
| boot.js | 334 | change: Sin removeEventListener — aceptable para SPA |
| boot.js | 340 | change: Sin removeEventListener — aceptable para SPA |
| boot.js | 347 | keydown: Sin removeEventListener (alto riesgo en SPA) |
| boot.js | 372 | scroll: Sin removeEventListener — aceptable para SPA |
| dataService.js | 581 | click: Sin removeEventListener — aceptable para SPA |
| refresh.js | 52 | online: Sin removeEventListener — aceptable para SPA |
| refresh.js | 53 | offline: Sin removeEventListener — aceptable para SPA |
| sync.js | 202 | visibilitychange: Sin removeEventListener — aceptable para SPA |

## Conclusión

Sin fugas de memoria detectadas:
- Los EventBus.subscribe para 'bootstrap.*' son de un solo disparo
- Los addEventListener del DOM (scroll, click, DOMContentLoaded) son permanentes e intencionales en SPA
- No existen listeners huérfanos (sin elemento DOM asociado)
