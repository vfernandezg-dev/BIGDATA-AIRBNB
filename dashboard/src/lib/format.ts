const LOCALE = "es";

// En español los números de cuatro cifras no llevan separador de miles por defecto (3414 frente a 15.383).
// En tablas y ejes eso desalinea las columnas, así que el separador se usa siempre.
const GROUPING = { useGrouping: "always" } as const;

const integer = new Intl.NumberFormat(LOCALE, { ...GROUPING, maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(LOCALE, { ...GROUPING, minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat(LOCALE, { ...GROUPING, minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });
const percentOneDecimal = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" });
const longMonthYear = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });

const MISSING = "—";

type Numeric = number | null | undefined;

function isMissing(value: Numeric): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

export function formatInt(value: Numeric): string {
  return isMissing(value) ? MISSING : integer.format(value);
}

export function formatDecimal(value: Numeric, digits: 1 | 2 = 1): string {
  if (isMissing(value)) return MISSING;
  return digits === 1 ? oneDecimal.format(value) : twoDecimals.format(value);
}

/** Números grandes en forma compacta: 12,9 mil / 1,3 M. Los menores de 10.000 se muestran completos. */
export function formatCompact(value: Numeric): string {
  if (isMissing(value)) return MISSING;
  return Math.abs(value) < 10_000 ? integer.format(value) : compact.format(value);
}

export function formatUsd(value: Numeric): string {
  return isMissing(value) ? MISSING : `US$ ${integer.format(value)}`;
}

export function formatPercent(value: Numeric, digits: 0 | 1 = 0): string {
  if (isMissing(value)) return MISSING;
  return digits === 0 ? percent.format(value) : percentOneDecimal.format(value);
}

/** Variación con signo: 0,18 -> `+18 %`; -0,22 -> `−22 %`. */
export function formatSignedPercent(value: Numeric): string {
  if (isMissing(value)) return MISSING;
  const rounded = Math.round(value * 100);
  if (rounded === 0) return "0 %";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} %`;
}

/** Nombres cortos de los doce meses: `ene`, `feb`... */
export function monthNames(): string[] {
  const month = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, index) => month.format(new Date(Date.UTC(2024, index, 1))));
}

/** `2026-09-01` -> `sept 2026`. */
export function formatMonth(isoDate: string): string {
  return monthYear.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** `2026-09-23` -> `septiembre de 2026`. */
export function formatMonthLong(isoDate: string): string {
  return longMonthYear.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

export function formatDate(isoDate: string): string {
  return longDate.format(new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate));
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  "Entire home/apt": "Vivienda completa",
  "Private room": "Habitación privada",
  "Hotel room": "Habitación de hotel",
  "Shared room": "Habitación compartida",
};

export function roomTypeLabel(roomType: string): string {
  return ROOM_TYPE_LABELS[roomType] ?? roomType;
}

const FEATURE_LABELS: Record<string, string> = {
  city: "Ciudad",
  room_type: "Tipo de alojamiento",
  property_group: "Tipo de propiedad",
  accommodates: "Capacidad (huéspedes)",
  bedrooms: "Dormitorios",
  beds: "Camas",
  bathrooms: "Baños",
  has_shared_bathroom: "Baño compartido",
  latitude: "Latitud",
  longitude: "Longitud",
  km_from_center: "Distancia al centro",
  minimum_nights: "Noches mínimas",
  availability_30: "Disponibilidad a 30 días",
  availability_60: "Disponibilidad a 60 días",
  availability_90: "Disponibilidad a 90 días",
  availability_365: "Disponibilidad a 365 días",
  number_of_reviews: "Reseñas totales",
  number_of_reviews_ltm: "Reseñas (últimos 12 meses)",
  number_of_reviews_l30d: "Reseñas (últimos 30 días)",
  reviews_per_month: "Reseñas por mes",
  has_reviews: "Tiene reseñas",
  review_scores_rating: "Puntuación general",
  review_scores_accuracy: "Puntuación: veracidad",
  review_scores_cleanliness: "Puntuación: limpieza",
  review_scores_checkin: "Puntuación: llegada",
  review_scores_communication: "Puntuación: comunicación",
  review_scores_location: "Puntuación: ubicación",
  review_scores_value: "Puntuación: calidad-precio",
  amenities_count: "Número de servicios",
  has_wifi: "Wifi",
  has_kitchen: "Cocina",
  has_air_conditioning: "Aire acondicionado",
  has_heating: "Calefacción",
  has_washer: "Lavadora",
  has_dryer: "Secadora",
  has_tv: "Televisor",
  has_parking: "Estacionamiento",
  has_pool: "Piscina",
  has_hot_tub: "Jacuzzi",
  has_gym: "Gimnasio",
  has_elevator: "Ascensor",
  has_workspace: "Zona de trabajo",
  has_dishwasher: "Lavavajillas",
  has_balcony: "Balcón o patio",
  host_is_superhost: "Anfitrión superhost",
  host_identity_verified: "Identidad verificada",
  host_listings_count: "Anuncios del anfitrión",
  calculated_host_listings_count: "Anuncios del anfitrión en la ciudad",
  host_tenure_years: "Antigüedad del anfitrión",
  has_license: "Tiene licencia",
  instant_bookable: "Reserva inmediata",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

const DATASET_LABELS: Record<string, string> = {
  listings: "Anuncios",
  calendar: "Calendario",
  reviews: "Reseñas",
  neighbourhoods: "Barrios",
};

export function datasetLabel(dataset: string): string {
  return DATASET_LABELS[dataset] ?? dataset;
}
