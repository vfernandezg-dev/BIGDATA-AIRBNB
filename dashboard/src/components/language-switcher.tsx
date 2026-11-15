"use client";

import { usePathname } from "next/navigation";

import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/routes";

type LanguageLinksProps = {
  lang: Locale;
  /** Nombre del grupo para lectores de pantalla («Idioma»). */
  label: string;
  /** Dirección a la que lleva cada idioma. */
  paths: Record<Locale, string>;
};

/**
 * Selector de idioma. Cada idioma tiene su propio árbol de rutas, así que cambiar de idioma es una
 * navegación normal a otra dirección (un enlace, no un botón): funciona sin JavaScript y no guarda nada.
 */
export function LanguageLinks({ lang, label, paths }: LanguageLinksProps) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex rounded-md border border-hairline p-0.5 text-xs font-medium">
        {LOCALES.map((locale) => {
          const code = <span aria-hidden>{locale.toUpperCase()}</span>;
          const name = <span className="sr-only">{LOCALE_NAMES[locale]}</span>;
          return (
            <li key={locale}>
              {locale === lang ? (
                <span aria-current="true" lang={locale} className="block rounded bg-ink px-2 py-0.5 text-surface">
                  {code}
                  {name}
                </span>
              ) : (
                <a
                  href={paths[locale]}
                  hrefLang={locale}
                  lang={locale}
                  title={LOCALE_NAMES[locale]}
                  className="block rounded px-2 py-0.5 text-ink-2 hover:text-ink"
                >
                  {code}
                  {name}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** El selector, apuntando a la misma página en el otro idioma. */
export function LanguageSwitcher({ lang, label }: Pick<LanguageLinksProps, "lang" | "label">) {
  const pathname = usePathname();
  const paths = Object.fromEntries(
    LOCALES.map((locale) => [locale, locale === lang ? pathname : switchLocalePath(pathname, locale)]),
  ) as Record<Locale, string>;
  return <LanguageLinks lang={lang} label={label} paths={paths} />;
}
