"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ancho real del contenedor de un gráfico SVG.
 * Dibujar al tamaño real (en lugar de escalar un viewBox) mantiene legibles los textos en el móvil.
 */
export function useContainerWidth<Element extends HTMLElement>(initialWidth = 640) {
  const ref = useRef<Element>(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
