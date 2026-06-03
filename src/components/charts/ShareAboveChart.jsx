// src/components/charts/ShareAboveChart.jsx
// Part des territoires AU-DESSUS de la référence (anomalie > 0), année après
// année. Montre l'exposition qui se généralise.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { axisStyle, tooltipStyle, valAt, MONO } from "./echartsBase";

export default function ShareAboveChart({ series = [], years = [] }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const data = years.map((y) => {
      const vs = series.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
      if (!vs.length) return null;
      const above = vs.filter((v) => v > 0).length;
      return Number(((above / vs.length) * 100).toFixed(0));
    });
    return {
      grid: { left: 8, right: 16, top: 24, bottom: 40, containLabel: true },
      tooltip: { trigger: "axis", ...tooltipStyle(tk), valueFormatter: (v) => (v == null ? "—" : `${v} %`) },
      xAxis: { type: "category", data: years, boundaryGap: false, ...axisStyle(tk) },
      yAxis: { type: "value", min: 0, max: 100, name: "%", ...axisStyle(tk) },
      series: [
        {
          type: "line",
          smooth: true,
          showSymbol: false,
          connectNulls: true,
          areaStyle: { color: `${tk.warm}22` },
          lineStyle: { color: tk.warm, width: 2.5 },
          data,
          markLine: {
            symbol: "none",
            data: [{ yAxis: 50 }],
            lineStyle: { color: tk.lineStrong, type: "dashed" },
            label: { color: tk.textMute, fontFamily: MONO, fontSize: 10, formatter: "50 %" },
          },
        },
      ],
    };
  }, [series, years, tk]);

  return <EChart option={option} className="echart--tall" />;
}