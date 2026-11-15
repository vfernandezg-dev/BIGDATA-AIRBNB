import type { Metadata } from "next";
import Link from "next/link";

import { BarList } from "@/components/bar-list";
import { ChartCard } from "@/components/chart-card";
import { CityBubbleChart } from "@/components/charts/city-bubble-chart";
import { HeatmapChart, type HeatmapCell } from "@/components/charts/heatmap-chart";
import { StackedShareChart } from "@/components/charts/stacked-share-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { WorldMapChart } from "@/components/charts/world-map-chart";
import { DataTable } from "@/components/data-table";
import { StatTile } from "@/components/stat-tile";
import type { Locale } from "@/i18n/config";
import { formatters } from "@/i18n/format";
import { localizeCities } from "@/i18n/labels";
import { commonMessages } from "@/i18n/messages/common";
import { homeMessages } from "@/i18n/messages/home";
import { pageAlternates } from "@/i18n/metadata";
import { pathFor } from "@/i18n/routes";
import { getCities, getReviewsByMonth, getSeasonality, type CitySummary, type SeasonalityCell } from "@/lib/queries";

// Las reseñas anteriores a esta fecha son tan pocas que solo alargan el eje.
const REVIEWS_SINCE = "2015-01-01";

type Seasonality = {
  rows: { slug: string; name: string; deviations: (number | null)[] }[];
  cells: HeatmapCell[];
  years: string;
  /** La ciudad con mayor diferencia entre su mes más alto y el más bajo, y la de menor. */
  mostSeasonal?: { name: string; low: number; lowMonth: string; high: number; highMonth: string };
  steadiest?: string;
};

/** Ordena las ciudades de sur a norte y calcula, por mes, cuánto se aparta cada una de su nivel habitual. */
function buildSeasonality(cities: CitySummary[], data: SeasonalityCell[], months: string[]): Seasonality {
  const byCity = new Map<string, Map<number, number>>();
  for (const cell of data) {
    if (!byCity.has(cell.city)) byCity.set(cell.city, new Map());
    byCity.get(cell.city)?.set(cell.month_of_year, cell.seasonal_index - 1);
  }
  const rows = [...cities]
    .filter((city) => byCity.has(city.slug))
    .sort((a, b) => a.center_lat - b.center_lat)
    .map((city) => ({
      slug: city.slug,
      name: city.name,
      deviations: months.map((_, index) => byCity.get(city.slug)?.get(index + 1) ?? null),
    }));
  const cells = rows.flatMap((row, rowIndex) =>
    row.deviations.flatMap((value, column): HeatmapCell[] => (value === null ? [] : [[column, rowIndex, value]])),
  );

  const ranked = rows
    .map((row) => {
      const values = row.deviations.filter((value): value is number => value !== null);
      const low = Math.min(...values);
      const high = Math.max(...values);
      return {
        name: row.name,
        low,
        high,
        lowMonth: months[row.deviations.indexOf(low)],
        highMonth: months[row.deviations.indexOf(high)],
        spread: high - low,
      };
    })
    .sort((a, b) => b.spread - a.spread);

  const first = data[0];
  return {
    rows,
    cells,
    years: first ? (first.from_year === first.to_year ? `${first.to_year}` : `${first.from_year}–${first.to_year}`) : "",
    mostSeasonal: ranked[0],
    steadiest: ranked.length > 1 ? ranked[ranked.length - 1].name : undefined,
  };
}

export function homeMetadata(lang: Locale): Metadata {
  return { description: commonMessages[lang].site.description, alternates: pageAlternates(lang, "home") };
}

