// src/components/BeeswarmChart/BeeswarmChart.jsx
// ============================================================
// Nuage de points (beeswarm) d3 — réutilisable.
// d3 fait les maths (échelles + simulation de force) ; React rend le SVG.
// - 1 point = 1 territoire (couleur = intensité)
// - Ligne de référence "moyenne mondiale"
// - Bascule échelle linéaire / logarithmique (gère l'outlier)
// - Survol : nom complet + valeur (tooltip SVG, suit le zoom du viewBox)
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./BeeswarmChart.scss";

const W = 1000;
const H = 360;
const M = { top: 30, right: 40, bottom: 48, left: 40 };
const R = 9;

export default function BeeswarmChart({
  data,
  worldAvg,
  unit,
  refLabel,
  scaleLabels,
}) {
  const [logScale, setLogScale] = useState(false);
  const [hover, setHover] = useState(null);

  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  const min = useMemo(() => d3.min(data, (d) => d.value) || 0.01, [data]);

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

  // Simulation de force exécutée en synchrone → positions stables.
  const nodes = useMemo(() => {
    const sim = d3
      .forceSimulation(data.map((d) => ({ ...d })))
      .force("x", d3.forceX((d) => x(d.value)).strength(1))
      .force("y", d3.forceY(H / 2).strength(0.06))
      .force("collide", d3.forceCollide(R + 1.5))
      .stop();
    for (let i = 0; i < 260; i += 1) sim.tick();
    return sim.nodes();
  }, [data, x]);

  const ticks = logScale ? x.ticks(4, "~s") : x.ticks(6);
  const refX =
    worldAvg != null ? x(Math.max(worldAvg, logScale ? 0.05 : 0)) : null;

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
        {/* Axe X */}
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
              y={H - M.bottom + 20}
              textAnchor="middle"
            >
              {d3.format("~s")(tk)}
            </text>
          </g>
        ))}

        {/* Ligne moyenne mondiale */}
        {refX != null && (
          <g transform={`translate(${refX},0)`}>
            <line className="bee__ref" y1={M.top - 12} y2={H - M.bottom} />
            <text className="bee__ref-label" y={M.top - 16} textAnchor="middle">
              {refLabel} · {worldAvg}
            </text>
          </g>
        )}

        {/* Points */}
        {nodes.map((n) => (
          <circle
            key={n.area}
            className={`bee__dot ${hover && hover.area === n.area ? "is-hover" : ""}`}
            cx={n.x}
            cy={n.y}
            r={hover && hover.area === n.area ? R + 3 : R}
            fill={color(n.value)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* Tooltip SVG */}
        {hover && (
          <g
            className="bee__tip"
            transform={`translate(${Math.min(Math.max(hover.x, 90), W - 90)},${hover.y - R - 14})`}
          >
            <rect
              className="bee__tip-bg"
              x={-88}
              y={-40}
              width={176}
              height={36}
              rx={6}
            />
            <text className="bee__tip-name" y={-24} textAnchor="middle">
              {hover.name}
            </text>
            <text className="bee__tip-val" y={-9} textAnchor="middle">
              {hover.value.toLocaleString()} {unit} · {hover.year}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
