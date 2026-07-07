# GH2 — MSAL Configuration Analysis
PMC-TI-REN26 · GitHub Pages SPA · Microsoft Entra ID

---

## GH2.2 — Parámetros MSAL para GitHub Pages

### auth.clientId / auth.authority

**Tipo:** Identificadores públicos, no secretos.  
Para aplicaciones SPA (Public Client Application), el clientId y tenantId son
públicos por diseño. PKCE reemplaza al client secret.

**Configurado:** Desde `PRODUCTION_CONFIG` (fuente única de verdad).

---

### auth.redirectUri

**Requisito GitHub Pages:** La URL base cambia según el repositorio
(`user.github.io/repo-name/`). No puede ser fija.

**Implementación:** Calculado dinámicamente:
```
origin + pathname sin el filename
```
Ejemplo: `https://heinsohn.github.io/pmc-ti-ren26/`

---

### auth.postLogoutRedirectUri

**Función:** Adónde redirige MSAL tras el logout.  
**Valor:** Mismo cálculo dinámico que redirectUri.  
Garantiza que después del logout el usuario vea la pantalla de login,
no una página 404.

---

### auth.navigateToLoginRequestUrl = false

**Función:** En flujo popup, MSAL no debe navegar de vuelta a la URL original.  
**Razón:** La SPA es de una sola página — no hay "vuelta" significativa.
Previene comportamientos inesperados post-login.

**Referencia Microsoft:** Recomendado para popup flow en SPA.

---

### auth.knownAuthorities

**Función:** Lista explícita de autoridades confiables para el tenant.  
**Valor:** `['login.microsoftonline.com']`  
**Seguridad:** Previene ataques de "open redirect" hacia autoridades falsas.

---

### auth.protocolMode = 'AAD'

**Función:** Fuerza el protocolo de Microsoft Entra ID (AAD).  
Garantiza Authorization Code + PKCE, no flujos obsoletos (Implicit Flow).

---

### auth.allowNativeBroker = false

**Función:** Deshabilita el broker nativo del sistema operativo (WAM).  
No aplica para SPA en navegador. Evitar activarlo previene errores
en entornos donde WAM no está disponible.

---

## GH2.3 — sessionStorage vs localStorage

### Análisis

| Aspecto | sessionStorage | localStorage |
|---|---|---|
| Duración | Hasta cerrar el tab | Indefinido |
| Acceso entre tabs | No (aislado) | Sí (mismo origen) |
| Superficie XSS | Menor | Mayor |
| Experiencia usuario | Login por sesión | Sesión persistente |
| Recomendación MS | Sí (aplicaciones sensibles) | Solo apps no críticas |

### Decisión: sessionStorage

**Justificación:** PMC-TI-REN26 gestiona activos tecnológicos corporativos con
datos financieros (presupuestos, órdenes de compra, SAP). Es una aplicación
de negocio con acceso a información confidencial.

El estándar corporativo es sessionStorage para aplicaciones que manejan:
- Datos financieros
- Activos de la empresa
- Información de empleados

El usuario debe autenticarse al abrir una nueva sesión de navegador.
Esto es aceptable y esperado para una herramienta interna corporativa.

### Microsoft Official Reference

> "If you're building a single page app that has a sensitive 
> data exposure risk, use sessionStorage."
> — MSAL.js documentation, cacheLocation options

---

## Flujo de autenticación completo (Authorization Code + PKCE)

```
1. Usuario abre https://heinsohn.github.io/pmc-ti-ren26/
2. MSAL detecta: no hay token en sessionStorage
3. boot() → pantalla de login (rc2-login-screen)
4. Usuario clic → msal.loginPopup()
5. MSAL genera: code_verifier (random) + code_challenge (SHA256)
6. Popup → Microsoft Entra ID /authorize?
     response_type=code
     code_challenge=<SHA256(code_verifier)>
     code_challenge_method=S256
     scope=User.Read Files.ReadWrite.All
7. Usuario autentica → Entra ID devuelve authorization_code
8. MSAL → Entra ID /token con code + code_verifier
9. Entra ID verifica: SHA256(code_verifier) === code_challenge
10. Entra ID devuelve: access_token + id_token + refresh_token
11. MSAL almacena tokens en sessionStorage
12. BootstrapManager.run() → carga usuarios/roles/config de Excel
13. bootstrap.completed → carga datos de negocio
14. Dashboard operativo
```

**Sin Implicit Flow.** Sin client_secret. Completamente conforme con
Microsoft Entra ID best practices para SPA 2024.
