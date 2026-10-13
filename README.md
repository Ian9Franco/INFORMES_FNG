# Informes FNG

Aplicación de seguimiento **personal** de trabajo en Meta Ads para Fanger Design. Permite registrar revisiones por cliente y día, describir cambios u observaciones, gestionar pendientes y emitir la planilla semanal que se entrega los lunes.

**Estado:** MVP en desarrollo, PR [#1](https://github.com/Ian9Franco/INFORMES_FNG/pull/1) en borrador. Build CI [aprobado](https://github.com/Ian9Franco/INFORMES_FNG/actions/runs/38448153350). **No se considera listo para producción.** Consultar [estado actual](docs/ESTADO_ACTUAL.md) y [limitaciones](#limitaciones-y-riesgos).

## Índice de documentación

| Documento | Para qué sirve |
| --- | --- |
| [Estado actual](docs/ESTADO_ACTUAL.md) | Inventario verificable de lo implementado, lo parcial y lo que falta |
| [Changelog](CHANGELOG.md) | Evolución y cambios ya introducidos |
| [Backlog](docs/BACKLOG.md) | Tareas priorizadas con criterios de aceptación |
| [Roadmap](docs/ROADMAP.md) | Etapas de desarrollo, dependencias y condiciones para avanzar |

## Stack actual

| Capa | Tecnología |
| --- | --- |
| Aplicación web | Next.js 15, App Router, React 19, TypeScript |
| Estilos | CSS propio en `src/styles.css`, incluido `@media print` |
| Autenticación | Supabase Auth: correo y enlace de acceso (OTP/magic link) |
| Persistencia remota | Supabase PostgreSQL, tabla `public.workspaces` (JSONB por usuario) |
| Autorización | Row Level Security (RLS) por `auth.uid()` |
| Persistencia adicional | `localStorage` y respaldo JSON importable/exportable |
| PWA | Manifest e íconos; **sin service worker**, offline ni push |
| Calidad | GitHub Actions ejecuta `npm install` + `npm run build` |

**Importante:** No usa Vite, Tailwind, shadcn/ui, `@supabase/ssr` ni API de Meta Ads en esta versión. Aunque use App Router, el acceso a datos y la autenticación están implementados **del lado cliente**, no mediante cookies/SSR en servidor.

## Requisitos y arranque

- Node.js **22** recomendado (es la versión configurada en CI).
- npm.
- Un proyecto Supabase con Auth y la migración de `workspaces` aplicada.
- Correo con acceso a enlaces de confirmación; el proveedor y las URL de redirección de Auth deben estar configurados.

```bash
git clone https://github.com/Ian9Franco/INFORMES_FNG.git
cd INFORMES_FNG
git switch feat/pwa-foundation
npm install
cp .env.example .env.local
npm run dev
```

En Windows PowerShell se puede utilizar `Copy-Item .env.example .env.local`. Abrir [http://localhost:3000](http://localhost:3000).

En `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE
```

Son variables públicas del cliente; **no** agregar una clave `service_role`, `secret` ni una contraseña de base de datos al código cliente. El archivo `.env.local` está ignorado por Git. La clave publicable requiere RLS correctamente configurado.

En **Supabase Dashboard → Authentication → URL Configuration**, configurar el sitio de despliegue y permitir los redireccionamientos para cada entorno. En desarrollo: `http://localhost:3000/**`. El proveedor de correo debe estar habilitado y configurado. La creación de usuarios mediante enlace puede depender de los ajustes del proyecto.

### Comandos

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Servidor de desarrollo Next |
| `npm run build` | Compilación de producción y chequeo de tipos integrado de Next |
| `npm start` | Sirve la compilación de producción |
| `npm run lint` | **Solo** ejecuta `tsc --noEmit`. No ejecuta ESLint |

No existen aún comandos ni suites de test unitarios/e2e. No hay lockfile de dependencias confirmado en la rama; CI instala con `npm install`.

## Base de datos y seguridad

La migración versionada está en [`supabase/migrations/20261013183000_create_personal_workspaces.sql`](supabase/migrations/20261013183000_create_personal_workspaces.sql). Se aplicó al proyecto Supabase **Informes FnG** (`zxhxerhksohymmyofvqb`).

```text
public.workspaces
  user_id    uuid  PK → auth.users.id (ON DELETE CASCADE)
  data       jsonb NOT NULL, default {}
  updated_at timestamptz NOT NULL, default now()
```

RLS está habilitado; los permisos `SELECT`, `INSERT`, `UPDATE` y `DELETE` se limitan a filas donde el `user_id` corresponde al usuario autenticado. No hay tablas normalizadas para clientes, revisiones ni tareas: todo el estado se guarda dentro de `data`.

No aplicar de nuevo manualmente la migración a una base existente sin comprobar las políticas: las sentencias `CREATE POLICY` no usan `IF NOT EXISTS`.

### Forma del estado almacenado

```ts
type Store = {
  clients: { id: string; name: string; active: boolean }[]
  reviews: { id: string; clientId: string; date: string; createdAt: string; actions: string; observations: string }[]
  pending: { id: string; clientId: string; text: string; resolved: boolean }[]
  closed: string[] // claves YYYY-MM-DD de los lunes de semanas cerradas
}
```

La aplicación carga los datos de Supabase después del inicio de sesión. **Si no existe un workspace remoto**, importa una copia previa de `localStorage` o carga el catálogo inicial de 27 clientes. Cada cambio persiste el estado completo en `localStorage` y dispara un `upsert` del JSON remoto. El guardado se encadena dentro de una pestaña, pero **no existe control de versiones, transacciones por entidad ni resolución de conflictos entre dispositivos**: puede sobrescribirse información con una copia vieja.

La importación desde JSON requiere confirmación y reemplaza el estado completo. La validación estructural es básica; evitá importar archivos no confiables. Las observaciones y acciones podrían contener información de clientes; no deben considerarse protegidas por cifrado local ni listas para colaboración empresarial.

## Recorrido funcional

1. **Mi jornada:** muestra clientes activos revisados/no revisados hoy y pendientes abiertos.
2. **Semana:** matriz de lunes a sábado. Cada cliente puede tener **una revisión por fecha**, con campos de acciones y observaciones.
3. **Clientes:** alta y archivo (sin borrar historial), exportación/importación JSON.
4. **Informes:** selección de semana y formato **grilla A4 vertical** o **informe detallado**. El diálogo del navegador permite imprimir o guardar como PDF.
5. **Lunes:** se visualiza automáticamente la semana corriente limpia, independientemente de las anteriores. El cierre de la semana pasada es **manual**; no se genera ni se envía automáticamente el informe. Los pendientes sobreviven al cambio.

El informe detallado incluye pendientes abiertos **al momento de imprimir**, no un snapshot histórico del día del cierre. Los registros de semanas cerradas pueden reabrirse manualmente.

## Estructura técnica

```text
src/
  app/
    layout.tsx           # layout raíz, metadata y CSS
    page.tsx             # entrada al workspace
    manifest.ts          # web app manifest
    icon.svg             # ícono
  components/
    WorkspaceGate.tsx    # auth, carga y upsert de workspaces
  lib/
    supabase.ts          # cliente Supabase en navegador
  App.tsx                # dashboard, grilla, clientes e informes
  data.ts                # tipos, seed, fecha, localStorage
  styles.css             # interfaz responsive e impresión
public/icon.svg          # ícono manifest
supabase/migrations/     # DDL y RLS
.github/workflows/       # compilación CI
docs/                    # estado, backlog y roadmap
```

## Impresión y PWA

La impresión usa HTML y CSS con `@media print` y `@page { size: A4 portrait }`. No genera PDF del lado del servidor ni envía correos. Las opciones de papel, escala y márgenes finales dependen del navegador/impresora; se requiere validación visual con la planilla original.

Next expone `/manifest.webmanifest` e íconos. **Esto no implementa funcionamiento sin conexión**: no existe service worker, caché offline controlada, cola de sincronización ni notificaciones push.

## Limitaciones y riesgos

- MVP en PR de borrador; sin despliegue productivo verificado.
- Sin pruebas automáticas, sin lockfile, sin control de concurrencia entre dispositivos.
- Sin historial de auditoría ni cambios por entrada; se sobrescribe el JSON completo.
- Validación de respaldo y gestión de errores de sincronización insuficientes para uso crítico.
- Sin fichas con historial filtrable por cliente ni vencimientos en pendientes.
- No hay API de Meta Ads ni información de métricas automática.
- Revisión manual de los nombres importados desde fotografía antes de uso real.

Ver [backlog](docs/BACKLOG.md) para tareas y criterios de aceptación, y [roadmap](docs/ROADMAP.md) para el orden sugerido.

## Convenciones de mantenimiento

Registrar los cambios funcionales en [CHANGELOG.md](CHANGELOG.md), actualizar [estado actual](docs/ESTADO_ACTUAL.md) al incorporar capacidades y mover las tareas del backlog cuando se verifique su aceptación. Mantener PR pequeños, compilación verde y la migración SQL versionada en Git. **No fusionar el PR hasta validar compilación, autenticación, RLS, persistencia e impresión A4.**
