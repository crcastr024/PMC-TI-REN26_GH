# RBAC (Control de Acceso Basado en Roles)

## Roles disponibles

| Rol | Nivel | Capacidades principales |
|---|---|---|
| super_admin | 5 | Todo |
| gestor_activos | 4 | Editar, aprobar, rechazar |
| director_ti | 4 | Ver todo, aprobar |
| gerencia | 3 | Ver dashboards ejecutivos |
| tecnico | 2 | Ver y editar sus propios registros |
| visitante | 1 | Solo lectura del Seguimiento |

## Resolución de rol

```javascript
// graph.js — F7_resolveRole(email)
1. Busca email en window.SYSTEM_USERS (lista Excel)
2. Mapea rol textual → rol canónico
3. Si no encuentra → fallback 'visitante'
4. Nunca auto-escala por dominio
```

## Permisos por operación

```javascript
// graph.js — WriteContract / RBAC
can('record.edit')      → gestor_activos, super_admin, tecnico (solo propios)
can('record.approve')   → gestor_activos, director_ti, super_admin
can('panel.view')       → todos excepto visitante
can('ajustes.view')     → super_admin
```

## Seguridad crítica

El banner `#auth-warn-banner` se muestra cuando `SYSTEM_USERS` no está disponible.
El rol fallback es siempre `visitante` — nunca se escala automáticamente.
