// src/components/charts/ShareAboveChart.jsx
// Part des territoires AU-DESSUS de la référence (anomalie > 0), année après
// année. Montre l'exposition qui se généralise. MIGRÉ ECharts -> ApexCharts.
// Props inchangées { series, years }.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { valAt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineY } from "./apexBase";

export default function ShareAboveChart({ series = [], years = [] }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const data = years.map((y) => {
      const vs = series.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
      if (!vs.length) return null;
      const above = vs.filter((v) => v > 0).length;
      return Number(((above / vs.length) * 100).toFixed(0));
    });

    return {
      chart: baseChart(tk, { type: "area" }),
      colors: [tk.warm],
      series: [{ name: "% > réf.", data }],
      stroke: { curve: "smooth", width: 2.5 },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 0.4, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] },
      },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        min: 0,
        max: 100,
        tickAmount: 4,
        title: { text: "%" },
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => `${Math.round(Number(v))}`,
        },
      }),
      tooltip: baseTooltip({
        y: { formatter: (v) => (v == null ? "—" : `${v} %`), title: { formatter: () => "" } },
      }),
      annotations: { yaxis: [refLineY(tk, 50, "50 %", tk.lineStrong)] },
    };
  }, [series, years, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}