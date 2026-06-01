// src/pages/Home/Home.jsx
// ============================================================
// Accueil — hero OCÉAN WebGL (la mer monte) + récit en 5 actes
// pensé comme une DESCENTE (cartes, révélation au scroll, jauge de
// profondeur). L'indicateur de données est HONNÊTE : il distingue
// les données « en direct » (Pacific Data Hub) des données de
// démonstration, et n'affiche jamais l'un pour l'autre.
// Aucun style inline (GSAP/refs). Respecte prefers-reduced-motion.
// ============================================================

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import HeroOcean from "../../components/HeroOcean/HeroOcean";
import "./Home.scss";

const ACTS = [
  { id: "a1", to: "/emissions" },
  { id: "a2", to: "/ocean" },
  { id: "a3", to: "/territory" },
  { id: "a4", to: "/impact" },
  { id: "a5", to: "/momentum" },
  { id: "a6", to: "/agriculture" },
];

// Sévérité régionale (0..1) → hauteur d'eau du hero. Reste douce pour
// que la mer soit toujours belle, mais « plus haut = plus de hausse ».
function computeRise(seaLevel) {
  const DEFAULT = 0.46;
  if (!seaLevel || seaLevel.status !== "succeeded" || !seaLevel.data) return DEFAULT;
  const { byArea } = seaLevel.data;
  const areas = Object.values(byArea || {});
  if (!areas.length) return DEFAULT;
  let sum = 0;
  let n = 0;
  areas.forEach((serie) => {
    const last = serie[serie.length - 1];
    if (last && Number.isFinite(last.value)) {
      sum += last.value;
      n += 1;
    }
  });
  if (!n) return DEFAULT;
  const mean = sum / n; // niveau cumulé moyen (mm)
  const severity = Math.max(0, Math.min(1, mean / 220)); // ~220 mm → plafond
  return 0.4 + severity * 0.32; // 0.40 → 0.72
}

export default function Home() {
  const { t } = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const storyRef = useRef(null);
  const railFillRef = useRef(null);
  const actsRef = useRef([]);

  const [activeAct, setActiveAct] = useState(-1);

  const seaLevel = useSelector(selectDataset("seaLevel"));
  const rise = useMemo(() => computeRise(seaLevel), [seaLevel]);

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
  }, [dispatch]);

  const scrollToStory = () =>
    storyRef.current?.scrollIntoView({ behavior: "smooth" });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Entrée GSAP du hero.
  useLayoutEffect(() => {
    if (reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".home__eyebrow", { y: 18, opacity: 0, duration: 0.6 })
        .from(
          ".home__title span",
          { y: 46, opacity: 0, duration: 0.9, stagger: 0.12 },
          "-=0.2"
        )
        .from(".home__subtitle", { y: 24, opacity: 0, duration: 0.7 }, "-=0.45")
        .from(".home__hero-foot", { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
        .from(".home__scrollcue", { opacity: 0, duration: 0.6 }, "-=0.1");
    }, heroRef);
    return () => ctx.revert();
  }, [reduced]);

  // Parallaxe + fondu du contenu hero au scroll.
  useEffect(() => {
    if (reduced || !contentRef.current) return undefined;
    const setY = gsap.quickSetter(contentRef.current, "y", "px");
    const setA = gsap.quickSetter(contentRef.current, "opacity");
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
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Révélation des actes + acte actif (pour la jauge).
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
      { threshold: 0.18 }
    );
    const activeObs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting)
            setActiveAct((p) =>
              Math.max(p, Number(e.target.getAttribute("data-idx")))
            );
        }),
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    nodes.forEach((n) => {
      revealObs.observe(n);
      activeObs.observe(n);
    });
    return () => {
      revealObs.disconnect();
      activeObs.disconnect();
    };
  }, []);

  // Remplissage de la jauge de profondeur.
  useEffect(() => {
    if (!railFillRef.current) return;
    const ratio = activeAct < 0 ? 0 : (activeAct + 1) / ACTS.length;
    gsap.to(railFillRef.current, {
      scaleY: ratio,
      duration: reduced ? 0 : 0.6,
      ease: "power2.out",
    });
  }, [activeAct, reduced]);

  // Indicateur de données — HONNÊTE selon la source réelle.
  let live;
  const status = seaLevel.status;
  if (status === "loading" || status === "idle") {
    live = <span className="home__live-text">{t("home.live_loading")}</span>;
  } else if (status === "failed") {
    live = (
      <span className="home__live-text home__live-text--err">
        {t("home.live_error")}
      </span>
    );
  } else {
    const d = seaLevel.data;
    const isLive = d?.source === "live";
    const span = d?.firstYear && d?.lastYear ? ` · ${d.firstYear}–${d.lastYear}` : "";
    live = (
      <span className="home__live-text">
        {isLive ? t("home.live_label") : t("home.live_demo")} —{" "}
        <strong>{d.areas.length}</strong> {t("home.live_coverage")}
        {span}
      </span>
    );
  }
  const dotStatus =
    status === "succeeded" && seaLevel.data?.source !== "live"
      ? "demo"
      : status;

  return (
    <main className="home">
      <section className="home__hero" ref={heroRef}>
        <HeroOcean riseTarget={rise} />
        <div className="home__hero-veil" aria-hidden="true" />

        <div className="home__hero-content container" ref={contentRef}>
          <p className="eyebrow home__eyebrow">{t("home.kicker")}</p>
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
                className={`home__live-dot home__live-dot--${dotStatus}`}
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

        <div className="home__waterline" aria-hidden="true" />
      </section>

      <section className="home__story container" ref={storyRef}>
        <div className="home__rail" aria-hidden="true">
          <div className="home__rail-track">
            <div className="home__rail-fill" ref={railFillRef} />
          </div>
          <ol className="home__rail-dots">
            {ACTS.map((a, i) => (
              <li
                key={a.id}
                className={`home__rail-dot ${i <= activeAct ? "is-passed" : ""}`}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
              </li>
            ))}
          </ol>
        </div>

        <header className="home__story-head">
          <p className="eyebrow">{t("home.acts_kicker")}</p>
          <h2 className="home__story-intro">{t("home.acts_intro")}</h2>
        </header>

        <ol className="home__acts">
          {ACTS.map((a, i) => (
            <li
              key={a.id}
              data-idx={i}
              ref={(el) => {
                actsRef.current[i] = el;
              }}
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
              <span className="act__ghost" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="act__inner">
                <div className="act__meta">
                  <span className="act__index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="eyebrow act__tag">{t(`home.acts.${a.id}_tag`)}</p>
                </div>
                <h3 className="act__title">{t(`home.acts.${a.id}_title`)}</h3>
                <p className="act__text">{t(`home.acts.${a.id}_text`)}</p>
                {a.to ? (
                  <span className="act__action">
                    {t("home.act_explore")} <span aria-hidden="true">→</span>
                  </span>
                ) : (
                  <span className="act__action act__action--soon">
                    {t("home.act_soon")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}