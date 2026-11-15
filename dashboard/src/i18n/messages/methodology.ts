/** Textos de la página de metodología. */
import type { Locale } from "../config";

const es = {
  title: "Metodología",
  description: "De dónde salen los datos, cómo se procesan con Spark y Hadoop y qué límites tienen.",
  intro:
    "Este sitio muestra tablas ya calculadas por un pipeline batch sobre Apache Spark y HDFS. Ninguna página consulta los datos en bruto: lee agregados pequeños que se actualizan cuando el pipeline publica.",
  publication: (date: string, listings: string, cities: string) =>
    ` La última publicación es del ${date} e incluye ${listings} anuncios de ${cities} ciudades.`,
  pipeline: {
    title: "Del archivo original a la cifra",
    stages: [
      {
        name: "Raw",
        text: "Los archivos de Inside Airbnb se descargan tal cual (CSV comprimido) a HDFS, con su tamaño y su huella sha256. La fuente solo publica el último snapshot de cada ciudad, así que esta zona es también el archivo histórico.",
      },
      {
        name: "Bronze",
        text: "Cada archivo se convierte a Parquet sin interpretar su contenido: todas las columnas como texto, más el archivo y el momento de origen. Aquí se resuelve el problema de los saltos de línea dentro de los campos, que desplaza columnas si el CSV se lee de forma ingenua.",
      },
      {
        name: "Silver",
        text: "Se asignan tipos, se convierten los precios a dólares, se eliminan duplicados y se marca cada anuncio con las reglas de calidad que incumple (precio atípico, coordenadas fuera de la ciudad, tipo de alojamiento inválido). Las filas no se borran: se etiquetan.",
      },
      {
        name: "Gold",
        text: "Tablas agregadas pequeñas, una por cada pregunta de este sitio. Se publican en PostgreSQL en una sola transacción, y las páginas se regeneran a continuación.",
      },
    ],
  },
  quality: {
    title: "Calidad de los anuncios por ciudad",
    intro:
      "Cuántos anuncios tiene cada ciudad y cuántos quedan fuera de las estadísticas de precio o del modelo. Muchos anuncios no publican precio: es una característica de la fuente, no un fallo del proceso.",
    caption: "Calidad de los anuncios por ciudad",
    columns: {
      city: "Ciudad",
      listings: "Anuncios",
      withPrice: "Con precio",
      priceOutlier: "Precio atípico",
      outsideCity: "Fuera de la ciudad",
      invalidType: "Tipo inválido",
      modelEligible: "Aptos para el modelo",
    },
  },
  volume: {
    title: "Filas procesadas en cada etapa",
    intro:
      "Filas en Bronze (el archivo original) y en Silver (ya limpio). En el calendario las cifras no son comparables: Bronze guarda un registro por anuncio y día, y Silver lo resume por anuncio y mes.",
    caption: "Filas por ciudad, conjunto de datos y etapa",
    columns: { city: "Ciudad", dataset: "Datos", snapshot: "Snapshot" },
  },
  limits: {
    title: "Qué no dicen estos datos",
    // Cada punto: una idea destacada y su explicación, que continúa la frase.
    items: (fxDate: string | null) => [
      {
        lead: "El precio es el anunciado, no el pagado.",
        text: " No incluye descuentos por estancia larga ni refleja todas las tarifas.",
      },
      {
        lead: "La ocupación es una estimación.",
        text: " Inside Airbnb la infiere de las reseñas; una noche no disponible en el calendario puede estar reservada o simplemente bloqueada.",
      },
      {
        lead: "Los precios en dólares usan un tipo de cambio fijo",
        text: `${fxDate ? `, el del ${fxDate}` : ""}, para que las ciudades sean comparables entre sí. No reflejan la evolución del cambio.`,
      },
      {
        lead: "Cada ciudad es una fotografía",
        text: " tomada en la fecha de su snapshot; las fechas difieren unos días entre ciudades.",
      },
      {
        lead: "Las ubicaciones son aproximadas.",
        text: " La fuente desplaza las coordenadas de cada anuncio hasta unos 150 metros, y aquí se agregan en celdas de unos 500 metros.",
      },
    ],
  },
  source: {
    title: "Fuente y licencia",
    // «Los datos proceden de [fuente] y se usan bajo la licencia [licencia]. Este sitio publica…»
    dataFrom: "Los datos proceden de",
    usedUnder: "y se usan bajo la licencia",
    ownWork:
      ". Este sitio publica una elaboración propia a partir de ellos, no los datos originales, y no muestra nombres de anfitriones ni el texto de las reseñas.",
    // «La cita de cada ciudad… están en [fuentes y licencias]; las condiciones de uso del sitio, en los [términos de uso].»
    detailsIn:
      "La cita de cada ciudad, los cambios aplicados a los datos y las licencias de los mapas y del software están en",
    licensesLink: "fuentes y licencias",
    conditionsIn: "; las condiciones de uso del sitio, en los",
    termsLink: "términos de uso",
  },
};

