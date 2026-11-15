import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/data-table";
import { ExternalLink, LegalSection, Term } from "@/components/legal";
import { formatDate, formatMonthLong } from "@/lib/format";
import { getCities, getPublication, type CitySummary } from "@/lib/queries";
import { SITE, SOURCE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Fuentes y licencias",
  description:
    "De dónde proceden los datos, los mapas y el software de este sitio, bajo qué licencias se usan y cómo citar sus cifras.",
};

const SOFTWARE = [
  { name: "Apache Spark", use: "Procesamiento de los datos", license: "Apache 2.0" },
  { name: "Apache Hadoop (HDFS)", use: "Almacenamiento del data lake", license: "Apache 2.0" },
  { name: "PostgreSQL", use: "Base de datos de las tablas publicadas", license: "PostgreSQL License" },
  { name: "Next.js y React", use: "Sitio web", license: "MIT" },
  { name: "Apache ECharts", use: "Gráficos y mapamundi", license: "Apache 2.0" },
  { name: "MapLibre GL JS", use: "Mapa de cada ciudad", license: "BSD de 3 cláusulas" },
];

/** Periodo que cubren los snapshots, en palabras: un mes, o el rango entre el primero y el último. */
function collectionPeriod(cities: CitySummary[]): { period: string; year: string } {
  const dates = cities.map((city) => city.snapshot_date).sort();
  const first = formatMonthLong(dates[0]);
  const last = formatMonthLong(dates[dates.length - 1]);
  return { period: first === last ? last : `${first} – ${last}`, year: dates[dates.length - 1].slice(0, 4) };
}

