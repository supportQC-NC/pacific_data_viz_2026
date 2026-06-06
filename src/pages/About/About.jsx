// src/pages/About/About.jsx
// ============================================================
// Page « À propos » — présentation du projet et de l'auteur (pour le
// jury) + catalogue complet des données utilisées, avec leurs sources
// d'origine, une icône par domaine et leurs liens. Tout via t() (i18n).
//
// Le catalogue reflète les jeux de données réellement mobilisés par
// l'app, tous agrégés par le Pacific Data Hub .Stat (SPC).
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiUser,
  FiDatabase,
  FiAward,
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
  FiZap,
  FiPercent,
  FiWind,
} from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import "./About.scss";

const PDH = "https://pacificdata.org";
const PDH_STAT = "https://stats.pacificdata.org";
const CHALLENGE_URL = "https://pacificdatavizchallenge.org/fr";

// Icône par domaine (clé = about.topics.*).
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

// Topic = clé i18n ; org = nom propre ; link = source.
const SOURCES = [
  {
    id: "emissions",
    org: "Banque mondiale · World Bank",
    link: "https://data.worldbank.org",
  },
  {
    id: "seaLevel",
    org: "Copernicus Climate Change Service (C3S)",
    link: "https://cds.climate.copernicus.eu/datasets/satellite-sea-level-global",
  },
  { id: "sst", org: "Copernicus C3S · SPC", link: PDH_STAT },
  { id: "rain", org: "SPC · Climate Change", link: PDH_STAT },
  { id: "agriculture", org: "SPC · Agricultural Production", link: PDH_STAT },
  {
    id: "biodiversity",
    org: "UICN · Liste Rouge / IUCN Red List",
    link: "https://www.iucnredlist.org",
  },
  { id: "water", org: "OMS / UNICEF · JMP", link: "https://washdata.org" },
  {
    id: "health",
    org: "Organisation mondiale de la santé (OMS)",
    link: "https://www.who.int/data",
  },
  {
    id: "disasters",
    org: "UNSD · SDG Indicators",
    link: "https://unstats.un.org/sdgs/dataportal",
  },
  {
    id: "tourism",
    org: "ONU Tourisme · UN Tourism",
    link: "https://www.unwto.org",
  },
  { id: "energy", org: "FMI · IRENA", link: "https://www.irena.org" },
  { id: "envtaxes", org: "FMI · OCDE", link: PDH_STAT },
  { id: "meteo", org: "OMM · OSCAR / WMO", link: "https://oscar.wmo.int" },
];

// Initiales de l'auteur, dérivées du nom (i18n).
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
  const { t } = useLang();
  const authorName = t("about.author.name");

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

        {/* Auteur */}
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
            <span className="about__author-note">{t("about.author.note")}</span>
          </div>
        </section>

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

          {/* Catalogue */}
          <div className="about__table" role="table">
            <div className="about__row about__row--head" role="row">
              <span role="columnheader">{t("about.data.col_topic")}</span>
              <span role="columnheader">{t("about.data.col_source")}</span>
              <span role="columnheader">{t("about.data.col_access")}</span>
            </div>
            {SOURCES.map((s) => (
              <div className="about__row" role="row" key={s.id}>
                <span className="about__cell about__cell--topic" role="cell">
                  <span className="about__topic-icon" aria-hidden="true">
                    {TOPIC_ICONS[s.id]}
                  </span>
                  {t(`about.topics.${s.id}`)}
                </span>
                <span className="about__cell about__cell--source" role="cell">
                  {s.org}
                </span>
                <span className="about__cell about__cell--link" role="cell">
                  <a href={s.link} target="_blank" rel="noopener noreferrer">
                    {t("about.data.link_label")}{" "}
                    <FiArrowUpRight aria-hidden="true" />
                  </a>
                </span>
              </div>
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
