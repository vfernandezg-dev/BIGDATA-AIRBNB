import { defineConfig, devices } from "@playwright/test";

// Pruebas de humo. Por defecto arrancan el sitio construido (`pnpm build`) con los marts de la base local;
// con E2E_BASE_URL se ejecutan contra un sitio ya desplegado, por ejemplo el de producción:
//   E2E_BASE_URL=https://bigdata-airbnb.vfernandezg.dev pnpm e2e
const PORT = 3100;
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  fullyParallel: true,
  // La batería completa hace unas 1.100 peticiones. En local dura medio minuto; contra un sitio desplegado
  // va en un solo proceso y se reparte en unos dos minutos (la mitad del límite por IP de su firewall).
  workers: externalBaseUrl ? 1 : undefined,
  reporter: [["list"]],
  use: { baseURL: externalBaseUrl ?? `http://localhost:${PORT}` },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "escritorio-oscuro", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `pnpm exec next start --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
