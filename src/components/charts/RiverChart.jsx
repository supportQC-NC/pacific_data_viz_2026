// src/components/charts/RiverChart.jsx
// Flux des moyennes par sous-région dans le temps.
// MIGRÉ ECharts(themeRiver) -> ApexCharts : aire EMPILÉE lissée (baseline 0).
// On exploite ApexCharts à fond (gradient, lissage) pour conserver la
// sensation de « flux » tout en restant lisible.
// subAvg : [{ name, values:[{year, value}] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, apexPalette, baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

export default function RiverChart({ subAvg = [], years = [] }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const at = (grp, y) => {
      const p = grp.values.find((d) => d.year === y);
      return p && Number.isFinite(p.value) ? Number(p.value.toFixed(3)) : 0;
    };
    const series = subAvg.map((g) => ({
      name: g.name,
      data: years.map((y) => at(g, y)),
    }));

    return {
      chart: baseChart(tk, { type: "area", stacked: true }),
      colors: apexPalette(tk),
      stroke: { curve: "smooth", width: 1.5 },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 0.4, opacityFrom: 0.55, opacityTo: 0.25, stops: [0, 100] },
      },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 4 } },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      series,
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({ shared: true, intersect: false, y: { formatter: (v) => fmt(v) } }),
    };
  }, [subAvg, years, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}