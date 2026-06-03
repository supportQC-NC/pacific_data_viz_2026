// src/components/charts/TrendChart.jsx
// Trajectoires multi-territoires dans le temps (zoom temporel, focus au survol).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { axisStyle, tooltipStyle, paletteOf, valAt, MONO } from "./echartsBase";

export default function TrendChart({ series = [], years = [], unit = "", scale = "lin" }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const last = years[years.length - 1];
    const ranked = [...series]
      .map((s) => ({ ...s, _last: valAt(s, last) ?? 0 }))
      .sort((a, b) => b._last - a._last);
    return {
      color: paletteOf(tk),
      grid: { left: 8, right: 16, top: 28, bottom: 64, containLabel: true },
      tooltip: { trigger: "axis", ...tooltipStyle(tk) },
      legend: {
        type: "scroll",
        top: 0,
        textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: 11 },
        inactiveColor: tk.textMute,
      },
      xAxis: { type: "category", data: years, boundaryGap: false, ...axisStyle(tk) },
      yAxis: { type: scale === "log" ? "log" : "value", name: unit, ...axisStyle(tk) },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          height: 18,
          bottom: 24,
          borderColor: tk.line,
          fillerColor: `${tk.accent}22`,
          handleStyle: { color: tk.accent },
          textStyle: { color: tk.textMute },
          dataBackground: { lineStyle: { color: tk.line }, areaStyle: { color: tk.line } },
        },
      ],
      series: ranked.map((s) => ({
        name: s.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        emphasis: { focus: "series" },
        lineStyle: { width: 1.6 },
        data: years.map((y) => valAt(s, y)),
      })),
    };
  }, [series, years, unit, scale, tk]);

  return <EChart option={option} className="echart--tall" />;
}