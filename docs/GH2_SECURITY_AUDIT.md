# GH2 — Security Audit Report
PMC-TI-REN26 · GitHub Pages · 2026-07-07

---

## Resumen ejecutivo

El Dashboard puede publicarse como repositorio público en GitHub.
Los datos del Excel Maestro están protegidos por Microsoft Entra ID y
los permisos de SharePoint — no por la visibilidad del código.

---

## Tabla de auditoría

| Elemento | Ubicación | Riesgo | Acción |
|---|---|---|---|
| clientId | js/config.js | BAJO — identificador público para SPA | Conservar — no es un secreto |
| tenantId | js/config.js | BAJO — tenant público | Conservar — requerido para MSAL |
| driveId / itemId | js/config.js | MEDIO — identifica el Excel en SP | Conservar — requiere auth para usar |
| siteId | js/config.js | MEDIO — identifica el sitio SP | Conservar — requiere auth para usar |
| client_secret | N/A | — | No existe — SPA no usa client secret |
| Tokens | sessionStorage (runtime) | BAJO — no persisten en repo | No están en el repositorio |
| PMC_DATA embebido | Eliminado en RC2 | ELIMINADO | 0 registros en el HTML |
| Correo interno | js/utils.js:68 | BAJO | Eliminado — reemplazado por placeholder |
| Nombres técnicos | js/init.js:28 | BAJO | Eliminado — reemplazado por genéricos |
| console.log | 76 instancias | BAJO | Eliminados — no exponen datos en prod |
| Google Fonts CDN | index.html | MUY BAJO | Eliminado — fonts del sistema |
| Datos personales | 0 en código | NINGUNO | PMC_DATA fue eliminado en RC2 |
| Stack traces | 0 | — | console.error solo para errores críticos |

---

## Estado de información sensible

### ¿Se puede publicar el repositorio como público?

Sí, con las siguientes consideraciones:

**Lo que sí es público (y está bien):**
- clientId: Es un identificador de la App Registration. Por diseño,
  las SPA deben tener el clientId visible — es el estándar de PKCE.
- tenantId: El tenant ID de Heinsohn puede ser derivado del email corporativo.
- graphEndpoint: URL pública de Microsoft Graph.

**Lo que requiere protección adicional:**
- driveId / itemId / siteId: Identifican el Excel Maestro en SharePoint.
  Un atacante con estos IDs necesitaría además:
  1. Una cuenta válida en el tenant de Heinsohn
  2. Permisos en el sitio SharePoint específico
  3. Permisos en el archivo Excel
  Sin credenciales válidas, estos IDs son inútiles.

**Recomendación:**
Para un repositorio público corporativo, es preferible que driveId/siteId/itemId
vivan en un archivo `.env.js` NO incluido en el repositorio, y que el repositorio
tenga un `.env.example` con valores vacíos.

Para uso actual (repositorio privado o público con acceso restringido):
el proyecto está listo para publicar.

---

## Acceso a datos: garantizado por Microsoft Entra ID

```
Repositorio público GitHub
  ↓ código visible
index.html → MSAL → Microsoft Entra ID ← solo autorizados
                          ↓
                    Microsoft Graph
                          ↓
                    SharePoint ACLs ← permisos de SP
                          ↓
              Plan_Maestro_REN26.xlsx
```

Un usuario no autorizado que descargue el código NO puede acceder a los datos
sin credenciales válidas de Heinsohn + permisos en SharePoint.

---

## Cambios aplicados en GH2

- 76 console.log/info/debug eliminados
- MSAL logger: solo errores críticos (LogLevel.Error = 0)
- Email interno crcastro@heinsohn.com.co: reemplazado por placeholder
- Nombres de técnicos en demo: genéricos (Técnico A, B, C)
- Google Fonts CDN: eliminado, stack de sistema
- MSAL: knownAuthorities, protocolMode, allowNativeBroker, piiLoggingEnabled
- robots.txt: Disallow: / (evitar indexación)
- graphEndpoint y sharepointHost centralizados en config.js
