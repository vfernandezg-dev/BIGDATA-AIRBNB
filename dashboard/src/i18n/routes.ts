import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

/**
 * Secciones del sitio y el segmento de su dirección en cada idioma.
 *
 * Deben coincidir con las carpetas de `app/es` y `app/en`. Los enlaces internos se construyen siempre con
 * `pathFor`, nunca a mano, para que una sección tenga una sola dirección por idioma.
 */
const SEGMENTS = {
  home: { es: "", en: "" },
  city: { es: "ciudad", en: "city" },
  model: { es: "modelo", en: "model" },
  methodology: { es: "metodologia", en: "methodology" },
  licenses: { es: "licencias", en: "licenses" },
  terms: { es: "terminos", en: "terms" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof SEGMENTS;

/** Dirección de una sección en un idioma: `pathFor("en", "city", "london")` -> `/en/city/london`. */
export function pathFor(lang: Locale, route: RouteKey, slug?: string): string {
  const segment = SEGMENTS[route][lang];
  const base = segment ? `/${lang}/${segment}` : `/${lang}`;
  return slug ? `${base}/${slug}` : base;
}

/**
 * La misma página en otro idioma: `/es/ciudad/london` -> `/en/city/london`.
 * Una dirección que no corresponde a ninguna sección lleva a la portada del idioma pedido.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const [, current, segment = "", slug, ...rest] = pathname.split("/");
  if (!isLocale(current) || rest.length > 0) return pathFor(target, "home");

  const route = (Object.keys(SEGMENTS) as RouteKey[]).find((key) => SEGMENTS[key][current] === segment);
  if (!route) return pathFor(target, "home");
  // Solo la sección de ciudades lleva un segundo nivel, y siempre lo lleva.
  if ((route === "city") !== Boolean(slug)) return pathFor(target, "home");
  return pathFor(target, route, slug);
}

/** Versiones de una página en cada idioma, para `<link rel="alternate" hreflang>`. */
export function languageAlternates(route: RouteKey, slug?: string): Record<string, string> {
  const alternates: Record<string, string> = { "x-default": pathFor(DEFAULT_LOCALE, route, slug) };
  for (const lang of LOCALES) alternates[lang] = pathFor(lang, route, slug);
  return alternates;
}
