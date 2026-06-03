// src/components/charts/AnomalyBandChart.jsx
// Anomalie dans le temps : ligne MOYENNE + bande min/max (dispersion entre
// territoires). Repère 0 = référence. Idéal pour niveau de la mer / SST.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { axisStyle, tooltipStyle, valAt, fmt, MONO } from "./echartsBase";

export default function AnomalyBandChart({ series = [], years = [], unit = "" }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const rows = years.map((y) => {
      const vals = series.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
      if (!vals.length) return { year: y, mean: null, min: null, max: null };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { year: y, mean: Number(mean.toFixed(3)), min: Math.min(...vals), max: Math.max(...vals) };
    });
    const ys = rows.map((r) => r.year);
    const mins = rows.map((r) => r.min);
    const ranges = rows.map((r) => (r.max != null && r.min != null ? Number((r.max - r.min).toFixed(3)) : null));
    const means = rows.map((r) => r.mean);
    return {
      grid: { left: 8, right: 16, top: 24, bottom: 40, containLabel: true },
      tooltip: {
        trigger: "axis",
        ...tooltipStyle(tk),
        formatter: (ps) => {
          const i = ps[0].dataIndex;
          const r = rows[i];
          if (!r || r.mean == null) return `${r ? r.year : ""}`;
          return `${r.year}<br/>moy. <strong>${fmt(r.mean)}</strong> ${unit}<br/>min ${fmt(r.min)} · max ${fmt(r.max)}`;
        },
      },
      xAxis: { type: "category", data: ys, boundaryGap: false, ...axisStyle(tk) },
      yAxis: { type: "value", name: unit, ...axisStyle(tk) },
      series: [
        { name: "min", type: "line", stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, data: mins, silent: true },
        { name: "band", type: "line", stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: `${tk.accent}24` }, data: ranges, silent: true },
        {
          name: "mean",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { color: tk.accent, width: 2.5 },
          data: means,
          markLine: {
            symbol: "none",
            data: [{ yAxis: 0 }],
            lineStyle: { color: tk.lineStrong, type: "dashed" },
            label: { color: tk.textMute, fontFamily: MONO, fontSize: 10, formatter: "réf. 0" },
          },
        },
      ],
    };
  }, [series, years, unit, tk]);

  return <EChart option={option} className="echart--tall" />;
}