# MemoryAudit.md — PMC-TI-REN26 GH3
Análisis de memoria

---

## Objetos globales (window.*)

| Objeto | Tamaño estimado | Liberación | Estado |
|---|---|---|---|
| window.USERS | ~146 registros × ~800B | Al cerrar tab | OK |
| window.INVENTORY | ~146 registros × ~400B | Al cerrar tab | OK |
| window.SYSTEM_USERS | 5 registros | Al cerrar tab | OK |
| window.LOGOS | ~24KB (4 PNG base64) | Al cerrar tab | OK |
| GraphResolver._cache | 3 IDs strings | Al cerrar tab | OK — no en storage |
| GraphCache | Por defecto 5min TTL | Por TTL | OK |
| WriteQueue._queue | Array vacío en reposo | Por flush | OK |

## Closures potencialmente retenidos

- `SynchronizationManager`: retiene referencia al workbook meta más reciente (string). OK.
- `GraphResolver`: retiene { siteId, driveId, itemId }. Solo 3 strings cortos. OK.
- `SessionManager`: retiene la sesión del usuario. Al cierre de tab: liberado. OK.

## Referencias circulares

Ninguna detectada. Los módulos se comunican a través de `window.*` y no retienen
referencias cruzadas que impidan la recolección de basura.

## Conclusión

✓ Sin pérdidas de memoria detectadas.
✓ Sin referencias circulares.
✓ El mayor consumo de memoria son los datos del Excel (~450KB) — aceptable.
