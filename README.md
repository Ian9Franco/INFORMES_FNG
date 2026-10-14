# Informes FNG

Aplicación de seguimiento **personal** de trabajo en Meta Ads para Fanger Design. Permite registrar revisiones por cliente y día, describir cambios u observaciones, gestionar pendientes y emitir la planilla semanal que se entrega los lunes.

**Estado:** MVP en desarrollo sobre `main`. El PR fundacional [#1](https://github.com/Ian9Franco/INFORMES_FNG/pull/1) ya fue integrado. La interfaz operativa está disponible, pero **todavía no se considera lista para producción** hasta completar las validaciones de datos, Auth/RLS e impresión. Consultar [estado actual](docs/ESTADO_ACTUAL.md) y [limitaciones](#limitaciones-y-riesgos).

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
| Persistencia remota | Supabase PostgreSQL, `fng_records` por entidad y `fng_ad_accounts`; Auth + RLS + Realtime |
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

`npm test` verifica contratos, sincronización y migraciones en PostgreSQL aislado. Los scripts `verify-notebook.mjs` y `verify-cloud.mjs` comprueban la UI y dos navegadores con backend simulado. El lockfile está versionado.

## Base de datos y seguridad

La migración versionada está en [`supabase/migrations/20261013183000_create_personal_workspaces.sql`](supabase/migrations/20261013183000_create_personal_workspaces.sql). Se aplicó al proyecto Supabase **Informes FnG** (`zxhxerhksohymmyofvqb`).

```text
public.workspaces
  user_id    uuid  PK → auth.users.id (ON DELETE CASCADE)
  data       jsonb NOT NULL, default {}
  updated_at timestamptz NOT NULL, default now()
```

`workspaces` se conserva como respaldo previo. La persistencia activa usa `fng_records` (una fila por entidad, versión y fecha indexada) y `fng_ad_accounts` (vínculos únicos). Todas las tablas expuestas aplican RLS por `user_id`. Las nuevas migraciones están aplicadas y versionadas. Ver [sincronización v1](docs/SINCRONIZACION_V1.md) para el modelo, ingesta Companion, pruebas y preparación para notificaciones.

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

1. **Mi jornada:** muestra progreso, clientes activos revisados/no revisados hoy y pendientes abiertos.
2. **Semana:** matriz de lunes a sábado. Cada cliente puede tener **una revisión por fecha**, con campos de acciones y observaciones.
3. **Clientes:** búsqueda, filtros, alta, archivo/reactivación y eliminación definitiva solo cuando no existe historial; exportación/importación JSON.
4. **Informes:** selección de semana, vista previa y formato **grilla A4 vertical** o **informe detallado**. El diálogo del navegador permite imprimir o guardar como PDF.
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

Next expone `/manifest.webmanifest` e íconos. La nube conserva caché del período visible y una cola de cambios pendientes por usuario. El Service Worker contiene el receptor de notificaciones, pero aún no se implementó suscripción/envío Web Push ni un motor de recordatorios.

## Limitaciones y riesgos

- MVP en PR de borrador; sin despliegue productivo verificado.
- Pruebas de navegador realizadas con Auth/REST/Realtime simulados; el login real y los dispositivos físicos requieren validación de producción por el usuario.
- Sin historial inmutable de auditoría; hay registros/versiones y conflictos, pero no se conserva cada versión anterior de una nota.
- Validación de respaldo y gestión de errores de sincronización insuficientes para uso crítico.
- Sin fichas con historial filtrable por cliente ni vencimientos en pendientes.
- No hay API de Meta Ads ni información de métricas automática.
- Revisión manual de los nombres importados desde fotografía antes de uso real.

Ver [backlog](docs/BACKLOG.md) para tareas y criterios de aceptación, y [roadmap](docs/ROADMAP.md) para el orden sugerido.

## Convenciones de mantenimiento

El registro diario tiene un [modo rápido](docs/REGISTRO_RAPIDO.md) dentro de cada cliente, con guardar fijo, siguiente y borradores locales sin confirmar. El formulario completo permanece disponible para edición detallada.

Registrar los cambios funcionales en [CHANGELOG.md](CHANGELOG.md), actualizar [estado actual](docs/ESTADO_ACTUAL.md) al incorporar capacidades y mover las tareas del backlog cuando se verifique su aceptación. Mantener PR pequeños, compilación verde y la migración SQL versionada en Git. **No fusionar el PR hasta validar compilación, autenticación, RLS, persistencia e impresión A4.**

## Soporte planificado de Meta Ads y Google Ads

**El código actual continúa siendo una bitácora genérica con textos y clientes, originalmente rotulada «Meta Ads». La diferenciación real de plataformas y los recordatorios inteligentes NO están implementados.**

Se trabajará con el repositorio independiente [FNG-Companion](https://github.com/Ian9Franco/FNG-Companion), una extensión Chrome para detectar sesiones en **Meta Ads Manager y Google Ads** sin las Marketing APIs. Una sesión sugiere actividad, **no acredita modificaciones ni sustituye una revisión confirmada**.

La relación prevista es **cliente comercial → cuentas publicitarias por plataforma → sesiones detectadas y revisiones declaradas**. Una misma empresa puede tener varias cuentas Meta y Google. Si una cuenta no revela su ID, quedará como desconocida hasta mapearla manualmente.

Las alertas futuras tendrán dos orígenes: sesiones con documentación pendiente y revisiones **programadas** sin registro. No se exigirá revisar cada cuenta diariamente a menos que así se configure. Se definieron posponer para mañana/semana próxima/fecha personalizada, silencio mientras se registran notas y control de frecuencia.

**Para recibir notificaciones en un teléfono no alcanza con instalar la PWA:** serán necesarios Web Push, service worker, permisos, suscripciones del dispositivo y un programador de avisos en el backend. No se han creado endpoints, tablas ni secrets de push.

- [Contrato técnico con Companion](docs/COMPANION_INTEGRACION.md)
- [Reglas futuras de recordatorios y push](docs/RECORDATORIOS.md)
- [Repositorio Companion](https://github.com/Ian9Franco/FNG-Companion)

