import { expect, test, type Page } from "@playwright/test";

/**
 * Pruebas de humo: cada página carga, muestra sus gráficos y no deja errores en la consola.
 * Guardan además una captura de página completa por dispositivo en e2e/.results/, para revisarla a ojo.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test("panorama: cifras, gráficos y enlaces a las ciudades", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("El alquiler turístico en");
  await expect(page.getByText("Anuncios analizados")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Precio mediano por noche" })).toBeVisible();
  await expect(page.getByRole("group", { name: /reseñas por mes/i })).toBeVisible();
  await expect(page.getByRole("table", { name: "Indicadores por ciudad" }).getByRole("row")).not.toHaveCount(0);

  await screenshot(page, "panorama");
  expect(errors).toEqual([]);
});

test("ciudad: mapa, distribución de precios y barrios", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/ciudad/santiago");

  await expect(page.getByRole("heading", { level: 1, name: "Santiago" })).toBeVisible();
  await expect(page.getByText("Precio mediano por noche").first()).toBeVisible();
  // El lienzo del mapa aparece cuando MapLibre termina de cargar el estilo y las celdas.
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Distribución de precios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Los barrios más caros" })).toBeVisible();

  // Las teselas del mapa base siguen llegando: no se espera a que la red quede inactiva.
  await page.waitForTimeout(4_000);
  await screenshot(page, "ciudad-santiago");
  expect(errors).toEqual([]);
});

test("ciudad: el detalle de una columna aparece con el teclado", async ({ page, isMobile }) => {
  test.skip(isMobile, "La navegación con tabulador es de escritorio.");
  await page.goto("/ciudad/madrid");

  const column = page.getByRole("img", { name: /^De US\$ \d+ a \d+: / }).first();
  await column.focus();
  await expect(page.getByRole("status")).toContainText("anuncios");
});

test("modelo: métricas, importancia de variables y dispersión", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/modelo");

  await expect(page.getByText("Varianza explicada (R²)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qué variables pesan más" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Dispersión del precio predicho/ })).toBeVisible();

  await screenshot(page, "modelo");
  expect(errors).toEqual([]);
});

test("metodología: etapas del pipeline y tablas de calidad", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/metodologia");

  await expect(page.getByRole("heading", { name: "Bronze" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Calidad de los anuncios por ciudad" })).toBeVisible();

  await screenshot(page, "metodologia");
  expect(errors).toEqual([]);
});

test("una ciudad desconocida muestra la página de no encontrado", async ({ page }) => {
  await page.goto("/ciudad/atlantis");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("la revalidación exige el secreto", async ({ request }) => {
  const withoutSecret = await request.post("/api/revalidate");
  expect(withoutSecret.status()).toBe(401);

  const wrongSecret = await request.post("/api/revalidate", { headers: { "x-revalidate-secret": "incorrecto" } });
  expect(wrongSecret.status()).toBe(401);
});
