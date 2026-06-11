// src/data/funFacts.js
// ============================================================
// Moteur de « fun facts » : à partir des jeux de données Redux (forme
// uniforme { byArea[geo] = [{year,value}], years, firstYear, lastYear }),
// on dérive des FAITS RÉELS — aucun chiffre inventé.
//   • records live : plus haut / plus bas / plus forte évolution /
//     plus forte baisse / × la médiane du Pacifique / médiane du Pacifique /
//     sous-région la plus élevée / sous-région la plus basse ;
// Chaque fait porte un `format` (map | spark | compare | kpi) choisi selon
// la nature de la donnée, et des `tokens` que le composant injecte dans une
// phrase-template i18n (t() ne fait pas d'interpolation).
// ============================================================

import { isPict } from "../i18n/pictNames";

// Sous-régions du Pacifique (pour les faits régionaux).
export const REGIONS = {
  melanesia: ["FJ", "NC", "PG", "SB", "VU"],
  polynesia: ["AS", "CK", "PF", "NU", "PN", "WS", "TK", "TO", "TV", "WF"],
  micronesia: ["GU", "KI", "MH", "FM", "NR", "MP", "PW"],
};
const REGION_OF = {};
Object.entries(REGIONS).forEach(([r, arr]) => arr.forEach((g) => { REGION_OF[g] = r; }));

// Jeux exploités + métadonnées d'affichage (unité, polarité, accent, format).
// Unités vérifiées ; on n'ajoute que des jeux dont l'unité/polarité est sûre.
export const FF_DATASETS = {
  emissions: { decimals: 1, unit: "t CO₂e/hab.", polarity: "high_bad", accent: "warm" },
  seaLevel: { decimals: 0, unit: "mm", polarity: "high_bad", accent: "accent", noMedian: true },
  sst: { decimals: 2, unit: "°C", polarity: "high_bad", accent: "negative" },
  renewables: { decimals: 0, unit: "%", polarity: "high_good", accent: "positive" },
  water: { decimals: 0, unit: "%", polarity: "high_good", accent: "accent" },
  cropYield: { decimals: 0, unit: "kg/ha", polarity: "high_good", accent: "positive" },
  population: { decimals: 0, unit: "", polarity: "neutral", accent: "accentDeep", compact: true },
  disastersAffected: { decimals: 0, unit: "", polarity: "high_bad", accent: "warm", compact: true },
  landCover: { decimals: 0, unit: "", polarity: "neutral", accent: "secondary" },
};

export const FF_DATASET_IDS = Object.keys(FF_DATASETS);

// --- helpers numériques (formatage fait côté composant selon la langue) ---
function lastPoint(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(serie[i].value)) return serie[i];
  }
  return null;
}
function firstPoint(serie) {
  for (let i = 0; i < serie.length; i += 1) {
    if (Number.isFinite(serie[i].value)) return serie[i];
  }
  return null;
}
function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return 0;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}

// Construit la liste des points {geo, first, last} pour les territoires PICT.
function pictPoints(data) {
  const out = [];
  Object.keys(data.byArea).forEach((geo) => {
    if (!isPict(geo)) return;
    const serie = data.byArea[geo];
    const last = lastPoint(serie);
    const first = firstPoint(serie);
    if (last) out.push({ geo, first, last, serie });
  });
  return out;
}

