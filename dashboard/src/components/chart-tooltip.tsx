import type { ReactNode } from "react";

type ChartTooltipProps = {
  /** Posición del punto señalado, en píxeles dentro del contenedor del gráfico. */
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  children: ReactNode;
};

const TOOLTIP_WIDTH = 184;

/** Globo de detalle: la cifra manda y la etiqueta acompaña. Nunca es la única forma de leer un valor. */
export function ChartTooltip({ x, y, containerWidth, title, children }: ChartTooltipProps) {
  const left = Math.max(0, Math.min(containerWidth - TOOLTIP_WIDTH, x - TOOLTIP_WIDTH / 2));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 rounded-md border border-hairline bg-surface px-3 py-2 text-xs shadow-md"
      style={{ left, top: Math.max(0, y - 58), width: TOOLTIP_WIDTH }}
    >
      <p className="text-ink-2">{title}</p>
      <div className="tabular mt-0.5 text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}
