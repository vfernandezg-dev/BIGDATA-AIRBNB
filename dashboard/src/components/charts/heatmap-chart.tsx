"use client";

import { useCallback } from "react";

import { formatInt, formatSignedPercent } from "@/lib/format";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

/** [columna, fila, valor]. Las celdas sin dato simplemente no se incluyen y quedan en blanco. */
export type HeatmapCell = [column: number, row: number, value: number];

type HeatmapChartProps = {
  rows: string[];
  columns: string[];
  cells: HeatmapCell[];
  /**
   * `sequential`: magnitud desde cero, un solo tono de claro a oscuro.
   * `diverging`: desviación respecto a un valor normal (el cero), con dos tonos opuestos y un medio neutro.
   */
  scale: "sequential" | "diverging";
  valueLabel: string;
  /** Textos de los extremos de la escala: [mínimo, máximo]. */
  scaleLabels: [string, string];
  label: string;
};

const ROW_HEIGHT = 26;
const CHROME_HEIGHT = 86;

/**
 * Mapa de calor en rejilla, con su escala al pie.
 * Las celdas se separan con un hueco del color de la superficie, no con un borde dibujado.
 */
export function HeatmapChart({ rows, columns, cells, scale, valueLabel, scaleLabels, label }: HeatmapChartProps) {
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      const values = cells.map((cell) => cell[2]);
      const format = scale === "diverging" ? formatSignedPercent : formatInt;
      // En el divergente la escala es simétrica: el tono neutro cae exactamente en el cero.
      const extreme = Math.max(...values.map(Math.abs), 0);
      const range =
        scale === "diverging"
          ? { min: -extreme, max: extreme, color: [theme.divergingLow, theme.divergingMid, theme.divergingHigh] }
          : { min: 0, max: Math.max(...values, 0), color: theme.sequential };
      return {
        ...baseOption(theme),
        grid: gridBox({ top: 4, bottom: 46 }),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "item",
          formatter: (params: { value: HeatmapCell }) => {
            const [column, row, value] = params.value;
            return tooltipContent(theme, `${rows[row]} · ${columns[column]}`, [
              { value: format(value), label: valueLabel },
            ]);
          },
        },
        xAxis: {
          type: "category",
          data: columns,
          position: "top",
          ...axis,
          axisLine: { show: false },
          splitLine: { show: false },
        },
        yAxis: {
          type: "category",
          data: rows,
          inverse: true,
          ...axis,
          axisLine: { show: false },
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, color: theme.ink2, fontSize: 12 },
        },
        visualMap: {
          type: "continuous",
          dimension: 2,
          min: range.min,
          max: range.max,
          calculable: false,
          hoverLink: false,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          itemWidth: 10,
          itemHeight: 150,
          text: [scaleLabels[1], scaleLabels[0]],
          textStyle: { color: theme.muted, fontSize: 11 },
          inRange: { color: range.color },
        },
        series: [
          {
            type: "heatmap",
            data: cells,
            itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 3 },
            emphasis: { itemStyle: { borderColor: theme.ink, borderWidth: 1.5 } },
          },
        ],
      };
    },
    [rows, columns, cells, scale, valueLabel, scaleLabels],
  );

  if (cells.length === 0) return <p className="text-sm text-muted">Sin datos.</p>;
  return <EChart buildOption={buildOption} height={rows.length * ROW_HEIGHT + CHROME_HEIGHT} label={label} />;
}
