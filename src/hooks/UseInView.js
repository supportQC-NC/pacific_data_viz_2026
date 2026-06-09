// src/hooks/useInView.js
// ============================================================
// Petit hook de révélation au scroll : renvoie [ref, inView].
// inView passe à true une seule fois quand l'élément entre dans le viewport.
// Sert à harmoniser les apparitions des sections de l'accueil.
// ============================================================

import { useEffect, useRef, useState } from "react";

export default function useInView({ threshold = 0.18, rootMargin = "0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}