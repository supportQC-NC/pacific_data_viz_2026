// src/components/charts/MixCompositionChart.jsx
// ============================================================
// Composition du mix électrique PAR TERRITOIRE pour une année donnée :
// barres horizontales empilées à 100 % (chaque source = un segment).
// On lit d'un coup d'œil qui tourne au fossile et qui a basculé au
// renouvelable. Séries + couleurs fournies par l'acte (ordonnées bas->haut).
// Props : series [{ name, data:[GWh par territoire], color }],
//         categories [noms de territoires], unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function MixCompositionChart({ series = [], categories = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const colors = series.map((s) => s.color || tk.accent);
    return {
      chart: baseChart(tk, { type: "bar", stacked: true, stackType: "100%" }),
      colors,
      plotOptions: { bar: { horizontal: true, barHeight: "72%" } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      series: series.map((s) => ({ name: s.name, data: s.data })),
      xaxis: baseXaxis(tk, {
        categories,
        max: 100,
        labels: {
          formatter: (v) => `${Math.round(v)}%`,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "12px" } },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: { formatter: (v) => `${fmt(v, 1)} ${unit}` },
      }),
      states: { active: { filter: { type: "none" } } },
    };
  }, [series, categories, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}