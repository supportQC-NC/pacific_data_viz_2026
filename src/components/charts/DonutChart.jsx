// src/components/charts/DonutChart.jsx
// Anneau (donut) : proportions part-à-tout pour quelques catégories, total
// affiché au centre. Pour la synthèse : où se concentre la vulnérabilité
// cumulée, par sous-région. Props : rows [{name, value, color?}], unit,
// format (fn), centerLabel.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseLegend, baseTooltip, MONO } from "./apexBase";

export default function DonutChart({ rows = [], unit = "", format, centerLabel = "" }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => fmt(v, 0);

  const option = useMemo(() => {
    const data = rows.filter((r) => Number.isFinite(r.value) && r.value > 0);
    const series = data.map((r) => Number(r.value));
    const labels = data.map((r) => r.name);
    const fallback = [tk.accent, tk.warm, tk.positive, tk.secondary, tk.accentDeep, tk.negative];
    const colors = data.map((r, i) => r.color || fallback[i % fallback.length]);
    const total = series.reduce((a, b) => a + b, 0);

    return {
      chart: baseChart(tk, { type: "donut" }),
      colors,
      series,
      labels,
      stroke: { width: 2, colors: [tk.bg] },
      legend: baseLegend(tk, { position: "right", horizontalAlign: "center" }),
      dataLabels: { enabled: true, style: { fontFamily: MONO, fontSize: "11px" }, formatter: (val) => `${Math.round(val)}%`, dropShadow: { enabled: false } },
      plotOptions: {
        pie: {
          donut: {
            size: "62%",
            labels: {
              show: true,
              name: { show: true, color: tk.textMute, fontFamily: MONO, fontSize: "12px" },
              value: { show: true, color: tk.text, fontFamily: MONO, fontSize: "22px", formatter: (v) => fmtV(v) },
              total: { show: true, label: centerLabel, color: tk.textMute, fontFamily: MONO, formatter: () => fmtV(total) },
            },
          },
        },
      },
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmtV(v)} ${unit}` } }),
    };
  }, [rows, unit, fmtV, centerLabel, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}