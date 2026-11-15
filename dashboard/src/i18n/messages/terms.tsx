/**
 * Textos de los términos de uso.
 *
 * Cada sección se escribe completa en cada idioma (ver la nota de `licenses.tsx`). El español es la versión
 * de referencia: la sección final de ambas lo dice.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { ExternalLink, Term } from "@/components/legal";
import { SITE, SOURCE } from "@/lib/site";

import type { Locale } from "../config";
import { pathFor } from "../routes";

const internalLink = "underline underline-offset-2 hover:text-ink";

export type TermsMessages = {
  /** Título de la pestaña del navegador; el de la página es más largo. */
  metaTitle: string;
  description: string;
  title: string;
  intro: string;
  updated: (date: string) => string;
  sections: { id: string; title: string; body: ReactNode }[];
};

const es: TermsMessages = {
  metaTitle: "Términos de uso",
  description:
    "Condiciones de uso de este sitio: qué puedes hacer con su contenido, qué límites tiene la información y cómo se trata tu privacidad.",
  title: "Términos y condiciones de uso",
  intro:
    "Al usar este sitio aceptas estos términos. Son breves a propósito: el sitio solo muestra información y no te pide nada a cambio.",
  updated: (date) => `Última actualización: ${date}.`,
  sections: [
    {
      id: "que-es",
      title: "1. Qué es este sitio",
      body: (
        <p>
          {SITE.name} es un proyecto académico y de portafolio de{" "}
          <ExternalLink href={SITE.author.url}>{SITE.author.name}</ExternalLink>. Analiza datos públicos del alquiler
          turístico y muestra los resultados. No tiene ánimo de lucro: no vende nada, no muestra publicidad y no
          requiere registro.
        </p>
      ),
    },
    {
      id: "uso",
      title: "2. Qué puedes hacer",
      body: (
        <>
          <p>
            Puedes consultar el sitio, enlazarlo y citar sus cifras y gráficos con la atribución que se indica en{" "}
            <Link href={pathFor("es", "licenses")} className={internalLink}>
              fuentes y licencias
            </Link>
            . A cambio, te pido que no hagas lo siguiente:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Presentar estas cifras como datos oficiales, o como publicados o avalados por Airbnb o por {SOURCE.name}
              .
            </li>
            <li>Usar el sitio para intentar identificar, localizar o molestar a personas concretas.</li>
            <li>
              Descargar el sitio de forma masiva o automatizada. Hay un límite de peticiones por dirección IP; si
              necesitas los datos, están disponibles en{" "}
              <ExternalLink href={SOURCE.dataUrl}>{SOURCE.name}</ExternalLink>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "informacion",
      title: "3. La información es orientativa",
      body: (
        <>
          <p>Las cifras describen los datos disponibles, con límites que conviene tener presentes:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Term>Los precios son los anunciados,</Term> no los que finalmente se pagan, y muchos anuncios no
              publican precio.
            </li>
            <li>
              <Term>La ocupación es una estimación</Term> de {SOURCE.name} a partir de las reseñas, no un dato
              observado.
            </li>
            <li>
              <Term>Cada ciudad es una fotografía</Term> de una fecha concreta; la situación puede haber cambiado.
            </li>
            <li>
              <Term>Los importes en dólares</Term> usan un tipo de cambio fijo, pensado para comparar ciudades y no
              para reflejar el cambio de cada día.
            </li>
          </ul>
          <p>
            Pese al cuidado puesto en el proceso, puede haber errores, tanto en los datos de origen como en su
            tratamiento. La{" "}
            <Link href={pathFor("es", "methodology")} className={internalLink}>
              metodología
            </Link>{" "}
            explica cómo se obtiene cada cifra.
          </p>
        </>
      ),
    },
    {
      id: "asesoramiento",
      title: "4. No es asesoramiento",
      body: (
        <p>
          Nada de lo que aparece aquí constituye asesoramiento inmobiliario, financiero, fiscal ni legal. El modelo
          de precios es un ejercicio estadístico: sus estimaciones no son una tasación ni una recomendación de
          precio. Si vas a tomar una decisión con consecuencias económicas, contrasta la información con fuentes
          oficiales y con un profesional.
        </p>
      ),
    },
    {
      id: "responsabilidad",
      title: "5. Sin garantías",
      body: (
        <p>
          El sitio se ofrece tal cual, sin garantías de exactitud, de actualización ni de disponibilidad. En la
          medida en que la ley lo permita, el autor no responde de los daños o pérdidas que puedan derivarse de usar
          el sitio o de confiar en su contenido.
        </p>
      ),
    },
    {
      id: "privacidad",
      title: "6. Privacidad",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Term>Sin cookies ni seguimiento.</Term> El sitio no usa cookies, herramientas de analítica ni
            publicidad, y no tiene formularios ni cuentas de usuario. El idioma en que lo lees va en la propia
            dirección de la página: no se guarda en tu navegador.
          </li>
          <li>
            <Term>Datos técnicos.</Term> El proveedor de alojamiento (Vercel) trata los datos necesarios para servir
            las páginas y protegerlas, como tu dirección IP, que también se usa para aplicar el límite de
            peticiones.
          </li>
          <li>
            <Term>Mapas.</Term> Al abrir el mapa de una ciudad, tu navegador descarga las teselas directamente de
            OpenFreeMap, que recibe esa petición como cualquier servidor web.
          </li>
          <li>
            <Term>Datos mostrados.</Term> Se publican agregados y, en el gráfico del modelo, una muestra anónima de
            precios. El sitio no muestra nombres de anfitriones, textos de reseñas, direcciones ni identificadores
            de anuncios.
          </li>
        </ul>
      ),
    },
    {
      id: "propiedad",
      title: "7. Contenido de terceros y enlaces",
      body: (
        <p>
          Los datos, los mapas y el software de terceros conservan sus propias licencias, detalladas en{" "}
          <Link href={pathFor("es", "licenses")} className={internalLink}>
            fuentes y licencias
          </Link>
          . Los enlaces a otros sitios se ofrecen como referencia; su contenido y sus condiciones no dependen de
          este proyecto.
        </p>
      ),
    },
    {
      id: "cambios",
      title: "8. Cambios, idiomas y contacto",
      body: (
        <>
          <p>
            Estos términos pueden actualizarse cuando cambie el sitio; la fecha del principio indica la última
            revisión. Para cualquier consulta, corrección o solicitud relacionada con el contenido, puedes{" "}
            <ExternalLink href={SITE.contact}>abrir una incidencia en el repositorio</ExternalLink>.
          </p>
          <p>
            Estos términos están disponibles en español y en inglés. Si las dos versiones difieren, prevalece la
            versión en español.
          </p>
        </>
      ),
    },
  ],
};

