// src/components/charts/RadarChart.jsx
// Profil des sous-régions par décennie (radar). Échelle commune (même unité)
// -> comparaison directe entre décennies. MIGRÉ ECharts -> ApexCharts.
// subAvg : [{ name, values:[{year, value}] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, apexPalette, baseChart, baseLegend, baseTooltip, MONO } from "./apexBase";

export default function RadarChart({ subAvg = [], years = [] }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const last = years[years.length - 1];
    const decades = years.filter((y) => y % 10 === 0);
    if (last != null && !decades.includes(last)) decades.push(last);
    if (decades.length < 3) return null;

    const at = (grp, y) => {
      const p = grp.values.find((d) => d.year === y);
      return p ? p.value : 0;
    };

    const categories = decades.map((d) => String(d));
    const series = subAvg.map((g) => ({
      name: g.name,
      data: decades.map((d) => Number(at(g, d).toFixed(3))),
    }));

    return {
      chart: baseChart(tk, { type: "radar" }),
      colors: apexPalette(tk),
      stroke: { width: 2 },
      fill: { opacity: 0.08 },
      markers: { size: 3, hover: { size: 5 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk, { horizontalAlign: "center" }),
      series,
      plotOptions: {
        radar: {
          polygons: {
            strokeColors: tk.line,
            connectorColors: tk.line,
            fill: { colors: ["transparent"] },
          },
        },
      },
      yaxis: { show: false },
      xaxis: {
        categories,
        labels: { style: { colors: categories.map(() => tk.textMute), fontFamily: MONO, fontSize: "11px" } },
      },
      tooltip: baseTooltip({ y: { formatter: (v) => fmt(v) } }),
    };
  }, [subAvg, years, tk]);

  if (!option) return null;
  return <ApexChart options={option} className="apexchart--tall" />;
}