// src/components/KpiRow/KpiRow.jsx
// ============================================================
// Rangée de cartes KPI, réutilisable et sans style inline (hors injection de
// custom property dynamique, pattern déjà utilisé dans le projet).
// Chaque item : { key, value, unit, label, note, tone }.
// tone : neutral | accent | warm | positive | compare.
//
// MAJ : une valeur de KPI peut être un NOMBRE (« 212 ») ou un TEXTE
// (« WINSTON »). Les valeurs textuelles, plus longues, recevaient la même
// énorme typo que les chiffres et débordaient de la carte. On les détecte
// désormais pour leur appliquer un habillage adapté (classe + longueur),
// piloté par le SCSS : chiffres = display XL ; texte = plus petit, multi-ligne.
// ============================================================

import React from "react";
import "./KpiRow.scss";

// Décrit une valeur de KPI : numérique vs textuelle + longueur de chaîne.
// On considère « numérique » toute valeur composée de chiffres et de
// séparateurs usuels (espaces, . , % + - — /) contenant au moins un chiffre.
function describeValue(value) {
  const str = value == null ? "" : String(value);
  const isNumeric = /^[\d\s.,%+\-—/]+$/.test(str) && /\d/.test(str);
  return {
    isText: str.length > 0 && !isNumeric,
    len: str.length,
  };
}

export default function KpiRow({ items = [], title }) {
  if (!items.length) return null;
  return (
    <section className="kpi" aria-label={title}>
      {items.map((it) => {
        const v = describeValue(it.value);
        // Classes pilotées par la nature de la valeur ; --kpi-len permet au
        // SCSS d'ajuster finement la taille pour les chaînes très longues.
        const valueClass = [
          "kpi__value",
          v.isText ? "kpi__value--text" : "",
          v.len > 6 ? "kpi__value--long" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={it.key}
            className={`kpi__card kpi__card--${it.tone || "neutral"}`}
          >
            <span className="kpi__bar" aria-hidden="true" />
            <span className={valueClass} style={{ "--kpi-len": v.len }}>
              {it.value}
              {it.unit ? <em className="kpi__unit">{it.unit}</em> : null}
            </span>
            <span className="kpi__label">{it.label}</span>
            {it.note ? <span className="kpi__note">{it.note}</span> : null}
          </div>
        );
      })}
    </section>
  );
}