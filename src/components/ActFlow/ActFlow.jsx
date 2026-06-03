// src/components/ActFlow/ActFlow.jsx
// ============================================================
// Enveloppe de PARCOURS pour une page d'acte. La page passe son contenu en
// children. Plus de barre de progression en haut (inutile) : en mode guidé,
// un ouvre-chapitre plein cadre ; puis le contenu de l'acte ; puis un pied
// de navigation (← précédent · suivant →). Le header/footer globaux sont
// masqués sur une page d'acte. Aucun style inline. Textes via i18n.
// ============================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./ActFlow.scss";

// À quel chapitre appartient chaque acte (pour l'ouvre-chapitre cinématique).
const CHAPTER_OF = {
  a1: "c1",
  a2: "c1",
  a3: "c1",
  a4: "c1",
  a5: "c2",
  a6: "c2",
  a7: "c2",
  a8: "c2",
  a9: "c2",
  a10: "c3",
  a11: "c3",
};

export default function ActFlow({ actId, children }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { guided, seen, markSeen, exitJourney, neighbors, setImmersive } =
    useJourney();
  const { index, total, prev, next } = neighbors(actId);

  // En mode guidé et intro pas encore vue → on montre l'intro d'abord.
  const needsIntro = guided && !seen[actId];
  const [revealed, setRevealed] = useState(!needsIntro);

  const introRef = useRef(null);

  // Si on change d'acte (remontage), on recalcule l'état d'intro.
  useEffect(() => {
    setRevealed(!(guided && !seen[actId]));
  }, [actId, guided, seen]);

  // Entrée cinématique de l'ouvre-chapitre (GSAP, échelonnée).
  useLayoutEffect(() => {
    if (revealed || !introRef.current) return undefined;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".actflow__intro-ghost", { opacity: 0, scale: 1.15, duration: 1.1 })
        .from(".actflow__intro-chapter", { y: 18, opacity: 0, duration: 0.6 }, "-=0.7")
        .from(".actflow__intro-tag", { y: 16, opacity: 0, duration: 0.5 }, "-=0.4")
        .from(".actflow__intro-title", { y: 40, opacity: 0, duration: 0.8 }, "-=0.3")
        .from(".actflow__intro-text", { y: 24, opacity: 0, duration: 0.6 }, "-=0.45")
        .from(
          ".actflow__intro-actions > *",
          { y: 18, opacity: 0, duration: 0.5, stagger: 0.1 },
          "-=0.35",
        )
        .from(".actflow__intro-step", { opacity: 0, duration: 0.5 }, "-=0.2");
    }, introRef);
    return () => ctx.revert();
  }, [revealed, actId]);

  // Sur une page d'acte, header et footer globaux s'effacent (via le contexte).
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  // Image de fond de l'ouvre-chapitre : public/intro/a{N}.jpg, exposée au
  // SCSS via la variable --intro-img (consommée par .actflow__intro).
  useEffect(() => {
    if (revealed) return;
    if (introRef.current) {
      introRef.current.style.setProperty("--intro-img", `url("/intro/${actId}.jpg")`);
    }
  }, [actId, revealed]);

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
    <div className="actflow">
      {/* Écran d'intro / ouvre-chapitre (mode guidé, intro non vue) */}
      {!revealed && (
        <section className="actflow__intro" ref={introRef}>
          <span className="actflow__intro-ghost" aria-hidden="true">
            {num}
          </span>
          <div className="actflow__intro-inner container">
            <p className="actflow__intro-chapter">
              {t(`home.${CHAPTER_OF[actId]}_kicker`)} ·{" "}
              {t(`home.${CHAPTER_OF[actId]}_title`)}
            </p>
            <p className="eyebrow actflow__intro-tag">
              {t(`home.acts.${actId}_tag`)}
            </p>
            <h1 className="actflow__intro-title">
              {t(`home.acts.${actId}_title`)}
            </h1>
            <p className="actflow__intro-text">{t(`home.acts.${actId}_text`)}</p>
            <div className="actflow__intro-actions">
              <button type="button" className="actflow__reveal" onClick={reveal}>
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
          <nav className="actflow__foot container" aria-label={t("flow.nav_aria")}>
            <div className="actflow__foot-side">
              {prev ? (
                <button
                  type="button"
                  className="actflow__navbtn actflow__navbtn--prev"
                  onClick={goPrev}
                >
                  <span className="actflow__navbtn-dir">← {t("flow.prev")}</span>
                  <span className="actflow__navbtn-name">
                    {t(`home.acts.${prev.id}_title`)}
                  </span>
                </button>
              ) : (
                <Link to="/" className="actflow__navbtn actflow__navbtn--prev">
                  <span className="actflow__navbtn-dir">← {t("flow.home")}</span>
                  <span className="actflow__navbtn-name">{t("flow.home_name")}</span>
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
                  <span className="actflow__navbtn-dir">{t("flow.next")} →</span>
                  <span className="actflow__navbtn-name">
                    {t(`home.acts.${next.id}_title`)}
                  </span>
                </button>
              ) : (
                <Link
                  to="/"
                  className="actflow__navbtn actflow__navbtn--next actflow__navbtn--end"
                  onClick={exitJourney}
                >
                  <span className="actflow__navbtn-dir">{t("flow.end")} ✦</span>
                  <span className="actflow__navbtn-name">{t("flow.end_name")}</span>
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}