const en: TermsMessages = {
  metaTitle: "Terms of use",
  description:
    "Conditions for using this site: what you can do with its content, the limits of the information and how your privacy is handled.",
  title: "Terms and conditions of use",
  intro:
    "By using this site you accept these terms. They are short on purpose: the site only shows information and asks nothing of you in return.",
  updated: (date) => `Last updated: ${date}.`,
  sections: [
    {
      id: "about",
      title: "1. What this site is",
      body: (
        <p>
          {SITE.name} is an academic and portfolio project by{" "}
          <ExternalLink href={SITE.author.url}>{SITE.author.name}</ExternalLink>. It analyzes public data on
          short-term rentals and shows the results. It is non-profit: it sells nothing, shows no advertising and
          requires no sign-up.
        </p>
      ),
    },
    {
      id: "use",
      title: "2. What you can do",
      body: (
        <>
          <p>
            You may browse the site, link to it and cite its figures and charts with the attribution described in{" "}
            <Link href={pathFor("en", "licenses")} className={internalLink}>
              sources and licenses
            </Link>
            . In return, I ask that you do not do the following:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Present these figures as official data, or as published or endorsed by Airbnb or by {SOURCE.name}.
            </li>
            <li>Use the site to try to identify, locate or harass specific people.</li>
            <li>
              Download the site in bulk or by automated means. There is a request limit per IP address; if you need
              the data, it is available from <ExternalLink href={SOURCE.dataUrl}>{SOURCE.name}</ExternalLink>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "information",
      title: "3. The information is indicative",
      body: (
        <>
          <p>The figures describe the available data, with limits worth keeping in mind:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Term>Prices are the advertised ones,</Term> not those finally paid, and many listings do not publish a
              price.
            </li>
            <li>
              <Term>Occupancy is an estimate</Term> made by {SOURCE.name} from reviews, not an observed figure.
            </li>
            <li>
              <Term>Each city is a snapshot</Term> of a specific date; the situation may have changed since.
            </li>
            <li>
              <Term>Amounts in US dollars</Term> use a fixed exchange rate, meant for comparing cities and not for
              reflecting each day&apos;s rate.
            </li>
          </ul>
          <p>
            Despite the care put into the process, there may be errors, both in the source data and in how it is
            processed. The{" "}
            <Link href={pathFor("en", "methodology")} className={internalLink}>
              methodology
            </Link>{" "}
            explains how each figure is obtained.
          </p>
        </>
      ),
    },
    {
      id: "advice",
      title: "4. This is not advice",
      body: (
        <p>
          Nothing shown here constitutes real estate, financial, tax or legal advice. The price model is a
          statistical exercise: its estimates are not a valuation or a price recommendation. If you are about to
          make a decision with financial consequences, check the information against official sources and with a
          professional.
        </p>
      ),
    },
    {
      id: "warranty",
      title: "5. No warranties",
      body: (
        <p>
          The site is provided as is, with no warranties of accuracy, currency or availability. To the extent
          permitted by law, the author is not liable for any damage or loss that may result from using the site or
          relying on its content.
        </p>
      ),
    },
    {
      id: "privacy",
      title: "6. Privacy",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Term>No cookies or tracking.</Term> The site does not use cookies, analytics tools or advertising, and
            has no forms or user accounts. The language you read it in is part of the page address: nothing is
            stored in your browser.
          </li>
          <li>
            <Term>Technical data.</Term> The hosting provider (Vercel) processes the data needed to serve the pages
            and protect them, such as your IP address, which is also used to apply the request limit.
          </li>
          <li>
            <Term>Maps.</Term> When you open a city map, your browser downloads the tiles directly from OpenFreeMap,
            which receives that request like any web server.
          </li>
          <li>
            <Term>Data shown.</Term> The site publishes aggregates and, in the model chart, an anonymous sample of
            prices. It does not show host names, review texts, addresses or listing identifiers.
          </li>
        </ul>
      ),
    },
    {
      id: "third-party",
      title: "7. Third-party content and links",
      body: (
        <p>
          Third-party data, maps and software keep their own licenses, detailed in{" "}
          <Link href={pathFor("en", "licenses")} className={internalLink}>
            sources and licenses
          </Link>
          . Links to other sites are offered for reference; their content and conditions do not depend on this
          project.
        </p>
      ),
    },
    {
      id: "changes",
      title: "8. Changes, languages and contact",
      body: (
        <>
          <p>
            These terms may be updated when the site changes; the date at the top shows the latest revision. For any
            question, correction or request about the content, you can{" "}
            <ExternalLink href={SITE.contact}>open an issue in the repository</ExternalLink>.
          </p>
          <p>
            These terms are available in Spanish and English. If the two versions differ, the Spanish version
            prevails.
          </p>
        </>
      ),
    },
  ],
};

export const termsMessages: Record<Locale, TermsMessages> = { es, en };
