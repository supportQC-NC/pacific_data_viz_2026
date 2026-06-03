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