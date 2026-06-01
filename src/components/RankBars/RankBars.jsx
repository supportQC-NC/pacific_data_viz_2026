// src/components/RankBars/RankBars.jsx
// ============================================================
// Classement animé (« bar chart race ») — réutilisable.
// Les barres se réordonnent (Y) et se redimensionnent (largeur) à chaque
// année → on VOIT qui monte/descend. Échelle racine (pow 0.5) pour garder
// les petites valeurs lisibles malgré l'outlier.
//
// COULEUR SÉMANTIQUE :
//   • betterWhen="low"  → DIVERGENT centré sur le repère (worldAvg) :
//                         sous le repère = vert (favorable), au repère =
//                         cyan (neutre/identité), au-dessus = rouge.
//   • betterWhen="high" → miroir (sous = rouge, au-dessus = vert).
//   • good="up"/"down"  → ancien dégradé vert↔rouge séquentiel (compat).
//   • aucun             → dégradé identité bleu → corail (comportement
//                         historique ; les actes non modifiés inchangés).
// Couleurs lues depuis les tokens CSS → bascule light/dark automatique.
// ============================================================

import React, { useMemo, useRef, useLayoutEffect } from "react";
import * as d3 from "d3";
import gsap from "gsap";
import "./RankBars.scss";

const W = 1000;
const BAR_H = 22;
const GAP = 8;
const M = { top: 10, right: 70, bottom: 34, left: 178 };

