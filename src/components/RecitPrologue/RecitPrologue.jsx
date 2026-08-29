// src/components/RecitPrologue/RecitPrologue.jsx
// ============================================================
// PROLOGUE DU RÉCIT — « La couverture » (v7).
// Couverture de récit : titre en grotesque moderne (voix « données »), une
// CITATION d'auteur (serif italique), et une ligne concrète qui annonce le
// propos. La pirogue, fil rouge, cingle vers l'est sur une nuit étoilée.
//
// ---------------------------------------------------------------------------
// LA CITATION A CHANGÉ — ET POURQUOI.
//
// Elle portait « We are not drowning, we are fighting », cri de ralliement des
// Pacific Climate Warriors. La phrase est authentique et bien documentée : ce
// n'est pas sa véracité qui posait problème, c'est sa FORME. C'est un slogan
// collectif, pas une phrase d'auteur, et surtout elle nomme la noyade avant de
// la refuser — on ouvre le récit sur l'image qu'on voulait écarter.
//
// À sa place, Epeli Hau'ofa (1939–2008), écrivain et anthropologue tongien-
// fidjien, dans « Our Sea of Islands » (1993) — le texte fondateur qui a
// retourné le regard porté sur la région : non pas des « petits États
// insulaires » isolés et minuscules, mais une mer d'îles immense, parcourue
// depuis toujours. C'est exactement le renversement que le récit opère avec
// des chiffres, dit en huit mots trente ans plus tôt.
//
// Le titre original est conservé dans la citation des deux langues : le texte
// est anglophone, la ligne française en est une traduction, et l'indiquer
// vaut mieux que de le laisser croire écrit en français.
// ---------------------------------------------------------------------------
//
// prefers-reduced-motion respecté.
// Props : onStart() — démarre le voyage (1re escale).
// ============================================================

import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import StarfieldCanvas from "../StarfieldCanvas/StarfieldCanvas";
import MilkyWayCanvas from "../MilkyWayCanvas/MilkyWayCanvas";
import "./RecitPrologue.scss";

// --- La prose de couverture (à valider) ---------------------------------
const COPY = {
  fr: {
    // Échangé avec le hero de la Home : la Home porte désormais « Nos
    // ancêtres lisaient les étoiles », et le Récit s'ouvre sur la promesse
    // de lecture par la donnée.
    title1: "Lire le Pacifique",
    title2: "par ses données.",
    quote: "« Nous sommes la mer, nous sommes l'océan. »",
    cite: "Epeli Hau'ofa · Our Sea of Islands, 1993",
    // « Du constat à la riposte » ouvrait sur un coup encaissé et une défense.
    // La ligne dit maintenant les deux choses que l'application montre
    // réellement — ce qui est mesuré, et ce qui est entrepris — sans passer
    // par la négation.
    tagline:
      "Le climat du Pacifique, lu dans ses propres données : ce que la région mesure, et ce qu'elle entreprend.",
    cue: "Commencer le voyage",
  },
  en: {
    title1: "Reading the Pacific",
    title2: "through its data.",
    quote: "“We are the sea, we are the ocean.”",
    cite: "Epeli Hau'ofa · Our Sea of Islands, 1993",
    tagline:
      "The Pacific’s climate, read in its own data: what the region measures, and what it is doing about it.",
    cue: "Begin the voyage",
  },
};

