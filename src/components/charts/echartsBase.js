// src/components/charts/echartsBase.js
// ============================================================
// Helpers partagés par les composants de graphiques (ECharts).
// Centralise : formats, stats, palette et styles d'axe/tooltip liés
// à la charte (tokens du thème). Évite la duplication entre charts.
// ============================================================

export const MONO = "IBM Plex Mono";
export const SANS = "Hanken Grotesk";

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");

export const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
};

export const paletteOf = (tk) => [
  tk.accent,
  tk.warm,
  tk.secondary,
  tk.positive,
  tk.accentDeep,
  tk.negative,
];

// Style d'axe commun (lignes discrètes en pointillé).
export const axisStyle = (tk) => ({
  axisLine: { lineStyle: { color: tk.line } },
  axisLabel: { color: tk.textMute, fontFamily: MONO },
  splitLine: { lineStyle: { color: tk.line, type: "dashed", opacity: 0.55 } },
  nameTextStyle: { color: tk.textMute },
});

export const tooltipStyle = (tk) => ({
  backgroundColor: tk.surface,
  borderColor: tk.line,
  borderWidth: 1,
  textStyle: { color: tk.text, fontFamily: SANS },
});

export const valAt = (serie, year) => {
  const p = serie.values.find((d) => d.year === year);
  return p ? p.value : null;
};