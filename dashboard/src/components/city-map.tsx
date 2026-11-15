"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { useChartMessages, useFormatters } from "@/i18n/client";
import type { MapCell } from "@/lib/queries";
import { quantiles } from "@/lib/scale";

type CityMapProps = {
  cells: MapCell[];
  /** Lado de cada celda, en grados. */
  cellDegrees: number;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  cityName: string;
};

type MapMode = "heat" | "cells";

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
// Copiado a public/ por scripts/copy-map-worker.mjs.
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

// Celdas: rampa secuencial de un solo tono, más oscuro significa más caro.
const PRICE_COLORS = ["#b7d3f6", "#6da7ec", "#2a78d6", "#1c5cab", "#0d366b"];
const NO_PRICE_COLOR = "#c3c2b7";
const NO_PRICE_CLASS = PRICE_COLORS.length;

// Mapa de calor: rampa cálida (de amarillo a rojo), la convención de este tipo de mapa, con su escala.
const HEAT_COLORS = ["#fde7a3", "#f9b24d", "#eb6834", "#b3261e"];
// Una celda con pocos anuncios pesa menos: un único alojamiento de lujo no debe encender una zona.
const LISTINGS_FOR_FULL_WEIGHT = 3;

const MODES: MapMode[] = ["heat", "cells"];

function priceClass(price: number | null, breaks: number[]): number {
  if (price === null) return NO_PRICE_CLASS;
  const index = breaks.findIndex((limit) => price < limit);
  return index === -1 ? breaks.length : index;
}

/**
 * Mapa de la ciudad con los anuncios agregados en celdas de unos 500 m, en dos vistas:
 *
 * - Mapa de calor: resalta las zonas donde se concentran las celdas más caras que la mediana de la ciudad.
 * - Precio por celda: cada celda con el color de su precio mediano, para leer valores concretos.
 *
 * Servir celdas en lugar de anuncios mantiene el mapa ligero aunque la ciudad tenga cien mil anuncios.
 */
