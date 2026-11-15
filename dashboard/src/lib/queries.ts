import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { query } from "./db";

/**
 * Consultas a los data marts.
 *
 * Los marts solo cambian cuando el pipeline publica, así que cada consulta se cachea sin caducidad práctica
 * (`max`) y con una etiqueta común. El pipeline invalida esa etiqueta al terminar de publicar
 * (POST /api/revalidate), y las páginas se regeneran en la siguiente visita.
 */
export const MARTS_TAG = "marts";

export type Publication = {
  published_at: string;
  pipeline_run_id: string;
  fx_as_of: string;
  n_cities: number;
  n_listings: number;
};

export type CitySummary = {
  slug: string;
  name: string;
  country: string;
  currency: string | null;
  snapshot_date: string;
  center_lat: number;
  center_lon: number;
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  n_listings: number;
  n_priced: number;
  n_hosts: number;
  p25_price_usd: number | null;
  median_price_usd: number | null;
  p75_price_usd: number | null;
  avg_price_usd: number | null;
  pct_entire_home: number | null;
  pct_private_room: number | null;
  pct_multi_listing: number | null;
  pct_superhost: number | null;
  pct_licensed: number | null;
  pct_short_term: number | null;
  avg_rating: number | null;
  n_reviews_ltm: number | null;
  avg_reviews_per_month: number | null;
  avg_availability_365: number | null;
  avg_occupancy_l365d: number | null;
  median_min_nights: number | null;
  median_revenue_l365d_usd: number | null;
};

export type MonthlyReviews = { month: string; n_reviews: number };
export type MonthlyAvailability = { month: string; n_listings: number; availability_rate: number | null };

export type RoomTypeStats = {
  room_type: string;
  n_listings: number;
  n_priced: number;
  p25_price_usd: number | null;
  median_price_usd: number | null;
  p75_price_usd: number | null;
  avg_accommodates: number | null;
  avg_rating: number | null;
  listings_share: number;
};

export type PriceBucket = { bucket_from_usd: number; bucket_to_usd: number | null; n_listings: number };

export type Neighbourhood = {
  neighbourhood: string;
  neighbourhood_group: string | null;
  n_listings: number;
  n_priced: number;
  median_price_usd: number | null;
  avg_rating: number | null;
  avg_availability_365: number | null;
  pct_entire_home: number | null;
  price_vs_city: number | null;
  listings_share: number | null;
  segment: number | null;
  price_index: number | null;
  n_scored: number | null;
};

/** Celda del mapa: [latitud, longitud, anuncios, precio mediano en USD o null]. */
export type MapCell = [lat: number, lon: number, listings: number, medianPriceUsd: number | null];

export type HostBucket = { bucket_order: number; bucket_label: string; n_hosts: number; n_listings: number };

export type ModelMetrics = {
  run_id: string;
  model: "gbt" | "baseline";
  scope: string;
  n_train: number | null;
  n_test: number;
  rmse_log: number | null;
  mae_log: number | null;
  r2_log: number | null;
  mae_usd: number | null;
  rmse_usd: number | null;
  mape: number | null;
  median_ape: number | null;
  trained_at: string;
};

export type SeasonalityCell = {
  city: string;
  /** Mes del año, de 1 a 12. */
  month_of_year: number;
  /** Reseñas del mes divididas por su tendencia: 1 es un mes normal, 1,2 un 20 % por encima. */
  seasonal_index: number;
  from_year: number;
  to_year: number;
};

export type BiasBucket = {
  decile: number;
  min_usd: number;
  max_usd: number;
  /** Mediana de precio predicho / precio real dentro del tramo. */
  median_ratio: number;
  n: number;
};

export type FeatureImportance = { feature: string; importance: number; rank: number };
export type PredictionPoint = { city: string; actual_usd: number; predicted_usd: number };

export type SegmentProfile = {
  segment: number;
  n_neighbourhoods: number;
  avg_price_vs_city: number | null;
  avg_reviews_per_month: number | null;
  avg_availability_365: number | null;
  avg_pct_entire_home: number | null;
  avg_listings_share: number | null;
};

export type StageCount = {
  city: string;
  dataset: string;
  snapshot_date: string;
  bronze_rows: number;
  silver_rows: number;
};

export type ListingQuality = {
  city: string;
  n_listings: number;
  n_with_price: number;
  n_price_outliers: number;
  n_geo_invalid: number;
  n_room_type_invalid: number;
  n_min_nights_invalid: number;
  n_model_eligible: number;
};

