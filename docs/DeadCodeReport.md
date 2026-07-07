# DeadCodeReport.md — PMC-TI-REN26 GH3
Análisis de código muerto

---

## Metodología

Se analizaron todas las funciones exportadas en `window.*` y se verificó su uso
en el código fuente, en los eventos HTML (onclick), y en la arquitectura.

## Módulos de desarrollo no usados en producción

Los siguientes módulos existen en el código pero NUNCA son instanciados con
`dataSource: 'excel'` (configuración de producción):

| Módulo | Archivo | Estado | Decisión |
|---|---|---|---|
| JSONProvider | graph.js | Solo con dataSource='json' | CONSERVAR — necesario para desarrollo sin SharePoint |
| SplitJsonProvider | graph.js | Solo con dataSource='json' | CONSERVAR — ídem |
| GraphProvider | graph.js | Solo con dataSource='graph' | CONSERVAR — alternativa futura |
| MockProvider | provider.js | Solo con dataSource='mock' | CONSERVAR — necesario para tests |

## Funciones de UI exportadas en window.*

Las siguientes funciones están en `window.*` y son llamadas directamente desde el HTML
(onclick handlers, data attributes) o desde otras funciones de render. No son dead code.

Ejemplos: `openEditModal`, `closeModal`, `saveRecord`, `goView`, `notify`,
`toggleTheme`, `renderAprobaciones`, `openBlockModal`, etc.

## Exports realmente muertos

Tras análisis exhaustivo: **0 funciones completamente inaccesibles**.
Los candidatos del análisis automático son todos accedidos vía:
- onclick HTML directo
- EventBus callbacks
- Cadenas de render
- Modo de desarrollo

## Conclusión

✓ 0 código muerto eliminable sin romper funcionalidad.
Los proveedores de desarrollo se conservan para permitir pruebas sin SharePoint.
