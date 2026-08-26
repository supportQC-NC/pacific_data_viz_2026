// src/components/VoyageBar/VoyageBar.jsx
// ============================================================
// BARRE DE VOYAGE — persistante pendant une escale du Récit.
//
// Répond à un cul-de-sac réel : une fois entré dans une escale, le Récit
// n'offrait AUCUNE sortie ni continuation. Le Header restait techniquement
// visible (position: fixed), mais partir par le menu, c'est abandonner le
// voyage — pas le poursuivre.
//
// Trois zones, comme <ActBar> côté actes (même grammaire, pour que le
// lecteur n'ait qu'un seul langage à apprendre) :
//   gauche  · quitter le voyage
//   centre  · où l'on en est (« Escale 02 / 12 »)
//   droite  · escale suivante (ou clôture, à la dernière)
//
// Aucun style inline ; tokens uniquement. Handlers fournis par la coque.
// ============================================================

import React from "react";
import "./VoyageBar.scss";

export default function VoyageBar({
  index,
  total,
  label,
  nextLabel,
  exitLabel,
  progressAria,
  onNext,
  onExit,
}) {
  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

  return (
    <nav className="voyagebar" aria-label={label}>
      <button type="button" className="voyagebar__exit" onClick={onExit}>
        <span aria-hidden="true">✕</span> {exitLabel}
      </button>

      <div
        className="voyagebar__progress"
        role="progressbar"
        aria-valuenow={index}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={progressAria}
      >
        <span className="voyagebar__count">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <span className="voyagebar__track">
          {/* Largeur portée par une custom property : zéro style inline. */}
          <span
            className="voyagebar__fill"
            ref={(el) => el && el.style.setProperty("--pct", `${pct}%`)}
          />
        </span>
      </div>

      {onNext ? (
        <button type="button" className="voyagebar__next" onClick={onNext}>
          {nextLabel} <span aria-hidden="true">→</span>
        </button>
      ) : (
        <span className="voyagebar__next voyagebar__next--empty" />
      )}
    </nav>
  );
}
