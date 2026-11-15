/**
 * Textos de la página de fuentes y licencias.
 *
 * Los párrafos con enlaces se escriben completos en cada idioma, como fragmentos de JSX: partir una frase en
 * trozos para insertar un enlace obligaría a que los dos idiomas ordenaran las palabras igual.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { ExternalLink, Term } from "@/components/legal";
import { SITE, SOURCE, SOURCE_LICENSE } from "@/lib/site";

import type { Locale } from "../config";
import { pathFor } from "../routes";

const internalLink = "underline underline-offset-2 hover:text-ink";

export type LicensesMessages = {
  title: string;
  description: string;
  intro: string;
  data: {
    title: string;
    source: ReactNode;
    snapshots: string;
    caption: string;
    columns: { city: string; collected: string; citation: string };
    citation: (city: string, month: string) => string;
    referenceIntro: string;
    reference: (year: string, cities: number, period: string) => ReactNode;
  };
  changes: {
    title: string;
    intro: string;
    items: (fxDate: string | null) => string[];
    noRedistribution: ReactNode;
    noEndorsement: ReactNode;
  };
  maps: { title: string; cityMaps: ReactNode; worldMap: ReactNode };
  software: {
    title: string;
    intro: string;
    caption: string;
    columns: { component: string; use: string; license: string };
    rows: { name: string; use: string; license: string }[];
  };
  authorship: { title: string; intro: ReactNode; figures: ReactNode; code: ReactNode };
  trademarks: { title: string; text: string };
  reviewed: (date: string) => ReactNode;
};

const es: LicensesMessages = {
  title: "Fuentes y licencias",
  description:
    "De dónde proceden los datos, los mapas y el software de este sitio, bajo qué licencias se usan y cómo citar sus cifras.",
  intro:
    "Este sitio se apoya en datos, mapas y software de terceros. Aquí se explica de dónde viene cada cosa, en qué condiciones se usa y qué puedes hacer tú con las cifras y los gráficos que ves.",
  data: {
    title: "Los datos: Inside Airbnb",
    source: (
      <>
        Todos los datos de anuncios, calendarios y reseñas proceden de{" "}
        <ExternalLink href={SOURCE.url}>{SOURCE.name}</ExternalLink>, un proyecto independiente de {SOURCE.publisher}{" "}
        que recopila información publicada en el sitio web de Airbnb y la pone a disposición del público. Se usan
        bajo la licencia <ExternalLink href={SOURCE_LICENSE.es.url}>{SOURCE_LICENSE.es.name}</ExternalLink>. La
        fuente publica además unas <ExternalLink href={SOURCE.policiesUrl}>políticas de uso de datos</ExternalLink>,
        que este proyecto procura seguir.
      </>
    ),
    snapshots:
      "Cada ciudad es una fotografía tomada en una fecha concreta. Estas son las que usa el sitio y la forma de citar cada una:",
    caption: "Ciudades, fecha de recogida de los datos y cita de la fuente",
    columns: { city: "Ciudad", collected: "Datos recogidos el", citation: "Cita" },
    citation: (city, month) => `Fuente: ${SOURCE.name}, ${city}, ${month}.`,
    referenceIntro: "Para una referencia bibliográfica del conjunto:",
    reference: (year, cities, period) => (
      <>
        {SOURCE.name}. ({year}).{" "}
        <cite>
          Datos de anuncios, calendarios y reseñas de Airbnb de {cities} ciudades, {period}
        </cite>{" "}
        [Conjunto de datos]. {SOURCE.publisher}. {SOURCE.dataUrl}
      </>
    ),
  },
  changes: {
    title: "Qué se ha hecho con esos datos",
    intro:
      "La licencia pide indicar los cambios. Las cifras de este sitio no son los datos originales, sino una elaboración propia a partir de ellos:",
    items: (fxDate) => [
      "Se han limpiado, tipado y deduplicado los registros, y se han marcado los valores atípicos.",
      `Los precios, publicados en la moneda de cada ciudad, se han convertido a dólares con un tipo de cambio fijo${fxDate ? `, el del ${fxDate}` : ""}.`,
      "Se han agregado por ciudad, barrio, tipo de alojamiento, mes y celdas de unos 500 metros. El sitio no publica fichas ni identificadores de anuncios.",
      "Se ha entrenado un modelo estadístico de precios, cuyas estimaciones son solo de este proyecto.",
    ],
    noRedistribution: (
      <>
        <Term>Este sitio no redistribuye los datos originales.</Term> Publica únicamente agregados; quien necesite
        los datos debe obtenerlos de <ExternalLink href={SOURCE.dataUrl}>{SOURCE.name}</ExternalLink>.
      </>
    ),
    noEndorsement: (
      <>
        Citar a {SOURCE.name} como fuente no significa que {SOURCE.name} ni {SOURCE.publisher} respalden estos
        resultados. Los errores de procesamiento o de interpretación son responsabilidad de este proyecto. El
        detalle del proceso está en la{" "}
        <Link href={pathFor("es", "methodology")} className={internalLink}>
          metodología
        </Link>
        .
      </>
    ),
  },
  maps: {
    title: "Mapas",
    cityMaps: (
      <>
        <Term>Mapa de cada ciudad.</Term> Teselas de{" "}
        <ExternalLink href="https://openfreemap.org/">OpenFreeMap</ExternalLink>, con el esquema de{" "}
        <ExternalLink href="https://openmaptiles.org/">OpenMapTiles</ExternalLink> y datos de ©{" "}
        <ExternalLink href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</ExternalLink>{" "}
        (licencia ODbL).
      </>
    ),
    worldMap: (
      <>
        <Term>Mapamundi.</Term> Contornos de países de{" "}
        <ExternalLink href="https://www.naturalearthdata.com/">Natural Earth</ExternalLink> (dominio público), a
        escala 1:110 millones.
      </>
    ),
  },
  software: {
    title: "Software",
    intro: "El proyecto está construido con software de código abierto. Los componentes principales:",
    caption: "Software principal y su licencia",
    columns: { component: "Componente", use: "Uso", license: "Licencia" },
    rows: [
      { name: "Apache Spark", use: "Procesamiento de los datos", license: "Apache 2.0" },
      { name: "Apache Hadoop (HDFS)", use: "Almacenamiento del data lake", license: "Apache 2.0" },
      { name: "PostgreSQL", use: "Base de datos de las tablas publicadas", license: "PostgreSQL License" },
      { name: "Next.js y React", use: "Sitio web", license: "MIT" },
      { name: "Apache ECharts", use: "Gráficos y mapamundi", license: "Apache 2.0" },
      { name: "MapLibre GL JS", use: "Mapa de cada ciudad", license: "BSD de 3 cláusulas" },
    ],
  },
  authorship: {
    title: "Autoría y reutilización de este sitio",
    intro: (
      <>
        El análisis, el código y las visualizaciones son obra de{" "}
        <ExternalLink href={SITE.author.url}>{SITE.author.name}</ExternalLink>. El proyecto nació como trabajo en
        equipo del curso de Big Data de la Universidad Privada Antenor Orrego; esa primera versión y su autoría se
        conservan en el repositorio.
      </>
    ),
    figures: (
      <>
        <Term>Cifras y gráficos.</Term> Puedes citarlos y reproducirlos indicando la fuente de los datos (
        {SOURCE.name}, con la ciudad y la fecha) y enlazando a este sitio.
      </>
    ),
    code: (
      <>
        <Term>Código.</Term> Está publicado en <ExternalLink href={SITE.repository}>GitHub</ExternalLink> para su
        consulta. El repositorio no incluye por ahora una licencia de código abierto: si quieres reutilizarlo,{" "}
        <ExternalLink href={SITE.contact}>escríbeme</ExternalLink>.
      </>
    ),
  },
  trademarks: {
    title: "Marcas",
    text: `Airbnb es una marca de Airbnb, Inc. Aquí se menciona únicamente para identificar la plataforma de la que proceden los datos. Este sitio es independiente: no está afiliado a Airbnb, Inc. ni a ${SOURCE.name}, ni cuenta con su respaldo.`,
  },
  reviewed: (date) => (
    <>
      Última revisión: {date}. Consulta también los{" "}
      <Link href={pathFor("es", "terms")} className="underline underline-offset-2 hover:text-ink-2">
        términos de uso
      </Link>
      .
    </>
  ),
};

const en: LicensesMessages = {
  title: "Sources and licenses",
  description:
    "Where this site's data, maps and software come from, under which licenses they are used and how to cite its figures.",
  intro:
    "This site relies on third-party data, maps and software. This page explains where each one comes from, under what conditions it is used and what you can do with the figures and charts you see.",
  data: {
    title: "The data: Inside Airbnb",
    source: (
      <>
        All the listing, calendar and review data comes from{" "}
        <ExternalLink href={SOURCE.url}>{SOURCE.name}</ExternalLink>, an independent project by {SOURCE.publisher}{" "}
        that collects information published on the Airbnb website and makes it available to the public. It is used
        under the <ExternalLink href={SOURCE_LICENSE.en.url}>{SOURCE_LICENSE.en.name}</ExternalLink> license. The
        source also publishes <ExternalLink href={SOURCE.policiesUrl}>data policies</ExternalLink>, which this
        project strives to follow.
      </>
    ),
    snapshots:
      "Each city is a snapshot taken on a specific date. These are the ones the site uses and how to cite each of them:",
    caption: "Cities, data collection date and source citation",
    columns: { city: "City", collected: "Data collected on", citation: "Citation" },
    citation: (city, month) => `Source: ${SOURCE.name}, ${city}, ${month}.`,
    referenceIntro: "For a bibliographic reference to the whole dataset:",
    reference: (year, cities, period) => (
      <>
        {SOURCE.name}. ({year}).{" "}
        <cite>
          Airbnb listing, calendar and review data for {cities} cities, {period}
        </cite>{" "}
        [Data set]. {SOURCE.publisher}. {SOURCE.dataUrl}
      </>
    ),
  },
  changes: {
    title: "What has been done with that data",
    intro:
      "The license requires indicating the changes. The figures on this site are not the original data, but this project's own work derived from it:",
    items: (fxDate) => [
      "The records have been cleaned, typed and deduplicated, and outliers have been flagged.",
      `Prices, published in each city's currency, have been converted to US dollars at a fixed exchange rate${fxDate ? `, that of ${fxDate}` : ""}.`,
      "They have been aggregated by city, neighborhood, room type, month and cells of about 500 meters. The site does not publish individual listings or listing identifiers.",
      "A statistical price model has been trained; its estimates are this project's alone.",
    ],
    noRedistribution: (
      <>
        <Term>This site does not redistribute the original data.</Term> It only publishes aggregates; anyone who
        needs the data should get it from <ExternalLink href={SOURCE.dataUrl}>{SOURCE.name}</ExternalLink>.
      </>
    ),
    noEndorsement: (
      <>
        Citing {SOURCE.name} as the source does not mean that {SOURCE.name} or {SOURCE.publisher} endorse these
        results. Any processing or interpretation errors are this project&apos;s responsibility. The process is
        described in the{" "}
        <Link href={pathFor("en", "methodology")} className={internalLink}>
          methodology
        </Link>
        .
      </>
    ),
  },
  maps: {
    title: "Maps",
    cityMaps: (
      <>
        <Term>City maps.</Term> Tiles from{" "}
        <ExternalLink href="https://openfreemap.org/">OpenFreeMap</ExternalLink>, using the{" "}
        <ExternalLink href="https://openmaptiles.org/">OpenMapTiles</ExternalLink> schema and data ©{" "}
        <ExternalLink href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</ExternalLink> (ODbL
        license).
      </>
    ),
    worldMap: (
      <>
        <Term>World map.</Term> Country outlines from{" "}
        <ExternalLink href="https://www.naturalearthdata.com/">Natural Earth</ExternalLink> (public domain), at
        1:110 million scale.
      </>
    ),
  },
  software: {
    title: "Software",
    intro: "The project is built with open-source software. The main components:",
    caption: "Main software and its license",
    columns: { component: "Component", use: "Use", license: "License" },
    rows: [
      { name: "Apache Spark", use: "Data processing", license: "Apache 2.0" },
      { name: "Apache Hadoop (HDFS)", use: "Data lake storage", license: "Apache 2.0" },
      { name: "PostgreSQL", use: "Database for the published tables", license: "PostgreSQL License" },
      { name: "Next.js and React", use: "Website", license: "MIT" },
      { name: "Apache ECharts", use: "Charts and world map", license: "Apache 2.0" },
      { name: "MapLibre GL JS", use: "City maps", license: "BSD 3-Clause" },
    ],
  },
  authorship: {
    title: "Authorship and reuse of this site",
    intro: (
      <>
        The analysis, the code and the visualizations are the work of{" "}
        <ExternalLink href={SITE.author.url}>{SITE.author.name}</ExternalLink>. The project began as a team
        assignment for the Big Data course at Universidad Privada Antenor Orrego; that first version and its
        authorship are preserved in the repository.
      </>
    ),
    figures: (
      <>
        <Term>Figures and charts.</Term> You may cite and reproduce them, stating the source of the data (
        {SOURCE.name}, with the city and the date) and linking to this site.
      </>
    ),
    code: (
      <>
        <Term>Code.</Term> It is published on <ExternalLink href={SITE.repository}>GitHub</ExternalLink> for
        reference. The repository does not include an open-source license for now: if you would like to reuse it,{" "}
        <ExternalLink href={SITE.contact}>get in touch</ExternalLink>.
      </>
    ),
  },
  trademarks: {
    title: "Trademarks",
    text: `Airbnb is a trademark of Airbnb, Inc. It is mentioned here only to identify the platform the data comes from. This site is independent: it is not affiliated with or endorsed by Airbnb, Inc. or ${SOURCE.name}.`,
  },
  reviewed: (date) => (
    <>
      Last reviewed: {date}. See also the{" "}
      <Link href={pathFor("en", "terms")} className="underline underline-offset-2 hover:text-ink-2">
        terms of use
      </Link>
      .
    </>
  ),
};

export const licensesMessages: Record<Locale, LicensesMessages> = { es, en };
