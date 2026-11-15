import type { Metadata } from "next";
import Link from "next/link";

import { ExternalLink, LegalSection, Term } from "@/components/legal";
import { formatDate } from "@/lib/format";
import { SITE, SOURCE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones de uso de este sitio: qué puedes hacer con su contenido, qué límites tiene la información y cómo se trata tu privacidad.",
};

const internalLink = "underline underline-offset-2 hover:text-ink";

export default function TermsPage() {
  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Términos y condiciones de uso</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Al usar este sitio aceptas estos términos. Son breves a propósito: el sitio solo muestra información
          y no te pide nada a cambio.
        </p>
        <p className="mt-2 text-xs text-muted">Última actualización: {formatDate(SITE.legalUpdated)}.</p>
      </header>

      <LegalSection id="que-es" title="1. Qué es este sitio">
        <p>
          {SITE.name} es un proyecto académico y de portafolio de{" "}
          <ExternalLink href={SITE.author.url}>{SITE.author.name}</ExternalLink>. Analiza datos públicos del
          alquiler turístico y muestra los resultados. No tiene ánimo de lucro: no vende nada, no muestra
          publicidad y no requiere registro.
        </p>
      </LegalSection>

      <LegalSection id="uso" title="2. Qué puedes hacer">
        <p>
          Puedes consultar el sitio, enlazarlo y citar sus cifras y gráficos con la atribución que se indica en{" "}
          <Link href="/licencias" className={internalLink}>
            fuentes y licencias
          </Link>
          . A cambio, te pido que no hagas lo siguiente:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Presentar estas cifras como datos oficiales, o como publicados o avalados por Airbnb o por{" "}
            {SOURCE.name}.
          </li>
          <li>Usar el sitio para intentar identificar, localizar o molestar a personas concretas.</li>
          <li>
            Descargar el sitio de forma masiva o automatizada. Hay un límite de peticiones por dirección IP;
            si necesitas los datos, están disponibles en{" "}
            <ExternalLink href={SOURCE.dataUrl}>{SOURCE.name}</ExternalLink>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="informacion" title="3. La información es orientativa">
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
            <Term>Cada ciudad es una fotografía</Term> de una fecha concreta; la situación puede haber
            cambiado.
          </li>
          <li>
            <Term>Los importes en dólares</Term> usan un tipo de cambio fijo, pensado para comparar ciudades y
            no para reflejar el cambio de cada día.
          </li>
        </ul>
        <p>
          Pese al cuidado puesto en el proceso, puede haber errores, tanto en los datos de origen como en su
          tratamiento. La{" "}
          <Link href="/metodologia" className={internalLink}>
            metodología
          </Link>{" "}
          explica cómo se obtiene cada cifra.
        </p>
      </LegalSection>

      <LegalSection id="asesoramiento" title="4. No es asesoramiento">
        <p>
          Nada de lo que aparece aquí constituye asesoramiento inmobiliario, financiero, fiscal ni legal. El
          modelo de precios es un ejercicio estadístico: sus estimaciones no son una tasación ni una
          recomendación de precio. Si vas a tomar una decisión con consecuencias económicas, contrasta la
          información con fuentes oficiales y con un profesional.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidad" title="5. Sin garantías">
        <p>
          El sitio se ofrece tal cual, sin garantías de exactitud, de actualización ni de disponibilidad. En
          la medida en que la ley lo permita, el autor no responde de los daños o pérdidas que puedan derivarse
          de usar el sitio o de confiar en su contenido.
        </p>
      </LegalSection>

      <LegalSection id="privacidad" title="6. Privacidad">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Term>Sin cookies ni seguimiento.</Term> El sitio no usa cookies, herramientas de analítica ni
            publicidad, y no tiene formularios ni cuentas de usuario.
          </li>
          <li>
            <Term>Datos técnicos.</Term> El proveedor de alojamiento (Vercel) trata los datos necesarios para
            servir las páginas y protegerlas, como tu dirección IP, que también se usa para aplicar el límite
            de peticiones.
          </li>
          <li>
            <Term>Mapas.</Term> Al abrir el mapa de una ciudad, tu navegador descarga las teselas directamente
            de OpenFreeMap, que recibe esa petición como cualquier servidor web.
          </li>
          <li>
            <Term>Datos mostrados.</Term> Se publican agregados y, en el gráfico del modelo, una muestra
            anónima de precios. El sitio no muestra nombres de anfitriones, textos de reseñas, direcciones ni
            identificadores de anuncios.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="propiedad" title="7. Contenido de terceros y enlaces">
        <p>
          Los datos, los mapas y el software de terceros conservan sus propias licencias, detalladas en{" "}
          <Link href="/licencias" className={internalLink}>
            fuentes y licencias
          </Link>
          . Los enlaces a otros sitios se ofrecen como referencia; su contenido y sus condiciones no dependen
          de este proyecto.
        </p>
      </LegalSection>

      <LegalSection id="cambios" title="8. Cambios y contacto">
        <p>
          Estos términos pueden actualizarse cuando cambie el sitio; la fecha del principio indica la última
          revisión. Para cualquier consulta, corrección o solicitud relacionada con el contenido, puedes{" "}
          <ExternalLink href={SITE.contact}>abrir una incidencia en el repositorio</ExternalLink>.
        </p>
      </LegalSection>
    </div>
  );
}
