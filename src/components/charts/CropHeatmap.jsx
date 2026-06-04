// src/components/charts/CropHeatmap.jsx
// Heatmap CULTURE × TERRITOIRE. Les rendements varient énormément d'une
// culture à l'autre : on NORMALISE chaque ligne (culture) sur 0–100 % de son
// meilleur territoire, pour comparer « où chaque culture réussit le mieux ».
// La valeur brute reste dans l'infobulle. Haut (vert) = meilleur.
// Props : rows [{ name, cells:[{ x, y, raw }] }], unit, format
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { apexRamp, baseChart, baseXaxis, baseTooltip, SANS } from "./apexBase";

export default function CropHeatmap({ rows = [], unit = "", format }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => `${v}`;

  const option = useMemo(() => {
    const series = rows.map((r) => ({
      name: r.name,
      data: (r.cells || []).map((c) => ({ x: c.x, y: c.y })),
    }));
    // 0 (rouge) -> 100 (vert) : rampe séquentielle inversée.
    const ramp = [...apexRamp(tk)].reverse();
    const n = ramp.length;
    const ranges = ramp.map((color, i) => ({
      from: i === 0 ? -1e-6 : (100 * i) / n,
      to: (100 * (i + 1)) / n + (i === n - 1 ? 1e-6 : 0),
      color,
    }));

    return {
      chart: baseChart(tk, { type: "heatmap" }),
      legend: { show: false },
      dataLabels: { enabled: false },
      stroke: { width: 1, colors: [tk.bg] },
      plotOptions: {
        heatmap: {
          radius: 2,
          enableShades: false,
          colorScale: { ranges },
        },
      },
      series,
      xaxis: baseXaxis(tk, {
        type: "category",
        labels: {
          rotate: -40,
          rotateAlways: true,
          hideOverlappingLabels: false,
          trim: true,
          style: { colors: tk.textSoft, fontFamily: SANS, fontSize: "10px" },
        },
      }),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex }) => {
          const r = rows[seriesIndex];
          const c = r && r.cells ? r.cells[dataPointIndex] : null;
          if (!c) return "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${c.x}</div>
            <div class="apexchart__tt-row">${r.name}</div>
            <div class="apexchart__tt-row"><strong>${fmtV(c.raw)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [rows, unit, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--xl" />;
}