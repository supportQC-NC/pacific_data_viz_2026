// src/pages/Home/Home.jsx
// ============================================================
// Accueil — ouverture cinématique (hero + marée animée), puis MANIFESTE
// éditorial et les TROIS façons de lire les données. La navigation par acte
// vit désormais sur une page dédiée (/actes).
// GSAP pour l'entrée + parallax du hero. Aucun style inline. Respecte
// prefers-reduced-motion.
// ============================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang } from "../../store/context/langContext";
import LanguageGate from "../../components/LanguageGate/LanguageGate";
import HeroSeaRise from "../../components/HeroSeaRise/HeroSeaRise";
import HomeIntro from "../../components/HomeIntro/HomeIntro";
import ReadingModes from "../../components/ReadingModes/ReadingModes";
import KeyFigures from "../../components/KeyFigures/KeyFigures";
import TerritoryTrack from "../../components/TerritoryTrack/TerritoryTrack";
import PacificTeaser from "../../components/PacificTeaser/PacificTeaser";
import Territories from "../../components/Territories/Territories";
import DataMethod from "../../components/DataMethod/DataMethod";
import ClosingCta from "../../components/ClosingCta/ClosingCta";
import "./Home.scss";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const { t } = useLang();
  const navigate = useNavigate();

  const [gateOpen, setGateOpen] = useState(false);

  const heroRef = useRef(null);
  const contentRef = useRef(null);

  // Descendre sous le hero (vers le manifeste / les modes de lecture).
  const scrollDown = () =>
    window.scrollTo({
      top: heroRef.current ? heroRef.current.offsetHeight : window.innerHeight,
      behavior: "smooth",
    });

  const goActs = () => navigate("/actes");
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
        .from(".home__hero-foot", { y: 20, opacity: 0, duration: 0.6 }, "-=0.4")
        .from(".home__scrollcue", { opacity: 0, duration: 0.6 }, "-=0.1");
    }, heroRef);
    return () => ctx.revert();
  }, [reduced]);

  // Parallax du contenu du hero au scroll.
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

  // IMMERSION GLOBALE (scrollytelling) : à l'entrée dans le viewport, chaque
  // zone se DÉVOILE au clip-path (effet « wipe » premium) et ses textes
  // (kickers, titres, paragraphes, figures) MONTENT en fondu, en cascade —
  // le tout piloté par ScrollTrigger, donc par Lenis. On exclut le hero et le
  // track (animations propres). clip-path + opacité = sans transform → aucun
  // risque pour les éléments sticky. Filet de sécurité : rien ne reste caché.
  useEffect(() => {
    if (reduced) return undefined;
    const sections = gsap.utils
      .toArray(".home > section")
      .filter(
        (s) =>
          !s.classList.contains("home__hero") &&
          !s.classList.contains("ttrack"),
      );
    if (!sections.length) return undefined;

    const textTargets = [];
    let safety = 0;

    const ctx = gsap.context(() => {
      sections.forEach((s) => {
        // 1) Révélation de la SECTION : wipe vertical au clip-path.
        gsap.fromTo(
          s,
          { clipPath: "inset(7% 0% 7% 0%)", opacity: 0.25 },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            opacity: 1,
            duration: 1.1,
            ease: "power3.out",
            scrollTrigger: { trigger: s, start: "top 85%", once: true },
          },
        );

        // 2) Cascade des TEXTES (sauf chiffres-clés qui ont leur CountUp,
        //    et sauf éléments déjà animés via data-inview).
        if (s.classList.contains("keyfigs")) return;
        const texts = Array.from(
          s.querySelectorAll(
            ".eyebrow, h2, h3, h4, p, blockquote, figure, [class*='__card']",
          ),
        ).filter(
          (el) => !el.closest(".ttrack") && !el.hasAttribute("data-inview"),
        );
        if (!texts.length) return;
        texts.forEach((el) => textTargets.push(el));
        gsap.from(texts, {
          y: 38,
          opacity: 0,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: s, start: "top 80%", once: true },
        });
      });
      ScrollTrigger.refresh();
    });

    // Filet : si un trigger ne se déclenche pas, on révèle tout après 3,5 s.
    safety = window.setTimeout(() => {
      gsap.set(sections, { opacity: 1, clearProps: "clipPath" });
      if (textTargets.length) {
        gsap.to(textTargets, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          overwrite: "auto",
        });
      }
    }, 3500);

    return () => {
      window.clearTimeout(safety);
      ctx.revert();
      gsap.set(sections, { clearProps: "clipPath,opacity" });
      if (textTargets.length) {
        gsap.set(textTargets, { clearProps: "opacity,transform" });
      }
    };
  }, [reduced]);

  return (
    <main className="home">
      <LanguageGate open={gateOpen} onClose={() => setGateOpen(false)} />

      <section className="home__hero" ref={heroRef}>
        <div className="home__hero-overlay" aria-hidden="true" />
        <HeroSeaRise />

        <div className="home__hero-content container" ref={contentRef}>
          <p className="eyebrow home__eyebrow">{t("home.kicker")}</p>
          <h1 className="home__title">
            <span>{t("home.title_l1")}</span>
            <span className="home__title-accent">{t("home.title_l2")}</span>
          </h1>
          <p className="home__thesis">{t("home.thesis")}</p>

          <div className="home__hero-foot">
            <button
              className="home__cta home__cta--primary"
              onClick={beginExperience}
            >
              {t("home.begin")} <span aria-hidden="true">✦</span>
            </button>
            <button
              className="home__cta home__cta--ghost"
              onClick={scrollDown}
            >
              {t("home.cta")} <span aria-hidden="true">↓</span>
            </button>
            <button
              className="home__cta home__cta--ghost"
              onClick={() => navigate("/le-saviez-vous")}
            >
              {t("home.funfacts")} <span aria-hidden="true">✦</span>
            </button>
          </div>
        </div>

        <button
          className="home__scrollcue"
          onClick={scrollDown}
          aria-label={t("home.cta")}
        >
          <span className="home__scrollcue-line" />
        </button>
      </section>

      <KeyFigures />

      <TerritoryTrack />

      <HomeIntro />

      <ReadingModes
        onBrowse={goActs}
        onGuided={beginExperience}
        onFunFacts={() => navigate("/le-saviez-vous")}
      />

      <PacificTeaser />

      <Territories />

      <DataMethod />

      <ClosingCta onGuided={beginExperience} />
    </main>
  );
}