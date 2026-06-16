// src/components/charts/EmissionsGap/EmissionsGap.jsx
// ============================================================
// « Émetteurs modestes, en première ligne » — comparaison en damier (waffle).
// 1 carré = 1 t éq. CO₂ / hab. La médiane du Pacifique = un seul carré ; le
// plus gros émetteur par habitant = presque tout le damier. L'écart (×N) est
// affiché en grand. Remplissage en cascade. SVG-free, tokens du thème.
// Données : rows = [médiane, max] ({label, value, color}). Libellés en props.
// ============================================================

import React, { useMemo } from "react";
import "./EmissionsGap.scss";

const COLS = 10;
const MAX_CELLS = 180;

function Waffle({ total, filled, color, cols }) {
  return (
    <div className="gap__waffle" style={{ "--cols": cols }}>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            className={`gap__cell ${on ? "is-on" : ""}`}
            style={
              on
                ? { "--c": color, "--d": `${Math.min(i * 7, 900)}ms` }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

export default function EmissionsGap({
  rows = [],
  unit = "",
  cellLabel = "",
  ratioCaption = "",
}) {
  const med = rows[0] || { label: "", value: 0, color: "" };
  const max = rows[1] || { label: "", value: 0, color: "" };

  const { total, medCells, maxCells, ratio } = useMemo(() => {
    const mx = Math.max(max.value, 0);
    const mCells = Math.max(1, Math.min(MAX_CELLS, Math.round(mx)));
    const rows2 = Math.ceil(mCells / COLS);
    const tot = rows2 * COLS;
    const medC = Math.max(1, Math.round(med.value));
    const r = med.value > 0 ? Math.round(max.value / med.value) : 0;
    return { total: tot, medCells: medC, maxCells: mCells, ratio: r };
  }, [med.value, max.value]);

  const fmt = (v) => v.toFixed(2);

  return (
    <figure className="gap">
      <p className="gap__legend">{cellLabel}</p>

      <div className="gap__cols">
        <div className="gap__col">
          <p className="gap__name">{med.label}</p>
          <p className="gap__value" style={{ "--c": med.color }}>
            {fmt(med.value)} <span className="gap__unit">{unit}</span>
          </p>
          <Waffle total={total} filled={medCells} color={med.color} cols={COLS} />
        </div>

        <div className="gap__col">
          <p className="gap__name">{max.label}</p>
          <p className="gap__value" style={{ "--c": max.color }}>
            {fmt(max.value)} <span className="gap__unit">{unit}</span>
          </p>
          <Waffle total={total} filled={maxCells} color={max.color} cols={COLS} />
        </div>
      </div>

      {ratio > 1 ? (
        <p className="gap__ratio">
          <span className="gap__ratio-num">×{ratio}</span>
          <span className="gap__ratio-cap">{ratioCaption}</span>
        </p>
      ) : null}
    </figure>
  );
}