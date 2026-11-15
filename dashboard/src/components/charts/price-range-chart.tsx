"use client";

import { useCallback } from "react";

import { useChartMessages, useFormatters } from "@/i18n/client";

import { axisStyle, baseOption, gridBox, tooltipContent, tooltipStyle, type ChartTheme } from "./chart-theme";
import { EChart } from "./echart";

export type PriceRange = {
  label: string;
  p25: number;
  median: number;
  p75: number;
  /** Posición del tipo de alojamiento en la paleta categórica: el mismo color que en el reparto. */
  color: 0 | 1 | 2 | 3;
};

const ROW_HEIGHT = 40;
const CHROME_HEIGHT = 44;

/**
 * Rango de precios por categoría: una barra del percentil 25 al 75 (la mitad central de los anuncios) y una
 * marca en la mediana. Deja ver de un vistazo cuánto se solapan los precios entre categorías.
 */
export function PriceRangeChart({ ranges, label }: { ranges: PriceRange[]; label: string }) {
  const fmt = useFormatters();
  const messages = useChartMessages().priceRange;
  const buildOption = useCallback(
    (theme: ChartTheme) => {
      const axis = axisStyle(theme);
      return {
        ...baseOption(theme),
        grid: gridBox({ right: 20 }),
        tooltip: {
          ...tooltipStyle(theme),
          trigger: "axis",
          axisPointer: { type: "shadow", shadowStyle: { color: theme.wash } },
          formatter: (params: { dataIndex: number }[]) => {
            const range = ranges[params[0].dataIndex];
            return tooltipContent(theme, range.label, [
              { value: fmt.usd(range.median), label: messages.medianPrice },
              { value: `${fmt.usd(range.p25)} – ${fmt.int(range.p75)}`, label: messages.middleHalf },
            ]);
          },
        },
        xAxis: {
          type: "value",
          ...axis,
          axisLine: { show: false },
          axisLabel: { ...axis.axisLabel, formatter: (value: number) => fmt.int(value) },
        },
        yAxis: {
          type: "category",
          data: ranges.map((range) => range.label),
          inverse: true,
          ...axis,
          splitLine: { show: false },
          axisLabel: { ...axis.axisLabel, color: theme.ink2, fontSize: 12 },
        },
        series: [
          // Base transparente: desplaza la barra visible hasta el percentil 25.
          {
            type: "bar",
            stack: "range",
            silent: true,
            data: ranges.map((range) => range.p25),
            itemStyle: { color: "transparent" },
            emphasis: { disabled: true },
          },
          {
            type: "bar",
            stack: "range",
            barMaxWidth: 16,
            data: ranges.map((range) => ({
              value: range.p75 - range.p25,
              itemStyle: { color: theme.series[range.color], borderRadius: 4 },
            })),
            emphasis: { disabled: true },
          },
          {
            type: "scatter",
            data: ranges.map((range) => [range.median, range.label]),
            symbol: "rect",
            symbolSize: [3, 24],
            itemStyle: { color: theme.ink },
            emphasis: { disabled: true },
            z: 3,
          },
        ],
      };
    },
    [ranges, fmt, messages],
  );

  if (ranges.length === 0) return <p className="text-sm text-muted">{messages.empty}</p>;
  return <EChart buildOption={buildOption} height={ranges.length * ROW_HEIGHT + CHROME_HEIGHT} label={label} />;
}
