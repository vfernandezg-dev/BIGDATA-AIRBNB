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
};

export default nextConfig;
