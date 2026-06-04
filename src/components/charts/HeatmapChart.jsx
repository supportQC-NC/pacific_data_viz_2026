// src/components/charts/HeatmapChart.jsx
// Heatmap territoires × années. Mode "rank" = bandes discrètes (quantiles),
// mode "abs" = paliers réguliers. Tooltip = valeur réelle.
// MIGRÉ ECharts -> ApexCharts. Props inchangées.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, quantile, valAt, apexRamp, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip } from "./apexBase";

export default function HeatmapChart({
  series = [],
  years = [],
  unit = "",
  mode = "rank",
  labels = {},
  invert = false,
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const all = [];
    series.forEach((s) =>
      years.forEach((y) => {
        const v = valAt(s, y);
        if (Number.isFinite(v)) all.push(v);
      }),
    );
    const sorted = [...all].sort((a, b) => a - b);
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 1;
    // invert : haut = bon (vert). Inverse la rampe séquentielle (rank/abs).
    const ramp = invert ? [...apexRamp(tk)].reverse() : apexRamp(tk);

    // ApexCharts dessine la 1re série en bas : on inverse pour garder le
    // 1er territoire en haut (cohérent avec l'ancien rendu).
    const apexSeries = [...series]
      .map((s) => ({
        name: s.name,
        data: years.map((y) => {
          const v = valAt(s, y);
          return { x: String(y), y: Number.isFinite(v) ? Number(v.toFixed(2)) : null };
        }),
      }))
      .reverse();

    // Construit des plages de couleur contiguës.
    let ranges;
    if (mode === "diverge") {
      // Échelle DIVERGENTE ROBUSTE centrée sur 0. Un outlier ne doit pas
      // écraser l'échelle : on borne au 90ᵉ centile des |valeurs| (plancher
      // 0.5), et les bandes extrêmes vont jusqu'à ±∞ pour rester colorées.
      // Rouge/orange = déclin (<0), teal/vert = croissance (>0). Pas de
      // couleur neutre fantôme.
      const absVals = all.map((v) => Math.abs(v)).sort((x, y) => x - y);
      const t = Math.max(absVals.length ? quantile(absVals, 0.9) : 1, 0.5);
      const t1 = t / 2;
      ranges = [
        { from: -1e9, to: -t1, color: tk.negative },   // déclin fort
        { from: -t1, to: 0, color: tk.warm },           // déclin léger
        { from: 0, to: t1, color: tk.accent },          // croissance légère
        { from: t1, to: 1e9, color: tk.positive },      // croissance forte
      ];
    } else if (mode === "rank" && sorted.length > 4) {
      const ths = [...new Set([1, 2, 3, 4, 5].map((i) => Number(quantile(sorted, i / 6).toFixed(2))))].sort(
        (a, b) => a - b,
      );
      const edges = [min - 1e-6, ...ths, max + 1e-6];
      ranges = [];
      for (let i = 0; i < edges.length - 1; i += 1) {
        const color = ramp[Math.round((i / (edges.length - 2)) * (ramp.length - 1))];
        ranges.push({ from: edges[i], to: edges[i + 1], color });
      }
    } else {
      const steps = ramp.length;
      const span = (max - min) || 1;
      ranges = ramp.map((color, i) => ({
        from: min + (span * i) / steps - (i === 0 ? 1e-6 : 0),
        to: min + (span * (i + 1)) / steps + (i === steps - 1 ? 1e-6 : 0),
        color,
      }));
    }

    const step = Math.max(1, Math.ceil(years.length / 12));

    return {
      chart: baseChart(tk, { type: "heatmap" }),
      dataLabels: { enabled: false },
      legend: { show: false },
      stroke: { width: 2, colors: [tk.bg] },
      grid: baseGrid(tk, { yaxis: { lines: { show: false } } }),
      plotOptions: {
        heatmap: {
          radius: 3,
          enableShades: false,
          colorScale: { ranges },
        },
      },
      series: apexSeries,
      xaxis: baseXaxis(tk, {
        type: "category",
        labels: {
          rotate: 0,
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "10px" },
          formatter: (val, _ts, opts) => {
            const i = opts && opts.i != null ? opts.i : 0;
            return i % step === 0 ? val : "";
          },
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "11px" } },
      }),
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const name = w.globals.seriesNames[seriesIndex];
          const year = w.globals.labels[dataPointIndex];
          const v = w.globals.series[seriesIndex][dataPointIndex];
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${name} · ${year}</div>
            <div class="apexchart__tt-row"><strong>${fmt(v)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [series, years, unit, mode, labels, invert, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}