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

// Palette QUALITATIVE (identité d'une série). Ordre fixe : ne jamais cycler,
// ne jamais réordonner sans repasser validate_palette.js — l'ordre EST le
// mécanisme de sécurité daltonisme. Détail des portes franchies et du plafond
// toutes-paires : _variables.scss § PALETTE DATAVIZ.
export const paletteOf = (tk) => [
  tk.series1,
  tk.series2,
  tk.series3,
  tk.series4,
  tk.series5,
  tk.series6,
  tk.series7,
  tk.series8,
];

// Plafond pour les formes où TOUTES les paires se côtoient (nuage de points,
// radar, bulles, coordonnées parallèles) : seuls les 3 premiers slots sont
// validés en toutes-paires. Au-delà : regrouper en « Autres » ou facetter.
export const SCATTER_SERIES_CAP = 3;
export const scatterPaletteOf = (tk) => paletteOf(tk).slice(0, SCATTER_SERIES_CAP);

// Rampe SÉQUENTIELLE (magnitude continue). Une seule teinte, clair → sombre.
export const seqRampOf = (tk) => [
  tk.seq100, tk.seq200, tk.seq300, tk.seq400, tk.seq500,
  tk.seq600, tk.seq700, tk.seq800, tk.seq900,
];

// Rampe ORDINALE (bandes discrètes ordonnées : quantiles, paliers). Plage
// resserrée pour rester lisible sur les deux surfaces.
export const ordRampOf = (tk) => [tk.ord1, tk.ord2, tk.ord3, tk.ord4, tk.ord5, tk.ord6];

// Rampe DIVERGENTE (lavande ↔ rouge, centre gris neutre). RÉSERVÉE aux
// grandeurs à vraie polarité autour d'un zéro qui a un sens : anomalie vs
// normale, évolution vs base. Pour une simple magnitude, utiliser seqRampOf.
//
// ⚠️ Ne jamais remplacer par du vert ↔ rouge : mesuré à ΔE 4,1 en
// deutéranopie (pôles indiscernables) contre 22,7 pour cette paire.
export const divRampOf = (tk) => [
  tk.div1, tk.div2, tk.div3, tk.div4, tk.div5,
  tk.div6, tk.div7, tk.div8, tk.div9,
];

// Les trois usages de couleur, nommés — pour que chaque graphique DÉCLARE ce
// qu'il encode au lieu de choisir une rampe au hasard :
//   "magnitude" → grandeur sans jugement de valeur (population, arrivées…)
//   "stress"    → grandeur orientée, sombre = toujours pire (émissions, TB…)
//   "polarity"  → vraie polarité autour de zéro (anomalies, évolutions)
export const rampFor = (kind, tk) => {
  if (kind === "polarity") return divRampOf(tk);
  if (kind === "stress") return ordRampOf(tk);
  return seqRampOf(tk);
};

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