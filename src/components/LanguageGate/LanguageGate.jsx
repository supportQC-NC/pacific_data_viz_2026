// src/components/LanguageGate/LanguageGate.jsx
// ============================================================
// Écran d'OUVERTURE de l'immersion. Au lancement de l'expérience, l'utilisateur
// choisit d'abord sa langue (FR / EN) sur un panneau plein écran ; le voyage
// démarre ensuite dans la langue choisie (Acte 1).
// - Applique la langue via le contexte (setLang), lance startJourney(),
//   puis navigue vers le premier acte.
// - Échap ferme sans démarrer.
// Aucun style inline. Les libellés sont affichés dans les DEUX langues : c'est
// l'écran de choix de langue lui-même, donc c'est volontaire et assumé.
// ============================================================

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./LanguageGate.scss";

export default function LanguageGate({ open, onClose }) {
  const { setLang } = useLang();
  const { startJourney, journey } = useJourney();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const choose = (lang) => {
    setLang(lang);
    startJourney();
    navigate(journey[0].to);
  };

  return (
    <div
      className="langgate"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your language / Choisissez votre langue"
    >
      <div className="langgate__inner">
        <p className="langgate__kicker">
          Datamoana · Pacific Dataviz Challenge 2026
        </p>
        <h2 className="langgate__title">
          <span lang="fr">Choisissez votre langue</span>
          <span className="langgate__title-sep" aria-hidden="true">
            ·
          </span>
          <span lang="en">Choose your language</span>
        </h2>

        <div className="langgate__choices">
          <button
            type="button"
            className="langgate__choice"
            onClick={() => choose("fr")}
          >
            <span className="langgate__code">FR</span>
            <span className="langgate__name">Français</span>
            <span className="langgate__go" aria-hidden="true">
              Commencer →
            </span>
          </button>
          <button
            type="button"
            className="langgate__choice"
            onClick={() => choose("en")}
          >
            <span className="langgate__code">EN</span>
            <span className="langgate__name">English</span>
            <span className="langgate__go" aria-hidden="true">
              Start →
            </span>
          </button>
        </div>

        <button type="button" className="langgate__skip" onClick={onClose}>
          <span lang="fr">Plus tard</span> · <span lang="en">Later</span>
        </button>
      </div>
    </div>
  );
}
