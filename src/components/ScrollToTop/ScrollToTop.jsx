// src/components/ScrollToTop/ScrollToTop.jsx
// ============================================================
// Remet la fenêtre en haut à chaque changement d'URL. Indispensable à
// l'immersion : on entre dans chaque acte par le début, jamais au milieu.
// Compatible Lenis : si le smooth scroll est actif, on utilise son
// scrollTo (immédiat) pour éviter tout conflit avec le scroll natif.
// Ne rend rien (composant utilitaire).
// ============================================================

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getLenis } from "../SmoothScroll/SmoothScroll";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname]);

  return null;
}