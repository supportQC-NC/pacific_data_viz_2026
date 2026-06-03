// src/components/charts/TrendChart.jsx
// Trajectoires multi-territoires dans le temps (zoom temporel, focus au survol).
// MIGRÉ ECharts -> ApexCharts. Props inchangées.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, apexPalette, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, valAt } from "./apexBase";

export default function TrendChart({ series = [], years = [], unit = "", scale = "lin" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const last = years[years.length - 1];
    const ranked = [...series]
      .map((s) => ({ ...s, _last: valAt(s, last) ?? 0 }))
      .sort((a, b) => b._last - a._last);

    const apexSeries = ranked.map((s) => ({
      name: s.name,
      data: years.map((y) => {
        const v = valAt(s, y);
        return Number.isFinite(v) ? Number(v) : null;
      }),
    }));

    return {
      chart: baseChart(tk, {
        type: "line",
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        toolbar: {
          show: true,
          tools: { download: false, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true },
        },
      }),
      colors: apexPalette(tk),
      stroke: { curve: "smooth", width: 1.8 },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      series: apexSeries,
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        logarithmic: scale === "log",
        title: { text: unit },
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: { formatter: (v) => (v == null ? "—" : `${fmt(v)} ${unit}`) },
      }),
    };
  }, [series, years, unit, scale, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}