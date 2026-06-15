// src/components/charts/BubblePlot/BubblePlot.jsx
// ============================================================
// BUBBLE PLOT — le paradoxe à trois dimensions (React Graph Gallery), SVG pur.
//   X = responsabilité (émissions/hab) · Y = vulnérabilité (0–100) ·
//   TAILLE = enjeu (ampleur du littoral). Le cadran haut-gauche (peu
//   d'émissions, forte vulnérabilité) est ombré : l'injustice. Une grosse
//   bulle dans ce cadran = beaucoup de côte en jeu chez les moins responsables.
//
// Aire ∝ valeur (rayon ∝ √valeur), repères de médianes, étiquettes sur les
// plus grosses bulles, survol → lecture complète. Couleurs par sous-région
// fournies par le parent. Libellés via props (i18n). Tokens du thème.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./BubblePlot.scss";

const VB_W = 1000;
const VB_H = 472;
const M = { top: 30, right: 30, bottom: 56, left: 66 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;
const R_MIN = 7;
const R_MAX = 40;
const N_LABELS = 5;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = (n) => Math.round(n * 10) / 10;
const fmtX = (n) => (Math.abs(n) >= 10 ? Math.round(n) : r1(n));

export default function BubblePlot({
  groups = [],
  medianX = 0,
  medianY = 50,
  xName = "",
  yName = "",
  sizeName = "",
  hintLabel = "",
}) {
  const [hover, setHover] = useState(null);

  const { points, xOf, yOf, xTicks, yTicks, injustice } = useMemo(() => {
    const all = groups.flatMap((g) =>
      (g.points || []).map((p) => ({
        ...p,
        color: g.color,
        group: g.name,
      })),
    );
    const xMaxData = Math.max(...all.map((p) => p.x), 1);
    const rMaxData = Math.max(...all.map((p) => p.r), 1);
    const xMax = xMaxData * 1.1;

    const xf = (v) => M.left + (clamp(v, 0, xMax) / xMax) * PLOT_W;
    const yf = (v) => M.top + (1 - clamp(v, 0, 100) / 100) * PLOT_H;
    const rf = (v) =>
      R_MIN + (Math.sqrt(Math.max(v, 0)) / Math.sqrt(rMaxData)) * (R_MAX - R_MIN);

    const labelled = new Set(
      [...all].sort((a, b) => b.r - a.r).slice(0, N_LABELS).map((p) => p.code),
    );

    const pts = all
      .map((p) => ({
        ...p,
        cx: r1(xf(p.x)),
        cy: r1(yf(p.y)),
        rad: r1(rf(p.r)),
        label: labelled.has(p.code),
      }))
      .sort((a, b) => b.rad - a.rad); // grosses bulles dessous

    const xt = [];
    for (let k = 0; k <= 4; k += 1) {
      const v = (xMax * k) / 4;
      xt.push({ v, x: r1(xf(v)) });
    }
    const yt = [0, 25, 50, 75, 100].map((v) => ({ v, y: r1(yf(v)) }));

    const inj = {
      x: M.left,
      y: M.top,
      w: r1(xf(medianX) - M.left),
      h: r1(yf(medianY) - M.top),
      mx: r1(xf(medianX)),
      my: r1(yf(medianY)),
    };

    return { points: pts, xOf: xf, yOf: yf, xTicks: xt, yTicks: yt, injustice: inj };
  }, [groups, medianX, medianY]);

  const active = useMemo(
    () => points.find((p) => p.code === hover) || null,
    [points, hover],
  );
  const enter = useCallback((code) => setHover(code), []);
  const leave = useCallback(() => setHover(null), []);

  if (!points.length) return null;

  return (
    <figure className="bub">
      <svg
        className="bub__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`${xName} · ${yName} · ${sizeName}`}
      >
        {/* cadran de l'injustice */}
        <rect
          className="bub__inj"
          x={injustice.x}
          y={injustice.y}
          width={Math.max(0, injustice.w)}
          height={Math.max(0, injustice.h)}
        />

        {/* grille + axes */}
        {yTicks.map((t) => (
          <g key={`y${t.v}`}>
            <line className="bub__grid" x1={M.left} y1={t.y} x2={VB_W - M.right} y2={t.y} />
            <text className="bub__ytick" x={M.left - 10} y={t.y} dy="0.32em" textAnchor="end">
              {t.v}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={`x${t.v}`}
            className="bub__xtick"
            x={t.x}
            y={VB_H - M.bottom + 22}
            textAnchor="middle"
          >
            {fmtX(t.v)}
          </text>
        ))}

        {/* médianes */}
        <line
          className="bub__med"
          x1={injustice.mx}
          y1={M.top}
          x2={injustice.mx}
          y2={M.top + PLOT_H}
        />
        <line
          className="bub__med"
          x1={M.left}
          y1={injustice.my}
          x2={VB_W - M.right}
          y2={injustice.my}
        />

        {/* titres d'axes */}
        <text
          className="bub__axis-title"
          x={M.left + PLOT_W / 2}
          y={VB_H - 12}
          textAnchor="middle"
        >
          {xName}
        </text>
        <text
          className="bub__axis-title"
          transform={`rotate(-90 18 ${M.top + PLOT_H / 2})`}
          x={18}
          y={M.top + PLOT_H / 2}
          textAnchor="middle"
        >
          {yName}
        </text>

        {/* bulles */}
        {points.map((p) => {
          const cls = [
            "bub__dot",
            active && active.code === p.code ? "is-active" : "",
            active && active.code !== p.code ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <circle
              key={p.code}
              className={cls}
              cx={p.cx}
              cy={p.cy}
              r={p.rad}
              style={{ "--c": p.color }}
              onMouseEnter={() => enter(p.code)}
              onMouseLeave={leave}
              onFocus={() => enter(p.code)}
              onBlur={leave}
              tabIndex={0}
              role="button"
              aria-label={`${p.name} — ${xName} ${fmtX(p.x)}, ${yName} ${Math.round(p.y)}`}
            />
          );
        })}

        {/* étiquettes des plus grosses bulles */}
        {points
          .filter((p) => p.label)
          .map((p) => (
            <text
              key={`lbl-${p.code}`}
              className="bub__label"
              x={p.cx}
              y={p.cy - p.rad - 6}
              textAnchor="middle"
            >
              {p.name}
            </text>
          ))}
      </svg>

      {/* lecture */}
      <p className="bub__readout" aria-live="polite">
        {active ? (
          <>
            <span className="bub__readout-dot" style={{ "--c": active.color }} />
            <span className="bub__readout-name">{active.name}</span>
            <span className="bub__readout-sep">·</span>
            {xName} {fmtX(active.x)}
            <span className="bub__readout-sep">·</span>
            {yName} {Math.round(active.y)}
            <span className="bub__readout-sep">·</span>
            {sizeName} {Math.round(active.r)}
          </>
        ) : (
          <span className="bub__readout-hint">{hintLabel}</span>
        )}
      </p>

      {/* légende */}
      <ul className="bub__legend">
        {groups.map((g) => (
          <li key={g.name} className="bub__leg-item">
            <span className="bub__leg-dot" style={{ "--c": g.color }} />
            {g.name}
          </li>
        ))}
        <li className="bub__leg-item bub__leg-item--size">
          <span className="bub__leg-size" aria-hidden="true" />
          {sizeName}
        </li>
      </ul>
    </figure>
  );
}