// src/components/ScatterPlot/ScatterPlot.jsx
// ============================================================
// Nuage de points « pro » pour la synthèse.
// • x = responsabilité (GES/hab), y = indice de vulnérabilité (0–100)
// • séparateur vertical = repère MONDIAL (moyenne mondiale CO₂/hab) ; séparateur
//   horizontal = médiane de vulnérabilité → 4 quadrants, celui de l'« injustice »
//   (peu responsables / très exposés) est teinté et libellé
// • points colorés par sous-région, étiquetés en permanence, halo + animation
//   d'entrée échelonnée, survol → infobulle, territoire sélectionné mis en avant
// Props : points [{area,name,x,y,region}], xLabel, yLabel, xUnit,
//   xRef {value,label}, yDivider, quadrants {tl,tr,bl,br},
//   highlight (area), regionLabels {}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./ScatterPlot.scss";

const W = 1000;
const H = 540;
const M = { top: 30, right: 30, bottom: 58, left: 66 };

const REGION_COLORS = {
  melanesia: "#ff7a59",
  polynesia: "#46d3e6",
  micronesia: "#9b8cff",
  other: "#c0e060",
};

export default function ScatterPlot({
  points = [],
  xLabel,
  yLabel,
  xUnit,
  xRef = null,
  yDivider = null,
  quadrants = {},
  highlight = null,
  regionLabels = {},
}) {
  const [hover, setHover] = useState(null);

  const pts = useMemo(
    () => points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [points],
  );

  const x = useMemo(() => {
    const maxData = d3.max(pts, (p) => p.x) ?? 1;
    const hi = Math.max(maxData, Number.isFinite(xRef && xRef.value) ? xRef.value : 0) * 1.08 || 1;
    return d3.scaleLinear().domain([0, hi]).nice().range([M.left, W - M.right]);
  }, [pts, xRef]);

  const y = useMemo(
    () => d3.scaleLinear().domain([0, 100]).range([H - M.bottom, M.top]),
    [],
  );

  if (!pts.length) return <div className="scatter scatter--empty" />;

  const xTicks = x.ticks(6);
  const yTicks = y.ticks(5);
  const fmtX = (v) => (Math.abs(v) >= 1000 ? d3.format("~s")(v) : d3.format("~r")(v));
  const vx = xRef && Number.isFinite(xRef.value) ? x(xRef.value) : null;
  const hy = Number.isFinite(yDivider) ? y(yDivider) : null;
  const colorOf = (p) => REGION_COLORS[p.region] || REGION_COLORS.other;
  const hp = hover ? pts.find((p) => p.area === hover) : null;

  return (
    <div className="scatter">
      <svg className="scatter__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        {vx != null && hy != null && (
          <rect
            className="scatter__zone"
            x={M.left}
            y={M.top}
            width={Math.max(0, vx - M.left)}
            height={Math.max(0, hy - M.top)}
          />
        )}

        {yTicks.map((tk) => (
          <g key={`y${tk}`} transform={`translate(0,${y(tk)})`}>
            <line className="scatter__grid" x1={M.left} x2={W - M.right} />
            <text className="scatter__tick" x={M.left - 8} dy="0.32em" textAnchor="end">
              {tk}
            </text>
          </g>
        ))}
        {xTicks.map((tk) => (
          <g key={`x${tk}`} transform={`translate(${x(tk)},0)`}>
            <line className="scatter__grid scatter__grid--v" y1={M.top} y2={H - M.bottom} />
            <text className="scatter__tick" y={H - M.bottom + 20} textAnchor="middle">
              {fmtX(tk)}
            </text>
          </g>
        ))}

        {hy != null && (
          <line className="scatter__median" x1={M.left} x2={W - M.right} y1={hy} y2={hy} />
        )}
        {vx != null && (
          <g>
            <line className="scatter__ref" x1={vx} x2={vx} y1={M.top} y2={H - M.bottom} />
            <text className="scatter__ref-lbl" x={vx + 6} y={H - M.bottom - 8}>
              {xRef.label}
            </text>
          </g>
        )}

        {quadrants.tl && (
          <text className="scatter__quadrant scatter__quadrant--hero" x={M.left + 12} y={M.top + 20}>
            {quadrants.tl}
          </text>
        )}
        {quadrants.tr && (
          <text className="scatter__quadrant" x={W - M.right - 12} y={M.top + 20} textAnchor="end">
            {quadrants.tr}
          </text>
        )}
        {quadrants.bl && (
          <text className="scatter__quadrant" x={M.left + 12} y={H - M.bottom - 12}>
            {quadrants.bl}
          </text>
        )}
        {quadrants.br && (
          <text className="scatter__quadrant" x={W - M.right - 12} y={H - M.bottom - 12} textAnchor="end">
            {quadrants.br}
          </text>
        )}

        <line className="scatter__axis" x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} />
        <line className="scatter__axis" x1={M.left} y1={M.top} x2={M.left} y2={H - M.bottom} />
        {xLabel && (
          <text className="scatter__axis-label" x={(M.left + W - M.right) / 2} y={H - 14} textAnchor="middle">
            {xLabel}
            {xUnit ? ` (${xUnit})` : ""}
          </text>
        )}
        {yLabel && (
          <text
            className="scatter__axis-label"
            transform={`translate(18,${(M.top + H - M.bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {yLabel}
          </text>
        )}

        <g className="scatter__pts">
          {pts.map((p) => {
            const on = hover === p.area || highlight === p.area;
            const dim = (hover && hover !== p.area) || (highlight && highlight !== p.area && !hover);
            return (
              <g
                key={p.area}
                className={`scatter__pt ${on ? "is-on" : ""} ${dim ? "is-dim" : ""}`}
                onMouseEnter={() => setHover(p.area)}
                onMouseLeave={() => setHover(null)}
              >
                <circle className="scatter__halo" cx={x(p.x)} cy={y(p.y)} r={16} fill={colorOf(p)} />
                <circle className="scatter__dot" cx={x(p.x)} cy={y(p.y)} r={on ? 9 : 6} fill={colorOf(p)} />
                <text className="scatter__pt-lbl" x={x(p.x) + 9} y={y(p.y)} dy="0.32em">
                  {p.area}
                </text>
              </g>
            );
          })}
        </g>

        {Object.keys(REGION_COLORS).map((r, i) => (
          <g key={r} transform={`translate(${W - M.right - 150},${M.top + 6 + i * 18})`}>
            <circle cx={0} cy={0} r={5} fill={REGION_COLORS[r]} />
            <text className="scatter__legend" x={10} dy="0.32em">
              {regionLabels[r] || r}
            </text>
          </g>
        ))}

        {hp && (
          <g
            className="scatter__tip"
            transform={`translate(${Math.min(x(hp.x) + 14, W - 224)},${Math.max(y(hp.y) - 10, M.top + 10)})`}
          >
            <rect className="scatter__tip-bg" width={210} height={58} rx={8} />
            <text className="scatter__tip-name" x={12} y={20}>
              {hp.name}
            </text>
            <text className="scatter__tip-val" x={12} y={38}>
              {`${xLabel}: ${fmtX(hp.x)}${xUnit ? " " + xUnit : ""}`}
            </text>
            <text className="scatter__tip-val" x={12} y={50}>
              {`${yLabel}: ${Math.round(hp.y)} / 100`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}