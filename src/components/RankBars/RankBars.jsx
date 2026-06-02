// src/components/RankBars/RankBars.jsx
// ============================================================
// Classement anime (« bar chart race ») — reutilisable.
// Les barres se reordonnent (Y) et se redimensionnent (largeur) a chaque
// changement d'annee. Echelle racine (pow 0.5) pour garder les petites
// valeurs visibles malgre l'outlier ; valeur exacte en bout de barre.
//
// COULEUR SEMANTIQUE divergente autour du repere `worldAvg` (mediane) :
//   • betterWhen="low"  (defaut) -> sous la mediane = vert, au-dessus = rouge
//   • betterWhen="high"          -> inverse
// Zones teintees en arriere-plan (favorable / defavorable) + ligne de
// reference libellee. Couleurs lues depuis les tokens CSS -> light/dark auto.
// Props : data [{area,name,value}], unit, worldAvg, refLabel, betterWhen.
// ============================================================

import React, { useMemo, useRef, useLayoutEffect } from "react";
import * as d3 from "d3";
import gsap from "gsap";
import "./RankBars.scss";

const W = 1000;
const BAR_H = 22;
const GAP = 8;
const M = { top: 16, right: 72, bottom: 38, left: 180 };

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
  betterWhen = "low",
}) {
  const rowsRef = useRef(new Map());
  const barsRef = useRef(new Map());
  const valsRef = useRef(new Map());
  const known = useRef(new Set());

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );
  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  const min = useMemo(() => d3.min(data, (d) => d.value) ?? 0, [data]);
  const innerW = W - M.left - M.right;
  const H = M.top + M.bottom + sorted.length * (BAR_H + GAP);
  const plotH = H - M.top - M.bottom;

  const xScale = useMemo(
    () => d3.scalePow().exponent(0.5).domain([0, max]).range([0, innerW]),
    [max, innerW],
  );

  const pivot = useMemo(() => {
    if (worldAvg != null && worldAvg > min && worldAvg < max) return worldAvg;
    return (min + max) / 2;
  }, [worldAvg, min, max]);

  // Couleur divergente : vert (favorable) -> cyan (repere) -> rouge (defavorable).
  const colorFor = useMemo(() => {
    const pos = cssVar("--c-positive", "#25e09a");
    const neg = cssVar("--c-negative", "#ff4d6d");
    const mid = cssVar("--c-accent", "#00e6ff");
    const lowColor = betterWhen === "high" ? neg : pos;
    const highColor = betterWhen === "high" ? pos : neg;
    const belowS = d3.scaleLinear().domain([min, pivot]).range([0, 1]).clamp(true);
    const aboveS = d3.scaleLinear().domain([pivot, max]).range([0, 1]).clamp(true);
    const belowI = d3.interpolateRgb(lowColor, mid);
    const aboveI = d3.interpolateRgb(mid, highColor);
    return (v) => (v <= pivot ? belowI(belowS(v)) : aboveI(aboveS(v)));
  }, [min, max, pivot, betterWhen]);

  const fmt2 = d3.format(".2~f");
  const refX = xScale(pivot);
  const goodLeft = betterWhen !== "high";

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
      const fill = colorFor(tgt.value);
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
  }, [targets, colorFor]);

  return (
    <div className="rank">
      <svg className="rank__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        <rect className={`rank__zone ${goodLeft ? "rank__zone--good" : "rank__zone--bad"}`} x={M.left} y={M.top} width={Math.max(0, refX)} height={plotH} />
        <rect className={`rank__zone ${goodLeft ? "rank__zone--bad" : "rank__zone--good"}`} x={M.left + refX} y={M.top} width={Math.max(0, innerW - refX)} height={plotH} />

        <g className="rank__ref-g" transform={`translate(${M.left + refX},0)`}>
          <line className="rank__ref" y1={M.top} y2={M.top + plotH} />
          <text className="rank__ref-label" y={H - M.bottom + 24} textAnchor="middle">
            {refLabel} {"\u00b7"} {fmt2(pivot)}
          </text>
        </g>

        {data.map((d) => (
          <g
            key={d.area}
            ref={(el) => {
              if (el) rowsRef.current.set(d.area, el);
              else rowsRef.current.delete(d.area);
            }}
          >
            <text className="rank__name" x={M.left - 12} y={BAR_H / 2} dy="0.35em" textAnchor="end">{d.name}</text>
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

        <text className="rank__axis-title" x={M.left + innerW / 2} y={H - 8} textAnchor="middle">{unit}</text>
      </svg>
    </div>
  );
}