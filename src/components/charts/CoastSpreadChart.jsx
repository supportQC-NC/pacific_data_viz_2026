// src/components/charts/CoastSpreadChart.jsx
// ============================================================
// Dispersion des vitesses de trait de côte PAR TERRITOIRE (boîte à
// moustaches Tukey, type ApexCharts boxPlot). Chaque boîte = distribution
// des segments suivis par satellite (m/an) : médiane, quartiles, moustaches.
// Trié par médiane (recul à gauche). Ligne de référence à 0 (stable).
//   rows : [{ name, box:[wLo,q1,med,q3,wHi], n }]
// ============================================================

import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineY, MONO } from "./apexBase";

export default function CoastSpreadChart({ rows = [], unit = "m/an" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const r = [...rows].filter((x) => Array.isArray(x.box) && x.box.length === 5).sort((a, b) => a.box[2] - b.box[2]);
    const byName = Object.fromEntries(r.map((x) => [x.name, x]));

    return {
      chart: baseChart(tk, { type: "boxPlot" }),
      colors: [tk.accent],
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      plotOptions: {
        boxPlot: { colors: { upper: `${tk.accent}33`, lower: `${tk.warm}33` } },
      },
      stroke: { width: 1.4 },
      series: [
        {
          type: "boxPlot",
          data: r.map((x) => ({ x: x.name, y: x.box.map((v) => Number(v)) })),
        },
      ],
      xaxis: baseXaxis(tk, {
        labels: {
          rotate: -45,
          rotateAlways: true,
          style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "11px" },
        },
      }),
      yaxis: baseYaxis(tk, {
        title: { text: unit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
          formatter: (v) => `${Number(v) > 0 ? "+" : ""}${fmt(Number(v), 1)}`,
        },
      }),
      annotations: { yaxis: [refLineY(tk, 0, "", tk.lineStrong)] },
      tooltip: baseTooltip({
        shared: false,
        custom: ({ dataPointIndex }) => {
          const x = r[dataPointIndex];
          if (!x) return "";
          const [lo, q1, med, q3, hi] = x.box;
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${x.name} · n=${x.n}</div>
            <div class="apexchart__tt-row">médiane ${med > 0 ? "+" : ""}${fmt(med, 2)} ${unit}</div>
            <div class="apexchart__tt-row">quartiles ${fmt(q1, 2)} … ${fmt(q3, 2)}</div>
            <div class="apexchart__tt-row">extrêmes ${fmt(lo, 2)} … ${fmt(hi, 2)}</div>
          </div>`;
        },
      }),
      states: { active: { filter: { type: "none" } } },
    };
  }, [rows, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}