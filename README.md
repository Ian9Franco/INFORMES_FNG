# Informes FNG

PWA de seguimiento de Meta Ads construida con **Next.js (App Router)**, React, TypeScript y Supabase.

## Preparación

Node.js 20+; `npm install`.

1. Copiar `.env.example` como `.env.local` y completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **No guardar claves secretas en Git.**
2. El proyecto Supabase debe tener la tabla `public.workspaces` con RLS y políticas de acceso por `auth.uid() = user_id` (migración aplicada en el proyecto conectado).
3. Configurar en Supabase Auth → URL Configuration la Site URL de producción y los Redirect URLs que uses (ej. `http://localhost:3000/**` para desarrollo).
4. Ejecutar:

```bash
npm run dev
npm run build
```

## Incluye
- Ingreso mediante correo y enlace mágico de Supabase Auth.
- Persistencia PostgreSQL, un workspace JSON por usuario protegido por RLS.
- 27 clientes iniciales basados en la planilla, con alta y archivo.
- Revisiones lunes a sábado, acciones y observaciones por día.
- Pendientes persistentes y cierre/reapertura manual de semanas.
- Planilla A4 vertical e informe detallado, imprimibles o guardables como PDF.
- Manifest instalable. **No hay service worker ni soporte offline todavía**.
- Importación inicial automática del contenido local existente al crear un workspace; respaldos manuales JSON.

## Advertencias
Los datos locales de una versión anterior se importan solo al crear el workspace remoto por primera vez. No importar en dispositivos adicionales, donde podría sustituir los datos sincronizados. Las escrituras se serializan dentro de una pestaña; aún faltan control de concurrencia entre dispositivos, manejo robusto de conflictos y de fallos de red. La vista de pendientes del PDF representa el estado actual, no un cierre histórico.

Para uso diario importante, agregaremos tablas normalizadas, migraciones versionadas, mejores políticas de sincronización y pruebas de integración.
