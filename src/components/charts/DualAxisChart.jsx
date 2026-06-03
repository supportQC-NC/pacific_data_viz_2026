// src/components/charts/DualAxisChart.jsx
// Deux signaux dans le temps sur deux axes : moyenne du niveau de la mer
// (axe gauche) et moyenne de l'anomalie de température (axe droit).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { axisStyle, tooltipStyle, valAt, MONO } from "./echartsBase";

function meanFor(series, year) {
  const vs = series.map((s) => valAt(s, year)).filter((v) => Number.isFinite(v));
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}

export default function DualAxisChart({
  seaSeries = [],
  seaYears = [],
  sstSeries = [],
  sstYears = [],
  seaName = "",
  sstName = "",
  seaUnit = "",
  sstUnit = "",
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const years = [...new Set([...seaYears, ...sstYears])].sort((a, b) => a - b);
    const seaData = years.map((y) => {
      const m = seaYears.indexOf(y) !== -1 ? meanFor(seaSeries, y) : null;
      return m == null ? null : Number(m.toFixed(3));
    });
    const sstData = years.map((y) => {
      const m = sstYears.indexOf(y) !== -1 ? meanFor(sstSeries, y) : null;
      return m == null ? null : Number(m.toFixed(3));
    });
    return {
      color: [tk.accent, tk.warm],
      grid: { left: 8, right: 8, top: 32, bottom: 40, containLabel: true },
      legend: { top: 0, data: [seaName, sstName], textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: 11 } },
      tooltip: { trigger: "axis", ...tooltipStyle(tk) },
      xAxis: { type: "category", data: years, boundaryGap: false, ...axisStyle(tk) },
      yAxis: [
        { type: "value", name: seaUnit, position: "left", ...axisStyle(tk), axisLine: { lineStyle: { color: tk.accent } } },
        { type: "value", name: sstUnit, position: "right", ...axisStyle(tk), splitLine: { show: false }, axisLine: { lineStyle: { color: tk.warm } } },
      ],
      series: [
        { name: seaName, type: "line", yAxisIndex: 0, smooth: true, showSymbol: false, connectNulls: true, lineStyle: { width: 2.5 }, data: seaData },
        { name: sstName, type: "line", yAxisIndex: 1, smooth: true, showSymbol: false, connectNulls: true, lineStyle: { width: 2.5 }, data: sstData },
      ],
    };
  }, [seaSeries, seaYears, sstSeries, sstYears, seaName, sstName, seaUnit, sstUnit, tk]);

  return <EChart option={option} className="echart--tall" />;
}