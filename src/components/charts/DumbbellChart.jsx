// src/components/charts/DumbbellChart.jsx
// Haltère (dumbbell) : pour chaque territoire, un trait de la PREMIÈRE année
// (point sourd) à la DERNIÈRE (point chaud). Trié par valeur finale.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { axisStyle, tooltipStyle, fmt, SANS } from "./echartsBase";

export default function DumbbellChart({ rows = [], unit = "", startLabel = "", endLabel = "" }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const r = [...rows]
      .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end))
      .sort((a, b) => a.end - b.end);
    const names = r.map((x) => x.name);
    const data = r.map((x, i) => [Number(x.start.toFixed(3)), Number(x.end.toFixed(3)), i]);

    const renderItem = (params, api) => {
      const cat = api.value(2);
      const p0 = api.coord([api.value(0), cat]);
      const p1 = api.coord([api.value(1), cat]);
      return {
        type: "group",
        children: [
          { type: "line", shape: { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] }, style: { stroke: tk.lineStrong || tk.line, lineWidth: 2 } },
          { type: "circle", shape: { cx: p0[0], cy: p0[1], r: 5 }, style: { fill: tk.textMute || "#8893b5" } },
          { type: "circle", shape: { cx: p1[0], cy: p1[1], r: 6 }, style: { fill: tk.warm || "#e0833b" } },
        ],
      };
    };

    return {
      grid: { left: 8, right: 28, top: 16, bottom: 40, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        formatter: (p) => {
          const x = r[p.dataIndex];
          if (!x) return "";
          return `${x.name}<br/>${startLabel}: ${fmt(x.start)} ${unit}<br/>${endLabel}: ${fmt(x.end)} ${unit}`;
        },
      },
      xAxis: { type: "value", name: unit, ...axisStyle(tk) },
      yAxis: {
        type: "category",
        data: names,
        axisLabel: { color: tk.textSoft || "#ccd5ee", fontFamily: SANS },
        axisLine: { lineStyle: { color: tk.line || "#2a3350" } },
        axisTick: { show: false },
      },
      series: [{ type: "custom", renderItem, encode: { x: [0, 1], y: 2 }, data }],
    };
  }, [rows, unit, startLabel, endLabel, tk]);

  return <EChart option={option} className="echart--tall" />;
}