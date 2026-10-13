# Backlog — Informes FNG

**Actualizado:** 2026-10-13. Seguimiento inicial para el [PR #1](https://github.com/Ian9Franco/INFORMES_FNG/pull/1).  
**Prioridades:** P0 = bloquea uso confiable/merge; P1 = mejora necesaria para flujo diario; P2 = expansión.  
**Estados:** Hecho / En verificación / Pendiente / Diferido. Los criterios de aceptación son condiciones comprobables, no promesas.

## P0 — antes de fusionar / usar datos reales

| ID | Estado | Tarea | Criterio de aceptación |
| --- | --- | --- | --- |
| FNG-001 | En verificación | Corregir TypeScript de `WorkspaceGate` | `npm run build` pasa en CI |
| FNG-002 | Pendiente | Verificar login y logout con magic link | Entra, sale y reingresa en localhost y despliegue |
| FNG-003 | Pendiente | Probar RLS para dos usuarios | Usuario A no lee ni modifica datos de B |
| FNG-004 | Pendiente | Evitar sobreescritura silenciosa por estados antiguos | Dos pestañas/dispositivos no pierden cambios, o hay bloqueo/conflicto explícito |
| FNG-005 | Pendiente | Guardado confiable y reconexión | Errores visibles, reintentos y confirmación de sincronización |
| FNG-006 | Pendiente | Validar impresión A4 con casos reales | Clientes × LUN-SÁB legibles en una hoja, sin cortes ni recortes |
| FNG-007 | Pendiente | Probar copia de seguridad/restauración | Recuperación fiel; archivo inválido no reemplaza datos |
| FNG-008 | Pendiente | Tests mínimos y CI estable | Tests del cálculo de semana, revisión, cierre, backup y login; pipeline verde |
| FNG-009 | Pendiente | Fijar dependencias y revisar alertas | Lockfile versionado, instalación reproducible y revisión del `npm audit` |
| FNG-010 | Pendiente | Manejar sesión y estado al cambiar de usuario | No mostrar datos del usuario anterior ni escribirlos en workspace equivocado |

## P1 — flujo de trabajo cotidiano

| ID | Estado | Tarea | Criterio de aceptación |
| --- | --- | --- | --- |
| FNG-011 | Pendiente | Ficha e historial por cliente | Ver revisiones pasadas, acciones y observaciones filtrables |
| FNG-012 | Pendiente | Pendientes con vencimiento/prioridad | Fecha objetivo, prioridad, estado, filtros y continuidad entre semanas |
| FNG-013 | Pendiente | Bitácora de cambios por revisión | Registrar múltiples acciones sin reemplazar el texto previo |
| FNG-014 | Pendiente | Normalizar modelo PostgreSQL | Clientes, revisiones y tareas en tablas con RLS y migraciones versionadas |
| FNG-015 | Pendiente | Semanas cerradas como snapshots | El informe entregado el lunes se reproduce igual más adelante |
| FNG-016 | Pendiente | Etiquetas y búsqueda | Filtrar cuentas por nombre, revisión o tarea pendiente |
| FNG-017 | Pendiente | Estructurar la UI en módulos | Componentes, formularios y hooks por dominio con pruebas |
| FNG-018 | Pendiente | Roles/compartición limitada | Permisos explícitos para lectura de informes sin edición ajena |
| FNG-019 | Pendiente | Publicación y monitoreo | Dominio seguro, variables configuradas, logs de error y recuperación comprobada |

## P2 — capacidades de PWA y automatización

| ID | Estado | Tarea | Criterio de aceptación |
| --- | --- | --- | --- |
| FNG-020 | Pendiente | PWA offline | Service worker probado, lectura offline y cola de cambios reconciliada |
| FNG-021 | Pendiente | Recordatorios | Tarea con fecha genera aviso autorizado y cancelable |
| FNG-022 | Pendiente | PDF y envío compartible | Versión descargable consistente y enlace/archivo enviado manualmente |
| FNG-023 | Diferido | Integración con Meta Marketing API | Métricas verificadas por campaña y manejo de permisos/rate limits |
| FNG-024 | Diferido | Panel de actividad y estadísticas | Indicadores útiles por cliente/período, sin confundir revisiones con impacto |
| FNG-025 | Diferido | Automatizar cierre/emisión | Confirmación previa, archivo del informe y envío opcional |

## Secuencia recomendada

`FNG-001 → FNG-002/003 → FNG-004/005 → FNG-006/007/008/009/010`. Después avanzar en `FNG-014` y `FNG-011/012/015`; dejar offline y la API de Meta para cuando la persistencia esté estabilizada.

## Reglas de mantenimiento

- Mover a **Hecho** solo con pruebas o evidencia registrada en el PR.
- Cada cambio de alcance debe actualizar [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) y [CHANGELOG.md](../CHANGELOG.md).
- Una prioridad no es una fecha de entrega; el roadmap define orden y entregables, no estimaciones inventadas.
