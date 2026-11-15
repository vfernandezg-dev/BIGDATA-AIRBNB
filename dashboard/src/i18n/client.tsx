"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { formatters, type Formatters } from "./format";
import { chartMessages, type ChartMessages } from "./messages/charts";

/**
 * Idioma de la página para los componentes de cliente (gráficos y mapas), que no reciben la ruta.
 * Cada árbol de rutas lo fija una vez, en su layout.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  return <LocaleContext value={lang}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Formato de números y fechas del idioma de la página. Estable entre renders. */
export function useFormatters(): Formatters {
  return formatters(useLocale());
}

/** Textos que los gráficos dibujan por sí mismos: ejes, detalles al pasar el cursor y estados vacíos. */
export function useChartMessages(): ChartMessages {
  return chartMessages[useLocale()];
}
