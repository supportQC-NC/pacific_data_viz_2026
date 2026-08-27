// src/components/EscaleBar/EscaleBar.jsx
// ============================================================
// BARRE D'ESCALE — la navigation d'une escale, en UNE seule rangée.
// Brique partagée par toutes les escales du voyage.
//
// Pourquoi elle existe : le board empilait DEUX en-têtes.
//   1. la barre d'acte  — escale précédente · titre · progression · suivante
//   2. la barre d'outils — vues de l'escale · filtre · aide · données
// Deux bandes pleine largeur, deux fonds, deux filets : le lecteur voyait
// deux en-têtes concurrents avant d'atteindre le moindre chiffre, et le
// graphique perdait une centaine de pixels pour rien.
//
// Ici tout tient sur une ligne, en trois zones et un seul sens de lecture :
//
//   [‹]  OÙ JE SUIS          CE QUE JE REGARDE            AVEC QUOI    [›]
//        titre · n/total     vues de l'escale             filtre · ? · i
//
// Les deux niveaux ne se ressemblent pas : la navigation entre ESCALES est
// aux extrémités (chevrons), la navigation entre VUES est au centre. On ne
// les confond pas, et pourtant elles cohabitent.
//
// 100 % présentationnel : aucun libellé en dur, tout vient du parent.
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./EscaleBar.scss";

export default function EscaleBar({
  prev = null, // { to, label } — escale précédente
  next = null, // { to, label } — escale suivante
  title, // titre de l'escale
  index, // position (1-based)
  total, // nombre d'escales
  navAria,
  progressAria,
  onExit = null,
  exitLabel = "",
  children, // les contrôles de vue (onglets, filtre, aide, données)
}) {
  const hasProgress =
    Number.isFinite(index) && Number.isFinite(total) && total > 0;
  const pct = hasProgress ? Math.min(100, Math.max(0, (index / total) * 100)) : 0;

  // Les chevrons portent le titre de l'escale voisine en infobulle plutôt
  // qu'à l'écran : à l'écran il volait la place des vues, et il n'apporte
  // rien tant qu'on n'a pas décidé de partir.
  const arrow = (side, target) => {
    const isPrev = side === "prev";
    const Icon = isPrev ? FiChevronLeft : FiChevronRight;
    if (!target) {
      return (
        <span
          className={`escbar__arrow escbar__arrow--${side} is-disabled`}
          aria-hidden="true"
        >
          <Icon />
        </span>
      );
    }
    return (
      <Link
        to={target.to}
        className={`escbar__arrow escbar__arrow--${side}`}
        title={target.label}
        aria-label={target.label}
      >
        <Icon aria-hidden="true" />
      </Link>
    );
  };

  return (
    <nav className="escbar" aria-label={navAria}>
      <div className="escbar__inner container">
        {arrow("prev", prev)}

        {/* ---- OÙ JE SUIS ---- */}
        <div className="escbar__where">
          {title ? <span className="escbar__title">{title}</span> : null}
          {hasProgress ? (
            <span
              className="escbar__progress"
              aria-label={progressAria}
              ref={(el) => {
                if (el) el.style.setProperty("--escbar-pct", `${pct}%`);
              }}
            >
              <span className="escbar__count">
                {String(index).padStart(2, "0")}
                <i aria-hidden="true">/</i>
                {String(total).padStart(2, "0")}
              </span>
              <span className="escbar__meter" aria-hidden="true">
                <span className="escbar__meter-fill" />
              </span>
            </span>
          ) : null}
        </div>

        {/* ---- CE QUE JE REGARDE + AVEC QUOI ---- */}
        <div className="escbar__views">{children}</div>

        {onExit && exitLabel ? (
          <button type="button" className="escbar__exit" onClick={onExit}>
            <span aria-hidden="true">×</span> {exitLabel}
          </button>
        ) : null}

        {arrow("next", next)}
      </div>
    </nav>
  );
}
