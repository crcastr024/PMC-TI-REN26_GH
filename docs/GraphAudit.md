# GraphAudit.md — PMC-TI-REN26 GH3
Auditoría de llamadas HTTP

---

## Patrón establecido

Toda comunicación con Microsoft Graph debe pasar por GraphClient.
No se permiten fetch() directos para Microsoft Graph.

## fetch() directos encontrados (5)

| Archivo | Línea | Contexto | Veredicto |
|---|---|---|---|
| graph.js | 89 | 'const response = await fetch(url, options);' | OK — GraphClient interno (es el wrapper) |
| graph.js | 143 | 'const response = await fetch(url, { headers });' | OK — JSONProvider (solo modo desarrollo, nunca en dataSource=excel) |
| graph.js | 156 | "const response = await fetch(url, { method: 'PUT', headers, " | OK — JSONProvider (solo modo desarrollo, nunca en dataSource=excel) |
| graph.js | 1317 | "const res = await fetch(this.source, { cache: 'no-store' });" | OK — JSONProvider (solo modo desarrollo, nunca en dataSource=excel) |
| graph.js | 1425 | "keys.map(k => fetch(this.sources[k], { cache: 'no-store' })" | OK — JSONProvider (solo modo desarrollo, nunca en dataSource=excel) |

## Verificación por modo de producción

Con `dataSource: 'excel'` (producción):
- DataService → ExcelProvider → WorkbookLoader → GraphClient ✓
- JSONProvider NUNCA es instanciado en producción ✓
- GraphProvider NUNCA es instanciado en producción ✓

## Conclusión

✓ Todos los accesos a Microsoft Graph pasan por GraphClient.
Los fetch() directos pertenecen a proveedores de desarrollo (JSONProvider, SplitJsonProvider)
que nunca son activados con la configuración de producción.