export type MethodologyMessages = typeof es;

const en: MethodologyMessages = {
  title: "Methodology",
  description: "Where the data comes from, how it is processed with Spark and Hadoop, and what its limits are.",
  intro:
    "This site shows tables already computed by a batch pipeline on Apache Spark and HDFS. No page queries the raw data: each one reads small aggregates that are refreshed when the pipeline publishes.",
  publication: (date, listings, cities) =>
    ` The latest publication is from ${date} and includes ${listings} listings from ${cities} cities.`,
  pipeline: {
    title: "From the original file to the figure",
    stages: [
      {
        name: "Raw",
        text: "The Inside Airbnb files are downloaded as they are (compressed CSV) to HDFS, with their size and sha256 fingerprint. The source only publishes the latest snapshot of each city, so this zone is also the historical archive.",
      },
      {
        name: "Bronze",
        text: "Each file is converted to Parquet without interpreting its content: every column as text, plus the source file and timestamp. This is where the problem of line breaks inside fields is solved, which shifts columns if the CSV is read naively.",
      },
      {
        name: "Silver",
        text: "Types are assigned, prices are converted to US dollars, duplicates are removed and each listing is flagged with the quality rules it breaks (outlier price, coordinates outside the city, invalid room type). Rows are not deleted: they are labeled.",
      },
      {
        name: "Gold",
        text: "Small aggregate tables, one for each question on this site. They are published to PostgreSQL in a single transaction, and the pages are regenerated right after.",
      },
    ],
  },
  quality: {
    title: "Listing quality by city",
    intro:
      "How many listings each city has and how many are left out of the price statistics or the model. Many listings do not publish a price: that is a feature of the source, not a failure of the process.",
    caption: "Listing quality by city",
    columns: {
      city: "City",
      listings: "Listings",
      withPrice: "With a price",
      priceOutlier: "Outlier price",
      outsideCity: "Outside the city",
      invalidType: "Invalid type",
      modelEligible: "Eligible for the model",
    },
  },
  volume: {
    title: "Rows processed at each stage",
    intro:
      "Rows in Bronze (the original file) and in Silver (already clean). For the calendar the figures are not comparable: Bronze keeps one record per listing and day, and Silver summarizes it per listing and month.",
    caption: "Rows by city, dataset and stage",
    columns: { city: "City", dataset: "Dataset", snapshot: "Snapshot" },
  },
  limits: {
    title: "What this data does not say",
    items: (fxDate) => [
      {
        lead: "The price is the advertised one, not the price paid.",
        text: " It does not include long-stay discounts or reflect every fee.",
      },
      {
        lead: "Occupancy is an estimate.",
        text: " Inside Airbnb infers it from reviews; a night that is unavailable in the calendar may be booked or simply blocked.",
      },
      {
        lead: "Prices in US dollars use a fixed exchange rate",
        text: `${fxDate ? `, that of ${fxDate}` : ""}, so that cities can be compared with each other. They do not reflect how the rate has moved.`,
      },
      {
        lead: "Each city is a snapshot",
        text: " taken on its own date; the dates differ by a few days between cities.",
      },
      {
        lead: "Locations are approximate.",
        text: " The source shifts the coordinates of each listing by up to about 150 meters, and here they are aggregated into cells of about 500 meters.",
      },
    ],
  },
  source: {
    title: "Source and license",
    dataFrom: "The data comes from",
    usedUnder: "and is used under the",
    ownWork:
      " license. This site publishes its own work derived from that data, not the original data, and does not show host names or the text of reviews.",
    detailsIn:
      "The citation for each city, the changes applied to the data and the licenses of the maps and software are in",
    licensesLink: "sources and licenses",
    conditionsIn: "; the conditions for using the site, in the",
    termsLink: "terms of use",
  },
};

export const methodologyMessages: Record<Locale, MethodologyMessages> = { es, en };
