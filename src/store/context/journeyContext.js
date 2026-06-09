// src/store/context/journeyContext.js
// ============================================================
// Contexte du PARCOURS GUIDÉ (« Commencer l'expérience »).
// SOURCE DE VÉRITÉ UNIQUE pour : l'ordre des actes, leur NUMÉRO, leur
// MOUVEMENT narratif, et le voisinage (précédent / suivant).
// - Ordre canonique des actes (id + route) → JOURNEY
// - Regroupement en 5 MOUVEMENTS narratifs (pour la Home et l'ouvre-chapitre)
// - Helpers : numberOf, padOf, movementOf, byPath, neighbors
// - Mode guidé activé ou non ; suivi des intros vues ; persistance légère
// Aucun style ici. Aucune chaîne visible (les libellés passent par i18n).
//
// NB : pour réordonner le récit, il SUFFIT de modifier JOURNEY (et la
//      composition de MOVEMENTS). Les numéros, la progression et les liens
//      « suivant » se recalculent automatiquement partout.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Ordre narratif officiel (doit suivre les chapitres de la Home).
// Plan validé v2 — 5 mouvements :
//   Ouverture (responsabilité) · I Climat physique · II Ressources & vivant ·
//   III L'humain en première ligne · IV La riposte · Final (verdict).
export const JOURNEY = [
  { id: "a1", to: "/emissions" },   // 01 · Le paradoxe fondateur (émissions)
  { id: "a2", to: "/ocean" },       // 02 · L'océan (SST)
  { id: "a8", to: "/ciel" },        // 03 · Lire le ciel (pluie + temp. terre + météo)
  { id: "a12", to: "/cyclones" },   // 04 · Les cyclones (trajectoires 1977→2024)
  { id: "a6", to: "/agriculture" }, // 05 · Nourrir demain (agriculture)
  { id: "a7", to: "/vivant" },      // 06 · Protéger le vivant (Liste Rouge + pêche)
  { id: "a3", to: "/territory" },   // 07 · La côte, ligne de front (niveau mer + population)
  { id: "a10", to: "/sante" },      // 08 · L'eau et la santé (eau + tuberculose)
  { id: "a4", to: "/impact" },      // 09 · L'humain au cœur (catastrophes)
  { id: "a5", to: "/momentum" },    // 10 · L'élan renouvelable (renouvelables)
  { id: "a9", to: "/economie" },    // 11 · Une économie qui se réinvente (tourisme + élec. + fiscalité)
  { id: "a11", to: "/synthese" },   // 12 · La voie tracée (synthèse)
];

// Mouvements narratifs (regroupent les actes par famille de données).
// L'ordre des `acts` DOIT suivre l'ordre de JOURNEY.
export const MOVEMENTS = [
  { id: "m1", acts: ["a1"] },                // Le constat / la responsabilité
  { id: "m2", acts: ["a2", "a8", "a12"] },   // Le climat physique (+ cyclones)
  { id: "m3", acts: ["a6", "a7"] },          // Ressources & vivant
  { id: "m4", acts: ["a3", "a10", "a4"] },   // L'humain en première ligne
  { id: "m5", acts: ["a5", "a9", "a11"] },   // La riposte, puis le verdict
];

const MODE_KEY = "pdc-journey-mode";
const SEEN_KEY = "pdc-journey-seen";

const JourneyContext = createContext(null);

function loadMode() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MODE_KEY) === "1";
}
function loadSeen() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) || "{}") || {};
  } catch (e) {
    return {};
  }
}

// Helpers purs (utilisables hors React).
export function indexOfAct(id) {
  return JOURNEY.findIndex((a) => a.id === id);
}
export function numberOfAct(id) {
  const i = indexOfAct(id);
  return i < 0 ? null : i + 1;
}
export function padNumber(n) {
  return n == null ? "" : String(n).padStart(2, "0");
}
export function movementOfAct(id) {
  return MOVEMENTS.find((m) => m.acts.includes(id)) || null;
}
export function actByPath(pathname) {
  const i = JOURNEY.findIndex((a) => a.to === pathname);
  if (i < 0) return null;
  return { ...JOURNEY[i], index: i, number: i + 1, total: JOURNEY.length };
}
export function routeOfAct(id) {
  const a = JOURNEY.find((x) => x.id === id);
  return a ? a.to : null;
}

export function JourneyProvider({ children }) {
  const [guided, setGuided] = useState(loadMode);
  const [seen, setSeen] = useState(loadSeen);
  const [presentation, setPresentation] = useState(false);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, guided ? "1" : "0");
  }, [guided]);

  useEffect(() => {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }, [seen]);

  const openPresentation = useCallback(() => setPresentation(true), []);
  const closePresentation = useCallback(() => setPresentation(false), []);
  const togglePresentation = useCallback(() => setPresentation((p) => !p), []);

  const indexOf = useCallback((id) => indexOfAct(id), []);
  const numberOf = useCallback((id) => numberOfAct(id), []);
  const padOf = useCallback((id) => padNumber(numberOfAct(id)), []);
  const movementOf = useCallback((id) => movementOfAct(id), []);
  const byPath = useCallback((pathname) => actByPath(pathname), []);
  const routeOf = useCallback((id) => routeOfAct(id), []);

  const startJourney = useCallback(() => {
    setGuided(true);
    setSeen({}); // on rejoue le parcours depuis le début
    setPresentation(false);
  }, []);

  const exitJourney = useCallback(() => {
    setGuided(false);
    setPresentation(false);
  }, []);

  const markSeen = useCallback((id) => {
    setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const neighbors = useCallback((id) => {
    const i = JOURNEY.findIndex((a) => a.id === id);
    return {
      index: i,
      total: JOURNEY.length,
      prev: i > 0 ? JOURNEY[i - 1] : null,
      next: i >= 0 && i < JOURNEY.length - 1 ? JOURNEY[i + 1] : null,
    };
  }, []);

  const value = useMemo(
    () => ({
      guided,
      seen,
      presentation,
      immersive,
      setImmersive,
      startJourney,
      exitJourney,
      markSeen,
      indexOf,
      numberOf,
      padOf,
      movementOf,
      byPath,
      routeOf,
      neighbors,
      openPresentation,
      closePresentation,
      togglePresentation,
      journey: JOURNEY,
      movements: MOVEMENTS,
    }),
    [
      guided,
      seen,
      presentation,
      immersive,
      startJourney,
      exitJourney,
      markSeen,
      indexOf,
      numberOf,
      padOf,
      movementOf,
      byPath,
      routeOf,
      neighbors,
      openPresentation,
      closePresentation,
      togglePresentation,
    ],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney doit être utilisé dans <JourneyProvider>");
  return ctx;
}