// src/components/CropRanking/CropRanking.jsx
// ============================================================
// Classement horizontal des cultures par rendement (dernière année), avec
// l'icône de chaque culture. Lisible, trié, barres proportionnelles.
// Barres en SVG (aucun style inline). Couleurs via tokens SCSS.
// Props :
//   rows  : [{ code, label, value, year }] (trié décroissant en interne)
//   unit  : string
//   max   : nombre de lignes max (def 12)
// ============================================================

import React, { useMemo } from "react";
import CropIcon from "../CropIcons/CropIcons";
import "./CropRanking.scss";

function fmt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("fr-FR");
}

export default function CropRanking({ rows, unit, max = 12 }) {
  const data = useMemo(() => {
    const sorted = [...(rows || [])]
      .filter((r) => Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, max);
    const top = sorted.length ? sorted[0].value : 1;
    return sorted.map((r) => ({ ...r, pct: Math.max(2, (r.value / (top || 1)) * 100) }));
  }, [rows, max]);

  if (!data.length) return null;

  return (
    <ol className="croprank">
      {data.map((r, i) => (
        <li key={r.code} className="croprank__row">
          <span className="croprank__rank">{i + 1}</span>
          <CropIcon label={r.label} className="croprank__icon" />
          <span className="croprank__label" title={r.label}>{r.label}</span>
          <svg className="croprank__bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect className="croprank__bar-bg" x="0" y="0" width="100" height="8" rx="4" />
            <rect className="croprank__bar-fill" x="0" y="0" width={r.pct} height="8" rx="4" />
          </svg>
          <span className="croprank__val">
            {fmt(r.value)}<span className="croprank__unit"> {unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}