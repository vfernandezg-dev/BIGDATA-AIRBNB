import type { ReactNode } from "react";

import type { Locale } from "@/i18n/config";
import { commonMessages } from "@/i18n/messages/common";

type ChartCardProps = {
  lang: Locale;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Los mismos datos del gráfico en una tabla: la alternativa accesible y la forma de leer cifras exactas. */
  table?: ReactNode;
  footnote?: ReactNode;
};

export function ChartCard({ lang, title, subtitle, children, table, footnote }: ChartCardProps) {
  return (
    <figure className="flex min-w-0 flex-col rounded-lg border border-hairline bg-surface p-5">
      <figcaption>
        <h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm leading-relaxed text-ink-2">{subtitle}</p> : null}
      </figcaption>
      <div className="mt-4 min-w-0">{children}</div>
      {footnote ? <p className="mt-3 text-xs leading-relaxed text-muted">{footnote}</p> : null}
      {table ? (
        <details className="mt-4 border-t border-hairline pt-3">
          <summary className="w-fit cursor-pointer rounded text-xs font-medium text-ink-2 hover:text-ink">
            {commonMessages[lang].chartCard.viewTable}
          </summary>
          <div className="mt-3 max-h-80 overflow-auto">{table}</div>
        </details>
      ) : null}
    </figure>
  );
}
