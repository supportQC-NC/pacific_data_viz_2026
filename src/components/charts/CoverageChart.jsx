// src/components/charts/CoverageChart.jsx
// ============================================================
// Matrice de COUVERTURE territoires × années : chaque case dit si une
// valeur existe (1) ou non (0) pour ce territoire cette année-là.
// Aucune interpolation, aucun comblement : les vides sont montrés tels
// quels — c'est un graphique d'honnêteté sur le périmètre de la série.
// Props :
//   series : [{ name, values:[{year,value}] }]
//   years  : [int]
//   labels : { present, absent }  (légende + tooltip, via i18n)
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { valAt, tooltipStyle, MONO, SANS } from "./echartsBase";

export default function CoverageChart({ series = [], years = [], labels = {} }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const names = series.map((s) => s.name);
    const data = [];
    series.forEach((s, yi) =>
      years.forEach((y, xi) => {
        const v = valAt(s, y);
        data.push({ value: [xi, yi, Number.isFinite(v) ? 1 : 0] });
      }),
    );

    const presentLbl = labels.present || "présent";
    const absentLbl = labels.absent || "absent";

    return {
      grid: { left: 8, right: 16, top: 8, bottom: 64, containLabel: true },
      tooltip: {
        ...tooltipStyle(tk),
        formatter: (p) =>
          `${names[p.value[1]]} · ${years[p.value[0]]}<br/>${p.value[2] === 1 ? presentLbl : absentLbl}`,
      },
      xAxis: {
        type: "category",
        data: years,
        axisLabel: { color: tk.textMute, fontFamily: MONO, fontSize: 10, interval: "auto" },
        axisLine: { lineStyle: { color: tk.line } },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLabel: { color: tk.textSoft, fontFamily: SANS, fontSize: 11 },
        axisLine: { lineStyle: { color: tk.line } },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        type: "piecewise",
        bottom: 0,
        left: "center",
        orient: "horizontal",
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: tk.textMute, fontFamily: MONO, fontSize: 11 },
        pieces: [
          { value: 0, label: absentLbl, color: tk.line },
          { value: 1, label: presentLbl, color: tk.accent },
        ],
      },
      series: [
        {
          type: "heatmap",
          data,
          itemStyle: { borderColor: tk.bg, borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: tk.textSoft, borderWidth: 1 } },
          progressive: 0,
        },
      ],
    };
  }, [series, years, labels, tk]);

  return <EChart option={option} className="echart--tall" />;
}