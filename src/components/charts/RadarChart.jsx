// src/components/charts/RadarChart.jsx
// Profil des sous-régions par décennie (radar).
// subAvg : [{ name, values:[{year, value}] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { paletteOf, tooltipStyle, MONO } from "./echartsBase";

export default function RadarChart({ subAvg = [], years = [] }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const last = years[years.length - 1];
    const decades = years.filter((y) => y % 10 === 0);
    if (last != null && !decades.includes(last)) decades.push(last);
    if (decades.length < 3) return null;
    const at = (grp, y) => {
      const p = grp.values.find((d) => d.year === y);
      return p ? p.value : 0;
    };
    const indicator = decades.map((d) => {
      const m = Math.max(...subAvg.map((g) => at(g, d)), 1);
      return { name: String(d), max: Number((m * 1.15).toFixed(2)) };
    });
    const data = subAvg.map((g) => ({
      name: g.name,
      value: decades.map((d) => Number(at(g, d).toFixed(3))),
    }));
    return {
      color: paletteOf(tk),
      legend: { top: 0, textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: 11 } },
      tooltip: { ...tooltipStyle(tk) },
      radar: {
        indicator,
        center: ["50%", "56%"],
        radius: "66%",
        axisName: { color: tk.textMute, fontFamily: MONO, fontSize: 11 },
        splitLine: { lineStyle: { color: tk.line } },
        splitArea: { areaStyle: { color: ["transparent"] } },
        axisLine: { lineStyle: { color: tk.line } },
      },
      series: [{ type: "radar", data, symbolSize: 4, lineStyle: { width: 2 }, areaStyle: { opacity: 0.08 } }],
    };
  }, [subAvg, years, tk]);

  if (!option) return null;
  return <EChart option={option} className="echart--tall" />;
}