# REN26 — Política de desarrollo (desde STAB-v08)

## Rama estable congelada

| Tag | Rama | Suite | Fecha |
|---|---|---|---|
| `STAB-v08` | `release/STAB-v08` | 640/640 | 2026-07-15 |

La rama `release/STAB-v08` es inmutable. No se desarrolla sobre ella.

---

## Flujo de trabajo

```
main ──────────────────────────────────────────────── production
  └── feature/NOMBRE ──► PR ──► checklist ──► merge
```

Toda rama de desarrollo sale desde `main`. Ejemplos válidos:

```
feature/f4-dashboard
feature/rbac-fixes
feature/raee-motor
feature/reportes
feature/sharepoint
feature/rc-08
```

Nunca desarrollar directamente sobre `main` ni sobre `release/STAB-v08`.

---

## Checklist obligatorio antes de merge

Ejecutar `node /home/claude/test_STAB_v08.js` y todos los archivos `test_*.js`.
Si falla un solo punto → no hay merge.

```
□ Proyecto compila sin errores de sintaxis
□ 0 ReferenceError en consola
□ 0 TypeError en consola
□ renderView() sin funciones inexistentes
□ Todas las vistas cargan (resumen, usuarios, tecnicos, ciudades,
  devoluciones, reportes, aprobaciones, panel)
□ Modal REN26 abre y renderiza todas las secciones
□ Sidebar expande/contrae correctamente
□ Footer no invade el sidebar
□ RBAC correcto por rol
□ Persistencia Excel correcta (ciclo campo por campo)
□ Suite STAB-v08: 640/640
□ 0 regresiones visuales
```

---

## Formato de cada cambio

Todo PR o commit que modifique código debe declarar:

```
Archivos modificados: ui.js, components.css
Motivo: corrección de visibilidad de secciones 6 y 7
Impacto: modal de edición REN26
Riesgo: Bajo
Rollback: git checkout STAB-v08 -- js/ui.js css/components.css
```

---

## Regla de modificación de código

**Antes de eliminar, mover o refactorizar cualquier función:**

1. Ejecutar análisis completo de referencias (call graph).
2. No eliminar código mientras exista al menos una referencia activa.
3. Si una función va a ser sustituida: primero actualizar todos los
   puntos de invocación, luego eliminar la implementación anterior.
4. Nunca usar operaciones de corte masivo del archivo (`slice`,
   `substring`, `truncate`, etc.) para eliminar bloques de código.
5. Las modificaciones son quirúrgicas y preservan la integridad del archivo.
6. Cada cambio se verifica con `node --check` antes de guardar.

---

## Rollback de emergencia

```bash
# Restaurar un archivo individual
git checkout STAB-v08 -- js/ui.js

# Restaurar todo el build
git checkout STAB-v08

# Suite de verificación post-rollback
node test_STAB_v08.js
```
