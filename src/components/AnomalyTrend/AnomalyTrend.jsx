// src/components/AnomalyTrend/AnomalyTrend.jsx
// ============================================================
// Courbe d'anomalie dans le temps — réutilisable (niveau de mer, SST…).
// • Moyenne Pacifique (ligne forte) + bande min–max (dispersion régionale)
// • Référence 0 + aire teintée moyenne→0 (sensation de montée)
// • SURVOL INTERACTIF : l'année suit le curseur, lecture moyenne + min/max
//   (à défaut, marqueur sur l'année courante du curseur partagé)
// • Légende intégrée (moyenne / dispersion)
// Props : data [{year,mean,min,max}], currentYear, unit, tone "sea"|"warm"|"green",
//         baselineLabel, meanLabel, bandLabel
// ============================================================

import React, { useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import "./AnomalyTrend.scss";

const W = 1000;
const H = 320;
const M = { top: 40, right: 132, bottom: 38, left: 56 };

export default function AnomalyTrend({
  data = [],
  currentYear,
  unit = "",
  tone = "sea",
  baselineLabel = "0",
  meanLabel = "",
  bandLabel = "",
}) {
  const svgRef = useRef(null);
  const [hoverYear, setHoverYear] = useState(null);
  const valid = data.length > 0;

  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(d3.extent(valid ? data.map((d) => d.year) : [0, 1]))
        .range([M.left, W - M.right]),
    [data, valid],
  );
  const y = useMemo(() => {
    if (!valid) return null;
    const lo = Math.min(0, d3.min(data, (d) => d.min));
    const hi = Math.max(0, d3.max(data, (d) => d.max));
    const pad = (hi - lo) * 0.12 || 0.1;
    return d3.scaleLinear().domain([lo - pad, hi + pad]).range([H - M.bottom, M.top]).nice();
  }, [data, valid]);

  const band = useMemo(
    () =>
      y
        ? d3.area().x((d) => x(d.year)).y0((d) => y(d.min)).y1((d) => y(d.max)).curve(d3.curveMonotoneX)
        : null,
    [x, y],
  );
  const areaToBase = useMemo(
    () =>
      y
        ? d3.area().x((d) => x(d.year)).y0(() => y(0)).y1((d) => y(d.mean)).curve(d3.curveMonotoneX)
        : null,
    [x, y],
  );
  const meanLine = useMemo(
    () => (y ? d3.line().x((d) => x(d.year)).y((d) => y(d.mean)).curve(d3.curveMonotoneX) : null),
    [x, y],
  );

  const yearsExtent = valid ? d3.extent(data, (d) => d.year) : [0, 1];

  function onMove(e) {
    if (!svgRef.current || !valid) return;
    const r = svgRef.current.getBoundingClientRect();
    const ux = ((e.clientX - r.left) / r.width) * W;
    const yr = x.invert(ux);
    let nearest = data[0];
    data.forEach((d) => {
      if (Math.abs(d.year - yr) < Math.abs(nearest.year - yr)) nearest = d;
    });
    setHoverYear(nearest.year);
  }
  const onLeave = () => setHoverYear(null);

  if (!valid || !y) return <div className={`atrend atrend--${tone} atrend--empty`} />;

  const yTicks = y.ticks(5);
  const span = yearsExtent[1] - yearsExtent[0];
  const step = span > 40 ? 10 : span > 20 ? 5 : 2;
  const xTicks = [];
  for (let yr = Math.ceil(yearsExtent[0] / step) * step; yr <= yearsExtent[1]; yr += step) xTicks.push(yr);

  const fmt = d3.format("+.2~f");
  const active = hoverYear != null ? hoverYear : currentYear;
  const cur = active != null ? data.find((d) => d.year === active) : null;
  const cx = active != null ? x(active) : null;

  // Position du panneau de lecture (borné). Boîte élargie + lignes empilées
  // pour qu'année, moyenne et plage ne se chevauchent JAMAIS.
  const readoutW = 188;
  const rX = cx != null ? Math.min(Math.max(cx - readoutW / 2, M.left), W - M.right - readoutW) : 0;

  return (
    <div className={`atrend atrend--${tone}`}>
      <svg
        ref={svgRef}
        className="atrend__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* Légende */}
        <g className="atrend__legend" transform={`translate(${M.left},16)`}>
          <line className="atrend__legend-mean" x1="0" x2="22" y1="0" y2="0" />
          <text className="atrend__legend-txt" x="28" dy="0.32em">{meanLabel}</text>
          {bandLabel ? (
            <>
              <rect className="atrend__legend-band" x="92" y="-5" width="22" height="10" rx="2" />
              <text className="atrend__legend-txt" x="120" dy="0.32em">{bandLabel}</text>
            </>
          ) : null}
        </g>

        {yTicks.map((tk) => (
          <g key={tk} transform={`translate(0,${y(tk)})`}>
            <line className="atrend__grid" x1={M.left} x2={W - M.right} />
            <text className="atrend__tick" x={M.left - 8} dy="0.32em" textAnchor="end">
              {fmt(tk)}
            </text>
          </g>
        ))}

        <path className="atrend__band" d={band(data) || ""} />
        <path className="atrend__area" d={areaToBase(data) || ""} />

        <g transform={`translate(0,${y(0)})`}>
          <line className="atrend__baseline" x1={M.left} x2={W - M.right} />
          <text className="atrend__baseline-label" x={W - M.right + 6} dy="0.32em">
            {baselineLabel}
          </text>
        </g>

        <path className="atrend__mean" d={meanLine(data) || ""} />

        {xTicks.map((tk) => (
          <text key={tk} className="atrend__tick" x={x(tk)} y={H - M.bottom + 22} textAnchor="middle">
            {tk}
          </text>
        ))}
        {unit && (
          <text className="atrend__unit" x={M.left - 48} y={M.top - 12}>
            {unit}
          </text>
        )}
        {meanLabel && (
          <text
            className="atrend__meanlabel"
            x={x(yearsExtent[1]) + 8}
            y={y(data[data.length - 1].mean)}
            dy="0.32em"
          >
            {meanLabel}
          </text>
        )}

        {/* Marqueur (année survolée ou courante) */}
        {cx != null && (
          <g className="atrend__marker" transform={`translate(${cx},0)`}>
            <line className="atrend__marker-line" y1={M.top} y2={H - M.bottom} />
            {cur && (
              <>
                <circle className="atrend__marker-dot" cy={y(cur.mean)} r={5} />
                <circle className="atrend__marker-dot atrend__marker-dot--soft" cy={y(cur.min)} r={3} />
                <circle className="atrend__marker-dot atrend__marker-dot--soft" cy={y(cur.max)} r={3} />
              </>
            )}
          </g>
        )}

        {/* Panneau de lecture : L1 = année (g.) + plage (d.) · L2 = moyenne */}
        {cur && (
          <g className="atrend__readout" transform={`translate(${rX},${M.top - 38})`}>
            <rect width={readoutW} height="34" rx="6" />
            <text className="atrend__readout-yr" x="10" y="14">{active}</text>
            <text className="atrend__readout-rng" x={readoutW - 10} y="14" textAnchor="end">
              {fmt(cur.min)} – {fmt(cur.max)}
            </text>
            <text className="atrend__readout-mean" x="10" y="27">
              {meanLabel} {fmt(cur.mean)} {unit}
            </text>
          </g>
        )}

        {/* Zone de capture du survol (transparente, au-dessus) */}
        <rect
          className="atrend__capture"
          x={M.left}
          y={M.top}
          width={W - M.right - M.left}
          height={H - M.top - M.bottom}
        />
      </svg>
    </div>
  );
}