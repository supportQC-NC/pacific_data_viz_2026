// src/components/EmissionsHeatmap/EmissionsHeatmap.jsx
// ============================================================
// Heatmap territoire x annee. Couleur SEMANTIQUE divergente centree sur
// la mediane Pacifique : sous la mediane = vert (favorable), a la mediane
// = cyan (neutre/identite), au-dessus = rouge (defavorable). La borne haute
// est ecretee (90e centile) pour que l'outlier ne sature pas la matrice.
// Valeurs brutes par habitant (aucune transformation) ; seule la couleur
// compare a la mediane. Fill calcule (pas de style inline).
// Props : series [{area,name,values:[{year,value}]}], years[], unit,
//         labels {low, high, empty}, refValue (optionnel), refLabel (opt.)
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
  refValue = null,
  refLabel = null,
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

  // Echelle divergente centree sur la mediane (ou refValue si fournie).
  const scale = useMemo(() => {
    const all = [];
    series.forEach((s) => {
      s.values.forEach((p) => {
        if (Number.isFinite(p.value)) all.push(p.value);
      });
    });
    const green = cssVar("--c-positive", "#25e09a");
    const cyan = cssVar("--c-accent", "#00e6ff");
    const red = cssVar("--c-negative", "#ff4d6d");
    const interp = d3.interpolateRgbBasis([green, cyan, red]);
    if (!all.length) {
      return d3.scaleDiverging().domain([0, 0.5, 1]).interpolator(interp);
    }
    const sorted = all.slice().sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const med =
      refValue != null && Number.isFinite(refValue)
        ? refValue
        : d3.median(sorted);
    const p90 = d3.quantile(sorted, 0.9) ?? max;
    let lo = min;
    let pivot = med;
    let hi = Math.max(pivot * 1.5, p90, pivot + 1e-6);
    if (!(lo < pivot)) lo = pivot - Math.max(1e-6, Math.abs(pivot) * 0.5);
    if (!(pivot < hi)) hi = pivot + Math.max(1e-6, Math.abs(pivot) * 0.5);
    return d3
      .scaleDiverging()
      .domain([lo, pivot, hi])
      .interpolator(interp)
      .clamp(true);
  }, [series, refValue]);

  const color = (v) => (Number.isFinite(v) ? scale(v) : "transparent");

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
          <span className="hm__legend-bar" aria-hidden="true" />
          {labels.high}
          {unit ? <em>{unit}</em> : null}
          {refLabel ? <em className="hm__legend-ref">{refLabel}</em> : null}
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