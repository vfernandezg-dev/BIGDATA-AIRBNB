/** Datos del sitio que se repiten en el pie y en las páginas legales: un solo lugar donde cambiarlos. */
export const SITE = {
  name: "BigData Airbnb",
  author: {
    name: "Valentin Fernandez",
    url: "https://github.com/vfernandezg-dev",
  },
  repository: "https://github.com/vfernandezg-dev/BIGDATA-AIRBNB",
  /** Vía de contacto pública: una incidencia en el repositorio. */
  contact: "https://github.com/vfernandezg-dev/BIGDATA-AIRBNB/issues",
  /** Fecha de la última revisión de los términos y de la página de licencias (AAAA-MM-DD). */
  legalUpdated: "2026-11-15",
} as const;

export const SOURCE = {
  name: "Inside Airbnb",
  url: "https://insideairbnb.com/",
  dataUrl: "https://insideairbnb.com/get-the-data/",
  policiesUrl: "https://insideairbnb.com/data-policies/",
  publisher: "Housing Justice Data Lab",
  licenseName: "Creative Commons Atribución 4.0 Internacional (CC BY 4.0)",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/deed.es",
} as const;
