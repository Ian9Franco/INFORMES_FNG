# Histórico, uso del Free tier y sincronización PC / móvil

**Documento de diagnóstico previo.** La primera fase ya está implementada: ver [SINCRONIZACION_V1.md](SINCRONIZACION_V1.md). El esquema y los límites descritos como «actuales» abajo corresponden a la versión anterior basada en snapshots.

## Qué guarda hoy la app

`WorkspaceGate.tsx` lee `public.workspaces.data` para el usuario autenticado y vuelve a escribir el snapshot completo cuando cambia el estado de App. La tabla tiene `user_id` como clave primaria, `data` JSONB y `updated_at`. RLS limita el acceso a la fila propia.

El JSON contiene:

- `clients`: clientes activos/archivados y vínculos a cuentas publicitarias reales.
- `reviews`: revisiones por cliente y fecha, acciones, cantidades y observaciones.
- `pending`: pendientes y su estado resuelto.
- `closed`: lunes de semanas cuya edición se bloqueó.
- `accountCatalogVersion`: versión de la vinculación inicial de cuentas.

No se guarda un PDF por semana ni un resumen separado por cada mes. PNG/PDF se generan en el navegador. Tema y título personalizado permanecen en el almacenamiento local del dispositivo.

Cambiar de semana no elimina las revisiones anteriores. Sin embargo, esto es historial de trabajo, no un registro inmutable de auditoría: una revisión se puede editar o quitar y un respaldo importado puede reemplazar el conjunto de datos.

## Consultar un mes con el esquema existente

Después de la carga inicial, se pueden filtrar revisiones en memoria por `date >= inicio && date < inicioMesSiguiente` sin otra consulta. Las fechas de revisión son `YYYY-MM-DD`, por lo que mantienen el orden cronológico. Para consultar sólo el mes desde Postgres, una futura RPC autenticada puede extraer el array JSON; esta consulta ilustra el filtro, no está desplegada como endpoint:

```sql
select review
from public.workspaces as workspace
cross join lateral jsonb_array_elements(workspace.data->'reviews') as entries(review)
where workspace.user_id = (select auth.uid())
  and review->>'date' >= '2026-10-01'
  and review->>'date' < '2026-11-01'
order by review->>'date', review->>'clientId';
```

La extracción evita devolver todo el histórico al navegador, pero todavía examina el array del usuario. Para consultas frecuentes, conviene separar las revisiones en filas e indexar `(user_id, date, client_id)`.

## Problema actual entre dispositivos

La app carga datos al iniciar sesión. No hay suscripción Realtime ni lectura al volver a primer plano. `initialData` se usa una sola vez para inicializar App. Además, las escrituras reemplazan todo el JSON y no verifican su versión; si PC y móvil editan al mismo tiempo pueden sobrescribir cambios del otro.

Un móvil que abre una sesión nueva con el mismo usuario debería cargar el snapshot remoto guardado. Si muestra cero, revisar si figura **En este dispositivo** (sin nube), si se usó otro correo y si la PC muestra un error de sincronización. La pantalla de inicio y Safari pueden tener contextos de almacenamiento/sesión diferentes: ambos deben autenticar al mismo usuario.

## Modelo recomendado para conectar Companion

Separar el estado en tablas pequeñas, migrando los registros existentes sin cambiar sus IDs:

| Tabla | Qué guarda | Clave/índice importante |
| --- | --- | --- |
| `clients` | Nombre y estado del cliente | propietario + ID de cliente |
| `ad_accounts` | Plataforma y ID externo real | único `(user_id, platform, external_id)` |
| `review_entries` | Revisión confirmada por cliente/día, notas y versión | único `(user_id, client_id, date)` |
| `review_actions` | Tipos de acciones y cantidades confirmadas | ID de revisión + tipo de acción |
| `activity_events` | Eventos verificables enviados por Companion | único `(user_id, source_event_id)` |
| `tasks` | Pendientes y resolución | `(user_id, resolved)` |
| `week_closures` | Semanas cerradas | único `(user_id, monday)` |
| `push_subscriptions` | Suscripción Web Push de cada dispositivo | usuario + endpoint |

