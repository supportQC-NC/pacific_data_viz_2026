// src/components/TrendLines/TrendLines.jsx
// ============================================================
// Trajectoires temporelles — réutilisable, lisible.
// • Échelle Y log avec ticks "ronds" (1,2,5,10,20,50,100,200…)
// • Libellés de fin DÉ-CHEVAUCHÉS (algo glouton) + connecteurs
// • Survol d'une courbe → elle ressort, les autres s'atténuent
// • Curseur d'année vertical qui glisse + points qui suivent
// Props : series [{area,name,values:[{year,value}]}], years[], currentYear, unit
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./TrendLines.scss";

const W = 1000;
const H = 380;
const M = { top: 26, right: 150, bottom: 40, left: 56 };
const PALETTE = [
  "#ff5a36",
  "#1f9bc9",
  "#ffd166",
  "#46c7b8",
  "#9b8cff",
  "#ff8fab",
  "#5ad1ff",
  "#c0e060",
];
const NICE = [0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500, 1000];

export default function TrendLines({
  series = [],
  years = [],
  currentYear,
  unit,
}) {
  const [hoverArea, setHoverArea] = useState(null);

  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(d3.extent(years.length ? years : [0, 1]))
        .range([M.left, W - M.right]),
    [years],
  );

  const { y, valid } = useMemo(() => {
    const all = series
      .flatMap((s) => s.values.map((v) => v.value))
      .filter((v) => v > 0);
    if (!all.length) return { y: null, valid: false };
    const yMin = Math.max(0.05, d3.min(all));
    const yMax = d3.max(all);
    const scale = d3
      .scaleLog()
      .domain([yMin * 0.85, yMax * 1.15])
      .range([H - M.bottom, M.top])
      .clamp(true);
    return { y: scale, valid: true };
  }, [series]);

  const line = useMemo(
    () =>
      d3
        .line()
        .defined((d) => d.value > 0)
        .x((d) => x(d.year))
        .y((d) => (y ? y(d.value) : 0))
        .curve(d3.curveMonotoneX),
    [x, y],
  );

  // Libellés de fin dé-chevauchés.
  const labels = useMemo(() => {
    if (!y) return [];
    const items = series
      .map((s, i) => {
        const last = [...s.values].reverse().find((v) => v.value > 0);
        if (!last) return null;
        return {
          area: s.area,
          name: s.name,
          color: PALETTE[i % PALETTE.length],
          yTrue: y(last.value),
          xEnd: x(last.year),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.yTrue - b.yTrue);
    const MIN = 16;
    items.forEach((it, k) => {
      it.yLab =
        k === 0 ? it.yTrue : Math.max(it.yTrue, items[k - 1].yLab + MIN);
    });
    // re-cale dans la zone
    const overflow = (items[items.length - 1]?.yLab ?? 0) - (H - M.bottom);
    if (overflow > 0)
      items.forEach((it) => {
        it.yLab -= overflow;
      });
    return items;
  }, [series, x, y]);

  if (!valid || !series.length) return <div className="trend trend--empty" />;

  const xTicks = years.length > 8 ? x.ticks(8) : years;
  const [d0, d1] = y.domain();
  const yTicks = NICE.filter(
    (v) => v >= Math.min(d0, d1) && v <= Math.max(d0, d1),
  );
  const fmt = d3.format("~s");
  const cx = currentYear != null ? x(currentYear) : null;

  return (
    <div className="trend">
      <svg className="trend__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        {yTicks.map((tk) => (
          <g key={tk} transform={`translate(0,${y(tk)})`}>
            <line className="trend__grid" x1={M.left} x2={W - M.right} />
            <text
              className="trend__tick"
              x={M.left - 8}
              dy="0.32em"
              textAnchor="end"
            >
              {fmt(tk)}
            </text>
          </g>
        ))}

        <line
          className="trend__axis"
          x1={M.left}
          y1={H - M.bottom}
          x2={W - M.right}
          y2={H - M.bottom}
        />
        {xTicks.map((tk) => (
          <text
            key={tk}
            className="trend__tick"
            x={x(tk)}
            y={H - M.bottom + 22}
            textAnchor="middle"
          >
            {Math.round(tk)}
          </text>
        ))}
        {unit && (
          <text className="trend__axis-title" x={M.left - 44} y={M.top - 10}>
            {unit}
          </text>
        )}

        {series.map((s, i) => {
          const dim = hoverArea && hoverArea !== s.area;
          return (
            <path
              key={s.area}
              className={`trend__line ${dim ? "is-dim" : ""} ${hoverArea === s.area ? "is-on" : ""}`}
              d={line(s.values) || ""}
              stroke={PALETTE[i % PALETTE.length]}
              onMouseEnter={() => setHoverArea(s.area)}
              onMouseLeave={() => setHoverArea(null)}
            />
          );
        })}

        {/* Libellés + connecteurs */}
        {labels.map((it) => (
          <g
            key={it.area}
            className={`trend__label-g ${hoverArea && hoverArea !== it.area ? "is-dim" : ""}`}
            onMouseEnter={() => setHoverArea(it.area)}
            onMouseLeave={() => setHoverArea(null)}
          >
            <line
              className="trend__connector"
              x1={it.xEnd}
              y1={it.yTrue}
              x2={it.xEnd + 8}
              y2={it.yLab}
              stroke={it.color}
            />
            <text
              className="trend__label"
              x={it.xEnd + 12}
              y={it.yLab}
              dy="0.32em"
              fill={it.color}
            >
              {it.name}
            </text>
          </g>
        ))}

        {cx != null && (
          <g className="trend__marker" transform={`translate(${cx},0)`}>
            <line className="trend__marker-line" y1={M.top} y2={H - M.bottom} />
            <text
              className="trend__marker-label"
              y={M.top - 8}
              textAnchor="middle"
            >
              {currentYear}
            </text>
            {series.map((s, i) => {
              const pt = s.values.find(
                (v) => v.year === currentYear && v.value > 0,
              );
              if (!pt) return null;
              return (
                <circle
                  key={s.area}
                  className="trend__marker-dot"
                  cy={y(pt.value)}
                  r={4.5}
                  fill={PALETTE[i % PALETTE.length]}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
