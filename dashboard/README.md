# Dashboard

Sitio web del proyecto: lee los data marts que publica el pipeline y los muestra como páginas
pre-renderizadas. La visión general, la arquitectura y el despliegue están en el
[README principal](../README.md).

## Desarrollo

Necesita los marts publicados en la base PostgreSQL local del stack de Docker
(`docker compose exec pipeline python3 -m airbnb_lake publish`).

```bash
cp .env.example .env.local
pnpm install
pnpm dev          # http://localhost:3000, con recarga en caliente
```

| Orden | Qué hace |
|---|---|
| `pnpm build && pnpm start` | Construye y sirve el sitio como en producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Genera los tipos de las rutas y ejecuta `tsc` |
| `pnpm e2e` | Pruebas de humo con Playwright (requiere `pnpm build` y, la primera vez, `pnpm exec playwright install chromium`) |

## Cómo está hecho

- **`src/lib/queries.ts`** contiene todas las consultas. Cada una se cachea con `use cache` y la etiqueta
  `marts`; `POST /api/revalidate` (con la cabecera `x-revalidate-secret`) invalida esa etiqueta.
- **`src/lib/db.ts`** abre un pool pequeño de `pg` con el rol de solo lectura.
- **`src/components/`** tiene los gráficos, escritos en SVG y HTML sin librería de gráficos: barras
  ordenadas, columnas, series temporales, barra segmentada, barras divergentes, dispersión y el mapa
  (MapLibre GL sobre el mapa base de OpenFreeMap).
- **`scripts/copy-map-worker.mjs`** copia el worker de MapLibre a `public/maplibre/` antes de `dev` y
  `build`: al empaquetar, MapLibre no puede localizarlo por su ruta relativa.

## Criterios de los gráficos

- Un color por serie, asignado a la entidad y no a su posición; la paleta está validada para daltonismo
  en modo claro y oscuro.
- Magnitud con un solo tono (de claro a oscuro); valores por encima y por debajo de un punto neutro con
  dos tonos opuestos.
- Cada gráfico tiene su tabla equivalente («Ver los datos en tabla») y su detalle es accesible con el
  teclado: ningún valor depende solo del color ni del cursor.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de solo lectura a los marts. Se usa al construir (pre-renderizado) y al regenerar páginas |
| `REVALIDATE_SECRET` | Secreto que debe enviar el pipeline a `/api/revalidate` |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio, para los metadatos |
