// src/components/Loader/Loader.jsx
// ============================================================
// Loader partagé — deux modes :
//   • fullscreen : OVERLAY plein écran + pluie de chiffres binaires (0/1)
//     en fond (composant BinaryRain), panneau central en verre avec balise
//     sonar + libellé + barre de progression.
//   • compact : version inline légère (barres en marée) pour les fallbacks
//     de sous-composants (carte, etc.), sans couvrir la page.
//
//   • inline (défaut / compact) : LA PIROGUE, en filigrane. C'est l'attente
//     des graphiques, celle qu'on croise le plus souvent dans le voyage.
//     Un balayage de barres et trois points clignotants disaient « système
//     occupé » — un vocabulaire d'application, étranger au récit. La pirogue
//     dit la même chose (ça avance) dans la langue du produit, et en
//     filigrane elle n'attire pas l'œil : elle occupe la place que la donnée
//     va prendre, sans prétendre être la donnée.
//
// Accessible (role=status, aria-live, aria-busy). Respecte
// prefers-reduced-motion. Aucun style inline en JSX.
// ============================================================

import React from "react";
import { useLang } from "../../store/context/langContext";
import BinaryRain from "../BinaryRain/BinaryRain";
import Vaa from "../Vaa/Vaa";
import "./Loader.scss";

export default function Loader({ label, fullscreen = false, compact = false, minimal = false }) {
  const { t } = useLang();
  const text = label || t("scene.loading");

  // Loader minimal : juste le libellé (sur le fond de l'acte), sans pluie de
  // chiffres, sans titre ni phrase.
  if (fullscreen && minimal) {
    return (
      <div
        className="loader-overlay loader-overlay--minimal"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={text}
      >
        {/* Même signe que l'attente des graphiques : le voyage ne change pas
            de vocabulaire selon ce qu'on attend. */}
        <span className="loader-overlay__vaa" aria-hidden="true">
          <Vaa withWake />
        </span>
        <span className="loader-overlay__minimal-label">{text}</span>
      </div>
    );
  }

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
      <span className="loader__vaa" aria-hidden="true">
        <Vaa withWake />
      </span>
      <span className="loader__label">{text}</span>
    </div>
  );
}