// src/components/charts/SunburstChart.jsx
// Hiérarchie sous-région -> territoire.
// MIGRÉ ECharts(sunburst) -> ApexCharts TREEMAP. Pour une colorisation
// FIABLE par sous-région, on crée UNE SÉRIE PAR SOUS-RÉGION (ApexCharts
// colore chaque série distinctement). TAILLE ∝ valeur (racine cubique
// atténuée comme avant) ; valeur réelle au survol ; légende = sous-régions.
// groups : [{ name, color, children:[{ name, real }] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseLegend, baseTooltip, SANS } from "./apexBase";

export default function SunburstChart({ groups = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const usable = groups
      .map((g) => ({
        name: g.name,
        color: g.color,
        data: (g.children || [])
          .filter((c) => Number.isFinite(c.real) && c.real > 0)
          .map((c) => ({
            x: c.name,
            y: Number(Math.cbrt(c.real).toFixed(4)), // taille atténuée
            real: c.real,
            region: g.name,
          })),
      }))
      .filter((g) => g.data.length);

    return {
      chart: baseChart(tk, { type: "treemap" }),
      colors: usable.map((g) => g.color),
      legend: baseLegend(tk, { show: true }),
      dataLabels: {
        enabled: true,
        style: { fontFamily: SANS, fontSize: "11px", colors: ["#fff"] },
        offsetY: -2,
      },
      plotOptions: {
        treemap: {
          distributed: false,
          enableShades: false,
          borderRadius: 3,
        },
      },
      stroke: { width: 2, colors: [tk.bg] },
      series: usable.map((g) => ({ name: g.name, data: g.data })),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const pt = w.config.series[seriesIndex].data[dataPointIndex];
          if (!pt) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${pt.x}</div>
            <div class="apexchart__tt-row">${pt.region}</div>
            <div class="apexchart__tt-row"><strong>${fmt(pt.real)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [groups, unit, tk]);

  return <ApexChart options={option} className="apexchart--xl" />;
}