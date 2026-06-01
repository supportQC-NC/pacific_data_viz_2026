// src/components/DumbbellChart/DumbbellChart.jsx
// ============================================================
// Comparaison AVANT / APRÈS : un « haltère » par territoire, reliant la
// valeur de l'année A (point creux) à celle de l'année B (point plein).
// Échelle partagée → on compare les niveaux d'un coup d'œil ; couleur du
// trait selon la direction (hausse = accent, baisse = chaud).
// Barres/positions en SVG (aucun style inline). Couleurs via tokens.
// Props :
//   rows    : [{ area, name, a, b }]  (a = année A, b = année B)
//   yearA   : number
//   yearB   : number
//   unit    : string
//   labels  : { up, down } (optionnel, pour le pied de légende)
//   controls: node (sélecteurs d'années, rendus au-dessus)
// ============================================================

import React, { useMemo } from "react";
import "./DumbbellChart.scss";

function fmt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("fr-FR");
}

export default function DumbbellChart({ rows, yearA, yearB, unit, labels = {}, controls = null }) {
  const { data, min, max } = useMemo(() => {
    const valid = (rows || []).filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
    const all = valid.flatMap((r) => [r.a, r.b]);
    const mn = all.length ? Math.min(...all) : 0;
    const mx = all.length ? Math.max(...all) : 1;
    const sorted = [...valid].sort((x, y) => y.b - x.b);
    return { data: sorted, min: mn, max: mx };
  }, [rows]);

  if (!data.length) return null;
  const span = max - min || 1;
  const x = (v) => 2 + ((v - min) / span) * 96;

  return (
    <div className="dumbbell">
      {controls && <div className="dumbbell__controls">{controls}</div>}

      <div className="dumbbell__legend">
        <span className="dumbbell__leg-item">
          <span className="dumbbell__leg-dot dumbbell__leg-dot--a" /> {yearA}
        </span>
        <span className="dumbbell__leg-item">
          <span className="dumbbell__leg-dot dumbbell__leg-dot--b" /> {yearB}
        </span>
      </div>

      <ul className="dumbbell__list">
        {data.map((r) => {
          const up = r.b >= r.a;
          return (
            <li key={r.area} className={`dumbbell__row ${up ? "is-up" : "is-down"}`}>
              <span className="dumbbell__name" title={r.name}>{r.name}</span>
              <svg className="dumbbell__track" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                <line className="dumbbell__bar" x1={x(r.a)} y1="5" x2={x(r.b)} y2="5" />
                <circle className="dumbbell__pt dumbbell__pt--a" cx={x(r.a)} cy="5" r="2.6" />
                <circle className="dumbbell__pt dumbbell__pt--b" cx={x(r.b)} cy="5" r="2.6" />
              </svg>
              <span className="dumbbell__vals">
                {fmt(r.a)} → {fmt(r.b)}
                <span className="dumbbell__unit"> {unit}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {(labels.up || labels.down) && (
        <p className="dumbbell__foot">
          <span className="dumbbell__foot-up">▲ {labels.up}</span>
          {"  ·  "}
          <span className="dumbbell__foot-down">▼ {labels.down}</span>
        </p>
      )}
    </div>
  );
}