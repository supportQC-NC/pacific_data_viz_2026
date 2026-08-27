// src/components/charts/apexBase.js
// ============================================================
// Helpers partagés par les composants de graphiques (ApexCharts).
// Pendant ApexCharts de `echartsBase.js` : fabriques d'options de base
// (chart, grille, axes, légende, tooltip) liées à la charte (tokens du
// thème light/dark). Les helpers maths (median, quantile, valAt, fmt) NE
// sont PAS redéfinis ici : on les réimporte d'echartsBase pour éviter toute
// duplication. Aucune couleur en dur : tout vient des tokens.
// ============================================================

import {
  MONO, SANS, fmt, median, quantile, valAt,
  paletteOf, scatterPaletteOf, seqRampOf, ordRampOf, SCATTER_SERIES_CAP,
} from "./echartsBase";

// Réexport pour que les charts n'aient qu'un seul import.
export { MONO, SANS, fmt, median, quantile, valAt, SCATTER_SERIES_CAP };

// Palette qualitative — SOURCE UNIQUE, partagée avec la version ECharts.
// (Auparavant redéfinie ici, ce qui laissait les deux listes diverger.)
export const apexPalette = paletteOf;
export const apexScatterPalette = scatterPaletteOf;

// Rampe SÉQUENTIELLE (faible -> élevé) pour les heatmaps en mode continu.
// Une seule teinte, clair → sombre.
//
// ⚠️ Remplace un arc-en-ciel vert→bleu→rose→terracotta→rouge. Celui-ci
// échouait la monotonie de clarté : ses 5 pas ne couvraient que ΔL 0,05, donc
// il ne portait AUCUN signal de magnitude en niveaux de gris, à l'impression
// ou en forced-colors. Ne pas revenir à une rampe multi-teintes.
export const apexRamp = seqRampOf;

// Rampe ORDINALE pour les bandes discrètes (quantiles, paliers).
export const apexOrdRamp = ordRampOf;

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

// TAILLES DE LA CHROME DE GRAPHIQUE — relevées après relecture à l'écran.
// Axes, légendes et repères étaient à 11 px en `textMute` : sur la surface
// sombre, à distance de lecture normale, la légende disparaissait avant la
// donnée. Or c'est elle qui dit CE QU'ON REGARDE — sans elle, un graphique
// n'est qu'une forme. On passe à 12,5 px et à l'encre `textSoft`, un cran
// plus contrastée. La donnée peut perdre quelques pixels de hauteur ; sa
// légende, non.
export const CHROME_FS = "12.5px";
export const AXIS_FS = "12.5px";

export const baseLegend = (tk, extra = {}) => ({
  show: true,
  position: "top",
  horizontalAlign: "left",
  fontFamily: MONO,
  fontSize: CHROME_FS,
  labels: { colors: tk.textSoft },
  markers: { width: 11, height: 11, radius: 3 },
  itemMargin: { horizontal: 10, vertical: 4 },
  ...extra,
});

export const baseXaxis = (tk, extra = {}) => ({
  axisBorder: { show: true, color: tk.line },
  axisTicks: { show: true, color: tk.line },
  labels: {
    style: { colors: tk.textSoft, fontFamily: MONO, fontSize: AXIS_FS },
  },
  title: {
    style: { color: tk.textSoft, fontFamily: MONO, fontWeight: 400, fontSize: AXIS_FS },
  },
  crosshairs: { stroke: { color: tk.line, dashArray: 3 } },
  tooltip: { enabled: false },
  ...extra,
});

export const baseYaxis = (tk, extra = {}) => ({
  axisBorder: { show: false, color: tk.line },
  axisTicks: { show: false, color: tk.line },
  labels: {
    style: { colors: tk.textSoft, fontFamily: MONO, fontSize: AXIS_FS },
  },
  title: {
    style: { color: tk.textSoft, fontFamily: MONO, fontWeight: 400, fontSize: AXIS_FS },
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
  style: { fontSize: "13px", fontFamily: SANS },
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
      fontSize: "12px",
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
      color: color || tk.textSoft,
      background: "transparent",
      fontFamily: MONO,
      fontSize: "12px",
    },
  },
});