import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BarList } from "@/components/bar-list";
import { ChartCard } from "@/components/chart-card";
import { ColumnChart } from "@/components/charts/column-chart";
import { HeatmapChart, type HeatmapCell } from "@/components/charts/heatmap-chart";
import { NeighbourhoodScatterChart } from "@/components/charts/neighbourhood-scatter-chart";
import { PriceRangeChart } from "@/components/charts/price-range-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CityMap } from "@/components/city-map";
import { DataTable } from "@/components/data-table";
import { DivergingBars } from "@/components/diverging-bars";
import { SegmentedBar, type Segment } from "@/components/segmented-bar";
import { StatTile } from "@/components/stat-tile";
import {
  formatDate,
  formatDecimal,
  formatInt,
  formatMonth,
  formatPercent,
  formatUsd,
  monthNames,
  roomTypeLabel,
} from "@/lib/format";
import {
  getCities,
  getCityAvailability,
  getCityReviews,
  getHostConcentration,
  getMapGrid,
  getNeighbourhoods,
  getPriceHistogram,
  getRoomTypes,
  type MonthlyReviews,
  type Neighbourhood,
} from "@/lib/queries";

// Debe coincidir con `gold.map_cell_degrees` del pipeline (conf/pipeline.yaml).
const MAP_CELL_DEGREES = 0.005;
const REVIEWS_SINCE = "2015-01-01";
const REVIEW_YEARS_IN_HEATMAP = 8;
const TOP_NEIGHBOURHOODS = 12;
const TOP_PRICE_INDEX = 6;

// El color sigue al tipo de alojamiento, no a su posición: es el mismo en todas las ciudades y en todos
// los gráficos (reparto y rango de precios).
const ROOM_TYPE_SLOT: Record<string, 0 | 1 | 2 | 3> = {
  "Entire home/apt": 0,
  "Private room": 1,
  "Hotel room": 2,
  "Shared room": 3,
};
const SLOT_TOKEN: Segment["color"][] = ["series-1", "series-2", "series-3", "series-4"];

type CityPageProps = PageProps<"/ciudad/[slug]">;

// Con Cache Components, generateStaticParams debe devolver al menos una ruta. Si todavía no hay datos
// publicados se pre-renderiza esta, que no corresponde a ninguna ciudad y muestra "no encontrada".
const NO_DATA_SLUG = "sin-datos";

export async function generateStaticParams() {
  const cities = await getCities();
  return cities.length > 0 ? cities.map((city) => ({ slug: city.slug })) : [{ slug: NO_DATA_SLUG }];
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const city = (await getCities()).find((candidate) => candidate.slug === slug);
  if (!city) return { title: "Ciudad no encontrada" };
  return {
    title: city.name,
    description: `Precios, barrios, tipos de alojamiento y demanda del alquiler turístico en ${city.name} (${city.country}).`,
  };
}

/** Reseñas de los últimos años como rejilla año × mes: deja ver a la vez la estacionalidad y el crecimiento. */
function reviewsByYearAndMonth(reviews: MonthlyReviews[]): { years: string[]; cells: HeatmapCell[] } {
  const lastYear = Number(reviews.at(-1)?.month.slice(0, 4));
  if (!lastYear) return { years: [], cells: [] };
  const years = Array.from({ length: REVIEW_YEARS_IN_HEATMAP }, (_, index) => String(lastYear - index));
  const cells = reviews.flatMap((row): HeatmapCell[] => {
    const yearIndex = years.indexOf(row.month.slice(0, 4));
    return yearIndex === -1 ? [] : [[Number(row.month.slice(5, 7)) - 1, yearIndex, row.n_reviews]];
  });
  return { years, cells };
}

/**
 * Las doce ciudades se pre-renderizan al construir el sitio. `params` se lee dentro de <Suspense> porque,
 * cuando la página se regenera tras publicar datos nuevos, Next lo trata como un dato de la petición.
 */
export default function CityPage({ params }: CityPageProps) {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-muted">Cargando la ciudad…</p>}>
      <CityContent params={params} />
    </Suspense>
  );
}

