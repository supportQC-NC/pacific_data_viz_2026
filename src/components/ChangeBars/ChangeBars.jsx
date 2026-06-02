// src/components/ChangeBars/ChangeBars.jsx
// ============================================================
// Barres divergentes : variation de chaque territoire entre sa premiere et
// sa derniere annee. ECHELLE RACINE SIGNEE -> on revele les petites
// variations meme avec un outlier ; l'ordre reste correct.
// GOUTTIERE (GUT) : aucune barre ne touche la colonne des noms ni le bord
// droit, donc l'etiquette de valeur a toujours sa place et ne chevauche jamais.
// Marge gauche large -> noms longs non coupes. Couleur SEMANTIQUE via
// betterWhen : "low" (defaut) hausse = rouge / baisse = vert ; "high" inverse.
// Decimales adaptatives : 1 chiffre si |v|>=1, sinon 2.
// SVG responsive, couleurs via SCSS/tokens, aucun style inline.
// Props : rows [{area,name,delta,first,last}], unit, betterWhen, labels {up,down,empty}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./ChangeBars.scss";

const VW = 860;
const BAR_H = 20;
const GAP = 8;
const M = { top: 18, right: 72, bottom: 30, left: 220 };
// Gouttiere reservee aux etiquettes : aucune barre ne touche la colonne
// des noms ni le bord droit -> l'etiquette de valeur ne chevauche jamais.
const GUT = 64;

const signedSqrt = (d) => Math.sign(d) * Math.sqrt(Math.abs(d));

export default function ChangeBars({
  rows = [],
  unit,
  betterWhen = "low",
  labels = {},
}) {
  const [hover, setHover] = useState(null);

  const data = useMemo(
    () =>
      [...rows]
        .filter((r) => Number.isFinite(r.delta))
        .sort((a, b) => b.delta - a.delta),
    [rows],
  );

  const innerW = VW - M.left - M.right;
  const VH = M.top + M.bottom + data.length * (BAR_H + GAP);
  const maxAbs = useMemo(
    () => d3.max(data, (r) => Math.abs(r.delta)) || 1,
    [data],
  );
  const maxT = Math.sqrt(maxAbs) || 1;
  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([-maxT, maxT])
        .range([M.left + GUT, M.left + innerW - GUT]),
    [maxT, innerW],
  );
  const X = (d) => x(signedSqrt(d));
  const zero = x(0);

  if (!data.length) return <div className="cb cb--empty">{labels.empty}</div>;

  const fmt = (v) => {
    const d = Math.abs(v) >= 1 ? 1 : 2;
    return `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
  };
  const rootCls = betterWhen === "high" ? "cb cb--better-high" : "cb cb--better-low";

  return (
    <figure className={rootCls}>
      <svg
        className="cb__svg"
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        preserveAspectRatio="xMidYMid meet"
      >
        <line className="cb__zero" x1={zero} x2={zero} y1={M.top} y2={VH - M.bottom} />

        {data.map((r, i) => {
          const cy = M.top + i * (BAR_H + GAP);
          const xv = X(r.delta);
          const up = r.delta >= 0;
          const bx = up ? zero : xv;
          const bw = Math.max(1, Math.abs(xv - zero));
          const on = hover === r.area;
          return (
            <g
              key={r.area}
              className={`cb__row ${up ? "is-up" : "is-down"} ${on ? "is-on" : ""}`}
              onMouseEnter={() => setHover(r.area)}
              onMouseLeave={() => setHover(null)}
            >
              <text className="cb__name" x={M.left - 12} y={cy + BAR_H / 2} dy="0.32em" textAnchor="end">{r.name}</text>
              <rect className="cb__bar" x={bx} y={cy} width={bw} height={BAR_H} rx="3" />
              <text
                className="cb__val"
                x={up ? xv + 8 : xv - 8}
                y={cy + BAR_H / 2}
                dy="0.32em"
                textAnchor={up ? "start" : "end"}
              >
                {fmt(r.delta)}
              </text>
            </g>
          );
        })}

        <text className="cb__legend cb__legend--up" x={M.left + innerW} y={VH - 6} textAnchor="end">{labels.up} {"\u25B8"}</text>
        <text className="cb__legend cb__legend--down" x={M.left} y={VH - 6} textAnchor="start">{"\u25C2"} {labels.down}</text>
      </svg>

      {hover &&
        (() => {
          const r = data.find((d) => d.area === hover);
          if (!r) return null;
          return (
            <figcaption className="cb__cap">
              <strong>{r.name}</strong> {"\u00b7"} {r.first} {"\u2192"} {r.last} {unit} ({fmt(r.delta)})
            </figcaption>
          );
        })()}
    </figure>
  );
}