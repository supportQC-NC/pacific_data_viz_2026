// src/components/EvolutionPanel/EvolutionPanel.jsx
// ============================================================
// Analyse d'évolution : variation de chaque territoire entre sa
// première et sa dernière année disponibles. Émissions : BAISSE =
// amélioration. Top des plus améliorés / plus dégradés (variation %).
// Barres en SVG (aucun style inline). Contenu via i18n (props).
// Props :
//   series : [{ area, name, values:[{year,value}] }]
//   labels : { improved, worsened, no_data, since }
//   unit   : string
//   topN   : number (défaut 5)
// ============================================================

import React, { useMemo } from "react";
import "./EvolutionPanel.scss";

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const fmtPct = (n) => `${n > 0 ? "+" : ""}${n.toFixed(0)} %`;

export default function EvolutionPanel({
  series = [],
  labels = {},
  unit = "",
  topN = 5,
}) {
  const { improved, worsened, span } = useMemo(() => {
    const rows = series
      .map((s) => {
        const v = s.values.filter(
          (p) => Number.isFinite(p.value) && p.value > 0,
        );
        if (v.length < 2) return null;
        const first = v[0];
        const last = v[v.length - 1];
        const pct = ((last.value - first.value) / first.value) * 100;
        return { area: s.area, name: s.name, first, last, pct };
      })
      .filter(Boolean);
    const byPct = [...rows].sort((a, b) => a.pct - b.pct);
    const fy = rows.length ? Math.min(...rows.map((r) => r.first.year)) : 0;
    const ly = rows.length ? Math.max(...rows.map((r) => r.last.year)) : 0;
    return {
      improved: byPct.slice(0, topN),
      worsened: byPct.slice(-topN).reverse(),
      span: rows.length ? `${fy} – ${ly}` : "",
    };
  }, [series, topN]);

  const maxAbs = useMemo(() => {
    const all = [...improved, ...worsened].map((r) => Math.abs(r.pct));
    return Math.max(1, ...all);
  }, [improved, worsened]);

  if (!series.length || (!improved.length && !worsened.length)) {
    return <p className="evo__empty">{labels.no_data}</p>;
  }

  const Item = ({ r, kind }) => (
    <li className={`evo__item evo__item--${kind}`}>
      <span className="evo__name">{r.name}</span>
      <svg
        className="evo__bar"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          className="evo__bar-track"
          x="0"
          y="2.5"
          width="100"
          height="3"
          rx="1.5"
        />
        <rect
          className={`evo__bar-fill evo__bar-fill--${kind}`}
          x="0"
          y="2"
          width={(Math.abs(r.pct) / maxAbs) * 100}
          height="4"
          rx="2"
        />
      </svg>
      <span className="evo__vals">
        {fmt2(r.first.value)} → {fmt2(r.last.value)}
      </span>
      <span className={`evo__pct evo__pct--${kind}`}>
        {kind === "down" ? "▼" : "▲"} {fmtPct(r.pct)}
      </span>
    </li>
  );

  return (
    <div className="evo">
      <div className="evo__col">
        <h4 className="evo__head evo__head--down">
          {labels.improved}
          {span && (
            <span className="evo__span">
              {labels.since} {span}
            </span>
          )}
        </h4>
        <ul className="evo__list">
          {improved.map((r) => (
            <Item r={r} kind="down" key={r.area} />
          ))}
        </ul>
      </div>
      <div className="evo__col">
        <h4 className="evo__head evo__head--up">
          {labels.worsened}
          {span && (
            <span className="evo__span">
              {labels.since} {span}
            </span>
          )}
        </h4>
        <ul className="evo__list">
          {worsened.map((r) => (
            <Item r={r} kind="up" key={r.area} />
          ))}
        </ul>
      </div>
      {unit && <p className="evo__unit">{unit}</p>}
    </div>
  );
}
