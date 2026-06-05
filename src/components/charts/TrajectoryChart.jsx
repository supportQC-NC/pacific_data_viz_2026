// src/components/charts/TrajectoryChart.jsx
// Trajectoire « X × Y dans le temps » : un point par année, reliés
// chronologiquement, dégradé temporel (passé pâle → présent vif) et repères
// début/fin. Idéal pour montrer deux mesures qui évoluent ensemble.
// points : [{ x, y, year }] triés par année.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, axisStyle, tooltipStyle, MONO } from "./echartsBase";

export default function TrajectoryChart({ points = [], xName = "", yName = "", xUnit = "", yUnit = "", startLabel = "", endLabel = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const data = points.map((p) => [p.x, p.y, p.year]);
    const first = data[0];
    const last = data[data.length - 1];
    const years = points.map((p) => p.year);
    const minY = years.length ? Math.min(...years) : 0;
    const maxY = years.length ? Math.max(...years) : 1;

    const endPoint = (coord, color, label) =>
      coord
        ? {
            coord: [coord[0], coord[1]],
            symbol: "circle",
            symbolSize: 13,
            itemStyle: { color, borderColor: tk.bg, borderWidth: 2 },
            label: { show: true, formatter: `${label} ${coord[2]}`.trim(), color, fontFamily: MONO, fontSize: 11, position: "top" },
          }
        : null;

    return {
      grid: { left: 8, right: 32, top: 24, bottom: 52, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        formatter: (p) => `${p.data[2]}<br/>${fmt(p.data[0])} ${xUnit}<br/>${fmt(p.data[1])} ${yUnit}`,
      },
      // Dégradé temporel : les années anciennes sont pâles, les récentes vives.
      visualMap: {
        show: false,
        type: "continuous",
        dimension: 2,
        min: minY,
        max: maxY,
        inRange: { color: [tk.line, tk.accent, tk.warm] },
      },
      xAxis: { type: "value", name: xName, scale: true, ...axisStyle(tk) },
      yAxis: { type: "value", name: yName, scale: true, ...axisStyle(tk) },
      series: [
        {
          type: "line",
          data,
          showSymbol: true,
          symbolSize: 7,
          smooth: true,
          lineStyle: { width: 2.5 },
          emphasis: { focus: "series" },
          markPoint: {
            data: [endPoint(first, tk.positive, startLabel), endPoint(last, tk.negative, endLabel)].filter(Boolean),
          },
        },
      ],
    };
  }, [points, xName, yName, xUnit, yUnit, startLabel, endLabel, tk]);

  return <EChart option={option} className="echart--tall" />;
}