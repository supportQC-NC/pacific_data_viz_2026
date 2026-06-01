// src/components/ParadoxScatter/ParadoxScatter.jsx
// ============================================================
// Graphe signature de l'Acte 1 — le paradoxe en une image.
// x = ce qu'un territoire ÉMET (t CO₂e/hab, échelle log) ;
// y = ce qu'il SUBIT (impact climatique). Une bulle par territoire.
//
// v2 — lisibilité :
//  • bulles à leur VRAIE position (on ne déplace pas la donnée) ;
//  • étiquettes ANTI-COLLISION (greedy, priorité aux points « paradoxe » ;
//    les autres au survol) → fini le chevauchement ;
//  • quadrant « paradoxe » ombré (peu émis / fort impact) + médianes X/Y ;
//  • survol : les autres bulles s'atténuent, tooltip borné.
// Aucun style inline (géométrie = attributs SVG), couleurs via SCSS/tokens.
// Props : rows [{area,name,x,y}], xLabel,yLabel,xUnit,yUnit, xLog,
//         medianX, labels {empty, hint, paradox}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./ParadoxScatter.scss";

const VW = 880;
const VH = 520;
const M = { top: 30, right: 28, bottom: 58, left: 66 };

const LABEL_H = 14;
const charW = 6.3;

