# Registro rápido

En **Mi jornada**, cada cliente tiene **Sin cambios** y **Registrar** (o **Editar/Continuar**). La primera opción confirma una revisión vacía, sin borrar notas previas, y ofrece **Deshacer** durante 8 segundos. Si alguien cambia la revisión o cierra la semana, deshacer no sobrescribe esos cambios.

Registrar despliega acciones dentro de la fila. Los chips no se desplazan al seleccionarse; la cantidad se cambia con +/− o escribiendo. **Más acciones** abre el catálogo y permite marcar favoritas con la estrella. Se recuerda la plataforma al pasar al siguiente cliente. Todos los controles son visibles y táctiles en móvil; hover sólo cambia su énfasis en escritorio.

Abrir/cerrar una fila conserva la posición de lectura, sin desplazamiento automático ni foco en otro campo. **Guardar y siguiente** sí desplaza y enfoca al próximo cliente, como navegación explícita.

La expansión dura aproximadamente 460 ms y combina altura progresiva con una deformación muy sutil del contenido; el cierre retira el contenido antes de completar el colapso. Los controles de una sección que sale quedan inertes. El modal detallado mantiene la capa/foco hasta que termina su animación de salida, sin un temporizador que la corte. Movimiento reducido elimina estos efectos.

Guardar es sólido y «Guardar y siguiente» tonal con borde, ambos con contraste de texto mayor a 7:1 en los dos temas. La confirmación del cliente tiene check animado/pulso elástico; una confirmación remota con el mismo estado no repite el efecto. El dock móvil tiene margen interior propio, vidrio translúcido con blur y un indicador deslizante líquido; hay fallback opaco si el navegador no soporta blur o se solicita menor transparencia.

La barra fija contiene **Guardar** y **Guardar y siguiente**. Siguiente busca otro cliente sin revisión en el orden alfabético de la lista visible, respetando búsqueda y filtro; si no queda otro, termina. **Ctrl/⌘ + Enter** guarda; con **Shift** pasa al siguiente. Enter solo en un campo de cantidad no confirma una revisión.

**Notas y pendientes** es opcional. El pendiente escrito se agrega junto con la revisión al guardar; **Agregar** permite registrarlo explícitamente antes. **Edición detallada** conserva el borrador y abre el formulario completo con guardar siempre visible.

## Datos y seguridad

### Acciones propias y publicaciones

**Crear acción** permite nombrarla para la plataforma actual y elegir **Sólo este cliente** (predeterminado) o **Todos mis clientes**. El alcance general sigue siendo privado de tu usuario, nunca de todos los usuarios. Crear guarda una definición sincronizable y la selecciona en el borrador; confirmar la revisión sigue siendo un paso independiente.

Cada definición ocupa una fila `kind=action` con ID `custom.<uuid-v4>`, etiqueta, plataforma y alcance; `clientId` es obligatorio sólo para las específicas. Son inmutables para no alterar el historial. Se rechazan duplicados de nombre/plataforma/alcance; el servidor también rechaza usar una acción de otro cliente. Cada entrada incluye `customDefinition` como snapshot para que los respaldos e informes sean legibles. Crear clientes y definiciones precede al guardado de sus revisiones en la cola y en el RPC.

Al restaurar un respaldo anterior se conservan las definiciones ya creadas; si un cliente referido no viene en el archivo, se conserva archivado. La unión de registros locales remapea también los IDs de cliente de las acciones y sus snapshots.

**Programé publicación** usa `meta.post.scheduled` y el mismo selector de días que las historias. La planilla normal distingue `H:` (historias) y `P:` (publicaciones); el detallado conserva nombre, cantidad y días completos. Ninguna de estas acciones publica automáticamente en Meta.

La cabecera agrupa tema y menú de cuenta: correo, contraseña, cerrar sesión, actualización manual y explicación del estado de DB. **DB activa** indica datos sincronizados con Supabase; **DB · sincronizando**, **DB · revisar** y **DB sin conexión** distinguen cambios pendientes, conflictos y problemas de conexión. No representa el estado de la extensión Companion. Se recupera la sesión administrada por el SDK al iniciar; no se guardan contraseñas ni se elude Auth/RLS.

### Historias programadas

