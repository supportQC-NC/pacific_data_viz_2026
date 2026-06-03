// src/components/charts/AnomalyBandChart.jsx
// Anomalie dans le temps : ligne MOYENNE + bande min/max (dispersion entre
// territoires) + repère 0. MIGRÉ ECharts -> ApexCharts (rangeArea + line).
// Idéal niveau de la mer / SST. Props inchangées { series, years, unit }.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, valAt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, refLineY } from "./apexBase";

export default function AnomalyBandChart({ series = [], years = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const rows = years.map((y) => {
      const vals = series.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
      if (!vals.length) return { year: y, mean: null, min: null, max: null };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return {
        year: y,
        mean: Number(mean.toFixed(3)),
        min: Number(Math.min(...vals).toFixed(3)),
        max: Number(Math.max(...vals).toFixed(3)),
      };
    });

    const bandData = rows.map((r) => ({
      x: r.year,
      y: r.min == null ? null : [r.min, r.max],
    }));
    const meanData = rows.map((r) => ({ x: r.year, y: r.mean }));

    return {
      chart: baseChart(tk, { type: "rangeArea" }),
      colors: [tk.accent, tk.accent],
      series: [
        { name: "dispersion", type: "rangeArea", data: bandData },
        { name: "moyenne", type: "line", data: meanData },
      ],
      stroke: { curve: "smooth", width: [0, 2.5] },
      fill: { opacity: [0.16, 1] },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk, {
        show: true,
        customLegendItems: ["dispersion", "moyenne"],
      }),
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        title: { text: unit },
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = rows[dataPointIndex];
          if (!r || r.mean == null) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.year}</div>
            <div class="apexchart__tt-row">moy. <strong>${fmt(r.mean)}</strong> ${unit}</div>
            <div class="apexchart__tt-row">min ${fmt(r.min)} · max ${fmt(r.max)}</div>
          </div>`;
        },
      }),
      annotations: { yaxis: [refLineY(tk, 0, "réf. 0", tk.lineStrong)] },
    };
  }, [series, years, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}