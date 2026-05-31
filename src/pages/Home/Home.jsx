// src/pages/Home/Home.jsx
// ============================================================
// Accueil : hero (image bg.jpg) + bandeau "données en direct"
// (1er appel API via Redux : niveau de la mer) + récit en 5 actes.
// L'acte 1 mène à /emissions ; les autres arrivent ensuite.
// ============================================================

import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import "./Home.scss";

const ACTS = [
  { id: "a1", to: "/emissions" },
  { id: "a2", to: null },
  { id: "a3", to: null },
  { id: "a4", to: null },
  { id: "a5", to: null },
];

export default function Home() {
  const { t } = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const storyRef = useRef(null);

  const seaLevel = useSelector(selectDataset("seaLevel"));

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
  }, [dispatch]);

  const scrollToStory = () =>
    storyRef.current?.scrollIntoView({ behavior: "smooth" });

  let live;
  if (seaLevel.status === "loading" || seaLevel.status === "idle") {
    live = <span className="home__live-text">{t("home.live_loading")}</span>;
  } else if (seaLevel.status === "failed") {
    live = (
      <span className="home__live-text home__live-text--err">
        {t("home.live_error")}
      </span>
    );
  } else {
    const d = seaLevel.data;
    live = (
      <span className="home__live-text">
        {t("home.live_label")} — <strong>{d.areas.length}</strong>{" "}
        {t("home.live_coverage")}
        {d.firstYear && d.lastYear ? ` · ${d.firstYear}–${d.lastYear}` : ""}
      </span>
    );
  }

  return (
    <main className="home">
      <section className="home__hero">
        <div className="home__hero-overlay" aria-hidden="true" />
        <div className="home__hero-content container">
          <p className="eyebrow">{t("home.kicker")}</p>
          <h1 className="home__title">
            <span>{t("home.title_l1")}</span>
            <span className="home__title-accent">{t("home.title_l2")}</span>
          </h1>
          <p className="home__subtitle">{t("home.subtitle")}</p>

          <div className="home__hero-foot">
            <button className="home__cta" onClick={scrollToStory}>
              {t("home.cta")} <span aria-hidden="true">↓</span>
            </button>
            <span className="home__live">
              <span
                className={`home__live-dot home__live-dot--${seaLevel.status}`}
                aria-hidden="true"
              />
              {live}
            </span>
          </div>
        </div>
      </section>

      <section className="home__story container" ref={storyRef}>
        <h2 className="home__story-intro">{t("home.acts_intro")}</h2>
        <ol className="home__acts">
          {ACTS.map((a, i) => (
            <li
              key={a.id}
              className={`act ${a.to ? "act--link" : "act--soon"}`}
              onClick={a.to ? () => navigate(a.to) : undefined}
              role={a.to ? "link" : undefined}
              tabIndex={a.to ? 0 : undefined}
              onKeyDown={
                a.to
                  ? (e) => {
                      if (e.key === "Enter") navigate(a.to);
                    }
                  : undefined
              }
            >
              <span className="act__num">{String(i + 1).padStart(2, "0")}</span>
              <div className="act__body">
                <p className="eyebrow">{t(`home.acts.${a.id}_tag`)}</p>
                <h3 className="act__title">{t(`home.acts.${a.id}_title`)}</h3>
                <p className="act__text">{t(`home.acts.${a.id}_text`)}</p>
              </div>
              <span className="act__go" aria-hidden="true">
                {a.to ? "→" : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
