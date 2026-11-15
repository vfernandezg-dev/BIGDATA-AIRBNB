-- Esquema de serving: los data marts que consulta el dashboard.
--
-- Son datos derivados: cada publicación los reemplaza por completo dentro de una transacción. Por eso, si
-- cambia la estructura (SCHEMA_VERSION en publish.py), el esquema se elimina y se vuelve a crear en lugar
-- de migrarse. Ningún mart contiene datos personales (ni nombres de anfitriones ni texto de reseñas).

CREATE SCHEMA IF NOT EXISTS marts;

CREATE TABLE IF NOT EXISTS marts.schema_version (
    id      boolean PRIMARY KEY DEFAULT true CHECK (id),
    version integer NOT NULL
);

-- Última publicación: el dashboard muestra de cuándo son los datos.
CREATE TABLE IF NOT EXISTS marts.publish_log (
    id              boolean PRIMARY KEY DEFAULT true CHECK (id),
    published_at    timestamptz NOT NULL,
    pipeline_run_id text NOT NULL,
    fx_as_of        date NOT NULL,
    n_cities        integer NOT NULL,
    n_listings      bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS marts.dim_city (
    city          text PRIMARY KEY,
    city_name     text NOT NULL,
    country       text NOT NULL,
    currency      text,
    snapshot_date date NOT NULL,
    center_lat    double precision,
    center_lon    double precision,
    min_lat       double precision,
    max_lat       double precision,
    min_lon       double precision,
    max_lon       double precision
);

CREATE TABLE IF NOT EXISTS marts.city_kpis (
    city                     text PRIMARY KEY,
    snapshot_date            date NOT NULL,
    n_listings               bigint NOT NULL,
    n_priced                 bigint NOT NULL,
    n_hosts                  bigint NOT NULL,
    p25_price_usd            double precision,
    median_price_usd         double precision,
    p75_price_usd            double precision,
    avg_price_usd            double precision,
    pct_entire_home          double precision,
    pct_private_room         double precision,
    pct_multi_listing        double precision,
    pct_superhost            double precision,
    pct_licensed             double precision,
    pct_short_term           double precision,
    avg_rating               double precision,
    n_reviews_ltm            bigint,
    avg_reviews_per_month    double precision,
    avg_availability_365     double precision,
    avg_occupancy_l365d      double precision,
    median_min_nights        integer,
    median_revenue_l365d_usd double precision
);

CREATE TABLE IF NOT EXISTS marts.neighbourhood_stats (
    city                  text NOT NULL,
    neighbourhood         text NOT NULL,
    neighbourhood_group   text,
    n_listings            bigint NOT NULL,
    n_priced              bigint NOT NULL,
    p25_price_usd         double precision,
    median_price_usd      double precision,
    p75_price_usd         double precision,
    avg_rating            double precision,
    avg_availability_365  double precision,
    avg_occupancy_l365d   double precision,
    n_reviews_ltm         bigint,
    avg_reviews_per_month double precision,
    pct_entire_home       double precision,
    center_lat            double precision,
    center_lon            double precision,
    price_vs_city         double precision,
    listings_share        double precision,
    segment               integer,
    PRIMARY KEY (city, neighbourhood)
);

CREATE TABLE IF NOT EXISTS marts.segment_profiles (
    segment               integer PRIMARY KEY,
    n_neighbourhoods      bigint NOT NULL,
    avg_price_vs_city     double precision,
    avg_reviews_per_month double precision,
    avg_availability_365  double precision,
    avg_pct_entire_home   double precision,
    avg_listings_share    double precision
);

CREATE TABLE IF NOT EXISTS marts.room_type_stats (
    city             text NOT NULL,
    room_type        text NOT NULL,
    n_listings       bigint NOT NULL,
    n_priced         bigint NOT NULL,
    p25_price_usd    double precision,
    median_price_usd double precision,
    p75_price_usd    double precision,
    avg_accommodates double precision,
    avg_rating       double precision,
    listings_share   double precision,
    PRIMARY KEY (city, room_type)
);

CREATE TABLE IF NOT EXISTS marts.price_histogram (
    city            text NOT NULL,
    room_type       text NOT NULL,
    bucket_from_usd integer NOT NULL,
    bucket_to_usd   integer,
    n_listings      bigint NOT NULL,
    PRIMARY KEY (city, room_type, bucket_from_usd)
);

CREATE TABLE IF NOT EXISTS marts.map_grid (
    city                 text NOT NULL,
    cell_lat             double precision NOT NULL,
    cell_lon             double precision NOT NULL,
    n_listings           bigint NOT NULL,
    n_priced             bigint NOT NULL,
    median_price_usd     double precision,
    avg_rating           double precision,
    avg_availability_365 double precision,
    PRIMARY KEY (city, cell_lat, cell_lon)
);

CREATE TABLE IF NOT EXISTS marts.host_concentration (
    city         text NOT NULL,
    bucket_order integer NOT NULL,
    bucket_label text NOT NULL,
    n_hosts      bigint NOT NULL,
    n_listings   bigint NOT NULL,
    PRIMARY KEY (city, bucket_order)
);

CREATE TABLE IF NOT EXISTS marts.reviews_monthly (
    city                text NOT NULL,
    month               date NOT NULL,
    n_reviews           bigint NOT NULL,
    n_listings_reviewed bigint NOT NULL,
    PRIMARY KEY (city, month)
);

CREATE TABLE IF NOT EXISTS marts.availability_monthly (
    city              text NOT NULL,
    month             date NOT NULL,
    n_listings        bigint NOT NULL,
    days_total        bigint NOT NULL,
    days_available    bigint NOT NULL,
    availability_rate double precision,
    PRIMARY KEY (city, month)
);

CREATE TABLE IF NOT EXISTS marts.listing_quality (
    city                 text PRIMARY KEY,
    snapshot_date        date NOT NULL,
    n_listings           bigint NOT NULL,
    n_distinct_listings  bigint NOT NULL,
    n_with_price         bigint NOT NULL,
    n_price_outliers     bigint NOT NULL,
    n_geo_invalid        bigint NOT NULL,
    n_room_type_invalid  bigint NOT NULL,
    n_min_nights_invalid bigint NOT NULL,
    n_model_eligible     bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS marts.quality_counts (
    city          text NOT NULL,
    dataset       text NOT NULL,
    snapshot_date date NOT NULL,
    bronze_rows   bigint NOT NULL,
    silver_rows   bigint NOT NULL,
    PRIMARY KEY (city, dataset)
);

CREATE TABLE IF NOT EXISTS marts.model_metrics (
    run_id     text NOT NULL,
    model      text NOT NULL,
    scope      text NOT NULL,
    n_train    bigint,
    n_test     bigint NOT NULL,
    rmse_log   double precision,
    mae_log    double precision,
    r2_log     double precision,
    mae_usd    double precision,
    rmse_usd   double precision,
    mape       double precision,
    median_ape double precision,
    trained_at timestamp NOT NULL,
    PRIMARY KEY (run_id, model, scope)
);

CREATE TABLE IF NOT EXISTS marts.feature_importance (
    run_id     text NOT NULL,
    feature    text NOT NULL,
    importance double precision NOT NULL,
    rank       integer NOT NULL,
    PRIMARY KEY (run_id, feature)
);

CREATE TABLE IF NOT EXISTS marts.prediction_sample (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id        text NOT NULL,
    city          text NOT NULL,
    room_type     text NOT NULL,
    actual_usd    double precision NOT NULL,
    predicted_usd double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS prediction_sample_city_idx ON marts.prediction_sample (city);

CREATE TABLE IF NOT EXISTS marts.neighbourhood_price_index (
    city                 text NOT NULL,
    neighbourhood        text NOT NULL,
    n_scored             bigint NOT NULL,
    median_actual_usd    double precision,
    median_predicted_usd double precision,
    price_index          double precision,
    PRIMARY KEY (city, neighbourhood)
);
