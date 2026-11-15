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
import type { Locale } from "@/i18n/config";
import { formatters, type Formatters } from "@/i18n/format";
import { localizeCities, roomTypeLabel } from "@/i18n/labels";
import { cityMessages, type CityMessages } from "@/i18n/messages/city";
import { pageAlternates } from "@/i18n/metadata";
import { pathFor } from "@/i18n/routes";
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

/** Los parámetros de la ruta, iguales en los dos idiomas (`/es/ciudad/[slug]` y `/en/city/[slug]`). */
type CityParams = Promise<{ slug: string }>;

// Con Cache Components, generateStaticParams debe devolver al menos una ruta. Si todavía no hay datos
// publicados se pre-renderiza esta, que no corresponde a ninguna ciudad y muestra "no encontrada".
const NO_DATA_SLUG = "sin-datos";

export async function cityStaticParams() {
  const cities = await getCities();
  return cities.length > 0 ? cities.map((city) => ({ slug: city.slug })) : [{ slug: NO_DATA_SLUG }];
}

export async function cityMetadata(lang: Locale, params: CityParams): Promise<Metadata> {
  const { slug } = await params;
  const t = cityMessages[lang];
  const city = localizeCities(lang, await getCities()).find((candidate) => candidate.slug === slug);
  if (!city) return { title: t.notFoundTitle };
  return {
    title: city.name,
    description: t.description(city.name, city.country),
    alternates: pageAlternates(lang, "city", slug),
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
export function CityView({ lang, params }: { lang: Locale; params: CityParams }) {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-muted">{cityMessages[lang].loading}</p>}>
      <CityContent lang={lang} params={params} />
    </Suspense>
  );
}

async function CityContent({ lang, params }: { lang: Locale; params: CityParams }) {
  const { slug } = await params;
  const cities = localizeCities(lang, await getCities());
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

  const t = cityMessages[lang];
  const fmt = formatters(lang);
  const months = fmt.monthNames();
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
            label: roomTypeLabel(lang, row.room_type),
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
      <nav aria-label={t.citiesNav} className="text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {cities.map((candidate) => (
            <li key={candidate.slug}>
              {candidate.slug === slug ? (
                <span aria-current="page" className="font-semibold text-ink">
                  {candidate.name}
                </span>
              ) : (
                <Link
                  href={pathFor(lang, "city", candidate.slug)}
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
        <p className="mt-3 leading-relaxed text-ink-2">{t.intro(fmt.date(city.snapshot_date), city.currency)}</p>
      </header>

      <section aria-label={t.kpis.label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          label={t.kpis.medianPrice}
          value={fmt.usd(city.median_price_usd)}
          hint={t.kpis.medianPriceHint(fmt.usd(city.p25_price_usd), fmt.usd(city.p75_price_usd))}
        />
        <StatTile
          label={t.kpis.listings}
          value={fmt.int(city.n_listings)}
          hint={t.kpis.listingsHint(fmt.int(city.n_priced), fmt.int(city.n_hosts))}
        />
        <StatTile
          label={t.kpis.occupancy}
          value={fmt.percent(city.avg_occupancy_l365d)}
          hint={t.kpis.occupancyHint}
        />
        <StatTile
          label={t.kpis.rating}
          value={fmt.decimal(city.avg_rating, 2)}
          hint={t.kpis.ratingHint(fmt.int(city.n_reviews_ltm))}
        />
      </section>

      <ChartCard lang={lang} title={t.map.title} subtitle={t.map.subtitle} footnote={t.map.footnote}>
        <CityMap
          cells={cells}
          cellDegrees={MAP_CELL_DEGREES}
          cityName={city.name}
          bounds={{ minLat: city.min_lat, maxLat: city.max_lat, minLon: city.min_lon, maxLon: city.max_lon }}
        />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.histogram.title}
          subtitle={t.histogram.subtitle}
          footnote={
            lastBucket && lastBucket.bucket_to_usd === null
              ? t.histogram.footnote(fmt.usd(lastBucket.bucket_from_usd))
              : undefined
          }
          table={
            <DataTable
              caption={t.histogram.caption}
              rows={histogram}
              rowKey={(row) => String(row.bucket_from_usd)}
              columns={[
                {
                  header: t.histogram.priceColumn,
                  cell: (row) =>
                    row.bucket_to_usd === null
                      ? t.histogram.orMore(fmt.usd(row.bucket_from_usd))
                      : `${fmt.usd(row.bucket_from_usd)} – ${fmt.int(row.bucket_to_usd)}`,
                },
                { header: t.histogram.listingsColumn, align: "right", cell: (row) => fmt.int(row.n_listings) },
              ]}
            />
          }
        >
          <ColumnChart
            valueFormat="int"
            valueLabel={t.histogram.valueLabel}
            label={t.histogram.chart}
            data={histogram.map((row) => ({
              tick: row.bucket_to_usd === null ? `${row.bucket_from_usd}+` : String(row.bucket_from_usd),
              label:
                row.bucket_to_usd === null
                  ? t.histogram.orMore(fmt.usd(row.bucket_from_usd))
                  : t.histogram.range(fmt.usd(row.bucket_from_usd), fmt.int(row.bucket_to_usd)),
              value: row.n_listings,
            }))}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.roomTypes.title}
          subtitle={t.roomTypes.subtitle}
          table={
            <DataTable
              caption={t.roomTypes.caption}
              rows={roomTypes}
              rowKey={(row) => row.room_type}
              columns={[
                { header: t.roomTypes.columns.type, cell: (row) => roomTypeLabel(lang, row.room_type) },
                { header: t.roomTypes.columns.listings, align: "right", cell: (row) => fmt.int(row.n_listings) },
                { header: t.roomTypes.columns.share, align: "right", cell: (row) => fmt.percent(row.listings_share, 1) },
                { header: t.roomTypes.columns.p25, align: "right", cell: (row) => fmt.usd(row.p25_price_usd) },
                { header: t.roomTypes.columns.median, align: "right", cell: (row) => fmt.usd(row.median_price_usd) },
                { header: t.roomTypes.columns.p75, align: "right", cell: (row) => fmt.usd(row.p75_price_usd) },
                { header: t.roomTypes.columns.capacity, align: "right", cell: (row) => fmt.decimal(row.avg_accommodates) },
              ]}
            />
          }
        >
          <SegmentedBar
            lang={lang}
            unit={t.roomTypes.unit}
            segments={roomTypes.map((row) => ({
              key: row.room_type,
              label: roomTypeLabel(lang, row.room_type),
              value: row.n_listings,
              color: SLOT_TOKEN[ROOM_TYPE_SLOT[row.room_type] ?? 3],
            }))}
          />
          <div className="mt-5">
            <PriceRangeChart ranges={priceRanges} label={t.roomTypes.chart} />
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.topNeighbourhoods.title}
          subtitle={t.topNeighbourhoods.subtitle(mostExpensive.length)}
          table={<NeighbourhoodTable rows={neighbourhoods} t={t} fmt={fmt} />}
        >
          <BarList
            rows={mostExpensive.map((item) => ({
              key: item.neighbourhood,
              label: item.neighbourhood,
              value: item.median_price_usd,
              display: fmt.usd(item.median_price_usd),
            }))}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.priceIndex.title}
          subtitle={t.priceIndex.subtitle}
          footnote={
            <>
              {t.priceIndex.footnote}{" "}
              <Link href={pathFor(lang, "model")} className="underline underline-offset-2 hover:text-ink-2">
                {t.priceIndex.modelLink}
              </Link>
              .
            </>
          }
        >
          {indexExtremes.length > 0 ? (
            <DivergingBars
              lang={lang}
              lowLabel={t.priceIndex.low}
              highLabel={t.priceIndex.high}
              rows={indexExtremes.map((item) => ({
                key: item.neighbourhood,
                label: item.neighbourhood,
                deviation: (item.price_index ?? 1) - 1,
                display: fmt.decimal(item.price_index, 2),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t.priceIndex.empty}</p>
          )}
        </ChartCard>
      </section>

      <ChartCard lang={lang} title={t.scatter.title} subtitle={t.scatter.subtitle} footnote={t.scatter.footnote}>
        <NeighbourhoodScatterChart points={neighbourhoodPoints} label={t.scatter.chart} />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.reviews.title}
          subtitle={t.reviews.subtitle}
          table={
            <DataTable
              caption={t.reviews.caption}
              rows={[...recentReviews].reverse()}
              rowKey={(row) => row.month}
              columns={[
                { header: t.reviews.month, cell: (row) => fmt.month(row.month) },
                { header: t.reviews.reviews, align: "right", cell: (row) => fmt.int(row.n_reviews) },
              ]}
            />
          }
        >
          <TimeSeriesChart
            data={recentReviews.map((row) => ({ month: row.month, value: row.n_reviews }))}
            valueLabel={t.reviews.valueLabel}
            label={t.reviews.chart(city.name)}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.reviewGrid.title}
          subtitle={t.reviewGrid.subtitle}
          footnote={t.reviewGrid.footnote}
        >
          <HeatmapChart
            scale="sequential"
            rows={reviewGrid.years}
            columns={months}
            cells={reviewGrid.cells}
            valueLabel={t.reviewGrid.valueLabel}
            scaleLabels={t.reviewGrid.scale}
            label={t.reviewGrid.chart(city.name)}
          />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.availability.title}
          subtitle={t.availability.subtitle}
          table={
            <DataTable
              caption={t.availability.caption}
              rows={availability}
              rowKey={(row) => row.month}
              columns={[
                { header: t.availability.month, cell: (row) => fmt.month(row.month) },
                {
                  header: t.availability.freeNights,
                  align: "right",
                  cell: (row) => fmt.percent(row.availability_rate, 1),
                },
                { header: t.availability.listings, align: "right", cell: (row) => fmt.int(row.n_listings) },
              ]}
            />
          }
        >
          <ColumnChart
            valueFormat="percent"
            valueLabel={t.availability.valueLabel}
            fixedMax={1}
            label={t.availability.chart}
            data={availability.map((row) => ({
              tick: fmt.month(row.month).split(" ")[0],
              label: fmt.month(row.month),
              value: row.availability_rate ?? 0,
            }))}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.hosts.title}
          subtitle={t.hosts.subtitle}
          table={
            <DataTable
              caption={t.hosts.caption}
              rows={hosts}
              rowKey={(row) => String(row.bucket_order)}
              columns={[
                { header: t.hosts.perHost, cell: (row) => row.bucket_label },
                { header: t.hosts.hosts, align: "right", cell: (row) => fmt.int(row.n_hosts) },
                { header: t.hosts.listings, align: "right", cell: (row) => fmt.int(row.n_listings) },
              ]}
            />
          }
        >
          <BarList
            rows={hosts.map((bucket) => ({
              key: String(bucket.bucket_order),
              label: t.hosts.bucket(bucket.bucket_label),
              value: bucket.n_listings,
              display: `${fmt.int(bucket.n_listings)} (${fmt.percent(totalHostListings > 0 ? bucket.n_listings / totalHostListings : 0)})`,
            }))}
          />
        </ChartCard>
      </section>
    </div>
  );
}

function NeighbourhoodTable({ rows, t, fmt }: { rows: Neighbourhood[]; t: CityMessages; fmt: Formatters }) {
  const columns = t.topNeighbourhoods.columns;
  return (
    <DataTable
      caption={t.topNeighbourhoods.caption}
      rows={rows}
      rowKey={(row) => row.neighbourhood}
      columns={[
        { header: columns.neighbourhood, cell: (row) => row.neighbourhood },
        { header: columns.listings, align: "right", cell: (row) => fmt.int(row.n_listings) },
        { header: columns.medianPrice, align: "right", cell: (row) => fmt.usd(row.median_price_usd) },
        { header: columns.versusCity, align: "right", cell: (row) => fmt.decimal(row.price_vs_city, 2) },
        { header: columns.entireHome, align: "right", cell: (row) => fmt.percent(row.pct_entire_home) },
        { header: columns.rating, align: "right", cell: (row) => fmt.decimal(row.avg_rating, 2) },
        { header: columns.segment, align: "right", cell: (row) => (row.segment === null ? "—" : String(row.segment)) },
      ]}
    />
  );
}
