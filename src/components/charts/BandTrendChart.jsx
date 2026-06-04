// src/components/charts/BandTrendChart.jsx
// Tendance avec bande de dispersion : ligne MOYENNE + bande (min/max ou
// centiles) + référence (0) + marqueur de l'année courante.
// ApexCharts (rangeArea + line). Remplace AnomalyTrend là où on migre.
// Props :
//   data        : [{ year, mean, min, max }]
//   unit, refLabel, meanLabel
//   currentYear : année mise en avant (marqueur vertical), optionnel
//   color       : couleur d'accent (défaut tk.accent)
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, refLineY, MONO } from "./apexBase";

export default function BandTrendChart({
  data = [],
  unit = "",
  refLabel = "",
  meanLabel = "",
  currentYear = null,
  color,
  refValue = 0,
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const main = color || tk.accent;
    const years = data.map((r) => r.year);
    const bandData = data.map((r) => ({
      x: r.year,
      y: r.min == null || r.max == null ? null : [Number(r.min.toFixed(3)), Number(r.max.toFixed(3))],
    }));
    const meanData = data.map((r) => ({ x: r.year, y: r.mean == null ? null : Number(r.mean.toFixed(3)) }));

    const xAnno =
      currentYear != null
        ? [{
            x: currentYear,
            borderColor: main,
            strokeDashArray: 0,
            opacity: 0.5,
            label: { text: String(currentYear), position: "top", borderWidth: 0, style: { color: main, background: "transparent", fontFamily: MONO, fontSize: "10px" } },
          }]
        : [];

    return {
      chart: baseChart(tk, { type: "rangeArea" }),
      colors: [main, main],
      series: [
        { name: refLabel ? `± ${refLabel}` : "dispersion", type: "rangeArea", data: bandData },
        { name: meanLabel || "moyenne", type: "line", data: meanData },
      ],
      stroke: { curve: "smooth", width: [0, 2.5] },
      fill: { opacity: [0.16, 1] },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk, { customLegendItems: [meanLabel || "moyenne"] }),
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        title: { text: unit },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = data[dataPointIndex];
          if (!r || r.mean == null) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.year}</div>
            <div class="apexchart__tt-row">${meanLabel || "moy."} <strong>${fmt(r.mean)}</strong> ${unit}</div>
            <div class="apexchart__tt-row">${fmt(r.min)} → ${fmt(r.max)} ${unit}</div>
          </div>`;
        },
      }),
      annotations: {
        yaxis: refValue != null ? [refLineY(tk, refValue, refLabel, tk.lineStrong)] : [],
        xaxis: xAnno,
      },
    };
  }, [data, unit, refLabel, meanLabel, currentYear, color, refValue, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}