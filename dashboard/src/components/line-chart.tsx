"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { formatCompact, formatInt, formatMonth } from "@/lib/format";
import { linearScale, niceTicks } from "@/lib/scale";

import { ChartTooltip } from "./chart-tooltip";
import { useContainerWidth } from "./use-container-width";

export type MonthlyPoint = { month: string; value: number };

type LineChartProps = {
  data: MonthlyPoint[];
  /** Qué mide la serie: se usa en el detalle y en la descripción accesible. */
  valueLabel: string;
};

const HEIGHT = 260;
const MARGIN = { top: 16, right: 16, bottom: 30, left: 48 };
const MIN_YEAR_SPACING = 56;

/**
 * Serie temporal mensual: una línea con un relleno tenue y una guía vertical que sigue al puntero.
 * El lector apunta a una fecha, no a una línea de 2 px; con el teclado se recorre con las flechas.
 */
export function LineChart({ data, valueLabel }: LineChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  if (data.length < 2) return <p className="text-sm text-muted">No hay suficientes datos para una serie.</p>;

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const baseline = MARGIN.top + plotHeight;
  const ticks = niceTicks(Math.max(...data.map((point) => point.value)));
  const y = linearScale(ticks[ticks.length - 1], baseline, MARGIN.top);
  const x = (index: number) => MARGIN.left + (index / (data.length - 1)) * plotWidth;

  const line = data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${baseline} L${x(0)},${baseline} Z`;

  // Una marca por año (en enero), saltando años si no caben.
  const januaries = data
    .map((point, index) => ({ index, year: point.month.slice(0, 4), isJanuary: point.month.slice(5, 7) === "01" }))
    .filter((entry) => entry.isJanuary);
  const pixelsPerYear = januaries.length > 1 ? plotWidth / (januaries.length - 1) : plotWidth;
  const yearEvery = Math.max(1, Math.ceil(MIN_YEAR_SPACING / pixelsPerYear));
  const yearTicks = januaries.filter((_, position) => (januaries.length - 1 - position) % yearEvery === 0);

  const nearestIndex = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - MARGIN.left) / plotWidth;
    return Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = active ?? data.length - 1;
    const next = current + (event.key === "ArrowRight" ? 1 : -1);
    setActive(Math.max(0, Math.min(data.length - 1, next)));
  };

  const last = data[data.length - 1];
  const activePoint = active === null ? null : data[active];

  return (
    <div
      ref={ref}
      className="relative touch-pan-y"
      style={{ height: HEIGHT }}
      tabIndex={0}
      role="group"
      aria-label={`${valueLabel} por mes. Usa las flechas izquierda y derecha para recorrer los meses.`}
      onPointerMove={(event) => setActive(nearestIndex(event))}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((current) => current ?? data.length - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      <svg width={width} height={HEIGHT} aria-hidden>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
            <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
              {formatCompact(tick)}
            </text>
          </g>
        ))}
        {yearTicks.map((tick) => (
          <text key={tick.year} x={x(tick.index)} y={HEIGHT - 10} textAnchor="middle" className="tabular fill-muted text-[11px]">
            {tick.year}
          </text>
        ))}
        <path d={area} fill="var(--series-1)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={MARGIN.left} x2={width - MARGIN.right} y1={baseline} y2={baseline} stroke="var(--axis)" />
        {active === null ? (
          <circle cx={x(data.length - 1)} cy={y(last.value)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
        ) : (
          <g>
            <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={baseline} stroke="var(--axis)" />
            <circle cx={x(active)} cy={y(data[active].value)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {activePoint && active !== null ? (
        <ChartTooltip x={x(active)} y={y(activePoint.value)} containerWidth={width} title={formatMonth(activePoint.month)}>
          {formatInt(activePoint.value)} <span className="font-normal text-ink-2">{valueLabel}</span>
        </ChartTooltip>
      ) : null}
    </div>
  );
}
