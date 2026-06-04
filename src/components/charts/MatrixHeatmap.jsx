// src/components/charts/MatrixHeatmap.jsx
// HEATMAP MATRICE à échelle FIXE 0–100 : lignes = territoires, colonnes =
// dimensions de vulnérabilité (déjà normalisées). Couleur verte (faible) →
// rouge (élevé), seuils fixes pour une lecture comparable d'une ligne à
// l'autre. Props : rows [{name, cells:[{x, value}]}], unit, format (fn).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseLegend, baseXaxis, baseTooltip, MONO } from "./apexBase";

export default function MatrixHeatmap({ rows = [], unit = "", format }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => fmt(v, 0);

  const option = useMemo(() => {
    const series = rows.map((r) => ({
      name: r.name,
      data: (r.cells || []).map((c) => ({ x: c.x, y: Number.isFinite(c.value) ? Math.round(c.value) : null })),
    }));
    const ranges = [
      { from: -0.001, to: 20, color: tk.positive, name: "0–20" },
      { from: 20, to: 40, color: tk.accent, name: "20–40" },
      { from: 40, to: 60, color: tk.secondary, name: "40–60" },
      { from: 60, to: 80, color: tk.warm, name: "60–80" },
      { from: 80, to: 100.001, color: tk.negative, name: "80–100" },
    ];

    return {
      chart: baseChart(tk, { type: "heatmap" }),
      legend: baseLegend(tk),
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: [tk.bg] },
      plotOptions: { heatmap: { radius: 3, enableShades: false, colorScale: { ranges } } },
      series,
      xaxis: baseXaxis(tk, {
        type: "category",
        labels: { rotate: -30, style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" } },
      }),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const s = w.config.series[seriesIndex];
          const pt = s && s.data ? s.data[dataPointIndex] : null;
          if (!pt) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${s.name}</div>
            <div class="apexchart__tt-row">${pt.x}: <strong>${pt.y == null ? "—" : fmtV(pt.y)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [rows, unit, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--xl" />;
}