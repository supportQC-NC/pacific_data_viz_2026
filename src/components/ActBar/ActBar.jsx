// src/components/ActBar/ActBar.jsx
// ============================================================
// Barre d'acte PERSISTANTE — navigation inter-actes toujours visible.
// Le Header global étant masqué en mode immersif, cette barre sticky
// garantit qu'on peut TOUJOURS atteindre l'acte précédent / suivant.
//   • Gauche  : acte précédent (chevron + titre tronqué).
//   • Centre  : TITRE de l'acte (typo display) + jauge de progression « n / total ».
//   • Droite  : acte suivant (titre tronqué + chevron).
// 100 % présentational : libellés et cibles fournis par le parent (ActBoard).
// La seule valeur « inline » est l'injection d'une custom property dynamique
// (--actbar-pct), pattern déjà utilisé dans le projet pour le data-driven.
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./ActBar.scss";

export default function ActBar({
  prev = null, // { to, label } | null  — acte précédent
  next = null, // { to, label } | null  — acte suivant
  title, // titre de l'acte (centre), ex. « La terre nourricière »
  index, // position courante (1-based)
  total, // nombre total d'actes
  navAria, // libellé aria de la nav
  progressAria, // libellé aria de la progression
}) {
  // Fraction de progression pour la jauge (0 → 100). Garde-fous si props absentes.
  const hasProgress =
    Number.isFinite(index) && Number.isFinite(total) && total > 0;
  const pct = hasProgress ? Math.min(100, Math.max(0, (index / total) * 100)) : 0;

  return (
    <nav className="actbar" aria-label={navAria}>
      <div className="actbar__inner container">
        {/* ---- Acte précédent (ou placeholder désactivé sur le 1er acte) ---- */}
        {prev ? (
          <Link to={prev.to} className="actbar__side actbar__side--prev">
            <FiChevronLeft className="actbar__chev" aria-hidden="true" />
            <span className="actbar__side-text">{prev.label}</span>
          </Link>
        ) : (
          <span
            className="actbar__side actbar__side--disabled"
            aria-hidden="true"
          >
            <FiChevronLeft className="actbar__chev" />
          </span>
        )}

        {/* ---- Centre : titre de l'acte + progression ---- */}
        <div className="actbar__center">
          {title ? <span className="actbar__title">{title}</span> : null}
          {hasProgress ? (
            <span
              className="actbar__progress"
              role="img"
              aria-label={`${progressAria}: ${index} / ${total}`}
            >
              <span className="actbar__progress-num">
                {String(index).padStart(2, "0")}
                <span className="actbar__progress-sep"> / </span>
                {String(total).padStart(2, "0")}
              </span>
              <span className="actbar__meter" aria-hidden="true">
                <span
                  className="actbar__meter-fill"
                  style={{ "--actbar-pct": `${pct}%` }}
                />
              </span>
            </span>
          ) : null}
        </div>

        {/* ---- Acte suivant (ou placeholder désactivé sur le dernier acte) ---- */}
        {next ? (
          <Link to={next.to} className="actbar__side actbar__side--next">
            <span className="actbar__side-text">{next.label}</span>
            <FiChevronRight className="actbar__chev" aria-hidden="true" />
          </Link>
        ) : (
          <span
            className="actbar__side actbar__side--disabled"
            aria-hidden="true"
          >
            <FiChevronRight className="actbar__chev" />
          </span>
        )}
      </div>
    </nav>
  );
}