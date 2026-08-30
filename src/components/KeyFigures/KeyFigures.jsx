// src/components/KeyFigures/KeyFigures.jsx
// ============================================================
// LES CHIFFRES À EMPORTER — deux ou trois par escale, en tête de la colonne.
//
// Onze escales montraient des formes et pas un seul nombre isolé. Un lecteur
// qui n'a pas l'habitude des graphiques repart d'un tableau de bord avec UNE
// phrase et UN chiffre ; il ne repart pas avec une lecture d'axe. Les
// `KpiRow` existaient mais avaient été retirés des escales, et la médiane du
// Pacifique ne vivait plus que dans la synthèse.
//
// Pourquoi un composant à part plutôt que `KpiRow` :
//   • `KpiRow` est une rangée de cartes pleine largeur, pensée pour un hero de
//     1200 px. Dans une colonne de 230 px, ses cartes se réduisent à des
//     vignettes et le chiffre perd exactement ce qui le rend mémorable — sa
//     taille.
//   • Ici les chiffres s'empilent, l'un sous l'autre, et le premier est plus
//     gros que les suivants : trois chiffres de poids identique ne créent
//     aucune hiérarchie, et le lecteur ne sait pas lequel porte le message.
//
// Ils sont propres à l'ESCALE, pas à la vue : ils ne bougent pas quand on
// change d'onglet. C'est le point d'ancrage, ce qui reste vrai pendant tout
// le passage — un repère qui changerait à chaque clic n'en serait pas un.
//
// Aucun chiffre n'est écrit en dur : les pages les calculent depuis les
// séries chargées, comme le reste de l'escale.
//
// Props : items [{ value, unit, label, meta }] — 1 à 3, au-delà on tronque.
// ============================================================

import React from "react";
import "./KeyFigures.scss";

const MAX = 3;

export default function KeyFigures({ items = [], label }) {
  const rows = (items || [])
    .filter((it) => it && it.value != null && it.value !== "")
    .slice(0, MAX);
  if (!rows.length) return null;

  return (
    <section className="keyfig" aria-label={label}>
      <ul className="keyfig__list">
        {rows.map((it, i) => (
          <li
            className={`keyfig__item ${i === 0 ? "is-lead" : ""}`}
            key={`${it.label}-${i}`}
          >
            <p className="keyfig__value">
              {it.value}
              {it.unit ? (
                <span className="keyfig__unit"> {it.unit}</span>
              ) : null}
            </p>
            <p className="keyfig__label">
              {it.label}
              {/* Le qualifiant — un territoire, une année — reste distinct du
                  libellé : collé à l'unité il se lisait comme une unité. */}
              {it.meta ? (
                <span className="keyfig__meta"> · {it.meta}</span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
