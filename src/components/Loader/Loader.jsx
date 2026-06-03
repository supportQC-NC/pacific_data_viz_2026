// src/components/Loader/Loader.jsx
// ============================================================
// Loader partagé — deux modes :
//   • fullscreen : OVERLAY plein écran + pluie de chiffres binaires (0/1)
//     en fond (composant BinaryRain), panneau central en verre avec balise
//     sonar + libellé + barre de progression.
//   • compact : version inline légère (barres en marée) pour les fallbacks
//     de sous-composants (carte, etc.), sans couvrir la page.
//
// Accessible (role=status, aria-live, aria-busy). Respecte
// prefers-reduced-motion. Aucun style inline en JSX.
// ============================================================

import React from "react";
import { useLang } from "../../store/context/langContext";
import BinaryRain from "../BinaryRain/BinaryRain";
import "./Loader.scss";

const BARS = [0, 1, 2, 3, 4, 5, 6];

export default function Loader({ label, fullscreen = false, compact = false }) {
  const { t } = useLang();
  const text = label || t("scene.loading");

  if (fullscreen) {
    return (
      <div
        className="loader-overlay"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={text}
      >
        <BinaryRain className="loader__rain" stepMs={32} fontSize={16} />
        <div className="loader-overlay__panel">
          <span className="loader-overlay__mark" aria-hidden="true">
            <span className="loader-overlay__mark-core" />
            <span className="loader-overlay__mark-ring" />
          </span>
          <span className="loader-overlay__label">{text}</span>
          <span className="loader-overlay__progress" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`loader ${compact ? "loader--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loader__viz" aria-hidden="true">
        <span className="loader__scan" />
        <div className="loader__bars">
          {BARS.map((i) => (
            <span key={i} className="loader__bar" />
          ))}
        </div>
      </div>
      <span className="loader__label">{text}</span>
      <span className="loader__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}