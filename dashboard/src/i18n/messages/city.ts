/** Textos de la página de cada ciudad. */
import type { Locale } from "../config";

const es = {
  notFoundTitle: "Ciudad no encontrada",
  description: (city: string, country: string) =>
    `Precios, barrios, tipos de alojamiento y demanda del alquiler turístico en ${city} (${country}).`,
  loading: "Cargando la ciudad…",
  citiesNav: "Ciudades",
  intro: (snapshot: string, currency: string | null) =>
    `Snapshot del ${snapshot}. Los precios se publican en ${currency ?? "moneda local"} y aquí se muestran en dólares.`,
  kpis: {
    label: "Cifras principales",
    medianPrice: "Precio mediano por noche",
    medianPriceHint: (p25: string, p75: string) =>
      `La mitad central de los anuncios cuesta entre ${p25} y ${p75}.`,
    listings: "Anuncios",
    listingsHint: (priced: string, hosts: string) => `${priced} con precio publicado · ${hosts} anfitriones.`,
    occupancy: "Ocupación estimada",
    occupancyHint: "Noches reservadas en los últimos 12 meses, estimadas por Inside Airbnb a partir de las reseñas.",
    rating: "Valoración media",
    ratingHint: (reviews: string) => `Sobre 5. ${reviews} reseñas en los últimos 12 meses.`,
  },
  map: {
    title: "Dónde están los alojamientos más caros",
    subtitle:
      "El mapa de calor resalta las zonas donde se concentran los precios por encima de la mediana de la ciudad: cuanto más intenso el color, más caros los alojamientos de esa zona. La vista por celdas muestra el precio mediano de cada cuadrícula de unos 500 metros.",
    footnote:
      "Para acercar el mapa, mantén pulsada la tecla Ctrl mientras desplazas, o usa dos dedos. En la vista por celdas, pasa el cursor por una celda para ver su precio; cada color agrupa una quinta parte de las celdas.",
  },
  histogram: {
    title: "Distribución de precios",
    subtitle: "Número de anuncios por tramo de precio por noche, en dólares.",
    footnote: (from: string) => `El último tramo agrupa todos los anuncios de ${from} o más.`,
    caption: "Anuncios por tramo de precio",
    priceColumn: "Precio por noche",
    listingsColumn: "Anuncios",
    orMore: (from: string) => `${from} o más`,
    range: (from: string, to: string) => `De ${from} a ${to}`,
    valueLabel: "anuncios",
    chart: "Histograma: número de anuncios por tramo de precio por noche",
  },
  roomTypes: {
    title: "Qué se alquila y a qué precio",
    subtitle:
      "Reparto de los anuncios por tipo de alojamiento y, debajo, el rango de precios de cada uno: la barra cubre la mitad central de los anuncios y la marca señala la mediana.",
    caption: "Tipos de alojamiento",
    columns: {
      type: "Tipo",
      listings: "Anuncios",
      share: "Cuota",
      p25: "Percentil 25",
      median: "Mediana",
      p75: "Percentil 75",
      capacity: "Capacidad media",
    },
    unit: "anuncios",
    chart: "Rango de precios por tipo de alojamiento: del percentil 25 al 75, con la mediana",
  },
  topNeighbourhoods: {
    title: "Los barrios más caros",
    subtitle: (count: number) => `Precio mediano por noche de los ${count} barrios con el precio más alto.`,
    caption: "Barrios",
    columns: {
      neighbourhood: "Barrio",
      listings: "Anuncios",
      medianPrice: "Precio mediano",
      versusCity: "Frente a la ciudad",
      entireHome: "Vivienda completa",
      rating: "Valoración",
      segment: "Segmento",
    },
  },
  priceIndex: {
    title: "Barrios que cobran más o menos de lo esperable",
    subtitle:
      "Precio real dividido por el que predice el modelo para anuncios con las mismas características. Por encima de 1, el barrio cobra un sobreprecio; por debajo, es más barato de lo que sus alojamientos harían esperar.",
    footnote: "Es una lectura del error del modelo, no una tasación. Cómo se calcula:",
    modelLink: "modelo de precios",
    low: "Más barato de lo esperable",
    high: "Más caro de lo esperable",
    empty: "El modelo de precios aún no se ha entrenado para esta ciudad.",
  },
  scatter: {
    title: "Oferta frente a precio, barrio a barrio",
    subtitle:
      "Cada punto es un barrio: hacia la derecha tiene más anuncios; hacia arriba, es más caro. Arriba a la izquierda quedan los barrios caros con poca oferta; abajo a la derecha, los que tienen mucha oferta y precios bajos.",
    footnote:
      "Se etiquetan los barrios con más anuncios y los más caros; el resto, al pasar el cursor. Las cifras de todos los barrios están en la tabla de «Los barrios más caros».",
    chart: "Dispersión: número de anuncios frente a precio mediano por barrio",
  },
  reviews: {
    title: "Reseñas por mes",
    subtitle: "Cada reseña corresponde a una estancia terminada: su ritmo aproxima la demanda.",
    caption: "Reseñas por mes",
    month: "Mes",
    reviews: "Reseñas",
    valueLabel: "reseñas",
    chart: (city: string) => `Serie temporal: reseñas por mes en ${city}`,
  },
  reviewGrid: {
    title: "Reseñas por año y mes",
    subtitle:
      "Las mismas reseñas, en rejilla: de arriba abajo se ve el crecimiento de un año a otro; de izquierda a derecha, los meses fuertes y flojos.",
    footnote: "Las celdas en blanco son meses sin datos; el último mes con datos está incompleto.",
    valueLabel: "reseñas",
    scale: ["Menos reseñas", "Más reseñas"] as [string, string],
    chart: (city: string) => `Mapa de calor: reseñas por año y mes en ${city}`,
  },
  availability: {
    title: "Disponibilidad en los próximos meses",
    subtitle:
      "Porcentaje de noches que los calendarios muestran libres. Una noche no disponible puede estar reservada o bloqueada por el anfitrión.",
    caption: "Disponibilidad por mes",
    month: "Mes",
    freeNights: "Noches libres",
    listings: "Anuncios",
    valueLabel: "de noches libres",
    chart: "Columnas: porcentaje de noches libres por mes",
  },
  hosts: {
    title: "Quién ofrece los alojamientos",
    subtitle:
      "Anuncios según cuántos gestiona su anfitrión en la ciudad. Los tramos altos corresponden a operadores profesionales.",
    caption: "Concentración de anfitriones",
    perHost: "Anuncios por anfitrión",
    hosts: "Anfitriones",
    listings: "Anuncios",
    bucket: (label: string) => (label === "1" ? "1 anuncio" : `${label} anuncios`),
  },
};

