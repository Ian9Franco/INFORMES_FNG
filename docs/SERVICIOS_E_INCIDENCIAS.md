# Servicios, frecuencia e incidencias

## Tres trabajos, dos proveedores de cuentas

- `meta_ads`: campañas, anuncios pagos, conjuntos, audiencias y presupuestos. Revisión diaria de lunes a viernes.
- `google_ads`: campañas, keywords, grupos de recursos, etc. Referencia de 2–3 días revisados por semana; sin días fijos ni obligación diaria.
- `meta_organic`: programación de historias y feed para sábado/domingo. Ventana habitual miércoles a viernes; revisar sin programar sigue siendo válido y no se confunde con una programación terminada.

`Client.services` define los servicios que realmente se prestan. No es una lista de permisos de acceso. `advertisingAccounts` conserva únicamente proveedores reales (`meta_ads` / `google_ads`) e IDs privados; **no existe una cuenta publicitaria inventada `meta_organic`**. Un cliente orgánico puede existir sin cuenta de pauta.

Revisiones, borradores, archivado y pendientes son independientes por servicio. `Review.platform` conserva el proveedor para compatibilidad, y `Review.service` identifica el trabajo. `archivedServices` reemplaza al archivado amplio `archivedPlatforms` cuando está presente. Las revisiones antiguas con historias y anuncios juntos se proyectan en servicios separados sin escribir al abrir la app; las notas libres se conservan una sola vez. La separación se materializa sólo al guardar una edición explícita. No se alteran claves de acciones existentes.

Sin `services`, el catálogo antiguo con acceso Meta conserva Ads + orgánico para no ocultar historia o funciones existentes. Esto es compatibilidad, **no una confirmación contractual**: configurar los servicios reales desde la DB. Un cliente sin cuentas y sin configuración conserva su revisión Meta Ads anterior.

## Configuración desde Supabase

Usar Dashboard → SQL Editor con permisos de administración. No añadir/eliminar clientes desde Informes; esta regla sigue vigente. Consultar también [ADMINISTRAR_CLIENTES.md](./ADMINISTRAR_CLIENTES.md).

Ejemplo de un cliente con Google Ads y orgánico, pero sin servicio Meta Ads. Reemplazar los placeholders **dentro de Supabase**, sin subir datos reales al repositorio:

```sql
-- Verificar primero el cliente exacto y su propietario.
select id,payload->>'name' as nombre,payload->'services' as servicios
from public.fng_records
where user_id='<UUID_USUARIO>'::uuid and kind='client' and id='<ID_INTERNO_CLIENTE>' and not deleted;

update public.fng_records
set payload=jsonb_set(payload,'{services}','["google_ads","meta_organic"]'::jsonb)
where user_id='<UUID_USUARIO>'::uuid and kind='client' and id='<ID_INTERNO_CLIENTE>' and not deleted;
```

Esto no borra cuentas, notas ni revisiones anteriores. El servicio no contratado deja de aparecer en sus tablas y exportaciones. Un archivo previo puede reactivarse sólo para el servicio que corresponda; revisar `active`, `archivedServices` y el legado `archivedPlatforms` antes de cambiar el catálogo. No sustituir el array de cuentas para indicar qué servicio se presta.

## Revisado no significa resultado positivo

Cada revisión permite marcar `issues` con IDs estables:

- `no_budget`: **Sin presupuesto**, con detalle opcional.
- `error`: **Con error**, con detalle opcional.

Máximo dos tipos diferentes; detalle de hasta 600 caracteres cada uno. No tienen cantidades, no son acciones positivas, no archivan al cliente y no crean pendientes automáticamente. Se puede registrar una revisión sin cambios y mantener la incidencia. Para resolverla, desmarcarla y guardar la revisión: los informes de fechas anteriores conservan lo que se había detectado.

La UI distingue revisión confirmada con alerta, revisión confirmada normal y ausencia de revisión. El simple semanal conserva las marcas por día y agrega una columna amplia de acciones acumuladas de la semana; el mensual acumula las del mes. Ambos muestran incidencias por servicio y todas las acciones estructuradas con cantidades abreviadas y leyenda. El detallado mantiene el texto completo por revisión y fecha. Las notas libres extensas siguen en el detallado; el simple indica que existen.

## Persistencia eficiente

Las incidencias viajan en el mismo registro de revisión y por el mismo lote incremental (350 ms) existente. La DB mantiene un estado derivado `kind='condition'`, con **como máximo una fila por cliente/servicio**, sólo para servicios que tuvieron incidencias. No es un snapshot diario ni otro PDF. Una revisión posterior con `issues: []` limpia el estado vigente sin reescribir el historial; quitar la última revisión recalcula el estado desde las restantes.

El estado se carga junto con la metadata existente, por lo que no añade polling ni consultas individuales por cliente. Así una alerta del mes anterior sigue visible en otro navegador sin descargar todos los meses. Realtime comunica revisiones y estado derivado. La caché conserva esta metadata, pero no la reenvía ni permite importarla como autoridad. Sólo el trigger de revisión puede modificarla; se conserva RLS por usuario y CAS para las revisiones.

Antes de usar este código contra una DB, aplicar la migración `work_services_and_review_issues`. No contiene IDs reales ni backfill del historial. Companion también debe actualizarse: distingue Ads Manager (`meta_ads`) del calendario/compositor confirmado (`meta_organic`), respeta los servicios activos del catálogo privado y continúa sin observar otros sitios ni afirmar cambios realizados.
