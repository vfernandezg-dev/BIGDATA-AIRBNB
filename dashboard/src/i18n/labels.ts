/**
 * Nombres de las cosas que llegan como dato: tipos de alojamiento, variables del modelo, ciudades y países.
 *
 * Lo que no esté en estas tablas se muestra tal cual llega, de modo que un valor nuevo en los datos nunca
 * rompe una página: solo aparece sin traducir hasta que se añade aquí.
 */
import type { Locale } from "./config";

type Translations = Record<string, Record<Locale, string>>;

const ROOM_TYPES: Translations = {
  "Entire home/apt": { es: "Vivienda completa", en: "Entire home" },
  "Private room": { es: "Habitación privada", en: "Private room" },
  "Hotel room": { es: "Habitación de hotel", en: "Hotel room" },
  "Shared room": { es: "Habitación compartida", en: "Shared room" },
};

export function roomTypeLabel(lang: Locale, roomType: string): string {
  return ROOM_TYPES[roomType]?.[lang] ?? roomType;
}

const FEATURES: Translations = {
  city: { es: "Ciudad", en: "City" },
  room_type: { es: "Tipo de alojamiento", en: "Room type" },
  property_group: { es: "Tipo de propiedad", en: "Property type" },
  accommodates: { es: "Capacidad (huéspedes)", en: "Capacity (guests)" },
  bedrooms: { es: "Dormitorios", en: "Bedrooms" },
  beds: { es: "Camas", en: "Beds" },
  bathrooms: { es: "Baños", en: "Bathrooms" },
  has_shared_bathroom: { es: "Baño compartido", en: "Shared bathroom" },
  latitude: { es: "Latitud", en: "Latitude" },
  longitude: { es: "Longitud", en: "Longitude" },
  km_from_center: { es: "Distancia al centro", en: "Distance to the center" },
  minimum_nights: { es: "Noches mínimas", en: "Minimum nights" },
  availability_30: { es: "Disponibilidad a 30 días", en: "Availability, next 30 days" },
  availability_60: { es: "Disponibilidad a 60 días", en: "Availability, next 60 days" },
  availability_90: { es: "Disponibilidad a 90 días", en: "Availability, next 90 days" },
  availability_365: { es: "Disponibilidad a 365 días", en: "Availability, next 365 days" },
  number_of_reviews: { es: "Reseñas totales", en: "Total reviews" },
  number_of_reviews_ltm: { es: "Reseñas (últimos 12 meses)", en: "Reviews (last 12 months)" },
  number_of_reviews_l30d: { es: "Reseñas (últimos 30 días)", en: "Reviews (last 30 days)" },
  reviews_per_month: { es: "Reseñas por mes", en: "Reviews per month" },
  has_reviews: { es: "Tiene reseñas", en: "Has reviews" },
  review_scores_rating: { es: "Puntuación general", en: "Overall rating" },
  review_scores_accuracy: { es: "Puntuación: veracidad", en: "Rating: accuracy" },
  review_scores_cleanliness: { es: "Puntuación: limpieza", en: "Rating: cleanliness" },
  review_scores_checkin: { es: "Puntuación: llegada", en: "Rating: check-in" },
  review_scores_communication: { es: "Puntuación: comunicación", en: "Rating: communication" },
  review_scores_location: { es: "Puntuación: ubicación", en: "Rating: location" },
  review_scores_value: { es: "Puntuación: calidad-precio", en: "Rating: value" },
  amenities_count: { es: "Número de servicios", en: "Number of amenities" },
  has_wifi: { es: "Wifi", en: "Wifi" },
  has_kitchen: { es: "Cocina", en: "Kitchen" },
  has_air_conditioning: { es: "Aire acondicionado", en: "Air conditioning" },
  has_heating: { es: "Calefacción", en: "Heating" },
  has_washer: { es: "Lavadora", en: "Washer" },
  has_dryer: { es: "Secadora", en: "Dryer" },
  has_tv: { es: "Televisor", en: "TV" },
  has_parking: { es: "Estacionamiento", en: "Parking" },
  has_pool: { es: "Piscina", en: "Pool" },
  has_hot_tub: { es: "Jacuzzi", en: "Hot tub" },
  has_gym: { es: "Gimnasio", en: "Gym" },
  has_elevator: { es: "Ascensor", en: "Elevator" },
  has_workspace: { es: "Zona de trabajo", en: "Workspace" },
  has_dishwasher: { es: "Lavavajillas", en: "Dishwasher" },
  has_balcony: { es: "Balcón o patio", en: "Balcony or patio" },
  host_is_superhost: { es: "Anfitrión superhost", en: "Superhost" },
  host_identity_verified: { es: "Identidad verificada", en: "Verified identity" },
  host_listings_count: { es: "Anuncios del anfitrión", en: "Host's listings" },
  calculated_host_listings_count: { es: "Anuncios del anfitrión en la ciudad", en: "Host's listings in the city" },
  host_tenure_years: { es: "Antigüedad del anfitrión", en: "Host tenure" },
  has_license: { es: "Tiene licencia", en: "Has a license" },
  instant_bookable: { es: "Reserva inmediata", en: "Instant booking" },
};

export function featureLabel(lang: Locale, feature: string): string {
  return FEATURES[feature]?.[lang] ?? feature;
}

const DATASETS: Translations = {
  listings: { es: "Anuncios", en: "Listings" },
  calendar: { es: "Calendario", en: "Calendar" },
  reviews: { es: "Reseñas", en: "Reviews" },
  neighbourhoods: { es: "Barrios", en: "Neighborhoods" },
};

export function datasetLabel(lang: Locale, dataset: string): string {
  return DATASETS[dataset]?.[lang] ?? dataset;
}

// Los marts guardan el nombre de cada ciudad y de cada país en español (conf/cities.yaml del pipeline).
// Aquí solo hacen falta los que cambian en inglés; el resto se escribe igual.
const CITY_NAMES_EN: Record<string, string> = {
  "mexico-city": "Mexico City",
  "rio-de-janeiro": "Rio de Janeiro",
  "new-york-city": "New York",
  paris: "Paris",
  london: "London",
  lisbon: "Lisbon",
};

const COUNTRY_NAMES_EN: Record<string, string> = {
  México: "Mexico",
  Brasil: "Brazil",
  España: "Spain",
  "Estados Unidos": "United States",
  Francia: "France",
  "Reino Unido": "United Kingdom",
};

/**
 * Ciudades con su nombre y su país en el idioma pedido. Una ciudad publicada después y aún sin traducir
 * conserva el nombre con el que llega.
 */
export function localizeCities<City extends { slug: string; name: string; country: string }>(
  lang: Locale,
  cities: City[],
): City[] {
  if (lang === "es") return cities;
  return cities.map((city) => ({
    ...city,
    name: CITY_NAMES_EN[city.slug] ?? city.name,
    country: COUNTRY_NAMES_EN[city.country] ?? city.country,
  }));
}
