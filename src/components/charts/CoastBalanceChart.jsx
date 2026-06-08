// src/components/charts/CoastBalanceChart.jsx
// ============================================================
// Bilan côtier par territoire — barres DIVERGENTES empilées.
//   • à gauche (rouge)  : part du littoral en RECUL  (érosion)
//   • à droite (bleu)   : part du littoral en AVANCÉE (accrétion)
// Couleurs alignées sur la couche « trait de côte » d'OceanMap pour une
// lecture cohérente carte ↔ graphe. ApexCharts (wrapper maison).
//   rows : [{ name, ero, acc, med, n }]  (ero/acc en % ; med en m/an)
// ============================================================

import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineX, MONO } from "./apexBase";

const ERO = "#e8453c"; // recul
const ACC = "#2c7fb8"; // avancée

export default function CoastBalanceChart({ rows = [], retreatLabel = "Recul", advanceLabel = "Avancée", unit = "%" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const r = [...rows].sort((a, b) => a.bal - b.bal);
    const byName = Object.fromEntries(r.map((x) => [x.name, x]));

    return {
      chart: baseChart(tk, { type: "bar", stacked: true }),
      colors: [ERO, ACC],
      plotOptions: {
        bar: { horizontal: true, barHeight: "66%", borderRadius: 3 },
      },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
        markers: { radius: 3 },
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textMute },
      },
      grid: baseGrid(tk),
      series: [
        { name: retreatLabel, data: r.map((x) => ({ x: x.name, y: -Math.abs(x.ero) })) },
        { name: advanceLabel, data: r.map((x) => ({ x: x.name, y: Math.abs(x.acc) })) },
      ],
      xaxis: baseXaxis(tk, {
        type: "numeric",
        title: { text: `${retreatLabel} ◂ ${unit} ▸ ${advanceLabel}`, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
          formatter: (v) => `${Math.abs(Math.round(Number(v)))}`,
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "12px" } },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: {
          formatter: (v) => `${Math.abs(Number(v)).toFixed(0)} ${unit}`,
        },
        x: {
          formatter: (name) => {
            const d = byName[name];
            return d ? `${name} · méd ${d.med > 0 ? "+" : ""}${fmt(d.med, 2)} m/an · n=${d.n}` : name;
          },
        },
      }),
      annotations: { xaxis: [refLineX(tk, 0, "", tk.lineStrong)] },
      states: { active: { filter: { type: "none" } } },
    };
  }, [rows, retreatLabel, advanceLabel, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}