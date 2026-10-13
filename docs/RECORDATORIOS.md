# Recordatorios de seguimiento publicitario (diseño, no implementado)

## Visión

PWA instalada en el teléfono = **receptor opcional** de avisos. La extensión de escritorio = **fuente de señales de actividad**, no emisor de Web Push móvil. La app de FNG + Supabase serán quienes crucen actividad observada con registros y programación.

## Reglas

### A. Trabajaste, pero falta registrar

Se detectó una sesión en Meta Ads o Google Ads asociada a una cuenta, no existe una revisión declarada que la cubra y pasó un plazo de cortesía tras terminar. Ejemplo configurable (no valores obligatorios): sesión de al menos 10 minutos, esperar 20 minutos tras la sesión y tras la última edición en la PWA. Si entretanto completaste una revisión, **cancelar** el recordatorio.

Texto recomendado:

> Meta Ads · Tolentinos: a las 12:34 detectamos una sesión de aproximadamente 42 minutos y 3 señales de navegación. Todavía no encontramos un registro asociado.

No describir «3 eventos» como acciones realizadas, ni «42 minutos trabajados comprobados». Es una aproximación de actividad con pestaña enfocada, y puede omitirse tiempo si Chrome estuvo suspendido.

### B. Te faltó revisar una cuenta prevista

Se configuró un plan explícito para la cuenta *Google Ads · Da Milán* (por ejemplo lunes, miércoles y viernes) y al llegar su vencimiento no hay una revisión confirmada.

> Google Ads · Da Milán: estaba prevista una revisión para hoy y no encontramos una revisión registrada. Revisala, marcala como hecha o posponela.

El motor no puede concluir que «no entraste» si no hay sesión, porque podés usar otra PC o navegador. Nunca generar recordatorios para **todas** las cuentas cada día por defecto.

## Evitar que moleste

- Bandeja silenciosa en la PWA desde el primer release del motor. Push solo si el usuario lo activa.
- No notificar mientras una sesión activa está abierta ni cuando el usuario escribe en el formulario.
- Al guardar una revisión, reevaluar recordatorios pendientes de esa cuenta/plataforma y cancelar los cubiertos.
- Dedupe por usuario + tipo + cuenta + período; cooldown por sesión y límite diario configurable.
- Horario de silencio, huso horario, días laborables y prioridad.
- Acciones: «Registrar ahora», «Ya lo registré», «Mañana», «Próxima semana», «Elegir fecha», «Descartar».
- Al posponer, actualizar el mismo recordatorio y no crear otro.
- Nombres comerciales y métricas sensibles en pantalla bloqueada **opcionales**, ocultos por defecto si se prefiere privacidad.
- No enviar push sin una asociación fiable entre ID de cuenta y cliente.

## Arquitectura Web Push futura

```text
Companion (PC) -- sesion confirmada --> Supabase [browser_sessions]
INFORMES FNG -- registro de revisión --> Supabase [review_entries]
                                                                     [scheduler / cron en servidor]
                                       ↓
                              [motor idempotente de reglas]
                                       ↓
                              [push_subscriptions + Web Push]
                                       ↓
                            PWA instalada (Android/iOS*)
```

Requisitos: HTTPS; service worker que atienda `push` y `notificationclick`; solicitud explícita de permiso, `PushSubscription` con endpoint y claves guardadas por dispositivo/usuario; envío servidor con VAPID; trabajo programado (p. ej., pg_cron + Edge Function u otro scheduler), controles de expiración/reintentos y RLS.

*En iPhone/iPad la entrega Web Push depende de que la web app sea elegible e instalada en pantalla de inicio, del SO y del soporte disponible. Probar en dispositivo real. Instalar un acceso directo o manifest sin backend/SW **no habilita** notificaciones por sí solo.*

Una extensión de Chrome escritorio no se ejecuta dentro del navegador del iPhone; la PWA recibe avisos por su cuenta.

## Pruebas que debe pasar el motor

| Escenario | Esperado |
| --- | --- |
| 42 min en Meta Tolentinos, ninguna revisión tras margen | Una sugerencia silenciosa/aviso si opt-in |
| Usuario completa revisión antes del margen | Aviso cancelado |
| Abre FNG y redacta observación | No interrumpir |
| Cuenta Google no programada | Ningún aviso por no visitarla |
| Google Da Milán previsto y sin revisión al vencer | Un único aviso |
| Posponer para mañana | Reprogramar y no duplicar |
| Mismo cliente con dos plataformas | Reglas y registros independientes |
| Mismo evento recibido dos veces | Una sola sesión y un aviso |
| Sin ID/cuenta vinculada | Bandeja para asociar, sin aviso con nombre inventado |

## Estado

Todos los comportamientos de recordatorios y push en este documento **son backlog**, no implementación activa. La web existente todavía registra una revisión por cliente/fecha, sin plataforma. 
