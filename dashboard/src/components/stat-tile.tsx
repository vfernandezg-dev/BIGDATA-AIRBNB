import type { ReactNode } from "react";

type StatTileProps = {
  label: string;
  value: string;
  hint?: ReactNode;
  /** La cifra principal de la página: solo una por vista. */
  hero?: boolean;
};

export function StatTile({ label, value, hint, hero = false }: StatTileProps) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-5">
      <p className="text-sm text-ink-2">{label}</p>
      <p className={`mt-1 font-semibold tracking-tight text-ink ${hero ? "text-5xl" : "text-3xl"}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}
