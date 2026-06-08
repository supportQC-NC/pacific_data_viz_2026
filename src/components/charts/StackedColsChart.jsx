// src/components/charts/StackedColsChart.jsx
// ============================================================
// Colonnes empilées dans le temps + TOTAL affiché en haut de chaque colonne.
// Idéal pour la production électrique totale (croissance) et sa composition
// par source au fil des années.
// Props : series [{ name, color, data:[nombres alignés sur years] }], years, unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function StackedColsChart({ series = [], years = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(
    () => ({
      chart: baseChart(tk, { type: "bar", stacked: true }),
      colors: series.map((s) => s.color || tk.accent),
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "80%",
          borderRadius: 3,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
          dataLabels: {
            total: { enabled: true, style: { fontFamily: MONO, fontSize: "10px", fontWeight: 700, color: tk.textSoft } },
          },
        },
      },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      fill: { opacity: 1 },
      series: series.map((s) => ({ name: s.name, data: s.data.map((v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0)) })),
      xaxis: baseXaxis(tk, {
        categories: years.map(String),
        tickAmount: Math.min(10, Math.max(2, years.length - 1)),
        labels: { rotate: -45, rotateAlways: false, style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" } },
      }),
      yaxis: baseYaxis(tk, { labels: { formatter: (v) => fmt(v) } }),
      tooltip: baseTooltip({ shared: true, intersect: false, y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
      states: { active: { filter: { type: "none" } } },
    }),
    [series, years, unit, tk],
  );

  return <ApexChart options={option} className="apexchart--tall" />;
}