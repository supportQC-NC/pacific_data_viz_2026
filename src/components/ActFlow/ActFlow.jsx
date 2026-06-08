// src/components/ActFlow/ActFlow.jsx
// ============================================================
// Enveloppe de PARCOURS pour une page d'acte. La page passe son contenu en
// children. En mode guidé : un ouvre-chapitre plein cadre ; puis le contenu
// de l'acte ; le header/footer globaux sont masqués sur une page d'acte.
// Le NUMÉRO d'acte, le MOUVEMENT et le tag sont dérivés du parcours
// (journeyContext) — aucune numérotation codée en dur ici. Textes via i18n.
// ============================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./ActFlow.scss";

export default function ActFlow({ actId, children }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { guided, seen, markSeen, neighbors, movementOf, setImmersive } = useJourney();
  const { index, total, prev } = neighbors(actId);

  // Mouvement narratif de l'acte (pour l'ouvre-chapitre cinématique).
  const movement = movementOf(actId);
  const movementId = movement ? movement.id : "m1";

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
        .from(".actflow__intro-ghost", {
          opacity: 0,
          scale: 1.15,
          duration: 1.1,
        })
        .from(
          ".actflow__intro-chapter",
          { y: 18, opacity: 0, duration: 0.6 },
          "-=0.7",
        )
        .from(
          ".actflow__intro-tag",
          { y: 16, opacity: 0, duration: 0.5 },
          "-=0.4",
        )
        .from(
          ".actflow__intro-title",
          { y: 40, opacity: 0, duration: 0.8 },
          "-=0.3",
        )
        .from(
          ".actflow__intro-text",
          { y: 24, opacity: 0, duration: 0.6 },
          "-=0.45",
        )
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
      introRef.current.style.setProperty(
        "--intro-img",
        `url("/intro/${actId}.jpg")`,
      );
    }
  }, [actId, revealed]);

  const reveal = () => {
    markSeen(actId);
    setRevealed(true);
  };

  const goPrev = () => {
    if (prev) navigate(prev.to);
  };

  const num = String(index + 1).padStart(2, "0");

  // Tag composé : « Acte 03 » (+ éventuel nom court de l'acte, ex. « — L'assiette »).
  const actName = t(`home.acts.${actId}_name`);
  const tag = `${t("flow.act")} ${num}${actName ? ` — ${actName}` : ""}`;

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
              {t(`home.${movementId}_kicker`)} ·{" "}
              {t(`home.${movementId}_title`)}
            </p>
            <p className="eyebrow actflow__intro-tag">{tag}</p>
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
      {revealed && children}
    </div>
  );
}