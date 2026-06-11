// src/pages/About/About.jsx
// ============================================================
// Page « À propos » — refonte éditoriale premium. Contenu et clés i18n
// inchangés ; seul l'habillage évolue.
// Structure : HERO + sommaire ancré → 01 Auteur (portrait duotone) →
// 02 Conviction (étude de cas Walmart/Pop-Tarts ILLUSTRÉE + concepts) →
// 03 Données (plateforme + catalogue) → 04 Concours (bandeau CTA).
// Données : datasetCatalog.js · liens concours/sources ci-dessous.
// Photo auteur : src/me.jpg · visuel récit : src/popTare.jpg.
// i18n via t() — aucun texte en dur. Zéro style inline (tokens SCSS).
//
// MAJ : les cartes de la section 03 lisent désormais l'attribut `official`
// du catalogue. Un jeu `official:false` (ex. cyclones) reçoit la classe
// `is-unofficial` (teinte distincte via About.scss) + un badge i18n.
// Icônes ajoutées pour les jeux population, fisheries et cyclones.
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
  FiUsers,
  FiAnchor,
} from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import DATASET_CATALOG, { PDH } from "../../data/datasetCatalog";
import mePhoto from "../../me.jpg";
import popTartImg from "../../popTare.jpg";
import "./About.scss";

const CHALLENGE_URL = "https://pacificdatavizchallenge.org/fr";

// Sources du récit Walmart (liens réels, paramètres de tracking retirés).
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
  fisheries: <FiAnchor />,
  water: <FiDroplet />,
  health: <FiHeart />,
  disasters: <FiAlertTriangle />,
  population: <FiUsers />,
  tourism: <FiCompass />,
  energy: <FiZap />,
  envtaxes: <FiPercent />,
  meteo: <FiWind />,
  cyclones: <FiWind />,
};

// Sommaire ancré (numéro + clé d'intitulé + ancre de section).
const SECTIONS = [
  { id: "auteur", n: "01", key: "about.author.eyebrow", icon: <FiUser /> },
  { id: "conviction", n: "02", key: "about.story.eyebrow", icon: <FiZap /> },
  { id: "donnees", n: "03", key: "about.data.eyebrow", icon: <FiDatabase /> },
  { id: "concours", n: "04", key: "about.challenge.title", icon: <FiAward /> },
];

