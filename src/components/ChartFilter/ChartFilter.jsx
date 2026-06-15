// src/components/ChartFilter/ChartFilter.jsx
// ============================================================
// Filtre compact (libellé + menu déroulant) destiné à un graphe précis —
// pas un filtre global de l'acte. Select natif stylé via tokens (dark/light),
// chevron custom. Aucun style inline en JSX.
// Props : label, value, onChange(value), options [{ value, label }].
// ============================================================

import React from "react";
import "./ChartFilter.scss";

export default function ChartFilter({ label, value, onChange, options = [] }) {
  return (
    <div className="chfilter">
      {label ? <span className="chfilter__label">{label}</span> : null}
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
