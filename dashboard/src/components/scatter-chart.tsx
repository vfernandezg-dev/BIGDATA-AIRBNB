"use client";

import { useMemo, useState, type PointerEvent } from "react";

import { formatInt, formatUsd } from "@/lib/format";

import { ChartTooltip } from "./chart-tooltip";
import { useContainerWidth } from "./use-container-width";

export type ScatterPoint = { actual: number; predicted: number; label: string };

const HEIGHT = 380;
const MARGIN = { top: 12, right: 16, bottom: 44, left: 56 };
const LOG_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
// El puntero no tiene que acertar en un punto de 6 px: basta con estar cerca.
const HIT_RADIUS = 24;

/**
 * Precio real frente a precio predicho, en escala logarítmica en ambos ejes (los precios se reparten en
 * varios órdenes de magnitud). Sobre la diagonal, la predicción acierta; lejos de ella, falla.
 */
export function ScatterChart({ points }: { points: ScatterPoint[] }) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const domain = useMemo(() => {
    const values = points.flatMap((point) => [point.actual, point.predicted]).filter((value) => value > 0);
    if (values.length === 0) return { min: 10, max: 1000 };
    return { min: Math.max(1, Math.min(...values) * 0.9), max: Math.max(...values) * 1.1 };
  }, [points]);

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const logMin = Math.log10(domain.min);
  const logSpan = Math.log10(domain.max) - logMin || 1;
  const x = (value: number) => MARGIN.left + ((Math.log10(value) - logMin) / logSpan) * plotWidth;
  const y = (value: number) => MARGIN.top + plotHeight - ((Math.log10(value) - logMin) / logSpan) * plotHeight;
  const ticks = LOG_TICKS.filter((tick) => tick >= domain.min && tick <= domain.max);

  const positions = useMemo(
    () => points.map((point) => ({ px: x(point.actual), py: y(point.predicted) })),
    // Las escalas dependen solo de estas entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, domain],
  );

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    let nearest: number | null = null;
    let nearestDistance = HIT_RADIUS ** 2;
    positions.forEach((position, index) => {
      const distance = (position.px - pointerX) ** 2 + (position.py - pointerY) ** 2;
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    setActive(nearest);
  };

  const activePoint = active === null ? null : points[active];

  return (
    <div
      ref={ref}
      className="relative"
      style={{ height: HEIGHT }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
    >
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Dispersión del precio predicho frente al precio real de una muestra de anuncios de prueba"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
            <line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--grid)" />
            <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
              {formatInt(tick)}
            </text>
            <text x={x(tick)} y={MARGIN.top + plotHeight + 16} textAnchor="middle" className="tabular fill-muted text-[11px]">
              {formatInt(tick)}
            </text>
          </g>
        ))}
        {/* Diagonal de referencia: predicción igual al precio real. */}
        <line
          x1={x(domain.min)}
          y1={y(domain.min)}
          x2={x(domain.max)}
          y2={y(domain.max)}
          stroke="var(--axis)"
          strokeWidth={1.5}
        />
        {positions.map((position, index) => (
          <circle key={index} cx={position.px} cy={position.py} r={3} fill="var(--series-1)" opacity={0.35} />
        ))}
        {active !== null ? (
          <circle
            cx={positions[active].px}
            cy={positions[active].py}
            r={5}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ) : null}
        <text x={MARGIN.left + plotWidth / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-ink-2 text-[12px]">
          Precio real por noche (USD, escala logarítmica)
        </text>
        <text
          transform={`translate(14, ${MARGIN.top + plotHeight / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-ink-2 text-[12px]"
        >
          Precio predicho (USD)
        </text>
      </svg>
      {activePoint && active !== null ? (
        <ChartTooltip
          x={positions[active].px}
          y={positions[active].py}
          containerWidth={width}
          title={activePoint.label}
        >
          {formatUsd(activePoint.predicted)}{" "}
          <span className="font-normal text-ink-2">predicho · {formatUsd(activePoint.actual)} real</span>
        </ChartTooltip>
      ) : null}
    </div>
  );
}
