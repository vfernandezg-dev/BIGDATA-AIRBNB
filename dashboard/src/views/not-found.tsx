import Link from "next/link";

import type { Locale } from "@/i18n/config";
import { commonMessages } from "@/i18n/messages/common";
import { pathFor } from "@/i18n/routes";

export function NotFoundView({ lang }: { lang: Locale }) {
  const t = commonMessages[lang].notFound;
  return (
    <div className="max-w-xl py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title}</h1>
      <p className="mt-3 leading-relaxed text-ink-2">{t.text}</p>
      <Link
        href={pathFor(lang, "home")}
        className="mt-6 inline-block rounded text-sm font-medium text-ink underline underline-offset-4"
      >
        {t.back}
      </Link>
    </div>
  );
}
