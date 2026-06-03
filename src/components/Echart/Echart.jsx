// src/components/Echart/Echart.jsx
// ============================================================
// Wrapper Apache ECharts (vanilla).
//   • init une fois, setOption à chaque changement d'option.
//   • HAUTEUR FORCÉE EN JS en mode diaporama (~80% de l'écran) — indépendant
//     du CSS, donc pas de débordement.
//   • Tous les appels (resize/setOption) sont protégés par isDisposed() pour
//     éviter "Cannot read properties of null (reading 'layerStack')" quand le
//     graphique est détruit (changement de filtre/thème/navigation).
// ============================================================

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "./Echart.scss";

if (typeof window !== "undefined" && !window.__roLoopPatched) {
  window.__roLoopPatched = true;
  window.addEventListener("error", (e) => {
    if (e.message && e.message.indexOf("ResizeObserver loop") !== -1) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

function targetHeight(el) {
  const inDeck = el && el.closest && el.closest(".act1viz__chart");
  if (inDeck) return Math.max(260, Math.round(window.innerHeight * 0.8));
  return el && el.clientHeight ? el.clientHeight : 360;
}

function alive(chart) {
  return chart && !chart.isDisposed();
}

export default function EChart({ option, className = "", theme }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;

    const chart = echarts.init(el, theme, { renderer: "canvas" });
    chartRef.current = chart;

    const fit = () => {
      if (!alive(chartRef.current)) return;
      try {
        chartRef.current.resize({ height: targetHeight(el) });
      } catch (err) {
        /* noop */
      }
    };

    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(fit);
    });
    ro.observe(el);
    window.addEventListener("resize", fit);
    fit();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", fit);
      ro.disconnect();
      if (alive(chart)) chart.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!alive(chart) || !option) return;
    try {
      chart.setOption(option, true);
      chart.resize({ height: targetHeight(elRef.current) });
    } catch (err) {
      /* noop */
    }
  }, [option]);

  return <div ref={elRef} className={`echart ${className}`} />;
}