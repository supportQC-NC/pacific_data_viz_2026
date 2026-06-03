// src/components/charts/ScatterChart.jsx
// Nuage « niveau × évolution » : X = émissions actuelles, Y = variation (%)
// depuis la première année. Une série par sous-région + repères de cadrans.
// groups : [{ name, color, points:[{ x, y, name }] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, axisStyle, tooltipStyle, MONO } from "./echartsBase";

export default function ScatterChart({ groups = [], unit = "", medianX = 0 }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const series = groups.map((g, i) => ({
      name: g.name,
      type: "scatter",
      symbolSize: 13,
      itemStyle: { color: g.color, opacity: 0.85, borderColor: tk.bg, borderWidth: 1 },
      emphasis: { focus: "series" },
      data: (g.points || []).map((p) => ({ value: [p.x, p.y], name: p.name })),
      markLine:
        i === 0
          ? {
              symbol: "none",
              lineStyle: { color: tk.lineStrong, type: "dashed" },
              data: [{ xAxis: medianX }, { yAxis: 0 }],
              label: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
            }
          : undefined,
    }));
    return {
      legend: { top: 0, textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: 11 } },
      grid: { left: 8, right: 24, top: 30, bottom: 44, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        formatter: (p) =>
          `${p.name}<br/>${fmt(p.value[0])} ${unit}<br/>${p.value[1] > 0 ? "+" : ""}${p.value[1]} %`,
      },
      xAxis: { type: "value", name: unit, ...axisStyle(tk) },
      yAxis: { type: "value", name: "%", ...axisStyle(tk) },
      series,
    };
  }, [groups, unit, medianX, tk]);

  return <EChart option={option} className="echart--tall" />;
}