# Changelog

Se documentan cambios funcionales y técnicos relevantes siguiendo el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones listadas corresponden a **iteraciones de desarrollo**, no a releases publicados o tags de Git.

## [Unreleased] — documentación y estabilización del PR #1

### Interfaz operativa
- Navegación superior flotante en escritorio y dock móvil, sin sidebar; selección animada mediante Motion.
- Animated Tags de SmoothUI e iconos de Animate UI adaptados con licencias conservadas.
- 19 acciones rápidas Meta/Google con IDs estables, UUID por registro, cantidades y origen/evidencia versionados.
- Acciones estructuradas incluidas en respaldo, vista previa e impresión; compatibilidad con revisiones anteriores.
- Contrato futuro Companion documentado en `docs/ACCIONES_RAPIDAS.md`; propuestas observadas no se confunden con acciones confirmadas.
- Pulido móvil/iOS: materiales glass discretos, navegación flotante con safe areas y resumen diario compacto.
- Skeletons en carga e hidratación; tipografía de sistema para evitar saltos por fuentes remotas.
- Transiciones de navegación, apertura/cierre de revisiones y avisos; respeta la preferencia de movimiento reducido.
- Búsqueda en jornada, selector de cliente al registrar y protección de cambios sin guardar.
- Diálogo nativo con foco contenido, scroll de fondo bloqueado y ajuste al teclado mediante Visual Viewport.
- Tabla semanal con columna de cliente fija y controles táctiles de al menos 44 px.
- Rediseño responsive de jornada, semana, clientes e informes con navegación accesible.
- Gestión de clientes con búsqueda, filtros, alta, archivo, reactivación y borrado seguro solo cuando no existe historial.
- Formulario completo de revisión con acciones, observaciones y pendientes; estados y confirmaciones visibles.
- Vista previa A4 para planilla semanal e informe detallado antes de imprimir o guardar como PDF.
- Modo local automático cuando Supabase todavía no está configurado y estado de almacenamiento visible.
- Lockfile incorporado para instalaciones reproducibles.

### Documentación
- README técnico: entorno, estructura, modelo de datos, persistencia, seguridad, impresión y limitaciones.
- Inventario de [estado actual](docs/ESTADO_ACTUAL.md), [backlog priorizado](docs/BACKLOG.md) y [roadmap](docs/ROADMAP.md).

### Correcciones
- Reemplazo de `.catch()` sobre un `PromiseLike` de consulta Supabase por un flujo `async/await` con captura de errores, para resolver el error de tipado detectado en CI.
- Compilación posterior a la corrección: **aprobada** en [GitHub Actions #38448153350](https://github.com/Ian9Franco/INFORMES_FNG/actions/runs/38448153350).

## [0.2.0] — 2026-10-13

### Cambios
- Migración del frontend de Vite a **Next.js 15 App Router**, React 19 y TypeScript.
- Primer acceso con **Supabase Auth** (enlace por correo).
- Persistencia remota en tabla `public.workspaces` mediante `JSONB` y políticas RLS por usuario.
- Migración SQL de la tabla y archivo `.env.example` con variables `NEXT_PUBLIC_*`.
- Manifest de aplicación desde App Router; **sin** service worker ni offline.

### Limitaciones conocidas
- Guardado de snapshot completo sin control de concurrencia ni conflictos entre dispositivos.
- El flujo de login y la impresión aún requieren pruebas manuales.
- CI de la primera iteración Next.js falló en TypeScript (`WorkspaceGate.tsx`: `PromiseLike.catch`); parche propuesto en la sección Unreleased.

## [0.1.0] — 2026-10-13

### Incorporado
- Bootstrap inicial React + Vite + TypeScript.
- Panel de jornada, 27 clientes semilla y grilla de lunes a sábado.
- Registro de revisiones, acciones y observaciones por cliente/día.
- Pendientes abiertos, alta/archivo de clientes, cierre/reapertura de semanas.
- Impresión de grilla A4 vertical e informe detallado.
- Persistencia local `localStorage`, exportación/importación JSON y primer pipeline CI.

### Posteriormente reemplazado
- Vite y su configuración fueron retirados en la iteración 0.2.0.

### Documentación transversal (Unreleased)

- Incorporado Google Ads al alcance objetivo de FNG, sin cambiar aún el modelo cliente/fecha existente.
- Documentado FNG-Companion para sesiones detectadas en Meta Ads/Google Ads, mapping de IDs y evidencia limitada.
- Definidas reglas futuras para avisos por sesión sin documentar, revisiones omitidas, aplazamientos y push móvil. No implementadas.

