# Sincronización v1 implementada

## Probar en producción

1. Recargar la web en PC y móvil para usar la nueva versión.
2. Ingresar con el **mismo correo** en ambos dispositivos. Se admite magic link o contraseña de Supabase.
3. Abrir primero el dispositivo donde están los registros previos. La primera cuenta importa sus datos locales; si otro dispositivo ya inicializó la nube, usar **Unir registros de este dispositivo**. La unión añade revisiones faltantes sin reemplazar las existentes.
4. Guardar una revisión y esperar **Guardado y sincronizado**. El otro dispositivo recibe el cambio. Al volver a primer plano recupera el período visible.
5. En Informes seleccionar **Histórico mensual** y el mes. La planilla mensual muestra revisiones/acciones/última fecha por cliente; el detalle conserva notas y acciones.

Las URL y la clave **publicable** del proyecto están en `.env.production`. No son credenciales de usuario ni service_role; toda operación requiere Auth y RLS. Se incluyen para que el push active la nube sin depender de variables ausentes en Vercel. Desarrollo continúa en modo local salvo que se configure `.env.local`.

Para magic links, configurar en Supabase Auth → URL Configuration el Site URL de producción y las redirecciones permitidas. Si el correo dirige a una URL incorrecta, la pantalla ofrece pegar el enlace original para verificar su token de un solo uso directamente, sin guardarlo. También admite contraseña para cuentas que ya la tienen.

## Modelo real

Se eligió un esquema compacto: `fng_records` guarda **una fila por entidad**, no un snapshot completo. `kind` distingue `client`, `review`, `task`, `closure`, `settings`, `event` y el tipo reservado `subscription`. Cada fila tiene propietario, ID histórico de texto, payload JSON de esa entidad, versión, tombstone, fecha indexada y timestamp del servidor.

`fng_ad_accounts` vincula `(user_id, platform, external_id)` a un único cliente. La base valida cuentas, revisiones y acciones; conserva semanas cerradas y rechaza eliminar clientes con historial. `fng_apply_changes` realiza lotes atómicos y verifica `expectedVersion`. Las filas eliminadas usan tombstones para que todos los dispositivos reciban la eliminación.

Las migraciones antiguas `workspaces` se conservan como respaldo. Los snapshots existentes se expanden sin cambiar IDs. La nueva app deja de escribir snapshots; sus cambios pasan por registros individuales.

## Consumo

- Lectura inicial: clientes, tareas, cierres, settings y período actual.
- Histórico: sólo el rango de fechas solicitado, paginado en lotes de 500; períodos visitados se reutilizan en memoria.
- Escritura: sólo registros modificados, agrupados tras 350 ms, máximo 150 por lote.
- Realtime: un canal por usuario, desconectado cuando la página está oculta. Al regresar se recuperan metadata y período activo, sin polling por segundo.
- Cola local por usuario; espera creciente hasta 60 s frente a errores. Los conflictos no se reintentan ciegamente.
- Caché offline limitada al período visible. Exportar respaldo es una lectura completa explícita; los PNG/PDF no se suben a Supabase.

La metadata de tareas resueltas/cierres todavía se carga completa. Para volúmenes mayores se puede paginar/archivar esos históricos. No se implementó retención destructiva de sesiones ni revisiones.

## Companion

Actualizar la extensión desde el repositorio Companion: `npm install`, `npm run build`, recargar `dist` en Chrome. En su panel ingresar correo y contraseña de la misma cuenta. Si la web usa magic link, en **Clientes → Conectar Companion** se puede definir una contraseña (mínimo 12 caracteres).

Sólo se sincroniza tras ese login explícito. Supabase guarda la sesión de la extensión en `chrome.storage.local`; no se copia el token de la PWA ni se usa service_role. Las sesiones se vinculan a un usuario para evitar reenviar el historial a otro login.

`fng_ingest_activity(events)` requiere sesión autenticada, valida tiempos/cantidades, resuelve el ID externo al cliente del usuario y deduplica por `(user_id, kind=event, id)`. La extensión envía como máximo 50 sesiones por lote y reintenta con espera creciente. No sube URLs ni cookies.

La bandeja **Actividad de tu PC** muestra esas sesiones. Su duración es aproximada y las señales de navegación no representan acciones de campaña. Guardar una revisión explícita es lo que completa el seguimiento. Actualmente la revisión sigue siendo por cliente/fecha; la futura programación por cuenta/plataforma requiere un modelo adicional.

## Notificaciones

`public/sw.js` recibe `push` y abre una URL del mismo origen al tocar una notificación. No cachea páginas autenticadas ni respuestas de usuario. **No hay todavía permisos solicitados, suscripciones Web Push, claves VAPID, envío ni motor de recordatorios.** La sincronización y la bandeja ya proporcionan los datos compartidos para esa siguiente fase.

## Verificación y límites de evidencia

- 16 pruebas automatizadas: contratos, IDs, cola, concurrencia y migraciones/RPC en PostgreSQL aislado (PGlite).
- Dos navegadores con Auth/REST/Realtime simulados: una revisión se refleja en móvil, no hay eco de escrituras, se conserva el borrador frente a edición remota y se reenvía al reconectar; histórico mensual filtrado.
- Supabase real: migraciones aplicadas, RLS habilitado, publicación Realtime y permisos que impiden escrituras/ingesta anónimas comprobados; advisors de seguridad sin hallazgos.
- Las pruebas iniciales de CAS/RLS en transacciones revertidas pasaron. La revisión automática rechazó posteriormente crear cuentas Auth para pruebas adicionales; no se crearon cuentas ni se verificó el login real de una identidad humana.
- La prueba final con correo real y entre dispositivos físicos corresponde a la cuenta del usuario en producción.

El conector Vercel rechazó el acceso a variables del team y la CLI no tenía credenciales; se proporcionó configuración publicable en el archivo de producción. La revisión automática también rechazó el modelo alternativo de token anónimo de Companion; ese modelo se descartó por completo.
