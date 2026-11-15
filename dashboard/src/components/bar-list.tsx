import Link from "next/link";

export type BarRow = {
  key: string;
  label: string;
  value: number | null;
  /** La cifra ya formateada que se muestra en la punta de la barra. */
  display: string;
  href?: string;
  /** Segunda barra, de contexto (por ejemplo, la referencia frente a la que se compara). */
  context?: { value: number | null; display: string };
};

type BarListProps = {
  rows: BarRow[];
  /** Valor que ocupa todo el ancho. Por defecto, el máximo de las filas. */
  max?: number;
  legend?: { main: string; context: string };
};

// Espacio reservado a la derecha de la barra más larga para su cifra.
const VALUE_GUTTER = "5.5rem";

function barWidth(value: number | null, max: number): string {
  if (value === null || max <= 0) return "0px";
  const fraction = Math.max(0, Math.min(1, value / max));
  return `calc((100% - ${VALUE_GUTTER}) * ${fraction})`;
}

/**
 * Barras horizontales ordenadas: la forma para comparar magnitudes entre categorías con nombre.
 * Un solo color para todas (el largo ya codifica el valor) y la cifra en la punta de cada barra.
 */
export function BarList({ rows, max, legend }: BarListProps) {
  const values = rows.flatMap((row) => [row.value ?? 0, row.context?.value ?? 0]);
  const scaleMax = max ?? Math.max(...values, 0);

  return (
    <div>
      {legend ? (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-series-1" />
            {legend.main}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-series-context" />
            {legend.context}
          </li>
        </ul>
      ) : null}
      <ul className="grid grid-cols-[minmax(6rem,11rem)_1fr] items-center gap-x-3 gap-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="contents">
            <span className="truncate text-ink-2" title={row.label}>
              {row.href ? (
                <Link href={row.href} className="rounded underline-offset-2 hover:text-ink hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3.5 shrink-0 rounded-r-[4px] bg-series-1"
                  style={{ width: barWidth(row.value, scaleMax) }}
                />
                <span className="tabular whitespace-nowrap text-ink">{row.display}</span>
              </span>
              {row.context ? (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 shrink-0 rounded-r-[3px] bg-series-context"
                    style={{ width: barWidth(row.context.value, scaleMax) }}
                  />
                  <span className="tabular whitespace-nowrap text-xs text-muted">{row.context.display}</span>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
