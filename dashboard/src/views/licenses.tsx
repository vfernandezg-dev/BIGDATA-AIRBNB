import type { Metadata } from "next";

import { DataTable } from "@/components/data-table";
import { LegalSection } from "@/components/legal";
import type { Locale } from "@/i18n/config";
import { formatters, type Formatters } from "@/i18n/format";
import { localizeCities } from "@/i18n/labels";
import { licensesMessages } from "@/i18n/messages/licenses";
import { pageAlternates } from "@/i18n/metadata";
import { getCities, getPublication, type CitySummary } from "@/lib/queries";
import { SITE } from "@/lib/site";

export function licensesMetadata(lang: Locale): Metadata {
  const t = licensesMessages[lang];
  return { title: t.title, description: t.description, alternates: pageAlternates(lang, "licenses") };
}

/** Periodo que cubren los snapshots, en palabras: un mes, o el rango entre el primero y el último. */
function collectionPeriod(cities: CitySummary[], fmt: Formatters): { period: string; year: string } {
  const dates = cities.map((city) => city.snapshot_date).sort();
  const first = fmt.monthLong(dates[0]);
  const last = fmt.monthLong(dates[dates.length - 1]);
  return { period: first === last ? last : `${first} – ${last}`, year: dates[dates.length - 1].slice(0, 4) };
}

export async function LicensesView({ lang }: { lang: Locale }) {
  const [allCities, publication] = await Promise.all([getCities(), getPublication()]);
  const t = licensesMessages[lang];
  const fmt = formatters(lang);
  const cities = localizeCities(lang, allCities);
  const byName = [...cities].sort((a, b) => a.name.localeCompare(b.name, lang));
  const collection = cities.length > 0 ? collectionPeriod(cities, fmt) : null;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-3 leading-relaxed text-ink-2">{t.intro}</p>
      </header>

      <LegalSection id="datos" title={t.data.title}>
        <p>{t.data.source}</p>
        <p>{t.data.snapshots}</p>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption={t.data.caption}
            rows={byName}
            rowKey={(city) => city.slug}
            columns={[
              { header: t.data.columns.city, cell: (city) => city.name },
              { header: t.data.columns.collected, cell: (city) => fmt.date(city.snapshot_date) },
              {
                header: t.data.columns.citation,
                cell: (city) => t.data.citation(city.name, fmt.monthLong(city.snapshot_date)),
              },
            ]}
          />
        </div>
        {collection ? (
          <>
            <p>{t.data.referenceIntro}</p>
            <blockquote className="border-l-2 border-axis pl-4 text-ink">
              {t.data.reference(collection.year, cities.length, collection.period)}
            </blockquote>
          </>
        ) : null}
      </LegalSection>

      <LegalSection id="modificaciones" title={t.changes.title}>
        <p>{t.changes.intro}</p>
        <ul className="list-disc space-y-2 pl-5">
          {t.changes.items(publication ? fmt.date(publication.fx_as_of) : null).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t.changes.noRedistribution}</p>
        <p>{t.changes.noEndorsement}</p>
      </LegalSection>

      <LegalSection id="mapas" title={t.maps.title}>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t.maps.cityMaps}</li>
          <li>{t.maps.worldMap}</li>
        </ul>
      </LegalSection>

      <LegalSection id="software" title={t.software.title}>
        <p>{t.software.intro}</p>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-surface p-3">
          <DataTable
            caption={t.software.caption}
            rows={t.software.rows}
            rowKey={(row) => row.name}
            columns={[
              { header: t.software.columns.component, cell: (row) => row.name },
              { header: t.software.columns.use, cell: (row) => row.use },
              { header: t.software.columns.license, cell: (row) => row.license },
            ]}
          />
        </div>
      </LegalSection>

      <LegalSection id="autoria" title={t.authorship.title}>
        <p>{t.authorship.intro}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t.authorship.figures}</li>
          <li>{t.authorship.code}</li>
        </ul>
      </LegalSection>

      <LegalSection id="marcas" title={t.trademarks.title}>
        <p>{t.trademarks.text}</p>
      </LegalSection>

      <p className="text-xs text-muted">{t.reviewed(fmt.date(SITE.legalUpdated))}</p>
    </div>
  );
}
