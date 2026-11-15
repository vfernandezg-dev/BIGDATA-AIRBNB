"use client";

import { useCallback } from "react";

import { formatPercent } from "@/lib/format";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type ShareSeries = {
  name: string;
  /** Posición en la paleta categórica (0 a 3), o `context` para el resto agrupado. */
  color: 0 | 1 | 2 | 3 | "context";
};

export type ShareRow = { label: string; shares: number[] };

type StackedShareChartProps = {
  series: ShareSeries[];
  rows: ShareRow[];
  label: string;
};

const ROW_HEIGHT = 26;
const CHROME_HEIGHT = 44;
const SWATCH: Record<string, string> = {
  "0": "bg-series-1",
  "1": "bg-series-2",
  "2": "bg-series-3",
  "3": "bg-series-4",
  context: "bg-series-context",
};

/**
 * Barras apiladas al 100 %: cómo se reparte cada total entre las mismas categorías, en un eje común.
 * La primera categoría imprime su cuota (siempre cabe); el resto se lee en la leyenda y el detalle.
 */
export function StackedShareChart({ series, rows, label }: StackedShareChartProps) {
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      const colorOf = (color: ShareSeries["color"]) => (color === "context" ? theme.context : theme.series[color]);
      return {
        ...baseOption(theme),
        grid: gridBox({ top: 4 }),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "axis",
          axisPointer: { type: "shadow", shadowStyle: { color: theme.wash } },
          formatter: (params: { dataIndex: number }[]) => {
            const row = rows[params[0].dataIndex];
            return tooltipContent(
              theme,
              row.label,
              series.map((entry, index) => ({
                value: formatPercent(row.shares[index], 1),
                label: entry.name,
                key: colorOf(entry.color),
              })),
            );
          },
        },
        xAxis: {
          type: "value",
          min: 0,
          max: 1,
          ...axis,
          axisLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => formatPercent(value) },
        },
        yAxis: {
          type: "category",
          data: rows.map((row) => row.label),
          inverse: true,
          ...axis,
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, color: theme.ink2, fontSize: 12 },
        },
        series: series.map((entry, index) => ({
          type: "bar",
          name: entry.name,
          stack: "total",
          data: rows.map((row) => row.shares[index]),
          barMaxWidth: 16,
          // El borde del color de la superficie deja un hueco de 2 px entre segmentos contiguos.
          itemStyle: { color: colorOf(entry.color), borderColor: theme.surface, borderWidth: 1 },
          emphasis: { disabled: true },
          label: {
            show: index === 0,
            position: "insideLeft",
            formatter: (params: { value: number }) => formatPercent(params.value),
            color: "#ffffff",
            fontSize: 11,
          },
        })),
      };
    },
    [series, rows],
  );

  return (
    <div>
      {/* La leyenda va en HTML y no dentro del lienzo: así se reparte en varias líneas cuando falta ancho. */}
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {series.map((entry) => (
          <li key={entry.name} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm ${SWATCH[String(entry.color)]}`} />
            {entry.name}
          </li>
        ))}
      </ul>
      <EChart buildOption={buildOption} height={rows.length * ROW_HEIGHT + CHROME_HEIGHT} label={label} />
    </div>
  );
}
