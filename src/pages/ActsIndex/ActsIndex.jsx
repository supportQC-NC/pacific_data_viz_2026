// src/pages/ActsIndex/ActsIndex.jsx
// ============================================================
// Page dédiée à la NAVIGATION PAR ACTE (sortie de l'accueil).
// Récit en 3 chapitres regroupant les actes, en grille éditoriale avec
// une icône thématique par acte. Révélation au scroll (IntersectionObserver).
// Réutilise les styles existants des actes (Home.scss). FR/EN, zéro inline.
// ============================================================

import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCloud,
  FiDroplet,
  FiMap,
  FiUsers,
  FiTrendingUp,
  FiSun,
  FiFeather,
  FiWind,
  FiBarChart2,
  FiHeart,
  FiLayers,
} from "react-icons/fi";
import { WiHurricane } from "react-icons/wi";
import { useLang } from "../../store/context/langContext";
import "../Home/Home.scss";

// Icône thématique par acte.
const ACT_ICONS = {
  a1: <FiCloud />,
  a2: <FiDroplet />,
  a3: <FiMap />,
  a4: <FiUsers />,
  a5: <FiTrendingUp />,
  a6: <FiSun />,
  a7: <FiFeather />,
  a8: <FiWind />,
  a9: <FiBarChart2 />,
  a10: <FiHeart />,
  a11: <FiLayers />,
  a12: <WiHurricane />,
};

// Récit complet : actes répartis en 3 chapitres narratifs.
const CHAPTERS = [
  {
    id: "c1",
    acts: [
      { id: "a1", to: "/emissions" },
      { id: "a2", to: "/ocean" },
      { id: "a3", to: "/territory" },
      { id: "a4", to: "/impact" },
    ],
  },
  {
    id: "c2",
    acts: [
      { id: "a5", to: "/momentum" },
      { id: "a6", to: "/agriculture" },
      { id: "a7", to: "/vivant" },
      { id: "a8", to: "/ciel" },
      { id: "a12", to: "/cyclones" },
      { id: "a9", to: "/economie" },
    ],
  },
  {
    id: "c3",
    acts: [
      { id: "a10", to: "/sante" },
      { id: "a11", to: "/synthese" },
    ],
  },
];

export default function ActsIndex() {
  const { t } = useLang();
  const navigate = useNavigate();
  const actsRef = useRef([]);

  // Révélation des actes au scroll.
  useEffect(() => {
    const nodes = actsRef.current.filter(Boolean);
    if (!nodes.length) return undefined;
    const revealObs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            revealObs.unobserve(e.target);
          }
        }),
      { threshold: 0.16 },
    );
    nodes.forEach((n) => revealObs.observe(n));
    return () => revealObs.disconnect();
  }, []);

  let globalIdx = -1;

  return (
    <main className="home">
      <section className="home__story container">
        <header className="home__story-head">
          <h2 className="home__story-intro">{t("home.acts_intro")}</h2>
          <p className="home__story-lead">{t("home.acts_lead")}</p>
        </header>

        {CHAPTERS.map((chap, ci) => (
          <section className="home__chapter" key={chap.id}>
            <div className="home__chapter-head">
              <span className="home__chapter-num">
                {String(ci + 1).padStart(2, "0")}
              </span>
              <div className="home__chapter-meta">
                <p className="eyebrow home__chapter-kicker">
                  {t(`home.${chap.id}_kicker`)}
                </p>
                <h3 className="home__chapter-title">
                  {t(`home.${chap.id}_title`)}
                </h3>
                <p className="home__chapter-desc">
                  {t(`home.${chap.id}_desc`)}
                </p>
              </div>
            </div>

            <ol className="home__acts">
              {chap.acts.map((a) => {
                globalIdx += 1;
                const idx = globalIdx;
                return (
                  <li
                    key={a.id}
                    data-idx={idx}
                    ref={(el) => {
                      actsRef.current[idx] = el;
                    }}
                    className="act act--link"
                    onClick={() => navigate(a.to)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(a.to);
                    }}
                  >
                    <span className="act__ghost" aria-hidden="true">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="act__inner">
                      <div className="act__meta">
                        <span className="act__icon" aria-hidden="true">
                          {ACT_ICONS[a.id]}
                        </span>
                        <span className="act__index">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <p className="eyebrow act__tag">
                          {t(`home.acts.${a.id}_tag`)}
                        </p>
                      </div>
                      <h4 className="act__title">
                        {t(`home.acts.${a.id}_title`)}
                      </h4>
                      <p className="act__text">{t(`home.acts.${a.id}_text`)}</p>
                      <span className="act__action">
                        {t("home.act_explore")}{" "}
                        <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        <p className="home__closing">{t("home.closing")}</p>
      </section>
    </main>
  );
}