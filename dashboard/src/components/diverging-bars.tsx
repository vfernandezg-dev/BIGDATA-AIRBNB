export type DivergingRow = {
  key: string;
  label: string;
  /** Desviación respecto al punto neutro: negativa a la izquierda, positiva a la derecha. */
  deviation: number;
  display: string;
};

type DivergingBarsProps = {
  rows: DivergingRow[];
  lowLabel: string;
  highLabel: string;
};

/**
 * Barras divergentes: valores por encima y por debajo de un punto neutro.
 * Dos tonos opuestos (frío y cálido) y un eje central; el signo también se lee en la cifra.
 */
export function DivergingBars({ rows, lowLabel, highLabel }: DivergingBarsProps) {
  const maxDeviation = Math.max(...rows.map((row) => Math.abs(row.deviation)), 0);
  if (rows.length === 0 || maxDeviation === 0) return <p className="text-sm text-muted">Sin datos.</p>;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-diverging-low" />
          {lowLabel}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-diverging-high" />
          {highLabel}
        </li>
      </ul>
      <ul className="grid grid-cols-[minmax(6rem,11rem)_1fr_3.5rem] items-center gap-x-3 gap-y-2 text-sm">
        {rows.map((row) => {
          const width = `${(Math.abs(row.deviation) / maxDeviation) * 50}%`;
          const isHigh = row.deviation >= 0;
          return (
            <li key={row.key} className="contents">
              <span className="truncate text-ink-2" title={row.label}>
                {row.label}
              </span>
              <span aria-hidden className="relative h-3.5">
                <span className="absolute inset-y-[-3px] left-1/2 w-px bg-axis" />
                <span
                  className={`absolute inset-y-0 ${
                    isHigh
                      ? "left-1/2 rounded-r-[4px] bg-diverging-high"
                      : "right-1/2 rounded-l-[4px] bg-diverging-low"
                  }`}
                  style={{ width }}
                />
              </span>
              <span className="tabular text-right text-ink">{row.display}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
