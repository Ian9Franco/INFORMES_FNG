# Contrato FNG ↔ FNG Companion (propuesta)

**Estado:** la ingesta inicial autenticada y la bandeja compartida están implementadas en [SINCRONIZACION_V1.md](SINCRONIZACION_V1.md). La programación por cuenta/plataforma y el motor de recordatorios descritos abajo siguen siendo propuesta. Companion inicia su propia sesión del mismo usuario; no copia credenciales de la PWA.

**Repos:**
- Central: [INFORMES_FNG](https://github.com/Ian9Franco/INFORMES_FNG) (Next.js + Supabase)
- Sensor de navegador: [FNG-Companion](https://github.com/Ian9Franco/FNG-Companion) (Chrome MV3)

## Modelo objetivo

```ts
type Platform = 'meta_ads' | 'google_ads'
type Client = { id: string; name: string }
type AdAccount = {
  id: string
  owner_user_id: string
  client_id: string
  platform: Platform
  external_id: string | null    // confirmado, no deducido arbitrariamente
  display_name: string | null
  enabled: boolean
}
type ObservedBrowserSession = {
  id: string                     // UUID
  user_id: string
  source_event_id: string        // UUID de la extensión, deduplicación
  platform: Platform
  account_candidate: string | null
  ad_account_id: string | null   // null hasta mapeo explícito
  started_at: string
  ended_at: string
  focused_ms: number            // estimación de pestaña activa / no idle
  navigation_signals: number    // señales, NO cambios en anuncios
  status: 'needs_mapping' | 'undocumented' | 'linked' | 'dismissed'
}
type PlannedReview = {
  id: string
  ad_account_id: string
  timezone: string
  weekdays: number[]           // días explícitamente requeridos
  due_local_time: string | null
}
type Nudge = {
  id: string
  type: 'undocumented_session' | 'missed_planned_review'
  ad_account_id: string
  dedupe_key: string
  scheduled_for: string
  status: 'pending'|'delivered'|'snoozed'|'done'|'dismissed'
}
```

Un cliente comercial puede tener **varias** cuentas de Meta y Google. La clave de vínculo externo debe contener `(owner_user_id, platform, external_id)`; no alcanza con comparar números de cuenta aislados. Si el ID no está o no puede validarse, mostrar «cuenta sin vincular» y permitir asignación manual.

## Cambios que requiere la PWA

La estructura `Store` actual solo tiene `Review.clientId` + `date`, sin plataforma. Es insuficiente para distinguir una cuenta Meta y una Google de la misma empresa. **No agregar artificialmente plataformas dentro del JSON sin migración y compatibilidad para respaldos:** planificar transición versionada a entidades en PostgreSQL con RLS, FK, unique y acceso por usuario.

Plan de tablas (no ejecutado): `ad_accounts`, `browser_sessions`, `account_review_schedules`, `review_entries`, `reminder_jobs` y `push_subscriptions`. Idempotencia única para sesiones `(user_id, source_event_id)`. Evitar guardar URL completa, cookies o nombres capturados sin autorización.

## Protocolo de ingesta previsto

1. Una extensión autorizada emite un lote de sesiones finalizadas; nunca acciones de Meta/Google inventadas.
2. El servidor valida sesión de usuario, formato del evento, deduplicación, tiempos y límites.
3. Se resuelve account candidate ↔ cuenta externa configurada; sin match queda pendiente para asignación.
4. Se compara con revisiones explícitas de la cuenta/plataforma y ventana de tiempo.
5. Las sugerencias se mostrarán en la PWA como **evidencia de navegación**, no como prueba de que se modificaron campañas.

No copiar cookies o tokens de la PWA a la extensión. Definir Auth para Chrome Extension (Chrome Identity, redirect permitido o flujo apropiado) antes de sincronizar. La clave publicable no es suficiente sin Auth y RLS.

## Reglas de reconciliación

- Una sesión y una revisión pueden existir independientemente.
- Una revisión puede anotarse al día siguiente; asociar por contexto y horario, con tolerancias configurables y confirmación.
- «Trabajo insuficientemente documentado» no se infiere por cantidad de palabras. Propuesta inicial: basta registro de revisión confirmado en cuenta/plataforma para silenciar aviso; abrir nuevas observaciones opcional.
- No comparar solo el cliente, porque podría registrarse Meta Ads y estar pendiente Google Ads.
- Tiempos en UTC y visualización según la zona horaria elegida.
- La falta de eventos de Chrome no demuestra que la cuenta no se revisó: podría haber otro navegador/dispositivo.

## Reglas de notificación y móvil

Leer [RECORDATORIOS.md](RECORDATORIOS.md) antes de implementar push. Todo queda como propuesta pendiente de desarrollo.
