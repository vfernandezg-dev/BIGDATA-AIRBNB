"use client";

import { useCallback } from "react";

import { formatDecimal, formatInt, formatUsd } from "@/lib/format";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type NeighbourhoodPoint = { name: string; listings: number; price: number; rating: number | null };

// Solo se etiquetan los barrios de los extremos: un nombre en cada punto sería ilegible.
const LABELLED_PER_EXTREME = 4;

/**
 * Oferta frente a precio, un punto por barrio. El eje de anuncios es logarítmico: unos pocos barrios
 * concentran la mayor parte de la oferta y, en escala lineal, el resto quedaría aplastado contra el origen.
 */
export function NeighbourhoodScatterChart({ points, label }: { points: NeighbourhoodPoint[]; label: string }) {
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      const byPrice = [...points].sort((a, b) => b.price - a.price).slice(0, LABELLED_PER_EXTREME);
      const byListings = [...points].sort((a, b) => b.listings - a.listings).slice(0, LABELLED_PER_EXTREME);
      const labelled = new Set([...byPrice, ...byListings].map((point) => point.name));
      const fewestListings = Math.min(...points.map((point) => point.listings));
      return {
        ...baseOption(theme),
        grid: gridBox({ top: 24, right: 28, bottom: 8 }),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "item",
          formatter: (params: { dataIndex: number }) => {
            const point = points[params.dataIndex];
            return tooltipContent(theme, point.name, [
              { value: formatUsd(point.price), label: "precio mediano" },
              { value: formatInt(point.listings), label: "anuncios" },
              ...(point.rating === null ? [] : [{ value: formatDecimal(point.rating, 2), label: "valoración" }]),
            ]);
          },
        },
        xAxis: {
          type: "log",
          min: Math.max(1, Math.floor(fewestListings * 0.8)),
          name: "Anuncios en el barrio (escala logarítmica)",
          nameLocation: "middle",
          nameGap: 30,
          ...axis,
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => formatInt(value), showMinLabel: false },
        },
        yAxis: {
          type: "value",
          scale: true,
          name: "Precio mediano (USD)",
          nameLocation: "end",
          ...axis,
          // Tras `...axis`: el nombre del eje se alinea a la izquierda, sobre las etiquetas.
          nameTextStyle: { ...axis.nameTextStyle, align: "left" },
          axisLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => formatInt(value) },
        },
        series: [
          {
            type: "scatter",
            data: points.map((point) => ({
              name: point.name,
              value: [point.listings, point.price],
              label: { show: labelled.has(point.name) },
            })),
            symbolSize: 10,
            itemStyle: { color: theme.series[0], opacity: 0.7, borderColor: theme.surface, borderWidth: 1.5 },
            emphasis: { scale: 1.4, itemStyle: { opacity: 1 } },
            label: { formatter: "{b}", position: "top", color: theme.ink2, fontSize: 11 },
            labelLayout: { hideOverlap: true },
          },
        ],
      };
    },
    [points],
  );

  if (points.length < 3) return <p className="text-sm text-muted">No hay suficientes barrios con precio.</p>;
  return <EChart buildOption={buildOption} height={360} label={label} />;
}