export type CityMessages = typeof es;

const en: CityMessages = {
  notFoundTitle: "City not found",
  description: (city, country) =>
    `Prices, neighborhoods, room types and demand of short-term rentals in ${city} (${country}).`,
  loading: "Loading the city…",
  citiesNav: "Cities",
  intro: (snapshot, currency) =>
    `Snapshot of ${snapshot}. Prices are published in ${currency ?? "local currency"} and shown here in US dollars.`,
  kpis: {
    label: "Key figures",
    medianPrice: "Median price per night",
    medianPriceHint: (p25, p75) => `The middle half of the listings costs between ${p25} and ${p75}.`,
    listings: "Listings",
    listingsHint: (priced, hosts) => `${priced} with a published price · ${hosts} hosts.`,
    occupancy: "Estimated occupancy",
    occupancyHint: "Nights booked in the last 12 months, estimated by Inside Airbnb from reviews.",
    rating: "Average rating",
    ratingHint: (reviews) => `Out of 5. ${reviews} reviews in the last 12 months.`,
  },
  map: {
    title: "Where the most expensive listings are",
    subtitle:
      "The heat map highlights the areas where prices above the city median are concentrated: the more intense the color, the more expensive the listings in that area. The cell view shows the median price of each grid cell of about 500 meters.",
    footnote:
      "To zoom the map, hold the Ctrl key while scrolling, or use two fingers. In the cell view, hover over a cell to see its price; each color groups a fifth of the cells.",
  },
  histogram: {
    title: "Price distribution",
    subtitle: "Number of listings by price-per-night bracket, in US dollars.",
    footnote: (from) => `The last bracket groups all listings of ${from} or more.`,
    caption: "Listings by price bracket",
    priceColumn: "Price per night",
    listingsColumn: "Listings",
    orMore: (from) => `${from} or more`,
    range: (from, to) => `From ${from} to ${to}`,
    valueLabel: "listings",
    chart: "Histogram: number of listings by price-per-night bracket",
  },
  roomTypes: {
    title: "What is rented and at what price",
    subtitle:
      "Breakdown of listings by room type and, below, the price range of each: the bar covers the middle half of the listings and the mark shows the median.",
    caption: "Room types",
    columns: {
      type: "Type",
      listings: "Listings",
      share: "Share",
      p25: "25th percentile",
      median: "Median",
      p75: "75th percentile",
      capacity: "Average capacity",
    },
    unit: "listings",
    chart: "Price range by room type: from the 25th to the 75th percentile, with the median",
  },
  topNeighbourhoods: {
    title: "The most expensive neighborhoods",
    subtitle: (count) => `Median price per night of the ${count} neighborhoods with the highest price.`,
    caption: "Neighborhoods",
    columns: {
      neighbourhood: "Neighborhood",
      listings: "Listings",
      medianPrice: "Median price",
      versusCity: "Versus the city",
      entireHome: "Entire home",
      rating: "Rating",
      segment: "Segment",
    },
  },
  priceIndex: {
    title: "Neighborhoods that charge more or less than expected",
    subtitle:
      "Actual price divided by the price the model predicts for listings with the same features. Above 1, the neighborhood charges a premium; below, it is cheaper than its listings would suggest.",
    footnote: "It is a reading of the model's error, not a valuation. How it is calculated:",
    modelLink: "price model",
    low: "Cheaper than expected",
    high: "More expensive than expected",
    empty: "The price model has not been trained for this city yet.",
  },
  scatter: {
    title: "Supply versus price, neighborhood by neighborhood",
    subtitle:
      "Each point is a neighborhood: further right it has more listings; further up, it is more expensive. Top left are the expensive neighborhoods with little supply; bottom right, those with plenty of supply and low prices.",
    footnote:
      "The neighborhoods with the most listings and the most expensive ones are labeled; the rest, on hover. The figures for every neighborhood are in the table under “The most expensive neighborhoods”.",
    chart: "Scatter plot: number of listings versus median price by neighborhood",
  },
  reviews: {
    title: "Reviews per month",
    subtitle: "Each review follows a completed stay: their pace approximates demand.",
    caption: "Reviews per month",
    month: "Month",
    reviews: "Reviews",
    valueLabel: "reviews",
    chart: (city) => `Time series: reviews per month in ${city}`,
  },
  reviewGrid: {
    title: "Reviews by year and month",
    subtitle:
      "The same reviews, as a grid: top to bottom shows the growth from one year to the next; left to right, the strong and weak months.",
    footnote: "Blank cells are months with no data; the last month with data is incomplete.",
    valueLabel: "reviews",
    scale: ["Fewer reviews", "More reviews"],
    chart: (city) => `Heat map: reviews by year and month in ${city}`,
  },
  availability: {
    title: "Availability in the coming months",
    subtitle:
      "Share of nights that calendars show as free. An unavailable night may be booked or blocked by the host.",
    caption: "Availability by month",
    month: "Month",
    freeNights: "Free nights",
    listings: "Listings",
    valueLabel: "of nights free",
    chart: "Columns: share of free nights by month",
  },
  hosts: {
    title: "Who offers the listings",
    subtitle:
      "Listings by how many their host manages in the city. The higher brackets correspond to professional operators.",
    caption: "Host concentration",
    perHost: "Listings per host",
    hosts: "Hosts",
    listings: "Listings",
    bucket: (label) => (label === "1" ? "1 listing" : `${label} listings`),
  },
};

export const cityMessages: Record<Locale, CityMessages> = { es, en };
