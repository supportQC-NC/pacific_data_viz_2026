// src/components/charts/BubbleChart.jsx
// Nuage à BULLES (3 dimensions) : X, Y et TAILLE (z). Pour la synthèse :
// X = GES/hab, Y = vulnérabilité composite, taille = exposition (mer).
// Une série par sous-région + repère vertical (moyenne mondiale).
// Props : groups [{name,color,points:[{x,y,z,name}]}], xName, yName, zName,
//         xUnit, xRef {value,label}.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, refLineX, MONO } from "./apexBase";

export default function BubbleChart({ groups = [], xName, yName = "", zName = "", xUnit = "", xRef = null }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const series = groups.map((g) => ({
      name: g.name,
      data: (g.points || []).map((p) => ({ x: Number(p.x), y: Number(p.y), z: Number(p.z) })),
    }));
    const colors = groups.map((g) => g.color);
    const xa = xRef && Number.isFinite(xRef.value) ? [refLineX(tk, xRef.value, xRef.label || "", tk.warm)] : [];

    return {
      chart: baseChart(tk, { type: "bubble", zoom: { enabled: true, type: "xy" } }),
      colors,
      fill: { opacity: 0.55 },
      markers: { strokeColors: tk.bg, strokeWidth: 1 },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk, { xaxis: { lines: { show: true } } }),
      plotOptions: { bubble: { minBubbleRadius: 6, maxBubbleRadius: 34 } },
      series,
      xaxis: baseXaxis(tk, {
        type: "numeric",
        tickAmount: 6,
        title: { text: xName || xUnit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Number(v), 1) },
      }),
      yaxis: baseYaxis(tk, {
        min: 0,
        max: 100,
        tickAmount: 5,
        title: { text: yName },
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Number(v), 0) },
      }),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex }) => {
          const g = groups[seriesIndex];
          const p = g && g.points ? g.points[dataPointIndex] : null;
          if (!p) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${p.name}</div>
            <div class="apexchart__tt-row">${fmt(p.x, 1)} ${xUnit}</div>
            <div class="apexchart__tt-row">${fmt(p.y, 0)} ${yName}</div>
            <div class="apexchart__tt-row">${zName}: ${fmt(p.z, 0)}</div>
          </div>`;
        },
      }),
      annotations: { xaxis: xa },
    };
  }, [groups, xName, yName, zName, xUnit, xRef, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}