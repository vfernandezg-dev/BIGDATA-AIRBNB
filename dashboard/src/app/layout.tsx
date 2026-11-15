import type { Metadata } from "next";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import { getPublication } from "@/lib/queries";
import { SITE, SOURCE } from "@/lib/site";

import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BigData Airbnb · El alquiler turístico en 12 ciudades",
    template: "%s · BigData Airbnb",
  },
  description:
    "Precios, oferta y demanda del alquiler turístico en 12 ciudades, a partir de los datos abiertos de Inside Airbnb procesados con Apache Spark y Hadoop.",
  openGraph: { type: "website", locale: "es", siteName: "BigData Airbnb" },
};

const NAVIGATION = [
  { href: "/", label: "Panorama" },
  { href: "/modelo", label: "Modelo de precios" },
  { href: "/metodologia", label: "Metodología" },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publication = await getPublication();

  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Saltar al contenido
        </a>
        <header className="border-b border-hairline bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-5 py-4">
            <Link href="/" className="rounded text-base font-semibold tracking-tight text-ink">
              BigData Airbnb
            </Link>
            <nav aria-label="Secciones">
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2">
                {NAVIGATION.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="rounded underline-offset-4 hover:text-ink hover:underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
          {children}
        </main>

        <footer className="border-t border-hairline bg-surface">
          <div className="mx-auto w-full max-w-6xl space-y-3 px-5 py-6 text-xs leading-relaxed text-ink-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
              <p className="text-sm text-ink">
                Desarrollado por{" "}
                <a
                  href={SITE.author.url}
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-ink-2"
                >
                  {SITE.author.name}
                </a>
              </p>
              <nav aria-label="Información legal">
                <ul className="flex flex-wrap gap-x-5 gap-y-1">
                  <li>
                    <Link href="/licencias" className="underline-offset-4 hover:text-ink hover:underline">
                      Fuentes y licencias
                    </Link>
                  </li>
                  <li>
                    <Link href="/terminos" className="underline-offset-4 hover:text-ink hover:underline">
                      Términos de uso
                    </Link>
                  </li>
                  <li>
                    <a
                      href={SITE.repository}
                      rel="noreferrer"
                      className="underline-offset-4 hover:text-ink hover:underline"
                    >
                      Código en GitHub
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
            <p>
              Datos de{" "}
              <a href={SOURCE.url} className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
                {SOURCE.name}
              </a>{" "}
              (
              <a href={SOURCE.licenseUrl} className="underline underline-offset-2 hover:text-ink" rel="noreferrer">
                CC BY 4.0
              </a>
              ), limpiados, convertidos a dólares y agregados por este proyecto. Sitio independiente y sin
              ánimo de lucro: no está afiliado a Airbnb, Inc. ni a {SOURCE.name}, ni cuenta con su respaldo.
            </p>
            {publication ? (
              <p className="text-muted">
                Datos publicados el {formatDate(publication.published_at)} · Precios convertidos a USD con el
                tipo de cambio del {formatDate(publication.fx_as_of)}.
              </p>
            ) : null}
          </div>
        </footer>
      </body>
    </html>
  );
}
