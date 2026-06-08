// src/components/charts/PowerMixChart.jsx
// ============================================================
// Aire empilée du mix électrique (GWh) au fil des années.
// Sert deux lectures : « fossile vs renouvelable » (2 bandes) et le
// détail par source. Les séries + couleurs sont fournies par l'acte
// (déjà ordonnées bas -> haut). Aucune couleur en dur : tokens du thème.
// Props : series [{ name, data:[nombres alignés sur years], color }], years, unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function PowerMixChart({ series = [], years = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const colors = series.map((s) => s.color || tk.accent);
    return {
      chart: baseChart(tk, { type: "area", stacked: true }),
      colors,
      stroke: { curve: "smooth", width: 1, lineCap: "round" },
      fill: { type: "solid", opacity: 0.78 },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      series: series.map((s) => ({ name: s.name, data: s.data.map((v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0)) })),
      xaxis: baseXaxis(tk, {
        categories: years,
        tickAmount: Math.min(8, Math.max(2, years.length - 1)),
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, rotate: 0, hideOverlappingLabels: true },
      }),
      yaxis: baseYaxis(tk, {
        title: { text: unit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: { formatter: (v) => fmt(v, 0), style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" } },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: { formatter: (v) => `${fmt(v, 1)} ${unit}` },
      }),
      states: { active: { filter: { type: "none" } } },
    };
  }, [series, years, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}