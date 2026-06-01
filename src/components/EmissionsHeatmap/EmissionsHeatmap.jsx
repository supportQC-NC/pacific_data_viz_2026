// src/components/EmissionsHeatmap/EmissionsHeatmap.jsx
// ============================================================
// Heatmap territoire × année. Deux modes pour rester LISIBLE malgré
// l'outlier (Palau, ~10× les autres) :
//  • "row" (défaut) : chaque ligne colorée selon SA PROPRE plage →
//    on lit la trajectoire de chaque territoire ; l'outlier ne domine plus.
//  • "abs" : échelle globale LOGARITHMIQUE → étale les faibles valeurs.
// Couleur des cellules = attribut `fill` calculé (pas de style inline).
// Props : series [{area,name,values:[{year,value}]}], years[], unit,
//         labels {low, high, empty, mode_row, mode_abs}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import "./EmissionsHeatmap.scss";

const VW = 920;
const M = { top: 16, right: 16, bottom: 30, left: 52 };
const ROW_H = 18;
const GAP = 2;
const RAMP = d3.interpolateRgbBasis(["#082a3f", "#0c6f86", "#16c0c8", "#e6e36b", "#ff6b4a"]);

export default function EmissionsHeatmap({ series = [], years = [], unit, labels = {} }) {
  const [hover, setHover] = useState(null);
  const [mode, setMode] = useState("row"); // "row" | "abs"

  const rows = useMemo(() => {
    const last = (s) => s.values[s.values.length - 1]?.value ?? -Infinity;
    return [...series].filter((s) => s.values.length).sort((a, b) => last(b) - last(a));
  }, [series]);

  const rowStats = useMemo(() => {
    const m = {};
    series.forEach((s) => {
      const vs = s.values.map((p) => p.value);
      m[s.area] = { min: d3.min(vs), max: d3.max(vs) };
    });
    return m;
  }, [series]);

  const { gMin, gMax } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    series.forEach((s) =>
      s.values.forEach((p) => {
        if (p.value < mn) mn = p.value;
        if (p.value > mx) mx = p.value;
      }),
    );
    return { gMin: mn === Infinity ? 0.1 : mn, gMax: mx === -Infinity ? 1 : mx };
  }, [series]);

  const tLog = useMemo(
    () => d3.scaleLog().domain([Math.max(0.05, gMin), gMax]).range([0, 1]).clamp(true),
    [gMin, gMax],
  );

  const color = (v, area) => {
    if (!Number.isFinite(v)) return "transparent";
    if (mode === "row") {
      const r = rowStats[area];
      const t = r && r.max > r.min ? (v - r.min) / (r.max - r.min) : 0.5;
      return RAMP(t);
    }
    return RAMP(tLog(Math.max(0.05, v)));
  };

  const innerW = VW - M.left - M.right;
  const cellW = years.length ? innerW / years.length : 0;
  const VH = M.top + M.bottom + rows.length * (ROW_H + GAP);

  const lookup = useMemo(() => {
    const map = {};
    series.forEach((s) => {
      map[s.area] = {};
      s.values.forEach((p) => (map[s.area][p.year] = p.value));
    });
    return map;
  }, [series]);

  if (!rows.length) return <div className="hm hm--empty">{labels.empty}</div>;

  const yearTicks = years.filter((y) => y % 10 === 0);

  return (
    <figure className="hm">
      <div className="hm__bar">
        <div className="hm__modes" role="group">
          <button
            className={`hm__mode ${mode === "row" ? "is-active" : ""}`}
            onClick={() => setMode("row")}
            aria-pressed={mode === "row"}
          >
            {labels.mode_row}
          </button>
          <button
            className={`hm__mode ${mode === "abs" ? "is-active" : ""}`}
            onClick={() => setMode("abs")}
            aria-pressed={mode === "abs"}
          >
            {labels.mode_abs}
          </button>
        </div>
      </div>

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
          {labels.high} <em>{mode === "row" ? `(${labels.mode_row})` : `(${unit}, log)`}</em>
        </span>
        {hover && (
          <span className="hm__detail">
            <strong>{hover.name}</strong> · {hover.year} · {hover.value} {unit}
          </span>
        )}
      </figcaption>
    </figure>
  );
}