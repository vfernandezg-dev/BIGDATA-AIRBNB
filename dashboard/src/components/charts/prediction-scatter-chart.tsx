"use client";

import { useCallback } from "react";

import { useChartMessages, useFormatters } from "@/i18n/client";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type PredictionPoint = { actual: number; predicted: number; label: string };

/**
 * Precio real frente a precio predicho, en escala logarítmica en ambos ejes (los precios se reparten en
 * varios órdenes de magnitud). Sobre la diagonal, la predicción acierta; lejos de ella, falla.
 */
export function PredictionScatterChart({ points, label }: { points: PredictionPoint[]; label: string }) {
  const fmt = useFormatters();
  const chart = useChartMessages();
  const messages = chart.prediction;
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      const values = points.flatMap((point) => [point.actual, point.predicted]).filter((value) => value > 0);
      const min = Math.max(1, Math.floor(Math.min(...values) * 0.9));
      const max = Math.ceil(Math.max(...values) * 1.1);
      const logAxis = {
        type: "log",
        min,
        max,
        ...axis,
        axisLabel: {
          ...axis.axisLabel,
          formatter: (value: number) => fmt.int(value),
          showMinLabel: false,
          showMaxLabel: false,
        },
        minorSplitLine: { show: true, lineStyle: { color: theme.grid, type: "solid", opacity: 0.6 } },
      };
      return {
        ...baseOption(theme),
        grid: gridBox({ top: 24, right: 24, bottom: 8 }),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "item",
          formatter: (params: { dataIndex: number }) => {
            const point = points[params.dataIndex];
            return tooltipContent(theme, point.label, [
              { value: fmt.usd(point.predicted), label: messages.predicted },
              { value: fmt.usd(point.actual), label: messages.actual },
            ]);
          },
        },
        xAxis: {
          ...logAxis,
          name: messages.xAxis,
          nameLocation: "middle",
          nameGap: 30,
        },
        yAxis: {
          ...logAxis,
          name: messages.yAxis,
          nameLocation: "end",
          nameTextStyle: { ...axis.nameTextStyle, align: "left" },
          axisLine: { show: false },
        },
        series: [
          {
            type: "scatter",
            data: points.map((point) => [point.actual, point.predicted]),
            symbolSize: 6,
            itemStyle: { color: theme.series[0], opacity: 0.35 },
            emphasis: { scale: 2, itemStyle: { opacity: 1, borderColor: theme.surface, borderWidth: 2 } },
            // Diagonal de referencia: predicción igual al precio real.
            markLine: {
              silent: true,
              symbol: "none",
              animation: false,
              label: { show: false },
              lineStyle: { color: theme.muted, type: "solid", width: 1.5 },
              data: [[{ coord: [min, min] }, { coord: [max, max] }]],
            },
          },
        ],
      };
    },
    [points, fmt, messages],
  );

  if (points.length === 0) return <p className="text-sm text-muted">{chart.noData}</p>;
  return <EChart buildOption={buildOption} height={420} label={label} />;
}
