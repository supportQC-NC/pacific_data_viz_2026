// src/components/KpiRow/KpiRow.jsx
// ============================================================
// Rangée de cartes KPI, réutilisable et sans style inline (hors injection de
// custom property dynamique, pattern déjà utilisé dans le projet).
// Chaque item : { key, value, unit, meta, label, note, tone, hero }.
// tone : neutral | accent | warm | positive | negative | secondary | compare
//        | above | below   (les deux derniers = pôles de la rampe divergente)
//
// MAJ : une valeur de KPI peut être un NOMBRE (« 212 ») ou un TEXTE
// (« WINSTON »). Les valeurs textuelles, plus longues, recevaient la même
// énorme typo que les chiffres et débordaient de la carte. On les détecte
// désormais pour leur appliquer un habillage adapté (classe + longueur),
// piloté par le SCSS : chiffres = display XL ; texte = plus petit, multi-ligne.
//
// ── Ajouts issus de l'audit de l'acte 02 ──────────────────────────────────
//
// • `hero` — une carte peut devenir le CHIFFRE PRINCIPAL de l'acte. Quatre
//   KPI de poids strictement identique ne créent aucune hiérarchie : le
//   lecteur ne sait pas lequel porte le message. Une seule carte `hero` par
//   rangée, les autres passent en appui.
//
// • `meta` — champ dédié au qualifiant d'une valeur (un nom de territoire,
//   une année). Il était jusqu'ici passé dans `unit`, ce qui affichait
//   « +1.1 Papouasie-Nouvelle-Guinée » avec le nom en position d'unité —
//   et, sur mobile, un nom sur deux lignes qui écrasait le chiffre.
//
// • tons `secondary` et `negative` — ils étaient utilisés par les pages
//   (Act4, Act6, Act11) mais n'existaient pas dans le SCSS : les cartes
//   concernées sortaient sans couleur, en silence.
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

export default function KpiRow({ items = [], title, compact = false }) {
  if (!items.length) return null;
  const hasHero = items.some((it) => it.hero);
  return (
    <section
      className={`kpi ${compact ? "kpi--compact" : ""} ${hasHero ? "kpi--hero" : ""}`}
      aria-label={title}
    >
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
            className={`kpi__card kpi__card--${it.tone || "neutral"} ${it.hero ? "kpi__card--hero" : ""}`}
          >
            <span className="kpi__bar" aria-hidden="true" />
            <span className={valueClass} style={{ "--kpi-len": v.len }}>
              {it.value}
              {it.unit ? <em className="kpi__unit">{it.unit}</em> : null}
            </span>
            {it.meta ? <span className="kpi__meta">{it.meta}</span> : null}
            <span className="kpi__label">{it.label}</span>
            {it.note ? <span className="kpi__note">{it.note}</span> : null}
          </div>
        );
      })}
    </section>
  );
}
