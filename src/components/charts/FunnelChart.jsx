// src/components/charts/FunnelChart.jsx
// ============================================================
// Funnel : volume total par source d'énergie (drop-off du plus gros au plus
// petit). Pensé pour « toute l'énergie du Pacifique par type ».
// Couleur sémantique par source (distributed).
// Props : points [{ label, value, color }] (triés desc.), unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseTooltip, SANS } from "./apexBase";

export default function FunnelChart({ points = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(
    () => ({
      chart: { ...baseChart(tk, { type: "bar" }), animations: { enabled: false } },
      colors: points.map((p) => p.color || tk.accent),
      plotOptions: { bar: { horizontal: true, isFunnel: true, distributed: true, borderRadius: 0 } },
      legend: { show: false },
      grid: { show: false },
      dataLabels: {
        enabled: true,
        formatter: (val, opts) => {
          const p = points[opts.dataPointIndex];
          return p ? `${p.label} · ${fmt(val)} ${unit}` : `${fmt(val)} ${unit}`;
        },
        style: { fontFamily: SANS, fontSize: "12px", fontWeight: 700, colors: ["#ffffff"] },
        dropShadow: { enabled: true, top: 0, left: 0, blur: 3, color: "#000000", opacity: 0.6 },
      },
      series: [{ name: unit, data: points.map((p) => p.value) }],
      xaxis: { categories: points.map((p) => p.label), labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
      states: { active: { filter: { type: "none" } } },
    }),
    [points, unit, tk],
  );

  return <ApexChart options={option} className="apexchart--tall" />;
}