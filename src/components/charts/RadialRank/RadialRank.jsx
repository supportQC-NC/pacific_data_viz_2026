// src/components/charts/RadialRank/RadialRank.jsx
// ============================================================
// CIRCULAR BARPLOT (barres radiales) — visuel signature inspiré de la
// React Graph Gallery, en SVG pur (sans d3). Un classement [{code,name,value}]
// devient une couronne de barres rayonnant depuis un moyeu central.
//
// • longueur de barre ∝ valeur ; intensité ∝ valeur ; 1re place mise en avant ;
// • anneaux de repère concentriques (25 / 50 / 75 / 100 %) ;
// • étiquette = code territoire (2 lettres, toujours lisible) ;
// • le MOYEU sert de lecture : libellé de la mesure par défaut, nom complet
//   + valeur au survol (donc aucun texte hors-cadre à rogner).
//
// Réutilisable pour tout classement à une valeur (production, rendements,
// bétail, fiscalité…). Libellés via props (i18n parent). Thème via tokens.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./RadialRank.scss";

const VB = 720;
const C = VB / 2;
const INNER = 132; // rayon du moyeu
const BAR_MAX = 168; // longueur de barre maximale
const LABEL_PAD = 18; // distance code ↔ pointe de barre
const MAX_ITEMS = 16;
const RINGS = [0.25, 0.5, 0.75, 1];

const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = (n) => Math.round(n * 10) / 10;
const fmtVal = (n) =>
  Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : r1(n).toLocaleString();

export default function RadialRank({
  rows = [],
  unit = "",
  centerLabel = "",
  hintLabel = "",
}) {
  const [hover, setHover] = useState(null);

  const bars = useMemo(() => {
    const clean = rows
      .map((r) => ({
        code: r.code || r.area || "",
        name: r.name || r.code || r.area || "",
        value: Number(r.value),
      }))
      .filter((r) => Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_ITEMS);

    const n = clean.length;
    const max = Math.max(...clean.map((r) => r.value), 0.0001);
    const step = n ? 360 / n : 360;
    const thick = clamp((INNER * (step * Math.PI)) / 180 / 1.5, 9, 26);

    return clean.map((r, i) => {
      const deg = -90 + i * step;
      const frac = clamp(r.value / max, 0, 1);
      const tipR = INNER + frac * BAR_MAX;
      const [x1, y1] = polar(INNER, deg);
      const [x2, y2] = polar(tipR, deg);
      const [lx, ly] = polar(tipR + LABEL_PAD, deg);
      return {
        ...r,
        i,
        thick: r1(thick),
        x1: r1(x1),
        y1: r1(y1),
        x2: r1(x2),
        y2: r1(y2),
        lx: r1(lx),
        ly: r1(ly),
        intensity: clamp(0.36 + frac * 0.64, 0.36, 1),
        top: i === 0,
      };
    });
  }, [rows]);

  const active = useMemo(
    () => bars.find((b) => b.code === hover) || null,
    [bars, hover],
  );

  const enter = useCallback((code) => setHover(code), []);
  const leave = useCallback(() => setHover(null), []);

  if (!bars.length) return null;

  return (
    <figure className="radial">
      <svg
        className="radial__svg"
        viewBox={`0 0 ${VB} ${VB}`}
        role="img"
        aria-label={centerLabel}
      >
        {/* anneaux de repère concentriques */}
        {RINGS.map((f) => (
          <circle
            key={f}
            className={`radial__ring ${f === 1 ? "is-edge" : ""}`}
            cx={C}
            cy={C}
            r={INNER + f * BAR_MAX}
          />
        ))}
        <circle className="radial__hub" cx={C} cy={C} r={INNER - 6} />

        {bars.map((b) => {
          const cls = [
            "radial__bar",
            b.top ? "is-top" : "",
            active && active.code === b.code ? "is-active" : "",
            active && active.code !== b.code ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g key={b.code || b.i} className={cls}>
              <line
                className="radial__hit"
                x1={b.x1}
                y1={b.y1}
                x2={b.x2}
                y2={b.y2}
                onMouseEnter={() => enter(b.code)}
                onMouseLeave={leave}
                onFocus={() => enter(b.code)}
                onBlur={leave}
                tabIndex={0}
                role="button"
                aria-label={`${b.name} — ${fmtVal(b.value)} ${unit}`}
              />
              <line
                className="radial__stem"
                x1={b.x1}
                y1={b.y1}
                x2={b.x2}
                y2={b.y2}
                strokeWidth={b.thick}
                style={{ "--i": b.intensity }}
              />
              <circle
                className="radial__tip"
                cx={b.x2}
                cy={b.y2}
                r={b.thick / 2 + 1.5}
              />
              <text
                className="radial__code"
                x={b.lx}
                y={b.ly}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {b.code}
              </text>
              <title>{`${b.name} · ${fmtVal(b.value)} ${unit}`}</title>
            </g>
          );
        })}

        {/* moyeu : libellé de la mesure ou lecture au survol */}
        {active ? (
          <>
            <text className="radial__hub-name" x={C} y={C - 16} textAnchor="middle">
              {active.name}
            </text>
            <text className="radial__hub-val" x={C} y={C + 20} textAnchor="middle">
              {fmtVal(active.value)}
            </text>
            <text className="radial__hub-unit" x={C} y={C + 46} textAnchor="middle">
              {unit}
            </text>
          </>
        ) : (
          <>
            <text className="radial__hub-label" x={C} y={C - 8} textAnchor="middle">
              {centerLabel}
            </text>
            <text className="radial__hub-unit" x={C} y={C + 18} textAnchor="middle">
              {unit}
            </text>
            {hintLabel ? (
              <text className="radial__hub-hint" x={C} y={C + 44} textAnchor="middle">
                {hintLabel}
              </text>
            ) : null}
          </>
        )}
      </svg>
    </figure>
  );
}