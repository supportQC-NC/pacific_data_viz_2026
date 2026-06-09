// src/pages/About/About.jsx
// ============================================================
// Page « À propos » — projet, auteur (avec photo), conviction (le pouvoir
// de la data via le cas Walmart / Pop-Tarts), puis catalogue des jeux de
// données alimenté par datasetCatalog.js. i18n via t() — aucun texte en dur.
//
// Layout : 01 Auteur (photo + texte) → 02 Conviction (récit Walmart EN
// PLEINE LARGEUR, sous la présentation, avec sources cliquables) → 03
// Données → 04 Concours. Sections numérotées (rythme éditorial).
//
// Pour CORRIGER les liens des datasets : éditer src/data/datasetCatalog.js.
// Le lien du concours est CHALLENGE_URL ci-dessous. La photo de l'auteur est
// src/me.jpg (importée ci-dessous). Les sources du récit sont WALMART_SOURCES.
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiUser,
  FiDatabase,
  FiAward,
  FiZap,
  FiCloud,
  FiActivity,
  FiThermometer,
  FiCloudRain,
  FiSun,
  FiFeather,
  FiDroplet,
  FiHeart,
  FiAlertTriangle,
  FiCompass,
  FiPercent,
  FiWind,
  FiMapPin,
  FiLayers,
  FiSearch,
  FiTrendingUp,
  FiTruck,
  FiBarChart2,
  FiGitMerge,
} from "react-icons/fi";
import { WiHurricane } from "react-icons/wi";
import { useLang } from "../../store/context/langContext";
import DATASET_CATALOG, { PDH } from "../../data/datasetCatalog";
import mePhoto from "../../me.jpg";
import "./About.scss";

const CHALLENGE_URL = "https://pacificdatavizchallenge.org/fr";

// Sources du récit Walmart (liens réels, paramètres de tracking retirés).
// `kind` -> libellé traduit (about.story.src_*).
const WALMART_SOURCES = [
  {
    url: "https://www.countryliving.com/food-drinks/a44550/walmart-strawberry-pop-tarts-before-hurricane/",
    label: "Country Living",
    kind: "popular",
  },
  {
    url: "https://blog.othor.ai/the-pop-tarts-phenomenon-walmarts-data-driven-supply-chain-revolution-b1b7d0b1f6fa",
    label: "Othor AI",
    kind: "case",
  },
  {
    url: "https://www.snowdatascience.org/post/how-data-science-helped-walmart-predict-sales-during-a-hurricane",
    label: "Snow Data Science",
    kind: "ds",
  },
  {
    url: "https://www.forbes.com/sites/bernardmarr/2016/08/25/the-most-practical-big-data-use-cases-of-2016/",
    label: "Forbes",
    kind: "bigdata",
  },
];

// Concepts illustrés par le récit (terme + icône, définition via i18n).
const CONCEPTS = [
  { n: 1, icon: <FiSearch /> },
  { n: 2, icon: <FiTrendingUp /> },
  { n: 3, icon: <FiTruck /> },
  { n: 4, icon: <FiBarChart2 /> },
  { n: 5, icon: <FiGitMerge /> },
];

// Icône par domaine (clé = id du catalogue).
const TOPIC_ICONS = {
  emissions: <FiCloud />,
  seaLevel: <FiActivity />,
  coastline: <FiMapPin />,
  landcover: <FiLayers />,
  powermix: <FiZap />,
  sst: <FiThermometer />,
  rain: <FiCloudRain />,
  agriculture: <FiSun />,
  biodiversity: <FiFeather />,
  water: <FiDroplet />,
  health: <FiHeart />,
  disasters: <FiAlertTriangle />,
  tourism: <FiCompass />,
  energy: <FiZap />,
  envtaxes: <FiPercent />,
  meteo: <FiWind />,
  cyclones: <WiHurricane />,
};

// En-tête de section : numéro éditorial (décoratif) + eyebrow + icône.
function SecHead({ num, icon, children }) {
  return (
    <div className="about__sec-head">
      <span className="about__sec-num" aria-hidden="true">
        {num}
      </span>
      <p className="eyebrow about__sec-eyebrow">
        {icon} {children}
      </p>
    </div>
  );
}

