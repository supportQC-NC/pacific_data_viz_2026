// src/components/charts/RadarProfileChart.jsx
// Radar GÉNÉRIQUE : axes = catégories (ex. cultures), une série par groupe
// (ex. sous-région). Pensé pour des valeurs déjà NORMALISÉES (0–100) afin de
// comparer des profils malgré des unités/échelles différentes par axe.
// Props : categories [string], series [{ name, data:[number] }], unit, max
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, apexPalette, baseChart, baseLegend, baseTooltip, MONO } from "./apexBase";

export default function RadarProfileChart({ categories = [], series = [], unit = "", max = 100 }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    if (categories.length < 3 || !series.length) return null;
    return {
      chart: baseChart(tk, { type: "radar" }),
      colors: apexPalette(tk),
      stroke: { width: 2 },
      fill: { opacity: 0.1 },
      markers: { size: 3, hover: { size: 5 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk, { horizontalAlign: "center" }),
      series: series.map((s) => ({ name: s.name, data: s.data })),
      xaxis: {
        categories,
        labels: { style: { colors: categories.map(() => tk.textSoft), fontFamily: MONO, fontSize: "11px" } },
      },
      yaxis: {
        min: 0,
        max,
        tickAmount: 4,
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" }, formatter: (v) => fmt(Number(v), 0) },
      },
      plotOptions: {
        radar: {
          polygons: {
            strokeColors: tk.line,
            connectorColors: tk.line,
            fill: { colors: [tk.bg, tk.bg2] },
          },
        },
      },
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(Number(v), 0)}${unit ? ` ${unit}` : ""}` } }),
    };
  }, [categories, series, unit, max, tk]);

  if (!option) return null;
  return <ApexChart options={option} className="apexchart--tall" />;
}