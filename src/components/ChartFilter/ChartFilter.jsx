// src/components/ChartFilter/ChartFilter.jsx
// ============================================================
// Filtre compact (libellé + menu déroulant) destiné à un graphe précis —
// pas un filtre global de l'acte. Select natif stylé via tokens (dark/light),
// chevron custom. Aucun style inline en JSX.
// Props : label, value, onChange(value), options [{ value, label }], hideLabel.
//
// `hideLabel` masque VISUELLEMENT le libellé sans le retirer de
// l'accessibilité : dans une barre d'outils, « Filtrer par sous-région »
// occupait plus de largeur que le menu lui-même alors que les options
// (« Toutes les sous-régions », « Mélanésie »…) se comprennent seules. Le
// libellé reste porté par `aria-label` pour les lecteurs d'écran.
// ============================================================

import React from "react";
import "./ChartFilter.scss";

export default function ChartFilter({
  label,
  value,
  onChange,
  options = [],
  hideLabel = false,
}) {
  return (
    <div className="chfilter">
      {label && !hideLabel ? (
        <span className="chfilter__label">{label}</span>
      ) : null}
      <div className="chfilter__selwrap">
        <select
          className="chfilter__select"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          aria-label={label || undefined}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="chfilter__chev" aria-hidden="true">
          ▾
        </span>
      </div>
    </div>
  );
}
