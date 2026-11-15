/**
 * Textos que dibujan los propios gráficos y mapas: nombres de ejes, detalles al pasar el cursor, botones
 * y estados vacíos. Es el único diccionario que viaja al navegador, así que se mantiene pequeño; el resto
 * de los textos los resuelve el servidor y llegan ya traducidos.
 */
import type { Locale } from "../config";

const es = {
  loadFailed: "No se pudo cargar el gráfico. Los datos están en la tabla de esta tarjeta.",
  noData: "Sin datos.",
  timeSeries: {
    notEnough: "No hay suficientes datos para una serie.",
  },
  bubbles: {
    medianPrice: "precio mediano",
    occupancy: "ocupación estimada",
    listings: "anuncios",
    xAxis: "Precio mediano por noche (USD)",
    yAxis: "Ocupación estimada",
  },
  priceRange: {
    medianPrice: "precio mediano",
    middleHalf: "mitad central",
    empty: "Sin precios publicados.",
  },
  neighbourhoods: {
    medianPrice: "precio mediano",
    listings: "anuncios",
    rating: "valoración",
    xAxis: "Anuncios en el barrio (escala logarítmica)",
    yAxis: "Precio mediano (USD)",
    empty: "No hay suficientes barrios con precio.",
  },
  prediction: {
    predicted: "predicho",
    actual: "real",
    xAxis: "Precio real por noche (USD, escala logarítmica)",
    yAxis: "Precio predicho (USD)",
  },
  bias: {
    title: (range: string) => `Precio real: ${range}`,
    over: "predicho / real (predice de más)",
    under: "predicho / real (predice de menos)",
    count: "anuncios en el tramo",
  },
  worldMap: {
    regionsLabel: "Encuadre del mapa",
    world: "Mundo",
    americas: "América",
    europe: "Europa",
    price: "precio mediano por noche",
    listings: "anuncios",
    occupancy: "ocupación estimada",
    empty: "Sin ciudades publicadas.",
  },
  cityMap: {
    label: (city: string) =>
      `Mapa de ${city}: precio por noche de los anuncios, agregados en celdas de unos 500 metros`,
    modesLabel: "Vista del mapa",
    heat: "Mapa de calor",
    cells: "Precio por celda",
    failed: "No se pudo cargar el mapa base. Los datos por barrio están en las tablas de esta página.",
    noPrice: "Sin precio",
    perNight: (price: string) => `${price} por noche`,
    listingsInCell: (count: number, formatted: string) =>
      `${formatted} ${count === 1 ? "anuncio" : "anuncios"} en la celda`,
    heatScaleLabel: "Escala del mapa de calor",
    cityMedian: (price: string) => `${price} (mediana de la ciudad)`,
    orMore: (price: string) => `${price} o más`,
    lessThan: (price: string) => `Menos de ${price}`,
    cellScaleLabel: "Escala de precio mediano",
    noPublishedPrice: "Sin precio publicado",
    // Textos de los controles de MapLibre, que por defecto están en inglés.
    controls: {
      "AttributionControl.ToggleAttribution": "Mostrar u ocultar la atribución",
      "Map.Title": "Mapa",
      "NavigationControl.ZoomIn": "Acercar",
      "NavigationControl.ZoomOut": "Alejar",
      "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl + desplazamiento para acercar el mapa",
      "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ + desplazamiento para acercar el mapa",
      "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
    } as Record<string, string>,
  },
};

export type ChartMessages = typeof es;

const en: ChartMessages = {
  loadFailed: "The chart could not be loaded. The data is in this card's table.",
  noData: "No data.",
  timeSeries: {
    notEnough: "There is not enough data for a series.",
  },
  bubbles: {
    medianPrice: "median price",
    occupancy: "estimated occupancy",
    listings: "listings",
    xAxis: "Median price per night (USD)",
    yAxis: "Estimated occupancy",
  },
  priceRange: {
    medianPrice: "median price",
    middleHalf: "middle half",
    empty: "No published prices.",
  },
  neighbourhoods: {
    medianPrice: "median price",
    listings: "listings",
    rating: "rating",
    xAxis: "Listings in the neighborhood (log scale)",
    yAxis: "Median price (USD)",
    empty: "There are not enough neighborhoods with a price.",
  },
  prediction: {
    predicted: "predicted",
    actual: "actual",
    xAxis: "Actual price per night (USD, log scale)",
    yAxis: "Predicted price (USD)",
  },
  bias: {
    title: (range) => `Actual price: ${range}`,
    over: "predicted / actual (overpredicts)",
    under: "predicted / actual (underpredicts)",
    count: "listings in the bracket",
  },
  worldMap: {
    regionsLabel: "Map view",
    world: "World",
    americas: "Americas",
    europe: "Europe",
    price: "median price per night",
    listings: "listings",
    occupancy: "estimated occupancy",
    empty: "No published cities.",
  },
  cityMap: {
    label: (city) => `Map of ${city}: price per night of the listings, aggregated into cells of about 500 meters`,
    modesLabel: "Map mode",
    heat: "Heat map",
    cells: "Price by cell",
    failed: "The base map could not be loaded. The data by neighborhood is in the tables on this page.",
    noPrice: "No price",
    perNight: (price) => `${price} per night`,
    listingsInCell: (count, formatted) => `${formatted} ${count === 1 ? "listing" : "listings"} in the cell`,
    heatScaleLabel: "Heat map scale",
    cityMedian: (price) => `${price} (city median)`,
    orMore: (price) => `${price} or more`,
    lessThan: (price) => `Under ${price}`,
    cellScaleLabel: "Median price scale",
    noPublishedPrice: "No published price",
    // MapLibre ya trae sus controles en inglés.
    controls: {},
  },
};

export const chartMessages: Record<Locale, ChartMessages> = { es, en };
