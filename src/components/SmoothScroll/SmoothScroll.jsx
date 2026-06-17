// src/components/SmoothScroll/SmoothScroll.jsx
// ============================================================
// Smooth scroll global (Lenis) branché sur GSAP ScrollTrigger.
// - Le scroll inertiel « studio » pilote ScrollTrigger via gsap.ticker,
//   donc le pin du TerritoryTrack et les animations des actes restent
//   parfaitement synchronisés (pas de désync, pas de saccade).
// - Respecte prefers-reduced-motion (aucun smooth si l'utilisateur le
//   demande -> on retombe sur le scroll natif).
// - Expose getLenis() pour que ScrollToTop remette la page en haut
//   proprement à chaque changement de route.
//
// Installation requise :  npm i lenis
// ============================================================

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

// Instance partagée (singleton) pour ScrollToTop & co.
let lenisInstance = null;
export function getLenis() {
  return lenisInstance;
}

export default function SmoothScroll({ children }) {
  useEffect(() => {
    const reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const lenis = new Lenis({
      duration: 1.1,
      // easing « expo out » : départ vif, fin très douce (signature premium)
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });
    lenisInstance = lenis;

    // Lenis -> ScrollTrigger : à chaque frame de scroll, on met à jour les triggers.
    lenis.on("scroll", ScrollTrigger.update);

    // GSAP pilote la boucle rAF de Lenis (une seule horloge pour tout).
    const onRaf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onRaf);
    gsap.ticker.lagSmoothing(0);

    // Les positions ont pu changer (polices, images) -> on recalcule.
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(onRaf);
      lenis.destroy();
      if (lenisInstance === lenis) lenisInstance = null;
    };
  }, []);

  return children;
}