"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatInt, formatUsd } from "@/lib/format";
import type { MapCell } from "@/lib/queries";
import { quantiles } from "@/lib/scale";

type CityMapProps = {
  cells: MapCell[];
  /** Lado de cada celda, en grados. */
  cellDegrees: number;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  cityName: string;
};

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
// Copiado a public/ por scripts/copy-map-worker.mjs.
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
// Rampa secuencial de un solo tono: más oscuro significa más caro.
const PRICE_COLORS = ["#b7d3f6", "#6da7ec", "#2a78d6", "#1c5cab", "#0d366b"];
const NO_PRICE_COLOR = "#c3c2b7";
const NO_PRICE_CLASS = PRICE_COLORS.length;

function priceClass(price: number | null, breaks: number[]): number {
  if (price === null) return NO_PRICE_CLASS;
  const index = breaks.findIndex((limit) => price < limit);
  return index === -1 ? breaks.length : index;
}

/**
 * Mapa de la ciudad con los anuncios agregados en celdas de unos 500 m, coloreadas por precio mediano.
 * Servir celdas en lugar de anuncios mantiene el mapa ligero aunque la ciudad tenga cien mil anuncios.
 */
export function CityMap({ cells, cellDegrees, bounds, cityName }: CityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Cortes por quintiles: cada color contiene, aproximadamente, el mismo número de celdas.
  const breaks = useMemo(() => {
    const prices = cells.map((cell) => cell[3]).filter((price): price is number => price !== null);
    const raw = quantiles(prices, [0.2, 0.4, 0.6, 0.8]);
    return raw.filter((value, index) => index === 0 || value > raw[index - 1]);
  }, [cells]);

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap | undefined;
    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl(WORKER_URL);

      const half = cellDegrees / 2;
      const features = cells.map(([lat, lon, listings, price]) => ({
        type: "Feature" as const,
        properties: { listings, price, priceClass: priceClass(price, breaks) },
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
      });
      map = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.on("error", () => setFailed(true));

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

      instance.on("load", () => {
        instance.addSource("cells", { type: "geojson", data: { type: "FeatureCollection", features } });
        const colorByClass: (string | number)[] = [];
        PRICE_COLORS.forEach((color, index) => colorByClass.push(index, color));
        instance.addLayer({
          id: "cells",
          type: "fill",
          source: "cells",
          paint: {
            "fill-color": ["match", ["get", "priceClass"], ...colorByClass, NO_PRICE_COLOR] as never,
            "fill-opacity": 0.78,
            // El borde claro separa celdas vecinas del mismo color sin añadir un trazo con peso de dato.
            "fill-outline-color": "rgba(252, 252, 251, 0.7)",
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
          value.textContent = price === null || price === undefined ? "Sin precio" : `${formatUsd(price)} por noche`;
          const detail = document.createElement("div");
          detail.textContent = `${formatInt(listings)} ${listings === 1 ? "anuncio" : "anuncios"} en la celda`;
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
      map?.remove();
    };
  }, [cells, cellDegrees, bounds, breaks]);

  const legend = PRICE_COLORS.slice(0, breaks.length + 1).map((color, index) => {
    const from = index === 0 ? null : breaks[index - 1];
    const to = index < breaks.length ? breaks[index] : null;
    const label =
      from === null ? `Menos de ${formatUsd(to)}` : to === null ? `${formatUsd(from)} o más` : `${formatUsd(from)} – ${formatInt(to)}`;
    return { color, label };
  });

  return (
    <div>
      <div
        ref={container}
        role="application"
        aria-label={`Mapa de ${cityName}: precio mediano por noche en celdas de unos 500 metros`}
        className="h-[420px] w-full overflow-hidden rounded-md border border-hairline text-[#0b0b0b]"
      />
      {failed ? (
        <p className="mt-2 text-xs text-muted">
          No se pudo cargar el mapa base. Los datos por barrio están en las tablas de esta página.
        </p>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Escala de precio mediano">
        {legend.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm ring-1 ring-hairline" style={{ background: entry.color }} />
            <span className="tabular">{entry.label}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded-sm ring-1 ring-hairline" style={{ background: NO_PRICE_COLOR }} />
          Sin precio publicado
        </li>
      </ul>
    </div>
  );
}
