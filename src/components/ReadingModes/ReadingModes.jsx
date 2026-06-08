// src/components/ReadingModes/ReadingModes.jsx
// ============================================================
// « Trois façons de lire » — présenté avant la grille des actes.
// Trois entrées, toutes cliquables (elles déclenchent réellement le mode) :
//   • Par acte        → défile vers la grille des actes ;
//   • Visite guidée   → lance l'expérience (parcours ordonné) ;
//   • En un fait      → ouvre « Le saviez-vous ? ».
// Message : rester accessible et compréhensible par le plus grand nombre.
// Tokens only, FR/EN, zéro inline. Handlers fournis par Home.
// ============================================================

import React from "react";
import { FiGrid, FiPlayCircle, FiZap } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import "./ReadingModes.scss";

export default function ReadingModes({ onBrowse, onGuided, onFunFacts }) {
  const { t } = useLang();
  const modes = [
    { key: "browse", icon: <FiGrid />, on: onBrowse },
    { key: "guided", icon: <FiPlayCircle />, on: onGuided },
    { key: "fun", icon: <FiZap />, on: onFunFacts },
  ];
  return (
    <section className="readmodes">
      <div className="readmodes__inner container">
        <p className="eyebrow readmodes__kicker">{t("home.modes.kicker")}</p>
        <h2 className="readmodes__lead">{t("home.modes.lead")}</h2>

        <ul className="readmodes__grid">
          {modes.map((m) => (
            <li key={m.key}>
              <button type="button" className="readmodes__card" onClick={m.on}>
                <span className="readmodes__icon" aria-hidden="true">{m.icon}</span>
                <span className="readmodes__title">{t(`home.modes.${m.key}_title`)}</span>
                <span className="readmodes__text">{t(`home.modes.${m.key}_text`)}</span>
                <span className="readmodes__action">
                  {t(`home.modes.${m.key}_action`)} <span aria-hidden="true">→</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}