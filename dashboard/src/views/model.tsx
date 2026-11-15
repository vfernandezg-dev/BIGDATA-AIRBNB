import type { Metadata } from "next";

import { BarList } from "@/components/bar-list";
import { ChartCard } from "@/components/chart-card";
import { BiasChart } from "@/components/charts/bias-chart";
import { PredictionScatterChart } from "@/components/charts/prediction-scatter-chart";
import { DataTable } from "@/components/data-table";
import { StatTile } from "@/components/stat-tile";
import type { Locale } from "@/i18n/config";
import { formatters } from "@/i18n/format";
import { featureLabel, localizeCities } from "@/i18n/labels";
import { modelMessages } from "@/i18n/messages/model";
import { pageAlternates } from "@/i18n/metadata";
import {
  getCities,
  getFeatureImportance,
  getModelMetrics,
  getPredictionBias,
  getPredictionSample,
  getSegmentProfiles,
  type ModelMetrics,
} from "@/lib/queries";

const GLOBAL_SCOPE = "global";
const TOP_FEATURES = 15;
// Suficientes puntos para ver la nube sin cargar el navegador.
const SCATTER_POINTS = 1500;

export function modelMetadata(lang: Locale): Metadata {
  const t = modelMessages[lang];
  return { title: t.title, description: t.description, alternates: pageAlternates(lang, "model") };
}

