import type { Locale } from "@/i18n/config";
import { formatters } from "@/i18n/format";
import { commonMessages } from "@/i18n/messages/common";

export type Segment = {
  key: string;
  label: string;
  value: number;
  /** Color de la serie: va con la entidad (el tipo de alojamiento), no con su posición. */
  color: "series-1" | "series-2" | "series-3" | "series-4";
};

const FILL: Record<Segment["color"], string> = {
  "series-1": "bg-series-1",
  "series-2": "bg-series-2",
  "series-3": "bg-series-3",
  "series-4": "bg-series-4",
};
// Dentro de un relleno el texto es blanco, salvo sobre el amarillo, donde solo el negro es legible.
const INK: Record<Segment["color"], string> = {
  "series-1": "text-white",
  "series-2": "text-white",
  "series-3": "text-white",
  "series-4": "text-[#0b0b0b]",
};
// Por debajo de esta cuota el porcentaje no cabe dentro del bloque y se muestra en la leyenda.
const MIN_SHARE_FOR_INLINE_LABEL = 0.09;

/**
 * Barra segmentada alta: un total repartido en pocas partes, para leerlo de un vistazo.
 * Cada bloque lleva su cuota donde cabe; la leyenda nombra las partes en el mismo orden.
 */
export function SegmentedBar({ lang, segments, unit }: { lang: Locale; segments: Segment[]; unit: string }) {
  const fmt = formatters(lang);
  const messages = commonMessages[lang];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  if (total <= 0) return <p className="text-sm text-muted">{messages.noData}</p>;

  const summary = visible
    .map((segment) => `${segment.label}: ${fmt.percent(segment.value / total, 1)}`)
    .join("; ");

  return (
    <div>
      <div role="img" aria-label={`${messages.breakdownByType} ${summary}`} className="flex h-7 w-full gap-[2px]">
        {visible.map((segment) => {
          const share = segment.value / total;
          return (
            <div
              key={segment.key}
              title={`${segment.label}: ${fmt.int(segment.value)} ${unit} (${fmt.percent(share, 1)})`}
              className={`flex min-w-[3px] items-center rounded-[4px] ${FILL[segment.color]}`}
              style={{ flexGrow: segment.value, flexBasis: 0 }}
            >
              {share >= MIN_SHARE_FOR_INLINE_LABEL ? (
                <span className={`px-2 text-xs font-medium ${INK[segment.color]}`}>{fmt.percent(share)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {visible.map((segment) => {
          const share = segment.value / total;
          return (
            <li key={segment.key} className="flex items-center gap-1.5">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm ${FILL[segment.color]}`} />
              {segment.label}
              {share < MIN_SHARE_FOR_INLINE_LABEL ? (
                <span className="tabular text-muted">{fmt.percent(share, 1)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
