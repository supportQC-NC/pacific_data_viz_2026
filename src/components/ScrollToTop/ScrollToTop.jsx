// src/components/ScrollToTop/ScrollToTop.jsx
// Remet la fenêtre en haut à chaque changement d'URL, pour entrer dans
// chaque page par le début. Ne rend rien.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}