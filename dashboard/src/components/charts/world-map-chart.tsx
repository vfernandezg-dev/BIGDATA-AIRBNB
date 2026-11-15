"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { formatInt, formatPercent, formatUsd } from "@/lib/format";

import { baseOption, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type WorldMapCity = {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  price: number | null;
  listings: number;
  occupancy: number | null;
};

type Region = {
  id: string;
  label: string;
  /** Esquinas del encuadre: [longitud oeste, latitud norte] y [longitud este, latitud sur]. */
  bounds: [[number, number], [number, number]];
};

// Encuadres del mapa. El mundo se recorta por arriba y por abajo: los polos solo restan tamaño al resto.
const REGIONS: Region[] = [
  { id: "world", label: "Mundo", bounds: [[-170, 78], [180, -58]] },
  { id: "americas", label: "América", bounds: [[-128, 54], [-30, -44]] },
  { id: "europe", label: "Europa", bounds: [[-13, 60], [24, 34]] },
];

const MIN_SIZE = 12;
const MAX_EXTRA_SIZE = 26;
const HEIGHT = 440;

function loadWorldMap(): Promise<void> {
  return import("@/lib/world-map").then((module) => module.registerWorldMap());
}

/**
 * Mapamundi con una burbuja por ciudad: el color indica el precio mediano por noche (más oscuro, más cara)
 * y el área, el número de anuncios. Pulsar una ciudad abre su página; los botones cambian el encuadre, que
 * es la forma de acercarse sin que la rueda del ratón secuestre el desplazamiento de la página.
 */
export function WorldMapChart({ cities, label }: { cities: WorldMapCity[]; label: string }) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(REGIONS[0].id);
  const region = REGIONS.find((candidate) => candidate.id === regionId) ?? REGIONS[0];

  const openCity = useCallback(
    (index: number) => {
      const city = cities[index];
      if (city) router.push(`/ciudad/${city.slug}`);
    },
    [cities, router],
  );

  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const prices = cities.map((city) => city.price).filter((price): price is number => price !== null);
      const maxListings = Math.max(...cities.map((city) => city.listings), 1);
      return {
        ...baseOption(theme),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "item",
          formatter: (params: { dataIndex: number }) => {
            const city = cities[params.dataIndex];
            return tooltipContent(theme, `${city.name}, ${city.country}`, [
              { value: formatUsd(city.price), label: "precio mediano por noche" },
              { value: formatInt(city.listings), label: "anuncios" },
              { value: formatPercent(city.occupancy), label: "ocupación estimada" },
            ]);
          },
        },
        geo: {
          map: "world",
          roam: false,
          // Los países son solo el fondo: no reaccionan al cursor ni compiten con las ciudades.
          silent: true,
          boundingCoords: region.bounds,
          left: 0,
          right: 0,
          top: 8,
          bottom: 44,
          itemStyle: { areaColor: theme.grid, borderColor: theme.surface, borderWidth: 0.6 },
          emphasis: { disabled: true },
        },
        visualMap: {
          type: "continuous",
          dimension: 2,
          min: Math.min(...prices),
          max: Math.max(...prices),
          calculable: false,
          hoverLink: false,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          itemWidth: 10,
          itemHeight: 150,
          text: [formatUsd(Math.max(...prices)), formatUsd(Math.min(...prices))],
          textStyle: { color: theme.muted, fontSize: 11 },
          inRange: { color: theme.sequential },
        },
        series: [
          {
            type: "scatter",
            coordinateSystem: "geo",
            data: cities.map((city) => ({ name: city.name, value: [city.lon, city.lat, city.price, city.listings] })),
            // El área (no el diámetro) es proporcional a los anuncios: por eso la raíz cuadrada.
            symbolSize: (value: number[]) => MIN_SIZE + MAX_EXTRA_SIZE * Math.sqrt(value[3] / maxListings),
            cursor: "pointer",
            itemStyle: { borderColor: theme.surface, borderWidth: 2, opacity: 0.95 },
            emphasis: { scale: 1.15 },
            label: {
              show: true,
              formatter: "{b}",
              position: "right",
              color: theme.ink,
              fontSize: 11,
              // Halo del color de la superficie: el nombre se lee igual sobre tierra que sobre mar.
              textBorderColor: theme.surface,
              textBorderWidth: 2.5,
            },
            labelLayout: { hideOverlap: true },
          },
        ],
      };
    },
    [cities, region],
  );

  if (cities.length === 0) return <p className="text-sm text-muted">Sin ciudades publicadas.</p>;

  return (
    <div>
      <div
        role="group"
        aria-label="Encuadre del mapa"
        className="mb-3 inline-flex rounded-md border border-hairline p-0.5"
      >
        {REGIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={regionId === option.id}
            onClick={() => setRegionId(option.id)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              regionId === option.id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <EChart
        buildOption={buildOption}
        height={HEIGHT}
        label={label}
        prepare={loadWorldMap}
        onItemClick={openCity}
      />
    </div>
  );
}
