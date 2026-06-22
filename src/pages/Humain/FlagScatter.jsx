// src/pages/Humain/FlagScatter.jsx
// ============================================================
// Nuage de points « eau × tuberculose » où chaque territoire est représenté
// par son DRAPEAU (symbole image ECharts) — identification immédiate, sans
// survol. Deux médianes (eau en X, TB en Y) découpent quatre quadrants :
//   • bas-droite  : eau sûre + faible incidence  (le mieux)
//   • haut-gauche : faible accès + forte incidence (à cibler)
// Réutilise le moteur EChart + le style echartsBase, comme ScatterChart, mais
// sans modifier ce composant partagé. Drapeaux via flagcdn (flagUrl).
// Props : points [{ x, y, name, code }], medianX, medianY, xName, yName,
//         medXLabel, medYLabel.
// ============================================================

import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../../components/Echart/Echart";
import { fmt, axisStyle, tooltipStyle, MONO } from "../../components/charts/echartsBase";
import flagUrl from "../../i18n/flagUrl";

export default function FlagScatter({
  points = [],
  medianX = null,
  medianY = null,
  xName = "",
  yName = "",
  medXLabel = "",
  medYLabel = "",
  xDecimals = 1,
  yDecimals = 1,
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const data = points.map((p) => ({
      value: [p.x, p.y],
      name: p.name,
      symbol: `image://${flagUrl(p.code, { format: "png", size: "w40" })}`,
      symbolSize: [28, 19],
    }));

    const medData = [];
    if (Number.isFinite(medianX))
      medData.push({
        xAxis: medianX,
        label: {
          formatter: medXLabel,
          color: tk.textMute,
          fontFamily: MONO,
          fontSize: 9,
          position: "insideEndTop",
        },
      });
    if (Number.isFinite(medianY))
      medData.push({
        yAxis: medianY,
        label: {
          formatter: medYLabel,
          color: tk.textMute,
          fontFamily: MONO,
          fontSize: 9,
          position: "insideStartTop",
        },
      });

    return {
      legend: { show: false },
      grid: { left: 8, right: 28, top: 18, bottom: 52, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        formatter: (p) =>
          `<strong>${p.name}</strong><br/>${xName} : ${fmt(p.value[0], xDecimals)}<br/>${yName} : ${fmt(p.value[1], yDecimals)}`,
      },
      xAxis: {
        type: "value",
        name: xName,
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
        scale: true,
        ...axisStyle(tk),
      },
      yAxis: {
        type: "value",
        name: yName,
        scale: true,
        nameTextStyle: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
        ...axisStyle(tk),
      },
      series: [
        {
          type: "scatter",
          data,
          itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.55)" },
          emphasis: { scale: 1.25, focus: "self" },
          markLine: medData.length
            ? {
                symbol: "none",
                silent: true,
                lineStyle: { color: tk.lineStrong, type: "dashed", width: 1 },
                data: medData,
              }
            : undefined,
          z: 3,
        },
      ],
    };
  }, [points, medianX, medianY, xName, yName, medXLabel, medYLabel, xDecimals, yDecimals, tk]);

  return <EChart option={option} className="echart--tall" />;
}