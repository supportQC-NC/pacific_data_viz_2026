// src/components/charts/GapBars.jsx
// BARRES DIVERGENTES = « la dette climatique ». Pour chaque territoire :
// valeur = vulnérabilité − responsabilité (0–100 chacune). À droite (corail) :
// subit plus qu'il ne doit (victime de l'injustice). À gauche (cyan) : doit
// plus qu'il ne subit. Trié, repère à 0. ApexCharts (bar horizontal divergent).
// Props : rows [{name, value}], unit, leftLabel, rightLabel, format (fn).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, MONO } from "./apexBase";

export default function GapBars({ rows = [], unit = "", leftLabel = "", rightLabel = "", format }) {
  const tk = useThemeTokens();
  const fmtV = typeof format === "function" ? format : (v) => fmt(v, 0);

  const option = useMemo(() => {
    const data = rows.filter((r) => Number.isFinite(r.value));
    const cats = data.map((r) => r.name);
    const series = [{ name: "gap", data: data.map((r) => Math.round(r.value)) }];
    const maxAbs = Math.max(10, ...data.map((r) => Math.abs(r.value)));

    return {
      chart: baseChart(tk, { type: "bar" }),
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: "66%",
          borderRadius: 3,
          colors: {
            ranges: [
              { from: -1000, to: -0.0001, color: tk.accent },
              { from: 0, to: 1000, color: tk.warm },
            ],
          },
        },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk, { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } }),
      series,
      xaxis: baseXaxis(tk, {
        min: -maxAbs,
        max: maxAbs,
        tickAmount: 6,
        categories: cats,
        labels: { style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" }, formatter: (v) => fmt(Number(v), 0) },
      }),
      yaxis: baseYaxis(tk, { labels: { style: { colors: tk.textSoft, fontFamily: MONO, fontSize: "11px" } } }),
      tooltip: baseTooltip({
        custom: ({ dataPointIndex }) => {
          const r = data[dataPointIndex];
          if (!r) return "";
          const v = Math.round(r.value);
          const lab = v >= 0 ? rightLabel : leftLabel;
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.name}</div>
            <div class="apexchart__tt-row"><strong>${v > 0 ? "+" : ""}${fmtV(v)}</strong> ${unit}</div>
            <div class="apexchart__tt-row">${lab}</div>
          </div>`;
        },
      }),
      annotations: { xaxis: [{ x: 0, borderColor: tk.lineStrong, strokeDashArray: 0 }] },
    };
  }, [rows, unit, leftLabel, rightLabel, fmtV, tk]);

  return <ApexChart options={option} className="apexchart--xl" />;
}