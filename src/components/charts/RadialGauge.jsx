// src/components/charts/RadialGauge.jsx
// Jauge radiale animée — score 0..max d'un territoire (vulnérabilité composite).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { MONO, SANS } from "./echartsBase";

export default function RadialGauge({
  value = 0,
  max = 100,
  label = "",
  caption = "",
  tone,
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const col =
      tone || (value >= 66 ? tk.negative : value >= 33 ? tk.warm : tk.positive);
    return {
      series: [
        {
          type: "gauge",
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max,
          radius: "92%",
          center: ["50%", "56%"],
          progress: {
            show: true,
            width: 14,
            roundCap: true,
            itemStyle: { color: col },
          },
          axisLine: { lineStyle: { width: 14, color: [[1, tk.line]] } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: {
            offsetCenter: [0, "32%"],
            color: tk.textMute,
            fontFamily: MONO,
            fontSize: 11,
          },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, "-6%"],
            formatter: (v) => Math.round(v),
            color: tk.text,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 44,
          },
          data: [{ value, name: label }],
        },
      ],
    };
  }, [value, max, label, tone, tk]);

  return (
    <div className="rgauge">
      <EChart option={option} className="rgauge__chart" />
      {caption ? <p className="rgauge__caption">{caption}</p> : null}
    </div>
  );
}
