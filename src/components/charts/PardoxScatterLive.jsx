// src/components/charts/ParadoxScatterLive.jsx
// Le Paradoxe (interactif) : X = responsabilité (GES/hab), Y = vulnérabilité
// composite. Cadran d'injustice ombré (peu d'émissions / forte vulnérabilité),
// repère « moyenne mondiale », médiane Y. Clic sur un point → onSelect(code).
// groups:[{name,color,points:[{x,y,name,code}]}]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChartLive from "../Echart/EchartLive";
import { fmt, axisStyle, tooltipStyle, MONO, SANS } from "./echartsBase";

export default function ParadoxScatterLive({
  groups = [],
  medianX = 0,
  worldRef = null,
  medianY = 50,
  selected = null,
  onSelect,
  xName = "",
  yName = "",
  unit = "",
  labels = {},
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const series = groups.map((g, i) => ({
      name: g.name,
      type: "scatter",
      emphasis: { focus: "series" },
      data: (g.points || []).map((p) => {
        const on = selected === p.code;
        return {
          value: [p.x, p.y],
          name: p.name,
          code: p.code,
          symbolSize: on ? 26 : 14,
          itemStyle: {
            color: g.color,
            opacity: on ? 1 : 0.82,
            borderColor: on ? tk.text : tk.bg,
            borderWidth: on ? 3 : 1,
            shadowBlur: on ? 18 : 0,
            shadowColor: g.color,
          },
          z: on ? 10 : 2,
        };
      }),
      markArea:
        i === 0 && Number.isFinite(worldRef)
          ? {
              silent: true,
              itemStyle: { color: tk.warm, opacity: 0.07 },
              data: [[{ coord: [0, medianY] }, { coord: [worldRef, 100] }]],
            }
          : undefined,
      markLine:
        i === 0
          ? {
              symbol: "none",
              lineStyle: { color: tk.lineStrong, type: "dashed" },
              label: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
              data: [
                Number.isFinite(worldRef)
                  ? {
                      xAxis: worldRef,
                      label: {
                        formatter: labels.world || "monde",
                        position: "end",
                      },
                    }
                  : { xAxis: medianX },
                { yAxis: medianY },
              ],
            }
          : undefined,
    }));

    return {
      grid: { left: 56, right: 24, top: 30, bottom: 64 },
      legend: {
        top: 0,
        textStyle: { color: tk.textSoft, fontFamily: SANS },
        data: groups.map((g) => g.name),
      },
      tooltip: {
        ...tooltipStyle(tk),
        formatter: (p) =>
          `<b>${p.data.name}</b><br/>${xName} : ${fmt(p.value[0], 2)}<br/>${yName} : ${Math.round(p.value[1])}/100`,
      },
      xAxis: {
        type: "value",
        scale: true,
        name: xName,
        nameLocation: "middle",
        nameGap: 34,
        nameTextStyle: { color: tk.textMute, fontFamily: MONO },
        ...axisStyle(tk),
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        name: yName,
        nameTextStyle: { color: tk.textMute, fontFamily: MONO },
        ...axisStyle(tk),
      },
      series,
    };
  }, [groups, medianX, worldRef, medianY, selected, xName, yName, labels, tk]);

  const onEvents = useMemo(
    () => ({
      click: (p) => {
        if (p && p.data && p.data.code && typeof onSelect === "function")
          onSelect(p.data.code);
      },
    }),
    [onSelect],
  );

  return (
    <EChartLive option={option} onEvents={onEvents} className="echart--tall" />
  );
}
