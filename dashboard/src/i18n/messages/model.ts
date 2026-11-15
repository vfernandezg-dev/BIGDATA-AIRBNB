/** Textos de la página del modelo de precios. */
import type { Locale } from "../config";

const es = {
  title: "Modelo de precios",
  description:
    "Cómo se predice el precio por noche de un anuncio, cuánto acierta el modelo y qué variables pesan más.",
  // «Todavía no hay un modelo… las etapas `train` y `publish` del pipeline.»
  empty: { before: "Todavía no hay un modelo publicado. Ejecuta las etapas ", and: " y ", after: " del pipeline." },
  intro:
    "Un modelo de árboles potenciados por gradiente (GBT de Spark ML) estima el precio por noche de un anuncio a partir de sus características: ciudad, ubicación, tamaño, tipo de alojamiento, servicios, anfitrión y reseñas. Se entrena con el 80 % de los anuncios y se evalúa con el 20 % restante, que el modelo no ha visto.",
  kpis: {
    label: "Resultados en el conjunto de prueba",
    r2: "Varianza explicada (R²)",
    r2Hint: (baseline: string) => `Sobre el logaritmo del precio. La regla de referencia llega a ${baseline}.`,
    medianError: "Error relativo mediano",
    medianErrorHint: (baseline: string) =>
      `En la mitad de los anuncios el modelo se desvía menos que eso. La referencia: ${baseline}.`,
    meanError: "Error absoluto medio",
    meanErrorHint: (baseline: string) => `Por noche. La referencia: ${baseline}.`,
    testListings: "Anuncios de prueba",
    testListingsHint: (trained: string, date: string) => `Entrenado con ${trained} anuncios el ${date}.`,
  },
  byCity: {
    title: "Error por ciudad, frente a la regla de referencia",
    subtitle:
      "Error relativo mediano en el conjunto de prueba: cuanto más corta la barra, mejor. La referencia predice, para cada anuncio, la mediana de su ciudad y su tipo de alojamiento.",
    caption: "Métricas por ciudad en el conjunto de prueba",
    columns: {
      city: "Ciudad",
      testListings: "Anuncios de prueba",
      medianError: "Error mediano",
      baseline: "Referencia",
      meanError: "Error medio (USD)",
    },
    legend: { main: "Modelo", context: "Regla de referencia" },
  },
  importance: {
    title: "Qué variables pesan más",
    subtitle: (count: number) =>
      `Importancia relativa de las ${count} variables principales: cuánto reduce el error cada una al usarse en los árboles.`,
    footnote: "La importancia indica cuánto usa el modelo una variable, no que esa variable cause el precio.",
  },
  scatter: {
    title: "Precio predicho frente a precio real",
    subtitle: (count: string) =>
      `Muestra aleatoria de ${count} anuncios de prueba. Sobre la diagonal, la predicción coincide con el precio publicado.`,
    chart: "Dispersión del precio predicho frente al precio real de una muestra de anuncios de prueba",
  },
  bias: {
    title: "Dónde se equivoca: sesgo por tramo de precio",
    subtitle:
      "Los anuncios de prueba, en diez grupos del más barato al más caro. Cada barra es la mediana de precio predicho entre precio real: en 1, el modelo acierta.",
    footnote:
      "El modelo tiende a pasarse en los anuncios más baratos y a quedarse corto en los más caros: tira de los extremos hacia el centro.",
    caption: "Sesgo del modelo por tramo de precio real",
    columns: { actual: "Precio real", ratio: "Predicho / real", listings: "Anuncios" },
    over: "Predice de más",
    under: "Predice de menos",
    chart: "Barras: mediana de precio predicho entre precio real, por tramo de precio",
  },
  reading: {
    title: "Cómo leer estos resultados",
    paragraphs: [
      "El modelo predice el logaritmo del precio en dólares. Así, equivocarse en 20 dólares pesa lo mismo en términos relativos para un anuncio de 40 que para uno de 400, y los precios extremos no dominan el ajuste. Solo se usan anuncios con precio publicado, coordenadas dentro de la ciudad y precio dentro de los percentiles 1 y 99 de su ciudad.",
      "Ninguna variable contiene el precio ni se deriva de él: se excluyen de forma explícita los ingresos estimados y las cotizaciones de precio que publica la fuente. El reparto entre entrenamiento y prueba es determinista, de modo que un mismo anuncio cae siempre en el mismo conjunto.",
      "Predecir bien no equivale a explicar: el modelo recoge lo que se anuncia, no la calidad real del alojamiento ni la temporada de la estancia. Úsalo para comparar, no para tasar.",
    ],
  },
  segments: {
    title: "Segmentos de barrios",
    intro:
      "Además del modelo de precios, un K-Means agrupa los barrios de todas las ciudades según su precio relativo al de su ciudad, su actividad de reseñas, su disponibilidad y su tipo de oferta. Los segmentos se numeran de más barato a más caro; el número de grupos se elige con el coeficiente de silueta.",
    caption: "Perfil medio de cada segmento de barrios",
    name: (segment: number) => `Segmento ${segment}`,
    columns: {
      segment: "Segmento",
      neighbourhoods: "Barrios",
      versusCity: "Precio frente a su ciudad",
      reviewsPerMonth: "Reseñas por mes",
      availableDays: "Días disponibles al año",
      entireHome: "Vivienda completa",
      listingsShare: "Cuota de anuncios de la ciudad",
    },
  },
};