const UTC_TIMESTAMP = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

export async function getPublication(): Promise<Publication | null> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  const rows = await query<Publication>(
    `SELECT to_char(published_at AT TIME ZONE 'UTC', ${UTC_TIMESTAMP}) AS published_at,
            pipeline_run_id, fx_as_of, n_cities, n_listings
       FROM marts.publish_log`,
  );
  return rows[0] ?? null;
}

export async function getCities(): Promise<CitySummary[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<CitySummary>(
    `SELECT d.city AS slug, d.city_name AS name, d.country, d.currency, d.snapshot_date,
            d.center_lat, d.center_lon, d.min_lat, d.max_lat, d.min_lon, d.max_lon,
            k.n_listings, k.n_priced, k.n_hosts, k.p25_price_usd, k.median_price_usd, k.p75_price_usd,
            k.avg_price_usd, k.pct_entire_home, k.pct_private_room, k.pct_multi_listing, k.pct_superhost,
            k.pct_licensed, k.pct_short_term, k.avg_rating, k.n_reviews_ltm, k.avg_reviews_per_month,
            k.avg_availability_365, k.avg_occupancy_l365d, k.median_min_nights, k.median_revenue_l365d_usd
       FROM marts.dim_city d
       JOIN marts.city_kpis k USING (city)
      ORDER BY k.n_listings DESC, d.city`,
  );
}

/** Reseñas por mes sumando todas las ciudades. */
export async function getReviewsByMonth(): Promise<MonthlyReviews[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<MonthlyReviews>(
    `SELECT month, sum(n_reviews)::bigint AS n_reviews
       FROM marts.reviews_monthly
      GROUP BY month
      ORDER BY month`,
  );
}

/**
 * Estacionalidad: cuánto se aparta cada mes de lo habitual en su ciudad.
 *
 * Las reseñas crecen año tras año, así que comparar meses por su volumen premiaría a los últimos del año.
 * Aquí cada mes se divide por la media de los doce meses que lo rodean (su tendencia) y el resultado se
 * promedia por mes del año en los dos últimos años naturales completos. 1 es un mes normal.
 */
export async function getSeasonality(): Promise<SeasonalityCell[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<SeasonalityCell>(
    `WITH bounds AS (
       SELECT date_trunc('year', max(month)) AS end_month,
              date_trunc('year', max(month)) - interval '2 years' AS start_month
         FROM marts.reviews_monthly
     ),
     indexed AS (
       SELECT city, month, n_reviews,
              avg(n_reviews) OVER centered AS trend,
              count(*) OVER centered AS window_months
         FROM marts.reviews_monthly
       WINDOW centered AS (PARTITION BY city ORDER BY month ROWS BETWEEN 6 PRECEDING AND 5 FOLLOWING)
     )
     SELECT i.city,
            extract(month FROM i.month)::int AS month_of_year,
            avg(i.n_reviews / i.trend)::float8 AS seasonal_index,
            extract(year FROM b.start_month)::int AS from_year,
            extract(year FROM b.end_month)::int - 1 AS to_year
       FROM indexed i
      CROSS JOIN bounds b
      WHERE i.month >= b.start_month AND i.month < b.end_month
        AND i.window_months = 12 AND i.trend > 0
      GROUP BY i.city, month_of_year, b.start_month, b.end_month
      ORDER BY i.city, month_of_year`,
  );
}

export async function getCityReviews(city: string): Promise<MonthlyReviews[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<MonthlyReviews>(
    `SELECT month, n_reviews FROM marts.reviews_monthly WHERE city = $1 ORDER BY month`,
    [city],
  );
}

export async function getCityAvailability(city: string): Promise<MonthlyAvailability[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<MonthlyAvailability>(
    `SELECT month, n_listings, availability_rate
       FROM marts.availability_monthly
      WHERE city = $1
      ORDER BY month`,
    [city],
  );
}

export async function getRoomTypes(city: string): Promise<RoomTypeStats[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<RoomTypeStats>(
    `SELECT room_type, n_listings, n_priced, p25_price_usd, median_price_usd, p75_price_usd,
            avg_accommodates, avg_rating, listings_share
       FROM marts.room_type_stats
      WHERE city = $1
      ORDER BY n_listings DESC`,
    [city],
  );
}

export async function getPriceHistogram(city: string): Promise<PriceBucket[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<PriceBucket>(
    `SELECT bucket_from_usd, max(bucket_to_usd) AS bucket_to_usd, sum(n_listings)::bigint AS n_listings
       FROM marts.price_histogram
      WHERE city = $1
      GROUP BY bucket_from_usd
      ORDER BY bucket_from_usd`,
    [city],
  );
}

