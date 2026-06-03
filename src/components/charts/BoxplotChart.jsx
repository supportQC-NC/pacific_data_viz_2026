// src/components/charts/BoxplotChart.jsx
// Distribution annuelle des émissions par habitant entre territoires.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { quantile, valAt, axisStyle, tooltipStyle } from "./echartsBase";

export default function BoxplotChart({ series = [], years = [], unit = "", scale = "lin" }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const boxData = [];
    const outliers = [];
    years.forEach((y, xi) => {
      const vals = series
        .map((s) => valAt(s, y))
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);
      if (vals.length < 3) {
        boxData.push([null, null, null, null, null]);
        return;
      }
      const q1 = quantile(vals, 0.25);
      const q2 = quantile(vals, 0.5);
      const q3 = quantile(vals, 0.75);
      const iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const inb = vals.filter((v) => v >= lo && v <= hi);
      boxData.push([
        Number(Math.min(...inb).toFixed(2)),
        Number(q1.toFixed(2)),
        Number(q2.toFixed(2)),
        Number(q3.toFixed(2)),
        Number(Math.max(...inb).toFixed(2)),
      ]);
      vals.filter((v) => v < lo || v > hi).forEach((v) => outliers.push([xi, Number(v.toFixed(2))]));
    });
    return {
      grid: { left: 8, right: 16, top: 16, bottom: 56, containLabel: true },
      tooltip: { trigger: "item", ...tooltipStyle(tk) },
      xAxis: { type: "category", data: years, boundaryGap: true, ...axisStyle(tk) },
      yAxis: { type: scale === "log" ? "log" : "value", name: unit, ...axisStyle(tk) },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          height: 16,
          bottom: 16,
          borderColor: tk.line,
          fillerColor: `${tk.accent}22`,
          handleStyle: { color: tk.accent },
          textStyle: { color: tk.textMute },
        },
      ],
      series: [
        {
          name: "box",
          type: "boxplot",
          data: boxData,
          itemStyle: { color: `${tk.accent}26`, borderColor: tk.accent, borderWidth: 1.5 },
          emphasis: { itemStyle: { borderColor: tk.warm } },
        },
        { name: "outliers", type: "scatter", data: outliers, symbolSize: 6, itemStyle: { color: tk.warm } },
      ],
    };
  }, [series, years, unit, scale, tk]);

  return <EChart option={option} className="echart--tall" />;
}