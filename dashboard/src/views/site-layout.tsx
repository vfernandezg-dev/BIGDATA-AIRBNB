import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { LanguageLinks, LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider } from "@/i18n/client";
import { LOCALES, type Locale } from "@/i18n/config";
import { formatters } from "@/i18n/format";
import { commonMessages } from "@/i18n/messages/common";
import { pathFor } from "@/i18n/routes";
import { getPublication } from "@/lib/queries";
import { SITE, SOURCE, SOURCE_LICENSE } from "@/lib/site";

import "@/app/globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function siteMetadata(lang: Locale): Metadata {
  const messages = commonMessages[lang];
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: messages.site.title, template: `%s · ${SITE.name}` },
    description: messages.site.description,
    openGraph: {
      type: "website",
      locale: lang,
      alternateLocale: LOCALES.filter((locale) => locale !== lang),
      siteName: SITE.name,
    },
  };
}

/**
 * Estructura común de todas las páginas de un idioma: cabecera, contenido y pie. Es el layout raíz de cada
 * árbol de rutas (`app/es/layout.tsx`, `app/en/layout.tsx`), que solo le pasa su idioma.
 */
export async function SiteLayout({ lang, children }: { lang: Locale; children: ReactNode }) {
  const publication = await getPublication();
  const messages = commonMessages[lang];
  const fmt = formatters(lang);
  const license = SOURCE_LICENSE[lang];
  const homePaths = Object.fromEntries(LOCALES.map((locale) => [locale, pathFor(locale, "home")])) as Record<
    Locale,
    string
  >;
  const navigation = [
    { href: pathFor(lang, "home"), label: messages.nav.home },
    { href: pathFor(lang, "model"), label: messages.nav.model },
    { href: pathFor(lang, "methodology"), label: messages.nav.methodology },
  ];

  return (
    <html lang={lang}>
      <body className="flex min-h-dvh flex-col antialiased">
        <LocaleProvider lang={lang}>
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
          >
            {messages.skipToContent}
          </a>
          <header className="border-b border-hairline bg-surface">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-4">
              <Link href={pathFor(lang, "home")} className="rounded text-base font-semibold tracking-tight text-ink">
                {SITE.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <nav aria-label={messages.nav.label}>
                  <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
                    {navigation.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="rounded underline-offset-4 hover:text-ink hover:underline">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
                {/* La dirección de una ciudad aún no publicada solo se conoce al recibir la petición: hasta
                    entonces el selector lleva a la portada del otro idioma. */}
                <Suspense fallback={<LanguageLinks lang={lang} label={messages.languageLabel} paths={homePaths} />}>
                  <LanguageSwitcher lang={lang} label={messages.languageLabel} />
                </Suspense>
              </div>
            </div>
          </header>

          <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
            {children}
          </main>

          <footer className="border-t border-hairline bg-surface">
            <div className="mx-auto w-full max-w-6xl space-y-3 px-5 py-6 text-xs leading-relaxed text-ink-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                <p className="text-sm text-ink">
                  {messages.footer.developedBy}{" "}
                  <a
                    href={SITE.author.url}
                    rel="noreferrer"
                    className="font-semibold underline underline-offset-2 hover:text-ink-2"
                  >
                    {SITE.author.name}
                  </a>
                </p>
                <nav aria-label={messages.footer.legalLabel}>
                  <ul className="flex flex-wrap gap-x-5 gap-y-1">
                    <li>
                      <Link
                        href={pathFor(lang, "licenses")}
                        className="underline-offset-4 hover:text-ink hover:underline"
                      >
                        {messages.footer.licenses}
                      </Link>
                    </li>
                    <li>
                      <Link href={pathFor(lang, "terms")} className="underline-offset-4 hover:text-ink hover:underline">
                        {messages.footer.terms}
                      </Link>
                    </li>
                    <li>
                      <a
                        href={SITE.repository}
                        rel="noreferrer"
                        className="underline-offset-4 hover:text-ink hover:underline"
                      >
                        {messages.footer.code}
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
              <p>
                {messages.footer.dataFrom}{" "}
                <a href={SOURCE.url} className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
                  {SOURCE.name}
                </a>{" "}
                (
                <a href={license.url} className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
                  CC BY 4.0
                </a>
                ){messages.footer.dataNote(SOURCE.name)}
              </p>
              {publication ? (
                <p className="text-muted">
                  {messages.footer.published(fmt.date(publication.published_at), fmt.date(publication.fx_as_of))}
                </p>
              ) : null}
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
