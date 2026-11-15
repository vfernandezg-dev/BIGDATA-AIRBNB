"use client";

import { useCallback } from "react";

import { formatCompact, formatInt, formatPercent } from "@/lib/format";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type ColumnDatum = {
  /** Etiqueta corta del eje horizontal. */
  tick: string;
  /** Descripción completa de la categoría, para el detalle. */
  label: string;
  value: number;
};

type ColumnChartProps = {
  data: ColumnDatum[];
  valueFormat: "int" | "percent";
  valueLabel: string;
  /** En un eje de porcentajes, el máximo natural es el 100 %. */
  fixedMax?: number;
  label: string;
};

/** Columnas de un solo color: finas, con el extremo redondeado y apoyadas en el eje. */
export function ColumnChart({ data, valueFormat, valueLabel, fixedMax, label }: ColumnChartProps) {
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      const format = (value: number, compact = false) =>
        valueFormat === "percent" ? formatPercent(value) : compact ? formatCompact(value) : formatInt(value);
      return {
        ...baseOption(theme),
        grid: gridBox(),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "axis",
          // Se resalta la franja entera: no hace falta acertar en una columna fina.
          axisPointer: { type: "shadow", shadowStyle: { color: theme.wash } },
          formatter: (params: { dataIndex: number }[]) => {
            const datum = data[params[0].dataIndex];
            return tooltipContent(theme, datum.label, [{ value: format(datum.value), label: valueLabel }]);
          },
        },
        xAxis: {
          type: "category",
          data: data.map((datum) => datum.tick),
          ...axis,
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, hideOverlap: true },
        },
        yAxis: {
          type: "value",
          max: fixedMax,
          ...axis,
          axisLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => format(value, true) },
        },
        series: [
          {
            type: "bar",
            data: data.map((datum) => datum.value),
            barMaxWidth: 24,
            barCategoryGap: "18%",
            itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
          },
        ],
      };
    },
    [data, valueFormat, valueLabel, fixedMax],
  );

  return <EChart buildOption={buildOption} height={260} label={label} />;
}
