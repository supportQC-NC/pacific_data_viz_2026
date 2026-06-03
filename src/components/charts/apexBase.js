// src/components/charts/apexBase.js
// ============================================================
// Helpers partagés par les composants de graphiques (ApexCharts).
// Pendant ApexCharts de `echartsBase.js` : fabriques d'options de base
// (chart, grille, axes, légende, tooltip) liées à la charte (tokens du
// thème light/dark). Les helpers maths (median, quantile, valAt, fmt) NE
// sont PAS redéfinis ici : on les réimporte d'echartsBase pour éviter toute
// duplication. Aucune couleur en dur : tout vient des tokens.
// ============================================================

import { MONO, SANS, fmt, median, quantile, valAt } from "./echartsBase";

// Réexport pour que les charts n'aient qu'un seul import.
export { MONO, SANS, fmt, median, quantile, valAt };

// Palette qualitative (mêmes teintes que la version ECharts).
export const apexPalette = (tk) => [
  tk.accent,
  tk.warm,
  tk.secondary,
  tk.positive,
  tk.accentDeep,
  tk.negative,
];

// Rampe séquentielle (faible -> élevé) pour les heatmaps.
export const apexRamp = (tk) => [
  tk.positive,
  tk.accent,
  tk.secondary,
  tk.warm,
  tk.negative,
];

// Bloc `chart` de base : police, couleurs neutres via tokens, fond
// transparent (le panneau gère le fond), toolbar masquée par défaut.
export const baseChart = (tk, extra = {}) => ({
  fontFamily: SANS,
  foreColor: tk.textMute,
  background: "transparent",
  toolbar: { show: false },
  zoom: { enabled: false },
  selection: { enabled: false },
  animations: {
    enabled: true,
    easing: "easeinout",
    speed: 600,
    animateGradually: { enabled: false },
    dynamicAnimation: { enabled: true, speed: 350 },
  },
  ...extra,
});

export const baseGrid = (tk, extra = {}) => ({
  borderColor: tk.line,
  strokeDashArray: 4,
  xaxis: { lines: { show: false } },
  yaxis: { lines: { show: true } },
  padding: { left: 8, right: 14, top: 6, bottom: 2 },
  ...extra,
});

export const baseLegend = (tk, extra = {}) => ({
  show: true,
  position: "top",
  horizontalAlign: "left",
  fontFamily: MONO,
  fontSize: "11px",
  labels: { colors: tk.textSoft },
  markers: { width: 9, height: 9, radius: 3 },
  itemMargin: { horizontal: 8, vertical: 3 },
  ...extra,
});

export const baseXaxis = (tk, extra = {}) => ({
  axisBorder: { show: true, color: tk.line },
  axisTicks: { show: true, color: tk.line },
  labels: {
    style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
  },
  title: {
    style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" },
  },
  crosshairs: { stroke: { color: tk.line, dashArray: 3 } },
  tooltip: { enabled: false },
  ...extra,
});

export const baseYaxis = (tk, extra = {}) => ({
  axisBorder: { show: false, color: tk.line },
  axisTicks: { show: false, color: tk.line },
  labels: {
    style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
  },
  title: {
    style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" },
  },
  ...extra,
});

// Tooltip : on le laisse en clair côté JS ; l'habillage couleur (surface,
// bordure, texte) est forcé par ApexChart.scss via les variables --c-*,
// donc il suit automatiquement le thème.
export const baseTooltip = (extra = {}) => ({
  shared: false,
  intersect: true,
  followCursor: true,
  style: { fontSize: "12px", fontFamily: SANS },
  ...extra,
});

// Petit utilitaire : ligne de référence (annotation verticale).
export const refLineX = (tk, x, text, color) => ({
  x,
  strokeDashArray: 4,
  borderColor: color || tk.accent,
  label: {
    text: text || "",
    position: "top",
    orientation: "horizontal",
    borderWidth: 0,
    style: {
      color: color || tk.accent,
      background: "transparent",
      fontFamily: MONO,
      fontSize: "10px",
    },
  },
});

export const refLineY = (tk, y, text, color) => ({
  y,
  strokeDashArray: 4,
  borderColor: color || tk.lineStrong,
  label: {
    text: text || "",
    position: "right",
    borderWidth: 0,
    style: {
      color: color || tk.textMute,
      background: "transparent",
      fontFamily: MONO,
      fontSize: "10px",
    },
  },
});