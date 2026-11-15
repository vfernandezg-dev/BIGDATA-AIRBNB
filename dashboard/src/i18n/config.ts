/**
 * Idiomas del sitio.
 *
 * Cada idioma tiene su propio árbol de rutas (`app/es`, `app/en`), con las direcciones traducidas, y comparte
 * las vistas de `src/views`. El idioma viaja en la dirección: el sitio no guarda cookies ni preferencias.
 */
export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Idioma de referencia: al que lleva la raíz del sitio cuando el navegador no pide otro. */
export const DEFAULT_LOCALE: Locale = "es";

export function isLocale(value: string | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

/** Cada idioma, nombrado en su propia lengua (para el selector). */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
};
