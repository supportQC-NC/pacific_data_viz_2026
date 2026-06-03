// src/components/charts/DumbbellChart.jsx
// Haltère (dumbbell) : pour chaque territoire, un trait de la PREMIÈRE année
// (point sourd) à la DERNIÈRE (point chaud). Trié par valeur finale.
// MIGRÉ ECharts(custom) -> ApexCharts (rangeBar isDumbbell natif).
// Props inchangées { rows:[{name,start,end}], unit, startLabel, endLabel }.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

export default function DumbbellChart({ rows = [], unit = "", startLabel = "", endLabel = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    // ApexCharts empile du bas vers le haut : tri ascendant -> plus grande
    // valeur finale en haut (cohérent avec l'ancien rendu).
    const r = [...rows]
      .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end))
      .sort((a, b) => a.end - b.end);

    const data = r.map((x) => ({
      x: x.name,
      y: [Number(x.start.toFixed(3)), Number(x.end.toFixed(3))],
    }));

    return {
      chart: baseChart(tk, { type: "rangeBar" }),
      colors: [tk.lineStrong],
      series: [{ data }],
      plotOptions: {
        bar: {
          horizontal: true,
          isDumbbell: true,
          dumbbellColors: [[tk.textMute, tk.warm]],
          barHeight: "55%",
        },
      },
      fill: {
        type: "gradient",
        gradient: { type: "horizontal", gradientToColors: [tk.warm], stops: [0, 100] },
      },
      stroke: { width: 2, colors: [tk.lineStrong] },
      markers: { size: 0 },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "numeric",
        title: { text: unit, style: { color: tk.textMute, fontFamily: "IBM Plex Mono", fontWeight: 400, fontSize: "11px" } },
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 2),
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "12px" } },
      }),
      tooltip: baseTooltip({
        custom: ({ dataPointIndex }) => {
          const x = r[dataPointIndex];
          if (!x) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${x.name}</div>
            <div class="apexchart__tt-row">${startLabel}: ${fmt(x.start)} ${unit}</div>
            <div class="apexchart__tt-row">${endLabel}: <strong>${fmt(x.end)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [rows, unit, startLabel, endLabel, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}