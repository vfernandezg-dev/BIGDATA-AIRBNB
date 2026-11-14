/** Marcas "redondas" para un eje que empieza en cero: 0, 500, 1000... */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const rawStep = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + step * 0.999; tick += step) {
    ticks.push(Number(tick.toPrecision(12)));
  }
  return ticks;
}

export function linearScale(domainMax: number, rangeStart: number, rangeEnd: number) {
  const span = domainMax <= 0 ? 1 : domainMax;
  return (value: number) => rangeStart + (value / span) * (rangeEnd - rangeStart);
}

/** Cuantiles de una lista de números (posiciones entre 0 y 1). */
export function quantiles(values: number[], positions: number[]): number[] {
  if (values.length === 0) return positions.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return positions.map((position) => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(position * sorted.length)));
    return sorted[index];
  });
}
