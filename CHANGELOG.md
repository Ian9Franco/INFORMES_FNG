# Changelog

Se documentan cambios funcionales y técnicos relevantes siguiendo el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones listadas corresponden a **iteraciones de desarrollo**, no a releases publicados o tags de Git.

## [Unreleased] — mejoras continuas

### Interfaz operativa
- Guardar con tratamiento sólido de alto contraste y «Guardar y siguiente» tonal con borde visible, en claro/oscuro; contraste de texto superior a 7:1 y cambios de tema sin interpolar colores de estos botones.
- Apertura/cierre progresivos del registro rápido, contenido y barra fija, con deformación elástica suave; estado del cliente con check trazado, pulso squishy y etiqueta animada, sin repetir al recibir el eco del guardado.
- Modal escalonado y cierre ligado al final real de la animación, conservando el diálogo/foco e inhabilitando controles durante la salida; cerrar durante la entrada parte del estado visual actual. Respeto de movimiento reducido.
- Navegación móvil de vidrio con ancho explícito, centrado, más espacio interior, iconos/textos alineados e indicador líquido; blur con fallback opaco y separación respecto de la barra de guardar.
- Detallado compacto en dos columnas de 10,5 pt: paginación A4 medida, clientes juntos cuando entran, continuación para notas extensas y pies numerados; se omiten etiquetas vacías sin perder acciones/notas.
- Vista previa/PDF comparten páginas físicas; el PNG detallado contiene todas las hojas en una imagen vertical, con límites de memoria para históricos muy largos. La planilla normal mantiene una sola hoja.
- Jornada conserva la posición al desplegar clientes: se elimina el scroll automático de apertura y se desactiva el anclaje de las filas; «Guardar y siguiente» sigue ubicando el próximo cliente.
- Acciones personalizadas con ID estable: generales para la cuenta o exclusivas de un cliente, sincronizadas por registro y con alcance validado en Postgres; snapshot de etiquetas en el historial.
- «Programé publicación» en Meta (`meta.post.scheduled`), con cantidades, días destino y resumen `P:` en informes normales y detalle completo en PNG/PDF.
- Cabecera única: tema y cuenta juntos; correo, contraseña, cierre de sesión y actualización dentro del menú. Estado explícito de DB, separado de Companion.
- Restauración inicial de sesión mediante el SDK de Supabase y refresh tokens persistentes, sin cachear contraseñas ni respuestas privadas en Service Worker.
- Paletas claro/oscuro con contraste AA en pares principales, sombras de elevación/pulsación y confirmaciones accesibles con diseño propio en lugar de `window.confirm`.
- Intercambio de páginas secuencial: salida completa antes de entrar, controles inertes durante salida y posición de lectura restaurada sin superponer contenido.
- Resumen diario compacto y ancho de escritorio ampliado, filas móviles de una sola línea y eliminación de renglones repetidos/dobles separadores.
- Bandeja de Companion plegable para mantener las revisiones a mano aun con muchas sesiones observadas.
- Bordes y foco sin recortes, dropdown de historias en la capa superior nativa y respuestas elásticas squishy al hover/pulsar, respetando movimiento reducido.
- Acción estable `meta.story.scheduled` («Programé historia») con cantidad y días destino lunes–domingo; guardado validado en Postgres, resumen en clientes e informes A4/PNG normal y detallado.
- Registro rápido inline por cliente, «Sin cambios» en un toque con deshacer durante 8 segundos y filtros de pendientes/revisados.
- Guardar fijo, «Guardar y siguiente» y Ctrl/⌘+Enter (Shift para siguiente); el modal detallado mantiene header/footer visibles sin recorrer todo el formulario.
- Borradores locales por usuario/cliente/fecha, recuperables tras recarga y sin confirmar revisiones; bloqueo frente a una edición remota y carga explícita de la versión actual.
- Chips estables al seleccionar, favoritas editables y última plataforma recordada por dispositivo; controles inertes durante la salida animada para evitar clics sobre el cliente anterior.
- Persistencia por registros en `fng_records`, con versiones, RLS, vínculos externos únicos y validación en base de datos.
- Sincronización Realtime por usuario, recuperación al volver a primer plano y cola durable con reintentos y resolución explícita de conflictos.
- Históricos mensuales con consultas acotadas por fecha y exportaciones A4 normal/detallada.
- Importación inicial del snapshot previo y unión aditiva de registros locales desde otro dispositivo.
- Companion con login autenticado, ingesta deduplicada de sesiones y bandeja de evidencia; observar actividad no confirma una revisión.
- Receptor Service Worker para la futura fase Web Push; todavía no hay suscripción, VAPID ni scheduler de avisos.
- Transición lateral con entrada/salida solapadas, recorrido corto y sin rotación ni pausa entre secciones.
- Contadores de informes centrados con una altura común para sus etiquetas.
- Footer con copyright de Ian Pontorno, enlace al portfolio y repositorio GitHub.
- Clientes siempre ordenados alfabéticamente en jornada, semana, gestión, selector y documentos.
- Alta de clientes exige nombre e ID numérico de cuenta Meta; rechazo de nombres/cuentas duplicados, incluso en clientes archivados.
- Identidad de libreta con papel cálido, tinta, reglas sutiles y cambio lateral de páginas.
- Toggle claro/oscuro persistente, inicializado antes de mostrar la página para evitar destellos.
- Selector de clientes personalizado con búsqueda por nombre/ID, navegación de teclado y detalle de cuenta.
- 34 cuentas Meta vinculadas mediante migración aditiva y versionada; IDs almacenados como texto y copiables desde Clientes.
- Título del documento editable (por defecto Informe Ian), manteniendo Informes FNG como marca de la aplicación.
- Documento A4 compartido entre vista previa, PDF y PNG; tipografía más grande y ajuste completo a una sola hoja.
- Descarga PNG de planilla semanal e informe detallado a aproximadamente 300 dpi.
- Verificación real en Chrome aislado de tema, revisión, selector, título, responsive y exportaciones de ambos formatos.
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
- Análisis de persistencia actual, consulta mensual, consumo del Free tier y arquitectura compartida PC/Companion/móvil en `docs/HISTORICO_Y_SINCRONIZACION.md`.
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

