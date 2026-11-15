/**
 * Puente entre los tokens de color del sitio (variables CSS de globals.css) y ECharts, que dibuja en un
 * lienzo y no puede leer CSS. Todos los gráficos toman sus colores de aquí, así que el modo oscuro y
 * cualquier cambio de paleta se resuelven en un solo sitio.
 */

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export type ChartTheme = {
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  wash: string;
  /** Series categóricas, en orden fijo: el color acompaña a la entidad. */
  series: [string, string, string, string];
  /** Serie de contexto o «otros». */
  context: string;
  divergingLow: string;
  /** Punto medio neutro del divergente: se lee como «ni más ni menos». */
  divergingMid: string;
  divergingHigh: string;
  /** Rampa secuencial de un solo tono, de «poco» a «mucho». */
  sequential: string[];
};

export function readChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return {
    surface: token("--surface"),
    ink: token("--ink"),
    ink2: token("--ink-2"),
    muted: token("--muted"),
    grid: token("--grid"),
    axis: token("--axis"),
    wash: token("--wash"),
    series: [token("--series-1"), token("--series-2"), token("--series-3"), token("--series-4")],
    context: token("--series-context"),
    divergingLow: token("--diverging-low"),
    divergingMid: token("--diverging-mid"),
    divergingHigh: token("--diverging-high"),
    sequential: [1, 2, 3, 4, 5].map((step) => token(`--seq-${step}`)),
  };
}

/** Ajustes comunes: tipografía del sitio y una animación breve. */
export function baseOption(theme: ChartTheme) {
  return {
    animationDuration: 250,
    animationDurationUpdate: 150,
    textStyle: { fontFamily: FONT_FAMILY, color: theme.ink2 },
  };
}

/** Margen del gráfico; ECharts lo encoge lo justo para que quepan las etiquetas de los ejes. */
export function gridBox(overrides: Partial<Record<"left" | "right" | "top" | "bottom", number>> = {}) {
  return {
    left: 4,
    right: 12,
    top: 12,
    bottom: 4,
    ...overrides,
    outerBoundsMode: "same" as const,
    outerBoundsContain: "all" as const,
  };
}

/** Ejes discretos: líneas finas y continuas, un tono por encima de la superficie; nunca punteadas. */
export function axisStyle(theme: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: theme.axis } },
    axisTick: { show: false },
    axisLabel: { color: theme.muted, fontSize: 11, fontFamily: FONT_FAMILY },
    splitLine: { lineStyle: { color: theme.grid, type: "solid" as const } },
    nameTextStyle: { color: theme.ink2, fontSize: 12, fontFamily: FONT_FAMILY },
  };
}

export function tooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.axis,
    borderWidth: 1,
    padding: [8, 12],
    // El detalle no se sale del gráfico ni tapa otras tarjetas.
    confine: true,
    className: "chart-tooltip",
    textStyle: { color: theme.ink, fontSize: 12, fontFamily: FONT_FAMILY },
    extraCssText: "border-radius: 6px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);",
  };
}

export type TooltipLine = {
  value: string;
  label?: string;
  /** Color de la serie, dibujado como un trazo corto junto a la cifra. */
  key?: string;
};

/**
 * Contenido del detalle, construido con nodos de texto y no con HTML: los nombres de barrios y ciudades
 * vienen de la fuente de datos y no deben interpretarse como marcado.
 * La cifra manda y la etiqueta acompaña.
 */
export function tooltipContent(theme: ChartTheme, title: string, lines: TooltipLine[]): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "120px";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.color = theme.ink2;
  heading.style.marginBottom = "2px";
  root.append(heading);

  for (const line of lines) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.fontVariantNumeric = "tabular-nums";

    if (line.key) {
      const key = document.createElement("span");
      key.style.cssText = `display:inline-block;width:10px;height:3px;border-radius:2px;background:${line.key}`;
      row.append(key);
    }
    const value = document.createElement("strong");
    value.textContent = line.value;
    value.style.fontSize = "13px";
    value.style.color = theme.ink;
    row.append(value);

    if (line.label) {
      const label = document.createElement("span");
      label.textContent = line.label;
      label.style.color = theme.ink2;
      row.append(label);
    }
    root.append(row);
  }
  return root;
}
