// src/components/charts/PolarAreaChart.jsx
// Diagramme en AIRE POLAIRE : chaque secteur = une dimension, le rayon encode
// la valeur. Pour la synthèse : le profil de vulnérabilité (6 dimensions
// normalisées 0–100) d'un territoire ou la moyenne d'une sélection.
// Props : categories [string], values [number], unit, max.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, apexPalette, baseChart, baseLegend, baseTooltip } from "./apexBase";

export default function PolarAreaChart({ categories = [], values = [], unit = "", max = 100 }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const series = values.map((v) => (Number.isFinite(v) ? Math.round(Number(v)) : 0));
    return {
      chart: baseChart(tk, { type: "polarArea" }),
      colors: apexPalette(tk),
      series,
      labels: categories,
      stroke: { width: 1, colors: [tk.bg] },
      fill: { opacity: 0.78 },
      legend: baseLegend(tk, { position: "right", horizontalAlign: "center" }),
      yaxis: { show: false, max },
      plotOptions: { polarArea: { rings: { strokeColor: tk.line }, spokes: { connectorColors: tk.line } } },
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(v, 0)} ${unit}` } }),
    };
  }, [categories, values, unit, max, tk]);

  if (!categories.length || !values.length) return null;
  return <ApexChart options={option} className="apexchart--tall" />;
}