export async function getNeighbourhoods(city: string): Promise<Neighbourhood[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<Neighbourhood>(
    `SELECT n.neighbourhood, n.neighbourhood_group, n.n_listings, n.n_priced, n.median_price_usd,
            n.avg_rating, n.avg_availability_365, n.pct_entire_home, n.price_vs_city, n.listings_share,
            n.segment, i.price_index, i.n_scored
       FROM marts.neighbourhood_stats n
       LEFT JOIN marts.neighbourhood_price_index i USING (city, neighbourhood)
      WHERE n.city = $1
      ORDER BY n.n_listings DESC`,
    [city],
  );
}

export async function getMapGrid(city: string): Promise<MapCell[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  const rows = await query<{ cell_lat: number; cell_lon: number; n_listings: number; price: number | null }>(
    `SELECT cell_lat, cell_lon, n_listings, round(median_price_usd::numeric, 0)::float8 AS price
       FROM marts.map_grid
      WHERE city = $1`,
    [city],
  );
  return rows.map((row) => [row.cell_lat, row.cell_lon, row.n_listings, row.price]);
}

export async function getHostConcentration(city: string): Promise<HostBucket[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<HostBucket>(
    `SELECT bucket_order, bucket_label, n_hosts, n_listings
       FROM marts.host_concentration
      WHERE city = $1
      ORDER BY bucket_order`,
    [city],
  );
}

/** Métricas del entrenamiento más reciente. */
export async function getModelMetrics(): Promise<ModelMetrics[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<ModelMetrics>(
    `SELECT run_id, model, scope, n_train, n_test, rmse_log, mae_log, r2_log, mae_usd, rmse_usd, mape,
            median_ape, to_char(trained_at, ${UTC_TIMESTAMP}) AS trained_at
       FROM marts.model_metrics
      WHERE run_id = (SELECT max(run_id) FROM marts.model_metrics)
      ORDER BY scope, model`,
  );
}

export async function getFeatureImportance(limit: number): Promise<FeatureImportance[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<FeatureImportance>(
    `SELECT feature, importance, rank
       FROM marts.feature_importance
      WHERE run_id = (SELECT max(run_id) FROM marts.feature_importance)
      ORDER BY rank
      LIMIT $1`,
    [limit],
  );
}

export async function getPredictionSample(limit: number): Promise<PredictionPoint[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<PredictionPoint>(
    `SELECT city, actual_usd, predicted_usd
       FROM marts.prediction_sample
      ORDER BY id
      LIMIT $1`,
    [limit],
  );
}

/**
 * Sesgo del modelo por tramo de precio: la muestra de prueba se divide en diez grupos del mismo tamaño,
 * del más barato al más caro, y en cada uno se mide la mediana de precio predicho / precio real.
 */
export async function getPredictionBias(): Promise<BiasBucket[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<BiasBucket>(
    `WITH sample AS (
       SELECT actual_usd, predicted_usd, ntile(10) OVER (ORDER BY actual_usd) AS decile
         FROM marts.prediction_sample
        WHERE actual_usd > 0
     )
     SELECT decile,
            min(actual_usd) AS min_usd,
            max(actual_usd) AS max_usd,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY predicted_usd / actual_usd) AS median_ratio,
            count(*) AS n
       FROM sample
      GROUP BY decile
      ORDER BY decile`,
  );
}

export async function getSegmentProfiles(): Promise<SegmentProfile[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<SegmentProfile>(
    `SELECT segment, n_neighbourhoods, avg_price_vs_city, avg_reviews_per_month, avg_availability_365,
            avg_pct_entire_home, avg_listings_share
       FROM marts.segment_profiles
      ORDER BY segment`,
  );
}

export async function getStageCounts(): Promise<StageCount[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<StageCount>(
    `SELECT city, dataset, snapshot_date, bronze_rows, silver_rows
       FROM marts.quality_counts
      ORDER BY city, dataset`,
  );
}

export async function getListingQuality(): Promise<ListingQuality[]> {
  "use cache";
  cacheLife("max");
  cacheTag(MARTS_TAG);
  return query<ListingQuality>(
    `SELECT city, n_listings, n_with_price, n_price_outliers, n_geo_invalid, n_room_type_invalid,
            n_min_nights_invalid, n_model_eligible
       FROM marts.listing_quality
      ORDER BY city`,
  );
}
