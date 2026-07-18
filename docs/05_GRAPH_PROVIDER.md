# Graph Provider

## Responsabilidad

Lectura y escritura del Excel Maestro en SharePoint vía Microsoft Graph API.

## Endpoints utilizados

```
GET  /sites/{siteId}/drives/{driveId}/items/{fileId}/workbook/worksheets/{sheetName}/usedRange
PATCH /sites/{siteId}/drives/{driveId}/items/{fileId}/workbook/worksheets/{sheetName}/range(address=...)
```

## WriteContract — campos permitidos

Solo los campos en `ALLOWED_FIELDS` (graph.js) pueden escribirse en Excel.
Cualquier campo no listado es silenciosamente descartado por `filterWritable()`.

Secciones de ALLOWED_FIELDS:
1. Identificación (empresa, ciudad, nombre, etc.)
2. Equipo anterior (marca, modelo, serial, AF, tipo, etc.)
3. Estado logístico
4. Equipo nuevo (AF, serial, procesador, RAM, etc.)
5. Estado REN26
6. Gestión del acta
7. Devolución (incluye `observaciones_devolucion`)

## READONLY_FIELDS

Solo `id` y `fecha_devolucion` son de solo lectura.

## Control de concurrencia (RC-07)

- Cada registro tiene campo `VERSION` (número entero)
- Al guardar: `saveRecord()` lee la versión actual → incrementa → incluye en PATCH
- Si la versión difiere → conflicto detectado → alerta al usuario
- El eTag HTTP añade una segunda capa de protección a nivel de archivo
