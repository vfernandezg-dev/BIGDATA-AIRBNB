/**
 * Contorno de los países para el mapamundi de ECharts.
 *
 * ECharts no incluye geometría: hay que registrarla. Se usa Natural Earth a escala 1:110 millones (dominio
 * público), distribuida como TopoJSON por el paquete `world-atlas`, y se convierte a GeoJSON al cargarla.
 * Este módulo solo se importa con `import()` desde el mapamundi, así que sus ~100 kB no pesan en ninguna
 * otra página.
 */
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topology from "world-atlas/countries-110m.json";

import { echarts } from "./echarts";

export const WORLD_MAP = "world";

let registered = false;

export function registerWorldMap(): void {
  if (registered) return;
  const world = topology as unknown as Topology;
  const countries = feature(world, world.objects.countries as GeometryCollection);
  echarts.registerMap(WORLD_MAP, countries as unknown as Parameters<typeof echarts.registerMap>[1]);
  registered = true;
}
