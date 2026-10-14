# Estado actual — Informes FNG

**Corte documental:** 2026-10-13.  
**Repositorio:** [Ian9Franco/INFORMES_FNG](https://github.com/Ian9Franco/INFORMES_FNG)  
**Implementación actual:** rama `main`; el [PR fundacional #1](https://github.com/Ian9Franco/INFORMES_FNG/pull/1) ya fue fusionado.
**Madurez:** MVP técnico / prototipo funcional, **no validado para producción**.

## Propósito del producto

Bitácora personal de optimización y revisiones de Meta Ads para organizar el trabajo diario. La salida requerida por el equipo es una planilla **A4 vertical** de clientes × lunes-sábado, que se entrega completa los lunes, más un informe extendido opcional. La nueva semana no debe borrar el historial ni los pendientes de semanas anteriores.

## Inventario de capacidades (según código)

| Área | Estado | Detalle |
| --- | --- | --- |
| Next.js + React + TypeScript | Implementado | Next 15 App Router, React 19, sin Vite |
| Pantalla Mi jornada | Implementado | Cantidad revisada hoy, por revisar y pendientes |
| Listado de clientes | Implementado | 27 nombres iniciales; búsqueda, filtros, alta, archivo/reactivación y borrado seguro sin historial |
| Grilla semanal | Implementado | LUN–SÁB, selección de cliente × fecha |
| Revisión / acciones / observaciones | Implementado | Una revisión por cliente/día, texto libre |
| Pendientes | Implementado | Crear desde revisión, cerrar desde jornada, persisten entre semanas |
| Cambio de semana | Implementado | Cálculo automático de lunes y navegación por semanas |
| Cierre y reapertura | Implementado | Bloquea edición en la grilla; cierre manual reversible |
| Exportación | Implementado | Vista previa, HTML imprimible A4 y opción «Guardar como PDF» del navegador |
| Backups | Implementado parcialmente | JSON manual y copia `localStorage`, validación superficial |
| Auth | Implementado en código | Supabase sign-in por magic link; falta verificación end-to-end |
| Persistencia remota | Implementado en código | `public.workspaces`, snapshot JSONB por usuario |
| RLS | Aplicado/verificado | Políticas por `auth.uid()` en tabla del proyecto conectado |
| PWA | Parcial | Manifest e íconos, sin service worker/offline/push |
| Historial detallado por cliente | Pendiente | Los datos existen, pero no hay ficha filtrable dedicada |
| Métricas automáticas Meta Ads | Fuera del MVP | Sin integración con Graph API |
| Envío de informes | Pendiente | Solo imprimir/guardar PDF manualmente |
| Colaboración multiusuario | Pendiente | Usuarios separados; sin organizaciones ni permisos compartidos |
| Tests y despliegue | Pendiente | CI de compilación; sin suite de pruebas ni URL de producción validada |

**Aclaración sobre semanas:** la nueva grilla no se crea como un registro independiente al comenzar el lunes. Se **calcula** a partir de las fechas existentes y aparece vacía si no hay revisiones. No hay cierre ni correo automático.

## Arquitectura actual

```text
Navegador / Next.js App Router
  └─ src/app/page.tsx
      └─ WorkspaceGate (client component)
          ├─ Supabase Auth (magic link)
          ├─ select/upsert public.workspaces
          └─ App (interfaz y estado)
              ├─ Mi jornada
              ├─ Semana
              ├─ Clientes
              └─ Informes (CSS @media print)
                    ↳ localStorage (copia y backups manuales)

Supabase PostgreSQL
  public.workspaces (user_id PK, data JSONB, updated_at)
  RLS: user_id = auth.uid()
```

No se usa `@supabase/ssr`, middleware/proxy de sesión ni Server Actions para operar sobre clientes. Las consultas se hacen con el SDK público desde el navegador usando Auth + RLS.

## Estado de verificación

- **Confirmado en Supabase:** proyecto «Informes FnG» con referencia `zxhxerhksohymmyofvqb`; tabla `public.workspaces` existente y RLS habilitado.
- **Estado local:** el PR #1 está integrado en `main` y el repositorio local sigue `origin/main`.
- **Build previo:** ejecución del 2026-10-13 [GitHub Actions #38447396426](https://github.com/Ian9Franco/INFORMES_FNG/actions/runs/38447396426) terminó en **failure** por `Property 'catch' does not exist on type 'PromiseLike<void>'` en `WorkspaceGate.tsx`. Se incluyó una corrección en esta iteración; verificar el check del nuevo commit antes de declarar la compilación aprobada.
- **Build de esta iteración:** [GitHub Actions #38448153350](https://github.com/Ian9Franco/INFORMES_FNG/actions/runs/38448153350), **success** (instalación y `npm run build`). No equivale a pruebas funcionales del producto.
- **Sin evidencia aún** de pruebas E2E de login, sincronización entre dos dispositivos, impresión física A4 ni instalación PWA en equipos reales.

## Riesgos y deuda técnica principales

1. **Pérdida de datos por concurrencia:** el estado de todas las entidades se sobrescribe como un JSON completo. Dos dispositivos editando simultáneamente pueden pisarse.
2. **Falsos positivos de guardado:** la UI actual no confirma transacciones remotas por cada cambio ni da un reintento sólido ante errores.
3. **Seguridad y uso comercial:** RLS protege filas por usuario, pero los respaldos y `localStorage` quedan en el dispositivo. El alta mediante OTP no implica pertenencia a Fanger.
4. **Recuperación:** validación incompleta de JSON importado, sin snapshots versionados ni backup automatizado.
5. **Informe histórico:** pendientes impresos son los que están abiertos al momento de imprimir, no necesariamente los del cierre semanal.
6. **PWA real:** manifest no implica cola offline, push, instalación garantizada ni sincronización en segundo plano.
7. **Calidad:** pruebas automáticas inexistentes; etiquetas «lint» reflejan TypeScript, no ESLint.

## Definición de «listo para usar en el trabajo»

La versión no debería considerarse apta para datos operativos hasta tener: build exitoso, Auth/redirect probados, RLS validado con dos identidades, sincronización con confirmación/errores, exportación/recuperación probada, y salida A4 contrastada con la hoja original. Los criterios granulares están en [BACKLOG.md](BACKLOG.md).

## Registro de decisiones

| Decisión | Motivo |
| --- | --- |
| Next.js App Router, no Vite | Elección explícita del proyecto |
| Supabase con RLS por usuario | Persistencia separada y autenticada |
| Snapshot JSONB inicial | Simplifica el primer MVP; requiere normalización posterior |
| Revisión ≠ modificación | Revisar una cuenta sin cambios cuenta como revisión |
| Nuevo lunes no borra pendientes | La planilla es un reporte, no la fuente de verdad |
| Impresión A4 vertical | Reproduce el formato entregado por el equipo |

## Ampliación de alcance: Google Ads y FNG Companion (2026-10-13)

**Decisión documentada, no funcionalidad implementada en INFORMES FNG.** Se incorpora Google Ads como plataforma de primera clase en el diseño. Una empresa podrá vincular una o varias cuentas publicitarias a cualquiera de las dos plataformas. Las revisiones actuales siguen siendo registros cliente/fecha y las pantallas aún mencionan Meta Ads; falta migrar el modelo y la interfaz a `platform` + `ad_account`.

Se creó el repositorio [FNG-Companion](https://github.com/Ian9Franco/FNG-Companion), con una propuesta de detectar sesiones desde Chrome. Al momento de este corte, **no hay ingesta, vínculo de cuentas, recordatorios automáticos ni Web Push funcional en esta PWA**.

Se diseñaron dos fuentes de aviso: (1) sesión publicitaria detectada sin revisión/nota asociada después de un tiempo de espera; (2) revisión planificada y omitida, independientemente de si la extensión vio navegación. La ausencia de sesión **no prueba** que no se haya trabajado en otro navegador o dispositivo.

Documentación: [COMPANION_INTEGRACION.md](COMPANION_INTEGRACION.md), [RECORDATORIOS.md](RECORDATORIOS.md).

