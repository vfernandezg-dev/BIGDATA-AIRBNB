import type { Metadata } from "next";

import { BarList } from "@/components/bar-list";
import { ChartCard } from "@/components/chart-card";
import { DataTable } from "@/components/data-table";
import { ScatterChart } from "@/components/scatter-chart";
import { StatTile } from "@/components/stat-tile";
import { featureLabel, formatDate, formatDecimal, formatInt, formatPercent, formatUsd } from "@/lib/format";
import {
  getCities,
  getFeatureImportance,
  getModelMetrics,
  getPredictionSample,
  getSegmentProfiles,
  type ModelMetrics,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Modelo de precios",
  description: "Cómo se predice el precio por noche de un anuncio, cuánto acierta el modelo y qué variables pesan más.",
};

const GLOBAL_SCOPE = "global";
const TOP_FEATURES = 15;
// Suficientes puntos para ver la nube sin cargar el navegador.
const SCATTER_POINTS = 1500;

export default async function ModelPage() {
  const [metrics, importance, sample, segments, cities] = await Promise.all([
    getModelMetrics(),
    getFeatureImportance(TOP_FEATURES),
    getPredictionSample(SCATTER_POINTS),
    getSegmentProfiles(),
    getCities(),
  ]);

  const find = (model: ModelMetrics["model"], scope: string) =>
    metrics.find((row) => row.model === model && row.scope === scope);
  const gbt = find("gbt", GLOBAL_SCOPE);
  const baseline = find("baseline", GLOBAL_SCOPE);

  if (!gbt || !baseline) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Modelo de precios</h1>
        <p className="mt-3 text-ink-2">
          Todavía no hay un modelo publicado. Ejecuta las etapas <code>train</code> y <code>publish</code> del
          pipeline.
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
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Modelo de precios</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Un modelo de árboles potenciados por gradiente (GBT de Spark ML) estima el precio por noche de un
          anuncio a partir de sus características: ciudad, ubicación, tamaño, tipo de alojamiento, servicios,
          anfitrión y reseñas. Se entrena con el 80 % de los anuncios y se evalúa con el 20 % restante, que el
          modelo no ha visto.
        </p>
      </header>

      <section aria-label="Resultados en el conjunto de prueba" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          label="Varianza explicada (R²)"
          value={formatDecimal(gbt.r2_log, 2)}
          hint={`Sobre el logaritmo del precio. La regla de referencia llega a ${formatDecimal(baseline.r2_log, 2)}.`}
        />
        <StatTile
          label="Error relativo mediano"
          value={formatPercent(gbt.median_ape, 1)}
          hint={`En la mitad de los anuncios el modelo se desvía menos que eso. La referencia: ${formatPercent(baseline.median_ape, 1)}.`}
        />
        <StatTile
          label="Error absoluto medio"
          value={formatUsd(gbt.mae_usd)}
          hint={`Por noche. La referencia: ${formatUsd(baseline.mae_usd)}.`}
        />
        <StatTile
          label="Anuncios de prueba"
          value={formatInt(gbt.n_test)}
          hint={`Entrenado con ${formatInt(gbt.n_train)} anuncios el ${formatDate(gbt.trained_at)}.`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Error por ciudad, frente a la regla de referencia"
          subtitle="Error relativo mediano en el conjunto de prueba: cuanto más corta la barra, mejor. La referencia predice, para cada anuncio, la mediana de su ciudad y su tipo de alojamiento."
          table={
            <DataTable
              caption="Métricas por ciudad en el conjunto de prueba"
              rows={perCity}
              rowKey={(row) => row.slug}
              columns={[
                { header: "Ciudad", cell: (row) => row.name },
                { header: "Anuncios de prueba", align: "right", cell: (row) => formatInt(row.gbt?.n_test) },
                { header: "R²", align: "right", cell: (row) => formatDecimal(row.gbt?.r2_log, 2) },
                { header: "Error mediano", align: "right", cell: (row) => formatPercent(row.gbt?.median_ape, 1) },
                { header: "Referencia", align: "right", cell: (row) => formatPercent(row.baseline?.median_ape, 1) },
                { header: "Error medio (USD)", align: "right", cell: (row) => formatUsd(row.gbt?.mae_usd) },
              ]}
            />
          }
        >
          <BarList
            legend={{ main: "Modelo", context: "Regla de referencia" }}
            rows={perCity.map((row) => ({
              key: row.slug,
              label: row.name,
              value: row.gbt?.median_ape ?? null,
              display: formatPercent(row.gbt?.median_ape, 1),
              context: {
                value: row.baseline?.median_ape ?? null,
                display: formatPercent(row.baseline?.median_ape, 1),
              },
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Qué variables pesan más"
          subtitle={`Importancia relativa de las ${importance.length} variables principales: cuánto reduce el error cada una al usarse en los árboles.`}
          footnote="La importancia indica cuánto usa el modelo una variable, no que esa variable cause el precio."
        >
          <BarList
            max={maxImportance}
            rows={importance.map((row) => ({
              key: row.feature,
              label: featureLabel(row.feature),
              value: row.importance,
              display: formatPercent(row.importance, 1),
            }))}
          />
        </ChartCard>
      </section>

      <ChartCard
        title="Precio predicho frente a precio real"
        subtitle={`Muestra aleatoria de ${formatInt(sample.length)} anuncios de prueba. Sobre la diagonal, la predicción coincide con el precio publicado. El modelo tiende a quedarse corto en los anuncios más caros y a pasarse en los más baratos.`}
      >
        <ScatterChart
          points={sample.map((point) => ({
            actual: point.actual_usd,
            predicted: point.predicted_usd,
            label: cityName.get(point.city) ?? point.city,
          }))}
        />
      </ChartCard>

      <section aria-labelledby="como-se-lee" className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
        <h2 id="como-se-lee" className="text-xl font-semibold tracking-tight text-ink">
          Cómo leer estos resultados
        </h2>
        <p>
          El modelo predice el logaritmo del precio en dólares. Así, equivocarse en 20 dólares pesa lo mismo en
          términos relativos para un anuncio de 40 que para uno de 400, y los precios extremos no dominan el
          ajuste. Solo se usan anuncios con precio publicado, coordenadas dentro de la ciudad y precio dentro
          de los percentiles 1 y 99 de su ciudad.
        </p>
        <p>
          Ninguna variable contiene el precio ni se deriva de él: se excluyen de forma explícita los ingresos
          estimados y las cotizaciones de precio que publica la fuente. El reparto entre entrenamiento y prueba
          es determinista, de modo que un mismo anuncio cae siempre en el mismo conjunto.
        </p>
        <p>
          Predecir bien no equivale a explicar: el modelo recoge lo que se anuncia, no la calidad real del
          alojamiento ni la temporada de la estancia. Úsalo para comparar, no para tasar.
        </p>
      </section>

      {segments.length > 0 ? (
        <section aria-labelledby="segmentos">
          <h2 id="segmentos" className="text-xl font-semibold tracking-tight text-ink">
            Segmentos de barrios
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
            Además del modelo de precios, un K-Means agrupa los barrios de todas las ciudades según su precio
            relativo al de su ciudad, su actividad de reseñas, su disponibilidad y su tipo de oferta. Los
            segmentos se numeran de más barato a más caro; el número de grupos se elige con el coeficiente de
            silueta.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
            <DataTable
              caption="Perfil medio de cada segmento de barrios"
              rows={segments}
              rowKey={(row) => String(row.segment)}
              columns={[
                { header: "Segmento", cell: (row) => `Segmento ${row.segment}` },
                { header: "Barrios", align: "right", cell: (row) => formatInt(row.n_neighbourhoods) },
                { header: "Precio frente a su ciudad", align: "right", cell: (row) => formatDecimal(row.avg_price_vs_city, 2) },
                { header: "Reseñas por mes", align: "right", cell: (row) => formatDecimal(row.avg_reviews_per_month, 2) },
                { header: "Días disponibles al año", align: "right", cell: (row) => formatInt(row.avg_availability_365) },
                { header: "Vivienda completa", align: "right", cell: (row) => formatPercent(row.avg_pct_entire_home) },
                { header: "Cuota de anuncios de la ciudad", align: "right", cell: (row) => formatPercent(row.avg_listings_share, 1) },
              ]}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