export function CityMap({ cells, cellDegrees, bounds, cityName }: CityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mode, setMode] = useState<MapMode>("heat");
  const modeRef = useRef(mode);
  const [failed, setFailed] = useState(false);
  const fmt = useFormatters();
  const messages = useChartMessages().cityMap;

  const stats = useMemo(() => {
    const prices = cells.map((cell) => cell[3]).filter((price): price is number => price !== null);
    // Cortes por quintiles: cada color contiene, aproximadamente, el mismo número de celdas.
    const raw = quantiles(prices, [0.2, 0.4, 0.6, 0.8]);
    const breaks = raw.filter((value, index) => index === 0 || value > raw[index - 1]);
    const [median, high] = quantiles(prices, [0.5, 0.9]);
    return { breaks, median, high };
  }, [cells]);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl(WORKER_URL);

      const half = cellDegrees / 2;
      const polygons = cells.map(([lat, lon, listings, price]) => ({
        type: "Feature" as const,
        properties: { listings, price, priceClass: priceClass(price, stats.breaks) },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [lon - half, lat - half],
              [lon + half, lat - half],
              [lon + half, lat + half],
              [lon - half, lat + half],
              [lon - half, lat - half],
            ],
          ],
        },
      }));

      // Peso de cada celda en el mapa de calor: 0 en la mediana de la ciudad y 1 en el percentil 90 o más.
      const priceSpan = Math.max(stats.high - stats.median, 1);
      const points = cells.flatMap(([lat, lon, listings, price]) => {
        if (price === null || price <= stats.median) return [];
        const priceWeight = Math.min(1, (price - stats.median) / priceSpan);
        const supportWeight = Math.min(1, listings / LISTINGS_FOR_FULL_WEIGHT);
        return [
          {
            type: "Feature" as const,
            properties: { weight: priceWeight * supportWeight },
            geometry: { type: "Point" as const, coordinates: [lon, lat] },
          },
        ];
      });

      const instance = new maplibregl.Map({
        container: container.current,
        style: BASEMAP_STYLE,
        bounds: [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        ],
        fitBoundsOptions: { padding: 24 },
        // Con el desplazamiento de la página no se hace zoom por accidente: hace falta Ctrl o dos dedos.
        cooperativeGestures: true,
        attributionControl: { compact: true },
        locale: messages.controls,
      });
      mapRef.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.on("error", () => setFailed(true));

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

      instance.on("load", () => {
        instance.addSource("cells", { type: "geojson", data: { type: "FeatureCollection", features: polygons } });
        instance.addSource("heat", { type: "geojson", data: { type: "FeatureCollection", features: points } });

        const colorByClass: (string | number)[] = [];
        PRICE_COLORS.forEach((color, index) => colorByClass.push(index, color));
        instance.addLayer({
          id: "cells",
          type: "fill",
          source: "cells",
          layout: { visibility: modeRef.current === "cells" ? "visible" : "none" },
          paint: {
            "fill-color": ["match", ["get", "priceClass"], ...colorByClass, NO_PRICE_COLOR] as never,
            "fill-opacity": 0.78,
            // El borde claro separa celdas vecinas del mismo color sin añadir un trazo con peso de dato.
            "fill-outline-color": "rgba(252, 252, 251, 0.7)",
          },
        });

        instance.addLayer({
          id: "heat",
          type: "heatmap",
          source: "heat",
          layout: { visibility: modeRef.current === "heat" ? "visible" : "none" },
          paint: {
            "heatmap-weight": ["get", "weight"],
            // El radio se duplica con cada nivel de zoom, como el tamaño en pantalla de una celda: la mancha
            // cubre siempre dos o tres celdas a cada lado.
            "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 8, 4, 16, 1024],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, 2],
            "heatmap-opacity": 0.82,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(253, 231, 163, 0)",
              0.12,
              HEAT_COLORS[0],
              0.4,
              HEAT_COLORS[1],
              0.7,
              HEAT_COLORS[2],
              1,
              HEAT_COLORS[3],
            ],
          },
        });

        instance.on("mousemove", "cells", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          instance.getCanvas().style.cursor = "pointer";
          const { listings, price } = feature.properties as { listings: number; price: number | null };
          // El contenido se construye con nodos de texto: nada del dato se interpreta como HTML.
          const content = document.createElement("div");
          const value = document.createElement("strong");
          value.textContent = price === null || price === undefined ? messages.noPrice : messages.perNight(fmt.usd(price));
          const detail = document.createElement("div");
          detail.textContent = messages.listingsInCell(listings, fmt.int(listings));
          content.append(value, detail);
          popup.setLngLat(event.lngLat).setDOMContent(content).addTo(instance);
        });
        instance.on("mouseleave", "cells", () => {
          instance.getCanvas().style.cursor = "";
          popup.remove();
        });
      });
    })().catch(() => setFailed(true));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [cells, cellDegrees, bounds, stats, fmt, messages]);

  // Cambiar de vista solo alterna la visibilidad de dos capas ya cargadas: no se vuelve a crear el mapa.
  useEffect(() => {
    modeRef.current = mode;
    const map = mapRef.current;
    if (!map || !map.getLayer("cells") || !map.getLayer("heat")) return;
    map.setLayoutProperty("cells", "visibility", mode === "cells" ? "visible" : "none");
    map.setLayoutProperty("heat", "visibility", mode === "heat" ? "visible" : "none");
  }, [mode]);

  const cellLegend = PRICE_COLORS.slice(0, stats.breaks.length + 1).map((color, index) => {
    const from = index === 0 ? null : stats.breaks[index - 1];
    const to = index < stats.breaks.length ? stats.breaks[index] : null;
    const label =
      from === null
        ? messages.lessThan(fmt.usd(to))
        : to === null
          ? messages.orMore(fmt.usd(from))
          : `${fmt.usd(from)} – ${fmt.int(to)}`;
    return { color, label };
  });

  return (
    <div>
      <div
        role="group"
        aria-label={messages.modesLabel}
        className="mb-3 inline-flex rounded-md border border-hairline p-0.5"
      >
        {MODES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              mode === option ? "bg-ink text-surface" : "text-ink-2 hover:text-ink"
            }`}
          >
            {messages[option]}
          </button>
        ))}
      </div>

      <div
        ref={container}
        role="application"
        aria-label={messages.label(cityName)}
        className="h-[460px] w-full overflow-hidden rounded-md border border-hairline text-[#0b0b0b]"
      />
      {failed ? (
        <p className="mt-2 text-xs text-muted">
          {messages.failed}
        </p>
      ) : null}

      {mode === "heat" ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2"
          aria-label={messages.heatScaleLabel}
        >
          <span className="tabular">{messages.cityMedian(fmt.usd(stats.median))}</span>
          <span
            aria-hidden
            className="inline-block h-2.5 w-36 rounded-sm ring-1 ring-hairline"
            style={{ background: `linear-gradient(to right, ${HEAT_COLORS.join(", ")})` }}
          />
          <span className="tabular">{messages.orMore(fmt.usd(stats.high))}</span>
        </div>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label={messages.cellScaleLabel}>
          {cellLegend.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-4 rounded-sm ring-1 ring-hairline"
                style={{ background: entry.color }}
              />
              <span className="tabular">{entry.label}</span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-4 rounded-sm ring-1 ring-hairline"
              style={{ background: NO_PRICE_COLOR }}
            />
            {messages.noPublishedPrice}
          </li>
        </ul>
      )}
    </div>
  );
}
