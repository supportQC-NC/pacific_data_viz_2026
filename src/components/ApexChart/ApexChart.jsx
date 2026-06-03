// src/components/ApexChart/ApexChart.jsx
// ============================================================
// Wrapper ApexCharts (cœur `apexcharts`, SANS react-apexcharts) — choisi
// pour la robustesse sur React 19 et le contrôle total du cycle de vie.
// Calque la logique de Echart.jsx :
//   • init une fois (new ApexCharts + render), updateOptions ensuite ;
//   • HAUTEUR FORCÉE EN JS en mode diaporama (~80% de l'écran) quand le
//     graphique est dans `.act1viz__chart` — indépendant du CSS ;
//   • tous les appels (render/updateOptions/destroy) protégés par try/catch
//     pour éviter les crashes au changement de filtre / thème / navigation.
// L'option passée est une config ApexCharts COMPLÈTE (chart + series + …).
// ============================================================

import React, { useEffect, useRef } from "react";
import ApexCharts from "apexcharts";
import "./ApexChart.scss";

function targetHeight(el) {
  const inDeck = el && el.closest && el.closest(".act1viz__chart");
  if (inDeck) return Math.max(260, Math.round(window.innerHeight * 0.8));
  return el && el.clientHeight ? el.clientHeight : 360;
}

// Injecte la hauteur calculée dans la config (sans muter l'objet d'origine).
function withHeight(options, height) {
  return { ...options, chart: { ...(options && options.chart), height } };
}

export default function ApexChart({ options, className = "" }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const rafRef = useRef(0);
  // On garde la dernière option dans une ref pour le recalcul de hauteur au resize.
  const optRef = useRef(options);
  optRef.current = options;
  const skipNextUpdate = useRef(true);

  // Montage unique.
  useEffect(() => {
    const el = elRef.current;
    if (!el || !optRef.current) return undefined;

    let chart;
    try {
      chart = new ApexCharts(el, withHeight(optRef.current, targetHeight(el)));
      chartRef.current = chart;
      chart.render();
    } catch (err) {
      /* noop */
    }

    const fit = () => {
      if (!chartRef.current) return;
      try {
        chartRef.current.updateOptions(
          { chart: { height: targetHeight(el) } },
          false,
          false,
        );
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

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", fit);
      ro.disconnect();
      try {
        if (chartRef.current) chartRef.current.destroy();
      } catch (err) {
        /* noop */
      }
      chartRef.current = null;
    };
    // Montage unique : les mises à jour passent par l'effet ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour à chaque changement d'option (données, filtres, thème).
  useEffect(() => {
    const chart = chartRef.current;
    const el = elRef.current;
    if (!chart || !el || !options) return;
    // Le montage a déjà rendu avec ces options : on saute la 1re mise à jour.
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      return;
    }
    try {
      // redrawPaths=true, animate=true → transitions fluides ; le 4e arg
      // (updateSyncedCharts) reste à false.
      chart.updateOptions(withHeight(options, targetHeight(el)), true, true, false);
    } catch (err) {
      /* noop */
    }
  }, [options]);

  return <div ref={elRef} className={`apexchart ${className}`} />;
}