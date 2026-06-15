// src/components/charts/RadialRank/RadialRank.jsx
// ============================================================
// CIRCULAR BARPLOT (barres radiales) — visuel signature inspiré de la
// React Graph Gallery, en SVG pur (sans d3). Un classement [{code,name,value}]
// devient une couronne de barres rayonnant depuis un moyeu central.
//
// • longueur de barre ∝ valeur ; intensité de couleur ∝ valeur ;
// • la 1re position est mise en avant (teinte « positive ») ;
// • étiquette = code territoire (2 lettres, toujours lisible) ;
// • au survol : la barre s'épaissit et le MOYEU affiche le nom complet
//   + la valeur ; sinon le moyeu montre le libellé de la mesure.
//
// Réutilisable pour tout classement à une valeur (production électrique,
// rendements agricoles, bétail, fiscalité…). Libellés via props (i18n parent).
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./RadialRank.scss";

const VB = 720;
const C = VB / 2;
const INNER = 124; // rayon du moyeu
const BAR_MAX = 150; // longueur de barre maximale
const LABEL_PAD = 20; // distance code ↔ pointe de barre
const MAX_ITEMS = 14;

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
    const thick = clamp((INNER * (step * Math.PI)) / 180 / 1.7, 7, 22);

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
        intensity: clamp(0.34 + frac * 0.66, 0.34, 1),
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
        {/* anneau de repère */}
        <circle className="radial__guide" cx={C} cy={C} r={INNER + BAR_MAX} />
        <circle className="radial__hub" cx={C} cy={C} r={INNER - 8} />

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
              <circle className="radial__tip" cx={b.x2} cy={b.y2} r={b.thick / 2 + 1.5} />
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
            <text className="radial__hub-name" x={C} y={C - 10} textAnchor="middle">
              {active.name}
            </text>
            <text className="radial__hub-val" x={C} y={C + 24} textAnchor="middle">
              {fmtVal(active.value)}
            </text>
            <text className="radial__hub-unit" x={C} y={C + 48} textAnchor="middle">
              {unit}
            </text>
          </>
        ) : (
          <>
            <text className="radial__hub-label" x={C} y={C - 4} textAnchor="middle">
              {centerLabel}
            </text>
            <text className="radial__hub-unit" x={C} y={C + 24} textAnchor="middle">
              {unit}
            </text>
          </>
        )}
      </svg>

      <p className="radial__hint" aria-live="polite">
        {active ? `${active.name} · ${fmtVal(active.value)} ${unit}` : hintLabel}
      </p>
    </figure>
  );
}