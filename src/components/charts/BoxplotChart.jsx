// src/components/charts/BoxplotChart.jsx
// Distribution annuelle entre territoires (Tukey) + valeurs atypiques.
// MIGRÉ ECharts -> ApexCharts (boxPlot + scatter combinés). Props inchangées.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, quantile, valAt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

export default function BoxplotChart({ series = [], years = [], unit = "", scale = "lin" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const box = [];
    const outliers = [];

    years.forEach((y) => {
      const vals = series
        .map((s) => valAt(s, y))
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);
      if (vals.length < 3) return;

      const q1 = quantile(vals, 0.25);
      const q2 = quantile(vals, 0.5);
      const q3 = quantile(vals, 0.75);
      const iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const inb = vals.filter((v) => v >= lo && v <= hi);

      box.push({
        x: String(y),
        y: [
          Number(Math.min(...inb).toFixed(2)),
          Number(q1.toFixed(2)),
          Number(q2.toFixed(2)),
          Number(q3.toFixed(2)),
          Number(Math.max(...inb).toFixed(2)),
        ],
      });
      vals
        .filter((v) => v < lo || v > hi)
        .forEach((v) => outliers.push({ x: String(y), y: Number(v.toFixed(2)) }));
    });

    const step = Math.max(1, Math.ceil(years.length / 12));

    return {
      chart: baseChart(tk, { type: "boxPlot" }),
      colors: [tk.accent, tk.warm],
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      plotOptions: {
        boxPlot: {
          colors: { upper: `${tk.accent}26`, lower: `${tk.accent}26` },
        },
        bar: { columnWidth: "55%" },
      },
      stroke: { width: 1.5, colors: [tk.accent] },
      markers: { size: 5, colors: [tk.warm], strokeColors: tk.bg, strokeWidth: 1 },
      series: [
        { name: "box", type: "boxPlot", data: box },
        { name: "outliers", type: "scatter", data: outliers },
      ],
      xaxis: baseXaxis(tk, {
        type: "category",
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "10px" },
          formatter: (val, _ts, opts) => {
            const i = opts && opts.i != null ? opts.i : 0;
            return i % step === 0 ? val : "";
          },
        },
      }),
      yaxis: baseYaxis(tk, {
        logarithmic: scale === "log",
        title: { text: unit },
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({ shared: false, intersect: true }),
    };
  }, [series, years, unit, scale, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}