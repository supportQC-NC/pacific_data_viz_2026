// src/components/charts/AnnualBarsChart.jsx
// Totaux PAR ANNÉE en colonnes — honnête pour des données événementielles à
// pics (≠ courbe). Montre quelles années ont frappé le plus fort.
// Props : data [{year, value}], unit, color, format (fonction d'affichage).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

export default function AnnualBarsChart({ data = [], unit = "", color, format }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => `${v}`;

  const option = useMemo(() => {
    const years = data.map((d) => d.year);
    const vals = data.map((d) => Number(d.value) || 0);
    const step = Math.max(1, Math.ceil(years.length / 14));

    return {
      chart: baseChart(tk, { type: "bar" }),
      colors: [color || tk.warm],
      series: [{ name: unit || "total", data: vals }],
      plotOptions: { bar: { columnWidth: "62%", borderRadius: 2 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "10px" },
          formatter: (val, _ts, opts) => {
            const i = opts && opts.i != null ? opts.i : 0;
            return i % step === 0 ? val : "";
          },
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => fmtV(Number(v)),
        },
      }),
      tooltip: baseTooltip({
        y: { formatter: (v) => `${fmtV(Number(v))} ${unit}`, title: { formatter: () => "" } },
      }),
    };
  }, [data, unit, color, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}