// src/components/charts/SlopeChart.jsx
// SLOPE CHART : chaque entité = une ligne reliant deux points dans le temps
// ou deux mesures. Pour la synthèse : gauche = responsabilité (0–100),
// droite = vulnérabilité (0–100). Une pente montante (droite > gauche) = peu
// responsable mais très exposé → l'injustice climatique, colorée en corail.
// Props : rows [{name, left, right}], leftLabel, rightLabel, unit.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function SlopeChart({ rows = [], leftLabel = "", rightLabel = "", unit = "", min = 0, max = 100, reverse = false, invertColor = false }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const clean = rows.filter((r) => Number.isFinite(r.left) && Number.isFinite(r.right));
    const series = clean.map((r) => ({ name: r.name, data: [Number(r.left), Number(r.right)] }));
    // Couleur = sens de la pente. invertColor : utile quand l'axe est un RANG
    // (plus petit = pire), où « droite < gauche » signale l'injustice.
    const isWarm = (r) => (invertColor ? Number(r.right) < Number(r.left) : Number(r.right) > Number(r.left));
    const colors = clean.map((r) => (isWarm(r) ? tk.warm : tk.accent));

    return {
      chart: baseChart(tk, { type: "line" }),
      colors,
      stroke: { width: 2, curve: "straight" },
      markers: { size: 5, strokeColors: tk.bg, strokeWidth: 1, hover: { size: 7 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk, { xaxis: { lines: { show: false } }, padding: { left: 80, right: 80, top: 10, bottom: 6 } }),
      series,
      xaxis: baseXaxis(tk, {
        categories: [leftLabel, rightLabel],
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: tk.textSoft, fontFamily: MONO, fontSize: "12px" } },
      }),
      yaxis: baseYaxis(tk, {
        min,
        max,
        reversed: reverse,
        tickAmount: 5,
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Number(v), 0) },
      }),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex }) => {
          const r = clean[seriesIndex];
          if (!r) return "";
          const val = dataPointIndex === 0 ? r.left : r.right;
          const side = dataPointIndex === 0 ? leftLabel : rightLabel;
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.name}</div>
            <div class="apexchart__tt-row">${side}: <strong>${fmt(val, 0)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [rows, leftLabel, rightLabel, unit, min, max, reverse, invertColor, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}