export default function RecitPrologue({ onStart }) {
  const { lang } = useLang();
  const c = COPY[lang === "en" ? "en" : "fr"];
  const rootRef = useRef(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const begin = () => {
    if (onStart) return onStart();
    window.scrollTo({
      top: rootRef.current ? rootRef.current.offsetHeight : window.innerHeight,
      behavior: "smooth",
    });
  };

  useLayoutEffect(() => {
    if (reduced) return undefined;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".rprologue__mark", {
          opacity: 0,
          scale: 0,
          rotate: -90,
          duration: 0.9,
          transformOrigin: "center",
        })
        .from(
          ".rprologue__title-line",
          { y: 42, opacity: 0, duration: 0.95, stagger: 0.15 },
          "-=0.5",
        )
        .from(
          ".rprologue__quote",
          { y: 22, opacity: 0, duration: 0.8 },
          "-=0.4",
        )
        .from(
          ".rprologue__tagline",
          { y: 18, opacity: 0, duration: 0.7 },
          "-=0.5",
        )
        .from(".rprologue__foot", { y: 20, opacity: 0, duration: 0.6 }, "-=0.3")
        .from(
          ".rprologue__vaa",
          { x: -140, opacity: 0, duration: 1.6, ease: "power2.out" },
          "-=1.0",
        )
        .from(".rprologue__cue", { opacity: 0, duration: 0.6 }, "-=0.6");
    }, rootRef);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <header className="rprologue" ref={rootRef}>
      {/* --- Décor --- */}
      <div className="rprologue__sky" aria-hidden="true" />
      {/* VOIE LACTÉE 3D, tout au fond — même canvas que le hero de la Home.
          Le Prologue est déjà nocturne, elle s'y lit donc encore mieux.
          z-index entre le ciel (-5) et le champ d'étoiles (-4) : elle passe
          derrière les étoiles, qui gardent le premier plan stellaire. */}
      <MilkyWayCanvas className="rprologue__milkyway" />
      <StarfieldCanvas />
      <div className="rprologue__vignette" aria-hidden="true" />

      <div className="rprologue__sea" aria-hidden="true">
        <div className="rprologue__glimmer" />
        <svg
          className="rprologue__waves"
          viewBox="0 0 1440 220"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="rprologue__wave rprologue__wave--back"
            d="M0 90 Q 240 50 480 90 T 960 90 T 1440 90 V220 H0 Z"
          />
          <path
            className="rprologue__wave rprologue__wave--mid"
            d="M0 120 Q 240 85 480 120 T 960 120 T 1440 120 V220 H0 Z"
          />
          <path
            className="rprologue__wave rprologue__wave--front"
            d="M0 150 Q 240 120 480 150 T 960 150 T 1440 150 V220 H0 Z"
          />
        </svg>
      </div>

      {/* --- La pirogue (fil rouge) --- */}
      <div className="rprologue__vaa" aria-hidden="true">
        <div className="rprologue__vaa-inner">
          <svg viewBox="0 0 260 200" role="img" aria-label="Va'a">
            <path className="rprologue__wake" d="M8 174 Q 70 169 120 174" />
            <path className="rprologue__wake" d="M22 184 Q 78 181 122 184" />
            <ellipse
              className="rprologue__vaa-shadow"
              cx="150"
              cy="186"
              rx="76"
              ry="6"
            />
            <path
              className="rprologue__sail"
              d="M150 26 C 200 48 218 102 216 152 C 184 141 162 124 150 109 Z"
            />
            <path
              className="rprologue__sail rprologue__sail--back"
              d="M150 32 C 122 57 112 102 114 146 C 137 133 146 120 150 109 Z"
            />
            <line
              className="rprologue__mast"
              x1="150"
              y1="24"
              x2="150"
              y2="166"
            />
            <path
              className="rprologue__hull"
              d="M90 168 Q 150 193 210 168 Q 183 181 150 181 Q 117 181 90 168 Z"
            />
            <path className="rprologue__ama" d="M86 191 Q 150 201 208 191" />
            <line
              className="rprologue__iako"
              x1="121"
              y1="177"
              x2="115"
              y2="191"
            />
            <line
              className="rprologue__iako"
              x1="179"
              y1="177"
              x2="185"
              y2="191"
            />
          </svg>
        </div>
      </div>

      {/* --- Couverture éditoriale --- */}
      <div className="rprologue__inner">
        <svg className="rprologue__mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0 L13.4 9.2 L24 12 L13.4 14.8 L12 24 L10.6 14.8 L0 12 L10.6 9.2 Z" />
        </svg>

        <h1 className="rprologue__title">
          <span className="rprologue__title-line">{c.title1}</span>
          <span className="rprologue__title-line rprologue__title-line--accent">
            {c.title2}
          </span>
        </h1>

        <blockquote className="rprologue__quote">
          <p className="rprologue__quote-text">{c.quote}</p>
          <cite className="rprologue__cite">{c.cite}</cite>
        </blockquote>

        <p className="rprologue__tagline">{c.tagline}</p>

        <div className="rprologue__foot">
          <button type="button" className="rprologue__begin" onClick={begin}>
            {c.cue} <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        className="rprologue__cue"
        onClick={begin}
        aria-label={c.cue}
      >
        <span className="rprologue__cue-line" />
      </button>
    </header>
  );
}
