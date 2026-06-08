// src/components/charts/TreemapChart.jsx
// ============================================================
// Treemap (part-to-whole) : chaque rectangle = une source d'énergie,
// surface ∝ production. Couleur sémantique fournie par node (distributed).
// Props : points [{ label, value, color }], unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseTooltip, SANS } from "./apexBase";

export default function TreemapChart({ points = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const colors = points.map((p) => p.color || tk.accent);
    return {
      chart: baseChart(tk, { type: "treemap" }),
      colors,
      legend: { show: false },
      plotOptions: { treemap: { distributed: true, enableShades: false, borderRadius: 4 } },
      stroke: { width: 2, colors: [tk.bg || "transparent"] },
      dataLabels: {
        enabled: true,
        style: { fontFamily: SANS, fontSize: "12px", fontWeight: 600, colors: ["#ffffff"] },
        formatter: (text, op) => [text, `${fmt(op.value)} ${unit}`],
        offsetY: -2,
      },
      series: [{ data: points.map((p) => ({ x: p.label, y: p.value })) }],
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
    };
  }, [points, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}