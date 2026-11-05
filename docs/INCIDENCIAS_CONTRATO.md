# Contrato de incidencias

**Corte:** 2026-11-05. Primer corte de [issue #8](https://github.com/Ian9Franco/INFORMES_FNG/issues/8).

Este corte audita el modelo vigente y fija cómo se lee un problema a lo largo del tiempo. **No cambia** el formulario de revisión, el guardado, `kind='condition'`, la sincronización ni los informes Simple y Detallado. La implementación está en `src/incident-episodes.ts` y no escribe en la base.

## Qué se reutiliza

| Pieza | Rol actual | Decisión |
| --- | --- | --- |
| `Review.issues` | Lista explícita en cada revisión: `no_budget`, `error`, `client_paused`. Máximo un ítem por tipo, detalle de hasta 600 caracteres. | Sigue siendo la evidencia manual. No se infieren incidencias desde acciones, observaciones ni sesiones de Companion. |
| `kind='condition'` | Proyección de sólo lectura: como máximo una fila por usuario, cliente y servicio. | Se conserva. El navegador no la escribe. |
| `latestIssues` | Arrastra el estado vigente al abrir una revisión. Un `issues: []` explícito lo limpia. | Sigue igual. El contrato nuevo coincide con esa lista cuando cada revisión trae `issues`. |
| Pendientes | Sólo nacen de «Nuevo pendiente». | Un episodio no crea una tarea. |

`client_paused` sigue siendo una pausa pedida por el cliente. No es un error, no archiva la cuenta y no corresponde a Meta orgánico. La base ya rechaza esa combinación.

## Auditoría del estado derivado

Migraciones: `20261016200154_work_services_and_review_issues.sql` y `20261016202321_client_requested_campaign_pause.sql`.

- `fng_records.kind` admite `condition`. El id vigente es `issue:` más el md5 de `client_id` y el servicio. El payload copia la revisión más nueva de ese cliente y servicio: `clientId`, `service`, `date`, `reviewId` e `issues`.
- `fng_project_condition` corre después de insertar o actualizar una revisión. Si no quedan revisiones, marca la fila como borrada. No reescribe revisiones anteriores.
- `fng_guard_condition` impide que `authenticated` o `anon` escriban o borren esa fila, y exige baja lógica de la revisión para no perder el estado.
- `fng_guard_platform_scope` rechaza tipos desconocidos, duplicados, detalles de más de 600 caracteres, una pausa en orgánico, y una revisión que borra la clave `issues` mientras haya una condición abierta. Así una app vieja no limpia una incidencia por omisión.
- `diffStore` salta `kind='condition'`: la caché puede mostrarla, pero no la reenvía ni la importa como autoridad. RLS sigue por `user_id`.

Eso alcanza para mostrar el estado de hoy. No alcanza para el seguimiento que pide el issue:

- La fila no distingue el primer día, el último ni la resolución. Vaciar `issues` deja un array vacío, sin `resolved_at`.
- No hay episodio por problema. Dos errores distintos del mismo cliente y servicio comparten el único cupo `error`.
- No hay cuenta publicitaria ni identificador externo en la identidad. El estado es sólo cliente + servicio.
- No hay estados de trabajo (`investigando`, dependencia de terceros). No hay origen (`manual`, `csv`, `api`).
- Cada revisión histórica guarda su propia lista, así que el detallado puede repetir el mismo problema todos los días. Eso debe seguir así: el resumen no debería contarlo como un problema nuevo por día.
- Editar una revisión reemplaza la fila. No existe una versión anterior de la nota. Este contrato no inventa esas versiones perdidas.

No corresponde abrir otra tabla ni reescribir el historial en este corte. El volumen actual cabe en una derivación de las revisiones que ya están cargadas.

## Tres capas

1. **Clase.** Qué clase de situación es. `error` se lee como `technical_or_policy`, `no_budget` como `no_budget` y `client_paused` como `voluntary_pause`. `pending_material` y `performance_anomaly` quedan reservadas para una fuente futura; el texto libre no las dispara.
2. **Episodio.** Una ocurrencia continua de esa clase para una identidad estable. La identidad es cliente, servicio, cuenta si existe, clase y, si existe, identificador externo. Sin cuenta ni id externo, hoy hay como máximo un episodio abierto por cliente, servicio y clase: es el límite del formulario actual, no una mezcla silenciosa de dos campañas.
3. **Observación.** Cada señal fechada del episodio: la revisión, el detalle, el origen y si el problema se vio, se desmarcó o la fuente no alcanzó para saberlo.

Repetir la misma identidad actualiza `last_seen_at` y suma una observación. No abre otro episodio. Las revisiones originales no se modifican.

Una señal con cuenta o id externo no entra en el array `issues` legado. Así un rechazo de una campaña no se aplasta contra el error manual de todo el cliente.

## Resolución y reapertura

Sólo cierra un episodio un desmarcado **manual y explícito**: la revisión guarda `issues` como array y esa clase no está. Es el mismo gesto de destildar y guardar. `resolved_at` es la fecha de esa revisión y la resolución queda en el episodio. La revisión anterior sigue con lo que se había anotado.

No cierran un episodio:

- una revisión que ni siquiera trae la clave `issues`;
- un día sin revisión;
- una respuesta `csv` o `api` vacía, incompleta o que diga `cleared`;
- una sesión de Companion;
- una nota de workflow.

`latestIssues` sin estado persistido, ante una revisión que omite la clave, devuelve `[]`. Con la fila `condition` cargada, conserva el problema. El contrato sigue esta segunda lectura, que es la que la base ya obliga cuando la condición está abierta.

Si la misma identidad vuelve a aparecer después de resuelta, se abre otra generación. La generación cerrada no se reabre ni se reescribe. `previousEpisodeId` las enlaza.

Las anotaciones de workflow sólo pueden dejar el episodio abierto en `detectada`, `investigando` o `escalada_o_depende_de_terceros`. No crean pendientes. Una anotación posterior a `resolved_at` se ignora.

## Resumen

Para un día `asOf` y, si se pide, un período:

- **Abiertas:** siguen sin resolución en ese día, ordenadas por impacto (`technical_or_policy`, luego `no_budget`, luego material pendiente, luego anomalía). La cantidad de marcas no sube la prioridad.
- **Nuevas:** la primera observación cae dentro del período.
- **Persistentes:** empezaron antes del período y siguen abiertas al cierre de la ventana.
- **Resueltas:** `resolved_at` cae dentro del período.

Una pausa voluntaria usa los mismos cortes, en un grupo aparte, y `countsAsFailure` es falso. Puede ser nueva y abierta a la vez, o nueva y resuelta si se destildó dentro de la ventana. No es persistente y resuelta al mismo tiempo.

La ventana semanal operativa es lunes a sábado, la misma de la planilla. `equivalentOperationalWeeks` sólo acepta dos ventanas completas de ese tipo. Un tramo más corto no se compara como si fuera la semana entera. Si `asOf` cae a mitad de período, una resolución posterior no entra en ese resumen.

## Compatibilidad que hay que mantener en los cortes siguientes

- Seguir guardando la revisión, no la fila `condition`.
- No ampliar los tres tipos de `issues` sin una migración que actualice el `check` y los clientes ya desplegados.
- No hacer backfill ni reescribir revisiones.
- Persistencia futura de anotaciones o de generaciones: filas o campos que un cliente viejo pueda ignorar, sin cambiar el id `issue:` + md5 ni permitir que el navegador escriba `condition`.
- `user_id` sigue siendo el límite de RLS. Esta función se ejecuta con las revisiones de un solo workspace.

## Fuera de este corte

El issue #8 sigue abierto. En orden: persistir el seguimiento y mostrarlo, snapshots de KPI con pruebas, CSV idempotente, recién después el Detallado y el Simple, y sólo más adelante conectores de lectura y alertas. No se marcan hechos `FNG-011`, `FNG-012`, `FNG-014`, `FNG-015`, `FNG-023`, `FNG-024`, `FNG-026`, `FNG-027` ni `FNG-034`: este contrato no los entrega.
