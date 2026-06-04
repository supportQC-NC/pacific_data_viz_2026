// src/components/charts/MirrorBars.jsx
// BARRES MIROIR (façon pyramide des âges) : à gauche la responsabilité, à
// droite la vulnérabilité, territoire par territoire. La juxtaposition rend
// l'écart visible d'un coup d'œil. ApexCharts (bar horizontal empilé, une
// série en négatif). Props : rows [{name, left, right}], leftLabel,
// rightLabel, unit, format (fn).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function MirrorBars({ rows = [], leftLabel = "", rightLabel = "", unit = "", format }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => fmt(v, 0);

  const option = useMemo(() => {
    const data = rows.filter((r) => Number.isFinite(r.left) && Number.isFinite(r.right));
    const cats = data.map((r) => r.name);
    const series = [
      { name: leftLabel, data: data.map((r) => -Math.round(r.left)) },
      { name: rightLabel, data: data.map((r) => Math.round(r.right)) },
    ];
    const maxAbs = Math.max(10, ...data.flatMap((r) => [r.left, r.right]));

    return {
      chart: baseChart(tk, { type: "bar", stacked: true }),
      colors: [tk.accent, tk.warm],
      plotOptions: { bar: { horizontal: true, barHeight: "70%", borderRadius: 2 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk, { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } }),
      stroke: { width: 1, colors: [tk.bg] },
      series,
      xaxis: baseXaxis(tk, {
        min: -maxAbs,
        max: maxAbs,
        categories: cats,
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Math.abs(Number(v)), 0) },
      }),
      yaxis: baseYaxis(tk, { labels: { style: { colors: tk.textSoft, fontFamily: MONO, fontSize: "11px" } } }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = data[dataPointIndex];
          if (!r) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.name}</div>
            <div class="apexchart__tt-row">${leftLabel}: <strong>${fmtV(r.left)}</strong> ${unit}</div>
            <div class="apexchart__tt-row">${rightLabel}: <strong>${fmtV(r.right)}</strong> ${unit}</div>
          </div>`;
        },
      }),
      annotations: { xaxis: [{ x: 0, borderColor: tk.lineStrong }] },
    };
  }, [rows, leftLabel, rightLabel, unit, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--xl" />;
}