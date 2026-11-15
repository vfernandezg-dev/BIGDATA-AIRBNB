"""Contratos de columnas de los archivos de Inside Airbnb.

Bronze conforma cada archivo a su contrato: las columnas que falten quedan nulas y las que sobren se guardan
en `_extra_columns`. Así un cambio de esquema en el origen (ocurre entre snapshots) nunca desplaza columnas.
Los contratos reflejan los archivos de septiembre de 2026: 90 columnas en listings, frente a las 75 que
documenta el diccionario de datos oficial.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DatasetContract:
    name: str
    source_folder: str
    source_file: str
    columns: tuple[str, ...]
    # Los campos de texto libre contienen saltos de línea dentro de comillas: sin multiLine cada salto se
    # lee como un registro nuevo y desplaza las columnas.
    multiline: bool
    key_columns: tuple[str, ...]


LISTINGS = DatasetContract(
    name="listings",
    source_folder="data",
    source_file="listings.csv.gz",
    multiline=True,
    key_columns=("id",),
    columns=(
        "id",
        "listing_url",
        "scrape_id",
        "last_scraped",
        "source",
        "name",
        "description",
        "neighborhood_overview",
        "picture_url",
        "host_id",
        "host_url",
        "host_profile_id",
        "host_profile_url",
        "host_name",
        "host_since",
        "hosts_time_as_user_years",
        "hosts_time_as_user_months",
        "hosts_time_as_host_years",
        "hosts_time_as_host_months",
        "host_location",
        "host_about",
        "host_response_time",
        "host_response_rate",
        "host_acceptance_rate",
        "host_is_superhost",
        "host_thumbnail_url",
        "host_picture_url",
        "host_neighbourhood",
        "host_listings_count",
        "host_total_listings_count",
        "host_verifications",
        "host_has_profile_pic",
        "host_identity_verified",
        "neighbourhood",
        "neighbourhood_cleansed",
        "neighbourhood_group_cleansed",
        "latitude",
        "longitude",
        "property_type",
        "room_type",
        "accommodates",
        "bathrooms",
        "bathrooms_text",
        "bedrooms",
        "beds",
        "amenities",
        "price",
        "price_quote_checkin_date",
        "price_quote_checkout_date",
        "price_quote_total_price",
        "price_quote_price_per_night",
        "price_quote_raw",
        "minimum_nights",
        "maximum_nights",
        "minimum_minimum_nights",
        "maximum_minimum_nights",
        "minimum_maximum_nights",
        "maximum_maximum_nights",
        "minimum_nights_avg_ntm",
        "maximum_nights_avg_ntm",
        "calendar_updated",
        "has_availability",
        "availability_30",
        "availability_60",
        "availability_90",
        "availability_365",
        "calendar_last_scraped",
        "number_of_reviews",
        "number_of_reviews_ltm",
        "number_of_reviews_l30d",
        "availability_eoy",
        "number_of_reviews_ly",
        "estimated_occupancy_l365d",
        "estimated_revenue_l365d",
        "first_review",
        "last_review",
        "review_scores_rating",
        "review_scores_accuracy",
        "review_scores_cleanliness",
        "review_scores_checkin",
        "review_scores_communication",
        "review_scores_location",
        "review_scores_value",
        "license",
        "instant_bookable",
        "calculated_host_listings_count",
        "calculated_host_listings_count_entire_homes",
        "calculated_host_listings_count_private_rooms",
        "calculated_host_listings_count_shared_rooms",
        "reviews_per_month",
    ),
)

CALENDAR = DatasetContract(
    name="calendar",
    source_folder="data",
    source_file="calendar.csv.gz",
    multiline=False,
    key_columns=("listing_id", "date"),
    # `price` y `adjusted_price` ya no se publican; se conservan en el contrato por si vuelven.
    columns=(
        "listing_id",
        "date",
        "available",
        "price",
        "adjusted_price",
        "minimum_nights",
        "maximum_nights",
    ),
)

REVIEWS = DatasetContract(
    name="reviews",
    source_folder="data",
    source_file="reviews.csv.gz",
    multiline=True,
    key_columns=("id",),
    columns=("listing_id", "id", "date", "reviewer_id", "reviewer_name", "comments"),
)

NEIGHBOURHOODS = DatasetContract(
    name="neighbourhoods",
    source_folder="visualisations",
    source_file="neighbourhoods.csv",
    multiline=False,
    key_columns=("neighbourhood",),
    columns=("neighbourhood_group", "neighbourhood"),
)

CONTRACTS: dict[str, DatasetContract] = {
    contract.name: contract for contract in (LISTINGS, CALENDAR, REVIEWS, NEIGHBOURHOODS)
}
DATASETS: tuple[str, ...] = tuple(CONTRACTS)
