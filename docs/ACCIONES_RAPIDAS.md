# Acciones rápidas — contrato v1

Implementado: selección manual, cantidades, persistencia y exportación de acciones estructuradas en revisiones. La integración automática con Companion sigue pendiente.

El catálogo canónico es `src/review-actions.ts`. Los `typeId` son inmutables, incluyen plataforma y operación (`meta.ad.created`, `google.keyword.updated`, etc.). Cambiar una etiqueta no cambia la identidad.

Cada acción registrada tiene su propio UUID `id`, `typeId`, `quantity` (entero de 1 a 999), `source` y `evidence`. Una revisión incluye `actionSchemaVersion: 1` y `actionEntries`; mantiene también `actions` como texto libre. Los respaldos anteriores sin estos campos siguen siendo compatibles.

```json
{
  "actionSchemaVersion": 1,
  "actionEntries": [{
    "id": "UUID-del-registro",
    "typeId": "google.keyword.updated",
    "quantity": 12,
    "source": "manual",
    "evidence": "user_confirmed"
  }]
}
```

El modelo actual conserva una revisión por cliente/fecha; una revisión puede contener acciones de ambas plataformas. **Esto no implementa aún revisión independiente por cuenta publicitaria**, cuya normalización continúa pendiente. Antes de recibir eventos remotos hay que resolver cuenta, usuario y migración normalizada.

## Ingesta futura de Companion

- Contrato versionado con `user_id`, `ad_account_id`, `typeId`, `quantity`, `source_event_id` y timestamp UTC.
- Validar `typeId` contra el catálogo, rango de cantidad, usuario y cuenta autorizados; IDs desconocidos se rechazan, nunca se interpretan por etiqueta.
- Deduplicar eventos por `(user_id, source_event_id)` en servidor. El UUID del registro y el ID del evento son entidades distintas.
- Eventos de Companion llevan `source: companion`, `evidence: observed` y `sourceEventId`; deben aparecer como propuesta **por confirmar**.
- Una navegación o sesión no genera un tipo de acción; hace falta evidencia de la operación. No inferir cambios de campañas de señales de navegación.
- Tras confirmar una sugerencia se conserva su origen y cambia `evidence` a `user_confirmed`.
- El selector manual representa cantidades agregadas por tipo dentro de la revisión. La futura tabla de eventos debe conservar los eventos individuales antes de agregarlos, para no duplicar cantidades.

## Recursos de interfaz

Motion para React (`motion/react`), Animated Tags de SmoothUI adaptado e iconos ChartLine/Check de Animate UI adaptados. Las licencias se conservan en `THIRD_PARTY_NOTICES.md`. No se utiliza el catálogo privado Motion UI ni requiere token.
