// src/components/ClosingCta/ClosingCta.jsx
// ============================================================
// CTA de clôture de l'accueil : invite à entrer dans l'expérience.
//   • Visite guidée (onGuided, fourni par Home) ;
//   • Parcourir les actes (/actes).
// Tokens, FR/EN, zéro inline.
// ============================================================

import React from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import useInView from "../../hooks/useInView";
import "./ClosingCta.scss";

export default function ClosingCta({ onGuided }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const [ref, inView] = useInView({ threshold: 0.3 });

  return (
    <section className="closing" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="closing__inner container">
        <p className="eyebrow closing__kicker">{t("home.closing_cta.kicker")}</p>
        <h2 className="closing__title">{t("home.closing_cta.title")}</h2>
        <p className="closing__text">{t("home.closing_cta.text")}</p>
        <div className="closing__actions">
          <button type="button" className="closing__btn closing__btn--primary" onClick={onGuided}>
            {t("home.closing_cta.guided")} <span aria-hidden="true">✦</span>
          </button>
          <button type="button" className="closing__btn closing__btn--ghost" onClick={() => navigate("/actes")}>
            {t("home.closing_cta.browse")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}