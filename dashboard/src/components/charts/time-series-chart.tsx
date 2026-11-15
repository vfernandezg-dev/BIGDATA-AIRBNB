"use client";

import { useCallback } from "react";

import { useChartMessages, useFormatters } from "@/i18n/client";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type MonthlyPoint = { month: string; value: number };

type TimeSeriesChartProps = {
  data: MonthlyPoint[];
  /** Qué mide la serie («reseñas»): acompaña a la cifra en el detalle. */
  valueLabel: string;
  label: string;
};

/** Serie mensual: una línea con relleno tenue y una guía vertical que sigue al puntero. */
export function TimeSeriesChart({ data, valueLabel, label }: TimeSeriesChartProps) {
  const fmt = useFormatters();
  const messages = useChartMessages();
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      return {
        ...baseOption(theme),
        grid: gridBox(),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "axis",
          axisPointer: { type: "line", lineStyle: { color: theme.axis, type: "solid", width: 1 } },
          formatter: (params: { dataIndex: number }[]) => {
            const point = data[params[0].dataIndex];
            return tooltipContent(theme, fmt.month(point.month), [
              { value: fmt.int(point.value), label: valueLabel },
            ]);
          },
        },
        xAxis: {
          type: "category",
          data: data.map((point) => point.month),
          boundaryGap: false,
          ...axis,
          splitLine: { show: false },
          axisLabel: {
            ...axis.axisLabel,
            // Una etiqueta por año, en enero; si no caben todas, ECharts oculta las que se pisan.
            interval: (_index: number, value: string) => value.slice(5, 7) === "01",
            formatter: (value: string) => value.slice(0, 4),
            hideOverlap: true,
          },
        },
        yAxis: {
          type: "value",
          ...axis,
          axisLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => fmt.compact(value) },
        },
        series: [
          {
            type: "line",
            data: data.map((point) => point.value),
            showSymbol: false,
            symbol: "circle",
            symbolSize: 8,
            lineStyle: { width: 2, color: theme.series[0] },
            itemStyle: { color: theme.series[0], borderColor: theme.surface, borderWidth: 2 },
            areaStyle: { color: theme.series[0], opacity: 0.1 },
          },
        ],
      };
    },
    [data, valueLabel, fmt],
  );

  if (data.length < 2) return <p className="text-sm text-muted">{messages.timeSeries.notEnough}</p>;
  return <EChart buildOption={buildOption} height={280} label={label} />;
}
