// src/components/charts/VulnMatrix.jsx
// La Matrice : territoires (lignes) × stress climatiques (colonnes).
// Vert = épargné, rouge = sous pression. Clic sur une cellule → onSelect(code).
// rows:[{code,name,values:[number,...]}]  ·  inds:[label,...]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChartLive from "../Echart/EchartLive";
import { MONO, SANS } from "./echartsBase";

export default function VulnMatrix({
  rows = [],
  inds = [],
  selected = null,
  onSelect,
  unit = "/100",
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const names = rows.map((r) => r.name);
    const data = [];
    rows.forEach((r, yi) => {
      r.values.forEach((v, xi) => {
        if (!Number.isFinite(v)) return;
        data.push({
          value: [xi, yi, Math.round(v)],
          itemStyle:
            selected === r.code
              ? { borderColor: tk.accent, borderWidth: 2 }
              : undefined,
        });
      });
    });
    return {
      grid: { left: 130, right: 18, top: 40, bottom: 16 },
      tooltip: {
        backgroundColor: tk.surface,
        borderColor: tk.line,
        textStyle: { color: tk.text, fontFamily: SANS },
        formatter: (p) =>
          `<b>${names[p.value[1]]}</b><br/>${inds[p.value[0]]} : ${p.value[2]}${unit}`,
      },
      xAxis: {
        type: "category",
        position: "top",
        data: inds,
        axisLabel: {
          color: tk.textMute,
          fontFamily: MONO,
          fontSize: 10,
          interval: 0,
          rotate: 0,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        data: names,
        inverse: true,
        axisLabel: { color: tk.textSoft, fontFamily: SANS, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        show: false,
        min: 0,
        max: 100,
        calculable: true,
        inRange: { color: [tk.positive, tk.warm, tk.negative] },
      },
      series: [
        {
          type: "heatmap",
          data,
          label: {
            show: true,
            color: "#0b1118",
            fontFamily: MONO,
            fontSize: 9,
            formatter: (p) => p.value[2],
          },
          itemStyle: { borderColor: tk.bg, borderWidth: 1 },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: tk.accent } },
        },
      ],
    };
  }, [rows, inds, selected, unit, tk]);

  const onEvents = useMemo(
    () => ({
      click: (p) => {
        const yi = p && p.value && p.value[1];
        const row = rows[yi];
        if (row && typeof onSelect === "function") onSelect(row.code);
      },
    }),
    [rows, onSelect],
  );

  return (
    <EChartLive option={option} onEvents={onEvents} className="echart--tall" />
  );
}
