/** Textos compartidos por todas las páginas: cabecera, pie, tarjetas de gráficos y página no encontrada. */
import type { Locale } from "../config";

const es = {
  site: {
    title: "BigData Airbnb · El alquiler turístico en 12 ciudades",
    description:
      "Precios, oferta y demanda del alquiler turístico en 12 ciudades, a partir de los datos abiertos de Inside Airbnb procesados con Apache Spark y Hadoop.",
  },
  skipToContent: "Saltar al contenido",
  nav: {
    label: "Secciones",
    home: "Panorama",
    model: "Modelo de precios",
    methodology: "Metodología",
  },
  languageLabel: "Idioma",
  footer: {
    developedBy: "Desarrollado por",
    legalLabel: "Información legal",
    licenses: "Fuentes y licencias",
    terms: "Términos de uso",
    code: "Código en GitHub",
    dataFrom: "Datos de",
    dataNote: (source: string) =>
      `, limpiados, convertidos a dólares y agregados por este proyecto. Sitio independiente y sin ánimo de lucro: no está afiliado a Airbnb, Inc. ni a ${source}, ni cuenta con su respaldo.`,
    published: (publishedAt: string, fxAsOf: string) =>
      `Datos publicados el ${publishedAt} · Precios convertidos a USD con el tipo de cambio del ${fxAsOf}.`,
  },
  chartCard: {
    viewTable: "Ver los datos en tabla",
  },
  noData: "Sin datos.",
  breakdownByType: "Reparto por tipo.",
  notFound: {
    title: "Página no encontrada",
    text: "Esa dirección no corresponde a ninguna ciudad ni sección de este sitio.",
    back: "Volver al panorama",
  },
};

export type CommonMessages = typeof es;

const en: CommonMessages = {
  site: {
    title: "BigData Airbnb · Short-term rentals in 12 cities",
    description:
      "Prices, supply and demand of short-term rentals in 12 cities, based on open data from Inside Airbnb processed with Apache Spark and Hadoop.",
  },
  skipToContent: "Skip to content",
  nav: {
    label: "Sections",
    home: "Overview",
    model: "Price model",
    methodology: "Methodology",
  },
  languageLabel: "Language",
  footer: {
    developedBy: "Developed by",
    legalLabel: "Legal information",
    licenses: "Sources and licenses",
    terms: "Terms of use",
    code: "Code on GitHub",
    dataFrom: "Data from",
    dataNote: (source) =>
      `, cleaned, converted to US dollars and aggregated by this project. An independent, non-profit site: it is not affiliated with or endorsed by Airbnb, Inc. or ${source}.`,
    published: (publishedAt, fxAsOf) =>
      `Data published on ${publishedAt} · Prices converted to USD at the exchange rate of ${fxAsOf}.`,
  },
  chartCard: {
    viewTable: "View the data as a table",
  },
  noData: "No data.",
  breakdownByType: "Breakdown by type.",
  notFound: {
    title: "Page not found",
    text: "That address does not match any city or section of this site.",
    back: "Back to the overview",
  },
};

export const commonMessages: Record<Locale, CommonMessages> = { es, en };
