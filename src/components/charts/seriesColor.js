// src/components/charts/seriesColor.js
// ============================================================
// Attribution des couleurs de série aux TERRITOIRES.
//
// Deux règles, et elles ne sont pas négociables :
//
//  1. La couleur suit l'ENTITÉ, jamais sa position dans une liste filtrée.
//     Avant : `colorByArea[s.area] = PALETTE[i % PALETTE.length]` sur une
//     liste déjà filtrée — changer le filtre de sous-région repeignait tous
//     les territoires survivants. Un lecteur qui a appris « Fidji est lavande »
//     était trompé au filtre suivant.
//
//  2. Jamais plus de 8 teintes, jamais recyclées. `i % length` donnait la
//     même couleur à plusieurs territoires (22 territoires pour 18 teintes).
//
// D'où la stratégie ADAPTATIVE ci-dessous, qui dépend du nombre de séries
// réellement à l'écran — pas du filtre :
//
//   • ≤ 8 territoires  → une teinte validée chacun, assignée selon un ordre
//     CANONIQUE fixe (pas l'ordre d'arrivée), donc stable d'un filtre à l'autre.
//   • > 8 territoires  → on encode la SOUS-RÉGION (3 teintes). C'est le
//     plafond toutes-paires validé, et à 22 lignes personne ne distingue
//     22 couleurs de toute façon : le regroupement Mélanésie / Polynésie /
//     Micronésie porte l'histoire réelle. L'identité individuelle reste
//     accessible par la légende cliquable et l'infobulle.
//
// Voir _variables.scss § PALETTE DATAVIZ pour les portes franchies.
// ============================================================

import { paletteOf } from "./echartsBase";

// Au-delà de ce seuil, aucune palette catégorielle ne reste lisible.
export const MAX_SERIES_HUES = 8;

/**
 * @param {string[]} codes      codes territoires à colorer (ordre quelconque)
 * @param {object}   tk         tokens de thème résolus
 * @param {object}   opts
 * @param {string[]} opts.canonical  ordre canonique de RÉFÉRENCE (toute la
 *                                   sous-région / tout le Pacifique), filtres
 *                                   NON appliqués — c'est lui qui rend
 *                                   l'attribution stable.
 * @param {object}   opts.regionOf   { code -> id de sous-région } (mode groupé)
 * @param {string[]} opts.regionOrder ordre canonique des sous-régions
 * @returns {{ byCode: Object<string,string>, grouped: boolean }}
 */
export function territoryColors(codes, tk, opts = {}) {
  const { canonical, regionOf, regionOrder } = opts;
  const pal = paletteOf(tk);
  const list = Array.isArray(canonical) && canonical.length ? canonical : codes;

  // Au-delà du seuil : on bascule sur la sous-région.
  if (codes.length > MAX_SERIES_HUES && regionOf && regionOrder) {
    const byRegion = {};
    // Pas de modulo, même ici où il ne recyclerait jamais (3 sous-régions
    // pour 8 teintes) : le motif ne doit exister nulle part dans le code.
    regionOrder.forEach((r, i) => { byRegion[r] = pal[i] || tk.textMute; });
    const byCode = {};
    codes.forEach((c) => {
      byCode[c] = byRegion[regionOf[c]] || tk.textMute;
    });
    return { byCode, grouped: true, byRegion };
  }

  // Sinon : une teinte par territoire, indexée sur l'ordre CANONIQUE.
  const byCode = {};
  codes.forEach((c) => {
    const i = list.indexOf(c);
    byCode[c] = i >= 0 && i < pal.length ? pal[i] : tk.textMute;
  });
  return { byCode, grouped: false };
}
