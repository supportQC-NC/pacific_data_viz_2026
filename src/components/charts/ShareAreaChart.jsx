// src/components/charts/ShareAreaChart.jsx
// ============================================================
// Colonnes empilées à 100 % dans le temps : évolution de la PART de chaque
// source dans la production électrique totale (tout territoire confondu).
// (Le 100 % en AIRE s'empile mal dans ApexCharts → on utilise des colonnes
//  à pleine largeur : ça lit comme une aire mais s'empile correctement.)
// Le survol donne les GWh absolus de chaque source (magnitude conservée).
// Props : series [{ name, color, data:[GWh par année] }], years, unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function ShareAreaChart({ series = [], years = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(
    () => ({
      chart: { ...baseChart(tk, { type: "bar", stacked: true, stackType: "100%" }), animations: { enabled: false } },
      colors: series.map((s) => s.color || tk.accent),
      plotOptions: { bar: { horizontal: false, columnWidth: "100%", borderRadius: 0 } },
      fill: { opacity: 1 },
      dataLabels: { enabled: false },
      legend: { ...baseLegend(tk), onItemClick: { toggleDataSeries: false }, onItemHover: { highlightDataSeries: false } },
      grid: baseGrid(tk),
      series: series.map((s) => ({ name: s.name, data: s.data.map((v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0)) })),
      xaxis: baseXaxis(tk, {
        categories: years.map(String),
        tickAmount: Math.min(8, Math.max(2, years.length - 1)),
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" } },
      }),
      yaxis: baseYaxis(tk, { max: 100, labels: { formatter: (v) => `${Math.round(v)}%` } }),
      tooltip: baseTooltip({ shared: true, intersect: false, y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
      states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
    }),
    [series, years, unit, tk],
  );

  return <ApexChart options={option} className="apexchart--tall" />;
}