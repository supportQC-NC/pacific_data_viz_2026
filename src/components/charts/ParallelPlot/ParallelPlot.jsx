// src/components/charts/ParallelPlot/ParallelPlot.jsx
// ============================================================
// PARALLEL COORDINATES — visuel galerie (React Graph Gallery) en SVG pur.
// Chaque territoire est une ligne qui traverse K axes verticaux (un par
// indicateur de stress, 0–100). On lit d'un coup les PROFILS : qui est haut
// partout, qui n'est touché que sur un front, quels stress vont de pair.
//
// Couleur par stress moyen (corail = élevé, cyan = faible). Au survol, une
// ligne s'illumine, les autres s'effacent, et ses valeurs s'affichent sur
// chaque axe. Les segments traversant une valeur manquante sont interrompus.
//
// Contrat : rows [{code, name, values:[nombres 0–100 alignés sur axes]}],
// axes [libellés]. Libellés via props (i18n parent). Tokens du thème.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./ParallelPlot.scss";

const VB_W = 1000;
const VB_H = 470;
const M = { top: 58, right: 46, bottom: 30, left: 46 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;
const Y_TICKS = [0, 25, 50, 75, 100];

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = (n) => Math.round(n * 10) / 10;

export default function ParallelPlot({
  rows = [],
  axes = [],
  hiLabel = "",
  loLabel = "",
  hintLabel = "",
}) {
  const [hover, setHover] = useState(null);

  const K = axes.length;
  const xOf = useCallback(
    (j) => (K > 1 ? M.left + (j / (K - 1)) * PLOT_W : M.left + PLOT_W / 2),
    [K],
  );
  const yOf = useCallback((v) => M.top + (1 - clamp(v, 0, 100) / 100) * PLOT_H, []);

  const lines = useMemo(() => {
    return rows
      .map((r) => {
        const pts = (r.values || []).map((v, j) => ({
          j,
          x: xOf(j),
          y: Number.isFinite(v) ? yOf(v) : null,
          v,
        }));
        const finite = pts.filter((p) => p.y != null);
        if (finite.length < 2) return null;
        // chemin avec interruptions sur les valeurs manquantes
        let d = "";
        let pen = false;
        pts.forEach((p) => {
          if (p.y == null) {
            pen = false;
            return;
          }
          d += `${pen ? " L" : " M"} ${r1(p.x)} ${r1(p.y)}`;
          pen = true;
        });
        const mean =
          finite.reduce((s, p) => s + p.v, 0) / finite.length;
        return {
          code: r.code || r.name,
          name: r.name,
          d: d.trim(),
          pts,
          mean,
          high: mean >= 50,
          intensity: clamp(0.32 + (Math.abs(mean - 50) / 50) * 0.68, 0.32, 1),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.mean - b.mean); // les plus stressés tracés au-dessus
  }, [rows, xOf, yOf]);

  const active = useMemo(
    () => lines.find((l) => l.code === hover) || null,
    [lines, hover],
  );
  const enter = useCallback((code) => setHover(code), []);
  const leave = useCallback(() => setHover(null), []);

  if (!lines.length || K < 2) return null;

  return (
    <figure className="par">
      <svg
        className="par__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={axes.join(" · ")}
      >
        {/* graduations horizontales (sur l'axe de gauche) */}
        {Y_TICKS.map((v) => (
          <g key={v}>
            <line
              className="par__grid"
              x1={M.left}
              y1={yOf(v)}
              x2={VB_W - M.right}
              y2={yOf(v)}
            />
            <text className="par__gridlabel" x={M.left - 10} y={yOf(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {/* axes verticaux + libellés */}
        {axes.map((label, j) => (
          <g key={label + j}>
            <line
              className="par__axis"
              x1={xOf(j)}
              y1={M.top}
              x2={xOf(j)}
              y2={M.top + PLOT_H}
            />
            <text
              className="par__axislabel"
              x={xOf(j)}
              y={M.top - 18}
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        ))}

        {/* lignes (territoires) */}
        {lines.map((l) => {
          const cls = [
            "par__line",
            l.high ? "is-high" : "is-low",
            active && active.code === l.code ? "is-active" : "",
            active && active.code !== l.code ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <path
              key={l.code}
              className={cls}
              d={l.d}
              style={{ "--i": l.intensity }}
              onMouseEnter={() => enter(l.code)}
              onMouseLeave={leave}
              onFocus={() => enter(l.code)}
              onBlur={leave}
              tabIndex={0}
              role="button"
              aria-label={l.name}
            />
          );
        })}

        {/* valeurs de la ligne survolée, sur chaque axe */}
        {active
          ? active.pts
              .filter((p) => p.y != null)
              .map((p) => (
                <g key={`pt-${p.j}`} className="par__mark">
                  <circle cx={p.x} cy={p.y} r={4.5} />
                  <text x={p.x} y={p.y - 10} textAnchor="middle">
                    {Math.round(p.v)}
                  </text>
                </g>
              ))
          : null}
      </svg>

      {/* lecture + légende */}
      <p className="par__readout" aria-live="polite">
        {active ? (
          <>
            <span className="par__readout-name">{active.name}</span>
            <span className="par__readout-sep">·</span>
            {hiLabel} {Math.round(active.mean)}
          </>
        ) : (
          <span className="par__readout-hint">{hintLabel}</span>
        )}
      </p>
      <ul className="par__legend">
        <li className="par__leg-item">
          <span className="par__leg-mark par__leg-mark--hi" aria-hidden="true" />
          {hiLabel}
        </li>
        <li className="par__leg-item">
          <span className="par__leg-mark par__leg-mark--lo" aria-hidden="true" />
          {loLabel}
        </li>
      </ul>
    </figure>
  );
}