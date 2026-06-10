// src/components/charts/DumbbellChart.jsx
// Haltère (dumbbell) : pour chaque territoire, un trait de la PREMIÈRE année
// (point sourd) à la DERNIÈRE (point chaud). Trié par valeur finale.
// MIGRÉ ECharts(custom) -> ApexCharts (rangeBar isDumbbell natif).
//   • HAUTEUR DYNAMIQUE : rows × ligne → toutes les lignes visibles, jamais
//     de coupure (le wrapper ApexChart respecte une hauteur explicite ; le
//     parent peut défiler si besoin).
//   • `decimals` pilote axe + tooltip (0 = entiers, ex. comptages).
// Props { rows:[{name,start,end}], unit, startLabel, endLabel, decimals }.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

const ROW_H = 30; // hauteur d'une ligne (px)
const EXTRA_H = 80; // axe X + marges

export default function DumbbellChart({ rows = [], unit = "", startLabel = "", endLabel = "", decimals = 2 }) {
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

    const height = Math.max(320, r.length * ROW_H + EXTRA_H);

    return {
      chart: { ...baseChart(tk, { type: "rangeBar" }), height },
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
          formatter: (v) => fmt(Number(v), decimals),
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
            <div class="apexchart__tt-row">${startLabel}: ${fmt(x.start, decimals)} ${unit}</div>
            <div class="apexchart__tt-row">${endLabel}: <strong>${fmt(x.end, decimals)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [rows, unit, startLabel, endLabel, decimals, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}