**Programé historia** está siempre disponible entre las acciones rápidas de Meta. Su ID inmutable es `meta.story.scheduled`, cantidad de historias en `quantity` y días destino en `scheduledDays`: uno o varios de `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Se inicia con el día actual y se puede cambiar en el dropdown. La fecha de la revisión sigue siendo cuándo se registró el trabajo; los días indican **para cuándo** se programó. No representa una integración que publique historias automáticamente.

El resumen del cliente muestra los días. El informe normal indica `H: Lun · Jue`, y el detallado incluye «para lunes, jueves». PostgreSQL rechaza días desconocidos/repetidos y listas vacías. No hay nuevas tablas ni consultas por seleccionar días.

### Comportamiento de la interfaz

El resumen se agrupa en una franja, se aprovecha más ancho en escritorio y los clientes tienen un único separador real. La bandeja de Companion se despliega con «Ver» para no empujar la lista hacia abajo. La salida y entrada de páginas son secuenciales, sin superposición; mientras sale una página sus controles quedan inertes. Hover/pulsación tienen respuesta elástica que se desactiva con movimiento reducido. Los campos tienen espacio para el foco, y el dropdown de días usa popover nativo para evitar recortes dentro del modal.

- Cambios del formulario: `localStorage`, clave `fng-review-drafts:v1:<usuario>`, cliente/fecha y revisión base. No escriben a Supabase ni aumentan el contador. Cerrar, cambiar de cliente o navegar conserva el borrador. Si no hay espacio en el dispositivo, se avisa sin borrar otros datos.
- Borradores y favoritas son por dispositivo, no se sincronizan. Las revisiones confirmadas y pendientes usan la cola/RPC existentes y sí se comparten entre PC, Companion y celular.
- Al retomar, se compara la revisión base con la actual. Si otro dispositivo la editó, se conserva el borrador y se bloquea guardar. **Cargar versión actual** exige confirmar el descarte; copiar antes las notas necesarias.
- Semanas cerradas siguen bloqueadas. No hay nuevas tablas, polling ni escrituras por cada chip en la base de datos.

## Verificación

### Informe detallado compacto

El detallado usa dos columnas con texto fijo de 10,5 pt; mantiene juntos los bloques de cliente que entran en una columna y agrega páginas A4 sólo al necesitarlo. Una revisión normal no se corta; una nota mayor que una columna continúa, sin perder caracteres. La última hoja se equilibra por bloques conservando orden alfabético y cronológico. Acciones de la misma plataforma comparten prefijo; se omiten observaciones vacías y pendientes vacíos. PDF/vista previa comparten distribución y numeración. PNG exporta todas las hojas en una imagen vertical y adapta resolución para respetar límites de canvas. La planilla normal continúa en una hoja.

39 pruebas de lógica, nombres de exportación, exclusión de clientes archivados/eliminados, paginación física, contraste de paleta/guardado y PostgreSQL aislado; `scripts/verify-cloud.mjs` usa dos navegadores con Auth/REST/Realtime simulados para probar confirmar/deshacer, borradores tras recarga, chips estables, conflictos, reconexión, favoritas, guardar fijo móvil, siguiente, pendientes y atajos. También verifica cuadros intermedios de apertura/cierre/confirmación, controles inertes, cierre anticipado del modal, movimiento reducido, contraste real de botones, centrado/márgenes/blur del dock en 320/390/768 y escritorio 1920. Mantiene pruebas de exportación corta/larga y de sincronización; no modifica registros de producción.

Los formatos se llaman **Simple** y **Detallado**; semanal/mensual se elige arriba. PDF y PNG comparten el nombre `Título - semanal AAAA-MM-DD - simple` (o `mensual AAAA-MM - detallado`), por lo que ambos formatos no se pisan. El PDF usa ese título hasta `afterprint`, incluso al cancelar, y luego restaura «Informes FNG»; el navegador decide el nombre final del archivo. Seleccionar de nuevo el mismo formato no reinicia la animación. La salida y entrada de la vista previa son secuenciales e inertes durante la salida. Las transformaciones visuales no participan en la medición A4. El footer y sus links se validan en 320/390/768 px, con temas claro/oscuro y sin canvas blanco fuera del documento; también se comprueban apertura/cierre del menú de cuenta y restauración del foco.

Sólo se exportan clientes activos: se excluyen archivados/eliminados, sus revisiones y pendientes, tanto del documento como de los contadores, en ambos formatos y períodos. Es un filtro de lectura, no una eliminación de historial: reactivar un cliente vuelve a incluir sus registros. La prueba de navegador conserva registros archivados/huérfanos simulados y verifica que ninguno aparezca en las cuatro combinaciones.
