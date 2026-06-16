// src/hooks/UseInView.js
// ============================================================
// Hook de visibilité au scroll : renvoie [ref, inView, visible].
//   • inView  : passe à true UNE fois (révélation), reste true → pour déclencher
//               les apparitions/animations d'entrée.
//   • visible : LIVE, true tant que l'élément est à l'écran, false sinon →
//               sert à METTRE EN PAUSE les boucles d'animation hors écran
//               (économie CPU/batterie, surtout sur mobile).
// Rétro-compatible : les appelants qui font `const [ref, inView] = useInView()`
// continuent de fonctionner.
// ============================================================

import { useEffect, useRef, useState } from "react";

export default function useInView({ threshold = 0.18, rootMargin = "0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          setVisible(e.isIntersecting);
          if (e.isIntersecting) setInView(true);
        });
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView, visible];
}