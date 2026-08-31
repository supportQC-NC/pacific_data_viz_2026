// src/pages/About/About.jsx
// ============================================================
// Page « À propos » — lecture en CHAPITRES PLEIN ÉCRAN.
// Cible : écran d'ordinateur. Chaque chapitre occupe une hauteur de
// fenêtre (100dvh), se centre, et le scroll s'y accroche (scroll-snap) :
// le jury voit un sujet à la fois, sans défilement interne.
//
// Structure :
//   HERO   titre + chapô (la barre de chapitres devient la nav latérale)
//   01     Dépôt & traçabilité — GitHub, hébergement, journaux serveur
//   02     L'auteur
//   03     Conviction — étude de cas Walmart/Pop-Tarts + concepts
//   04     Données — plateforme, catalogue, méthode
//   05     Concours — bandeau CTA
//
// Le dépôt passe EN PREMIER : c'est la pièce que le jury doit pouvoir
// vérifier avant tout le reste (horodatage des commits vs date limite).
//
// Trois mécaniques, toutes désactivées si `prefers-reduced-motion` :
//   · scroll-snap posé sur <html> pendant que la page est montée (classe
//     retirée au démontage — sinon tout le site s'accrocherait) ;
//   · nav latérale discrète, chapitre actif suivi à l'IntersectionObserver ;
//   · révélation GSAP par chapitre (wipe au clip-path + cascade de textes),
//     même grammaire que la Home, avec filet de sécurité.
//
// Données : datasetCatalog.js · liens concours/sources ci-dessous.
// Photo auteur : src/me.jpg · visuel récit : src/popTare.jpg.
// i18n via t() — aucun texte en dur. Zéro style inline (tokens SCSS).
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiChevronUp,
  FiChevronDown,
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
  FiGithub,
  FiServer,
  FiRefreshCw,
  FiFileText,
} from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import MilkyWayCanvas from "../../components/MilkyWayCanvas/MilkyWayCanvas";
import DATASET_CATALOG, { PDH } from "../../data/datasetCatalog";
import mePhoto from "../../me.jpg";
import popTartImg from "../../popTare.jpg";
import "./About.scss";

gsap.registerPlugin(ScrollTrigger);

const CHALLENGE_URL = "https://pacificdatavizchallenge.org/fr";

// Dépôt public : l'historique des commits horodaté atteste du respect de la
// date limite du concours. C'est le premier chapitre de la page.
const REPO_URL = "https://github.com/supportQC-NC/pacific_data_viz_2026";
const REPO_LABEL = "supportQC-NC/pacific_data_viz_2026";
// Site en production : hébergement Hostinger, déploiement lié aux push.
const SITE_URL = "https://www.krysto.io";

// Chaîne de mise en ligne, exposée à côté du bandeau du dépôt.
const DEPLOY_FACTS = [
  { key: "deploy_host", icon: <FiServer /> },
  { key: "deploy_ci", icon: <FiRefreshCw /> },
  { key: "deploy_logs", icon: <FiFileText /> },
];

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

// Chapitres de la page. L'ordre EST celui du document : le dépôt d'abord.
// `hero` ouvre la nav pour permettre le retour en tête.
const SECTIONS = [
  { id: "ouverture", n: "00", key: "about.eyebrow", icon: <FiCompass /> },
  { id: "depot", n: "01", key: "about.repo.eyebrow", icon: <FiGithub /> },
  { id: "auteur", n: "02", key: "about.author.eyebrow", icon: <FiUser /> },
  { id: "conviction", n: "03", key: "about.story.eyebrow", icon: <FiZap /> },
  { id: "donnees", n: "04", key: "about.data.eyebrow", icon: <FiDatabase /> },
  { id: "concours", n: "05", key: "about.challenge.title", icon: <FiAward /> },
];

