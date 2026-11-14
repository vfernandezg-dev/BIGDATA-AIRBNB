import type { Metadata } from "next";

import { DataTable } from "@/components/data-table";
import { datasetLabel, formatDate, formatInt, formatPercent } from "@/lib/format";
import { getCities, getListingQuality, getPublication, getStageCounts } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Metodología",
  description: "De dónde salen los datos, cómo se procesan con Spark y Hadoop y qué límites tienen.",
};

const STAGES = [
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
];

export default async function MethodologyPage() {
  const [publication, cities, stageCounts, listingQuality] = await Promise.all([
    getPublication(),
    getCities(),
    getStageCounts(),
    getListingQuality(),
  ]);
  const cityName = new Map(cities.map((city) => [city.slug, city.name]));
  const nameOf = (slug: string) => cityName.get(slug) ?? slug;
  const quality = [...listingQuality].sort((a, b) => nameOf(a.city).localeCompare(nameOf(b.city), "es"));
  const counts = [...stageCounts].sort(
    (a, b) => nameOf(a.city).localeCompare(nameOf(b.city), "es") || a.dataset.localeCompare(b.dataset),
  );

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Metodología</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Este sitio muestra tablas ya calculadas por un pipeline batch sobre Apache Spark y HDFS. Ninguna
          página consulta los datos en bruto: lee agregados pequeños que se actualizan cuando el pipeline
          publica.
          {publication
            ? ` La última publicación es del ${formatDate(publication.published_at)} e incluye ${formatInt(publication.n_listings)} anuncios de ${formatInt(publication.n_cities)} ciudades.`
            : ""}
        </p>
      </header>

      <section aria-labelledby="pipeline" className="max-w-3xl">
        <h2 id="pipeline" className="text-xl font-semibold tracking-tight text-ink">
          Del archivo original a la cifra
        </h2>
        <ol className="mt-4 space-y-4">
          {STAGES.map((stage, index) => (
            <li key={stage.name} className="flex gap-4">
              <span
                aria-hidden
                className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-axis text-xs font-semibold text-ink-2"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">{stage.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{stage.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="calidad">
        <h2 id="calidad" className="text-xl font-semibold tracking-tight text-ink">
          Calidad de los anuncios por ciudad
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          Cuántos anuncios tiene cada ciudad y cuántos quedan fuera de las estadísticas de precio o del modelo.
          Muchos anuncios no publican precio: es una característica de la fuente, no un fallo del proceso.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption="Calidad de los anuncios por ciudad"
            rows={quality}
            rowKey={(row) => row.city}
            columns={[
              { header: "Ciudad", cell: (row) => nameOf(row.city) },
              { header: "Anuncios", align: "right", cell: (row) => formatInt(row.n_listings) },
              {
                header: "Con precio",
                align: "right",
                cell: (row) => `${formatInt(row.n_with_price)} (${formatPercent(row.n_with_price / row.n_listings)})`,
              },
              { header: "Precio atípico", align: "right", cell: (row) => formatInt(row.n_price_outliers) },
              { header: "Fuera de la ciudad", align: "right", cell: (row) => formatInt(row.n_geo_invalid) },
              { header: "Tipo inválido", align: "right", cell: (row) => formatInt(row.n_room_type_invalid) },
              {
                header: "Aptos para el modelo",
                align: "right",
                cell: (row) => `${formatInt(row.n_model_eligible)} (${formatPercent(row.n_model_eligible / row.n_listings)})`,
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="volumen">
        <h2 id="volumen" className="text-xl font-semibold tracking-tight text-ink">
          Filas procesadas en cada etapa
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
          Filas en Bronze (el archivo original) y en Silver (ya limpio). En el calendario las cifras no son
          comparables: Bronze guarda un registro por anuncio y día, y Silver lo resume por anuncio y mes.
        </p>
        <div className="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption="Filas por ciudad, conjunto de datos y etapa"
            rows={counts}
            rowKey={(row) => `${row.city}-${row.dataset}`}
            columns={[
              { header: "Ciudad", cell: (row) => nameOf(row.city) },
              { header: "Datos", cell: (row) => datasetLabel(row.dataset) },
              { header: "Snapshot", align: "right", cell: (row) => formatDate(row.snapshot_date) },
              { header: "Bronze", align: "right", cell: (row) => formatInt(row.bronze_rows) },
              { header: "Silver", align: "right", cell: (row) => formatInt(row.silver_rows) },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="limites" className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
        <h2 id="limites" className="text-xl font-semibold tracking-tight text-ink">
          Qué no dicen estos datos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="font-semibold text-ink">El precio es el anunciado, no el pagado.</strong> No
            incluye descuentos por estancia larga ni refleja todas las tarifas.
          </li>
          <li>
            <strong className="font-semibold text-ink">La ocupación es una estimación.</strong> Inside Airbnb
            la infiere de las reseñas; una noche no disponible en el calendario puede estar reservada o
            simplemente bloqueada.
          </li>
          <li>
            <strong className="font-semibold text-ink">Los precios en dólares usan un tipo de cambio fijo</strong>
            {publication ? `, el del ${formatDate(publication.fx_as_of)}` : ""}, para que las ciudades sean
            comparables entre sí. No reflejan la evolución del cambio.
          </li>
          <li>
            <strong className="font-semibold text-ink">Cada ciudad es una fotografía</strong> tomada en la fecha
            de su snapshot; las fechas difieren unos días entre ciudades.
          </li>
          <li>
            <strong className="font-semibold text-ink">Las ubicaciones son aproximadas.</strong> La fuente
            desplaza las coordenadas de cada anuncio hasta unos 150 metros, y aquí se agregan en celdas de unos
            500 metros.
          </li>
        </ul>
      </section>

      <section aria-labelledby="fuente" className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
        <h2 id="fuente" className="text-xl font-semibold tracking-tight text-ink">
          Fuente y licencia
        </h2>
        <p>
          Los datos proceden de{" "}
          <a href="https://insideairbnb.com/get-the-data/" className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
            Inside Airbnb
          </a>
          , un proyecto independiente que recopila información pública de los anuncios, y se usan bajo la
          licencia{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.es" className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
            Creative Commons Atribución 4.0 Internacional
          </a>
          . Este sitio no publica nombres de anfitriones ni el texto de las reseñas.
        </p>
        <p>
          Es un proyecto académico independiente. No está afiliado a Airbnb, Inc. ni a Inside Airbnb, ni cuenta
          con su respaldo. El mapa base es de{" "}
          <a href="https://openfreemap.org/" className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
            OpenFreeMap
          </a>{" "}
          con datos de OpenStreetMap.
        </p>
      </section>
    </div>
  );
}
