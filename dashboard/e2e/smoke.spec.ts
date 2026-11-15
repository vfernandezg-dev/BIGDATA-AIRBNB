import { expect, test, type Page } from "@playwright/test";

/**
 * Pruebas de humo: cada página carga, dibuja sus gráficos y no deja errores en la consola.
 * Guardan además una captura de página completa por dispositivo en e2e/.results/, para revisarla a ojo.
 *
 * El sitio tiene dos idiomas. El recorrido completo se hace en español (`/es/...`); del inglés (`/en/...`) se
 * comprueba que cada página está traducida, que el selector cambia de idioma y que las redirecciones llevan
 * a donde deben.
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
  await page.goto("/es");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("El alquiler turístico en");
  await expect(page.getByText("Anuncios analizados")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Precio mediano por noche" })).toBeVisible();
  await expectChart(page, /Mapamundi: precio mediano por noche/);
  await expectChart(page, /Burbujas: precio mediano frente a ocupación/);
  await expectChart(page, /Mapa de calor: desviación mensual/);
  await expectChart(page, /Serie temporal: reseñas por mes/);
  await expectChart(page, /Barras apiladas: reparto de los anuncios/);
  await expect(page.getByRole("table", { name: "Indicadores por ciudad" }).getByRole("row")).not.toHaveCount(0);
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Desarrollado por Valentin Fernandez");
  await expect(footer.getByRole("link", { name: "Valentin Fernandez" })).toHaveAttribute(
    "href",
    "https://vfernandezg.dev",
  );
  await expect(footer.getByRole("link", { name: "Código en GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/vfernandezg-dev/airbnb-market-analytics",
  );

  // Las animaciones de entrada terminan antes de la captura.
  await page.waitForTimeout(800);
  await screenshot(page, "panorama");
  expect(errors).toEqual([]);
});

test("panorama: el mapamundi cambia de encuadre", async ({ page }) => {
  await page.goto("/es");
  const chart = await expectChart(page, /Mapamundi: precio mediano por noche/);

  const world = page.getByRole("button", { name: "Mundo" });
  const europe = page.getByRole("button", { name: "Europa" });
  await expect(world).toHaveAttribute("aria-pressed", "true");
  await europe.click();
  await expect(europe).toHaveAttribute("aria-pressed", "true");
  await expect(chart.locator("canvas").first()).toBeVisible();

  await page.waitForTimeout(800);
  await chart.screenshot({ path: test.info().outputPath("mapamundi-europa.png") });
});

test("páginas legales: fuentes y licencias, y términos de uso", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/es/licencias");

  await expect(page.getByRole("heading", { level: 1, name: "Fuentes y licencias" })).toBeVisible();
  // Cada ciudad lleva la cita que pide la fuente: proveedor, lugar y fecha de recogida.
  await expect(page.getByRole("table", { name: /fecha de recogida/ })).toContainText("Fuente: Inside Airbnb, Santiago");
  await expect(page.getByRole("link", { name: "licencia MIT" })).toHaveAttribute(
    "href",
    "https://github.com/vfernandezg-dev/airbnb-market-analytics/blob/main/LICENSE",
  );
  await screenshot(page, "licencias");

  await page.getByRole("contentinfo").getByRole("link", { name: "Términos de uso" }).click();
  await expect(page).toHaveURL(/\/es\/terminos$/);
  await expect(page.getByRole("heading", { level: 1, name: "Términos y condiciones de uso" })).toBeVisible();
  await expect(page.getByText("Sin cookies ni seguimiento.")).toBeVisible();
  await screenshot(page, "terminos");
  expect(errors).toEqual([]);
});

test("ciudad: mapa, distribución de precios y barrios", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/es/ciudad/santiago");

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
  await page.goto("/es/ciudad/madrid");
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
  await page.goto("/es/ciudad/madrid");

  const chart = await expectChart(page, /Histograma: número de anuncios/);
  const box = await chart.boundingBox();
  if (!box) throw new Error("El histograma no tiene dimensiones");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);

  await expect(page.locator(".chart-tooltip").filter({ hasText: "anuncios" })).toBeVisible();
});

test("ciudad: cada gráfico tiene sus datos en tabla", async ({ page }) => {
  await page.goto("/es/ciudad/madrid");

  const card = page.locator("figure").filter({ hasText: "Distribución de precios" });
  await card.getByText("Ver los datos en tabla").click();

  await expect(card.getByRole("table", { name: "Anuncios por tramo de precio" }).getByRole("row").nth(1)).toBeVisible();
});

test("modelo: métricas, importancia de variables, dispersión y sesgo", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/es/modelo");

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
  await page.goto("/es/metodologia");

  await expect(page.getByRole("heading", { name: "Bronze" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Calidad de los anuncios por ciudad" })).toBeVisible();

  await screenshot(page, "metodologia");
  expect(errors).toEqual([]);
});

test("una dirección desconocida muestra la página de no encontrado de su idioma", async ({ page }) => {
  await page.goto("/es/ciudad/atlantis");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();

  await page.goto("/en/city/atlantis");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // Sin idioma en la dirección, se resuelve en español.
  await page.goto("/no-existe");
  await expect(page).toHaveURL(/\/es\/no-existe$/);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("la revalidación exige el secreto", async ({ request }) => {
  const withoutSecret = await request.post("/api/revalidate");
  expect(withoutSecret.status()).toBe(401);

  const wrongSecret = await request.post("/api/revalidate", { headers: { "x-revalidate-secret": "incorrecto" } });
  expect(wrongSecret.status()).toBe(401);
});

// ---------------------------------------------------------------------------------------------- idiomas

test("inglés: el panorama está traducido, con sus nombres, cifras y gráficos", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle(/Short-term rentals in 12 cities/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Short-term rentals in");
  await expect(page.getByText("Listings analyzed")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Price model" })).toBeVisible();
  await expectChart(page, /World map: median price per night/);
  await expectChart(page, /Heat map: monthly deviation of reviews/);
  await expectChart(page, /Stacked bars: breakdown of listings/);

  // Ciudades y países con su nombre en inglés; cifras con el formato inglés (US$1,234, sin espacio).
  const table = page.getByRole("table", { name: "Indicators by city" });
  await expect(table.getByRole("link", { name: "London" })).toHaveAttribute("href", "/en/city/london");
  await expect(table).toContainText("United Kingdom");
  await expect(table).not.toContainText("Londres");
  await expect(table).toContainText(/US\$\d/);
  await expect(page.getByRole("button", { name: "Europe" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("Developed by Valentin Fernandez");

  await page.waitForTimeout(800);
  await screenshot(page, "en-overview");
  expect(errors).toEqual([]);
});

test("inglés: ciudad, modelo, metodología y páginas legales", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto("/en/city/london");
  await expect(page.getByRole("heading", { level: 1, name: "London" })).toBeVisible();
  await expect(page.getByText("United Kingdom")).toBeVisible();
  await expect(page.getByText("Median price per night").first()).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Heat map" })).toHaveAttribute("aria-pressed", "true");
  await expectChart(page, /Histogram: number of listings/);
  await expectChart(page, /Price range by room type/);
  await expect(page.getByRole("heading", { name: "The most expensive neighborhoods" })).toBeVisible();
  await page.waitForTimeout(3_000);
  await screenshot(page, "en-city-london");

  await page.goto("/en/model");
  await expect(page.getByRole("heading", { level: 1, name: "Price model" })).toBeVisible();
  await expect(page.getByText("Explained variance (R²)")).toBeVisible();
  await expectChart(page, /Scatter plot of predicted price/);
  await screenshot(page, "en-model");

  await page.goto("/en/methodology");
  await expect(page.getByRole("heading", { name: "Bronze" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Listing quality by city" })).toBeVisible();

  await page.goto("/en/licenses");
  await expect(page.getByRole("heading", { level: 1, name: "Sources and licenses" })).toBeVisible();
  await expect(page.getByRole("table", { name: /data collection date/ })).toContainText("Source: Inside Airbnb, London");
  await screenshot(page, "en-licenses");

  await page.getByRole("contentinfo").getByRole("link", { name: "Terms of use" }).click();
  await expect(page).toHaveURL(/\/en\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms and conditions of use" })).toBeVisible();
  await expect(page.getByText("No cookies or tracking.")).toBeVisible();
  await screenshot(page, "en-terms");

  expect(errors).toEqual([]);
});

test("el selector de idioma abre la misma página en el otro idioma", async ({ page }) => {
  await page.goto("/es/ciudad/madrid");
  await expect(page.getByRole("heading", { level: 1, name: "Madrid" })).toBeVisible();

  await page.getByRole("navigation", { name: "Idioma" }).getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/city\/madrid$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("Median price per night").first()).toBeVisible();

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Methodology" }).click();
  await expect(page).toHaveURL(/\/en\/methodology$/);

  await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL(/\/es\/metodologia$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1, name: "Metodología" })).toBeVisible();
});

test("la raíz elige idioma según el navegador y las direcciones antiguas redirigen", async ({ request }) => {
  const location = async (path: string, acceptLanguage: string) => {
    const response = await request.get(path, { maxRedirects: 0, headers: { "accept-language": acceptLanguage } });
    return { status: response.status(), location: response.headers().location };
  };

  expect(await location("/", "es-PE,es;q=0.9,en;q=0.8")).toEqual({ status: 307, location: "/es" });
  expect(await location("/", "en-US,en;q=0.9")).toEqual({ status: 307, location: "/en" });
  // Quien no pide ni español ni inglés recibe la versión en inglés.
  expect(await location("/", "fr-FR,fr;q=0.9")).toEqual({ status: 307, location: "/en" });

  // Las direcciones anteriores al sitio bilingüe eran las de español: su redirección es permanente y no
  // depende del idioma del navegador.
  expect(await location("/ciudad/london", "en-US,en;q=0.9")).toEqual({ status: 308, location: "/es/ciudad/london" });
  expect(await location("/modelo", "en-US,en;q=0.9")).toEqual({ status: 308, location: "/es/modelo" });
  expect(await location("/terminos", "en-US,en;q=0.9")).toEqual({ status: 308, location: "/es/terminos" });
});
