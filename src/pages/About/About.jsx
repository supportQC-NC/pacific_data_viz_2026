// src/pages/About/About.jsx
// ============================================================
// Page « À propos » — projet, auteur, conviction (le pouvoir de la data),
// puis catalogue des jeux de données alimenté par datasetCatalog.js
// (source de vérité unique : libellé, description, 1–2 sources). i18n via t().
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
} from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import DATASET_CATALOG, { PDH } from "../../data/datasetCatalog";
import "./About.scss";

const CHALLENGE_URL = "https://pacificdatavizchallenge.org/fr";

// Icône par domaine (clé = id du catalogue).
const TOPIC_ICONS = {
  emissions: <FiCloud />,
  seaLevel: <FiActivity />,
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
};

function initialsFrom(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function About() {
  const { t, lang } = useLang();
  const authorName = t("about.author.name");
  const pick = (fr, en) => (lang === "fr" ? fr : en);

  return (
    <main className="about">
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

        {/* Auteur + conviction (2 colonnes) */}
        <div className="about__duo">
          <section className="about__author">
            <p className="eyebrow about__sec-eyebrow">
              <FiUser aria-hidden="true" /> {t("about.author.eyebrow")}
            </p>
            <div className="about__author-card">
              <div className="about__author-id">
                <span className="about__author-avatar" aria-hidden="true">
                  {initialsFrom(authorName)}
                </span>
                <span className="about__author-text">
                  <span className="about__author-name">{authorName}</span>
                  <span className="about__author-role">
                    {t("about.author.role")}
                  </span>
                </span>
              </div>
              <p className="about__author-body">{t("about.author.body")}</p>
              <span className="about__author-note">
                {t("about.author.note")}
              </span>
            </div>
          </section>

          <section className="about__story">
            <p className="eyebrow about__sec-eyebrow">
              <FiZap aria-hidden="true" /> {t("about.story.eyebrow")}
            </p>
            <h2 className="about__h2">{t("about.story.title")}</h2>
            <p className="about__story-p">{t("about.story.p1")}</p>
            <blockquote className="about__quote">
              {t("about.story.walmart")}
            </blockquote>
            <p className="about__story-p">{t("about.story.p3")}</p>
          </section>
        </div>

        {/* Données */}
        <section className="about__data">
          <p className="eyebrow about__sec-eyebrow">
            <FiDatabase aria-hidden="true" /> {t("about.data.eyebrow")}
          </p>
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
                <div className="about__card-src">
                  {d.sources.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="about__card-link"
                    >
                      {s.label} <FiArrowUpRight aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <p className="about__note">{t("about.data.note")}</p>
        </section>

        {/* Concours */}
        <section className="about__challenge">
          <div className="about__challenge-text">
            <p className="eyebrow about__sec-eyebrow">
              <FiAward aria-hidden="true" /> {t("about.challenge.title")}
            </p>
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
