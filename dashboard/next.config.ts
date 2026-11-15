import type { NextConfig } from "next";

// El mapa carga su estilo y sus teselas de OpenFreeMap; el resto del sitio solo habla consigo mismo.
const MAP_TILES = "https://tiles.openfreemap.org";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_TILES}`,
  `connect-src 'self' ${MAP_TILES}`,
  "worker-src 'self' blob:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // En desarrollo Next necesita evaluar código para la recarga en caliente, así que la política solo se
  // aplica al sitio construido.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

// Secciones que existían antes de que el sitio tuviera dos idiomas: sus direcciones eran las de español,
// sin prefijo. Se conservan como redirecciones permanentes para no romper los enlaces ya publicados.
const SPANISH_SECTIONS = ["modelo", "metodologia", "licencias", "terminos"];

const nextConfig: NextConfig = {
  // Las consultas a la base de datos se cachean con `use cache` y las páginas se pre-renderizan: una visita
  // normal no ejecuta ninguna consulta. La caché se invalida al publicar datos nuevos (/api/revalidate).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * El idioma va en la dirección (`/es/...`, `/en/...`) y cada uno tiene su árbol de rutas en `src/app`.
   * Estas reglas se resuelven en el enrutador, antes de llegar a ninguna página: no ejecutan código del
   * sitio ni necesitan cookies.
   */
  async redirects() {
    return [
      // La raíz elige idioma según el navegador: español si es su primera preferencia, inglés si pide
      // cualquier otro, y español (el idioma de referencia) si no dice nada, como hacen los buscadores.
      {
        source: "/",
        has: [{ type: "header", key: "accept-language", value: "es.*" }],
        destination: "/es",
        permanent: false,
      },
      { source: "/", has: [{ type: "header", key: "accept-language" }], destination: "/en", permanent: false },
      { source: "/", destination: "/es", permanent: false },

      { source: "/ciudad/:slug", destination: "/es/ciudad/:slug", permanent: true },
      ...SPANISH_SECTIONS.map((section) => ({
        source: `/${section}`,
        destination: `/es/${section}`,
        permanent: true,
      })),

      // Cualquier otra dirección sin idioma pasa a español, donde se muestra la página "no encontrada" del
      // sitio. Se excluyen la API, los archivos internos de Next y todo lo que tenga extensión.
      {
        source: "/:path((?!es(?:/|$)|en(?:/|$)|api(?:/|$)|_next(?:/|$))[^.]+)",
        destination: "/es/:path",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
