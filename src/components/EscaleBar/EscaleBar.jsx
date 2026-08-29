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
import { FiChevronLeft, FiChevronRight, FiLogOut } from "react-icons/fi";
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

  // ---- LES DEUX BOUTONS D'EXTRÉMITÉ ----------------------------------
  // C'étaient deux chevrons nus, dont le titre de l'escale voisine
  // n'apparaissait qu'au survol. Rien ne disait qu'ils menaient à une AUTRE
  // ESCALE plutôt qu'au graphique suivant — deux navigations cohabitent dans
  // cette barre, et la plus engageante des deux était la moins lisible.
  //
  // Ils portent donc leur nom. Le titre de l'escale visée reste en infobulle :
  // à l'écran il doublerait la largeur du bouton pour une information dont on
  // n'a besoin qu'une fois la décision prise.
  //
  // Sous 1400 px le libellé s'efface et le chevron reprend seul : les onglets
  // de vue ont alors besoin de toute la place, et c'est eux qu'on manipule le
  // plus souvent.
  const navButton = (side, target) => {
    const isPrev = side === "prev";
    const Icon = isPrev ? FiChevronLeft : FiChevronRight;
    const icon = <Icon aria-hidden="true" />;
    const text = target?.label ? (
      <span className="escbar__nav-label">{target.label}</span>
    ) : null;

    if (!target) {
      return (
        <span
          className={`escbar__nav escbar__nav--${side} is-disabled`}
          aria-hidden="true"
        >
          {isPrev ? icon : null}
          {text}
          {isPrev ? null : icon}
        </span>
      );
    }
    return (
      <Link
        to={target.to}
        className={`escbar__nav escbar__nav--${side}`}
        title={target.hint || target.label}
        aria-label={
          target.hint ? `${target.label} : ${target.hint}` : target.label
        }
      >
        {isPrev ? icon : null}
        {text}
        {isPrev ? null : icon}
      </Link>
    );
  };

  return (
    <nav className="escbar" aria-label={navAria}>
      <div className="escbar__inner container">
        {navButton("prev", prev)}

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

        {/* QUITTER LE VOYAGE — une porte, et rien d'autre.
            Le libellé complet occupait la largeur d'un onglet et demi pour une
            action qu'on ne fait qu'une fois, tout en attirant l'œil autant que
            la navigation qu'on utilise en permanence. L'icône garde son nom
            pour le survol et pour les lecteurs d'écran. */}
        {onExit && exitLabel ? (
          <button
            type="button"
            className="escbar__exit"
            onClick={onExit}
            title={exitLabel}
            aria-label={exitLabel}
          >
            <FiLogOut aria-hidden="true" />
          </button>
        ) : null}

        {navButton("next", next)}
      </div>
    </nav>
  );
}