export default async function LicensesPage() {
  const [cities, publication] = await Promise.all([getCities(), getPublication()]);
  const byName = [...cities].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const collection = cities.length > 0 ? collectionPeriod(cities) : null;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Fuentes y licencias</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Este sitio se apoya en datos, mapas y software de terceros. Aquí se explica de dónde viene cada cosa,
          en qué condiciones se usa y qué puedes hacer tú con las cifras y los gráficos que ves.
        </p>
      </header>

      <LegalSection id="datos" title="Los datos: Inside Airbnb">
        <p>
          Todos los datos de anuncios, calendarios y reseñas proceden de{" "}
          <ExternalLink href={SOURCE.url}>{SOURCE.name}</ExternalLink>, un proyecto independiente de{" "}
          {SOURCE.publisher} que recopila información publicada en el sitio web de Airbnb y la pone a
          disposición del público. Se usan bajo la licencia{" "}
          <ExternalLink href={SOURCE.licenseUrl}>{SOURCE.licenseName}</ExternalLink>. La fuente publica
          además unas <ExternalLink href={SOURCE.policiesUrl}>políticas de uso de datos</ExternalLink>, que
          este proyecto procura seguir.
        </p>
        <p>
          Cada ciudad es una fotografía tomada en una fecha concreta. Estas son las que usa el sitio y la forma
          de citar cada una:
        </p>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption="Ciudades, fecha de recogida de los datos y cita de la fuente"
            rows={byName}
            rowKey={(city) => city.slug}
            columns={[
              { header: "Ciudad", cell: (city) => city.name },
              { header: "Datos recogidos el", cell: (city) => formatDate(city.snapshot_date) },
              {
                header: "Cita",
                cell: (city) => `Fuente: ${SOURCE.name}, ${city.name}, ${formatMonthLong(city.snapshot_date)}.`,
              },
            ]}
          />
        </div>
        {collection ? (
          <>
            <p>Para una referencia bibliográfica del conjunto:</p>
            <blockquote className="border-l-2 border-axis pl-4 text-ink">
              {SOURCE.name}. ({collection.year}). <cite>Datos de anuncios, calendarios y reseñas de Airbnb de{" "}
              {cities.length} ciudades, {collection.period}</cite> [Conjunto de datos]. {SOURCE.publisher}.{" "}
              {SOURCE.dataUrl}
            </blockquote>
          </>
        ) : null}
      </LegalSection>

      <LegalSection id="modificaciones" title="Qué se ha hecho con esos datos">
        <p>
          La licencia pide indicar los cambios. Las cifras de este sitio no son los datos originales, sino una
          elaboración propia a partir de ellos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Se han limpiado, tipado y deduplicado los registros, y se han marcado los valores atípicos.</li>
          <li>
            Los precios, publicados en la moneda de cada ciudad, se han convertido a dólares con un tipo de
            cambio fijo{publication ? `, el del ${formatDate(publication.fx_as_of)}` : ""}.
          </li>
          <li>
            Se han agregado por ciudad, barrio, tipo de alojamiento, mes y celdas de unos 500 metros. El sitio
            no publica fichas ni identificadores de anuncios.
          </li>
          <li>Se ha entrenado un modelo estadístico de precios, cuyas estimaciones son solo de este proyecto.</li>
        </ul>
        <p>
          <Term>Este sitio no redistribuye los datos originales.</Term> Publica únicamente agregados; quien
          necesite los datos debe obtenerlos de{" "}
          <ExternalLink href={SOURCE.dataUrl}>{SOURCE.name}</ExternalLink>.
        </p>
        <p>
          Citar a {SOURCE.name} como fuente no significa que {SOURCE.name} ni {SOURCE.publisher} respalden
          estos resultados. Los errores de procesamiento o de interpretación son responsabilidad de este
          proyecto. El detalle del proceso está en la{" "}
          <Link href="/metodologia" className="underline underline-offset-2 hover:text-ink">
            metodología
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="mapas" title="Mapas">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Term>Mapa de cada ciudad.</Term> Teselas de{" "}
            <ExternalLink href="https://openfreemap.org/">OpenFreeMap</ExternalLink>, con el esquema de{" "}
            <ExternalLink href="https://openmaptiles.org/">OpenMapTiles</ExternalLink> y datos de ©{" "}
            <ExternalLink href="https://www.openstreetmap.org/copyright">
              colaboradores de OpenStreetMap
            </ExternalLink>{" "}
            (licencia ODbL).
          </li>
          <li>
            <Term>Mapamundi.</Term> Contornos de países de{" "}
            <ExternalLink href="https://www.naturalearthdata.com/">Natural Earth</ExternalLink> (dominio
            público), a escala 1:110 millones.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="software" title="Software">
        <p>El proyecto está construido con software de código abierto. Los componentes principales:</p>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption="Software principal y su licencia"
            rows={SOFTWARE}
            rowKey={(row) => row.name}
            columns={[
              { header: "Componente", cell: (row) => row.name },
              { header: "Uso", cell: (row) => row.use },
              { header: "Licencia", cell: (row) => row.license },
            ]}
          />
        </div>
      </LegalSection>

      <LegalSection id="autoria" title="Autoría y reutilización de este sitio">
        <p>
          El análisis, el código y las visualizaciones son obra de{" "}
          <ExternalLink href={SITE.author.url}>{SITE.author.name}</ExternalLink>. El proyecto nació como
          trabajo en equipo del curso de Big Data de la Universidad Privada Antenor Orrego; esa primera versión
          y su autoría se conservan en el repositorio.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Term>Cifras y gráficos.</Term> Puedes citarlos y reproducirlos indicando la fuente de los datos
            ({SOURCE.name}, con la ciudad y la fecha) y enlazando a este sitio.
          </li>
          <li>
            <Term>Código.</Term> Está publicado en{" "}
            <ExternalLink href={SITE.repository}>GitHub</ExternalLink> para su consulta. El repositorio no
            incluye por ahora una licencia de código abierto: si quieres reutilizarlo,{" "}
            <ExternalLink href={SITE.contact}>escríbeme</ExternalLink>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="marcas" title="Marcas">
        <p>
          Airbnb es una marca de Airbnb, Inc. Aquí se menciona únicamente para identificar la plataforma de la
          que proceden los datos. Este sitio es independiente: no está afiliado a Airbnb, Inc. ni a{" "}
          {SOURCE.name}, ni cuenta con su respaldo.
        </p>
      </LegalSection>

      <p className="text-xs text-muted">
        Última revisión: {formatDate(SITE.legalUpdated)}. Consulta también los{" "}
        <Link href="/terminos" className="underline underline-offset-2 hover:text-ink-2">
          términos de uso
        </Link>
        .
      </p>
    </div>
  );
}
