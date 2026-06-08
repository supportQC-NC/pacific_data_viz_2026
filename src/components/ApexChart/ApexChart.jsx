// src/components/ApexChart/ApexChart.jsx
// ============================================================
// Wrapper ApexCharts (cœur `apexcharts`, SANS react-apexcharts) — choisi
// pour la robustesse sur React 19 et le contrôle total du cycle de vie.
//   • init une fois (new ApexCharts + render) ;
//   • MISE À JOUR INTELLIGENTE : si seules les VALEURS changent (mêmes
//     séries, mêmes catégories, mêmes couleurs, même type), on n'anime que
//     les barres via `updateSeries` → aucun re-render complet, zéro
//     clignotement (idéal pour les animations year-by-year). Pour les vrais
//     changements de structure (filtre, thème, nb de séries), `updateOptions`
//     animé mais SANS redrawPaths (transition douce) ;
//   • HAUTEUR FORCÉE EN JS en mode diaporama (~80% de l'écran) ;
//   • tous les appels protégés par try/catch.
// ============================================================

import React, { useEffect, useRef } from "react";
import ApexCharts from "apexcharts";
import "./ApexChart.scss";

function targetHeight(el) {
  const inDeck = el && el.closest && el.closest(".act1viz__chart");
  if (inDeck) return Math.max(260, Math.round(window.innerHeight * 0.8));
  return el && el.clientHeight ? el.clientHeight : 360;
}

// Une hauteur numérique explicite (chart.height) est-elle fournie ?
function hasExplicitHeight(options) {
  return !!(options && options.chart && typeof options.chart.height === "number");
}
// Injecte la hauteur calculée (sauf si une hauteur explicite est demandée).
function withHeight(options, height) {
  if (hasExplicitHeight(options)) return options;
  return { ...options, chart: { ...(options && options.chart), height } };
}

// Deux configs ont-elles la MÊME structure (seules les valeurs diffèrent) ?
function sameShape(a, b) {
  if (!a || !b) return false;
  const ta = a.chart && a.chart.type;
  const tb = b.chart && b.chart.type;
  if (ta !== tb) return false;
  // Les charts à label central / formatters globaux (donut, pie, radialBar)
  // doivent repasser par updateOptions pour rafraîchir le centre & les labels.
  if (ta === "donut" || ta === "pie" || ta === "radialBar") return false;
  if (!Array.isArray(a.series) || !Array.isArray(b.series)) return false;
  if (a.series.length !== b.series.length) return false;
  for (let i = 0; i < a.series.length; i += 1) {
    if ((a.series[i].name || "") !== (b.series[i].name || "")) return false;
  }
  const catA = JSON.stringify((a.xaxis && a.xaxis.categories) || null);
  const catB = JSON.stringify((b.xaxis && b.xaxis.categories) || null);
  if (catA !== catB) return false;
  if (JSON.stringify(a.colors || null) !== JSON.stringify(b.colors || null)) return false;
  return true;
}

export default function ApexChart({ options, className = "" }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const rafRef = useRef(0);
  const optRef = useRef(options);
  optRef.current = options;
  const prevRef = useRef(options);
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
      if (hasExplicitHeight(optRef.current)) return;
      try {
        chartRef.current.updateOptions({ chart: { height: targetHeight(el) } }, false, false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour à chaque changement d'option.
  useEffect(() => {
    const chart = chartRef.current;
    const el = elRef.current;
    if (!chart || !el || !options) return;
    if (skipNextUpdate.current) {
      skipNextUpdate.current = false;
      prevRef.current = options;
      return;
    }
    try {
      if (sameShape(prevRef.current, options)) {
        // Seules les valeurs changent → on n'anime QUE les séries (barres) :
        // pas de reconstruction de la grille/axes/légende → zéro clignotement.
        chart.updateSeries(options.series, true);
      } else {
        // Changement de structure (filtre, thème, nb de séries) → mise à jour
        // complète mais animée, sans redrawPaths (transition douce).
        chart.updateOptions(withHeight(options, targetHeight(el)), false, true, false);
      }
    } catch (err) {
      /* noop */
    }
    prevRef.current = options;
  }, [options]);

  return <div ref={elRef} className={`apexchart ${className}`} />;
}