// src/components/HomeIntro/HomeIntro.jsx
// ============================================================
// Manifeste éditorial « LE PARTI PRIS ».
// Composition magazine : colonne GAUCHE = kicker + grand titre + corps ;
// colonne DROITE = visuel Pacifique PLEINE HAUTEUR (parallaxe douce), fondu
// dans le fond. En dessous, les trois piliers (Mesurer · Comprendre · Agir).
//
// Image : public/pacificIntro.jpg (URL absolue → build OK même si absente,
// dégradé de repli). Parallaxe via --py, coupée en prefers-reduced-motion.
// Tokens only, FR/EN, zéro inline (hors injection de --py dynamique).
// ============================================================

import React, { useEffect, useRef } from "react";
import { useLang } from "../../store/context/langContext";
import "./HomeIntro.scss";

const PILLARS = ["p1", "p2", "p3"];

export default function HomeIntro() {
  const { t } = useLang();
  const mediaRef = useRef(null);
  const innerRef = useRef(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const media = mediaRef.current;
    const inner = innerRef.current;
    if (!media || !inner) return undefined;

    let raf = 0;
    const update = () => {
      raf = 0;
      const r = media.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = (r.top + r.height / 2 - vh / 2) / vh; // [-1, 1]
      const offset = Math.max(-48, Math.min(48, -p * 70));
      inner.style.setProperty("--py", `${offset}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="homeintro">
      <div className="homeintro__inner container">
        <div className="homeintro__split">
          <div className="homeintro__col">
            <p className="eyebrow homeintro__kicker">{t("home.intro.kicker")}</p>
            <h2 className="homeintro__lead">{t("home.intro.lead")}</h2>
            <div className="homeintro__body">
              <p>{t("home.intro.body1")}</p>
              <p>{t("home.intro.body2")}</p>
            </div>
          </div>

          <figure className="homeintro__media" ref={mediaRef} aria-hidden="true">
            <div className="homeintro__media-inner" ref={innerRef} />
          </figure>
        </div>

        <ul className="homeintro__pillars">
          {PILLARS.map((p, i) => (
            <li className="homeintro__pillar" key={p}>
              <span className="homeintro__pillar-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="homeintro__pillar-title">
                {t(`home.intro.${p}_title`)}
              </h3>
              <p className="homeintro__pillar-text">
                {t(`home.intro.${p}_text`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}