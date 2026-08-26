// src/hooks/useThemeTokens.js
// ============================================================
// Lit les couleurs de la charte (custom properties CSS) en valeurs concrètes,
// pour les passer à des libs canvas (ECharts) qui ne résolvent pas var(--x).
// Se met à jour automatiquement au changement de thème (light/dark) via un
// MutationObserver sur [data-theme]/class de <html> et <body>.
// ============================================================

import { useEffect, useState, useCallback } from "react";

const KEYS = {
  bg: "--c-bg",
  bg2: "--c-bg-2",
  surface: "--c-surface",
  line: "--c-line",
  lineStrong: "--c-line-strong",
  text: "--c-text",
  textSoft: "--c-text-soft",
  textMute: "--c-text-mute",
  accent: "--c-accent",
  accentDeep: "--c-accent-deep",
  warm: "--c-warm",
  warmSoft: "--c-warm-soft",
  secondary: "--c-secondary",
  positive: "--c-positive",
  negative: "--c-negative",

  // --- Palette DATAVIZ (cf. _variables.scss § PALETTE DATAVIZ) ---
  // Réservée aux séries de graphiques. Les tokens ci-dessus habillent
  // l'interface : ne pas s'en servir pour colorer une série.
  series1: "--c-series-1",
  series2: "--c-series-2",
  series3: "--c-series-3",
  series4: "--c-series-4",
  series5: "--c-series-5",
  series6: "--c-series-6",
  series7: "--c-series-7",
  series8: "--c-series-8",

  seq100: "--c-seq-100",
  seq200: "--c-seq-200",
  seq300: "--c-seq-300",
  seq400: "--c-seq-400",
  seq500: "--c-seq-500",
  seq600: "--c-seq-600",
  seq700: "--c-seq-700",
  seq800: "--c-seq-800",
  seq900: "--c-seq-900",

  ord1: "--c-ord-1",
  ord2: "--c-ord-2",
  ord3: "--c-ord-3",
  ord4: "--c-ord-4",
  ord5: "--c-ord-5",
  ord6: "--c-ord-6",

  // Rampe divergente (lavande ↔ rouge, centre neutre) — dépend du thème.
  div1: "--c-div-1",
  div2: "--c-div-2",
  div3: "--c-div-3",
  div4: "--c-div-4",
  div5: "--c-div-5",
  div6: "--c-div-6",
  div7: "--c-div-7",
  div8: "--c-div-8",
  div9: "--c-div-9",
};

function readTokens() {
  if (typeof window === "undefined") return {};
  const cs = getComputedStyle(document.body || document.documentElement);
  const out = {};
  Object.entries(KEYS).forEach(([name, varName]) => {
    out[name] = cs.getPropertyValue(varName).trim() || "#888";
  });
  return out;
}

export default function useThemeTokens() {
  const [tokens, setTokens] = useState(readTokens);

  const refresh = useCallback(() => setTokens(readTokens()), []);

  useEffect(() => {
    refresh();
    const obs = new MutationObserver(refresh);
    const opts = { attributes: true, attributeFilter: ["data-theme", "class"] };
    if (document.documentElement) obs.observe(document.documentElement, opts);
    if (document.body) obs.observe(document.body, opts);
    return () => obs.disconnect();
  }, [refresh]);

  return tokens;
}