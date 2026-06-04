// src/components/charts/TreemapChart.jsx
// Treemap PLAT : une tuile par entité, TAILLE ∝ valeur, COULEUR ∝ intensité
// (rampe séquentielle). Idéal pour « qui pèse le plus » / concentration.
// Props : rows [{name, value}], unit, format (fonction d'affichage).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { quantile, apexRamp, baseChart, baseTooltip, SANS } from "./apexBase";

export default function TreemapChart({ rows = [], unit = "", format }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => `${v}`;

  const option = useMemo(() => {
    const data = rows
      .filter((r) => Number.isFinite(r.value) && r.value > 0)
      .map((r) => ({ x: r.name, y: Number(r.value) }));

    const sorted = data.map((d) => d.y).sort((a, b) => a - b);
    const ramp = apexRamp(tk); // faible -> élevé
    let ranges = [];
    if (sorted.length > 1) {
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const ths = [...new Set([1, 2, 3, 4].map((i) => quantile(sorted, i / 5)))].sort((a, b) => a - b);
      const edges = [min - 1e-6, ...ths, max + 1e-6];
      for (let i = 0; i < edges.length - 1; i += 1) {
        const color = ramp[Math.round((i / (edges.length - 2)) * (ramp.length - 1))];
        ranges.push({ from: edges[i], to: edges[i + 1], color });
      }
    } else {
      ranges = [{ from: -1e9, to: 1e9, color: ramp[ramp.length - 1] }];
    }

    return {
      chart: baseChart(tk, { type: "treemap" }),
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontFamily: SANS, fontSize: "11px", colors: ["#fff"] },
        offsetY: -2,
        formatter: (text) => text,
      },
      plotOptions: {
        treemap: {
          distributed: false,
          enableShades: false,
          borderRadius: 3,
          colorScale: { ranges },
        },
      },
      stroke: { width: 2, colors: [tk.bg] },
      series: [{ data }],
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const pt = w.config.series[seriesIndex].data[dataPointIndex];
          if (!pt) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${pt.x}</div>
            <div class="apexchart__tt-row"><strong>${fmtV(pt.y)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [rows, unit, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--xl" />;
}