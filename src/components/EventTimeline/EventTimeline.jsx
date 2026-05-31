// src/components/EventTimeline/EventTimeline.jsx
// ============================================================
// Frise d'événements : chaque catastrophe = un cercle positionné à
// son année (x), dispersé en essaim (force collide), rayon ∝ valeur,
// teinte ∝ intensité. Donne à voir le RYTHME des catastrophes et les
// années qui ont frappé fort. Survol → infobulle (nom + année + valeur).
// Props :
//   events   : [{ area, name, year, value }]
//   unit     : string
//   format   : (n) => string   (formatage de la valeur)
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./EventTimeline.scss";

const W = 1000;
const H = 280;
const M = { top: 20, right: 20, bottom: 36, left: 20 };

export default function EventTimeline({
  events = [],
  unit = "",
  format = (n) => String(n),
}) {
  const data = useMemo(
    () => events.filter((e) => Number.isFinite(e.value) && e.value > 0),
    [events],
  );

  const x = useMemo(() => {
    const ext = d3.extent(data.length ? data.map((d) => d.year) : [2005, 2023]);
    return d3
      .scaleLinear()
      .domain([ext[0] - 0.5, ext[1] + 0.5])
      .range([M.left, W - M.right]);
  }, [data]);

  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  const r = useMemo(
    () => d3.scaleSqrt().domain([0, max]).range([3, 30]),
    [max],
  );
  const color = useMemo(
    () =>
      d3
        .scaleSequential()
        .domain([0, max])
        .interpolator(d3.interpolateRgb("#f0b06a", "#c81e1e")),
    [max],
  );

  const nodes = useMemo(() => {
    const ns = data.map((d) => ({ ...d, r: r(d.value) }));
    const sim = d3
      .forceSimulation(ns)
      .force("x", d3.forceX((d) => x(d.year)).strength(1))
      .force("y", d3.forceY((H - M.bottom + M.top) / 2).strength(0.06))
      .force("collide", d3.forceCollide((d) => d.r + 1.2).strength(0.9))
      .stop();
    for (let i = 0; i < 220; i += 1) sim.tick();
    return ns;
  }, [data, x, r]);

  const [hover, setHover] = useState(-1);

  const ext = d3.extent(data.length ? data.map((d) => d.year) : [2005, 2023]);
  const ticks = [];
  for (let y = Math.ceil(ext[0] / 2) * 2; y <= ext[1]; y += 2) ticks.push(y);

  if (!data.length) return <div className="etl etl--empty" />;

  return (
    <div className="etl">
      <svg
        className="etl__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onMouseLeave={() => setHover(-1)}
      >
        <line
          className="etl__axis"
          x1={M.left}
          x2={W - M.right}
          y1={H - M.bottom}
          y2={H - M.bottom}
        />
        {ticks.map((tk) => (
          <text
            key={tk}
            className="etl__tick"
            x={x(tk)}
            y={H - M.bottom + 20}
            textAnchor="middle"
          >
            {tk}
          </text>
        ))}

        {nodes.map((n, i) => (
          <circle
            key={`${n.area}-${n.year}`}
            className={`etl__dot ${hover === i ? "is-hover" : ""}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={color(n.value)}
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover >= 0 && nodes[hover] && (
          <g
            className="etl__tip"
            transform={`translate(${nodes[hover].x},${nodes[hover].y - nodes[hover].r - 8})`}
          >
            <text className="etl__tip-main" textAnchor="middle">
              {nodes[hover].name} · {nodes[hover].year}
            </text>
            <text className="etl__tip-sub" y={16} textAnchor="middle">
              {format(nodes[hover].value)} {unit}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
