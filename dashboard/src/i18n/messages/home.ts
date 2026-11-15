/** Textos del panorama (la portada). */
import type { Locale } from "../config";

const es = {
  // «Todavía no hay datos… su etapa `publish`.»: el nombre de la etapa va entre las dos mitades.
  empty: { before: "Todavía no hay datos publicados. Ejecuta el pipeline y su etapa ", after: "." },
  title: (cities: number) => `El alquiler turístico en ${cities} ciudades`,
  intro:
    "Cuánto cuesta una noche, quién ofrece los alojamientos y cómo ha evolucionado la demanda, según el último snapshot de Inside Airbnb de cada ciudad. Elige una ciudad para ver su mapa de precios, sus barrios y su estacionalidad.",
  kpis: {
    label: "Cifras principales",
    listings: "Anuncios analizados",
    listingsHint: (total: string) => `${total} anuncios activos en el último snapshot de cada ciudad.`,
    cities: "Ciudades",
    citiesHint: (countries: string) => `En ${countries} países.`,
    hosts: "Anfitriones",
    hostsHint: "Suma de anfitriones distintos por ciudad.",
    reviews: "Reseñas en 12 meses",
    reviewsHint: "La mejor señal pública de cuánto se reserva.",
  },
  columns: {
    city: "Ciudad",
    country: "País",
    medianPrice: "Precio mediano",
    listings: "Anuncios",
    occupancy: "Ocupación estimada",
    entireHome: "Vivienda completa",
    privateRoom: "Habitación privada",
    hotelOrShared: "Hotel o compartida",
    rating: "Valoración",
    snapshot: "Snapshot",
    month: "Mes",
    reviews: "Reseñas",
  },
  worldMap: {
    title: "Las ciudades en el mapa",
    subtitle:
      "Cada burbuja es una ciudad: el color indica su precio mediano por noche y el tamaño, el número de anuncios. Pulsa una ciudad para abrir su página, o cambia el encuadre para acercarte.",
    footnote: "El área de la burbuja es proporcional al número de anuncios. Precios en dólares.",
    caption: "Ciudades, con su precio mediano y su número de anuncios",
    chart: "Mapamundi: precio mediano por noche y número de anuncios de cada ciudad",
  },
  price: {
    title: "Precio mediano por noche",
    subtitle: (cheapest: string, cheapestCity: string, dearest: string, dearestCity: string) =>
      `De ${cheapest} en ${cheapestCity} a ${dearest} en ${dearestCity}. En dólares, para poder comparar.`,
    footnote:
      "Mediana de los anuncios con precio publicado, sin valores atípicos (fuera de los percentiles 1 y 99 de cada ciudad).",
  },
  bubbles: {
    title: "Precio frente a ocupación",
    subtitle: "Cada burbuja es una ciudad. Hacia la derecha, más cara; hacia arriba, más noches reservadas.",
    footnote:
      "El área de la burbuja indica el número de anuncios. La ocupación es la estimación de Inside Airbnb para los últimos 12 meses.",
    caption: "Precio, ocupación y anuncios por ciudad",
    chart: "Burbujas: precio mediano frente a ocupación estimada por ciudad",
  },
  seasonality: {
    title: (years: string) => `Estacionalidad: cuándo se reserva más en cada ciudad (${years})`,
    subtitle:
      "Reseñas de cada mes frente al nivel habitual de la ciudad en ese momento. En rojo, temporada alta; en azul, temporada baja. Ciudades ordenadas de sur a norte.",
    extremes: (city: string, low: string, lowMonth: string, high: string, highMonth: string, steadiest: string) =>
      ` La más estacional es ${city} (de ${low} en ${lowMonth} a ${high} en ${highMonth}); la más estable, ${steadiest}.`,
    footnote:
      "El nivel habitual es la media de los doce meses que rodean a cada mes, para descontar el crecimiento de un año a otro.",
    caption: "Desviación mensual de las reseñas respecto al nivel habitual, por ciudad",
    valueLabel: "frente a lo habitual",
    scale: ["Temporada baja", "Temporada alta"] as [string, string],
    chart: "Mapa de calor: desviación mensual de las reseñas respecto al nivel habitual, por ciudad y mes",
  },
  reviews: {
    title: "Reseñas por mes, todas las ciudades",
    subtitle:
      "Cada reseña corresponde a una estancia terminada, así que su ritmo es la mejor aproximación pública a la demanda.",
    footnote: (lastMonth: string) =>
      `El último mes (${lastMonth}) está incompleto: cada snapshot se toma antes de que termine el mes.`,
    caption: "Reseñas por mes",
    valueLabel: "reseñas",
    chart: "Serie temporal: reseñas por mes sumando todas las ciudades",
  },
  roomTypes: {
    title: "Qué se alquila en cada ciudad",
    subtitle: "Reparto de los anuncios por tipo de alojamiento.",
    caption: "Reparto de los anuncios por tipo de alojamiento y ciudad",
    chart: "Barras apiladas: reparto de los anuncios por tipo de alojamiento en cada ciudad",
  },
  multiListing: {
    title: "Anuncios de anfitriones con más de un anuncio",
    subtitle:
      "Qué parte de la oferta está en manos de quien gestiona varios alojamientos en la misma ciudad: una pista de cuánto pesa la actividad profesional.",
  },
  table: {
    title: "Las ciudades, una a una",
    caption: "Indicadores por ciudad",
    footnote:
      "Ocupación estimada: noches reservadas en los últimos 12 meses que Inside Airbnb infiere a partir de las reseñas, sobre 365.",
  },
};

