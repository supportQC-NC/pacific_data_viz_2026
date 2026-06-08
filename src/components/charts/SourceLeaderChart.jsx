// src/components/charts/SourceLeaderChart.jsx
// ============================================================
// Par SOURCE d'énergie : volume total produit (longueur de barre) + premier
// territoire consommateur (label dans la barre). Répond à « combien au total
// pour chaque énergie, et qui en consomme le plus ».
// Barres horizontales distribuées (une couleur sémantique par source).
// Props : points [{ label, total, color, topName, topShare }], unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function SourceLeaderChart({ points = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(
    () => ({
      chart: baseChart(tk, { type: "bar" }),
      colors: points.map((p) => p.color || tk.accent),
      plotOptions: { bar: { horizontal: true, distributed: true, barHeight: "66%", borderRadius: 4 } },
      legend: { show: false },
      grid: baseGrid(tk),
      dataLabels: {
        enabled: true,
        textAnchor: "start",
        offsetX: 10,
        formatter: (val, opts) => {
          const p = points[opts.dataPointIndex];
          return p && p.topName ? `${p.topName} · ${p.topShare}%` : "";
        },
        style: { fontFamily: "Hanken Grotesk", fontSize: "12px", fontWeight: 700, colors: ["#ffffff"] },
        dropShadow: { enabled: true, top: 0, left: 0, blur: 3, color: "#000000", opacity: 0.6 },
      },
      series: [{ name: unit, data: points.map((p) => p.total) }],
      xaxis: baseXaxis(tk, {
        categories: points.map((p) => p.label),
        labels: { formatter: (v) => fmt(v), style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" } },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "12px" } },
      }),
      tooltip: baseTooltip({
        y: { formatter: (v, opts) => {
          const p = opts && points[opts.dataPointIndex];
          const head = `${fmt(v)} ${unit}`;
          return p && p.topName ? `${head} · 1er : ${p.topName} (${p.topShare}%)` : head;
        } },
      }),
      states: { active: { filter: { type: "none" } } },
    }),
    [points, unit, tk],
  );

  return <ApexChart options={option} className="apexchart--tall" />;
}