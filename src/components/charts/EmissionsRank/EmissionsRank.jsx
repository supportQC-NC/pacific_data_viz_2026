// src/components/charts/EmissionsRank/EmissionsRank.jsx
// ============================================================
// « Émetteurs modestes, en première ligne » — distribution réelle.
// Tous les territoires du Pacifique classés par émissions de CO₂ par habitant.
// La médiane régionale est marquée d'une ligne de repère : on voit qu'une
// longue file de territoires émet très peu, et qu'un ou deux dépassent.
// L'outlier (plus gros émetteur) est en corail, les autres en vert. Barres
// animées (croissance + cascade). SVG pur, tokens du thème, libellés en props.
// ============================================================

import React, { useMemo } from "react";
import "./EmissionsRank.scss";

const VB_W = 1000;
const ROW = 30;
const TOP = 40;
const BOT = 14;
const LM = 168; // marge gauche (noms)
const RM = 92; // marge droite (valeurs)
const BAR_H = 14;

const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => r1(n).toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function EmissionsRank({
  rows = [],
  median = 0,
  unit = "",
  medianLabel = "",
  maxRows = 22,
}) {
  const data = useMemo(() => {
    return [...rows]
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, maxRows);
  }, [rows, maxRows]);

  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d.value), median, 0.0001);
  const plotW = VB_W - LM - RM;
  const xOf = (v) => LM + (Math.max(v, 0) / max) * plotW;
  const H = TOP + data.length * ROW + BOT;
  const medX = xOf(median);
  const topVal = data[0].value;

  return (
    <figure className="erank">
      <svg
        className="erank__svg"
        viewBox={`0 0 ${VB_W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={medianLabel}
      >
        {/* unité (coin) */}
        <text className="erank__unit" x={VB_W} y={TOP - 22} textAnchor="end">
          {unit}
        </text>

        {/* ligne de médiane */}
        {median > 0 ? (
          <g className="erank__median">
            <line x1={medX} y1={TOP - 12} x2={medX} y2={H - BOT} />
            <text x={medX + 8} y={TOP - 16} textAnchor="start">
              {medianLabel} · {fmt(median)}
            </text>
          </g>
        ) : null}

        {data.map((d, i) => {
          const cy = TOP + i * ROW + ROW / 2;
          const isTop = d.value === topVal;
          const name =
            d.name.length > 20 ? `${d.name.slice(0, 19)}…` : d.name;
          return (
            <g key={d.code || d.name}>
              <text
                className="erank__name"
                x={LM - 12}
                y={cy}
                dy="0.32em"
                textAnchor="end"
              >
                {name}
              </text>
              <rect
                className={`erank__bar ${isTop ? "is-top" : ""}`}
                x={LM}
                y={cy - BAR_H / 2}
                width={Math.max(xOf(d.value) - LM, 1)}
                height={BAR_H}
                rx={3}
                style={{ "--d": `${i * 35}ms` }}
              />
              <text
                className="erank__val"
                x={VB_W - 4}
                y={cy}
                dy="0.32em"
                textAnchor="end"
              >
                {fmt(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}