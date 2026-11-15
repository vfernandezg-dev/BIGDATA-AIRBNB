"use client";

import type { EChartsCoreOption, EChartsType } from "echarts/core";
import { useEffect, useRef, useState } from "react";

import { readChartTheme, type ChartTheme } from "./chart-theme";

type EChartProps = {
  /**
   * Construye la opción de ECharts con los colores vigentes. Debe ser estable entre renders (useCallback):
   * cada vez que cambia, el gráfico se vuelve a crear.
   */
  buildOption: (theme: ChartTheme) => EChartsCoreOption;
  height: number;
  /** Qué muestra el gráfico, para lectores de pantalla. Los datos exactos están en la tabla de la tarjeta. */
  label: string;
};

/**
 * Lienzo de ECharts: carga la librería bajo demanda, se adapta al ancho de su contenedor y se redibuja
 * cuando el sistema cambia entre modo claro y oscuro.
 */
export function EChart({ buildOption, height, label }: EChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    let chart: EChartsType | undefined;
    let cancelled = false;
    const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const render = () => chart?.setOption(buildOption(readChartTheme()), { notMerge: true });
    const resizeObserver = new ResizeObserver(() => chart?.resize());

    import("@/lib/echarts")
      .then(({ echarts }) => {
        if (cancelled) return;
        chart = echarts.init(element, undefined, { renderer: "canvas" });
        render();
        resizeObserver.observe(element);
        darkScheme.addEventListener("change", render);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      darkScheme.removeEventListener("change", render);
      resizeObserver.disconnect();
      chart?.dispose();
    };
  }, [buildOption]);

  if (failed) {
    return (
      <p className="text-sm text-muted" style={{ minHeight: height }}>
        No se pudo cargar el gráfico. Los datos están en la tabla de esta tarjeta.
      </p>
    );
  }
  return <div ref={container} role="img" aria-label={label} className="w-full" style={{ height }} />;
}
