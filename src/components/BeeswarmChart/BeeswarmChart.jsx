// src/components/BeeswarmChart/BeeswarmChart.jsx
// ============================================================
// Beeswarm d3 ANIMÉ (GSAP), échelle LOG par défaut.
// Chaque point porte l'ACRONYME du territoire (code SPC) → lecture
// immédiate. Survol = nom complet + valeur. Repères : moyenne mondiale
// (fixe) + moyenne Pacifique (mobile).
// ============================================================

import React, { useMemo, useRef, useState, useLayoutEffect } from "react";
import * as d3 from "d3";
import gsap from "gsap";
import "./BeeswarmChart.scss";

const W = 1000;
const H = 440;
const M = { top: 48, right: 48, bottom: 64, left: 48 };
const R = 13;

export default function BeeswarmChart({
  data,
  worldAvg,
  unit,
  refLabel,
  scaleLabels,
  defaultLog = true,
}) {
  const [logScale, setLogScale] = useState(defaultLog);
  const [hover, setHover] = useState(null);

  const groupsRef = useRef(new Map());
  const circlesRef = useRef(new Map());
  const posRef = useRef(new Map());

  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  const min = useMemo(() => d3.min(data, (d) => d.value) || 0.01, [data]);
  const meanVal = useMemo(
    () => (data.length ? d3.mean(data, (d) => d.value) : null),
    [data],
  );

  const x = useMemo(() => {
    if (logScale) {
      return d3
        .scaleLog()
        .domain([Math.max(0.05, min * 0.8), max * 1.1])
        .range([M.left, W - M.right])
        .clamp(true);
    }
    return d3
      .scaleLinear()
      .domain([0, max * 1.05])
      .range([M.left, W - M.right]);
  }, [logScale, min, max]);

  const color = useMemo(
    () =>
      d3
        .scaleSequential()
        .domain([0, max])
        .interpolator(d3.interpolateRgb("#1f9bc9", "#ff6b4a")),
    [max],
  );

  const targets = useMemo(() => {
    const prev = posRef.current;
    const nodes = data.map((d) => ({
      ...d,
      x: prev.get(d.area)?.x ?? x(d.value),
      y: prev.get(d.area)?.y ?? H / 2 + (Math.random() - 0.5) * 24,
    }));
    const sim = d3
      .forceSimulation(nodes)
      .force("x", d3.forceX((d) => x(d.value)).strength(0.95))
      .force("y", d3.forceY(H / 2).strength(0.04))
      .force("collide", d3.forceCollide(R + 1.8))
      .stop();
    for (let i = 0; i < 240; i += 1) sim.tick();
    const m = new Map();
    sim.nodes().forEach((n) => m.set(n.area, { x: n.x, y: n.y }));
    return m;
  }, [data, x]);

  useLayoutEffect(() => {
    const seen = new Set();
    let i = 0;
    targets.forEach((tgt, area) => {
      seen.add(area);
      const g = groupsRef.current.get(area);
      const c = circlesRef.current.get(area);
      if (!g) return;
      const datum = data.find((d) => d.area === area);
      const fill = color(datum ? datum.value : 0);
      const known = posRef.current.has(area);
      if (!known) {
        gsap.set(g, { x: tgt.x, y: tgt.y, opacity: 0 });
        if (c) gsap.set(c, { attr: { r: R, fill } });
        gsap.to(g, {
          opacity: 1,
          duration: 0.5,
          delay: i * 0.012,
          ease: "power1.out",
        });
      } else {
        gsap.to(g, {
          x: tgt.x,
          y: tgt.y,
          duration: 0.85,
          delay: i * 0.01,
          ease: "power2.inOut",
        });
        if (c)
          gsap.to(c, {
            attr: { r: R, fill },
            duration: 0.6,
            ease: "power1.out",
          });
      }
      posRef.current.set(area, { x: tgt.x, y: tgt.y });
      i += 1;
    });
    Array.from(posRef.current.keys()).forEach((a) => {
      if (!seen.has(a)) posRef.current.delete(a);
    });
  }, [targets, color, data]);

  const enter = (d) => {
    setHover(d);
    const c = circlesRef.current.get(d.area);
    if (c)
      gsap.to(c, { attr: { r: R + 3 }, duration: 0.15, ease: "power1.out" });
  };
  const leave = (d) => {
    setHover(null);
    const c = circlesRef.current.get(d.area);
    if (c) gsap.to(c, { attr: { r: R }, duration: 0.2, ease: "power1.out" });
  };

  const ticks = logScale ? x.ticks(4, "~s") : x.ticks(6);
  const refX =
    worldAvg != null ? x(Math.max(worldAvg, logScale ? 0.05 : 0)) : null;
  const meanX =
    meanVal != null ? x(Math.max(meanVal, logScale ? 0.05 : 0)) : null;
  const fmt = d3.format("~s");
  const fmt2 = d3.format(".2~f");
  const axisMid = (M.left + (W - M.right)) / 2;
  const hoverPos = hover ? posRef.current.get(hover.area) : null;

  return (
    <div className="bee">
      <div className="bee__controls">
        <button
          className={`bee__toggle ${!logScale ? "is-on" : ""}`}
          onClick={() => setLogScale(false)}
        >
          {scaleLabels?.linear || "Linéaire"}
        </button>
        <button
          className={`bee__toggle ${logScale ? "is-on" : ""}`}
          onClick={() => setLogScale(true)}
        >
          {scaleLabels?.log || "Log"}
        </button>
      </div>

      <svg className="bee__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        <line
          className="bee__axis"
          x1={M.left}
          y1={H - M.bottom}
          x2={W - M.right}
          y2={H - M.bottom}
        />
        {ticks.map((tk) => (
          <g key={tk} transform={`translate(${x(tk)},0)`}>
            <line className="bee__grid" y1={M.top} y2={H - M.bottom} />
            <text
              className="bee__tick"
              y={H - M.bottom + 22}
              textAnchor="middle"
            >
              {fmt(tk)}
            </text>
          </g>
        ))}
        {unit && (
          <text
            className="bee__axis-title"
            x={axisMid}
            y={H - 14}
            textAnchor="middle"
          >
            {unit}
          </text>
        )}

        {meanX != null && (
          <g className="bee__mean-g" transform={`translate(${meanX},0)`}>
            <line className="bee__mean" y1={M.top + 8} y2={H - M.bottom} />
            <text className="bee__mean-label" y={M.top + 2} textAnchor="middle">
              Ø {fmt2(meanVal)}
            </text>
          </g>
        )}

        {refX != null && (
          <g className="bee__ref-g" transform={`translate(${refX},0)`}>
            <line className="bee__ref" y1={M.top - 14} y2={H - M.bottom} />
            <text className="bee__ref-label" y={M.top - 18} textAnchor="middle">
              {refLabel} · {worldAvg}
            </text>
          </g>
        )}

        {data.map((d) => (
          <g
            key={d.area}
            ref={(el) => {
              if (el) groupsRef.current.set(d.area, el);
              else groupsRef.current.delete(d.area);
            }}
          >
            <circle
              ref={(el) => {
                if (el) circlesRef.current.set(d.area, el);
                else circlesRef.current.delete(d.area);
              }}
              className={`bee__dot ${hover && hover.area === d.area ? "is-hover" : ""}`}
              onMouseEnter={() => enter(d)}
              onMouseLeave={() => leave(d)}
            />
            <text
              className="bee__code"
              dy="0.32em"
              textAnchor="middle"
              onMouseEnter={() => enter(d)}
              onMouseLeave={() => leave(d)}
            >
              {d.area}
            </text>
          </g>
        ))}

        {hover && hoverPos && (
          <g
            className="bee__tip"
            transform={`translate(${Math.min(Math.max(hoverPos.x, 96), W - 96)},${hoverPos.y - R - 16})`}
          >
            <rect
              className="bee__tip-bg"
              x={-92}
              y={-44}
              width={184}
              height={38}
              rx={7}
            />
            <text className="bee__tip-name" y={-27} textAnchor="middle">
              {hover.name}
            </text>
            <text className="bee__tip-val" y={-11} textAnchor="middle">
              {fmt2(hover.value)} {unit} · {hover.year}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}