export default function About() {
  const { t, lang } = useLang();
  const authorName = t("about.author.name");
  const pick = (fr, en) => (lang === "fr" ? fr : en);

  return (
    <main className="about">
      <div className="about__glow" aria-hidden="true" />
      <div className="about__inner container">
        {/* En-tête */}
        <header className="about__head">
          <Link to="/" className="about__back">
            <FiArrowLeft aria-hidden="true" /> {t("about.back")}
          </Link>
          <p className="eyebrow about__eyebrow">{t("about.eyebrow")}</p>
          <h1 className="about__title">{t("about.title")}</h1>
          <p className="about__lead">{t("about.lead")}</p>
        </header>

        {/* 01 — Auteur (photo + texte) */}
        <section className="about__author">
          <SecHead num="01" icon={<FiUser aria-hidden="true" />}>
            {t("about.author.eyebrow")}
          </SecHead>
          <div className="about__author-card">
            <img
              className="about__author-photo"
              src={mePhoto}
              alt={authorName}
              loading="lazy"
              decoding="async"
            />
            <div className="about__author-text">
              <h2 className="about__author-name">{authorName}</h2>
              <span className="about__author-role">{t("about.author.role")}</span>
              <p className="about__author-body">{t("about.author.body")}</p>
              <span className="about__author-note">{t("about.author.note")}</span>
            </div>
          </div>
        </section>

        {/* 02 — Conviction : le récit Walmart, en pleine largeur */}
        <section className="about__story">
          <SecHead num="02" icon={<FiZap aria-hidden="true" />}>
            {t("about.story.eyebrow")}
          </SecHead>
          <h2 className="about__h2">{t("about.story.title")}</h2>
          <p className="about__story-lead">{t("about.story.lead")}</p>

          <article className="about__case">
            <p className="about__case-kicker">{t("about.story.case_kicker")}</p>
            <h3 className="about__case-title">{t("about.story.case_title")}</h3>
            <p className="about__story-p">{t("about.story.context")}</p>

            <div className="about__case-cols">
              <div className="about__case-block">
                <h4 className="about__case-h">{t("about.story.found_title")}</h4>
                <ul className="about__case-list">
                  <li>{t("about.story.found_1")}</li>
                  <li>{t("about.story.found_2")}</li>
                  <li>{t("about.story.found_3")}</li>
                </ul>
              </div>
              <div className="about__case-block">
                <h4 className="about__case-h">{t("about.story.why_title")}</h4>
                <ul className="about__case-list">
                  <li>{t("about.story.why_1")}</li>
                  <li>{t("about.story.why_2")}</li>
                  <li>{t("about.story.why_3")}</li>
                  <li>{t("about.story.why_4")}</li>
                </ul>
              </div>
            </div>

            <p className="about__case-outcome">{t("about.story.outcome")}</p>

            <div className="about__case-sources">
              <span className="about__case-sources-label">
                {t("about.story.sources_label")}
              </span>
              <div className="about__case-sources-list">
                {WALMART_SOURCES.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about__src-pill is-origin"
                  >
                    {s.label} {"\u00b7"} {t(`about.story.src_${s.kind}`)}{" "}
                    <FiArrowUpRight aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </article>

          <div className="about__concepts">
            <h3 className="about__case-title">{t("about.story.legend_title")}</h3>
            <p className="about__story-p">{t("about.story.legend_lead")}</p>
            <div className="about__concept-grid">
              {CONCEPTS.map((c) => (
                <div className="about__concept" key={c.n}>
                  <span className="about__concept-icon" aria-hidden="true">
                    {c.icon}
                  </span>
                  <span className="about__concept-term">
                    {t(`about.story.concept_${c.n}_t`)}
                  </span>
                  <span className="about__concept-def">
                    {t(`about.story.concept_${c.n}_d`)}
                  </span>
                </div>
              ))}
            </div>
            <p className="about__story-close">{t("about.story.close")}</p>
          </div>
        </section>

        {/* 03 — Données */}
        <section className="about__data">
          <SecHead num="03" icon={<FiDatabase aria-hidden="true" />}>
            {t("about.data.eyebrow")}
          </SecHead>
          <h2 className="about__h2">{t("about.data.title")}</h2>
          <p className="about__data-lead">{t("about.data.lead")}</p>

          <a
            className="about__platform"
            href={PDH}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="about__platform-icon" aria-hidden="true">
              <FiDatabase />
            </span>
            <span className="about__platform-meta">
              <span className="about__platform-name">
                {t("about.data.platform_name")}
              </span>
              <span className="about__platform-desc">
                {t("about.data.platform_desc")}
              </span>
            </span>
            <span className="about__platform-cta">
              {t("about.data.platform_cta")}{" "}
              <FiArrowUpRight aria-hidden="true" />
            </span>
          </a>

          {/* Catalogue (grille de cartes, alimentée par datasetCatalog.js) */}
          <div className="about__grid">
            {DATASET_CATALOG.map((d) => (
              <article className="about__card" key={d.id}>
                <span className="about__card-icon" aria-hidden="true">
                  {TOPIC_ICONS[d.id]}
                </span>
                <h3 className="about__card-title">
                  {pick(d.labelFr, d.labelEn)}
                </h3>
                <p className="about__card-desc">{pick(d.descFr, d.descEn)}</p>
                <div className="about__card-sources">
                  {d.sources.map((s, i) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`about__src-pill ${i === 0 ? "is-origin" : ""}`}
                    >
                      {s.label} <FiArrowUpRight aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <p className="about__note">{t("about.data.note")}</p>
          <p className="about__note about__note--method">
            {t("about.data.integrity")}
          </p>
        </section>

        {/* 04 — Concours */}
        <section className="about__challenge">
          <div className="about__challenge-text">
            <SecHead num="04" icon={<FiAward aria-hidden="true" />}>
              {t("about.challenge.title")}
            </SecHead>
            <p>{t("about.challenge.body")}</p>
          </div>
          <a
            className="about__challenge-cta"
            href={CHALLENGE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("about.challenge.cta")} <FiArrowUpRight aria-hidden="true" />
          </a>
        </section>
      </div>
    </main>
  );
}