export type HomeMessages = typeof es;

const en: HomeMessages = {
  empty: { before: "No data has been published yet. Run the pipeline and its ", after: " stage." },
  title: (cities) => `Short-term rentals in ${cities} cities`,
  intro:
    "What a night costs, who offers the listings and how demand has evolved, according to the latest Inside Airbnb snapshot of each city. Pick a city to see its price map, its neighborhoods and its seasonality.",
  kpis: {
    label: "Key figures",
    listings: "Listings analyzed",
    listingsHint: (total) => `${total} active listings in the latest snapshot of each city.`,
    cities: "Cities",
    citiesHint: (countries) => `In ${countries} countries.`,
    hosts: "Hosts",
    hostsHint: "Sum of distinct hosts per city.",
    reviews: "Reviews in 12 months",
    reviewsHint: "The best public signal of how much gets booked.",
  },
  columns: {
    city: "City",
    country: "Country",
    medianPrice: "Median price",
    listings: "Listings",
    occupancy: "Estimated occupancy",
    entireHome: "Entire home",
    privateRoom: "Private room",
    hotelOrShared: "Hotel or shared",
    rating: "Rating",
    snapshot: "Snapshot",
    month: "Month",
    reviews: "Reviews",
  },
  worldMap: {
    title: "The cities on the map",
    subtitle:
      "Each bubble is a city: the color shows its median price per night and the size, the number of listings. Select a city to open its page, or change the view to zoom in.",
    footnote: "The bubble area is proportional to the number of listings. Prices in US dollars.",
    caption: "Cities, with their median price and number of listings",
    chart: "World map: median price per night and number of listings of each city",
  },
  price: {
    title: "Median price per night",
    subtitle: (cheapest, cheapestCity, dearest, dearestCity) =>
      `From ${cheapest} in ${cheapestCity} to ${dearest} in ${dearestCity}. In US dollars, so they can be compared.`,
    footnote:
      "Median of the listings with a published price, excluding outliers (outside the 1st and 99th percentiles of each city).",
  },
  bubbles: {
    title: "Price versus occupancy",
    subtitle: "Each bubble is a city. Further right, more expensive; further up, more nights booked.",
    footnote:
      "The bubble area shows the number of listings. Occupancy is Inside Airbnb's estimate for the last 12 months.",
    caption: "Price, occupancy and listings by city",
    chart: "Bubbles: median price versus estimated occupancy by city",
  },
  seasonality: {
    title: (years) => `Seasonality: when each city gets booked the most (${years})`,
    subtitle:
      "Reviews of each month against the city's usual level at that time. Red is high season; blue is low season. Cities ordered from south to north.",
    extremes: (city, low, lowMonth, high, highMonth, steadiest) =>
      ` The most seasonal is ${city} (from ${low} in ${lowMonth} to ${high} in ${highMonth}); the steadiest, ${steadiest}.`,
    footnote:
      "The usual level is the average of the twelve months around each month, to discount year-over-year growth.",
    caption: "Monthly deviation of reviews from the usual level, by city",
    valueLabel: "versus the usual level",
    scale: ["Low season", "High season"],
    chart: "Heat map: monthly deviation of reviews from the usual level, by city and month",
  },
  reviews: {
    title: "Reviews per month, all cities",
    subtitle: "Each review follows a completed stay, so their pace is the best public proxy for demand.",
    footnote: (lastMonth) =>
      `The last month (${lastMonth}) is incomplete: each snapshot is taken before the month ends.`,
    caption: "Reviews per month",
    valueLabel: "reviews",
    chart: "Time series: reviews per month across all cities",
  },
  roomTypes: {
    title: "What is rented in each city",
    subtitle: "Breakdown of listings by room type.",
    caption: "Breakdown of listings by room type and city",
    chart: "Stacked bars: breakdown of listings by room type in each city",
  },
  multiListing: {
    title: "Listings from hosts with more than one listing",
    subtitle:
      "The share of supply held by those who manage several listings in the same city: a hint of how much professional activity weighs.",
  },
  table: {
    title: "The cities, one by one",
    caption: "Indicators by city",
    footnote:
      "Estimated occupancy: nights booked in the last 12 months, as inferred by Inside Airbnb from reviews, out of 365.",
  },
};

export const homeMessages: Record<Locale, HomeMessages> = { es, en };
