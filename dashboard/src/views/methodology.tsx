import type { Metadata } from "next";
import Link from "next/link";

import { DataTable } from "@/components/data-table";
import type { Locale } from "@/i18n/config";
import { formatters } from "@/i18n/format";
import { datasetLabel, localizeCities } from "@/i18n/labels";
import { methodologyMessages } from "@/i18n/messages/methodology";
import { pageAlternates } from "@/i18n/metadata";
import { pathFor } from "@/i18n/routes";
import { getCities, getListingQuality, getPublication, getStageCounts } from "@/lib/queries";
import { SOURCE, SOURCE_LICENSE } from "@/lib/site";

const link = "underline underline-offset-2 hover:text-ink";

export function methodologyMetadata(lang: Locale): Metadata {
  const t = methodologyMessages[lang];
  return { title: t.title, description: t.description, alternates: pageAlternates(lang, "methodology") };
}

export async function MethodologyView({ lang }: { lang: Locale }) {
  const [publication, allCities, stageCounts, listingQuality] = await Promise.all([
    getPublication(),
    getCities(),
    getStageCounts(),
    getListingQuality(),
  ]);
  const t = methodologyMessages[lang];
  const fmt = formatters(lang);
  const license = SOURCE_LICENSE[lang];
  const cityName = new Map(localizeCities(lang, allCities).map((city) => [city.slug, city.name]));
  const nameOf = (slug: string) => cityName.get(slug) ?? slug;
  const quality = [...listingQuality].sort((a, b) => nameOf(a.city).localeCompare(nameOf(b.city), lang));
  const counts = [...stageCounts].sort(
    (a, b) => nameOf(a.city).localeCompare(nameOf(b.city), lang) || a.dataset.localeCompare(b.dataset),
  );

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          {t.intro}
          {publication
            ? t.publication(
                fmt.date(publication.published_at),
                fmt.int(publication.n_listings),
                fmt.int(publication.n_cities),
              )
            : ""}
        </p>
      </header>

      <section aria-labelledby="pipeline" className="max-w-3xl">
        <h2 id="pipeline" className="text-xl font-semibold tracking-tight text-ink">
          {t.pipeline.title}
        </h2>
        <ol className="mt-4 space-y-4">
          {t.pipeline.stages.map((stage, index) => (
            <li key={stage.name} className="flex gap-4">
              <span
                aria-hidden
                className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-axis text-xs font-semibold text-ink-2"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">{stage.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{stage.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="calidad">
        <h2 id="calidad" className="text-xl font-semibold tracking-tight text-ink">
          {t.quality.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">{t.quality.intro}</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption={t.quality.caption}
            rows={quality}
            rowKey={(row) => row.city}
            columns={[
              { header: t.quality.columns.city, cell: (row) => nameOf(row.city) },
              { header: t.quality.columns.listings, align: "right", cell: (row) => fmt.int(row.n_listings) },
              {
                header: t.quality.columns.withPrice,
                align: "right",
                cell: (row) => `${fmt.int(row.n_with_price)} (${fmt.percent(row.n_with_price / row.n_listings)})`,
              },
              { header: t.quality.columns.priceOutlier, align: "right", cell: (row) => fmt.int(row.n_price_outliers) },
              { header: t.quality.columns.outsideCity, align: "right", cell: (row) => fmt.int(row.n_geo_invalid) },
              {
                header: t.quality.columns.invalidType,
                align: "right",
                cell: (row) => fmt.int(row.n_room_type_invalid),
              },
              {
                header: t.quality.columns.modelEligible,
                align: "right",
                cell: (row) => `${fmt.int(row.n_model_eligible)} (${fmt.percent(row.n_model_eligible / row.n_listings)})`,
              },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="volumen">
        <h2 id="volumen" className="text-xl font-semibold tracking-tight text-ink">
          {t.volume.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">{t.volume.intro}</p>
        <div className="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption={t.volume.caption}
            rows={counts}
            rowKey={(row) => `${row.city}-${row.dataset}`}
            columns={[
              { header: t.volume.columns.city, cell: (row) => nameOf(row.city) },
              { header: t.volume.columns.dataset, cell: (row) => datasetLabel(lang, row.dataset) },
              { header: t.volume.columns.snapshot, align: "right", cell: (row) => fmt.date(row.snapshot_date) },
              { header: "Bronze", align: "right", cell: (row) => fmt.int(row.bronze_rows) },
              { header: "Silver", align: "right", cell: (row) => fmt.int(row.silver_rows) },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="limites" className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
        <h2 id="limites" className="text-xl font-semibold tracking-tight text-ink">
          {t.limits.title}
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          {t.limits.items(publication ? fmt.date(publication.fx_as_of) : null).map((item) => (
            <li key={item.lead}>
              <strong className="font-semibold text-ink">{item.lead}</strong>
              {item.text}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fuente" className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink-2">
        <h2 id="fuente" className="text-xl font-semibold tracking-tight text-ink">
          {t.source.title}
        </h2>
        <p>
          {t.source.dataFrom}{" "}
          <a href={SOURCE.dataUrl} className={link} rel="noreferrer">
            {SOURCE.name}
          </a>{" "}
          {t.source.usedUnder}{" "}
          <a href={license.url} className={link} rel="noreferrer">
            {license.name}
          </a>
          {t.source.ownWork}
        </p>
        <p>
          {t.source.detailsIn}{" "}
          <Link href={pathFor(lang, "licenses")} className={link}>
            {t.source.licensesLink}
          </Link>
          {t.source.conditionsIn}{" "}
          <Link href={pathFor(lang, "terms")} className={link}>
            {t.source.termsLink}
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
