import type { ReactNode } from "react";

/** Enlace a un sitio externo dentro de un texto. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
      {children}
    </a>
  );
}

/** Sección de una página de texto legal: título numerable y párrafos con el mismo ritmo que el resto del sitio. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 text-sm leading-relaxed text-ink-2">
      <h2 id={id} className="text-xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Término destacado al inicio de un punto de una lista. */
export function Term({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
