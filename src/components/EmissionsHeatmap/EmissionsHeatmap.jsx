// src/components/EmissionsHeatmap/EmissionsHeatmap.jsx
// ============================================================
// Heatmap territoire x annee. Rampe SEQUENTIELLE propre (intensite) :
// cyan (faible/frais) -> vert -> ambre -> rouge (eleve/chaud), echelle
// LOGARITHMIQUE (les emissions couvrent ~3 ordres de grandeur). Couleurs
// lues sur les tokens ; legende = degrade SVG identique a l'echelle
// (pas de style inline).
// Props : series [{area,name,values:[{year,value}]}], years[], unit,
//         labels {low, high, empty}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./EmissionsHeatmap.scss";

const VW = 920;
const M = { top: 16, right: 16, bottom: 30, left: 60 };
const ROW_H = 18;
const GAP = 2;

function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function EmissionsHeatmap({
  series = [],
  years = [],
  unit,
  labels = {},
}) {
  const [hover, setHover] = useState(null);

  const rows = useMemo(() => {
    const last = (s) => s.values[s.values.length - 1]?.value ?? -Infinity;
    return [...series]
      .filter((s) => s.values.length)
      .sort((a, b) => last(b) - last(a));
  }, [series]);

  const lookup = useMemo(() => {
    const map = {};
    series.forEach((s) => {
      map[s.area] = {};
      s.values.forEach((p) => {
        map[s.area][p.year] = p.value;
      });
    });
    return map;
  }, [series]);

  // Palette sequentielle frais -> chaud (tokens).
  const palette = useMemo(
    () => [
      cssVar("--c-accent", "#00e6ff"),
      cssVar("--c-positive", "#25e09a"),
      cssVar("--c-warm", "#f5a623"),
      cssVar("--c-negative", "#ff4d6d"),
    ],
    [],
  );

  // Echelle sequentielle LOGARITHMIQUE (les emissions couvrent ~3 ordres de
  // grandeur : 0,1 a 86 t/hab). Domaine borne aux quantiles 3% / 90% pour
  // etaler la masse des petits territoires ; les plus eleves saturent (rouge).
  const color = useMemo(() => {
    const all = [];
    series.forEach((s) => {
      s.values.forEach((p) => {
        if (Number.isFinite(p.value) && p.value > 0) all.push(p.value);
      });
    });
    const interp = d3.interpolateRgbBasis(palette);
    if (!all.length) return () => "transparent";
    const sorted = all.slice().sort((a, b) => a - b);
    const lo = Math.max(d3.quantile(sorted, 0.03) ?? sorted[0], 1e-3);
    let hi = d3.quantile(sorted, 0.9) ?? sorted[sorted.length - 1];
    if (!(hi > lo)) hi = lo * 10;
    const t = d3.scaleLog().domain([lo, hi]).range([0, 1]).clamp(true);
    return (v) =>
      Number.isFinite(v) && v > 0 ? interp(t(v)) : "transparent";
  }, [series, palette]);

  const innerW = VW - M.left - M.right;
  const cellW = years.length ? innerW / years.length : 0;
  const VH = M.top + M.bottom + rows.length * (ROW_H + GAP);

  if (!rows.length) return <div className="hm hm--empty">{labels.empty}</div>;

  const yearTicks = years.filter((y) => y % 10 === 0);

  return (
    <figure className="hm">
      <svg className="hm__svg" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img">
        {rows.map((s, ri) => {
          const ry = M.top + ri * (ROW_H + GAP);
          return (
            <g key={s.area}>
              <text className="hm__rowlbl" x={M.left - 10} y={ry + ROW_H / 2} dy="0.32em">
                {s.area}
              </text>
              {years.map((yr, ci) => {
                const v = lookup[s.area]?.[yr];
                if (!Number.isFinite(v)) return null;
                const on = hover && hover.area === s.area && hover.year === yr;
                return (
                  <rect
                    key={yr}
                    className={`hm__cell ${on ? "is-on" : ""}`}
                    x={M.left + ci * cellW}
                    y={ry}
                    width={Math.max(1, cellW - 0.5)}
                    height={ROW_H}
                    fill={color(v)}
                    onMouseEnter={() => setHover({ area: s.area, name: s.name, year: yr, value: v })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
          );
        })}

        {yearTicks.map((yr) => {
          const ci = years.indexOf(yr);
          return (
            <text key={yr} className="hm__yearlbl" x={M.left + ci * cellW} y={VH - 10}>
              {yr}
            </text>
          );
        })}
      </svg>

      <figcaption className="hm__foot">
        <span className="hm__legend">
          {labels.low}
          <svg className="hm__legend-grad" width="130" height="10" viewBox="0 0 130 10" aria-hidden="true" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hm-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={palette[0]} />
                <stop offset="40%" stopColor={palette[1]} />
                <stop offset="72%" stopColor={palette[2]} />
                <stop offset="100%" stopColor={palette[3]} />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="130" height="10" rx="5" fill="url(#hm-grad)" />
          </svg>
          {labels.high}
          {unit ? <em>{unit}</em> : null}
        </span>
        {hover && (
          <span className="hm__detail">
            <strong>{hover.name}</strong> {"\u00b7"} {hover.year} {"\u00b7"}{" "}
            {hover.value} {unit}
          </span>
        )}
      </figcaption>
    </figure>
  );
}