// src/data/subregions.js
// ============================================================
// Sous-régions océaniennes (SPC) — SOURCE CANONIQUE UNIQUE.
// Centralise la définition jusqu'ici DUPLIQUÉE dans une dizaine d'actes
// (Act1Emissions, Act2Ocean, … chacun redéfinissait son SUBREGIONS/REGION_OF).
// 22 territoires : Mélanésie (5) · Polynésie (10) · Micronésie (7).
// Sert au filtre macro/micro du PDF (p.12) sans réécrire la donnée.
// ============================================================

export const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};

export const REGION_KEYS = Object.keys(SUBREGIONS); // ["melanesia","polynesia","micronesia"]

// Index inverse : code GEO_PICT → clé de sous-région.
export const REGION_OF = Object.entries(SUBREGIONS).reduce((acc, [region, codes]) => {
  codes.forEach((code) => {
    acc[code] = region;
  });
  return acc;
}, {});

export function regionOf(code) {
  return REGION_OF[code] || null;
}

// Codes d'une sous-région ("all" = les 22 territoires).
export function codesInRegion(key) {
  return key === "all" ? Object.values(SUBREGIONS).flat() : SUBREGIONS[key] || [];
}