# Informes FNG

PWA inicial para el seguimiento personal del trabajo en Meta Ads. Separa la bitácora de acciones y observaciones de la planilla que se imprime los lunes.

## Lo que ya funciona
- Panel de jornada y revisiones por cliente.
- Grilla semanal de **lunes a sábado**. Una revisión por cliente y día; admite notas y acciones.
- Pendientes persistentes entre semanas y posibilidad de marcarlos resueltos.
- Cierre y reapertura manual de semanas. Cada lunes se muestra una grilla nueva sin borrar las anteriores.
- Clientes activos/archivados; 27 nombres iniciales transcritos de la hoja, editables.
- Planilla A4 vertical y reporte detallado, imprimibles o guardables como PDF.
- PWA instalable, recursos cacheados, almacenamiento local y exportación/importación de respaldo JSON.

## Ejecutar

Node.js 20+.

```bash
npm install
npm run dev
npm run build
```

## Flujo de lunes
1. En **Semana**, ir a la semana anterior, revisar marcas y cerrar.
2. En **Informes**, elegir la semana y generar la planilla resumida o el detalle.
3. Imprimir o seleccionar «Guardar como PDF».
4. La nueva semana ya está limpia; los pendientes siguen visibles.

## Limitaciones del primer PR
**No hay backend, login ni sincronización entre dispositivos.** Los datos se guardan en `localStorage` de este navegador. Limpiar el navegador puede borrarlos: exportá respaldos frecuentemente. Importar un JSON reemplaza todos los registros locales. No registres información sensible de clientes hasta implementar autenticación y políticas de acceso. El caché PWA no sincroniza datos.

No hay conexión con Meta Ads, emails automáticos ni notificaciones push. Los pendientes incluidos en el informe detallado reflejan su estado al imprimir, no una fotografía histórica del cierre semanal. La lista de nombres fue transcrita de una fotografía, por lo que conviene verificarla.

## Próximos PR
- Supabase Auth + PostgreSQL y RLS para sincronización segura.
- Ficha/historial por cliente, búsqueda y filtros.
- Vencimientos y notificaciones.
- Pruebas automáticas y refinamiento de reportes.
