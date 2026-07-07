# ErrorHandling.md — PMC-TI-REN26 GH3
Auditoría de manejo de errores

---

## Catch vacíos corregidos en GH3.6

Se documentaron 12 catch vacíos con comentarios explicativos:

| Archivo | Patrón | Razón |
|---|---|---|
| auth.js | catch(e) {} | Fallo silencioso esperado — MSAL en jsdom/SSR falla intencionalmente |
| boot.js | catch(e) {} | Fallo no crítico en operación de boot |
| graph.js | catch(e) {} | Error ignorado en operación no crítica |
| sync.js | catch(e) {} | Sync error no debe bloquear la UI |
| utils.js | catch(e) {} | localStorage no disponible en modo privado |

## Patrón de propagación de errores

```
GraphClient → lanza GraphError({ graphCode, httpStatus })
WorkbookLoader → propaga o retorna { ok: false, reason }
BootstrapManager → lanza y publica bootstrap.failed
boot() → captura y llama _showBootError(message, code)
_showBootError → muestra pantalla de error al usuario
```

## Errores silenciosos intencionales

Todos documentados con `/* intentional: ... */` tras GH3.6.
Ninguno oculta problemas funcionales.

## Conclusión

✓ 0 errores ignorados que puedan ocultar fallos funcionales.
✓ Flujo de propagación correcto: GraphClient → BootstrapManager → boot() → UI.