// Lit un token CSS au runtime (avec repli si indisponible).
function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function RankBars({
  data,
  unit,
  worldAvg,
  refLabel,
  good = null,
  betterWhen = null,
}) {
  const rowsRef = useRef(new Map()); // area -> <g>
  const barsRef = useRef(new Map()); // area -> <rect>
  const valsRef = useRef(new Map()); // area -> <text>
  const known = useRef(new Set());

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );
  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  const innerW = W - M.left - M.right;
  const H = M.top + M.bottom + sorted.length * (BAR_H + GAP);

  const xScale = useMemo(
    () => d3.scalePow().exponent(0.5).domain([0, max]).range([0, innerW]),
    [max, innerW],
  );

  // Échelle de couleur.
  const color = useMemo(() => {
    const accent = cssVar("--c-accent", "#00e6ff");
    const pos = cssVar("--c-positive", "#25e09a");
    const neg = cssVar("--c-negative", "#ff4d6d");

    // DIVERGENT centré sur le repère (worldAvg).
    if (betterWhen === "low" || betterWhen === "high") {
      const lo = betterWhen === "low" ? pos : neg; // sous le repère
      const hi = betterWhen === "low" ? neg : pos; // au-dessus du repère
      const minV = d3.min(data, (d) => d.value);
      const maxV = d3.max(data, (d) => d.value);
      const pivot = worldAvg;
      if (
        pivot != null &&
        Number.isFinite(pivot) &&
        Number.isFinite(minV) &&
        Number.isFinite(maxV) &&
        minV < pivot &&
        pivot < maxV
      ) {
        return d3
          .scaleLinear()
          .domain([minV, pivot, maxV])
          .range([lo, accent, hi])
          .interpolate(d3.interpolateRgb)
          .clamp(true);
      }
      // Repère hors de la plage → simple écart cyan → couleur dominante.
      const dmin = Number.isFinite(minV) ? minV : 0;
      const dmax = Number.isFinite(maxV) ? maxV : 1;
      const a = pivot != null && pivot <= dmin ? accent : lo;
      const b = pivot != null && pivot >= dmax ? accent : hi;
      return d3
        .scaleLinear()
        .domain([dmin, dmax === dmin ? dmin + 1 : dmax])
        .range([a, b])
        .interpolate(d3.interpolateRgb)
        .clamp(true);
    }

    // Compat : ancien dégradé vert↔rouge séquentiel.
    if (good === "up" || good === "down") {
      const lo = good === "up" ? neg : pos;
      const hi = good === "up" ? pos : neg;
      return d3
        .scaleSequential()
        .domain([0, max])
        .interpolator(d3.interpolateRgb(lo, hi));
    }

    // Défaut : dégradé identité bleu → corail.
    return d3
      .scaleSequential()
      .domain([0, max])
      .interpolator(d3.interpolateRgb("#1f9bc9", "#ff6b4a"));
  }, [data, max, good, betterWhen, worldAvg]);

  const fmt2 = d3.format(".2~f");
  const refX = worldAvg != null ? xScale(worldAvg) : null;

  const targets = useMemo(() => {
    const m = new Map();
    sorted.forEach((d, i) => {
      m.set(d.area, {
        y: M.top + i * (BAR_H + GAP),
        w: Math.max(0, xScale(d.value)),
        value: d.value,
      });
    });
    return m;
  }, [sorted, xScale]);

  useLayoutEffect(() => {
    let i = 0;
    targets.forEach((tgt, area) => {
      const g = rowsRef.current.get(area);
      const bar = barsRef.current.get(area);
      const v = valsRef.current.get(area);
      const fill = color(tgt.value);
      const isKnown = known.current.has(area);
      const valX = M.left + tgt.w + 8;
      if (!isKnown) {
        if (g) gsap.set(g, { y: tgt.y, opacity: 0 });
        if (bar) gsap.set(bar, { attr: { width: tgt.w, fill } });
        if (v) gsap.set(v, { attr: { x: valX } });
        if (g)
          gsap.to(g, {
            opacity: 1,
            duration: 0.4,
            delay: i * 0.02,
            ease: "power1.out",
          });
        known.current.add(area);
      } else {
        if (g)
          gsap.to(g, {
            y: tgt.y,
            duration: 0.85,
            delay: i * 0.01,
            ease: "power2.inOut",
          });
        if (bar)
          gsap.to(bar, {
            attr: { width: tgt.w, fill },
            duration: 0.85,
            ease: "power2.inOut",
          });
        if (v)
          gsap.to(v, {
            attr: { x: valX },
            duration: 0.85,
            ease: "power2.inOut",
          });
      }
      if (v) v.textContent = fmt2(tgt.value);
      i += 1;
    });
    Array.from(known.current).forEach((a) => {
      if (!targets.has(a)) known.current.delete(a);
    });
  }, [targets, color]);

  return (
    <div className={`rank ${betterWhen ? "rank--pivot" : ""}`}>
      <svg className="rank__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        {refX != null && (
          <g
            className="rank__ref-g"
            transform={`translate(${M.left + refX},0)`}
          >
            <line className="rank__ref" y1={0} y2={H - M.bottom} />
            <text
              className="rank__ref-label"
              y={H - M.bottom + 22}
              textAnchor="middle"
            >
              {refLabel} · {worldAvg}
            </text>
          </g>
        )}

        {data.map((d) => (
          <g
            key={d.area}
            ref={(el) => {
              if (el) rowsRef.current.set(d.area, el);
              else rowsRef.current.delete(d.area);
            }}
          >
            <text
              className="rank__name"
              x={M.left - 12}
              y={BAR_H / 2}
              dy="0.35em"
              textAnchor="end"
            >
              {d.name}
            </text>
            <rect
              ref={(el) => {
                if (el) barsRef.current.set(d.area, el);
                else barsRef.current.delete(d.area);
              }}
              className="rank__bar"
              x={M.left}
              y={0}
              height={BAR_H}
              rx={5}
            />
            <text
              ref={(el) => {
                if (el) valsRef.current.set(d.area, el);
                else valsRef.current.delete(d.area);
              }}
              className="rank__val"
              y={BAR_H / 2}
              dy="0.35em"
              textAnchor="start"
            />
          </g>
        ))}

        <text
          className="rank__axis-title"
          x={M.left + innerW / 2}
          y={H - 8}
          textAnchor="middle"
        >
          {unit}
        </text>
      </svg>
    </div>
  );
}