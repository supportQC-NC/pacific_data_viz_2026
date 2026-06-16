// src/components/charts/StressSwarm/StressSwarm.jsx
// ============================================================
// BEESWARM MULTI-LIGNES — adapté de la React Graph Gallery (« How Europe is
// feeling »). Un essaim par stress : chaque point est un territoire placé
// selon son intensité (0–100). Survol d'un point — ou recherche d'une île —
// et elle s'allume sur LES SIX LIGNES à la fois, les autres s'effacent.
//
// Repère min–max par ligne, codes des extrêmes affichés au repos, barre de
// recherche. SVG pur (sans d3). Jitter déterministe (pas de saut au rerender).
// Données : rows [{code,name,values:[0–100 alignés sur axes]}], axes [labels].
// Libellés via props (i18n). Tokens du thème.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./StressSwarm.scss";

const VB_W = 1000;
const LW = 192; // libellés de lignes
const RIGHT = 28;
const TOP = 46;
const BOTTOM = 26;
const ROW_H = 66;
const X0 = LW;
const X1 = VB_W - RIGHT;
const PLOT_W = X1 - X0;
const TICKS = [0, 25, 50, 75, 100];

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = (n) => Math.round(n * 10) / 10;
const xOf = (v) => X0 + (clamp(v, 0, 100) / 100) * PLOT_W;

// Jitter déterministe (hash FNV-1a) → reproductible, pas de saut au rerender.
function jitter(code, j, amp) {
  let h = 2166136261;
  const s = `${code}:${j}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = ((h >>> 0) % 1000) / 1000;
  return (u - 0.5) * amp;
}

export default function StressSwarm({
  rows = [],
  axes = [],
  searchLabel = "",
  hintLabel = "",
}) {
  const [hovered, setHovered] = useState(null); // { code, axis }
  const [query, setQuery] = useState("");

  const K = axes.length;
  const AMP = ROW_H * 0.46;
  const rowY = useCallback((j) => TOP + j * ROW_H + ROW_H / 2, []);
  const VB_H = TOP + K * ROW_H + BOTTOM;

  const dots = useMemo(() => {
    const out = [];
    rows.forEach((r) => {
      const code = r.code || r.name || "";
      (r.values || []).forEach((v, j) => {
        if (Number.isFinite(v)) {
          out.push({
            code,
            name: r.name || code,
            axis: j,
            value: v,
            cx: r1(xOf(v)),
            cy: r1(rowY(j) + jitter(code, j, AMP)),
          });
        }
      });
    });
    return out;
  }, [rows, rowY, AMP]);

  // Repère min–max + codes des extrêmes par ligne.
  const lines = useMemo(() => {
    return axes
      .map((_, j) => {
        const ds = dots.filter((d) => d.axis === j);
        if (!ds.length) return null;
        let lo = ds[0];
        let hi = ds[0];
        ds.forEach((d) => {
          if (d.value < lo.value) lo = d;
          if (d.value > hi.value) hi = d;
        });
        return { axis: j, y: rowY(j), lo, hi };
      })
      .filter(Boolean);
  }, [dots, axes, rowY]);

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set();
    return new Set(
      dots.filter((d) => d.name.toLowerCase().includes(q)).map((d) => d.code),
    );
  }, [query, dots]);

  const highlight = useMemo(() => {
    if (hovered) return new Set([hovered.code]);
    return matched;
  }, [hovered, matched]);

  const interacting = !!hovered || matched.size > 0;

  const enter = useCallback((code, axis) => setHovered({ code, axis }), []);
  const leave = useCallback(() => setHovered(null), []);

  if (!dots.length || K < 1) return null;

  return (
    <figure className="swarm">
      <div className="swarm__head">
        <input
          className="swarm__search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
        />
        <span className="swarm__hint">{hintLabel}</span>
      </div>

      <svg
        className="swarm__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={axes.join(" · ")}
      >
        {/* grille verticale + % */}
        {TICKS.map((v) => (
          <g key={v}>
            <line
              className="swarm__grid"
              x1={xOf(v)}
              y1={TOP}
              x2={xOf(v)}
              y2={TOP + K * ROW_H}
            />
            <text className="swarm__tick" x={xOf(v)} y={TOP - 12} textAnchor="middle">
              {v}%
            </text>
          </g>
        ))}

        {/* repère min–max + libellés de lignes */}
        {lines.map((l) => (
          <g key={`row-${l.axis}`}>
            <line
              className="swarm__range"
              x1={l.lo.cx}
              y1={l.y}
              x2={l.hi.cx}
              y2={l.y}
            />
            <text
              className="swarm__rowlabel"
              x={LW - 14}
              y={l.y}
              dy="0.32em"
              textAnchor="end"
            >
              {axes[l.axis]}
            </text>
          </g>
        ))}

        {/* points (estompés pendant l'interaction) */}
        <g className={`swarm__dots ${interacting ? "is-faded" : ""}`}>
          {dots.map((d) => (
            <circle
              key={`${d.axis}-${d.code}`}
              className="swarm__dot"
              cx={d.cx}
              cy={d.cy}
              r={6}
              onMouseEnter={() => enter(d.code, d.axis)}
              onMouseLeave={leave}
              onFocus={() => enter(d.code, d.axis)}
              onBlur={leave}
              tabIndex={0}
              role="button"
              aria-label={`${d.name} — ${axes[d.axis]} ${Math.round(d.value)}`}
            >
              <title>{`${d.name} · ${axes[d.axis]} ${Math.round(d.value)}`}</title>
            </circle>
          ))}
        </g>

        {/* points mis en avant (survol / recherche) sur toutes les lignes */}
        {interacting
          ? dots
              .filter((d) => highlight.has(d.code))
              .map((d) => {
                const showName =
                  (hovered && hovered.code === d.code && hovered.axis === d.axis) ||
                  (!hovered && d.axis === 0);
                return (
                  <g key={`hl-${d.axis}-${d.code}`} className="swarm__hl">
                    <circle cx={d.cx} cy={d.cy} r={8} />
                    {showName ? (
                      <text x={d.cx} y={d.cy - 16} textAnchor="middle">
                        {hovered ? d.name : d.code}
                      </text>
                    ) : null}
                  </g>
                );
              })
          : null}

        {/* codes des extrêmes (au repos seulement) */}
        {!interacting
          ? lines.flatMap((l) => [
              <text
                key={`lo-${l.axis}`}
                className="swarm__extreme"
                x={l.lo.cx}
                y={l.lo.cy - 13}
                textAnchor="middle"
              >
                {l.lo.code}
              </text>,
              <text
                key={`hi-${l.axis}`}
                className="swarm__extreme"
                x={l.hi.cx}
                y={l.hi.cy - 13}
                textAnchor="middle"
              >
                {l.hi.code}
              </text>,
            ])
          : null}
      </svg>
    </figure>
  );
}