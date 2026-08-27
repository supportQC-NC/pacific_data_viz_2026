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
import HeroSeaRise, {
  seaLevelAt,
  SEA_LEVEL_MIN,
  SEA_LEVEL_PEAK_AT,
} from "../../components/HeroSeaRise/HeroSeaRise";
import StarfieldCanvas from "../../components/StarfieldCanvas/StarfieldCanvas";
import MilkyWayCanvas from "../../components/MilkyWayCanvas/MilkyWayCanvas";
import ShootingStar from "../../components/ShootingStar/ShootingStar";
import Vaa from "../../components/Vaa/Vaa";
import HomeIntro from "../../components/HomeIntro/HomeIntro";
import PacificTeaser from "../../components/PacificTeaser/PacificTeaser";
import Territories from "../../components/Territories/Territories";
import DataMethod from "../../components/DataMethod/DataMethod";
import ClosingCta from "../../components/ClosingCta/ClosingCta";
import "./Home.scss";

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const { t } = useLang();

  const navigate = useNavigate();
  const [warping, setWarping] = useState(false); // plongée dans les étoiles

  const heroRef = useRef(null);
  const contentRef = useRef(null);
  const vaaRef = useRef(null); // la pirogue, que la montée des eaux fait disparaître

  // Descendre sous le hero (vers le manifeste / les modes de lecture).
  const scrollDown = () =>
    window.scrollTo({
      top: heroRef.current ? heroRef.current.offsetHeight : window.innerHeight,
      behavior: "smooth",
    });

  // ENTRÉE DANS LE RÉCIT — on plonge d'abord dans les étoiles, puis on arrive
  // sur le prologue. Plus d'écran de choix de langue sur ce chemin : la
  // langue se change dans le header, et le voyage démarre depuis le prologue
  // (« Commencer le voyage » y appelle startJourney).
  //
  // Le délai correspond à la rampe d'accélération du canvas : assez pour voir
  // les traînées se former, assez court pour ne pas faire attendre.
  // `prefers-reduced-motion` court-circuite la plongée et navigue tout de suite.
  const beginExperience = () => {
    const reducedNow =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedNow) {
      navigate("/recit");
      return;
    }
    setWarping(true);
    window.setTimeout(() => navigate("/recit"), 900);
  };

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

  // Parallax du contenu du hero au scroll + ENGLOUTISSEMENT DE LA PIROGUE.
  useEffect(() => {
    if (reduced || !contentRef.current) return undefined;
    const setY = gsap.quickSetter(contentRef.current, "y", "px");
    const setA = gsap.quickSetter(contentRef.current, "opacity");
    const setVaaA = vaaRef.current
      ? gsap.quickSetter(vaaRef.current, "opacity")
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

        // LA MER MONTE ET AVALE LA PIROGUE — définitivement.
        //
        // On utilise le VRAI niveau de HeroSeaRise (seaLevelAt), pas une
        // copie de sa formule. Mais cette courbe est EN CLOCHE : elle monte
        // jusqu'à mi-scroll puis REDESCEND. Appliquée telle quelle, la
        // pirogue réapparaissait en scrollant plus bas.
        //
        // On borne donc l'entrée au pic (SEA_LEVEL_PEAK_AT) : le niveau
        // devient monotone croissant, puis reste à son maximum. Une fois
        // engloutie, la pirogue ne ressort jamais.
        //
        // Repères : la coque est à 9 % du bas, le haut du mât à ~30 % —
        // hauteur où se trouvent aussi les boutons. L'eau atteint le mât,
        // l'opacité vaut 0.
        if (setVaaA) {
          const level = seaLevelAt(Math.min(p, SEA_LEVEL_PEAK_AT));
          const HULL = SEA_LEVEL_MIN; // l'eau touche la coque
          const MAST = 0.3; // l'eau atteint le mât / le niveau des boutons
          const sunk = Math.min(1, Math.max(0, (level - HULL) / (MAST - HULL)));
          setVaaA(1 - sunk);
        }
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

      <section className="home__hero" ref={heroRef}>
        <div className="home__hero-overlay" aria-hidden="true" />

        {/* NUIT + VOIE LACTÉE — indispensable AVANT les étoiles : le hero a
            une photo sous-marine claire en fond, et un champ d'étoiles clair
            sur fond clair est purement invisible (constaté à l'écran).
            Cette couche installe une nuit qui s'ouvre en haut à gauche, avec
            une bande laiteuse en diagonale, et se dissipe vers la mer. */}
        <div className="home__sky" aria-hidden="true">
          {/* Voie lactée 3D : étoiles en volume, projetées en perspective,
              qu'on traverse lentement. Le dégradé CSS précédent ne tenait pas
              — il se lisait comme un aplat, pas comme une galaxie. */}
          <MilkyWayCanvas className="home__milkyway" warp={warping} />
        </div>

        {/* CIEL ÉTOILÉ — même composant que le Prologue et les traversées :
            étoiles, constellations, étoiles filantes, et la « lanterne du
            navigateur » (le curseur allume les étoiles proches et trace des
            fils vers elles). Placé AVANT la mer pour que la houle se peigne
            par-dessus le bas du ciel. */}
        {/* Densité NETTEMENT relevée par rapport au défaut (0.00016 / 150),
            calibré pour le Prologue : ici le ciel doit tenir toute la largeur
            d'un hero plein écran. Réglé par PROPS uniquement — le composant
            partagé (Prologue, traversées) garde ses valeurs. */}
        <StarfieldCanvas
          className="home__stars"
          density={0.00042}
          maxStars={460}
          linkDist={112}
          lanternRadius={190}
        />

        {/* ÉTOILE FILANTE — entre en haut à gauche, décrit un arc et
            s'éteint près de l'horizon. Canvas dédié : il ne dessine que la
            filante, et rien du tout entre deux passages. */}
        <ShootingStar className="home__shooting" />

        <HeroSeaRise />

        {/* LA PIROGUE, posée sur la houle. La ligne d'eau de HeroSeaRise vaut
            0.11 + 0.45·sin(scroll·π) : elle MONTE au scroll. La pirogue est
            donc calée sur le niveau initial (scroll 0), l'état où le hero se
            regarde ; plus bas dans la page, le contenu du hero s'efface de
            toute façon en parallaxe. */}
        <div className="home__vaa" ref={vaaRef} aria-hidden="true">
          <Vaa withWake />
        </div>

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
            {/* Second bouton : les SOURCES, vers « À propos ». Il ne fait plus
                défiler la page — c'est le seul endroit du hero qui mène à la
                provenance des données, ce qui compte pour un lecteur qui veut
                vérifier avant de lire. */}
            <button
              className="home__cta home__cta--ghost"
              onClick={() => navigate("/a-propos")}
            >
              {t("home.sources")} <span aria-hidden="true">→</span>
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

      {/* LES VISUELS SIGNATURE VIVENT MAINTENANT DANS LES ESCALES.
          Les dix-sept dessins interactifs lisaient déjà, chacun, le jeu de
          données d'une escale précise — la plante et `cropYield`, le verre et
          l'eau potable, le camembert et le mix électrique, le rivage et le
          trait de côte. Ils y sont désormais la vue d'ouverture, avec leur
          interaction complète.

          Les monter aussi ici faisait de la Home une première visite hors
          contexte, et de l'escale une redite. Les composants ne sont pas
          touchés : seule leur adresse a changé. */}

      <HomeIntro />

      <PacificTeaser />

      <Territories />

      <DataMethod />

      <ClosingCta onGuided={beginExperience} />
    </main>
  );
}