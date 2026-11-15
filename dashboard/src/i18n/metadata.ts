import type { Metadata } from "next";

import type { Locale } from "./config";
import { languageAlternates, pathFor, type RouteKey } from "./routes";

/**
 * Dirección canónica de una página y sus versiones en los demás idiomas. Cada página lo incluye en sus
 * metadatos para que los buscadores relacionen las dos versiones (`hreflang`) en lugar de verlas duplicadas.
 */
export function pageAlternates(lang: Locale, route: RouteKey, slug?: string): Metadata["alternates"] {
  return { canonical: pathFor(lang, route, slug), languages: languageAlternates(route, slug) };
}
