// src/components/charts/RankChart.jsx
// Classement horizontal des territoires + repère médiane + couleur sémantique.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, axisStyle, tooltipStyle, SANS, MONO } from "./echartsBase";

export default function RankChart({
  points = [],
  unit = "",
  median = 0,
  refLabel = "",
  sort = "desc",
  scale = "lin",
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const pts = [...points].sort((a, b) =>
      sort === "desc" ? a.value - b.value : b.value - a.value,
    );
    return {
      grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        valueFormatter: (v) => `${fmt(v)} ${unit}`,
      },
      // NB : un graphe en barres part de zéro ; un axe logarithmique (log(0)
      // indéfini) ferait disparaître les barres. On garde donc toujours un axe
      // linéaire ici. Le prop `scale` est conservé pour compat mais ignoré.
      xAxis: { type: "value", name: unit, ...axisStyle(tk) },
      yAxis: {
        type: "category",
        data: pts.map((p) => p.name),
        axisLabel: { color: tk.textSoft, fontFamily: SANS },
        axisLine: { lineStyle: { color: tk.line } },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: "62%",
          data: pts.map((p) => ({
            value: p.value,
            itemStyle: {
              color: p.color || (p.value >= median ? tk.warm : tk.positive),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          markLine: {
            symbol: "none",
            data: [{ xAxis: median }],
            lineStyle: { color: tk.accent, type: "dashed", width: 1.5 },
            label: {
              formatter: refLabel,
              color: tk.accent,
              fontFamily: MONO,
              fontSize: 10,
            },
          },
          animationDuration: 600,
        },
      ],
    };
  }, [points, unit, median, refLabel, sort, scale, tk]);

  return <EChart option={option} className="echart--tall" />;
}
