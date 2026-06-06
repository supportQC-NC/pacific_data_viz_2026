// src/components/charts/ParetoChart.jsx
// Pareto : barres triées (décroissant) + COURBE CUMULÉE en % sur un 2ᵉ axe.
// Révèle la concentration : « quelques entités font l'essentiel du total ».
// Props : rows [{name, value}], unit, cumulLabel, format (fonction).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import {
  baseChart,
  baseGrid,
  baseLegend,
  baseXaxis,
  baseYaxis,
  baseTooltip,
} from "./apexBase";

export default function ParetoChart({
  rows = [],
  unit = "",
  cumulLabel = "cumul %",
  format,
}) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => `${v}`;

  const option = useMemo(() => {
    const r = [...rows]
      .filter((x) => Number.isFinite(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value);
    const names = r.map((x) => x.name);
    const vals = r.map((x) => Number(x.value));
    const total = vals.reduce((s, v) => s + v, 0) || 1;
    let acc = 0;
    const cum = vals.map((v) => {
      acc += v;
      return Number(((acc / total) * 100).toFixed(1));
    });

    return {
      chart: baseChart(tk, { type: "line" }), // type mixte via series[].type
      colors: [tk.warm, tk.accent],
      series: [
        { name: unit || "total", type: "column", data: vals },
        { name: cumulLabel, type: "line", data: cum },
      ],
      plotOptions: { bar: { columnWidth: "60%", borderRadius: 2 } },
      stroke: { width: [0, 2.5], curve: "smooth" },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: names,
        labels: {
          rotate: -40,
          rotateAlways: names.length > 8,
          hideOverlappingLabels: true,
          style: {
            colors: tk.textSoft,
            fontFamily: "Hanken Grotesk",
            fontSize: "11px",
          },
        },
      }),
      yaxis: [
        baseYaxis(tk, {
          seriesName: unit || "total",
          labels: {
            style: {
              colors: tk.textMute,
              fontFamily: "IBM Plex Mono",
              fontSize: "11px",
            },
            formatter: (v) => fmtV(Number(v)),
          },
        }),
        baseYaxis(tk, {
          seriesName: cumulLabel,
          opposite: true,
          min: 0,
          max: 100,
          tickAmount: 4,
          labels: {
            style: {
              colors: tk.accent,
              fontFamily: "IBM Plex Mono",
              fontSize: "11px",
            },
            formatter: (v) => `${Math.round(Number(v))} %`,
          },
        }),
      ],
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: [
          { formatter: (v) => `${fmtV(Number(v))} ${unit}` },
          { formatter: (v) => `${v} %` },
        ],
      }),
    };
  }, [rows, unit, cumulLabel, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}
