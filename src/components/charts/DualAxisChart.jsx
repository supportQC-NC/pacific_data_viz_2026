// src/components/charts/DualAxisChart.jsx
// Deux signaux dans le temps sur DEUX axes : moyenne du niveau de la mer
// (axe gauche) et moyenne de l'anomalie de température (axe droit).
// MIGRÉ ECharts -> ApexCharts (multi-yaxis). Props inchangées.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, valAt, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

function meanFor(series, year) {
  const vs = series.map((s) => valAt(s, year)).filter((v) => Number.isFinite(v));
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}

export default function DualAxisChart({
  seaSeries = [],
  seaYears = [],
  sstSeries = [],
  sstYears = [],
  seaName = "",
  sstName = "",
  seaUnit = "",
  sstUnit = "",
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const years = [...new Set([...seaYears, ...sstYears])].sort((a, b) => a - b);
    const seaData = years.map((y) => {
      const m = seaYears.indexOf(y) !== -1 ? meanFor(seaSeries, y) : null;
      return m == null ? null : Number(m.toFixed(3));
    });
    const sstData = years.map((y) => {
      const m = sstYears.indexOf(y) !== -1 ? meanFor(sstSeries, y) : null;
      return m == null ? null : Number(m.toFixed(3));
    });

    return {
      chart: baseChart(tk, { type: "line" }),
      colors: [tk.accent, tk.warm],
      series: [
        { name: seaName, type: "line", data: seaData },
        { name: sstName, type: "line", data: sstData },
      ],
      stroke: { curve: "smooth", width: 2.5 },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: [
        baseYaxis(tk, {
          seriesName: seaName,
          title: { text: seaUnit, style: { color: tk.accent, fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: "11px" } },
          labels: {
            style: { colors: tk.accent, fontFamily: "IBM Plex Mono", fontSize: "11px" },
            formatter: (v) => fmt(Number(v), 2),
          },
        }),
        baseYaxis(tk, {
          seriesName: sstName,
          opposite: true,
          title: { text: sstUnit, style: { color: tk.warm, fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: "11px" } },
          labels: {
            style: { colors: tk.warm, fontFamily: "IBM Plex Mono", fontSize: "11px" },
            formatter: (v) => fmt(Number(v), 2),
          },
        }),
      ],
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: [
          { formatter: (v) => (v == null ? "—" : `${fmt(v)} ${seaUnit}`) },
          { formatter: (v) => (v == null ? "—" : `${fmt(v)} ${sstUnit}`) },
        ],
      }),
    };
  }, [seaSeries, seaYears, sstSeries, sstYears, seaName, sstName, seaUnit, sstUnit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}