// src/components/charts/ScatterChart.jsx
// Nuage « niveau × évolution » : X = niveau actuel, Y = variation (%)
// (Acte 1) / corrélation mer × SST (Acte 2). Une série par sous-région +
// repères de cadrans. MIGRÉ ECharts -> ApexCharts. Props inchangées.
// groups : [{ name, color, points:[{ x, y, name }] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, refLineX, refLineY, MONO } from "./apexBase";

export default function ScatterChart({ groups = [], unit = "", medianX = 0, xName, yName = "%" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const series = groups.map((g) => ({
      name: g.name,
      data: (g.points || []).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
    }));
    const colors = groups.map((g) => g.color);

    return {
      chart: baseChart(tk, { type: "scatter", zoom: { enabled: true, type: "xy" } }),
      colors,
      markers: { size: 7, strokeColors: tk.bg, strokeWidth: 1, hover: { size: 9 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk, { xaxis: { lines: { show: true } } }),
      series,
      xaxis: baseXaxis(tk, {
        type: "numeric",
        tickAmount: 6,
        title: { text: xName || unit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Number(v), 1) },
      }),
      yaxis: baseYaxis(tk, {
        title: { text: yName },
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Number(v), 1) },
      }),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex }) => {
          const g = groups[seriesIndex];
          const p = g && g.points ? g.points[dataPointIndex] : null;
          if (!p) return "";
          const sign = p.y > 0 ? "+" : "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${p.name}</div>
            <div class="apexchart__tt-row">${fmt(p.x)} ${xName || unit}</div>
            <div class="apexchart__tt-row">${sign}${fmt(p.y)} ${yName}</div>
          </div>`;
        },
      }),
      annotations: {
        xaxis: medianX ? [refLineX(tk, medianX, "", tk.lineStrong)] : [],
        yaxis: [refLineY(tk, 0, "", tk.lineStrong)],
      },
    };
  }, [groups, unit, medianX, xName, yName, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}