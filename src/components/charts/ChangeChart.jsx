// src/components/charts/ChangeChart.jsx
// Variation entre la première et la dernière année (barres divergentes).
// rows : [{ name, delta }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, axisStyle, tooltipStyle, SANS } from "./echartsBase";

export default function ChangeChart({ rows = [], unit = "", direction = "all" }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    let r = [...rows];
    if (direction === "up") r = r.filter((x) => x.delta > 0);
    if (direction === "down") r = r.filter((x) => x.delta < 0);
    r.sort((a, b) => a.delta - b.delta);
    return {
      grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        valueFormatter: (v) => `${v > 0 ? "+" : ""}${fmt(v)} ${unit}`,
      },
      xAxis: { type: "value", name: unit, ...axisStyle(tk) },
      yAxis: {
        type: "category",
        data: r.map((x) => x.name),
        axisLabel: { color: tk.textSoft, fontFamily: SANS },
        axisLine: { lineStyle: { color: tk.line } },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: "60%",
          data: r.map((x) => ({
            value: x.delta,
            itemStyle: { color: x.delta <= 0 ? tk.positive : tk.warm, borderRadius: 3 },
          })),
          markLine: { symbol: "none", data: [{ xAxis: 0 }], lineStyle: { color: tk.lineStrong, width: 1 } },
        },
      ],
    };
  }, [rows, unit, direction, tk]);

  return <EChart option={option} className="echart--tall" />;
}