// src/components/charts/Lollipop/Lollipop.jsx
// ============================================================
// LOLLIPOP horizontal — visuel galerie (React Graph Gallery) en SVG pur.
// Un classement [{code,name,value}] : nom à gauche, tige jusqu'à la valeur,
// pastille colorée en bout. Idéal pour les classements à noms longs (les
// territoires du Pacifique) là où des barres pleines seraient lourdes.
//
// Couleur sémantique par intensité : betterWhen="low" (haut = pire) → corail ;
// betterWhen="high" (haut = mieux) → vert. La 1re position est mise en avant.
// Au survol : ligne éclairée, pastille agrandie, les autres s'estompent.
//
// Libellés via props (i18n parent). Structure via tokens du thème ; seules
// les valeurs DATA-dépendantes (position, intensité) passent par le style.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./Lollipop.scss";

const VB_W = 1000;
const ROW_H = 48;
const PAD_T = 18;
const PAD_B = 46;
const NAME_W = 236;
const RIGHT = 72;
const PLOT_X0 = NAME_W;
const PLOT_X1 = VB_W - RIGHT;
const PLOT_W = PLOT_X1 - PLOT_X0;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = (n) => Math.round(n * 10) / 10;
const fmtVal = (n) =>
  Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : r1(n).toLocaleString();

function niceMax(v) {
  if (v <= 100 && v > 0) return 100; // indices 0–100
  const pow = 10 ** Math.floor(Math.log10(v || 1));
  return Math.ceil(v / pow) * pow;
}

export default function Lollipop({
  rows = [],
  unit = "",
  betterWhen = "low",
  axisMax = null,
  ticks = 4,
}) {
  const [hover, setHover] = useState(null);

  const { items, max, gridTicks, height } = useMemo(() => {
    const clean = rows
      .map((r) => ({
        code: r.code || r.area || r.name || "",
        name: r.name || r.code || r.area || "",
        value: Number(r.value),
      }))
      .filter((r) => Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value);

    const dataMax = Math.max(...clean.map((r) => r.value), 1);
    const m = axisMax || niceMax(dataMax);
    const xOf = (v) => PLOT_X0 + (clamp(v, 0, m) / m) * PLOT_W;

    const out = clean.map((r, i) => ({
      ...r,
      i,
      y: PAD_T + i * ROW_H + ROW_H / 2,
      x: r1(xOf(r.value)),
      intensity: clamp(0.4 + (r.value / m) * 0.6, 0.4, 1),
      top: i === 0,
    }));

    const gt = [];
    for (let k = 0; k <= ticks; k += 1) {
      const v = (m * k) / ticks;
      gt.push({ v, x: r1(xOf(v)) });
    }
    return {
      items: out,
      max: m,
      gridTicks: gt,
      height: PAD_T + clean.length * ROW_H + PAD_B,
    };
  }, [rows, axisMax, ticks]);

  const enter = useCallback((code) => setHover(code), []);
  const leave = useCallback(() => setHover(null), []);

  if (!items.length) return null;

  const toneCls = betterWhen === "high" ? "is-good" : "is-bad";

  return (
    <figure className={`lolli ${toneCls}`}>
      <svg
        className="lolli__svg"
        viewBox={`0 0 ${VB_W} ${height}`}
        role="img"
        aria-label={unit}
      >
        {/* grille verticale + graduations */}
        {gridTicks.map((g) => (
          <g key={g.v}>
            <line
              className="lolli__grid"
              x1={g.x}
              y1={PAD_T - 6}
              x2={g.x}
              y2={height - PAD_B + 6}
            />
            <text
              className="lolli__tick"
              x={g.x}
              y={height - PAD_B + 26}
              textAnchor="middle"
            >
              {fmtVal(g.v)}
            </text>
          </g>
        ))}
        <text
          className="lolli__axis-title"
          x={PLOT_X0 + PLOT_W / 2}
          y={height - 8}
          textAnchor="middle"
        >
          {unit}
        </text>

        {/* lignes */}
        {items.map((d) => {
          const cls = [
            "lolli__row",
            d.top ? "is-top" : "",
            hover === d.code ? "is-active" : "",
            hover && hover !== d.code ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g
              key={d.code || d.i}
              className={cls}
              onMouseEnter={() => enter(d.code)}
              onMouseLeave={leave}
              onFocus={() => enter(d.code)}
              onBlur={leave}
              tabIndex={0}
              role="button"
              aria-label={`${d.name} — ${fmtVal(d.value)} ${unit}`}
            >
              <rect
                className="lolli__hit"
                x={0}
                y={d.y - ROW_H / 2}
                width={VB_W}
                height={ROW_H}
              />
              <text
                className="lolli__name"
                x={NAME_W - 16}
                y={d.y}
                dy="0.32em"
                textAnchor="end"
              >
                {d.name}
              </text>
              <line
                className="lolli__stem"
                x1={PLOT_X0}
                y1={d.y}
                x2={d.x}
                y2={d.y}
                style={{ "--i": d.intensity }}
              />
              <circle
                className="lolli__dot"
                cx={d.x}
                cy={d.y}
                r={d.top ? 9 : 7}
                style={{ "--i": d.intensity }}
              />
              <text
                className="lolli__val"
                x={d.x + 14}
                y={d.y}
                dy="0.32em"
                textAnchor="start"
              >
                {fmtVal(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}