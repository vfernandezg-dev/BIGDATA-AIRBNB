"use client";

import { useCallback } from "react";

import { useChartMessages, useFormatters } from "@/i18n/client";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type BiasBucket = {
  /** Tramo de precio real que cubre el grupo. */
  label: string;
  /** Mediana de precio predicho / precio real: 1 es un acierto. */
  ratio: number;
  count: number;
};

/**
 * Sesgo del modelo por tramo de precio: barras que parten del 1 (predicción igual al precio real).
 * Hacia arriba, en tono cálido, el modelo predice de más; hacia abajo, en tono frío, de menos.
 */
export function BiasChart({ buckets, label }: { buckets: BiasBucket[]; label: string }) {
  const fmt = useFormatters();
  const chart = useChartMessages();
  const messages = chart.bias;
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      return {
        ...baseOption(theme),
        grid: gridBox(),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "axis",
          axisPointer: { type: "shadow", shadowStyle: { color: theme.wash } },
          formatter: (params: { dataIndex: number }[]) => {
            const bucket = buckets[params[0].dataIndex];
            return tooltipContent(theme, messages.title(bucket.label), [
              { value: fmt.decimal(bucket.ratio, 2), label: bucket.ratio >= 1 ? messages.over : messages.under },
              { value: fmt.int(bucket.count), label: messages.count },
            ]);
          },
        },
        xAxis: {
          type: "category",
          data: buckets.map((bucket) => bucket.label),
          ...axis,
          // El eje se queda abajo: en el cero taparía las barras negativas con sus etiquetas.
          axisLine: { onZero: false, lineStyle: { color: theme.axis } },
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, hideOverlap: true },
        },
        yAxis: {
          type: "value",
          ...axis,
          axisLine: { show: false },
          // Los valores se dibujan como desviación respecto a 1; el eje muestra la razón real.
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => fmt.decimal(value + 1, 2) },
        },
        series: [
          {
            type: "bar",
            barMaxWidth: 24,
            data: buckets.map((bucket) => ({
              value: bucket.ratio - 1,
              itemStyle: {
                color: bucket.ratio >= 1 ? theme.divergingHigh : theme.divergingLow,
                borderRadius: bucket.ratio >= 1 ? [4, 4, 0, 0] : [0, 0, 4, 4],
              },
            })),
            markLine: {
              silent: true,
              symbol: "none",
              animation: false,
              label: { show: false },
              lineStyle: { color: theme.axis, type: "solid", width: 1 },
              data: [{ yAxis: 0 }],
            },
          },
        ],
      };
    },
    [buckets, fmt, messages],
  );

  if (buckets.length === 0) return <p className="text-sm text-muted">{chart.noData}</p>;
  return <EChart buildOption={buildOption} height={300} label={label} />;
}
