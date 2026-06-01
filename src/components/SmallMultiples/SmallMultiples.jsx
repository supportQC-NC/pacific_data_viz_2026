// src/components/SmallMultiples/SmallMultiples.jsx
// ============================================================
// Petits multiples : une mini-courbe (sparkline) par territoire, lisible,
// triée par dernière valeur décroissante. Remplace le « spaghetti » des
// courbes superposées quand il y a beaucoup de séries.
// Chaque cellule a sa propre échelle Y (on lit la FORME/tendance) ; la
// comparaison des niveaux entre territoires se fait via la heatmap.
// SCSS only, couleurs via tokens. Aucune dépendance.
// Props :
//   series : [{ area, name, values:[{year,value}] }]
//   years  : [number]  (axe X commun)
//   unit   : string
//   labels : { last } (libellé "dernier point", optionnel)
// ============================================================

import React, { useMemo } from "react";
import "./SmallMultiples.scss";

const W = 120;
const H = 38;
const PAD = 4;

function fmt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("fr-FR");
  return Math.round(v * 10) / 10;
}

function sparkPath(values, minYear, yearSpan, min, max) {
  const span = max - min || 1;
  return values
    .map((p, i) => {
      const x = PAD + ((p.year - minYear) / (yearSpan || 1)) * (W - 2 * PAD);
      const y = H - PAD - ((p.value - min) / span) * (H - 2 * PAD);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function SmallMultiples({ series, years, unit, labels = {} }) {
  const cells = useMemo(() => {
    const minYear = years.length ? years[0] : 0;
    const maxYear = years.length ? years[years.length - 1] : 0;
    const yearSpan = maxYear - minYear;
    return (series || [])
      .filter((s) => s.values && s.values.length >= 2)
      .map((s) => {
        const vals = s.values;
        const ys = vals.map((p) => p.value);
        const min = Math.min(...ys);
        const max = Math.max(...ys);
        const last = vals[vals.length - 1];
        const first = vals[0];
        const trend = last.value - first.value;
        return {
          area: s.area,
          name: s.name,
          last: last.value,
          lastYear: last.year,
          trend,
          d: sparkPath(vals, minYear, yearSpan, min, max),
          lx: PAD + ((last.year - minYear) / (yearSpan || 1)) * (W - 2 * PAD),
          ly: H - PAD - ((last.value - min) / (max - min || 1)) * (H - 2 * PAD),
        };
      })
      .sort((a, b) => b.last - a.last);
  }, [series, years]);

  if (!cells.length) return null;

  return (
    <div className="smallmult">
      {cells.map((c) => (
        <div key={c.area} className={`smallmult__cell ${c.trend < 0 ? "is-down" : "is-up"}`}>
          <div className="smallmult__head">
            <span className="smallmult__name" title={c.name}>{c.name}</span>
            <span className="smallmult__val">
              {fmt(c.last)}
              <span className="smallmult__unit"> {unit}</span>
            </span>
          </div>
          <svg
            className="smallmult__spark"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className="smallmult__area" d={`${c.d} L${c.lx.toFixed(1)},${H} L${PAD},${H} Z`} />
            <path className="smallmult__line" d={c.d} />
            <circle className="smallmult__dot" cx={c.lx} cy={c.ly} r="2.4" />
          </svg>
          <span className="smallmult__foot">
            {labels.last || ""} {c.lastYear}
          </span>
        </div>
      ))}
    </div>
  );
}