// src/components/ScrollToTop/ScrollToTop.jsx
// ============================================================
// Remet la fenêtre en haut à chaque changement d'URL. Indispensable à
// l'immersion : on entre dans chaque acte par le début, jamais au milieu.
// Ne rend rien (composant utilitaire). Respecte prefers-reduced-motion.
// ============================================================

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduced ? "auto" : "auto" });
  }, [pathname]);

  return null;
}