export async function ModelView({ lang }: { lang: Locale }) {
  const [metrics, importance, sample, bias, segments, allCities] = await Promise.all([
    getModelMetrics(),
    getFeatureImportance(TOP_FEATURES),
    getPredictionSample(SCATTER_POINTS),
    getPredictionBias(),
    getSegmentProfiles(),
    getCities(),
  ]);
  const t = modelMessages[lang];
  const fmt = formatters(lang);
  const cities = localizeCities(lang, allCities);

  const find = (model: ModelMetrics["model"], scope: string) =>
    metrics.find((row) => row.model === model && row.scope === scope);
  const gbt = find("gbt", GLOBAL_SCOPE);
  const baseline = find("baseline", GLOBAL_SCOPE);

  if (!gbt || !baseline) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-3 text-ink-2">
          {t.empty.before}
          <code>train</code>
          {t.empty.and}
          <code>publish</code>
          {t.empty.after}
        </p>
      </div>
    );
  }

  const cityName = new Map(cities.map((city) => [city.slug, city.name]));
  const perCity = [...cityName.keys()]
    .map((slug) => ({ slug, name: cityName.get(slug) ?? slug, gbt: find("gbt", slug), baseline: find("baseline", slug) }))
    .filter((row) => row.gbt && row.baseline)
    .sort((a, b) => (a.gbt?.median_ape ?? 0) - (b.gbt?.median_ape ?? 0));
  const maxImportance = importance[0]?.importance ?? 1;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">{t.intro}</p>
      </header>

      <section aria-label={t.kpis.label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          label={t.kpis.r2}
          value={fmt.decimal(gbt.r2_log, 2)}
          hint={t.kpis.r2Hint(fmt.decimal(baseline.r2_log, 2))}
        />
        <StatTile
          label={t.kpis.medianError}
          value={fmt.percent(gbt.median_ape, 1)}
          hint={t.kpis.medianErrorHint(fmt.percent(baseline.median_ape, 1))}
        />
        <StatTile
          label={t.kpis.meanError}
          value={fmt.usd(gbt.mae_usd)}
          hint={t.kpis.meanErrorHint(fmt.usd(baseline.mae_usd))}
        />
        <StatTile
          label={t.kpis.testListings}
          value={fmt.int(gbt.n_test)}
          hint={t.kpis.testListingsHint(fmt.int(gbt.n_train), fmt.date(gbt.trained_at))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          lang={lang}
          title={t.byCity.title}
          subtitle={t.byCity.subtitle}
          table={
            <DataTable
              caption={t.byCity.caption}
              rows={perCity}
              rowKey={(row) => row.slug}
              columns={[
                { header: t.byCity.columns.city, cell: (row) => row.name },
                { header: t.byCity.columns.testListings, align: "right", cell: (row) => fmt.int(row.gbt?.n_test) },
                { header: "R²", align: "right", cell: (row) => fmt.decimal(row.gbt?.r2_log, 2) },
                {
                  header: t.byCity.columns.medianError,
                  align: "right",
                  cell: (row) => fmt.percent(row.gbt?.median_ape, 1),
                },
                {
                  header: t.byCity.columns.baseline,
                  align: "right",
                  cell: (row) => fmt.percent(row.baseline?.median_ape, 1),
                },
                { header: t.byCity.columns.meanError, align: "right", cell: (row) => fmt.usd(row.gbt?.mae_usd) },
              ]}
            />
          }
        >
          <BarList
            legend={t.byCity.legend}
            rows={perCity.map((row) => ({
              key: row.slug,
              label: row.name,
              value: row.gbt?.median_ape ?? null,
              display: fmt.percent(row.gbt?.median_ape, 1),
              context: {
                value: row.baseline?.median_ape ?? null,
                display: fmt.percent(row.baseline?.median_ape, 1),
              },
            }))}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.importance.title}
          subtitle={t.importance.subtitle(importance.length)}
          footnote={t.importance.footnote}
        >
          <BarList
            max={maxImportance}
            rows={importance.map((row) => ({
              key: row.feature,
              label: featureLabel(lang, row.feature),
              value: row.importance,
              display: fmt.percent(row.importance, 1),
            }))}
          />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard lang={lang} title={t.scatter.title} subtitle={t.scatter.subtitle(fmt.int(sample.length))}>
          <PredictionScatterChart
            label={t.scatter.chart}
            points={sample.map((point) => ({
              actual: point.actual_usd,
              predicted: point.predicted_usd,
              label: cityName.get(point.city) ?? point.city,
            }))}
          />
        </ChartCard>

        <ChartCard
          lang={lang}
          title={t.bias.title}
          subtitle={t.bias.subtitle}
          footnote={t.bias.footnote}
          table={
            <DataTable
              caption={t.bias.caption}
              rows={bias}
              rowKey={(row) => String(row.decile)}
              columns={[
                { header: t.bias.columns.actual, cell: (row) => `${fmt.usd(row.min_usd)} – ${fmt.int(row.max_usd)}` },
                { header: t.bias.columns.ratio, align: "right", cell: (row) => fmt.decimal(row.median_ratio, 2) },
                { header: t.bias.columns.listings, align: "right", cell: (row) => fmt.int(row.n) },
              ]}
            />
          }
        >
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-diverging-high" />
              {t.bias.over}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-diverging-low" />
              {t.bias.under}
            </li>
          </ul>
          <BiasChart
            label={t.bias.chart}
            buckets={bias.map((row) => ({
              label: `${fmt.int(row.min_usd)}–${fmt.int(row.max_usd)}`,
              ratio: row.median_ratio,
              count: row.n,
            }))}
          />
        </ChartCard>
      </section>

      <section aria-labelledby="como-se-lee" className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
        <h2 id="como-se-lee" className="text-xl font-semibold tracking-tight text-ink">
          {t.reading.title}
        </h2>
        {t.reading.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      {segments.length > 0 ? (
        <section aria-labelledby="segmentos">
          <h2 id="segmentos" className="text-xl font-semibold tracking-tight text-ink">
            {t.segments.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">{t.segments.intro}</p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
            <DataTable
              caption={t.segments.caption}
              rows={segments}
              rowKey={(row) => String(row.segment)}
              columns={[
                { header: t.segments.columns.segment, cell: (row) => t.segments.name(row.segment) },
                {
                  header: t.segments.columns.neighbourhoods,
                  align: "right",
                  cell: (row) => fmt.int(row.n_neighbourhoods),
                },
                {
                  header: t.segments.columns.versusCity,
                  align: "right",
                  cell: (row) => fmt.decimal(row.avg_price_vs_city, 2),
                },
                {
                  header: t.segments.columns.reviewsPerMonth,
                  align: "right",
                  cell: (row) => fmt.decimal(row.avg_reviews_per_month, 2),
                },
                {
                  header: t.segments.columns.availableDays,
                  align: "right",
                  cell: (row) => fmt.int(row.avg_availability_365),
                },
                {
                  header: t.segments.columns.entireHome,
                  align: "right",
                  cell: (row) => fmt.percent(row.avg_pct_entire_home),
                },
                {
                  header: t.segments.columns.listingsShare,
                  align: "right",
                  cell: (row) => fmt.percent(row.avg_listings_share, 1),
                },
              ]}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
