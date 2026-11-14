import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Página no encontrada</h1>
      <p className="mt-3 leading-relaxed text-ink-2">
        Esa dirección no corresponde a ninguna ciudad ni sección de este sitio.
      </p>
      <Link href="/" className="mt-6 inline-block rounded text-sm font-medium text-ink underline underline-offset-4">
        Volver al panorama
      </Link>
    </div>
  );
}
