// src/components/charts/RiverChart.jsx
// Flux (themeRiver) des moyennes par sous-région dans le temps.
// subAvg : [{ name, values:[{year, value}] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { paletteOf, tooltipStyle, MONO } from "./echartsBase";

export default function RiverChart({ subAvg = [], years = [] }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const data = [];
    subAvg.forEach((grp) => {
      grp.values.forEach((p) => {
        if (Number.isFinite(p.value)) data.push([p.year, Number(p.value.toFixed(3)), grp.name]);
      });
    });
    return {
      color: paletteOf(tk),
      tooltip: { trigger: "axis", ...tooltipStyle(tk), axisPointer: { type: "line", lineStyle: { color: tk.line } } },
      legend: { top: 0, data: subAvg.map((g) => g.name), textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: 11 } },
      singleAxis: {
        type: "value",
        min: years[0],
        max: years[years.length - 1],
        top: 48,
        bottom: 24,
        axisLabel: { color: tk.textMute, fontFamily: MONO, formatter: (v) => Math.round(v) },
        axisLine: { lineStyle: { color: tk.line } },
        axisTick: { lineStyle: { color: tk.line } },
        splitLine: { show: false },
      },
      series: [
        { type: "themeRiver", data, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: tk.accentDeep } } },
      ],
    };
  }, [subAvg, years, tk]);

  return <EChart option={option} className="echart--tall" />;
}