Los IDs históricos de clientes siguen siendo texto. Las cuentas externas también: nunca convertirlas a Number. Todas las tablas expuestas requieren RLS por propietario; la extensión debe autenticar al mismo usuario mediante permisos acotados, sin recibir una clave service_role.

Flujo propuesto:

1. Web o Companion envía una operación con usuario, cuenta externa, UUID de evento, instante UTC y contenido mínimo.
2. El servidor resuelve la cuenta a `client_id`, deduplica el UUID y guarda esa operación en una transacción. Ediciones de una revisión requieren su versión vigente para detectar conflictos.
3. Una revisión confirmada actualiza el progreso diario. Navegar por una cuenta o detectar una sesión sólo genera evidencia pendiente de confirmar: no completa automáticamente la revisión.
4. PC y móvil, autenticados como el mismo usuario, escuchan cambios del usuario mientras la app está visible. Actualizan el registro afectado y recalculan contadores; no recargan todo el histórico.
5. Al abrir/reanudar la app, se consulta el día/semana visible para recuperar cambios que sucedieron cuando estaba cerrada. La caché local sirve para continuidad; la nube conserva el estado compartido.

Los límites de día para eventos UTC se calculan en `America/Argentina/Buenos_Aires`. Una fecha de revisión explícita se mantiene como fecha local. Los formularios abiertos no se reinicializan silenciosamente cuando llega un cambio remoto: se muestra un conflicto si alguien editó la misma revisión.

## Cuidar recursos

Según la [tarifa oficial](https://supabase.com/pricing), Free incluye 500 MB de base y 5 GB de egress. No se verificó en esta sesión la ocupación real del proyecto: el conector solicitó autenticación repetidamente y no devolvió los resultados de las consultas.

- Guardar datos de negocio, no capturas, PDFs, URLs completas ni telemetría de cada clic. Conservar la generación PNG/PDF en el navegador.
- Escribir al guardar/confirmar una operación; agrupar eventos de Companion, deduplicar reintentos y evitar envíos por tecla.
- Leer sólo el período solicitado y sólo las columnas necesarias. Obtener contadores con agregaciones, sin descargar todas las notas.
- Suscribir sólo el usuario y las tablas necesarias, desconectar cuando la app está oculta y recuperar el período visible al regresar. Evitar polling cada segundo y un canal por cliente.
- Mantener caché por usuario, con estado de sincronización visible y una cola durable para operaciones pendientes. Reintentar con espera creciente cuando no hay conexión.
- Revisar tamaño y transferencia reales antes de agregar índices o mecanismos de limpieza. No purgar revisiones históricas para ahorrar unos pocos KB.
- Los eventos crudos pueden tener una política de conservación corta si sus acciones ya fueron confirmadas y se decidió cuánto respaldo/auditoría se necesita; las revisiones históricas se conservan.

Como estimación, 40 clientes × 6 días × 52 semanas son unas 12.480 revisiones al año. A 0,5–1 KB de datos de negocio por revisión serían aproximadamente 6–12 MB/año antes de índices, overhead y textos más largos. El problema temprano del snapshot es reescribir/transferir todo el histórico y las colisiones entre dispositivos, más que el almacenamiento de ese volumen de texto.

## Notificaciones con la app cerrada

Realtime sincroniza la interfaz mientras está ejecutándose. Para notificar con la PWA cerrada se necesitan Service Worker, suscripción Web Push, permiso explícito y envío desde servidor. No basta con instalar el manifest ni mantener un WebSocket.

En iOS/iPadOS 16.4 o posterior, Web Push está disponible para webs añadidas a la pantalla de inicio y la solicitud de permiso debe surgir de una acción del usuario. Ver la [documentación de WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

El servidor debe enviar recordatorios sólo si siguen existiendo pendientes reales, con deduplicación de envíos. Al tocar la notificación, la app abre el día relevante y recupera la información vigente.

Esta propuesta no modifica el esquema remoto ni implementa todavía Realtime, integración Companion o Web Push.
