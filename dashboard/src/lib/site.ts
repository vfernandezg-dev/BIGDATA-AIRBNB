import type { Locale } from "@/i18n/config";

/** Datos del sitio que se repiten en el pie y en las páginas legales: un solo lugar donde cambiarlos. */
export const SITE = {
  name: "BigData Airbnb",
  author: {
    name: "Valentin Fernandez",
    url: "https://vfernandezg.dev",
  },
  repository: "https://github.com/vfernandezg-dev/airbnb-market-analytics",
  /** Licencia del código (la de los datos está en SOURCE_LICENSE). */
  codeLicense: "https://github.com/vfernandezg-dev/airbnb-market-analytics/blob/main/LICENSE",
  /** Vía de contacto pública: una incidencia en el repositorio. */
  contact: "https://github.com/vfernandezg-dev/airbnb-market-analytics/issues",
  /** Fecha de la última revisión de los términos y de la página de licencias (AAAA-MM-DD). */
  legalUpdated: "2026-11-15",
} as const;

export const SOURCE = {
  name: "Inside Airbnb",
  url: "https://insideairbnb.com/",
  dataUrl: "https://insideairbnb.com/get-the-data/",
  policiesUrl: "https://insideairbnb.com/data-policies/",
  publisher: "Housing Justice Data Lab",
} as const;

/** Licencia de los datos, con su nombre oficial y su resumen en cada idioma. */
export const SOURCE_LICENSE: Record<Locale, { name: string; url: string }> = {
  es: {
    name: "Creative Commons Atribución 4.0 Internacional (CC BY 4.0)",
    url: "https://creativecommons.org/licenses/by/4.0/deed.es",
  },
  en: {
    name: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    url: "https://creativecommons.org/licenses/by/4.0/deed.en",
  },
};
