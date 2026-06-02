// src/components/KpiRow/KpiRow.jsx
// ============================================================
// Rangee de cartes KPI, reutilisable et sans style inline.
// Chaque item : { key, value, unit, label, note, tone }.
// tone : neutral | accent | warm | positive | compare (le KPI mondial,
// mis en avant comme reference de comparaison).
// Props : items [], title (pour aria-label).
// ============================================================

import React from "react";
import "./KpiRow.scss";

export default function KpiRow({ items = [], title }) {
  if (!items.length) return null;
  return (
    <section className="kpi" aria-label={title}>
      {items.map((it) => (
        <div key={it.key} className={`kpi__card kpi__card--${it.tone || "neutral"}`}>
          <span className="kpi__bar" aria-hidden="true" />
          <span className="kpi__value">
            {it.value}
            {it.unit ? <em className="kpi__unit">{it.unit}</em> : null}
          </span>
          <span className="kpi__label">{it.label}</span>
          {it.note ? <span className="kpi__note">{it.note}</span> : null}
        </div>
      ))}
    </section>
  );
}