// src/components/DataMethod/DataMethod.jsx
// ============================================================
// Section « Données & méthode » — crédibilité pour un jury : d'où viennent
// les données, l'engagement d'intégrité (aucune valeur inventée), et la
// technologie. Lien vers le Pacific Data Hub. Tokens, FR/EN, zéro inline.
// ============================================================

import React from "react";
import { useLang } from "../../store/context/langContext";
import useInView from "../../hooks/UseInView";
import "./DataMethod.scss";

const PDH_URL = "https://pacificdata.org";

export default function DataMethod() {
  const { t } = useLang();
  const [ref, inView] = useInView({ threshold: 0.2 });

  const cards = [
    { key: "sources", link: PDH_URL },
    { key: "integrity" },
    { key: "tech" },
  ];

  return (
    <section className="datamethod" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="datamethod__inner container">
        <header className="datamethod__head">
          <p className="eyebrow datamethod__kicker">{t("home.method.kicker")}</p>
          <h2 className="datamethod__title">{t("home.method.title")}</h2>
          <p className="datamethod__lead">{t("home.method.lead")}</p>
        </header>

        <ul className="datamethod__grid">
          {cards.map((c) => (
            <li className="datamethod__card" key={c.key}>
              <h3 className="datamethod__card-title">{t(`home.method.${c.key}_title`)}</h3>
              <p className="datamethod__card-text">{t(`home.method.${c.key}_text`)}</p>
              {c.link && (
                <a
                  className="datamethod__link"
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("home.method.sources_link")} <span aria-hidden="true">↗</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}