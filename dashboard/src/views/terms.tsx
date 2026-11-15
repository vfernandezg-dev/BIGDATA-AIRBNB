import type { Metadata } from "next";

import { LegalSection } from "@/components/legal";
import type { Locale } from "@/i18n/config";
import { formatters } from "@/i18n/format";
import { termsMessages } from "@/i18n/messages/terms";
import { pageAlternates } from "@/i18n/metadata";
import { SITE } from "@/lib/site";

export function termsMetadata(lang: Locale): Metadata {
  const t = termsMessages[lang];
  return { title: t.metaTitle, description: t.description, alternates: pageAlternates(lang, "terms") };
}

export function TermsView({ lang }: { lang: Locale }) {
  const t = termsMessages[lang];
  const fmt = formatters(lang);

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">{t.intro}</p>
        <p className="mt-2 text-xs text-muted">{t.updated(fmt.date(SITE.legalUpdated))}</p>
      </header>

      {t.sections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          {section.body}
        </LegalSection>
      ))}
    </div>
  );
}
