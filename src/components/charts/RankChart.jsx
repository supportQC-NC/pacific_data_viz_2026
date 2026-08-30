// src/components/charts/RankChart.jsx
// ============================================================
// Classement horizontal des territoires + repère médiane + couleur sémantique.
//
// DEUX FORMES DE MARQUE, ET C'EST LA DONNÉE QUI DÉCIDE.
//
//   marks="bar" (défaut) — des barres depuis zéro. La forme juste tant que
//   les valeurs restent dans un rapport raisonnable : la longueur se compare,
//   l'œil additionne, l'origine à zéro ne ment pas.
//
//   marks="dot" + logX — un point par territoire sur une échelle
//   logarithmique. Pour les classements dont l'étendue est d'un ordre de
//   grandeur ou plus : sur les émissions du Pacifique, un territoire est à
//   86 t/hab et une douzaine sous 2, si bien qu'en barres quinze territoires
//   sur dix-huit se réduisaient à un filet d'un pixel — quatre d'entre eux
//   sans aucune marque visible, indiscernables d'une donnée manquante.
//   Une barre NE PEUT PAS passer en log (elle encode depuis zéro, et log(0)
//   n'existe pas) ; un point, si, puisqu'il n'encode qu'une position. C'est
//   la seule forme qui garde les dix-huit territoires lisibles à la fois.
//
// Props : points [{ name, value, color? }], unit, median, refLabel, sort,
//         marks, logX.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, axisStyle, tooltipStyle, SANS, MONO } from "./echartsBase";

export default function RankChart({
  points = [],
  unit = "",
  median = 0,
  refLabel = "",
  sort = "desc",
  scale = "lin",
  // Forme de la marque : "bar" (depuis zéro) ou "dot" (position seule).
  marks = "bar",
  // Échelle logarithmique de l'axe des valeurs. Refusée en barres : voir
  // l'en-tête. Les valeurs nulles ou négatives doivent être écartées en amont.
  logX = false,
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const pts = [...points].sort((a, b) =>
      sort === "desc" ? a.value - b.value : b.value - a.value,
    );
    return {
      grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        ...tooltipStyle(tk),
        valueFormatter: (v) => `${fmt(v)} ${unit}`,
      },
      // Un graphe en BARRES part de zéro ; un axe logarithmique (log(0)
      // indéfini) ferait disparaître les barres. Le log n'est donc accordé
      // qu'aux points, qui n'encodent qu'une position.
      // Le prop `scale` est conservé pour compat mais ignoré.
      xAxis: {
        type: logX && marks === "dot" ? "log" : "value",
        name: unit,
        // Un peu d'air sous la plus petite valeur : sinon les points qui la
        // portent se posent exactement sur l'axe et s'y font couper en deux.
        // Un facteur, pas une constante — sur une échelle logarithmique une
        // marge additive n'aurait pas le même sens en bas et en haut.
        ...(logX && marks === "dot"
          ? { min: (v) => (v.min > 0 ? v.min / 1.7 : v.min) }
          : null),
        ...axisStyle(tk),
      },
      yAxis: {
        type: "category",
        data: pts.map((p) => p.name),
        axisLabel: { color: tk.textSoft, fontFamily: SANS },
        axisLine: { lineStyle: { color: tk.line } },
        axisTick: { show: false },
        // UNE LIGNE DE CONDUITE PAR RANGÉE, en points seulement. Sans barre
        // partant du bord, l'œil perd la ligne entre le nom et son point
        // dès que celui-ci se trouve loin à droite.
        splitLine: marks === "dot"
          ? { show: true, lineStyle: { color: tk.line, type: "dashed" } }
          : { show: false },
      },
      series: [
        {
          type: marks === "dot" ? "scatter" : "bar",
          ...(marks === "dot"
            ? { symbolSize: 13 }
            : { barWidth: "62%" }),
          data: pts.map((p) => ({
            value: p.value,
            itemStyle: {
              color: p.color || (p.value >= median ? tk.warm : tk.positive),
              // Un liseré de la couleur du fond détache deux points qui se
              // chevauchent — les territoires les plus sobres se serrent.
              ...(marks === "dot"
                ? { borderColor: tk.bg, borderWidth: 2 }
                : { borderRadius: [0, 4, 4, 0] }),
            },
          })),
          markLine: {
            symbol: "none",
            data: [{ xAxis: median }],
            lineStyle: { color: tk.accent, type: "dashed", width: 1.5 },
            label: {
              formatter: refLabel,
              color: tk.accent,
              fontFamily: MONO,
              fontSize: 10,
            },
          },
          animationDuration: 600,
        },
      ],
    };
  }, [points, unit, median, refLabel, sort, marks, logX, tk]);

  return <EChart option={option} className="echart--tall" />;
}