async function CityContent({ params }: Pick<CityPageProps, "params">) {
  const { slug } = await params;
  const cities = await getCities();
  // La lista de ciudades está en caché: un slug inventado se descarta aquí, sin consultar nada más.
  const city = cities.find((candidate) => candidate.slug === slug);
  if (!city) notFound();

  const [roomTypes, histogram, neighbourhoods, cells, reviews, availability, hosts] = await Promise.all([
    getRoomTypes(slug),
    getPriceHistogram(slug),
    getNeighbourhoods(slug),
    getMapGrid(slug),
    getCityReviews(slug),
    getCityAvailability(slug),
    getHostConcentration(slug),
  ]);

  const months = monthNames();
  const priced = neighbourhoods.filter((item) => item.median_price_usd !== null);
  const mostExpensive = [...priced]
    .sort((a, b) => (b.median_price_usd ?? 0) - (a.median_price_usd ?? 0))
    .slice(0, TOP_NEIGHBOURHOODS);
  const withIndex = neighbourhoods.filter((item) => item.price_index !== null);
  const byIndex = [...withIndex].sort((a, b) => (b.price_index ?? 1) - (a.price_index ?? 1));
  const indexExtremes =
    byIndex.length > TOP_PRICE_INDEX * 2
      ? [...byIndex.slice(0, TOP_PRICE_INDEX), ...byIndex.slice(-TOP_PRICE_INDEX)]
      : byIndex;
  const recentReviews = reviews.filter((row) => row.month >= REVIEWS_SINCE);
  const reviewGrid = reviewsByYearAndMonth(reviews);
  const totalHostListings = hosts.reduce((sum, bucket) => sum + bucket.n_listings, 0);
  const lastBucket = histogram.at(-1);
  const priceRanges = roomTypes.flatMap((row) =>
    row.p25_price_usd === null || row.median_price_usd === null || row.p75_price_usd === null
      ? []
      : [
          {
            label: roomTypeLabel(row.room_type),
            p25: row.p25_price_usd,
            median: row.median_price_usd,
            p75: row.p75_price_usd,
            color: ROOM_TYPE_SLOT[row.room_type] ?? 3,
          },
        ],
  );
  const neighbourhoodPoints = priced.map((item) => ({
    name: item.neighbourhood,
    listings: item.n_listings,
    price: item.median_price_usd ?? 0,
    rating: item.avg_rating,
  }));

  return (
    <div className="space-y-8">
      <nav aria-label="Ciudades" className="text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {cities.map((candidate) => (
            <li key={candidate.slug}>
              {candidate.slug === slug ? (
                <span aria-current="page" className="font-semibold text-ink">
                  {candidate.name}
                </span>
              ) : (
                <Link
                  href={`/ciudad/${candidate.slug}`}
                  className="rounded text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                >
                  {candidate.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <header className="max-w-3xl">
        <p className="text-sm text-ink-2">{city.country}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{city.name}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Snapshot del {formatDate(city.snapshot_date)}. Los precios se publican en {city.currency ?? "moneda local"} y
          aquí se muestran en dólares.
        </p>
      </header>

      <section aria-label="Cifras principales" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          label="Precio mediano por noche"
          value={formatUsd(city.median_price_usd)}
          hint={`La mitad central de los anuncios cuesta entre ${formatUsd(city.p25_price_usd)} y ${formatUsd(city.p75_price_usd)}.`}
        />
        <StatTile
          label="Anuncios"
          value={formatInt(city.n_listings)}
          hint={`${formatInt(city.n_priced)} con precio publicado · ${formatInt(city.n_hosts)} anfitriones.`}
        />
        <StatTile
          label="Ocupación estimada"
          value={formatPercent(city.avg_occupancy_l365d)}
          hint="Noches reservadas en los últimos 12 meses, estimadas por Inside Airbnb a partir de las reseñas."
        />
        <StatTile
          label="Valoración media"
          value={formatDecimal(city.avg_rating, 2)}
          hint={`Sobre 5. ${formatInt(city.n_reviews_ltm)} reseñas en los últimos 12 meses.`}
        />
      </section>

      <ChartCard
        title="Dónde están los alojamientos más caros"
        subtitle="El mapa de calor resalta las zonas donde se concentran los precios por encima de la mediana de la ciudad: cuanto más intenso el color, más caros los alojamientos de esa zona. La vista por celdas muestra el precio mediano de cada cuadrícula de unos 500 metros."
        footnote="Para acercar el mapa, mantén pulsada la tecla Ctrl mientras desplazas, o usa dos dedos. En la vista por celdas, pasa el cursor por una celda para ver su precio; cada color agrupa una quinta parte de las celdas."
      >
        <CityMap
          cells={cells}
          cellDegrees={MAP_CELL_DEGREES}
          cityName={city.name}
          bounds={{ minLat: city.min_lat, maxLat: city.max_lat, minLon: city.min_lon, maxLon: city.max_lon }}
        />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Distribución de precios"
          subtitle="Número de anuncios por tramo de precio por noche, en dólares."
          footnote={
            lastBucket && lastBucket.bucket_to_usd === null
              ? `El último tramo agrupa todos los anuncios de ${formatUsd(lastBucket.bucket_from_usd)} o más.`
              : undefined
          }
          table={
            <DataTable
              caption="Anuncios por tramo de precio"
              rows={histogram}
              rowKey={(row) => String(row.bucket_from_usd)}
              columns={[
                {
                  header: "Precio por noche",
                  cell: (row) =>
                    row.bucket_to_usd === null
                      ? `${formatUsd(row.bucket_from_usd)} o más`
                      : `${formatUsd(row.bucket_from_usd)} – ${formatInt(row.bucket_to_usd)}`,
                },
                { header: "Anuncios", align: "right", cell: (row) => formatInt(row.n_listings) },
              ]}
            />
          }
        >
          <ColumnChart
            valueFormat="int"
            valueLabel="anuncios"
            label="Histograma: número de anuncios por tramo de precio por noche"
            data={histogram.map((row) => ({
              tick: row.bucket_to_usd === null ? `${row.bucket_from_usd}+` : String(row.bucket_from_usd),
              label:
                row.bucket_to_usd === null
                  ? `${formatUsd(row.bucket_from_usd)} o más`
                  : `De ${formatUsd(row.bucket_from_usd)} a ${formatInt(row.bucket_to_usd)}`,
              value: row.n_listings,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Qué se alquila y a qué precio"
          subtitle="Reparto de los anuncios por tipo de alojamiento y, debajo, el rango de precios de cada uno: la barra cubre la mitad central de los anuncios y la marca señala la mediana."
          table={
            <DataTable
              caption="Tipos de alojamiento"
              rows={roomTypes}
              rowKey={(row) => row.room_type}
              columns={[
                { header: "Tipo", cell: (row) => roomTypeLabel(row.room_type) },
                { header: "Anuncios", align: "right", cell: (row) => formatInt(row.n_listings) },
                { header: "Cuota", align: "right", cell: (row) => formatPercent(row.listings_share, 1) },
                { header: "Percentil 25", align: "right", cell: (row) => formatUsd(row.p25_price_usd) },
                { header: "Mediana", align: "right", cell: (row) => formatUsd(row.median_price_usd) },
                { header: "Percentil 75", align: "right", cell: (row) => formatUsd(row.p75_price_usd) },
                { header: "Capacidad media", align: "right", cell: (row) => formatDecimal(row.avg_accommodates) },
              ]}
            />
          }
        >
          <SegmentedBar
            unit="anuncios"
            segments={roomTypes.map((row) => ({
              key: row.room_type,
              label: roomTypeLabel(row.room_type),
              value: row.n_listings,
              color: SLOT_TOKEN[ROOM_TYPE_SLOT[row.room_type] ?? 3],
            }))}
          />
          <div className="mt-5">
            <PriceRangeChart
              ranges={priceRanges}
              label="Rango de precios por tipo de alojamiento: del percentil 25 al 75, con la mediana"
            />
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Los barrios más caros"
          subtitle={`Precio mediano por noche de los ${mostExpensive.length} barrios con el precio más alto.`}
          table={<NeighbourhoodTable rows={neighbourhoods} />}
        >
          <BarList
            rows={mostExpensive.map((item) => ({
              key: item.neighbourhood,
              label: item.neighbourhood,
              value: item.median_price_usd,
              display: formatUsd(item.median_price_usd),
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Barrios que cobran más o menos de lo esperable"
          subtitle="Precio real dividido por el que predice el modelo para anuncios con las mismas características. Por encima de 1, el barrio cobra un sobreprecio; por debajo, es más barato de lo que sus alojamientos harían esperar."
          footnote={
            <>
              Es una lectura del error del modelo, no una tasación. Cómo se calcula:{" "}
              <Link href="/modelo" className="underline underline-offset-2 hover:text-ink-2">
                modelo de precios
              </Link>
              .
            </>
          }
        >
          {indexExtremes.length > 0 ? (
            <DivergingBars
              lowLabel="Más barato de lo esperable"
              highLabel="Más caro de lo esperable"
              rows={indexExtremes.map((item) => ({
                key: item.neighbourhood,
                label: item.neighbourhood,
                deviation: (item.price_index ?? 1) - 1,
                display: formatDecimal(item.price_index, 2),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">El modelo de precios aún no se ha entrenado para esta ciudad.</p>
          )}
        </ChartCard>
      </section>

      <ChartCard
        title="Oferta frente a precio, barrio a barrio"
        subtitle="Cada punto es un barrio: hacia la derecha tiene más anuncios; hacia arriba, es más caro. Arriba a la izquierda quedan los barrios caros con poca oferta; abajo a la derecha, los que tienen mucha oferta y precios bajos."
        footnote="Se etiquetan los barrios con más anuncios y los más caros; el resto, al pasar el cursor. Las cifras de todos los barrios están en la tabla de «Los barrios más caros»."
      >
        <NeighbourhoodScatterChart
          points={neighbourhoodPoints}
          label="Dispersión: número de anuncios frente a precio mediano por barrio"
        />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Reseñas por mes"
          subtitle="Cada reseña corresponde a una estancia terminada: su ritmo aproxima la demanda."
          table={
            <DataTable
              caption="Reseñas por mes"
              rows={[...recentReviews].reverse()}
              rowKey={(row) => row.month}
              columns={[
                { header: "Mes", cell: (row) => formatMonth(row.month) },
                { header: "Reseñas", align: "right", cell: (row) => formatInt(row.n_reviews) },
              ]}
            />
          }
        >
          <TimeSeriesChart
            data={recentReviews.map((row) => ({ month: row.month, value: row.n_reviews }))}
            valueLabel="reseñas"
            label={`Serie temporal: reseñas por mes en ${city.name}`}
          />
        </ChartCard>

        <ChartCard
          title="Reseñas por año y mes"
          subtitle="Las mismas reseñas, en rejilla: de arriba abajo se ve el crecimiento de un año a otro; de izquierda a derecha, los meses fuertes y flojos."
          footnote="Las celdas en blanco son meses sin datos; el último mes con datos está incompleto."
        >
          <HeatmapChart
            scale="sequential"
            rows={reviewGrid.years}
            columns={months}
            cells={reviewGrid.cells}
            valueLabel="reseñas"
            scaleLabels={["Menos reseñas", "Más reseñas"]}
            label={`Mapa de calor: reseñas por año y mes en ${city.name}`}
          />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Disponibilidad en los próximos meses"
          subtitle="Porcentaje de noches que los calendarios muestran libres. Una noche no disponible puede estar reservada o bloqueada por el anfitrión."
          table={
            <DataTable
              caption="Disponibilidad por mes"
              rows={availability}
              rowKey={(row) => row.month}
              columns={[
                { header: "Mes", cell: (row) => formatMonth(row.month) },
                { header: "Noches libres", align: "right", cell: (row) => formatPercent(row.availability_rate, 1) },
                { header: "Anuncios", align: "right", cell: (row) => formatInt(row.n_listings) },
              ]}
            />
          }
        >
          <ColumnChart
            valueFormat="percent"
            valueLabel="de noches libres"
            fixedMax={1}
            label="Columnas: porcentaje de noches libres por mes"
            data={availability.map((row) => ({
              tick: formatMonth(row.month).split(" ")[0],
              label: formatMonth(row.month),
              value: row.availability_rate ?? 0,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Quién ofrece los alojamientos"
          subtitle="Anuncios según cuántos gestiona su anfitrión en la ciudad. Los tramos altos corresponden a operadores profesionales."
          table={
            <DataTable
              caption="Concentración de anfitriones"
              rows={hosts}
              rowKey={(row) => String(row.bucket_order)}
              columns={[
                { header: "Anuncios por anfitrión", cell: (row) => row.bucket_label },
                { header: "Anfitriones", align: "right", cell: (row) => formatInt(row.n_hosts) },
                { header: "Anuncios", align: "right", cell: (row) => formatInt(row.n_listings) },
              ]}
            />
          }
        >
          <BarList
            rows={hosts.map((bucket) => ({
              key: String(bucket.bucket_order),
              label: bucket.bucket_label === "1" ? "1 anuncio" : `${bucket.bucket_label} anuncios`,
              value: bucket.n_listings,
              display: `${formatInt(bucket.n_listings)} (${formatPercent(totalHostListings > 0 ? bucket.n_listings / totalHostListings : 0)})`,
            }))}
          />
        </ChartCard>
      </section>
    </div>
  );
}

function NeighbourhoodTable({ rows }: { rows: Neighbourhood[] }) {
  return (
    <DataTable
      caption="Barrios"
      rows={rows}
      rowKey={(row) => row.neighbourhood}
      columns={[
        { header: "Barrio", cell: (row) => row.neighbourhood },
        { header: "Anuncios", align: "right", cell: (row) => formatInt(row.n_listings) },
        { header: "Precio mediano", align: "right", cell: (row) => formatUsd(row.median_price_usd) },
        { header: "Frente a la ciudad", align: "right", cell: (row) => formatDecimal(row.price_vs_city, 2) },
        { header: "Vivienda completa", align: "right", cell: (row) => formatPercent(row.pct_entire_home) },
        { header: "Valoración", align: "right", cell: (row) => formatDecimal(row.avg_rating, 2) },
        { header: "Segmento", align: "right", cell: (row) => (row.segment === null ? "—" : String(row.segment)) },
      ]}
    />
  );
}