// Génère les faits d'UN jeu de données.
function factsForDataset(dsId, data) {
  if (!data || !data.byArea) return [];
  const cfg = FF_DATASETS[dsId];
  const pts = pictPoints(data);
  if (pts.length < 3) return [];
  const facts = [];
  const values = pts.map((p) => p.last.value);
  const med = median(values);

  // Plus haut / plus bas (à la dernière année connue) → carte-locator.
  const top = pts.reduce((a, b) => (b.last.value > a.last.value ? b : a));
  const low = pts.reduce((a, b) => (b.last.value < a.last.value ? b : a));
  facts.push({ id: `${dsId}-high`, dsId, kind: "record_high", format: "map", accent: cfg.accent, polarity: cfg.polarity, area: top.geo, value: top.last.value, year: top.last.year });
  facts.push({ id: `${dsId}-low`, dsId, kind: "record_low", format: "map", accent: cfg.accent, polarity: cfg.polarity, area: low.geo, value: low.last.value, year: low.last.year });

  // Évolutions (premier → dernier).
  const withDelta = pts.filter((p) => p.first && p.first.year !== p.last.year);

  // Plus forte HAUSSE → sparkline.
  if (withDelta.length) {
    const mover = withDelta.reduce((a, b) => (b.last.value - b.first.value > a.last.value - a.first.value ? b : a));
    if (mover.last.value > mover.first.value) {
      facts.push({
        id: `${dsId}-change`, dsId, kind: "biggest_change", format: "spark", accent: cfg.accent, polarity: cfg.polarity,
        area: mover.geo, v0: mover.first.value, v1: mover.last.value, year0: mover.first.year, year1: mover.last.year,
        series: mover.serie.filter((d) => Number.isFinite(d.value)),
      });
    }

    // Plus forte BAISSE → sparkline (uniquement si une vraie baisse existe).
    const dropper = withDelta.reduce((a, b) => (b.last.value - b.first.value < a.last.value - a.first.value ? b : a));
    if (dropper.last.value < dropper.first.value) {
      facts.push({
        id: `${dsId}-drop`, dsId, kind: "biggest_drop", format: "spark", accent: cfg.accent, polarity: cfg.polarity,
        area: dropper.geo, v0: dropper.first.value, v1: dropper.last.value, year0: dropper.first.year, year1: dropper.last.year,
        series: dropper.serie.filter((d) => Number.isFinite(d.value)),
      });
    }
  }

  // × la médiane du Pacifique (sur le territoire de tête) → barre de comparaison.
  if (!cfg.noMedian && med > 0 && top.last.value > med * 1.5) {
    facts.push({
      id: `${dsId}-median`, dsId, kind: "median_multiple", format: "compare", accent: cfg.accent, polarity: cfg.polarity,
      area: top.geo, value: top.last.value, ref: med, mult: top.last.value / med, year: top.last.year,
    });
  }

  // Médiane du Pacifique (repère global) → KPI.
  if (!cfg.noMedian && Number.isFinite(med)) {
    facts.push({
      id: `${dsId}-pacmed`, dsId, kind: "pacific_median", format: "kpi", accent: cfg.accent, polarity: cfg.polarity,
      region: "pacific", value: med, year: data.lastYear,
    });
  }

  // Sous-régions : moyenne par sous-région.
  const byRegion = {};
  pts.forEach((p) => {
    const r = REGION_OF[p.geo];
    if (!r) return;
    (byRegion[r] = byRegion[r] || []).push(p.last.value);
  });
  const regionAvgs = Object.entries(byRegion).map(([r, arr]) => ({ region: r, avg: arr.reduce((s, v) => s + v, 0) / arr.length }));
  if (!cfg.noMedian && regionAvgs.length >= 2) {
    // La plus élevée → KPI.
    const topR = regionAvgs.reduce((a, b) => (b.avg > a.avg ? b : a));
    facts.push({ id: `${dsId}-region`, dsId, kind: "region_top", format: "kpi", accent: cfg.accent, polarity: cfg.polarity, region: topR.region, value: topR.avg, year: data.lastYear });
    // La plus basse → KPI.
    const lowR = regionAvgs.reduce((a, b) => (b.avg < a.avg ? b : a));
    if (lowR.region !== topR.region) {
      facts.push({ id: `${dsId}-region-low`, dsId, kind: "region_low", format: "kpi", accent: cfg.accent, polarity: cfg.polarity, region: lowR.region, value: lowR.avg, year: data.lastYear });
    }
  }

  return facts;
}

// API publique : construit TOUS les faits à partir d'une map { dsId: data }.
export function buildFacts(dataById) {
  const all = [];
  FF_DATASET_IDS.forEach((dsId) => {
    const data = dataById[dsId];
    if (data) all.push(...factsForDataset(dsId, data));
  });
  return all;
}

// Mélange (Fisher–Yates) — ordre aléatoire stable le temps d'une session.
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}