// src/components/ActFlow/ActFlow.jsx
// ============================================================
// Enveloppe de PARCOURS pour une page d'acte. Non invasif : la page passe
// son contenu en children, ActFlow ajoute autour :
//   • une barre de progression FIXE en haut (toujours visible) : Acte X / 11
//   • en MODE GUIDÉ et si l'intro n'a pas été vue : un écran d'intro plein
//     cadre (titre + accroche) avec un bouton « Voir les données » qui révèle
//     le contenu ; sinon le contenu s'affiche directement
//   • un PIED de navigation : ← précédent · Acte suivant → (+ rappel position)
// L'exploration libre reste possible : hors mode guidé, l'intro est sautée.
// Aucun style inline. Textes via i18n (réutilise home.acts.* déjà traduits).
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./ActFlow.scss";

export default function ActFlow({ actId, children }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const {
    guided,
    seen,
    markSeen,
    exitJourney,
    neighbors,
    togglePresentation,
    closePresentation,
  } = useJourney();
  const { index, total, prev, next } = neighbors(actId);

  // En mode guidé et intro pas encore vue → on montre l'intro d'abord.
  const needsIntro = guided && !seen[actId];
  const [revealed, setRevealed] = useState(!needsIntro);

  const rootRef = useRef(null);

  // Si on change d'acte (remontage), on recalcule l'état d'intro.
  useEffect(() => {
    setRevealed(!(guided && !seen[actId]));
  }, [actId, guided, seen]);

  // Largeur des barres pilotée par une variable CSS (aucun style inline JSX).
  useEffect(() => {
    const ratio = total > 0 ? (index + 1) / total : 0;
    if (rootRef.current)
      rootRef.current.style.setProperty("--flow-ratio", String(ratio));
  }, [index, total, revealed]);

  const reveal = () => {
    markSeen(actId);
    setRevealed(true);
  };

  const goNext = () => {
    if (next) navigate(next.to);
  };
  const goPrev = () => {
    if (prev) navigate(prev.to);
  };

  const num = String(index + 1).padStart(2, "0");

  return (
    <div className="actflow" ref={rootRef}>
      {/* Barre de progression fixe (toujours) */}
      <div
        className="actflow__bar"
        role="navigation"
        aria-label={t("flow.progress_aria")}
      >
        <div className="actflow__bar-inner container">
          <Link
            to="/"
            className="actflow__home"
            aria-label={t("flow.home")}
            onClick={closePresentation}
          >
            ←
          </Link>
          <div className="actflow__track" aria-hidden="true">
            <span className="actflow__track-fill actflow__track-fill--w" />
          </div>
          <span className="actflow__count">
            {t("flow.act")} <strong>{num}</strong> / {total}
          </span>
          <button
            type="button"
            className="actflow__present"
            onClick={togglePresentation}
          >
            {t("flow.present_mode")} <span aria-hidden="true">▷</span>
          </button>
          {guided && (
            <button
              type="button"
              className="actflow__exit"
              onClick={exitJourney}
            >
              {t("flow.exit")}
            </button>
          )}
        </div>
        <div className="actflow__bar-progress">
          <span className="actflow__bar-progress-fill" />
        </div>
      </div>

      {/* Écran d'intro (mode guidé, intro non vue) */}
      {!revealed && (
        <section className="actflow__intro">
          <div className="actflow__intro-inner container">
            <p className="eyebrow actflow__intro-tag">
              {t(`home.acts.${actId}_tag`)}
            </p>
            <h1 className="actflow__intro-title">
              {t(`home.acts.${actId}_title`)}
            </h1>
            <p className="actflow__intro-text">
              {t(`home.acts.${actId}_text`)}
            </p>
            <div className="actflow__intro-actions">
              <button
                type="button"
                className="actflow__reveal"
                onClick={reveal}
              >
                {t("flow.reveal")} <span aria-hidden="true">↓</span>
              </button>
              {prev && (
                <button
                  type="button"
                  className="actflow__intro-prev"
                  onClick={goPrev}
                >
                  ← {t("flow.prev")}
                </button>
              )}
            </div>
            <span className="actflow__intro-step">
              {t("flow.step")} {num} / {total}
            </span>
          </div>
        </section>
      )}

      {/* Contenu réel de l'acte */}
      {revealed && (
        <>
          {children}

          {/* Pied de navigation */}
          <nav
            className="actflow__foot container"
            aria-label={t("flow.nav_aria")}
          >
            <div className="actflow__foot-side">
              {prev ? (
                <button
                  type="button"
                  className="actflow__navbtn actflow__navbtn--prev"
                  onClick={goPrev}
                >
                  <span className="actflow__navbtn-dir">
                    ← {t("flow.prev")}
                  </span>
                  <span className="actflow__navbtn-name">
                    {t(`home.acts.${prev.id}_title`)}
                  </span>
                </button>
              ) : (
                <Link to="/" className="actflow__navbtn actflow__navbtn--prev">
                  <span className="actflow__navbtn-dir">
                    ← {t("flow.home")}
                  </span>
                  <span className="actflow__navbtn-name">
                    {t("flow.home_name")}
                  </span>
                </Link>
              )}
            </div>

            <span className="actflow__foot-count">
              {num} / {total}
            </span>

            <div className="actflow__foot-side actflow__foot-side--right">
              {next ? (
                <button
                  type="button"
                  className="actflow__navbtn actflow__navbtn--next"
                  onClick={goNext}
                >
                  <span className="actflow__navbtn-dir">
                    {t("flow.next")} →
                  </span>
                  <span className="actflow__navbtn-name">
                    {t(`home.acts.${next.id}_title`)}
                  </span>
                </button>
              ) : (
                <Link
                  to="/synthese"
                  className="actflow__navbtn actflow__navbtn--next actflow__navbtn--end"
                >
                  <span className="actflow__navbtn-dir">{t("flow.end")} ✦</span>
                  <span className="actflow__navbtn-name">
                    {t("flow.end_name")}
                  </span>
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
