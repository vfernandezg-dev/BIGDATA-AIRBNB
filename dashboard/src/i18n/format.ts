import type { Locale } from "./config";

const MISSING = "—";

type Numeric = number | null | undefined;

function isMissing(value: Numeric): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

function isoDay(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

function createFormatters(lang: Locale) {
  // En español los números de cuatro cifras no llevan separador de miles por defecto (3414 frente a 15.383).
  // En tablas y ejes eso desalinea las columnas, así que el separador se usa siempre.
  const grouping = { useGrouping: "always" } as const;

  const integer = new Intl.NumberFormat(lang, { ...grouping, maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(lang, { ...grouping, minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const twoDecimals = new Intl.NumberFormat(lang, { ...grouping, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 });
  const percentOneDecimal = new Intl.NumberFormat(lang, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const shortMonth = new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" });
  const monthYear = new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" });
  const longMonthYear = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" });

  // El español separa el símbolo de la cifra (US$ 120, 18 %); el inglés no (US$120, 18%).
  const usdPrefix = lang === "es" ? "US$ " : "US$";
  const percentSign = lang === "es" ? " %" : "%";

  return {
    int(value: Numeric): string {
      return isMissing(value) ? MISSING : integer.format(value);
    },

    decimal(value: Numeric, digits: 1 | 2 = 1): string {
      if (isMissing(value)) return MISSING;
      return digits === 1 ? oneDecimal.format(value) : twoDecimals.format(value);
    },

    /** Números grandes en forma compacta: 12,9 mil / 1,3 M. Los menores de 10.000 se muestran completos. */
    compact(value: Numeric): string {
      if (isMissing(value)) return MISSING;
      return Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value);
    },

    /** Todos los precios del sitio están en dólares de EE. UU.; `US$` evita confundirlos con otros «$». */
    usd(value: Numeric): string {
      return isMissing(value) ? MISSING : `${usdPrefix}${integer.format(value)}`;
    },

    percent(value: Numeric, digits: 0 | 1 = 0): string {
      if (isMissing(value)) return MISSING;
      return digits === 0 ? percent.format(value) : percentOneDecimal.format(value);
    },

    /** Variación con signo: 0,18 -> `+18 %`; -0,22 -> `−22 %`. */
    signedPercent(value: Numeric): string {
      if (isMissing(value)) return MISSING;
      const rounded = Math.round(value * 100);
      if (rounded === 0) return `0${percentSign}`;
      return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}${percentSign}`;
    },

    /** Nombres cortos de los doce meses: `ene`, `feb`... */
    monthNames(): string[] {
      return Array.from({ length: 12 }, (_, index) => shortMonth.format(new Date(Date.UTC(2024, index, 1))));
    },

    /** `2026-09-01` -> `sept 2026`. */
    month(isoDate: string): string {
      return monthYear.format(isoDay(isoDate));
    },

    /** `2026-09-23` -> `septiembre de 2026`. */
    monthLong(isoDate: string): string {
      return longMonthYear.format(isoDay(isoDate));
    },

    /** Fecha larga. Admite un día (`2026-09-23`) o un instante completo en UTC. */
    date(isoDate: string): string {
      return longDate.format(isoDate.length === 10 ? isoDay(isoDate) : new Date(isoDate));
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;

const cache = new Map<Locale, Formatters>();

/**
 * Formato de números y fechas de un idioma. Es el mismo objeto en cada llamada, así que puede usarse como
 * dependencia de un hook sin provocar renders de más.
 */
export function formatters(lang: Locale): Formatters {
  let instance = cache.get(lang);
  if (!instance) {
    instance = createFormatters(lang);
    cache.set(lang, instance);
  }
  return instance;
}
