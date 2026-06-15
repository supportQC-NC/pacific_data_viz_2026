// src/components/charts/StreamMix/StreamMix.jsx
// ============================================================
// STREAMGRAPH — visuel signature inspiré de la React Graph Gallery, en SVG
// pur (sans d3). La composition empilée habituelle devient une rivière
// organique centrée : chaque source d'énergie est une bande qui ondule
// autour de l'axe médian, lissée par interpolation Catmull-Rom.
//
// Lecture « silhouette » : chaque année est centrée sur sa hauteur totale,
// d'où l'effet de flux. Au survol, une bande s'illumine et un bandeau
// affiche la source, sa valeur et sa part à la dernière année.
//
// Contrat de données identique à PowerMixChart :
//   series: [{ name, data:[nombres alignés sur years], color }], years, unit.
// Couleurs concrètes fournies par le parent (ApexCharts-compatible) ; aucune
// couleur en dur ici, structure via tokens du thème.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./StreamMix.scss";

const VB_W = 1000;
const VB_H = 440;
const M = { top: 26, right: 22, bottom: 40, left: 22 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;
const MID_Y = M.top + PLOT_H / 2;
const X_TICKS = 6;

const r1 = (n) => Math.round(n * 10) / 10;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const fmtVal = (n) =>
  Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : r1(n).toLocaleString();

// Segments de Bézier (Catmull-Rom) reliant points[0]…points[n-1] ; le « M »
// initial est posé par l'appelant (le stylo est déjà sur points[0]).
function segs(p) {
  let d = "";
  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

function bandPath(top, bottom) {
  if (top.length < 2) return "";
  const rev = [...bottom].reverse();
  return (
    `M ${r1(top[0].x)} ${r1(top[0].y)}` +
    segs(top) +
    ` L ${r1(rev[0].x)} ${r1(rev[0].y)}` +
    segs(rev) +
    " Z"
  );
}

export default function StreamMix({
  series = [],
  years = [],
  unit = "",
  hintLabel = "",
  shareLabel = "",
}) {
  const [hover, setHover] = useState(null);

  const { bands, ticks } = useMemo(() => {
    const n = years.length;
    if (!series.length || n < 2) return { bands: [], ticks: [] };

    const xOf = (xi) => M.left + (xi / (n - 1)) * PLOT_W;
    const cols = years.map((y, xi) => {
      const vals = series.map((s) => Math.max(0, Number(s.data[xi]) || 0));
      return { total: vals.reduce((a, b) => a + b, 0), vals };
    });
    const maxTotal = Math.max(...cols.map((c) => c.total), 1);
    const scaleY = (PLOT_H * 0.92) / maxTotal;

    const out = series.map((s, i) => {
      const top = [];
      const bottom = [];
      cols.forEach((c, xi) => {
        const streamTop = MID_Y - (c.total * scaleY) / 2;
        const before = c.vals.slice(0, i).reduce((a, b) => a + b, 0);
        const incl = before + c.vals[i];
        const x = xOf(xi);
        top.push({ x, y: streamTop + before * scaleY });
        bottom.push({ x, y: streamTop + incl * scaleY });
      });
      const last = cols[n - 1];
      return {
        name: s.name,
        color: s.color,
        d: bandPath(top, bottom),
        lastVal: last.vals[i],
        share: last.total > 0 ? last.vals[i] / last.total : 0,
      };
    });

    const tk = [];
    for (let k = 0; k < X_TICKS; k += 1) {
      const xi = Math.round((k * (n - 1)) / (X_TICKS - 1));
      if (!tk.some((t) => t.xi === xi)) tk.push({ xi, x: xOf(xi), year: years[xi] });
    }
    return { bands: out, ticks: tk };
  }, [series, years]);

  const active = useMemo(
    () => bands.find((b) => b.name === hover) || null,
    [bands, hover],
  );
  const enter = useCallback((name) => setHover(name), []);
  const leave = useCallback(() => setHover(null), []);

  if (!bands.length) return null;

  return (
    <figure className="stream">
      <svg
        className="stream__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={hintLabel}
      >
        {bands.map((b) => {
          const cls = [
            "stream__band",
            active && active.name === b.name ? "is-active" : "",
            active && active.name !== b.name ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <path
              key={b.name}
              className={cls}
              d={b.d}
              style={{ "--c": b.color }}
              onMouseEnter={() => enter(b.name)}
              onMouseLeave={leave}
              onFocus={() => enter(b.name)}
              onBlur={leave}
              tabIndex={0}
              role="button"
              aria-label={`${b.name} — ${fmtVal(b.lastVal)} ${unit}`}
            />
          );
        })}

        {/* axe des années */}
        {ticks.map((t) => (
          <text
            key={t.xi}
            className="stream__year"
            x={t.x}
            y={VB_H - 14}
            textAnchor="middle"
          >
            {t.year}
          </text>
        ))}
      </svg>

      {/* lecture au survol */}
      <p className="stream__readout" aria-live="polite">
        {active ? (
          <>
            <span className="stream__readout-dot" style={{ "--c": active.color }} />
            <span className="stream__readout-name">{active.name}</span>
            <span className="stream__readout-sep">·</span>
            {fmtVal(active.lastVal)} {unit}
            <span className="stream__readout-share">
              {shareLabel} {Math.round(active.share * 100)}%
            </span>
          </>
        ) : (
          <span className="stream__readout-hint">{hintLabel}</span>
        )}
      </p>

      {/* légende */}
      <ul className="stream__legend">
        {bands.map((b) => (
          <li
            key={b.name}
            className={`stream__leg-item ${
              active && active.name === b.name ? "is-active" : ""
            }`}
            onMouseEnter={() => enter(b.name)}
            onMouseLeave={leave}
          >
            <span className="stream__leg-dot" style={{ "--c": b.color }} />
            {b.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}