export async function HomeView({ lang }: { lang: Locale }) {
  const [allCities, reviews, seasonalityData] = await Promise.all([getCities(), getReviewsByMonth(), getSeasonality()]);
  const t = homeMessages[lang];
  const fmt = formatters(lang);
  const cities = localizeCities(lang, allCities);

  if (cities.length === 0) {
    return (
      <p className="text-ink-2">
        {t.empty.before}
        <code>publish</code>
        {t.empty.after}
      </p>
    );
  }

  const months = fmt.monthNames();
  const seasonality = buildSeasonality(cities, seasonalityData, months);
  const totalListings = cities.reduce((sum, city) => sum + city.n_listings, 0);
  const totalHosts = cities.reduce((sum, city) => sum + city.n_hosts, 0);
  const totalReviews = cities.reduce((sum, city) => sum + (city.n_reviews_ltm ?? 0), 0);
  const byPrice = [...cities].sort((a, b) => (b.median_price_usd ?? 0) - (a.median_price_usd ?? 0));
  const byMultiListing = [...cities].sort((a, b) => (b.pct_multi_listing ?? 0) - (a.pct_multi_listing ?? 0));
  const byEntireHome = [...cities].sort((a, b) => (b.pct_entire_home ?? 0) - (a.pct_entire_home ?? 0));
  const recentReviews = reviews.filter((row) => row.month >= REVIEWS_SINCE);
  const mostExpensive = byPrice[0];
  const cheapest = byPrice[byPrice.length - 1];
  const countries = new Set(cities.map((city) => city.country)).size;
  const lastMonth = recentReviews.at(-1)?.month;
  const cityHref = (slug: string) => pathFor(lang, "city", slug);
  const bubbles = cities.flatMap((city) =>
    city.median_price_usd === null || city.avg_occupancy_l365d === null
      ? []
      : [{ name: city.name, price: city.median_price_usd, occupancy: city.avg_occupancy_l365d, listings: city.n_listings }],
  );

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title(cities.length)}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">{t.intro}</p>
      </header>

      <section aria-label={t.kpis.label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          label={t.kpis.listings}
          value={fmt.compact(totalListings)}
          hint={t.kpis.listingsHint(fmt.int(totalListings))}
        />
        <StatTile label={t.kpis.cities} value={fmt.int(cities.length)} hint={t.kpis.citiesHint(fmt.int(countries))} />
        <StatTile label={t.kpis.hosts} value={fmt.compact(totalHosts)} hint={t.kpis.hostsHint} />
        <StatTile label={t.kpis.reviews} value={fmt.compact(totalReviews)} hint={t.kpis.reviewsHint} />
      </section>

      <ChartCard
        lang={lang}
        title={t.worldMap.title}
        subtitle={t.worldMap.subtitle}
        footnote={t.worldMap.footnote}
        table={
          <DataTable
            caption={t.worldMap.caption}
            rows={byPrice}
            rowKey={(city) => city.slug}
            columns={[
              {
                header: t.columns.city,
                cell: (city) => (
                  <Link href={cityHref(city.slug)} className="rounded underline underline-offset-2 hover:text-ink">
                    {city.name}
                  </Link>
                ),
              },
              { header: t.columns.country, cell: (city) => city.country },
              { header: t.columns.medianPrice, align: "right", cell: (city) => fmt.usd(city.median_price_usd) },
              { header: t.columns.listings, align: "right", cell: (city) => fmt.int(city.n_listings) },
            ]}
          />
        }
      >
        <WorldMapChart
          label={t.worldMap.chart}
          cities={cities.map((city) => ({
            slug: city.slug,
            name: city.name,
            country: city.country,
            lat: city.center_lat,
            lon: city.center_lon,
            price: city.median_price_usd,
            listings: city.n_listings,
            occupancy: city.avg_occupancy_l365d,
          }))}
        />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.price.title}
          subtitle={t.price.subtitle(
            fmt.usd(cheapest.median_price_usd),
            cheapest.name,
            fmt.usd(mostExpensive.median_price_usd),
            mostExpensive.name,
          )}
          footnote={t.price.footnote}
        >
          <BarList
            rows={byPrice.map((city) => ({
              key: city.slug,
              label: city.name,
              value: city.median_price_usd,
              display: fmt.usd(city.median_price_usd),
              href: cityHref(city.slug),
            }))}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.bubbles.title}
          subtitle={t.bubbles.subtitle}
          footnote={t.bubbles.footnote}
          table={
            <DataTable
              caption={t.bubbles.caption}
              rows={byPrice}
              rowKey={(city) => city.slug}
              columns={[
                { header: t.columns.city, cell: (city) => city.name },
                { header: t.columns.medianPrice, align: "right", cell: (city) => fmt.usd(city.median_price_usd) },
                { header: t.columns.occupancy, align: "right", cell: (city) => fmt.percent(city.avg_occupancy_l365d) },
                { header: t.columns.listings, align: "right", cell: (city) => fmt.int(city.n_listings) },
              ]}
            />
          }
        >
          <CityBubbleChart cities={bubbles} label={t.bubbles.chart} />
        </ChartCard>
      </section>

      <ChartCard
        lang={lang}
        title={t.seasonality.title(seasonality.years)}
        subtitle={
          <>
            {t.seasonality.subtitle}
            {seasonality.mostSeasonal && seasonality.steadiest
              ? t.seasonality.extremes(
                  seasonality.mostSeasonal.name,
                  fmt.signedPercent(seasonality.mostSeasonal.low),
                  seasonality.mostSeasonal.lowMonth,
                  fmt.signedPercent(seasonality.mostSeasonal.high),
                  seasonality.mostSeasonal.highMonth,
                  seasonality.steadiest,
                )
              : ""}
          </>
        }
        footnote={t.seasonality.footnote}
        table={
          <DataTable
            caption={t.seasonality.caption}
            rows={seasonality.rows}
            rowKey={(row) => row.slug}
            columns={[
              { header: t.columns.city, cell: (row) => row.name },
              ...months.map((month, index) => ({
                header: month,
                align: "right" as const,
                cell: (row: Seasonality["rows"][number]) => fmt.signedPercent(row.deviations[index]),
              })),
            ]}
          />
        }
      >
        <HeatmapChart
          scale="diverging"
          rows={seasonality.rows.map((row) => row.name)}
          columns={months}
          cells={seasonality.cells}
          valueLabel={t.seasonality.valueLabel}
          scaleLabels={t.seasonality.scale}
          label={t.seasonality.chart}
        />
      </ChartCard>

      <ChartCard
        lang={lang}
        title={t.reviews.title}
        subtitle={t.reviews.subtitle}
        footnote={lastMonth ? t.reviews.footnote(fmt.month(lastMonth)) : undefined}
        table={
          <DataTable
            caption={t.reviews.caption}
            rows={[...recentReviews].reverse()}
            rowKey={(row) => row.month}
            columns={[
              { header: t.columns.month, cell: (row) => fmt.month(row.month) },
              { header: t.columns.reviews, align: "right", cell: (row) => fmt.int(row.n_reviews) },
            ]}
          />
        }
      >
        <TimeSeriesChart
          data={recentReviews.map((row) => ({ month: row.month, value: row.n_reviews }))}
          valueLabel={t.reviews.valueLabel}
          label={t.reviews.chart}
        />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.roomTypes.title}
          subtitle={t.roomTypes.subtitle}
          table={
            <DataTable
              caption={t.roomTypes.caption}
              rows={byEntireHome}
              rowKey={(city) => city.slug}
              columns={[
                { header: t.columns.city, cell: (city) => city.name },
                { header: t.columns.entireHome, align: "right", cell: (city) => fmt.percent(city.pct_entire_home, 1) },
                { header: t.columns.privateRoom, align: "right", cell: (city) => fmt.percent(city.pct_private_room, 1) },
                {
                  header: t.columns.hotelOrShared,
                  align: "right",
                  cell: (city) => fmt.percent(1 - (city.pct_entire_home ?? 0) - (city.pct_private_room ?? 0), 1),
                },
              ]}
            />
          }
        >
          <StackedShareChart
            label={t.roomTypes.chart}
            series={[
              { name: t.columns.entireHome, color: 0 },
              { name: t.columns.privateRoom, color: 1 },
              { name: t.columns.hotelOrShared, color: "context" },
            ]}
            rows={byEntireHome.map((city) => {
              const entire = city.pct_entire_home ?? 0;
              const privateRoom = city.pct_private_room ?? 0;
              return { label: city.name, shares: [entire, privateRoom, Math.max(0, 1 - entire - privateRoom)] };
            })}
          />
        </ChartCard>

        <ChartCard lang={lang} title={t.multiListing.title} subtitle={t.multiListing.subtitle}>
          <BarList
            max={1}
            rows={byMultiListing.map((city) => ({
              key: city.slug,
              label: city.name,
              value: city.pct_multi_listing,
              display: fmt.percent(city.pct_multi_listing),
              href: cityHref(city.slug),
            }))}
          />
        </ChartCard>
      </section>

      <section aria-labelledby="ciudades">
        <h2 id="ciudades" className="text-xl font-semibold tracking-tight text-ink">
          {t.table.title}
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable<CitySummary>
            caption={t.table.caption}
            rows={cities}
            rowKey={(city) => city.slug}
            columns={[
              {
                header: t.columns.city,
                cell: (city) => (
                  <Link
                    href={cityHref(city.slug)}
                    className="rounded font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {city.name}
                  </Link>
                ),
              },
              { header: t.columns.country, cell: (city) => city.country },
              { header: t.columns.listings, align: "right", cell: (city) => fmt.int(city.n_listings) },
              { header: t.columns.medianPrice, align: "right", cell: (city) => fmt.usd(city.median_price_usd) },
              { header: t.columns.entireHome, align: "right", cell: (city) => fmt.percent(city.pct_entire_home) },
              { header: t.columns.occupancy, align: "right", cell: (city) => fmt.percent(city.avg_occupancy_l365d) },
              { header: t.columns.rating, align: "right", cell: (city) => fmt.decimal(city.avg_rating, 2) },
              { header: t.columns.snapshot, align: "right", cell: (city) => fmt.date(city.snapshot_date) },
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{t.table.footnote}</p>
      </section>
    </div>
  );
}
