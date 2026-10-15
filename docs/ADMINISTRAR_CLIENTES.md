# Administración privada de clientes y cuentas

El catálogo vive únicamente en Supabase. Informes permite **archivar/reactivar**, registrar revisiones y emitir informes; no permite altas, borrados, renombres ni cambios de cuentas. La API también los bloquea. Importar un respaldo o unir datos locales no puede crear ni eliminar clientes.

Usar **Supabase Dashboard → SQL Editor** con una cuenta administradora. Nunca pegar claves de servidor en Informes, Companion, Git, issues o chats públicos. Las consultas siguientes son plantillas: reemplazar los valores entre `<...>` **sólo dentro de Supabase**. No commitear el SQL ya completado ni sus resultados.

## Identificadores y tablas

- `fng_records`: clientes (`kind='client'`), revisiones, tareas, etc. El `id` interno del cliente no es su ID publicitario.
- `fng_ad_accounts`: índice derivado de las cuentas de cada cliente. Se mantiene mediante trigger; no editarlo directamente.
- `fng_account_contexts`: vínculos confirmados entre un contexto de navegador/página Meta y una cuenta real. No contiene URLs completas.
- El propietario es `user_id`; todas las lecturas de la aplicación están aisladas por RLS. Un ID Google y uno Meta del mismo cliente son independientes.

Para encontrar al propietario y sus clientes:

```sql
select id, email from auth.users where lower(email)=lower('<TU_CORREO>');
select id, payload->>'name' as nombre, payload->>'active' as activo,
       payload->'advertisingAccounts' as cuentas, deleted
from public.fng_records
where user_id='<UUID_USUARIO>'::uuid and kind='client'
order by payload->>'name';
```

## Añadir un cliente

El ID interno se genera aleatoriamente. Meta: ID numérico como texto, sin `act_`. Google: diez dígitos como texto, sin guiones. Quitar del array la plataforma que no corresponda; nunca inventar un ID para completar el formulario.

```sql
begin;
with nuevo as (select gen_random_uuid()::text as id)
insert into public.fng_records(user_id,kind,id,payload)
select '<UUID_USUARIO>'::uuid, 'client', id,
 jsonb_build_object('id',id,'name','<NOMBRE_CLIENTE>','active',true,
  'advertisingAccounts',jsonb_build_array(
   jsonb_build_object('platform','meta_ads','accountId','<ID_META>','owner','<NOMBRE_TITULAR>'),
   jsonb_build_object('platform','google_ads','accountId','<ID_GOOGLE_SIN_GUIONES>','owner','<NOMBRE_TITULAR>')
  ))
from nuevo returning id;
commit;
```

El trigger valida formatos y evita que una cuenta de la misma plataforma se asigne a dos clientes del mismo usuario. Los clientes archivados conservan sus cuentas para no asignarlas accidentalmente a otro.

## Renombrar o añadir una cuenta a un cliente existente

No cambiar su `id`: así las revisiones y tareas conservan la referencia.

```sql
update public.fng_records
set payload=jsonb_set(payload,'{name}',to_jsonb('<NUEVO_NOMBRE>'::text))
where user_id='<UUID_USUARIO>'::uuid and kind='client' and id='<ID_INTERNO_CLIENTE>';

update public.fng_records
set payload=jsonb_set(payload,'{advertisingAccounts}',
 coalesce(payload->'advertisingAccounts','[]'::jsonb) ||
 jsonb_build_array(jsonb_build_object('platform','google_ads',
  'accountId','<ID_GOOGLE_SIN_GUIONES>','owner','<NOMBRE_TITULAR>')))
where user_id='<UUID_USUARIO>'::uuid and kind='client' and id='<ID_INTERNO_CLIENTE>';
```

Antes de añadir, comprobar que esa cuenta no esté ya en el array. Para corregir un ID, editar **sólo** el array `advertisingAccounts` del cliente en Table Editor, conservando las demás propiedades. Quitar una cuenta elimina sus vínculos de contexto asociados; revisarlos y crearlos nuevamente si corresponde. Añadir otra cuenta no borra vínculos de cuentas conservadas.