// En-tête de chapitre : numéro éditorial (décoratif) + eyebrow + icône.
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

  const rootRef = useRef(null);
  const [active, setActive] = useState("ouverture");

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Scroll-snap : posé sur <html> LE TEMPS de la page, jamais au-delà.
  // En `proximity` et non `mandatory` : un chapitre plus haut que la fenêtre
  // (petit portable) doit rester librement lisible, et le pied de page
  // atteignable.
  useEffect(() => {
    if (reduced) return undefined;
    const root = document.documentElement;
    root.classList.add("is-about-snap");
    return () => root.classList.remove("is-about-snap");
  }, [reduced]);

  // --- Déplacement d'un chapitre à l'autre. On ne « clique pas sur un
  // lien » : on visite la page chapitre par chapitre, au pager ou au
  // clavier. `scrollIntoView` en `smooth` laisse le scroll-snap poser le
  // chapitre proprement.
  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((s2) => s2.id === active),
  );

  const goTo = React.useCallback(
    (index) => {
      const target = SECTIONS[index];
      if (!target) return;
      const el = document.getElementById(target.id);
      if (!el) return;
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    },
    [reduced],
  );

  // Flèches haut/bas et Page préc./suiv. : même parcours que le pager.
  useEffect(() => {
    const onKey = (e) => {
      // On ne détourne pas le clavier d'un champ ou d'une zone défilante.
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        if (activeIndex >= SECTIONS.length - 1) return;
        e.preventDefault();
        goTo(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        if (activeIndex <= 0) return;
        e.preventDefault();
        goTo(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, goTo]);

  // --- Chapitre actif : alimente la nav latérale.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean,
    );
    if (!els.length || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // Le chapitre le plus visible gagne — pas le premier croisé.
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActive(best.target.id);
      },
      { threshold: [0.35, 0.6, 0.85] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // --- Révélation au scroll (même grammaire que la Home) : wipe au
  // clip-path sur le chapitre, puis cascade des textes. clip-path + opacité,
  // donc aucun transform sur les conteneurs : rien ne casse le sticky.
  useEffect(() => {
    if (reduced || !rootRef.current) return undefined;
    const chapters = gsap.utils.toArray(".about__chapter", rootRef.current);
    if (!chapters.length) return undefined;

    const revealed = [];
    let safety = 0;

    const ctx = gsap.context(() => {
      chapters.forEach((c) => {
        gsap.fromTo(
          c,
          { clipPath: "inset(6% 0% 6% 0%)", opacity: 0.3 },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            opacity: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: c,
              start: "top 72%",
              end: "bottom 28%",
              toggleActions: "restart none none none",
            },
          },
        );

        const texts = gsap.utils.toArray(
          ".about__sec-head, h1, h2, h3, h4, p, figure, [class*='__card'], [class*='__concept'], [class*='__deploy-item']",
          c,
        );
        if (!texts.length) return;
        texts.forEach((el) => revealed.push(el));
        gsap.from(texts, {
          y: 34,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: {
            trigger: c,
            start: "top 68%",
            end: "bottom 32%",
            toggleActions: "restart none none none",
          },
        });
      });
      ScrollTrigger.refresh();
    }, rootRef);

    // Filet : si un trigger ne part pas, rien ne doit rester invisible.
    safety = window.setTimeout(() => {
      gsap.set(chapters, { opacity: 1, clearProps: "clipPath" });
      if (revealed.length) gsap.set(revealed, { opacity: 1, y: 0 });
    }, 3500);

    return () => {
      window.clearTimeout(safety);
      ctx.revert();
    };
  }, [reduced]);

  return (
    <main className="about" ref={rootRef}>
      {/* Décor de fond (aurora + trame), purement visuel */}
      <div className="about__bg" aria-hidden="true">
        {/* Voie lactée — même composant que le hero de la Home, mais très
            en retrait (opacité gérée en SCSS) : c'est une texture de fond,
            pas un ciel. Le produit étant sombre partout, elle est toujours
            montée. */}
        <MilkyWayCanvas className="about__bg-sky" count={900} speed={0.14} />
        <span className="about__bg-aurora" />
        <span className="about__bg-grid" />
      </div>

      {/* Nav discrète : rail de chapitres, libellé au survol/focus */}
      <nav className="about__rail" aria-label={t("about.eyebrow")}>
        <ul className="about__rail-list">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`about__rail-item${
                  active === s.id ? " is-active" : ""
                }`}
                aria-current={active === s.id ? "true" : undefined}
              >
                <span className="about__rail-num" aria-hidden="true">
                  {s.n}
                </span>
                <span className="about__rail-dot" aria-hidden="true" />
                <span className="about__rail-label">{t(s.key)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Pager — on VISITE la page chapitre par chapitre. */}
      <div className="about__pager" aria-label={t("about.pager_aria")}>
        <button
          type="button"
          className="about__pager-btn"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex <= 0}
          aria-label={t("about.prev")}
        >
          <FiChevronUp aria-hidden="true" />
        </button>

        <span className="about__pager-count">
          <span className="about__pager-cur">{SECTIONS[activeIndex].n}</span>
          <span className="about__pager-sep" aria-hidden="true">
            /
          </span>
          <span className="about__pager-tot">
            {SECTIONS[SECTIONS.length - 1].n}
          </span>
        </span>

        <button
          type="button"
          className="about__pager-btn about__pager-btn--next"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex >= SECTIONS.length - 1}
          aria-label={t("about.next")}
        >
          <FiChevronDown aria-hidden="true" />
          {activeIndex < SECTIONS.length - 1 ? (
            <span className="about__pager-label">
              {t(SECTIONS[activeIndex + 1].key)}
            </span>
          ) : null}
        </button>
      </div>

      <div className="about__inner container">
        {/* ============ OUVERTURE ============ */}
        <header className="about__chapter about__hero" id="ouverture">
          <div className="about__chapter-body">
            <Link to="/" className="about__back">
              <FiArrowLeft aria-hidden="true" /> {t("about.back")}
            </Link>

            <p className="eyebrow about__hero-eyebrow">{t("about.eyebrow")}</p>
            <h1 className="about__title">{t("about.title")}</h1>
            <p className="about__lead">{t("about.lead")}</p>


          </div>
        </header>

        {/* ============ 01 — DÉPÔT & TRAÇABILITÉ ============ */}
        {/* En tête de page : c'est ce que le jury doit pouvoir vérifier —
            l'historique des commits, et l'heure du dernier push. */}
        <section className="about__chapter about__depot" id="depot">
          <div className="about__chapter-body">
            <SecHead num="01" icon={<FiGithub />}>
              {t("about.repo.eyebrow")}
            </SecHead>
            <h2 className="about__h2">{t("about.repo.title")}</h2>
            <p className="about__depot-lead">{t("about.repo.body")}</p>

            <div className="about__depot-grid">
              <a
                className="about__repo"
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="about__repo-icon" aria-hidden="true">
                  <FiGithub />
                </span>
                <span className="about__repo-text">
                  <span className="about__repo-name">{REPO_LABEL}</span>
                  <span className="about__repo-meta">
                    {t("about.repo.meta")}
                  </span>
                </span>
                <span className="about__repo-cta">
                  {t("about.repo.cta")} <FiArrowUpRight aria-hidden="true" />
                </span>
              </a>

              {/* Chaîne de mise en ligne — hors du lien GitHub, pour que
                  l'adresse du site reste un lien à part entière. */}
              <div className="about__deploy">
                <p className="about__deploy-title">
                  {t("about.repo.deploy_title")}
                </p>
                <ul className="about__deploy-list">
                  {DEPLOY_FACTS.map((f) => (
                    <li className="about__deploy-item" key={f.key}>
                      <span className="about__deploy-ico" aria-hidden="true">
                        {f.icon}
                      </span>
                      <span className="about__deploy-text">
                        {f.key === "deploy_host" ? (
                          <>
                            <a
                              className="about__deploy-link"
                              href={SITE_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              www.krysto.io
                            </a>{" "}
                            {"—"} {t("about.repo.deploy_host")}
                          </>
                        ) : (
                          t(`about.repo.${f.key}`)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 02 — AUTEUR ============ */}
        <section className="about__chapter about__author" id="auteur">
          <div className="about__chapter-body">
            <SecHead num="02" icon={<FiUser />}>
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
          </div>
        </section>

        {/* ============ 03 — CONVICTION (récit Walmart) ============ */}
        <section className="about__chapter about__story" id="conviction">
          <div className="about__chapter-body">
            <SecHead num="03" icon={<FiZap />}>
              {t("about.story.eyebrow")}
            </SecHead>
            <h2 className="about__h2">{t("about.story.title")}</h2>

            <div className="about__story-grid">
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
                  <figcaption className="about__case-kicker">
                    {t("about.story.case_kicker")}
                  </figcaption>
                </figure>

                <div className="about__case-body">
                  <h3 className="about__case-title">
                    {t("about.story.case_title")}
                  </h3>
                  <p className="about__case-context">
                    {t("about.story.context")}
                  </p>

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
                      <h4 className="about__case-h">
                        {t("about.story.why_title")}
                      </h4>
                      <ul className="about__case-list">
                        <li>{t("about.story.why_1")}</li>
                        <li>{t("about.story.why_2")}</li>
                        <li>{t("about.story.why_3")}</li>
                        <li>{t("about.story.why_4")}</li>
                      </ul>
                    </div>
                  </div>

                  <p className="about__case-outcome">
                    {t("about.story.outcome")}
                  </p>

                  {/* Transposition : le récit Walmart est laissé intact,
                      mais on dit ce qu'il devient sur CES données-là. */}
                  <div className="about__case-bridge">
                    <p className="about__case-bridge-h">
                      {t("about.story.bridge_title")}
                    </p>
                    <p className="about__case-bridge-text">
                      {t("about.story.bridge_text")}
                    </p>
                  </div>

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
                          {s.label} {"·"} {t(`about.story.src_${s.kind}`)}{" "}
                          <FiArrowUpRight aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <aside className="about__concepts">
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
                      <span className="about__concept-body">
                        <span className="about__concept-term">
                          {t(`about.story.concept_${c.n}_t`)}
                        </span>
                        <span className="about__concept-def">
                          {t(`about.story.concept_${c.n}_d`)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="about__story-close">{t("about.story.close")}</p>
              </aside>
            </div>
          </div>
        </section>

        {/* ============ 04 — DONNÉES ============ */}
        <section className="about__chapter about__data" id="donnees">
          <div className="about__chapter-body">
            <SecHead num="04" icon={<FiDatabase />}>
              {t("about.data.eyebrow")}
            </SecHead>
            <h2 className="about__h2">{t("about.data.title")}</h2>

            <div className="about__data-grid">
              {/* Colonne gauche : d'où viennent les données, et comment. */}
              <div className="about__data-side">
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

                <div className="about__method">
                  <span className="about__method-label">
                    {t("about.data.note")}
                  </span>
                  <div className="about__method-scroll">
                    <p className="about__method-text">
                      {t("about.data.integrity")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Colonne droite : le catalogue. Une ligne par jeu — icône du
                  domaine + intitulé, rien de plus : la fiche complète est à
                  un clic, la ligne entière étant le lien. La description
                  reste en `title` pour le survol et les lecteurs d'écran. */}
              <div className="about__data-main">
                <div className="about__grid-scroll">
                  <div className="about__grid">
                    {DATASET_CATALOG.map((d) => {
                      const unofficial = d.official === false;
                      return (
                        <Link
                          className={`about__card${
                            unofficial ? " is-unofficial" : ""
                          }`}
                          key={d.id}
                          to={`/data/${d.id}`}
                          title={pick(d.descFr, d.descEn)}
                        >
                          <span className="about__card-icon" aria-hidden="true">
                            {TOPIC_ICONS[d.id]}
                          </span>
                          <span className="about__card-main">
                            <span className="about__card-title">
                              {pick(d.labelFr, d.labelEn)}
                            </span>
                            {unofficial ? (
                              <span className="about__card-badge">
                                {t("about.data.unofficial")}
                              </span>
                            ) : null}
                          </span>
                          <FiArrowUpRight
                            className="about__card-go"
                            aria-hidden="true"
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 05 — CONCOURS ============ */}
        <section className="about__chapter about__challenge" id="concours">
          {/* Le portrait revient en fond du dernier chapitre, très effacé :
              on referme sur la personne qui répond au concours. Décoratif,
              donc `alt` vide et aria-hidden — le portrait légendé est au
              chapitre 02. */}
          <span className="about__challenge-bg" aria-hidden="true">
            <img
              className="about__challenge-bg-img"
              src={mePhoto}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>

          <div className="about__chapter-body">
            <SecHead num="05" icon={<FiAward />}>
              {t("about.challenge.title")}
            </SecHead>

            <div className="about__challenge-inner">
              <span className="about__challenge-icon" aria-hidden="true">
                <FiAward />
              </span>
              <div className="about__challenge-text">
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
          </div>
        </section>
      </div>
    </main>
  );
}
