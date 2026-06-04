// src/components/charts/SynthScatter.jsx
// Nuage de SYNTHÈSE : X = responsabilité (GES/hab), Y = indice de vulnérabilité
// composite (0–100). Une série par sous-région. Deux repères : ligne verticale
// = moyenne mondiale (réf de responsabilité), ligne horizontale = vulnérabilité
// médiane. Les quadrants se lisent dans le récit. ApexCharts (type scatter).
// Props : groups [{name,color,points:[{x,y,name}]}], xName, yName, xUnit,
//         xRef {value,label}, yDivider (number).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, refLineX, refLineY, MONO } from "./apexBase";

export default function SynthScatter({ groups = [], xName, yName = "", xUnit = "", xRef = null, yDivider = null }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const series = groups.map((g) => ({
      name: g.name,
      data: (g.points || []).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
    }));
    const colors = groups.map((g) => g.color);
    const xa = xRef && Number.isFinite(xRef.value) ? [refLineX(tk, xRef.value, xRef.label || "", tk.warm)] : [];
    const ya = Number.isFinite(yDivider) ? [refLineY(tk, yDivider, "", tk.lineStrong)] : [];

    return {
      chart: baseChart(tk, { type: "scatter", zoom: { enabled: true, type: "xy" } }),
      colors,
      markers: { size: 8, strokeColors: tk.bg, strokeWidth: 1, hover: { size: 10 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk, { xaxis: { lines: { show: true } } }),
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
          </div>`;
        },
      }),
      annotations: { xaxis: xa, yaxis: ya },
    };
  }, [groups, xName, yName, xUnit, xRef, yDivider, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}