// src/components/AnomalyTrend/AnomalyTrend.jsx
// ============================================================
// Courbe d'anomalie dans le temps — réutilisable (niveau de mer, SST…).
// • Moyenne Pacifique (ligne forte) + bande min–max (dispersion régionale)
// • Ligne de référence 0 (= moyenne de la période de base)
// • Aire teintée entre la moyenne et 0 (donne la sensation de montée)
// • Curseur d'année vertical qui glisse + point sur la moyenne
// Props :
//   data        : [{ year, mean, min, max }]
//   currentYear : number | null
//   unit        : string
//   tone        : "sea" | "warm"
//   baselineLabel, meanLabel
// ============================================================

import React, { useMemo } from "react";
import * as d3 from "d3";
import "./AnomalyTrend.scss";

const W = 1000;
const H = 300;
const M = { top: 24, right: 130, bottom: 36, left: 52 };

export default function AnomalyTrend({
  data = [],
  currentYear,
  unit = "",
  tone = "sea",
  baselineLabel = "0",
  meanLabel = "",
}) {
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
    const lo = Math.min(
      0,
      d3.min(data, (d) => d.min),
    );
    const hi = Math.max(
      0,
      d3.max(data, (d) => d.max),
    );
    const pad = (hi - lo) * 0.12 || 0.1;
    return d3
      .scaleLinear()
      .domain([lo - pad, hi + pad])
      .range([H - M.bottom, M.top])
      .nice();
  }, [data, valid]);

  const band = useMemo(
    () =>
      y
        ? d3
            .area()
            .x((d) => x(d.year))
            .y0((d) => y(d.min))
            .y1((d) => y(d.max))
            .curve(d3.curveMonotoneX)
        : null,
    [x, y],
  );
  const areaToBase = useMemo(
    () =>
      y
        ? d3
            .area()
            .x((d) => x(d.year))
            .y0(() => y(0))
            .y1((d) => y(d.mean))
            .curve(d3.curveMonotoneX)
        : null,
    [x, y],
  );
  const meanLine = useMemo(
    () =>
      y
        ? d3
            .line()
            .x((d) => x(d.year))
            .y((d) => y(d.mean))
            .curve(d3.curveMonotoneX)
        : null,
    [x, y],
  );

  if (!valid || !y)
    return <div className={`atrend atrend--${tone} atrend--empty`} />;

  const yTicks = y.ticks(5);
  const yearsExtent = d3.extent(data, (d) => d.year);
  const span = yearsExtent[1] - yearsExtent[0];
  const step = span > 40 ? 10 : span > 20 ? 5 : 2;
  const xTicks = [];
  for (
    let yr = Math.ceil(yearsExtent[0] / step) * step;
    yr <= yearsExtent[1];
    yr += step
  )
    xTicks.push(yr);

  const fmt = d3.format("+.2~f");
  const cur =
    currentYear != null ? data.find((d) => d.year === currentYear) : null;
  const cx = currentYear != null ? x(currentYear) : null;

  return (
    <div className={`atrend atrend--${tone}`}>
      <svg className="atrend__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        {yTicks.map((tk) => (
          <g key={tk} transform={`translate(0,${y(tk)})`}>
            <line className="atrend__grid" x1={M.left} x2={W - M.right} />
            <text
              className="atrend__tick"
              x={M.left - 8}
              dy="0.32em"
              textAnchor="end"
            >
              {fmt(tk)}
            </text>
          </g>
        ))}

        {/* bande min–max */}
        <path className="atrend__band" d={band(data) || ""} />

        {/* aire moyenne → 0 */}
        <path className="atrend__area" d={areaToBase(data) || ""} />

        {/* ligne de référence 0 */}
        <g transform={`translate(0,${y(0)})`}>
          <line className="atrend__baseline" x1={M.left} x2={W - M.right} />
          <text
            className="atrend__baseline-label"
            x={W - M.right + 6}
            dy="0.32em"
          >
            {baselineLabel}
          </text>
        </g>

        {/* moyenne */}
        <path className="atrend__mean" d={meanLine(data) || ""} />

        {/* axe X */}
        {xTicks.map((tk) => (
          <text
            key={tk}
            className="atrend__tick"
            x={x(tk)}
            y={H - M.bottom + 22}
            textAnchor="middle"
          >
            {tk}
          </text>
        ))}
        {unit && (
          <text className="atrend__unit" x={M.left - 44} y={M.top - 8}>
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

        {/* curseur d'année */}
        {cx != null && (
          <g className="atrend__marker" transform={`translate(${cx},0)`}>
            <line
              className="atrend__marker-line"
              y1={M.top}
              y2={H - M.bottom}
            />
            <text
              className="atrend__marker-label"
              y={M.top - 8}
              textAnchor="middle"
            >
              {currentYear}
            </text>
            {cur && (
              <circle className="atrend__marker-dot" cy={y(cur.mean)} r={5} />
            )}
            {cur && (
              <text
                className="atrend__marker-val"
                y={y(cur.mean)}
                dy="-0.9em"
                textAnchor="middle"
              >
                {fmt(cur.mean)}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
