// src/components/Footer/Footer.jsx
// ============================================================
// Pied de page : marque, accroche, périmètre, sources de données
// (citation obligatoire au règlement). Tout traduit via t().
// S'efface pendant l'immersion (intro plein écran / mode présentation).
// ============================================================

import React from "react";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./Footer.scss";

export default function Footer() {
  const { t } = useLang();
  const { immersive } = useJourney();
  const year = new Date().getFullYear();

  if (immersive) return null;

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__brand">
          <span className="footer__logo">{t("brand")}</span>
          <p className="footer__tagline">{t("footer.tagline")}</p>
          <p className="footer__scope">{t("footer.scope")}</p>
        </div>

        <div className="footer__col">
          <h4 className="footer__title">{t("footer.data_title")}</h4>
          <p className="footer__meta">{t("footer.data_sources")}</p>
        </div>
      </div>

      <div className="footer__bar container">
        <span>
          © {year} · {t("footer.credit")}
        </span>
        <span className="footer__pdc">Pacific Dataviz Challenge 2026</span>
      </div>
    </footer>
  );
}
