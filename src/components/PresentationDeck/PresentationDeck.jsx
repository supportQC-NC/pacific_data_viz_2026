// src/components/PresentationDeck/PresentationDeck.jsx
// ============================================================
// MODE PRÉSENTATION — plein écran, un graphe par scène.
// • Scène 0 = intro de l'acte (accroche), puis une scène par graphe,
//   puis une scène finale « acte suivant ».
// • Navigation : scroll qui aimante (scroll-snap) + flèches ↑/↓ + clavier
//   (flèches, PageUp/Down, Espace, Home/End, Échap pour sortir).
// • Points de progression cliquables, compteur, bouton fermer → vue analytique.
// • Verrouille le scroll de la page sous l'overlay. Respecte reduced-motion.
// L'acte fournit seulement `scenes` (titre + sous-titre + nœud graphe).
// Aucun style inline en JSX (largeurs via CSS ; body.overflow via DOM .style).
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./PresentationDeck.scss";

export default function PresentationDeck({ actId, scenes = [] }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { neighbors, closePresentation } = useJourney();
  const { prev, next } = neighbors(actId);

  const scrollerRef = useRef(null);
  const refs = useRef([]);
  const [active, setActive] = useState(0);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Liste complète : intro + graphes + scène finale.
  const all = [
    {
      id: "__intro",
      kind: "intro",
      tag: t(`home.acts.${actId}_tag`),
      title: t(`home.acts.${actId}_title`),
      sub: t(`home.acts.${actId}_text`),
    },
    ...scenes,
    { id: "__end", kind: "end" },
  ];
  const count = all.length;

  const goTo = useCallback(
    (i) => {
      const c = refs.current.length || count;
      // Débordement : au-delà de la dernière scène → acte suivant ;
      // avant la première → acte précédent. L'enchaînement ne s'arrête jamais.
      if (i >= c) {
        if (next) navigate(next.to);
        return;
      }
      if (i < 0) {
        if (prev) navigate(prev.to);
        return;
      }
      const el = refs.current[i];
      if (el)
        el.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
    },
    [count, reduced, next, prev, navigate],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        closePresentation();
        return;
      }
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        goTo(active + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(active - 1);
      } else if (e.key === "Home") {
        goTo(0);
      } else if (e.key === "End") {
        goTo(count - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo, count, closePresentation]);

  // Verrou du scroll de la page sous l'overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Scène active = celle visible au centre.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number(e.target.getAttribute("data-i"));
            if (!Number.isNaN(i)) setActive(i);
          }
        }),
      { root: scrollerRef.current, threshold: 0.55 },
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [scenes.length]);

  const setRef = (i) => (el) => {
    refs.current[i] = el;
  };

  return (
    <div
      className="deck"
      role="dialog"
      aria-modal="true"
      aria-label={t("flow.present_mode")}
    >
      <div className="deck__top">
        <div className="deck__top-inner container">
          <span className="deck__top-act">{t(`home.acts.${actId}_tag`)}</span>
          <span className="deck__top-count">
            {String(Math.min(active + 1, count)).padStart(2, "0")} /{" "}
            {String(count).padStart(2, "0")}
          </span>
          <button
            type="button"
            className="deck__close"
            onClick={closePresentation}
          >
            {t("flow.analytic_mode")} <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>

      <ol className="deck__dots" aria-hidden="true">
        {all.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`deck__dot ${i === active ? "is-active" : ""} ${i < active ? "is-past" : ""}`}
              onClick={() => goTo(i)}
            />
          </li>
        ))}
      </ol>

      <div className="deck__scroller" ref={scrollerRef}>
        {all.map((s, i) => (
          <section
            key={s.id}
            className={`deck__scene deck__scene--${s.kind || "chart"}`}
            data-i={i}
            ref={setRef(i)}
          >
            <div className="deck__scene-inner container">
              {s.kind === "end" ? (
                <div className="deck__end">
                  <p className="eyebrow deck__scene-tag">
                    {t("flow.deck_done")}
                  </p>
                  <h2 className="deck__end-title">
                    {t(`home.acts.${actId}_title`)}
                  </h2>
                  <div className="deck__end-actions">
                    {next ? (
                      <button
                        type="button"
                        className="deck__cta"
                        onClick={() => navigate(next.to)}
                      >
                        {t("flow.next")} : {t(`home.acts.${next.id}_title`)}{" "}
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="deck__cta"
                        onClick={closePresentation}
                      >
                        {t("flow.deck_finish")}{" "}
                        <span aria-hidden="true">✦</span>
                      </button>
                    )}
                    {prev && (
                      <button
                        type="button"
                        className="deck__ghost"
                        onClick={() => navigate(prev.to)}
                      >
                        ← {t(`home.acts.${prev.id}_title`)}
                      </button>
                    )}
                    <button
                      type="button"
                      className="deck__ghost"
                      onClick={closePresentation}
                    >
                      {t("flow.analytic_mode")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <header className="deck__scene-head">
                    {s.tag && (
                      <p className="eyebrow deck__scene-tag">{s.tag}</p>
                    )}
                    <h2
                      className={`deck__scene-title ${s.kind === "intro" ? "deck__scene-title--intro" : ""}`}
                    >
                      {s.title}
                    </h2>
                    {s.sub && <p className="deck__scene-sub">{s.sub}</p>}
                  </header>
                  {s.node && <div className="deck__scene-chart">{s.node}</div>}
                </>
              )}
            </div>
            {i === 0 && (
              <span className="deck__hint">{t("flow.deck_hint")} ↓</span>
            )}
          </section>
        ))}
      </div>

      <div className="deck__arrows">
        <button
          type="button"
          className="deck__arrow"
          onClick={() => goTo(active - 1)}
          disabled={active === 0 && !prev}
          aria-label={t("flow.deck_prev")}
        >
          ↑
        </button>
        <button
          type="button"
          className="deck__arrow"
          onClick={() => goTo(active + 1)}
          disabled={active === count - 1 && !next}
          aria-label={t("flow.deck_next")}
        >
          ↓
        </button>
      </div>
    </div>
  );
}
