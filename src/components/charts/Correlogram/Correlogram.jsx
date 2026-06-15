// src/components/charts/Correlogram/Correlogram.jsx
// ============================================================
// CORRELOGRAM — matrice de corrélation (React Graph Gallery) en SVG pur.
// Chaque cellule croise deux stress et montre leur corrélation au sein du
// Pacifique : corail = ils frappent ensemble (montent de pair), cyan = ils
// s'opposent. L'intensité encode la force ; la diagonale est neutralisée.
//
// Couleurs interpolées à partir des tokens (donc light/dark correct) : on
// mélange la SURFACE (≈0) vers --c-warm (positif) ou --c-accent (négatif).
// Au survol : la cellule s'entoure, ses deux libellés s'allument, et un
// bandeau donne r et n (taille d'échantillon — honnêteté statistique).
//
// Contrat : labels [str], matrix [[r]], counts [[n|null]]. Rendu pur :
// la corrélation est calculée en amont (page), pas ici.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import useThemeTokens from "../../../hooks/UseThemeTokens";
import "./Correlogram.scss";

const LW = 216; // colonne des libellés de lignes
const TH = 130; // bandeau des libellés de colonnes
const RIGHT = 18;
const BOTTOM = 16;
const CELL = 104;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function hex2rgb(h) {
  let s = String(h || "").trim().replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  if (s.length !== 6 || Number.isNaN(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export default function Correlogram({
  labels = [],
  matrix = [],
  counts = [],
  posLabel = "",
  negLabel = "",
  hintLabel = "",
}) {
  const tk = useThemeTokens();
  const [hover, setHover] = useState(null); // { i, j }

  const K = labels.length;
  const VB_W = LW + K * CELL + RIGHT;
  const VB_H = TH + K * CELL + BOTTOM;

  const colorFor = useCallback(
    (v, diag) => {
      if (diag) return tk.bg2 || tk.surface;
      if (!Number.isFinite(v)) return "transparent";
      return v >= 0
        ? mix(tk.surface, tk.warm, v)
        : mix(tk.surface, tk.accent, -v);
    },
    [tk],
  );

  const cells = useMemo(() => {
    const out = [];
    for (let i = 0; i < K; i += 1) {
      for (let j = 0; j < K; j += 1) {
        const v = matrix[i] ? matrix[i][j] : NaN;
        out.push({
          i,
          j,
          v,
          diag: i === j,
          x: LW + j * CELL,
          y: TH + i * CELL,
          color: colorFor(v, i === j),
        });
      }
    }
    return out;
  }, [matrix, K, colorFor]);

  const enter = useCallback((i, j) => setHover({ i, j }), []);
  const leave = useCallback(() => setHover(null), []);

  if (K < 2) return null;

  const active =
    hover && !Number.isNaN(hover.i)
      ? {
          a: labels[hover.i],
          b: labels[hover.j],
          v: matrix[hover.i] ? matrix[hover.i][hover.j] : NaN,
          n: counts[hover.i] ? counts[hover.i][hover.j] : null,
          diag: hover.i === hover.j,
        }
      : null;

  return (
    <figure className="corr">
      <svg
        className="corr__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={labels.join(" · ")}
      >
        {cells.map((c) => {
          const on =
            hover && (hover.i === c.i && hover.j === c.j);
          return (
            <g key={`${c.i}-${c.j}`}>
              <rect
                className={`corr__cell ${c.diag ? "is-diag" : ""} ${on ? "is-active" : ""}`}
                x={c.x}
                y={c.y}
                width={CELL}
                height={CELL}
                style={{ "--c": c.color }}
                onMouseEnter={() => enter(c.i, c.j)}
                onMouseLeave={leave}
                onFocus={() => enter(c.i, c.j)}
                onBlur={leave}
                tabIndex={0}
                role="button"
                aria-label={`${labels[c.i]} × ${labels[c.j]}`}
              />
              {!c.diag && Number.isFinite(c.v) ? (
                <text
                  className="corr__val"
                  x={c.x + CELL / 2}
                  y={c.y + CELL / 2}
                  dy="0.32em"
                  textAnchor="middle"
                >
                  {c.v >= 0 ? "+" : ""}
                  {c.v.toFixed(2)}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* libellés de lignes */}
        {labels.map((lab, i) => (
          <text
            key={`r-${i}`}
            className={`corr__rowlabel ${hover && hover.i === i ? "is-on" : ""}`}
            x={LW - 12}
            y={TH + (i + 0.5) * CELL}
            dy="0.32em"
            textAnchor="end"
          >
            {lab}
          </text>
        ))}

        {/* libellés de colonnes (inclinés) */}
        {labels.map((lab, j) => {
          const cx = LW + (j + 0.5) * CELL;
          const cy = TH - 12;
          return (
            <text
              key={`c-${j}`}
              className={`corr__collabel ${hover && hover.j === j ? "is-on" : ""}`}
              x={cx}
              y={cy}
              textAnchor="start"
              transform={`rotate(-40 ${cx} ${cy})`}
            >
              {lab}
            </text>
          );
        })}
      </svg>

      {/* lecture */}
      <p className="corr__readout" aria-live="polite">
        {active && !active.diag ? (
          <>
            <span className="corr__readout-pair">
              {active.a} × {active.b}
            </span>
            <span className="corr__readout-sep">·</span>
            <span
              className={`corr__readout-r ${
                Number.isFinite(active.v) && active.v >= 0 ? "is-pos" : "is-neg"
              }`}
            >
              r = {Number.isFinite(active.v) ? `${active.v >= 0 ? "+" : ""}${active.v.toFixed(2)}` : "—"}
            </span>
            <span className="corr__readout-n">n = {active.n ?? "—"}</span>
          </>
        ) : (
          <span className="corr__readout-hint">{hintLabel}</span>
        )}
      </p>

      {/* légende divergente */}
      <div className="corr__legend">
        <span className="corr__legend-lab">{negLabel}</span>
        <span className="corr__legend-scale" aria-hidden="true" />
        <span className="corr__legend-lab">{posLabel}</span>
      </div>
    </figure>
  );
}