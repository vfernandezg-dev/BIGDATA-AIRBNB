import Link from "next/link";

import { BarList } from "@/components/bar-list";
import { ChartCard } from "@/components/chart-card";
import { DataTable } from "@/components/data-table";
import { LineChart } from "@/components/line-chart";
import { StatTile } from "@/components/stat-tile";
import { formatCompact, formatDate, formatDecimal, formatInt, formatMonth, formatPercent, formatUsd } from "@/lib/format";
import { getCities, getReviewsByMonth, type CitySummary } from "@/lib/queries";

// Las reseñas anteriores a esta fecha son tan pocas que solo alargan el eje.
const REVIEWS_SINCE = "2015-01-01";

export default async function OverviewPage() {
  const [cities, reviews] = await Promise.all([getCities(), getReviewsByMonth()]);

  if (cities.length === 0) {
    return (
      <p className="text-ink-2">
        Todavía no hay datos publicados. Ejecuta el pipeline y su etapa <code>publish</code>.
      </p>
    );
  }

  const totalListings = cities.reduce((sum, city) => sum + city.n_listings, 0);
  const totalHosts = cities.reduce((sum, city) => sum + city.n_hosts, 0);
  const totalReviews = cities.reduce((sum, city) => sum + (city.n_reviews_ltm ?? 0), 0);
  const byPrice = [...cities].sort((a, b) => (b.median_price_usd ?? 0) - (a.median_price_usd ?? 0));
  const byMultiListing = [...cities].sort((a, b) => (b.pct_multi_listing ?? 0) - (a.pct_multi_listing ?? 0));
  const recentReviews = reviews.filter((row) => row.month >= REVIEWS_SINCE);
  const mostExpensive = byPrice[0];
  const cheapest = byPrice[byPrice.length - 1];
  const countries = new Set(cities.map((city) => city.country)).size;
  const lastMonth = recentReviews.at(-1)?.month;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">El alquiler turístico en {cities.length} ciudades</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Cuánto cuesta una noche, quién ofrece los alojamientos y cómo ha evolucionado la demanda, según el
          último snapshot de Inside Airbnb de cada ciudad. Elige una ciudad para ver su mapa de precios, sus
          barrios y su estacionalidad.
        </p>
      </header>

      <section aria-label="Cifras principales" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile hero label="Anuncios analizados" value={formatCompact(totalListings)} hint={`${formatInt(totalListings)} anuncios activos en el último snapshot de cada ciudad.`} />
        <StatTile label="Ciudades" value={formatInt(cities.length)} hint={`En ${formatInt(countries)} países.`} />
        <StatTile label="Anfitriones" value={formatCompact(totalHosts)} hint="Suma de anfitriones distintos por ciudad." />
        <StatTile label="Reseñas en 12 meses" value={formatCompact(totalReviews)} hint="La mejor señal pública de cuánto se reserva." />
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
        <LineChart data={recentReviews.map((row) => ({ month: row.month, value: row.n_reviews }))} valueLabel="reseñas" />
      </ChartCard>

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
                  <Link href={`/ciudad/${city.slug}`} className="rounded font-medium text-ink underline-offset-2 hover:underline">
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
