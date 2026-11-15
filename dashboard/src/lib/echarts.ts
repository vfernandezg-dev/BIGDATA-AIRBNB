/**
 * ECharts con solo las piezas que usa el sitio.
 *
 * Importar `echarts` entero añade varios cientos de kilobytes; aquí se registran únicamente los tipos de
 * gráfico y componentes necesarios. Este módulo se carga con `import()` desde el cliente, así que queda en
 * un bloque aparte que solo se descarga en las páginas que dibujan un gráfico.
 */
import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import {
  GeoComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  GeoComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  CanvasRenderer,
]);

export { echarts };
