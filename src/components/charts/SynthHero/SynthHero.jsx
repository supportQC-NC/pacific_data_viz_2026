// src/components/charts/SynthHero/SynthHero.jsx
// ============================================================
// Ouverture de la synthèse — hero premium. Halo lumineux doux derrière le
// titre (pulsation lente, désactivée si prefers-reduced-motion), trait
// d'accent, CTA fléché. Entrée en cascade via .scene__anim (GSAP de l'acte).
// Tout via tokens, aucune dépendance au SCSS de l'acte. Textes en props.
// ============================================================

import React from "react";
import "./SynthHero.scss";

export default function SynthHero({
  eyebrow = "",
  title = "",
  text = "",
  ctaLabel = "",
  onStart = null,
}) {
  return (
    <div className="synthhero">
      <span className="synthhero__glow" aria-hidden="true" />

      <span className="synthhero__mark scene__anim" aria-hidden="true" />
      <p className="synthhero__eyebrow scene__anim">{eyebrow}</p>
      <h1 className="synthhero__title scene__anim">{title}</h1>
      <p className="synthhero__intro scene__anim">{text}</p>

      {ctaLabel ? (
        <button
          type="button"
          className="synthhero__cta scene__anim"
          onClick={onStart || undefined}
        >
          <span>{ctaLabel}</span>
          <span className="synthhero__cta-arrow" aria-hidden="true">
            →
          </span>
        </button>
      ) : null}
    </div>
  );
}