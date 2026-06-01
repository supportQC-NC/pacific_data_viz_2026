// src/components/ChangeBars/ChangeBars.jsx
// ============================================================
// Barres divergentes : variation de chaque territoire entre sa première
// et sa dernière année disponibles. Tri du plus en hausse au plus en baisse.
//
// COULEUR SÉMANTIQUE via `betterWhen` :
//   • "low"  → une BAISSE est favorable (vert), une HAUSSE défavorable (rouge)
//   • "high" → l'inverse (hausse = vert, baisse = rouge)
//   • absent → identité historique (hausse = corail, baisse = cyan)
// Couleurs via SCSS/tokens (classe modificatrice sur la figure), zéro inline.
// Props : rows [{area,name,delta,first,last}], unit, labels {up,down,empty},
//         betterWhen
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./ChangeBars.scss";

const VW = 860;
const BAR_H = 20;
const GAP = 8;
const M = { top: 18, right: 64, bottom: 28, left: 150 };

export default function ChangeBars({
  rows = [],
  unit,
  labels = {},
  betterWhen = null,
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
  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([-maxAbs, maxAbs])
        .range([M.left, M.left + innerW]),
    [maxAbs, innerW],
  );
  const zero = x(0);

  if (!data.length) return <div className="cb cb--empty">{labels.empty}</div>;

  const fmt = (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
  const modifier =
    betterWhen === "low"
      ? "cb--better-low"
      : betterWhen === "high"
        ? "cb--better-high"
        : "";

  return (
    <figure className={`cb ${modifier}`}>
      <svg
        className="cb__svg"
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Axe zéro */}
        <line
          className="cb__zero"
          x1={zero}
          x2={zero}
          y1={M.top}
          y2={VH - M.bottom}
        />

        {data.map((r, i) => {
          const cy = M.top + i * (BAR_H + GAP);
          const xv = x(r.delta);
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
              <text
                className="cb__name"
                x={M.left - 12}
                y={cy + BAR_H / 2}
                dy="0.32em"
              >
                {r.name}
              </text>
              <rect
                className="cb__bar"
                x={bx}
                y={cy}
                width={bw}
                height={BAR_H}
                rx="3"
              />
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

        {/* Légende */}
        <text
          className="cb__legend cb__legend--up"
          x={M.left + innerW}
          y={VH - 6}
          textAnchor="end"
        >
          {labels.up} ▸
        </text>
        <text
          className="cb__legend cb__legend--down"
          x={M.left}
          y={VH - 6}
          textAnchor="start"
        >
          ◂ {labels.down}
        </text>
      </svg>

      {hover &&
        (() => {
          const r = data.find((d) => d.area === hover);
          if (!r) return null;
          return (
            <figcaption className="cb__cap">
              <strong>{r.name}</strong> · {r.first} → {r.last} {unit} (
              {fmt(r.delta)})
            </figcaption>
          );
        })()}
    </figure>
  );
}