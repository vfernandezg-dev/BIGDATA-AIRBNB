/** Cuantiles de una lista de números (posiciones entre 0 y 1). */
export function quantiles(values: number[], positions: number[]): number[] {
  if (values.length === 0) return positions.map(() => 0);
  const sorted = [...values].sort((a, b) => a - b);
  return positions.map((position) => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(position * sorted.length)));
    return sorted[index];
  });
}
