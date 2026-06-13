// src/components/TrendLines/TrendLines.jsx
// ============================================================
// Trajectoires temporelles — réutilisable, lisible.
// • Échelle Y ADAPTATIVE : linéaire pour les plages serrées (%, indices),
//   logarithmique seulement quand l'amplitude couvre plusieurs ordres de
//   grandeur. Graduations chiffrées TOUJOURS générées depuis l'échelle.
// • Libellés de fin DÉ-CHEVAUCHÉS (algo glouton) + connecteurs ; marge droite
//   assez large pour les noms longs (territoires).
// • FOCUS d'une courbe :
//     – survol → elle ressort, les autres s'atténuent (transitoire) ;
//     – CLIC → on l'ÉPINGLE (focus persistant) pour l'étudier sur toute la
//       période ; reclic ou clic dans le vide → on relâche.
//     La courbe focalisée passe AU PREMIER PLAN (plus de masquage).
// • Curseur d'année vertical qui glisse + points qui suivent.
// Props : series [{area,name,values:[{year,value}]}], years[], currentYear, unit
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./TrendLines.scss";

const W = 1000;
const H = 380;
const M = { top: 26, right: 198, bottom: 40, left: 64 };
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
const NICE_LOG = [
  0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500, 1000, 2000, 5000,
];

export default function TrendLines({
  series = [],
  years = [],
  currentYear,
  unit,
}) {
  const [hoverArea, setHoverArea] = useState(null);
  const [pinnedArea, setPinnedArea] = useState(null);

  // Si la série épinglée disparaît (changement de culture/filtre), on relâche.
  const pinned = useMemo(
    () =>
      pinnedArea && series.some((s) => s.area === pinnedArea)
        ? pinnedArea
        : null,
    [pinnedArea, series],
  );
  // Focus effectif : l'épingle prime sur le survol.
  const focusArea = pinned || hoverArea;

  const togglePin = (area) => setPinnedArea((p) => (p === area ? null : area));

  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(d3.extent(years.length ? years : [0, 1]))
        .range([M.left, W - M.right]),
    [years],
  );

  const { y, valid, useLog } = useMemo(() => {
    const all = series
      .flatMap((s) => s.values.map((v) => v.value))
      .filter((v) => Number.isFinite(v));
    if (!all.length) return { y: null, valid: false, useLog: false };
    const yMin = d3.min(all);
    const yMax = d3.max(all);
    // log seulement si tout est positif ET l'amplitude couvre >~1,5 ordre de grandeur
    const dynamic = yMin > 0 ? yMax / yMin : Infinity;
    const log = yMin > 0 && dynamic >= 30;
    let scale;
    if (log) {
      scale = d3
        .scaleLog()
        .domain([Math.max(0.05, yMin * 0.85), yMax * 1.15])
        .range([H - M.bottom, M.top])
        .clamp(true);
    } else {
      const pad = (yMax - yMin) * 0.12 || Math.abs(yMax) * 0.1 || 1;
      scale = d3
        .scaleLinear()
        .domain([yMin - pad, yMax + pad])
        .nice()
        .range([H - M.bottom, M.top]);
    }
    return { y: scale, valid: true, useLog: log };
  }, [series]);

  const line = useMemo(
    () =>
      d3
        .line()
        .defined((d) => Number.isFinite(d.value) && (!useLog || d.value > 0))
        .x((d) => x(d.year))
        .y((d) => (y ? y(d.value) : 0))
        .curve(d3.curveMonotoneX),
    [x, y, useLog],
  );

  // Libellés de fin dé-chevauchés.
  const labels = useMemo(() => {
    if (!y) return [];
    const items = series
      .map((s, i) => {
        const last = [...s.values]
          .reverse()
          .find((v) => Number.isFinite(v.value) && (!useLog || v.value > 0));
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
    const MIN = 18;
    items.forEach((it, k) => {
      it.yLab =
        k === 0 ? it.yTrue : Math.max(it.yTrue, items[k - 1].yLab + MIN);
    });
    const overflow = (items[items.length - 1]?.yLab ?? 0) - (H - M.bottom);
    if (overflow > 0)
      items.forEach((it) => {
        it.yLab -= overflow;
      });
    return items;
  }, [series, x, y, useLog]);

  if (!valid || !series.length) return <div className="trend trend--empty" />;

  const xTicks = years.length > 8 ? x.ticks(8) : years;
  const [d0, d1] = y.domain();
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  const yTicks = useLog
    ? NICE_LOG.filter((v) => v >= lo && v <= hi)
    : y.ticks(6);
  // format lisible : entiers tels quels, décimaux courts, milliers compacts
  const fmt = (v) => {
    if (Math.abs(v) >= 1000) return d3.format("~s")(v);
    if (Number.isInteger(v)) return String(v);
    return d3.format("~r")(v);
  };
  const cx = currentYear != null ? x(currentYear) : null;

  // Ordre de tracé : la courbe focalisée est dessinée EN DERNIER (au-dessus).
  const drawOrder = series
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) =>
        (focusArea === a.s.area ? 1 : 0) - (focusArea === b.s.area ? 1 : 0),
    );

  return (
    <div className={`trend ${pinned ? "trend--pinned" : ""}`}>
      <svg
        className="trend__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onClick={() => setPinnedArea(null)}
      >
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
          <text className="trend__axis-title" x={M.left - 52} y={M.top - 10}>
            {unit}
          </text>
        )}

        {drawOrder.map(({ s, i }) => {
          const dim = focusArea && focusArea !== s.area;
          const on = focusArea === s.area;
          return (
            <path
              key={s.area}
              className={`trend__line ${dim ? "is-dim" : ""} ${on ? "is-on" : ""} ${
                pinned === s.area ? "is-pinned" : ""
              }`}
              d={line(s.values) || ""}
              stroke={PALETTE[i % PALETTE.length]}
              onMouseEnter={() => setHoverArea(s.area)}
              onMouseLeave={() => setHoverArea(null)}
              onClick={(e) => {
                e.stopPropagation();
                togglePin(s.area);
              }}
            />
          );
        })}

        {/* Libellés + connecteurs (cliquables eux aussi → épinglent). */}
        {labels.map((it) => (
          <g
            key={it.area}
            className={`trend__label-g ${focusArea && focusArea !== it.area ? "is-dim" : ""} ${
              pinned === it.area ? "is-pinned" : ""
            }`}
            onMouseEnter={() => setHoverArea(it.area)}
            onMouseLeave={() => setHoverArea(null)}
            onClick={(e) => {
              e.stopPropagation();
              togglePin(it.area);
            }}
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
            {drawOrder.map(({ s, i }) => {
              const pt = s.values.find(
                (v) =>
                  v.year === currentYear &&
                  Number.isFinite(v.value) &&
                  (!useLog || v.value > 0),
              );
              if (!pt) return null;
              const dim = focusArea && focusArea !== s.area;
              return (
                <circle
                  key={s.area}
                  className={`trend__marker-dot ${dim ? "is-dim" : ""}`}
                  cy={y(pt.value)}
                  r={focusArea === s.area ? 5.5 : 4.5}
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
