# Registro rápido

En **Mi jornada**, cada cliente tiene **Sin cambios** y **Registrar** (o **Editar/Continuar**). La primera opción confirma una revisión vacía, sin borrar notas previas, y ofrece **Deshacer** durante 8 segundos. Si alguien cambia la revisión o cierra la semana, deshacer no sobrescribe esos cambios.

Registrar despliega acciones dentro de la fila. Los chips no se desplazan al seleccionarse; la cantidad se cambia con +/− o escribiendo. **Más acciones** abre el catálogo y permite marcar favoritas con la estrella. Se recuerda la plataforma al pasar al siguiente cliente. Todos los controles son visibles y táctiles en móvil; hover sólo cambia su énfasis en escritorio.

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

28 pruebas de lógica, contraste de paleta y PostgreSQL aislado; `scripts/verify-cloud.mjs` usa dos navegadores con Auth/REST/Realtime simulados para probar confirmar/deshacer, borradores tras recarga, chips estables, conflictos, reconexión, favoritas, guardar fijo móvil, siguiente, pendientes y atajos. También verifica acciones específicas/generales, publicaciones e historias, sesión persistente, confirmación accesible, menú de cuenta móvil, 39 clientes, anchos 320/390/768/1920, transición con una sola página y PNG/PDF de una hoja. No modifica registros de producción.