// En-tête de section : numéro éditorial (décoratif) + eyebrow + icône.
function SecHead({ num, icon, children }) {
  return (
    <div className="about__sec-head">
      <span className="about__sec-num" aria-hidden="true">
        {num}
      </span>
      <p className="eyebrow about__sec-eyebrow">
        <span className="about__sec-ico" aria-hidden="true">
          {icon}
        </span>
        {children}
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
      {/* Décor de fond (aurora + trame), purement visuel */}
      <div className="about__bg" aria-hidden="true">
        <span className="about__bg-aurora" />
        <span className="about__bg-grid" />
      </div>

      <div className="about__inner container">
        {/* ============ HERO ============ */}
        <header className="about__hero">
          <Link to="/" className="about__back">
            <FiArrowLeft aria-hidden="true" /> {t("about.back")}
          </Link>

          <p className="eyebrow about__hero-eyebrow">{t("about.eyebrow")}</p>
          <h1 className="about__title">{t("about.title")}</h1>
          <p className="about__lead">{t("about.lead")}</p>

          {/* Sommaire ancré */}
          <nav className="about__index" aria-label={t("about.eyebrow")}>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="about__index-item">
                <span className="about__index-num" aria-hidden="true">
                  {s.n}
                </span>
                <span className="about__index-ico" aria-hidden="true">
                  {s.icon}
                </span>
                <span className="about__index-label">{t(s.key)}</span>
              </a>
            ))}
          </nav>
        </header>

        {/* ============ 01 — AUTEUR ============ */}
        <section className="about__author" id="auteur">
          <SecHead num="01" icon={<FiUser />}>
            {t("about.author.eyebrow")}
          </SecHead>

          <div className="about__author-grid">
            <figure className="about__portrait">
              <img
                className="about__portrait-img"
                src={mePhoto}
                alt={authorName}
                loading="lazy"
                decoding="async"
              />
              <span className="about__portrait-frame" aria-hidden="true" />
            </figure>

            <div className="about__author-meta">
              <h2 className="about__author-name">{authorName}</h2>
              <span className="about__author-role">
                {t("about.author.role")}
              </span>
              <p className="about__author-body">{t("about.author.body")}</p>
              <span className="about__author-note">
                {t("about.author.note")}
              </span>
            </div>
          </div>
        </section>

        {/* ============ 02 — CONVICTION (récit Walmart) ============ */}
        <section className="about__story" id="conviction">
          <SecHead num="02" icon={<FiZap />}>
            {t("about.story.eyebrow")}
          </SecHead>
          <h2 className="about__h2">{t("about.story.title")}</h2>
          <p className="about__story-lead">{t("about.story.lead")}</p>

          <article className="about__case">
            {/* Visuel illustratif (Pop-Tarts) */}
            <figure className="about__case-figure">
              <img
                className="about__case-img"
                src={popTartImg}
                alt={t("about.story.case_title")}
                loading="lazy"
                decoding="async"
              />
            </figure>

            <div className="about__case-body">
              <p className="about__case-kicker">
                {t("about.story.case_kicker")}
              </p>
              <h3 className="about__case-title">
                {t("about.story.case_title")}
              </h3>
              <p className="about__case-context">{t("about.story.context")}</p>

              <div className="about__case-cols">
                <div className="about__case-block">
                  <h4 className="about__case-h">
                    {t("about.story.found_title")}
                  </h4>
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

              <div className="about__sources">
                <span className="about__sources-label">
                  {t("about.story.sources_label")}
                </span>
                <div className="about__sources-list">
                  {WALMART_SOURCES.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="about__src-pill"
                    >
                      {s.label} {"\u00b7"} {t(`about.story.src_${s.kind}`)}{" "}
                      <FiArrowUpRight aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <div className="about__concepts">
            <h3 className="about__concepts-title">
              {t("about.story.legend_title")}
            </h3>
            <p className="about__concepts-lead">
              {t("about.story.legend_lead")}
            </p>
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

        {/* ============ 03 — DONNÉES ============ */}
        <section className="about__data" id="donnees">
          <SecHead num="03" icon={<FiDatabase />}>
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
              {t("about.data.platform_cta")} <FiArrowUpRight aria-hidden="true" />
            </span>
          </a>

          <div className="about__grid">
            {DATASET_CATALOG.map((d) => {
              const unofficial = d.official === false;
              return (
                <Link
                  className={`about__card${unofficial ? " is-unofficial" : ""}`}
                  key={d.id}
                  to={`/data/${d.id}`}
                >
                  <span className="about__card-icon" aria-hidden="true">
                    {TOPIC_ICONS[d.id]}
                  </span>
                  {unofficial ? (
                    <span className="about__card-badge">
                      {t("about.data.unofficial")}
                    </span>
                  ) : null}
                  <h3 className="about__card-title">
                    {pick(d.labelFr, d.labelEn)}
                  </h3>
                  <p className="about__card-desc">{pick(d.descFr, d.descEn)}</p>
                  <span className="about__card-cta">
                    {t("about.data.card_cta")}{" "}
                    <FiArrowUpRight aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="about__method">
            <span className="about__method-label">{t("about.data.note")}</span>
            <p className="about__method-text">{t("about.data.integrity")}</p>
          </div>
        </section>

        {/* ============ 04 — CONCOURS ============ */}
        <section className="about__challenge" id="concours">
          <div className="about__challenge-inner">
            <span className="about__challenge-icon" aria-hidden="true">
              <FiAward />
            </span>
            <div className="about__challenge-text">
              <p className="eyebrow about__challenge-eyebrow">
                {t("about.challenge.title")}
              </p>
              <p className="about__challenge-body">
                {t("about.challenge.body")}
              </p>
            </div>
            <a
              className="about__challenge-cta"
              href={CHALLENGE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("about.challenge.cta")} <FiArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}