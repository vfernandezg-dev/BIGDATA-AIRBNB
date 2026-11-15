"use client";

import { useCallback } from "react";

import { useChartMessages, useFormatters } from "@/i18n/client";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type CityBubble = { name: string; price: number; occupancy: number; listings: number };

const MIN_SIZE = 14;
const MAX_EXTRA_SIZE = 34;
// Dos ciudades están «juntas» si distan menos que esto, con ambos ejes normalizados de 0 a 1.
const CROWDED_DISTANCE = 0.16;
const LABEL_POSITIONS = ["top", "bottom", "right", "left"] as const;

/**
 * Posición de la etiqueta de cada burbuja. Varias ciudades tienen precio y ocupación casi iguales: si
 * todas llevaran el nombre encima, se pisarían. Cada una toma la primera posición que no usa una vecina.
 */
function labelPositions(cities: CityBubble[]): Map<string, (typeof LABEL_POSITIONS)[number]> {
  const span = (values: number[]) => Math.max(Math.max(...values) - Math.min(...values), Number.EPSILON);
  const priceSpan = span(cities.map((city) => city.price));
  const occupancySpan = span(cities.map((city) => city.occupancy));
  const placed = new Map<string, (typeof LABEL_POSITIONS)[number]>();

  for (const city of [...cities].sort((a, b) => a.price - b.price)) {
    const taken = new Set(
      cities
        .filter((other) => placed.has(other.name))
        .filter(
          (other) =>
            Math.hypot((other.price - city.price) / priceSpan, (other.occupancy - city.occupancy) / occupancySpan) <
            CROWDED_DISTANCE,
        )
        .map((other) => placed.get(other.name)),
    );
    placed.set(city.name, LABEL_POSITIONS.find((position) => !taken.has(position)) ?? "top");
  }
  return placed;
}

/**
 * Precio frente a ocupación, una burbuja por ciudad; el área de la burbuja indica el número de anuncios.
 * Cada burbuja lleva el nombre de su ciudad: con doce puntos la etiqueta directa sustituye a la leyenda.
 */
export function CityBubbleChart({ cities, label }: { cities: CityBubble[]; label: string }) {
  const fmt = useFormatters();
  const messages = useChartMessages().bubbles;
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      const maxListings = Math.max(...cities.map((city) => city.listings), 1);
      const positions = labelPositions(cities);
      return {
        ...baseOption(theme),
        grid: gridBox({ top: 24, right: 28, bottom: 8 }),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "item",
          formatter: (params: { dataIndex: number }) => {
            const city = cities[params.dataIndex];
            return tooltipContent(theme, city.name, [
              { value: fmt.usd(city.price), label: messages.medianPrice },
              { value: fmt.percent(city.occupancy), label: messages.occupancy },
              { value: fmt.int(city.listings), label: messages.listings },
            ]);
          },
        },
        xAxis: {
          type: "value",
          scale: true,
          name: messages.xAxis,
          nameLocation: "middle",
          nameGap: 30,
          ...axis,
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => fmt.int(value) },
        },
        yAxis: {
          type: "value",
          scale: true,
          name: messages.yAxis,
          nameLocation: "end",
          ...axis,
          // Tras `...axis`: el nombre del eje se alinea a la izquierda, sobre las etiquetas.
          nameTextStyle: { ...axis.nameTextStyle, align: "left" },
          axisLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => fmt.percent(value) },
        },
        series: [
          {
            type: "scatter",
            data: cities.map((city) => ({
              name: city.name,
              value: [city.price, city.occupancy, city.listings],
              label: { position: positions.get(city.name) },
            })),
            // El área (no el diámetro) es proporcional a los anuncios: por eso la raíz cuadrada.
            symbolSize: (value: number[]) => MIN_SIZE + MAX_EXTRA_SIZE * Math.sqrt(value[2] / maxListings),
            itemStyle: { color: theme.series[0], opacity: 0.72, borderColor: theme.surface, borderWidth: 2 },
            emphasis: { scale: 1.08, itemStyle: { opacity: 1 } },
            label: { show: true, formatter: "{b}", color: theme.ink2, fontSize: 11 },
            // Red de seguridad: si aun así dos nombres coinciden, se oculta uno (sigue en el detalle).
            labelLayout: { hideOverlap: true },
          },
        ],
      };
    },
    [cities, fmt, messages],
  );

  return <EChart buildOption={buildOption} height={380} label={label} />;
}
