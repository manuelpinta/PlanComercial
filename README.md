# Plan Comercial

Aplicación Next.js del plan comercial: formulario en `public/plan.html` y API en `app/api`.

## Arranque

- Copia variables de entorno desde `.env.example` a `.env.local` y completa `MYSQL_*`.
- `npm install` y `npm run dev`.

## Documentación

La carpeta `docs/` está en `.gitignore` (notas internas, SQL de referencia, etc.). Cada quien la mantiene en local; no forma parte del repositorio remoto.

## API (resumen)

- Autollenado: `GET /api/autollenado?mode=regiones|sucursales|detalle` — ver `app/api/autollenado/route.ts`.
- Planes: `GET|POST|PUT|DELETE /api/planes`, `PATCH /api/planes/[planId]` — ver `app/api/planes/`.
