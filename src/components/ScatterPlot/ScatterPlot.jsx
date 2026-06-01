// src/components/ScatterPlot/ScatterPlot.jsx
// ============================================================
// Nuage de points réutilisable pour la synthèse.
// • x = responsabilité (GES/hab), y = indice de vulnérabilité (0–100)
// • lignes médianes → 4 quadrants ; le quadrant « peu responsables / très
//   exposés » est souligné par un libellé
// • points colorés par sous-région, étiquetés (code), survol → nom + valeurs
// • un territoire peut être mis en évidence (sélection)
// Props : points [{area,name,x,y,region}], xLabel, yLabel, xUnit,
//         medians {x,y}, quadrantLabel, highlight (area), regionLabels {}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./ScatterPlot.scss";

const W = 1000;
const H = 520;
const M = { top: 28, right: 28, bottom: 56, left: 64 };

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
  medians = {},
  quadrantLabel,
  highlight = null,
  regionLabels = {},
}) {
  const [hover, setHover] = useState(null);

  const pts = useMemo(() => points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), [points]);

  const x = useMemo(() => {
    const ext = d3.extent(pts, (p) => p.x);
    const lo = Math.min(0, ext[0] ?? 0);
    const hi = (ext[1] ?? 1) * 1.08 || 1;
    return d3.scaleLinear().domain([lo, hi]).nice().range([M.left, W - M.right]);
  }, [pts]);

  const y = useMemo(
    () => d3.scaleLinear().domain([0, 100]).range([H - M.bottom, M.top]),
    [],
  );

  if (!pts.length) return <div className="scatter scatter--empty" />;

  const xTicks = x.ticks(6);
  const yTicks = y.ticks(5);
  const fmtX = (v) => (Math.abs(v) >= 1000 ? d3.format("~s")(v) : d3.format("~r")(v));
  const mx = Number.isFinite(medians.x) ? x(medians.x) : null;
  const my = Number.isFinite(medians.y) ? y(medians.y) : null;
  const colorOf = (p) => REGION_COLORS[p.region] || REGION_COLORS.other;
  const hp = hover ? pts.find((p) => p.area === hover) : null;

  return (
    <div className="scatter">
      <svg className="scatter__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        {/* grille */}
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

        {/* médianes (quadrants) */}
        {mx != null && (
          <line className="scatter__median" x1={mx} x2={mx} y1={M.top} y2={H - M.bottom} />
        )}
        {my != null && (
          <line className="scatter__median" x1={M.left} x2={W - M.right} y1={my} y2={my} />
        )}
        {quadrantLabel && (
          <text className="scatter__quadrant" x={M.left + 12} y={M.top + 18}>
            {quadrantLabel}
          </text>
        )}

        {/* axes */}
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
            transform={`translate(16,${(M.top + H - M.bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {yLabel}
          </text>
        )}

        {/* points */}
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
              <circle cx={x(p.x)} cy={y(p.y)} r={on ? 9 : 6} fill={colorOf(p)} />
              <text className="scatter__pt-lbl" x={x(p.x) + 9} y={y(p.y)} dy="0.32em">
                {p.area}
              </text>
            </g>
          );
        })}

        {/* légende sous-régions */}
        {Object.keys(REGION_COLORS).map((r, i) => (
          <g key={r} transform={`translate(${W - M.right - 150},${M.top + 4 + i * 18})`}>
            <circle cx={0} cy={0} r={5} fill={REGION_COLORS[r]} />
            <text className="scatter__legend" x={10} dy="0.32em">
              {regionLabels[r] || r}
            </text>
          </g>
        ))}

        {/* infobulle */}
        {hp && (
          <g className="scatter__tip" transform={`translate(${Math.min(x(hp.x) + 14, W - 220)},${Math.max(y(hp.y) - 10, M.top + 10)})`}>
            <rect className="scatter__tip-bg" width={206} height={56} rx={8} />
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