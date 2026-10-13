# Roadmap — Informes FNG

**Fecha de referencia:** 2026-10-13. Roadmap basado en entregables y puertas de calidad, **sin plazos inventados**. El objetivo es pasar de una planilla digital a una bitácora segura y cómoda que pueda emitir el informe del lunes.

## Horizonte

| Etapa | Objetivo | Entregables | Puerta de salida |
| --- | --- | --- | --- |
| **M0 — Fundación** | Base de la app | Next.js App Router, Supabase Auth, JSONB + RLS, semana, revisiones, pendientes, impresión | Código integrado y build verificable; situación actual: **en PR borrador** |
| **M1 — Estabilización** | Poder confiar en lo registrado | Sincronización confiable, protección frente a conflictos, tests, QA de Auth/RLS, respaldos, A4 | Dos dispositivos + restauración probados sin pérdida; CI verde |
| **M2 — Trabajo cotidiano** | Reducir memoria y pasos manuales | Ficha histórica por cliente, pendientes con fechas y prioridades, filtros, estructura modular | Completar una revisión en segundos y continuar un pendiente entre semanas |
| **M3 — Informes reproducibles** | Entregar cada lunes sin reconstruir | Snapshots de semanas cerradas, exportación consistente, compartir PDF/enlace protegido | Misma semana reproduce siempre el mismo informe, aun con tareas resueltas después |
| **M4 — Experiencia PWA real** | Usabilidad móvil/offline | Service worker, estrategia de caché, cola offline, reconciliación y notificaciones opcionales | Probar vuelo/sin red, reconectar sin perder ni duplicar registros |
| **M5 — Expansión** | Aportar contexto de marketing y equipo | API de Meta Ads optativa, estadísticas, permisos compartidos, automatización opcional | Datos auditables, consentimiento/permisos y utilidad demostrada |

## MVP mínimo para la operación semanal

`Lunes → revisar la semana anterior → cerrar → imprimir planilla A4 → comenzar semana nueva en blanco → conservar pendientes e historial.`

La aplicación ya dibuja ese recorrido, pero **M0 no equivale a aprobación productiva**: los puntos P0 de [BACKLOG.md](BACKLOG.md) son obligatorios para confiar en la información.

## Orden técnico sugerido

1. Arreglar CI y confirmar credenciales/redirects de Auth y RLS.
2. Resolver persistencia confiable y límites de escritura del JSON completo. Antes de sumar colaboración, evaluar normalizar el esquema.
3. Fortalecer registro y seguimiento con un historial navegable por cuenta y tareas fechadas.
4. Congelar semanas entregadas con snapshots exportables; no usar pendientes vivos como supuesto historial.
5. Recién entonces agregar service worker/offline. El caché sin reconciliación puede ocultar pérdida de información.
6. Considerar integración Meta y envío automático solo si el flujo manual estable justifica la complejidad.

## Fuera de alcance por ahora

- Reemplazar Ads Manager.
- Optimización automática de campañas.
- Métricas o decisiones generadas por IA sin trazabilidad.
- Multiempresa con permisos complejos antes de definir requisitos reales.

## Riesgos que condicionan etapas

| Riesgo | Mitigación necesaria |
| --- | --- |
| Sobreescritura de cambios entre dispositivos | Concurrencia/versionado o operaciones por entidad |
| Información comercial sensible | RLS, autenticación comprobada, manejo seguro de copias |
| PDF variable entre navegadores | QA de impresión, opción de generar PDF determinista |
| Offline antes de persistencia robusta | Estrategia de sincronización, conflictos y deduplicación |
| Dependencias variables | Lockfile y auditoría periódica |

Ver el [estado actual](ESTADO_ACTUAL.md) y el [backlog](BACKLOG.md). Revisar el roadmap al terminar cada hito, no por calendario.
