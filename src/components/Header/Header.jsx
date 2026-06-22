// src/components/Header/Header.jsx
// ============================================================
// En-tête global — design éditorial premium.
//   • Marque : LOGO de l'application (logo.png) + nom (Fraunces).
//   • Navigation : « Le Récit » (nouvelle expérience Va'a) + « À propos ».
//   • Langue : segmented control FR | EN (le segment actif glisse).
//   • Thème : switch à rail, soleil/lune visibles, curseur lumineux.
// S'efface pendant l'immersion. react-icons. Aucune chaîne en dur, zéro inline.
// NB : le lien « Le Récit » pointe pour l'instant vers /chapitre/humain (seul
//      chapitre Va'a monté). On le repointera vers /recit quand les 5
//      chapitres seront enchaînés. Le HERO de la Home n'est jamais touché.
// ============================================================

import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../../store/context/themeContext";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import logo from "../../logo.png";
import "./Header.scss";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const { immersive } = useJourney();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (immersive) return null;

  const isDark = theme === "dark";

  return (
    <header className={`header ${scrolled ? "header--scrolled" : ""}`}>
      <div className="header__inner container">
        <Link to="/" className="header__brand" aria-label={t("brand")}>
          <img className="header__logo" src={logo} alt="" aria-hidden="true" />
          <span className="header__brand-stack">
            <span className="header__brand-text">{t("brand")}</span>
          </span>
        </Link>

        <div className="header__actions">
          {/* Navigation */}
          <nav className="header__nav" aria-label={t("brand")}>
            <NavLink
              to="/recit"
              className={({ isActive }) =>
                `header__navlink ${isActive ? "is-active" : ""}`
              }
            >
              {t("header.nav_recit")}
            </NavLink>
            <NavLink
              to="/a-propos"
              className={({ isActive }) =>
                `header__navlink ${isActive ? "is-active" : ""}`
              }
            >
              {t("header.nav_about")}
            </NavLink>
          </nav>

          {/* Segmented control langue */}
          <div
            className={`langseg langseg--${lang}`}
            role="group"
            aria-label={t("header.lang")}
          >
            <span className="langseg__thumb" aria-hidden="true" />
            <button
              type="button"
              className={`langseg__opt ${lang === "fr" ? "is-on" : ""}`}
              onClick={() => setLang("fr")}
              aria-pressed={lang === "fr"}
            >
              FR
            </button>
            <button
              type="button"
              className={`langseg__opt ${lang === "en" ? "is-on" : ""}`}
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
          </div>

          {/* Switch thème */}
          <button
            type="button"
            className={`themeswitch ${isDark ? "themeswitch--dark" : "themeswitch--light"}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            aria-label={t("header.theme")}
            title={t("header.theme")}
          >
            <span className="themeswitch__track" aria-hidden="true">
              <span className="themeswitch__ico themeswitch__ico--sun">
                <FiSun />
              </span>
              <span className="themeswitch__ico themeswitch__ico--moon">
                <FiMoon />
              </span>
              <span className="themeswitch__thumb" />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}