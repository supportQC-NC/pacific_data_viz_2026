// src/components/Footer/Footer.jsx
// ============================================================
// Pied de page : LOGO + marque, accroche, périmètre, sources de données
// (citation obligatoire au règlement) + lien « À propos » et lien externe
// vers le Pacific Dataviz Challenge. Tout traduit via t().
// S'efface pendant l'immersion (intro plein écran / mode présentation).
// Le logo s'adapte au thème via un halo défini dans Footer.scss (data-theme).
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import logo from "../../logo.png";
import "./Footer.scss";

const CHALLENGE_URL = "https://pacificdatavizchallenge.org/fr";

export default function Footer() {
  const { t } = useLang();
  const { immersive } = useJourney();
  const year = new Date().getFullYear();

  if (immersive) return null;

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__brand">
          <div className="footer__brandhead">
            <img className="footer__logomark" src={logo} alt="" aria-hidden="true" />
            <span className="footer__logo">{t("brand")}</span>
          </div>
          <p className="footer__tagline">{t("footer.tagline")}</p>
          <p className="footer__scope">{t("footer.scope")}</p>
          <nav className="footer__links">
            <Link to="/a-propos" className="footer__link">
              {t("footer.about")}
            </Link>
          </nav>
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
        <a
          className="footer__pdc"
          href={CHALLENGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("footer.challenge_aria")}
        >
          Pacific Dataviz Challenge 2026
        </a>
      </div>
    </footer>
  );
}