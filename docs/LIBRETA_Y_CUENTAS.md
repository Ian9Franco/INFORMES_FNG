# Libreta, documentos y cuentas publicitarias

La aplicación conserva la marca **Informes FNG**. El título de los documentos se configura en Informes; su valor inicial es **Informe Ian**. La preferencia se conserva en este dispositivo y se aplica a la vista previa, al PDF y a las descargas PNG de ambos formatos.

El tema sigue la preferencia del sistema hasta que se selecciona uno con el toggle. La elección explícita queda guardada en el dispositivo. El informe conserva papel blanco, independientemente del tema de la interfaz.

## Una hoja A4

`NotebookReport` comparte el mismo documento para vista previa, impresión y PNG. La hoja mide 210 × 297 mm, con margen interno de 10 mm. El texto parte de 11 pt y se ajusta únicamente cuando no entra en el área disponible. La vista previa informa el porcentaje de reducción. No se descarta contenido: un informe muy extenso tendrá texto más pequeño mientras siga vigente el límite de una hoja.

La descarga PNG se genera a aproximadamente 300 dpi. PDF usa la impresión del navegador con tamaño A4 definido en CSS. Los encabezados y pies adicionales del navegador deben estar desactivados si el usuario los habilitó en su configuración de impresión.

## Vinculación de las cuentas de Meta

Cada cliente puede tener `advertisingAccounts: [{ platform: 'meta_ads', accountId: string, owner: string }]`. Los 34 IDs proporcionados se conservan como strings, incluidos valores que exceden el rango de enteros seguros de JavaScript. No convertirlos a `Number`.

La migración `accountCatalogVersion: 1` conserva los IDs de clientes existentes, sus nombres, estado de archivo, revisiones y pendientes. Los alias explícitos vinculan nombres anteriores (por ejemplo REGINA / Regina Bistró y CULPINA EXPEDITION / EXPEDITION TRUCK). Las cuentas sin cliente se agregan con ID `meta-${accountId}`. El catálogo se aplica una sola vez, por lo que no recrea clientes eliminados después de la migración.

CORUÉS no se asume equivalente a COQUES: se conserva el cliente anterior y se agrega COQUES con el ID proporcionado. HOUSTON USA, AZAHARES, GENERIA y NET también se conservan sin inventarles cuentas.

Estos datos identifican las cuentas; no otorgan permisos OAuth ni acceso a Meta. Para conectar Companion, se puede resolver `meta_ads + accountId` contra `client.advertisingAccounts` y usar el `client.id` existente en el contrato de acciones. La deduplicación y confirmación de eventos se describen en `ACCIONES_RAPIDAS.md`.

Todas las listas, selectores y documentos ordenan clientes con un comparador alfabético español, independientemente del orden de carga o importación. El alta exige nombre e ID numérico real de cuenta Meta, conserva el ID como texto y evita nombres o cuentas duplicados incluyendo clientes archivados. La validación verifica formato y unicidad local; comprobar acceso/propiedad en Meta corresponde a la futura integración autenticada. El propietario de una cuenta nueva queda vacío hasta contar con esa información, en vez de inferirlo del nombre del cliente.

## Verificación reproducible

`npm test` comprueba catálogo, migración, historial y acciones. `scripts/verify-notebook.mjs` verifica en un perfil aislado de Chrome el tema, selector, revisión guardada, persistencia del título, descargas PNG, PDFs de una página y layout móvil. Recibe URL local, ruta al módulo Playwright, ejecutable de Chrome y carpeta de salida; no utiliza sesiones del usuario.
