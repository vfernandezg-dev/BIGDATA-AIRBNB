// MapLibre GL 6 ejecuta el procesado de teselas en un worker que vive en un archivo aparte. Al empaquetar
// la aplicación, la ruta relativa con la que MapLibre lo busca deja de ser válida, así que se sirve como
// archivo estático desde /maplibre/ y el mapa lo carga con setWorkerUrl (src/components/city-map.tsx).
// Se copia desde node_modules en cada arranque o build para que siempre coincida con la versión instalada.
import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");

mkdirSync(target, { recursive: true });
// Se copian juntos: el worker puede importar el módulo compartido con una ruta relativa.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(join(source, file), join(target, file));
}
