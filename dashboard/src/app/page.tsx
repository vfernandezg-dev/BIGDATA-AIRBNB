import Link from "next/link";

import { BarList } from "@/components/bar-list";
import { ChartCard } from "@/components/chart-card";
import { CityBubbleChart } from "@/components/charts/city-bubble-chart";
import { HeatmapChart, type HeatmapCell } from "@/components/charts/heatmap-chart";
import { StackedShareChart } from "@/components/charts/stacked-share-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DataTable } from "@/components/data-table";
import { StatTile } from "@/components/stat-tile";
import {
  formatCompact,
  formatDate,
  formatDecimal,
  formatInt,
  formatMonth,
  formatPercent,
  formatSignedPercent,
  formatUsd,
  monthNames,
} from "@/lib/format";
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

export default async function OverviewPage() {
  const [cities, reviews, seasonalityData] = await Promise.all([getCities(), getReviewsByMonth(), getSeasonality()]);

  if (cities.length === 0) {
    return (
      <p className="text-ink-2">
        Todavía no hay datos publicados. Ejecuta el pipeline y su etapa <code>publish</code>.
      </p>
    );
  }

  const months = monthNames();
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
  const bubbles = cities.flatMap((city) =>
    city.median_price_usd === null || city.avg_occupancy_l365d === null
      ? []
      : [{ name: city.name, price: city.median_price_usd, occupancy: city.avg_occupancy_l365d, listings: city.n_listings }],
  );

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          El alquiler turístico en {cities.length} ciudades
        </h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Cuánto cuesta una noche, quién ofrece los alojamientos y cómo ha evolucionado la demanda, según el
          último snapshot de Inside Airbnb de cada ciudad. Elige una ciudad para ver su mapa de precios, sus
          barrios y su estacionalidad.
        </p>
      </header>

      <section aria-label="Cifras principales" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          label="Anuncios analizados"
          value={formatCompact(totalListings)}
          hint={`${formatInt(totalListings)} anuncios activos en el último snapshot de cada ciudad.`}
        />
        <StatTile label="Ciudades" value={formatInt(cities.length)} hint={`En ${formatInt(countries)} países.`} />
        <StatTile
          label="Anfitriones"
          value={formatCompact(totalHosts)}
          hint="Suma de anfitriones distintos por ciudad."
        />
        <StatTile
          label="Reseñas en 12 meses"
          value={formatCompact(totalReviews)}
          hint="La mejor señal pública de cuánto se reserva."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Precio mediano por noche"
          subtitle={`De ${formatUsd(cheapest.median_price_usd)} en ${cheapest.name} a ${formatUsd(mostExpensive.median_price_usd)} en ${mostExpensive.name}. En dólares, para poder comparar.`}
          footnote="Mediana de los anuncios con precio publicado, sin valores atípicos (fuera de los percentiles 1 y 99 de cada ciudad)."
        >
          <BarList
            rows={byPrice.map((city) => ({
              key: city.slug,
              label: city.name,
              value: city.median_price_usd,
              display: formatUsd(city.median_price_usd),
              href: `/ciudad/${city.slug}`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Precio frente a ocupación"
          subtitle="Cada burbuja es una ciudad. Hacia la derecha, más cara; hacia arriba, más noches reservadas."
          footnote="El área de la burbuja indica el número de anuncios. La ocupación es la estimación de Inside Airbnb para los últimos 12 meses."
          table={
            <DataTable
              caption="Precio, ocupación y anuncios por ciudad"
              rows={byPrice}
              rowKey={(city) => city.slug}
              columns={[
                { header: "Ciudad", cell: (city) => city.name },
                { header: "Precio mediano", align: "right", cell: (city) => formatUsd(city.median_price_usd) },
                { header: "Ocupación estimada", align: "right", cell: (city) => formatPercent(city.avg_occupancy_l365d) },
                { header: "Anuncios", align: "right", cell: (city) => formatInt(city.n_listings) },
              ]}
            />
          }
        >
          <CityBubbleChart cities={bubbles} label="Burbujas: precio mediano frente a ocupación estimada por ciudad" />
        </ChartCard>
      </section>

      <ChartCard
        title={`Estacionalidad: cuándo se reserva más en cada ciudad (${seasonality.years})`}
        subtitle={
          <>
            Reseñas de cada mes frente al nivel habitual de la ciudad en ese momento. En rojo, temporada alta; en
            azul, temporada baja. Ciudades ordenadas de sur a norte.
            {seasonality.mostSeasonal && seasonality.steadiest
              ? ` La más estacional es ${seasonality.mostSeasonal.name} (de ${formatSignedPercent(seasonality.mostSeasonal.low)} en ${seasonality.mostSeasonal.lowMonth} a ${formatSignedPercent(seasonality.mostSeasonal.high)} en ${seasonality.mostSeasonal.highMonth}); la más estable, ${seasonality.steadiest}.`
              : ""}
          </>
        }
        footnote="El nivel habitual es la media de los doce meses que rodean a cada mes, para descontar el crecimiento de un año a otro."
        table={
          <DataTable
            caption="Desviación mensual de las reseñas respecto al nivel habitual, por ciudad"
            rows={seasonality.rows}
            rowKey={(row) => row.slug}
            columns={[
              { header: "Ciudad", cell: (row) => row.name },
              ...months.map((month, index) => ({
                header: month,
                align: "right" as const,
                cell: (row: Seasonality["rows"][number]) => formatSignedPercent(row.deviations[index]),
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
          valueLabel="frente a lo habitual"
          scaleLabels={["Temporada baja", "Temporada alta"]}
          label="Mapa de calor: desviación mensual de las reseñas respecto al nivel habitual, por ciudad y mes"
        />
      </ChartCard>

      <ChartCard
        title="Reseñas por mes, todas las ciudades"
        subtitle="Cada reseña corresponde a una estancia terminada, así que su ritmo es la mejor aproximación pública a la demanda."
        footnote={
          lastMonth
            ? `El último mes (${formatMonth(lastMonth)}) está incompleto: cada snapshot se toma antes de que termine el mes.`
            : undefined
        }
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
          label="Serie temporal: reseñas por mes sumando todas las ciudades"
        />
      </ChartCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Qué se alquila en cada ciudad"
          subtitle="Reparto de los anuncios por tipo de alojamiento."
          table={
            <DataTable
              caption="Reparto de los anuncios por tipo de alojamiento y ciudad"
              rows={byEntireHome}
              rowKey={(city) => city.slug}
              columns={[
                { header: "Ciudad", cell: (city) => city.name },
                { header: "Vivienda completa", align: "right", cell: (city) => formatPercent(city.pct_entire_home, 1) },
                { header: "Habitación privada", align: "right", cell: (city) => formatPercent(city.pct_private_room, 1) },
                {
                  header: "Hotel o compartida",
                  align: "right",
                  cell: (city) => formatPercent(1 - (city.pct_entire_home ?? 0) - (city.pct_private_room ?? 0), 1),
                },
              ]}
            />
          }
        >
          <StackedShareChart
            label="Barras apiladas: reparto de los anuncios por tipo de alojamiento en cada ciudad"
            series={[
              { name: "Vivienda completa", color: 0 },
              { name: "Habitación privada", color: 1 },
              { name: "Hotel o compartida", color: "context" },
            ]}
            rows={byEntireHome.map((city) => {
              const entire = city.pct_entire_home ?? 0;
              const privateRoom = city.pct_private_room ?? 0;
              return { label: city.name, shares: [entire, privateRoom, Math.max(0, 1 - entire - privateRoom)] };
            })}
          />
        </ChartCard>

        <ChartCard
          title="Anuncios de anfitriones con más de un anuncio"
          subtitle="Qué parte de la oferta está en manos de quien gestiona varios alojamientos en la misma ciudad: una pista de cuánto pesa la actividad profesional."
        >
          <BarList
            max={1}
            rows={byMultiListing.map((city) => ({
              key: city.slug,
              label: city.name,
              value: city.pct_multi_listing,
              display: formatPercent(city.pct_multi_listing),
              href: `/ciudad/${city.slug}`,
            }))}
          />
        </ChartCard>
      </section>

      <section aria-labelledby="ciudades">
        <h2 id="ciudades" className="text-xl font-semibold tracking-tight text-ink">
          Las ciudades, una a una
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable<CitySummary>
            caption="Indicadores por ciudad"
            rows={cities}
            rowKey={(city) => city.slug}
            columns={[
              {
                header: "Ciudad",
                cell: (city) => (
                  <Link
                    href={`/ciudad/${city.slug}`}
                    className="rounded font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {city.name}
                  </Link>
                ),
              },
              { header: "País", cell: (city) => city.country },
              { header: "Anuncios", align: "right", cell: (city) => formatInt(city.n_listings) },
              { header: "Precio mediano", align: "right", cell: (city) => formatUsd(city.median_price_usd) },
              { header: "Vivienda completa", align: "right", cell: (city) => formatPercent(city.pct_entire_home) },
              { header: "Ocupación estimada", align: "right", cell: (city) => formatPercent(city.avg_occupancy_l365d) },
              { header: "Valoración", align: "right", cell: (city) => formatDecimal(city.avg_rating, 2) },
              { header: "Snapshot", align: "right", cell: (city) => formatDate(city.snapshot_date) },
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Ocupación estimada: noches reservadas en los últimos 12 meses que Inside Airbnb infiere a partir de
          las reseñas, sobre 365.
        </p>
      </section>
    </div>
  );
}
