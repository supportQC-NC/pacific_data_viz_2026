// src/components/HomeIntro/HomeIntro.jsx
// ============================================================
// Manifeste éditorial inséré entre le hero et la grille des actes.
// Explique l'intention : une plateforme en plusieurs actes qui mobilise un
// maximum de données ouvertes pour comprendre — et aider à résoudre — les
// défis climatiques des peuples du Pacifique (montée des eaux, océan,
// autonomie alimentaire, santé, économie…). Tokens only, FR/EN, zéro inline.
// ============================================================

import React from "react";
import { useLang } from "../../store/context/langContext";
import "./HomeIntro.scss";

const PILLARS = ["p1", "p2", "p3"];

export default function HomeIntro() {
  const { t } = useLang();
  return (
    <section className="homeintro">
      <div className="homeintro__inner container">
        <p className="eyebrow homeintro__kicker">{t("home.intro.kicker")}</p>
        <h2 className="homeintro__lead">{t("home.intro.lead")}</h2>

        <div className="homeintro__body">
          <p>{t("home.intro.body1")}</p>
          <p>{t("home.intro.body2")}</p>
        </div>

        <ul className="homeintro__pillars">
          {PILLARS.map((p, i) => (
            <li className="homeintro__pillar" key={p}>
              <span className="homeintro__pillar-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="homeintro__pillar-title">
                {t(`home.intro.${p}_title`)}
              </h3>
              <p className="homeintro__pillar-text">
                {t(`home.intro.${p}_text`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}