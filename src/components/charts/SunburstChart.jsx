// src/components/charts/SunburstChart.jsx
// Hiérarchie sous-région -> territoire (sunburst). Taille atténuée (racine
// cubique) pour la lisibilité ; valeur réelle au survol.
// groups : [{ name, color, children:[{ name, real }] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, tooltipStyle, SANS, MONO } from "./echartsBase";

export default function SunburstChart({ groups = [], unit = "" }) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const data = groups
      .map((g) => ({
        name: g.name,
        itemStyle: { color: g.color },
        children: (g.children || [])
          .filter((c) => Number.isFinite(c.real) && c.real > 0)
          .map((c) => ({ name: c.name, value: Number(Math.cbrt(c.real).toFixed(4)), real: c.real })),
      }))
      .filter((g) => g.children.length);
    return {
      tooltip: {
        ...tooltipStyle(tk),
        formatter: (p) =>
          p.data && p.data.real != null
            ? `${p.name}<br/><strong>${fmt(p.data.real)}</strong> ${unit}`
            : p.name,
      },
      series: [
        {
          type: "sunburst",
          data,
          radius: [24, "95%"],
          emphasis: { focus: "ancestor" },
          itemStyle: { borderColor: tk.bg, borderWidth: 2 },
          label: { color: "#fff", fontFamily: SANS, fontSize: 11, minAngle: 6 },
          levels: [
            {},
            { r0: "20%", r: "50%", itemStyle: { borderWidth: 2 }, label: { rotate: "tangential", fontFamily: MONO } },
            { r0: "50%", r: "95%", label: { align: "right" }, colorSaturation: [0.35, 0.6] },
          ],
        },
      ],
    };
  }, [groups, unit, tk]);

  return <EChart option={option} className="echart--xl" />;
}