## Vincular un contexto de Google o una página de Meta

Google puede mostrar IDs internos en `ocid` y `__c` que no coinciden con el Customer ID. Sólo crear la relación después de comprobar el cliente en la interfaz. No usar `euid`, `__u`, `authuser`, `business_id`, IDs de campaña, de grupo ni tokens de redirección como identidad de cliente.

```sql
insert into public.fng_account_contexts
 (user_id,platform,context_kind,context_key,account_id)
values
 ('<UUID_USUARIO>'::uuid,'google_ads','google_context','<OCID>:<__C>','<ID_GOOGLE_SIN_GUIONES>')
on conflict(user_id,context_kind,context_key)
do update set account_id=excluded.account_id;

insert into public.fng_account_contexts
 (user_id,platform,context_kind,context_key,account_id)
values
 ('<UUID_USUARIO>'::uuid,'meta_ads','meta_page','<PAGE_ID_O_ASSET_ID>','<ID_CUENTA_META>')
on conflict(user_id,context_kind,context_key)
do update set account_id=excluded.account_id;
```

La cuenta destino debe existir para ese usuario y plataforma. Un `business_id` puede contener varios clientes: no se vincula como si fuera uno solo. Abrir el calendario/compositor **no confirma** una publicación.

## Archivar, reactivar o eliminar

Archivar/reactivar se puede hacer desde Informes, sin perder historial. En SQL:

```sql
update public.fng_records
set payload=jsonb_set(payload,'{active}','false'::jsonb)
where user_id='<UUID_USUARIO>'::uuid and kind='client' and id='<ID_INTERNO_CLIENTE>';
```

Usar `true` para reactivar. Los informes excluyen archivados y eliminados.

Eliminar es excepcional y exclusivo del administrador. Primero exportar un respaldo privado y comprobar dependencias. La DB rechaza borrar clientes con historial. No borrar revisiones o desactivar triggers para forzarlo.

```sql
select kind,count(*) from public.fng_records
where user_id='<UUID_USUARIO>'::uuid and not deleted
 and (client_id='<ID_INTERNO_CLIENTE>'
  or (kind='action' and payload->>'clientId'='<ID_INTERNO_CLIENTE>'))
group by kind;

-- Sólo si no hay dependencias: tombstone para avisar a todos los dispositivos.
update public.fng_records set deleted=true
where user_id='<UUID_USUARIO>'::uuid and kind='client' and id='<ID_INTERNO_CLIENTE>';
```

Se recomienda tombstone en vez de `DELETE` físico: conserva la señal de eliminación para los dispositivos. La fila puede recuperarse desde la DB poniendo `deleted=false`, siempre que las cuentas no se hayan reasignado.

## Verificación y caché

1. Confirmar cliente/cuentas en Table Editor y revisar que no se alteraron revisiones.
2. En Informes, actualizar datos desde el menú de cuenta; el catálogo se recibe por la sincronización existente.
3. En Companion, pulsar **Actualizar cuentas** o volver a conectar. La caché privada se consulta al iniciar sesión y se renueva después de una hora al necesitarla; no hay consulta por cada URL.
4. Cambiar de cliente en Ads y comprobar el ID real del panel y la bandeja de actividad. Si un contexto no está confirmado, queda sin identificar.

La caché es por usuario, se conserva para trabajar sin conexión y se limpia al desconectar. Se guarda en el perfil de Chrome: proteger la sesión del sistema y no compartir perfiles. No es cifrado independiente de Chrome. Las sesiones pendientes permanecen ligadas a su propietario.

## Seguridad y repositorios

El código, documentación, migraciones y fixtures sólo contienen estructura o datos ficticios. Los IDs reales no son contraseñas, pero no deben publicarse en los repositorios. La URL de Supabase y la clave **publicable** son configuración pública necesaria; la seguridad depende de Auth/RLS, no de ocultar esa clave. Nunca usar `service_role` en el frontend.

La limpieza del historial Git anterior está **pendiente**, por pedido de Ian. Quitar valores del código actual no los borra de commits, forks, cachés ni despliegues anteriores. No se reescribió historial ni se hizo force-push.
