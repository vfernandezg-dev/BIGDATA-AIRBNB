"use client";

import { useState } from "react";

import { formatCompact, formatInt, formatPercent } from "@/lib/format";
import { linearScale, niceTicks } from "@/lib/scale";

import { ChartTooltip } from "./chart-tooltip";
import { useContainerWidth } from "./use-container-width";

export type ColumnDatum = {
  key: string;
  /** Etiqueta corta del eje horizontal. */
  tick: string;
  /** Descripción completa de la categoría, para el detalle. */
  label: string;
  value: number;
};

type ColumnChartProps = {
  data: ColumnDatum[];
  valueFormat: "int" | "percent";
  /** Qué mide el eje vertical, para el detalle y los lectores de pantalla. */
  valueLabel: string;
  /** En un eje de porcentajes, el máximo natural es el 100 %. */
  fixedMax?: number;
};

const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 30, left: 44 };
const MAX_COLUMN_WIDTH = 24;
const COLUMN_GAP = 2;
const MIN_TICK_SPACING = 46;

function formatValue(value: number, format: ColumnChartProps["valueFormat"], compactAxis = false): string {
  if (format === "percent") return formatPercent(value);
  return compactAxis ? formatCompact(value) : formatInt(value);
}

/** Columna con el extremo de datos redondeado (4 px) y la base recta, apoyada en el eje. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

export function ColumnChart({ data, valueFormat, valueLabel, fixedMax }: ColumnChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const ticks = niceTicks(fixedMax ?? Math.max(...data.map((datum) => datum.value), 0));
  const yMax = fixedMax ?? ticks[ticks.length - 1];
  const y = linearScale(yMax, MARGIN.top + plotHeight, MARGIN.top);

  const band = data.length > 0 ? plotWidth / data.length : 0;
  const columnWidth = Math.max(1, Math.min(MAX_COLUMN_WIDTH, band - COLUMN_GAP));
  const tickEvery = Math.max(1, Math.ceil(MIN_TICK_SPACING / Math.max(band, 1)));
  const columnX = (index: number) => MARGIN.left + index * band + (band - columnWidth) / 2;
  const activeDatum = active === null ? null : data[active];

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }} onPointerLeave={() => setActive(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`${valueLabel} por categoría`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="tabular fill-muted text-[11px]"
            >
              {formatValue(tick, valueFormat, true)}
            </text>
          </g>
        ))}
        {data.map((datum, index) => {
          const top = y(datum.value);
          const height = Math.max(0, MARGIN.top + plotHeight - top);
          return (
            <g key={datum.key}>
              <path
                d={columnPath(columnX(index), top, columnWidth, height)}
                fill="var(--series-1)"
                opacity={active === null || active === index ? 1 : 0.55}
              />
              {/* El área sensible ocupa toda la franja: no hace falta acertar en una columna fina. */}
              <rect
                x={MARGIN.left + index * band}
                y={MARGIN.top}
                width={band}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${datum.label}: ${formatValue(datum.value, valueFormat)}`}
                onPointerEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                style={{ outline: "none" }}
              />
              {index % tickEvery === 0 ? (
                <text
                  x={MARGIN.left + index * band + band / 2}
                  y={HEIGHT - 10}
                  textAnchor="middle"
                  className="tabular fill-muted text-[11px]"
                >
                  {datum.tick}
                </text>
              ) : null}
            </g>
          );
        })}
        <line
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={MARGIN.top + plotHeight}
          y2={MARGIN.top + plotHeight}
          stroke="var(--axis)"
        />
      </svg>
      {activeDatum && active !== null ? (
        <ChartTooltip
          x={columnX(active) + columnWidth / 2}
          y={y(activeDatum.value)}
          containerWidth={width}
          title={activeDatum.label}
        >
          {formatValue(activeDatum.value, valueFormat)}{" "}
          <span className="font-normal text-ink-2">{valueLabel}</span>
        </ChartTooltip>
      ) : null}
    </div>
  );
}
