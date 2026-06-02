// src/pages/Home/Home.jsx
// ============================================================
// Accueil — ouverture cinématique (thèse + chiffre-choc + ligne de flottaison
// animée) puis récit en 3 CHAPITRES regroupant les 11 actes, présentés en
// grille éditoriale.
// GSAP pour l'entrée + parallax ; IntersectionObserver pour la révélation des
// actes. Aucun style inline en JSX. Respecte prefers-reduced-motion.
//
// NB : la jauge de progression latérale ("rail") a été retirée à la demande.
// ============================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import LanguageGate from "../../components/LanguageGate/LanguageGate";
import StatRotator from "../../components/StatRotator/StatRotator";
import "../../components/StatRotator/StatRotator.scss";
import "./Home.scss";

// Récit complet : 11 actes répartis en 3 chapitres narratifs.
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

export default function Home() {
  const { t } = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [gateOpen, setGateOpen] = useState(false);

  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const waterlineRef = useRef(null);
  const storyRef = useRef(null);
  const actsRef = useRef([]);

  const seaLevel = useSelector(selectDataset("seaLevel"));

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
  }, [dispatch]);

  const scrollToStory = () =>
    storyRef.current?.scrollIntoView({ behavior: "smooth" });

  const beginExperience = () => setGateOpen(true);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Intro : révélation orchestrée du hero.
  useLayoutEffect(() => {
    if (reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".home__eyebrow", { y: 18, opacity: 0, duration: 0.6 })
        .from(
          ".home__title span",
          { y: 44, opacity: 0, duration: 0.9, stagger: 0.12 },
          "-=0.2",
        )
        .from(".home__thesis", { y: 24, opacity: 0, duration: 0.7 }, "-=0.4")
        .from(".statrot", { y: 22, opacity: 0, duration: 0.7 }, "-=0.45")
        .from(".home__hero-foot", { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
        .from(".home__scrollcue", { opacity: 0, duration: 0.6 }, "-=0.1");
    }, heroRef);
    return () => ctx.revert();
  }, [reduced]);

  // Parallax du contenu + montée lente de la ligne de flottaison au scroll.
  useEffect(() => {
    if (reduced || !contentRef.current) return undefined;
    const setY = gsap.quickSetter(contentRef.current, "y", "px");
    const setA = gsap.quickSetter(contentRef.current, "opacity");
    const setWater = waterlineRef.current
      ? gsap.quickSetter(waterlineRef.current, "scaleY")
      : null;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const h = heroRef.current ? heroRef.current.offsetHeight : 1;
        const p = Math.min(1, Math.max(0, y / h));
        setY(y * 0.22);
        setA(1 - p * 0.9);
        if (setWater) setWater(0.12 + p * 0.5);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

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

  let globalIdx = -1;

  return (
    <main className="home">
      <LanguageGate open={gateOpen} onClose={() => setGateOpen(false)} />

      <section className="home__hero" ref={heroRef}>
        <div className="home__hero-overlay" aria-hidden="true" />
        <div className="home__waterline" ref={waterlineRef} aria-hidden="true" />

        <div className="home__hero-content container" ref={contentRef}>
          <p className="eyebrow home__eyebrow">{t("home.kicker")}</p>
          <h1 className="home__title">
            <span>{t("home.title_l1")}</span>
            <span className="home__title-accent">{t("home.title_l2")}</span>
          </h1>
          <p className="home__thesis">{t("home.thesis")}</p>

          <StatRotator
            items={[
              { num: t("home.stat1_num"), text: t("home.stat1_text") },
              { num: t("home.stat2_num"), text: t("home.stat2_text") },
              { num: t("home.stat3_num"), text: t("home.stat3_text") },
              { num: t("home.stat4_num"), text: t("home.stat4_text") },
            ]}
          />

          <div className="home__hero-foot">
            <button
              className="home__cta home__cta--primary"
              onClick={beginExperience}
            >
              {t("home.begin")} <span aria-hidden="true">✦</span>
            </button>
            <button
              className="home__cta home__cta--ghost"
              onClick={scrollToStory}
            >
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

        <button
          className="home__scrollcue"
          onClick={scrollToStory}
          aria-label={t("home.cta")}
        >
          <span className="home__scrollcue-line" />
        </button>
      </section>

      <section className="home__story container" ref={storyRef}>
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