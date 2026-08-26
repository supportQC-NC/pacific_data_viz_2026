// src/components/charts/ProfileRadar.jsx
// Radar « empreinte » : des indicateurs (axes) comparés pour plusieurs
// groupes (séries superposées). Pensé pour la synthèse : le profil de
// vulnérabilité de chaque sous-région sur les 6 stress climatiques.
// indicators : [{ name, max }]  ·  series : [{ name, values:[number,...] }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { tooltipStyle, scatterPaletteOf, MONO, SANS } from "./echartsBase";

export default function ProfileRadar({ indicators = [], series = [] }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    // Un radar superpose ses séries : TOUTES les paires se côtoient, pas
    // seulement les voisines. C'est la forme la plus exigeante, plafonnée à
    // 3 séries (cf. _variables.scss § PALETTE DATAVIZ). Act11 y passe
    // exactement les 3 sous-régions : le compte tombe juste, et aucun
    // recyclage n'est possible par construction.
    const palette = scatterPaletteOf(tk).filter(Boolean);
    return {
      tooltip: { ...tooltipStyle(tk) },
      legend: {
        bottom: 0,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: tk.textSoft, fontFamily: SANS },
        data: series.map((s) => s.name),
      },
      radar: {
        center: ["50%", "52%"],
        radius: "66%",
        indicator: indicators.map((i) => ({ name: i.name, max: i.max || 100 })),
        axisName: { color: tk.textMute, fontFamily: MONO, fontSize: 11 },
        splitNumber: 4,
        splitLine: { lineStyle: { color: tk.line } },
        splitArea: { areaStyle: { color: ["transparent"] } },
        axisLine: { lineStyle: { color: tk.line } },
      },
      series: [
        {
          type: "radar",
          symbolSize: 5,
          data: series.map((s, i) => ({
            name: s.name,
            value: s.values,
            // Pas de `i % length` : au-delà du plafond, encre neutre plutôt
            // qu'une teinte déjà prise par une autre série.
            lineStyle: { width: 2.5, color: palette[i] || tk.textMute },
            itemStyle: { color: palette[i] || tk.textMute },
            areaStyle: { opacity: 0.1, color: palette[i] || tk.textMute },
          })),
        },
      ],
    };
  }, [indicators, series, tk]);

  return <EChart option={option} className="echart--tall" />;
}