export type ModelMessages = typeof es;

const en: ModelMessages = {
  title: "Price model",
  description:
    "How the nightly price of a listing is predicted, how accurate the model is and which features matter most.",
  empty: { before: "No model has been published yet. Run the ", and: " and ", after: " stages of the pipeline." },
  intro:
    "A gradient-boosted trees model (Spark ML's GBT) estimates the nightly price of a listing from its features: city, location, size, room type, amenities, host and reviews. It is trained on 80% of the listings and evaluated on the remaining 20%, which the model has not seen.",
  kpis: {
    label: "Results on the test set",
    r2: "Explained variance (R²)",
    r2Hint: (baseline) => `On the logarithm of the price. The baseline rule reaches ${baseline}.`,
    medianError: "Median relative error",
    medianErrorHint: (baseline) =>
      `For half of the listings the model is off by less than that. The baseline: ${baseline}.`,
    meanError: "Mean absolute error",
    meanErrorHint: (baseline) => `Per night. The baseline: ${baseline}.`,
    testListings: "Test listings",
    testListingsHint: (trained, date) => `Trained on ${trained} listings on ${date}.`,
  },
  byCity: {
    title: "Error by city, against the baseline rule",
    subtitle:
      "Median relative error on the test set: the shorter the bar, the better. The baseline predicts, for each listing, the median of its city and room type.",
    caption: "Metrics by city on the test set",
    columns: {
      city: "City",
      testListings: "Test listings",
      medianError: "Median error",
      baseline: "Baseline",
      meanError: "Mean error (USD)",
    },
    legend: { main: "Model", context: "Baseline rule" },
  },
  importance: {
    title: "Which features matter most",
    subtitle: (count) =>
      `Relative importance of the top ${count} features: how much each one reduces the error when used in the trees.`,
    footnote: "Importance shows how much the model uses a feature, not that the feature causes the price.",
  },
  scatter: {
    title: "Predicted price versus actual price",
    subtitle: (count) =>
      `Random sample of ${count} test listings. On the diagonal, the prediction matches the published price.`,
    chart: "Scatter plot of predicted price versus actual price for a sample of test listings",
  },
  bias: {
    title: "Where it goes wrong: bias by price bracket",
    subtitle:
      "The test listings, in ten groups from cheapest to most expensive. Each bar is the median of predicted price over actual price: at 1, the model is right.",
    footnote:
      "The model tends to overshoot on the cheapest listings and fall short on the most expensive ones: it pulls the extremes toward the center.",
    caption: "Model bias by actual price bracket",
    columns: { actual: "Actual price", ratio: "Predicted / actual", listings: "Listings" },
    over: "Overpredicts",
    under: "Underpredicts",
    chart: "Bars: median of predicted price over actual price, by price bracket",
  },
  reading: {
    title: "How to read these results",
    paragraphs: [
      "The model predicts the logarithm of the price in US dollars. That way, being off by 20 dollars weighs the same in relative terms for a 40-dollar listing as for a 400-dollar one, and extreme prices do not dominate the fit. Only listings with a published price, coordinates inside the city and a price within the 1st and 99th percentiles of their city are used.",
      "No feature contains the price or is derived from it: the estimated revenue and the price quotes published by the source are explicitly excluded. The split between training and test is deterministic, so a given listing always falls in the same set.",
      "Predicting well is not the same as explaining: the model captures what is advertised, not the actual quality of the listing or the season of the stay. Use it to compare, not to appraise.",
    ],
  },
  segments: {
    title: "Neighborhood segments",
    intro:
      "Besides the price model, a K-Means clusters the neighborhoods of all cities by their price relative to their city, their review activity, their availability and their type of supply. Segments are numbered from cheapest to most expensive; the number of groups is chosen with the silhouette coefficient.",
    caption: "Average profile of each neighborhood segment",
    name: (segment) => `Segment ${segment}`,
    columns: {
      segment: "Segment",
      neighbourhoods: "Neighborhoods",
      versusCity: "Price versus its city",
      reviewsPerMonth: "Reviews per month",
      availableDays: "Days available per year",
      entireHome: "Entire home",
      listingsShare: "Share of the city's listings",
    },
  },
};

export const modelMessages: Record<Locale, ModelMessages> = { es, en };
