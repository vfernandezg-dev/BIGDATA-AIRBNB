import { expect, test, type Page } from "@playwright/test";

/**
 * Pruebas de humo: cada página carga, dibuja sus gráficos y no deja errores en la consola.
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

/** Un gráfico de ECharts está dibujado cuando su lienzo existe dentro del contenedor etiquetado. */
async function expectChart(page: Page, name: RegExp) {
  const chart = page.getByRole("img", { name });
  await chart.scrollIntoViewIfNeeded();
  // Algunos gráficos (los mapas de calor) usan varios lienzos superpuestos: basta con el primero.
  await expect(chart.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  return chart;
}

test("panorama: cifras, gráficos y enlaces a las ciudades", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("El alquiler turístico en");
  await expect(page.getByText("Anuncios analizados")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Precio mediano por noche" })).toBeVisible();
  await expectChart(page, /Burbujas: precio mediano frente a ocupación/);
  await expectChart(page, /Mapa de calor: desviación mensual/);
  await expectChart(page, /Serie temporal: reseñas por mes/);
  await expectChart(page, /Barras apiladas: reparto de los anuncios/);
  await expect(page.getByRole("table", { name: "Indicadores por ciudad" }).getByRole("row")).not.toHaveCount(0);

  // Las animaciones de entrada terminan antes de la captura.
  await page.waitForTimeout(800);
  await screenshot(page, "panorama");
  expect(errors).toEqual([]);
});

test("ciudad: mapa, distribución de precios y barrios", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/ciudad/santiago");

  await expect(page.getByRole("heading", { level: 1, name: "Santiago" })).toBeVisible();
  await expect(page.getByText("Precio mediano por noche").first()).toBeVisible();
  // El lienzo del mapa aparece cuando MapLibre termina de cargar el estilo y las capas.
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await expectChart(page, /Histograma: número de anuncios/);
  await expectChart(page, /Rango de precios por tipo de alojamiento/);
  await expectChart(page, /Dispersión: número de anuncios frente a precio mediano/);
  await expectChart(page, /Mapa de calor: reseñas por año y mes/);
  await expect(page.getByRole("heading", { name: "Los barrios más caros" })).toBeVisible();

  // Las teselas del mapa base siguen llegando: no se espera a que la red quede inactiva.
  await page.waitForTimeout(4_000);
  await screenshot(page, "ciudad-santiago");
  expect(errors).toEqual([]);
});

test("ciudad: el mapa alterna entre mapa de calor y precio por celda", async ({ page }) => {
  await page.goto("/ciudad/madrid");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });

  const heat = page.getByRole("button", { name: "Mapa de calor" });
  const cells = page.getByRole("button", { name: "Precio por celda" });
  await expect(heat).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Escala del mapa de calor")).toContainText("mediana de la ciudad");

  await cells.click();
  await expect(cells).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Escala de precio mediano")).toContainText("Sin precio publicado");

  await page.waitForTimeout(2_500);
  await page.locator(".maplibregl-canvas").scrollIntoViewIfNeeded();
  await screenshot(page, "ciudad-madrid-celdas");
});

test("ciudad: el detalle de un gráfico aparece al pasar el cursor", async ({ page, isMobile }) => {
  test.skip(isMobile, "El detalle al pasar el cursor es de escritorio; en móvil se usa la tabla.");
  await page.goto("/ciudad/madrid");

  const chart = await expectChart(page, /Histograma: número de anuncios/);
  const box = await chart.boundingBox();
  if (!box) throw new Error("El histograma no tiene dimensiones");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);

  await expect(page.locator(".chart-tooltip").filter({ hasText: "anuncios" })).toBeVisible();
});

test("ciudad: cada gráfico tiene sus datos en tabla", async ({ page }) => {
  await page.goto("/ciudad/madrid");

  const card = page.locator("figure").filter({ hasText: "Distribución de precios" });
  await card.getByText("Ver los datos en tabla").click();

  await expect(card.getByRole("table", { name: "Anuncios por tramo de precio" }).getByRole("row").nth(1)).toBeVisible();
});

test("modelo: métricas, importancia de variables, dispersión y sesgo", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/modelo");

  await expect(page.getByText("Varianza explicada (R²)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qué variables pesan más" })).toBeVisible();
  await expectChart(page, /Dispersión del precio predicho/);
  await expectChart(page, /Barras: mediana de precio predicho entre precio real/);

  await page.waitForTimeout(800);
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
