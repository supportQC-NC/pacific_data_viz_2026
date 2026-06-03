// src/components/EChart/EChart.jsx
// ============================================================
// Wrapper réutilisable autour d'Apache ECharts (canvas). Initialise une
// instance sur un conteneur dimensionné en CSS (.echart / variantes),
// applique l'option, se redimensionne (ResizeObserver) et se nettoie au
// démontage. Aucun style inline : la hauteur vient des classes SCSS.
//
// Dépendance : `npm install echarts`
//
// Props :
//   • option : objet d'option ECharts (déjà construit, couleurs incluses)
//   • className : variante de taille (.echart--tall, etc.)
//   • onReady : callback(instance) optionnel
// ============================================================

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "./Echart.scss";

export default function EChart({ option, className = "", onReady }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);

  // Init / dispose
  useEffect(() => {
    if (!elRef.current) return undefined;
    const chart = echarts.init(elRef.current, null, { renderer: "canvas" });
    chartRef.current = chart;
    if (onReady) onReady(chart);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour de l'option
  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  return <div ref={elRef} className={`echart ${className}`} aria-hidden="true" />;
}