function collides(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export default function ParadoxScatter({
  rows = [],
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  xLog = true,
  medianX = null,
  labels = {},
}) {
  const [hover, setHover] = useState(null);

  const innerW = VW - M.left - M.right;
  const innerH = VH - M.top - M.bottom;

  const valid = useMemo(
    () => rows.filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y) && r.x > 0),
    [rows],
  );

  const x = useMemo(() => {
    const xs = valid.map((r) => r.x);
    const lo = d3.min(xs) ?? 0.1;
    const hi = d3.max(xs) ?? 1;
    const s = xLog
      ? d3.scaleLog().domain([Math.max(0.05, lo * 0.8), hi * 1.15])
      : d3.scaleLinear().domain([0, hi * 1.1]);
    return s.range([M.left, M.left + innerW]).clamp(true);
  }, [valid, xLog, innerW]);

  const y = useMemo(() => {
    const hi = d3.max(valid, (r) => r.y) ?? 1;
    return d3.scaleLinear().domain([0, hi * 1.12]).range([M.top + innerH, M.top]).nice();
  }, [valid, innerH]);

  const medY = useMemo(() => d3.median(valid, (r) => r.y) ?? null, [valid]);

  // Placement anti-collision des étiquettes (priorité = score paradoxe).
  const placed = useMemo(() => {
    if (!valid.length) return {};
    const xExtent = d3.extent(valid, (r) => r.x);
    const yMax = d3.max(valid, (r) => r.y) || 1;
    const score = (r) => {
      const xN = (Math.log10(r.x) - Math.log10(xExtent[0] || 0.1)) /
        (Math.log10(xExtent[1] || 1) - Math.log10(xExtent[0] || 0.1) || 1);
      return r.y / yMax + (1 - xN); // fort impact + faible émetteur d'abord
    };
    const order = [...valid].sort((a, b) => score(b) - score(a));
    const boxes = [];
    const out = {};
    order.forEach((r) => {
      const cx = x(r.x);
      const cy = y(r.y);
      const w = r.area.length * charW + 6;
      const candidates = [
        { side: "r", x: cx + 10, y: cy - LABEL_H / 2 },
        { side: "l", x: cx - 10 - w, y: cy - LABEL_H / 2 },
      ];
      for (const c of candidates) {
        const box = { x: c.x, y: c.y, w, h: LABEL_H };
        const inBounds =
          box.x >= M.left - 2 &&
          box.x + box.w <= M.left + innerW + 2 &&
          box.y >= M.top &&
          box.y + box.h <= M.top + innerH;
        if (inBounds && !boxes.some((b) => collides(box, b))) {
          boxes.push(box);
          out[r.area] = c.side;
          break;
        }
      }
    });
    return out;
  }, [valid, x, y, innerW, innerH]);

  if (valid.length < 3) return <div className="ps ps--empty">{labels.empty}</div>;

  const xTicks = xLog ? x.ticks(5, "~s") : x.ticks(6);
  const yTicks = y.ticks(5);
  const medX = medianX != null ? x(Math.max(medianX, x.domain()[0])) : null;
  const medYpx = medY != null ? y(medY) : null;

  return (
    <figure className="ps">
      <svg
        className="ps__svg"
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={`${xLabel} / ${yLabel}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Quadrant paradoxe : peu émis (gauche) + fort impact (haut) */}
        {medX != null && medYpx != null && (
          <g className="ps__quad">
            <rect x={M.left} y={M.top} width={medX - M.left} height={medYpx - M.top} />
            <text className="ps__quad-lbl" x={M.left + 10} y={M.top + 18}>
              {labels.paradox}
            </text>
          </g>
        )}

        {/* Grille Y */}
        {yTicks.map((t) => (
          <g key={`y${t}`} className="ps__grid">
            <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="ps__tick" x={M.left - 10} y={y(t)} dy="0.32em">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} className="ps__tick ps__tick--x" x={x(t)} y={M.top + innerH + 22}>
            {t}
          </text>
        ))}

        {/* Médianes */}
        {medX != null && (
          <g className="ps__median">
            <line x1={medX} x2={medX} y1={M.top} y2={M.top + innerH} />
            <text className="ps__median-lbl" x={medX} y={M.top - 8}>
              {labels.hint}
            </text>
          </g>
        )}
        {medYpx != null && (
          <line className="ps__median-h" x1={M.left} x2={M.left + innerW} y1={medYpx} y2={medYpx} />
        )}

        {/* Axes */}
        <line className="ps__axis" x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} />
        <line className="ps__axis" x1={M.left} x2={M.left} y1={M.top} y2={M.top + innerH} />
        <text className="ps__axlabel" x={M.left + innerW} y={M.top + innerH + 46} textAnchor="end">
          {xLabel} ({xUnit}) →
        </text>
        <text className="ps__axlabel" transform={`translate(18 ${M.top}) rotate(-90)`} textAnchor="end">
          ← {yLabel} ({yUnit})
        </text>

        {/* Bulles + étiquettes anti-collision */}
        {valid.map((r) => {
          const low = medianX != null && r.x <= medianX;
          const on = hover === r.area;
          const dim = hover && !on;
          const side = placed[r.area];
          const showLabel = on || Boolean(side);
          const cx = x(r.x);
          const cy = y(r.y);
          const right = on ? side !== "l" : side === "r";
          return (
            <g
              key={r.area}
              className={`ps__pt ${low ? "is-low" : "is-high"} ${on ? "is-on" : ""} ${dim ? "is-dim" : ""}`}
              onMouseEnter={() => setHover(r.area)}
              onMouseLeave={() => setHover(null)}
            >
              <circle className="ps__dot" cx={cx} cy={cy} r={on ? 8.5 : 6} />
              {showLabel && (
                <text
                  className="ps__code"
                  x={right ? cx + 9 : cx - 9}
                  y={cy}
                  dy="0.32em"
                  textAnchor={right ? "start" : "end"}
                >
                  {r.area}
                </text>
              )}
            </g>
          );
        })}

        {/* Tooltip détaillé borné */}
        {hover &&
          (() => {
            const r = valid.find((d) => d.area === hover);
            if (!r) return null;
            const w = 200;
            const tx = Math.min(Math.max(x(r.x) + 12, M.left), VW - w - 6);
            const ty = Math.min(Math.max(y(r.y) - 52, M.top + 2), M.top + innerH - 48);
            return (
              <g className="ps__tip">
                <rect x={tx} y={ty} width={w} height={44} rx="6" />
                <text className="ps__tip-name" x={tx + 12} y={ty + 18}>
                  {r.name}
                </text>
                <text className="ps__tip-val" x={tx + 12} y={ty + 34}>
                  {r.x} {xUnit} · {r.y} {yUnit}
                </text>
              </g>
            );
          })()}
      </svg>
    </figure>
  );
}