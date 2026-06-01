// src/components/Header/Header.jsx
// ============================================================
// En-tête global : marque, bascule de thème, bascule de langue.
// S'efface pendant l'immersion (intro plein écran / mode présentation).
// Branché sur les contextes theme + lang + journey. Zéro chaîne en dur.
// ============================================================

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../store/context/themeContext";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./Header.scss";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const { immersive } = useJourney();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // En immersion, l'en-tête disparaît pour laisser toute la place au récit.
  if (immersive) return null;

  return (
    <header className={`header ${scrolled ? "header--scrolled" : ""}`}>
      <div className="header__inner container">
        <Link to="/" className="header__brand" aria-label={t("brand")}>
          <span className="header__mark" aria-hidden="true" />
          <span className="header__brand-text">{t("brand")}</span>
          <span className="header__tagline">{t("header.tagline")}</span>
        </Link>

        <div className="header__actions">
          <button
            className="header__btn"
            onClick={toggleLang}
            aria-label={t("header.lang")}
          >
            <span className={lang === "fr" ? "is-on" : ""}>FR</span>
            <span className="header__sep">/</span>
            <span className={lang === "en" ? "is-on" : ""}>EN</span>
          </button>

          <button
            className="header__btn header__btn--theme"
            onClick={toggleTheme}
            aria-label={t("header.theme")}
            title={t("header.theme")}
          >
            <span className="header__theme-icon" data-theme-icon={theme} />
          </button>
        </div>
      </div>
    </header>
  );
}
