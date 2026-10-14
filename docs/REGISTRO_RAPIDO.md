# Registro rápido

En **Mi jornada**, cada cliente tiene **Sin cambios** y **Registrar** (o **Editar/Continuar**). La primera opción confirma una revisión vacía, sin borrar notas previas, y ofrece **Deshacer** durante 8 segundos. Si alguien cambia la revisión o cierra la semana, deshacer no sobrescribe esos cambios.

Registrar despliega acciones dentro de la fila. Los chips no se desplazan al seleccionarse; la cantidad se cambia con +/− o escribiendo. **Más acciones** abre el catálogo y permite marcar favoritas con la estrella. Se recuerda la plataforma al pasar al siguiente cliente. Todos los controles son visibles y táctiles en móvil; hover sólo cambia su énfasis en escritorio.

La barra fija contiene **Guardar** y **Guardar y siguiente**. Siguiente busca otro cliente sin revisión en el orden alfabético de la lista visible, respetando búsqueda y filtro; si no queda otro, termina. **Ctrl/⌘ + Enter** guarda; con **Shift** pasa al siguiente. Enter solo en un campo de cantidad no confirma una revisión.

**Notas y pendientes** es opcional. El pendiente escrito se agrega junto con la revisión al guardar; **Agregar** permite registrarlo explícitamente antes. **Edición detallada** conserva el borrador y abre el formulario completo con guardar siempre visible.

## Datos y seguridad

- Cambios del formulario: `localStorage`, clave `fng-review-drafts:v1:<usuario>`, cliente/fecha y revisión base. No escriben a Supabase ni aumentan el contador. Cerrar, cambiar de cliente o navegar conserva el borrador. Si no hay espacio en el dispositivo, se avisa sin borrar otros datos.
- Borradores y favoritas son por dispositivo, no se sincronizan. Las revisiones confirmadas y pendientes usan la cola/RPC existentes y sí se comparten entre PC, Companion y celular.
- Al retomar, se compara la revisión base con la actual. Si otro dispositivo la editó, se conserva el borrador y se bloquea guardar. **Cargar versión actual** exige confirmar el descarte; copiar antes las notas necesarias.
- Semanas cerradas siguen bloqueadas. No hay nuevas tablas, polling ni escrituras por cada chip en la base de datos.

## Verificación

22 pruebas de lógica y PostgreSQL aislado; `scripts/verify-cloud.mjs` usa dos navegadores con Auth/REST/Realtime simulados para probar confirmar/deshacer, borradores tras recarga, chips estables, conflictos, reconexión, favoritas, guardar fijo móvil, siguiente, pendientes y atajos. No modifica registros de producción.
