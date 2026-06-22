// src/data/vaaRoute.js
// ============================================================
// LA ROUTE DU VA'A (innovation A) — ordonne les 22 territoires en une
// TRAVERSÉE géographique continue d'ouest en est, franchissant proprement
// l'antiméridien (180°). C'est un PUR TRI des coordonnées de pictGeo :
// aucune donnée inventée, aucune valeur ajoutée — juste un parcours.
//
// Usage : au scroll du Récit, on convertit la progression [0..1] en un
// territoire via territoryAtProgress(), puis on diffuse ce code à toutes
// les signatures (prop `code`). Entre deux îles = "haute mer" → null
// → vue Pacifique agrégée (priorité du porteur, cf. Q4).
// ============================================================

import PICT_GEO from "./pictGeo";

// Longitude "de voyage" : ramène tout sur [0,360) pour que la route
// ne casse pas à la ligne de changement de date (≈134°E → 180 → 230°/-130°).
function voyageLng(lng) {
  return lng < 0 ? lng + 360 : lng;
}

// Ordre canonique de la traversée (ouest → est).
export const VAA_ROUTE = Object.keys(PICT_GEO).sort(
  (a, b) => voyageLng(PICT_GEO[a][0]) - voyageLng(PICT_GEO[b][0]),
);

// Étapes enrichies (utile pour dessiner la carte / le sillage du Va'a).
export const VAA_GEO = VAA_ROUTE.map((code) => ({
  code,
  lng: PICT_GEO[code][0],
  lat: PICT_GEO[code][1],
}));

// Progression de scroll [0..1] → code territoire (ou null = haute mer).
// openSeaMargin : fraction d'ouverture/clôture passée au large (vue agrégée).
export function territoryAtProgress(p, { openSeaMargin = 0.06 } = {}) {
  if (p == null) return null;
  const n = VAA_ROUTE.length;
  if (!n) return null;
  if (p < openSeaMargin || p > 1 - openSeaMargin) return null; // haute mer
  const inner = (p - openSeaMargin) / (1 - 2 * openSeaMargin);
  const idx = Math.min(n - 1, Math.max(0, Math.floor(inner * n)));
  return VAA_ROUTE[idx];
}

// Position [0..1] d'un territoire sur la route (pour synchroniser carte ↔ scroll).
export function progressOfTerritory(code, { openSeaMargin = 0.06 } = {}) {
  const i = VAA_ROUTE.indexOf(code);
  if (i < 0) return null;
  const inner = (i + 0.5) / VAA_ROUTE.length;
  return openSeaMargin + inner * (1 - 2 * openSeaMargin);
}