// src/components/ScrollStory/ScrollStory.jsx
// ============================================================
// Wrapper de SCROLLYTELLING HORIZONTAL réutilisable. La section se « pin » et
// le scroll vertical NORMAL pilote la translation horizontale d'une piste de
// panneaux (pas de scroll-jacking). À chaque palier, le parent reçoit l'index
// actif (onStep) pour activer filtres / faits, et une phrase explicative
// s'affiche dans le bandeau (captions[step]).
//
// Accessibilité : sur petit écran ou prefers-reduced-motion, repli en pile
// VERTICALE lisible (chaque panneau + sa phrase), sans pin ni translation.
//
// Props :
//   panels   : ReactNode[]  (contenu plein cadre de chaque panneau)
//   captions : string[]     (phrase par panneau)
//   onStep   : (i)=>void     (palier actif)
//   hint     : string        (indice « continuez à défiler »)
// ============================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./ScrollStory.scss";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollStory({ panels, captions = [], onStep, hint }) {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [step, setStep] = useState(0);
  const [simple, setSimple] = useState(false);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (reduced || window.innerWidth < 760) {
      setSimple(true);
      return undefined;
    }
    setSimple(false);

    const n = panels.length;
    const ctx = gsap.context(() => {
      const track = trackRef.current;
      const getShift = () =>
        Math.max(0, track.scrollWidth - viewportRef.current.clientWidth);

      gsap.to(track, {
        x: () => -getShift(),
        ease: "none",
        scrollTrigger: {
          trigger: viewportRef.current,
          start: "top top",
          end: () => "+=" + getShift(),
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const s = Math.max(
              0,
              Math.min(n - 1, Math.floor(self.progress * n - 1e-6)),
            );
            setStep((prev) => (prev === s ? prev : s));
          },
        },
      });
    }, sectionRef);

    const id = window.setTimeout(() => ScrollTrigger.refresh(), 60);
    return () => {
      window.clearTimeout(id);
      ctx.revert();
    };
  }, [reduced, panels.length]);

  useEffect(() => {
    if (onStep) onStep(simple ? -1 : step);
  }, [step, simple, onStep]);

  if (simple) {
    return (
      <section className="story story--simple" ref={sectionRef}>
        {panels.map((p, i) => (
          <div className="story__simple-panel" key={i}>
            <div className="story__simple-content">{p}</div>
            {captions[i] && (
              <p className="story__simple-caption">{captions[i]}</p>
            )}
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="story" ref={sectionRef}>
      <div className="story__viewport" ref={viewportRef}>
        <div className="story__track" ref={trackRef}>
          {panels.map((p, i) => (
            <div className="story__panel" key={i}>
              {p}
            </div>
          ))}
        </div>

        <div className="story__hud">
          <p className="story__caption" key={step}>
            {captions[step]}
          </p>
          <div className="story__dots" aria-hidden="true">
            {panels.map((_, i) => (
              <span
                key={i}
                className={`story__dot ${i === step ? "is-on" : ""}`}
              />
            ))}
          </div>
          {hint && step === 0 && (
            <p className="story__hint" aria-hidden="true">
              {hint}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}