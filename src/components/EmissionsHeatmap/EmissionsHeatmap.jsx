// src/components/EmissionsHeatmap/EmissionsHeatmap.jsx
// ============================================================
// Heatmap territoire x annee. NORMALISATION PAR LIGNE : chaque territoire
// est colore sur SA PROPRE plage min->max, donc l'outlier (Palau, NC) ne
// domine plus et on lit la TRAJECTOIRE de chacun. Rampe semantique
// vert (ses annees les plus basses) -> cyan -> rouge (ses pics).
// Valeurs brutes par habitant (aucune transformation) ; fill calcule.
// Props : series [{area,name,values:[{year,value}]}], years[], unit,
//         labels {low, high, empty}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./EmissionsHeatmap.scss";

const VW = 920;
const M = { top: 16, right: 16, bottom: 30, left: 52 };
const ROW_H = 18;
const GAP = 2;

// Lit un token CSS au runtime (avec repli si indisponible).
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

  // Plage propre a chaque territoire (pour la normalisation par ligne).
  const rowStats = useMemo(() => {
    const m = {};
    series.forEach((s) => {
      const vs = s.values.map((p) => p.value).filter((v) => Number.isFinite(v));
      m[s.area] = { min: d3.min(vs), max: d3.max(vs) };
    });
    return m;
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

  // Rampe semantique vert -> cyan -> rouge (lue depuis les tokens CSS).
  const ramp = useMemo(() => {
    const green = cssVar("--c-positive", "#25e09a");
    const cyan = cssVar("--c-accent", "#00e6ff");
    const red = cssVar("--c-negative", "#ff4d6d");
    return d3.interpolateRgbBasis([green, cyan, red]);
  }, []);

  const color = (v, area) => {
    if (!Number.isFinite(v)) return "transparent";
    const r = rowStats[area];
    const t = r && r.max > r.min ? (v - r.min) / (r.max - r.min) : 0.5;
    return ramp(t);
  };

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
              <text className="hm__rowlbl" x={M.left - 8} y={ry + ROW_H / 2} dy="0.32em">
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
                    fill={color(v, s.area)}
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
          <span className="hm__legend-bar" aria-hidden="true" />
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