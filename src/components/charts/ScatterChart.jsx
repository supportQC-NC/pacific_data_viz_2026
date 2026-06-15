// src/components/charts/ScatterChart.jsx
// Nuage « niveau × évolution » : X = niveau actuel, Y = variation (%) depuis
// la première année. Une série par sous-région + repères de cadrans.
// groups : [{ name, color, points:[{ x, y, name }] }]
// logX : axe X logarithmique — étale un amas écrasé par un outlier (recommandé
//        quand les niveaux vont de ~0.1 à ~90).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, axisStyle, tooltipStyle, MONO } from "./echartsBase";

export default function ScatterChart({
  groups = [],
  unit = "",
  medianX = 0,
  xName,
  yName = "%",
  logX = false,
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const series = groups.map((g, i) => ({
      name: g.name,
      type: "scatter",
      symbolSize: 18,
      itemStyle: {
        color: g.color,
        opacity: 0.88,
        borderColor: tk.bg,
        borderWidth: 2,
      },
      emphasis: {
        focus: "series",
        itemStyle: { opacity: 1, borderWidth: 2.5 },
      },
      blur: { itemStyle: { opacity: 0.18 } },
      data: (g.points || []).map((p) => ({ value: [p.x, p.y], name: p.name })),
      markLine:
        i === 0
          ? {
              symbol: "none",
              lineStyle: { color: tk.lineStrong, type: "dashed", width: 1 },
              data: [{ xAxis: medianX }, { yAxis: 0 }],
              label: { show: false },
            }
          : undefined,
    }));
    return {
      legend: { show: false },
      grid: { left: 8, right: 28, top: 16, bottom: 52, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        formatter: (p) =>
          `<strong>${p.name}</strong> · ${p.seriesName}<br/>${fmt(p.value[0])} ${xName || unit}<br/>${p.value[1] > 0 ? "+" : ""}${p.value[1]} ${yName}`,
      },
      xAxis: {
        type: logX ? "log" : "value",
        name: xName || unit,
        nameTextStyle: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
        scale: !logX,
        ...(logX ? { logBase: 10, min: 0.1 } : {}),
        ...axisStyle(tk),
      },
      yAxis: { type: "value", name: yName, scale: true, ...axisStyle(tk) },
      series,
    };
  }, [groups, unit, medianX, xName, yName, logX, tk]);

  return <EChart option={option} className="echart--tall" />;
}
