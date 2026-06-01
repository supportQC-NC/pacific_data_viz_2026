// src/store/context/journeyContext.js
// ============================================================
// Contexte du PARCOURS GUIDÉ (« Commencer l'expérience »).
// - Ordre canonique des 11 actes (id + route)
// - Mode guidé activé ou non (l'exploration libre reste toujours possible)
// - Suivi de l'intro « vue » par acte (pour ne pas la remontrer)
// - Helpers de navigation : index, précédent, suivant
// - Persistance légère (localStorage) du mode et des intros vues
// Aucun style ici. Aucune chaîne visible (les libellés passent par i18n).
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Ordre narratif officiel (doit suivre les chapitres de la Home).
export const JOURNEY = [
  { id: "a1", to: "/emissions" },
  { id: "a2", to: "/ocean" },
  { id: "a3", to: "/territory" },
  { id: "a4", to: "/impact" },
  { id: "a5", to: "/momentum" },
  { id: "a6", to: "/agriculture" },
  { id: "a7", to: "/vivant" },
  { id: "a8", to: "/ciel" },
  { id: "a9", to: "/economie" },
  { id: "a10", to: "/sante" },
  { id: "a11", to: "/synthese" },
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

export function JourneyProvider({ children }) {
  const [guided, setGuided] = useState(loadMode);
  const [seen, setSeen] = useState(loadSeen);
  const [presentation, setPresentation] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, guided ? "1" : "0");
  }, [guided]);

  useEffect(() => {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }, [seen]);

  const openPresentation = useCallback(() => setPresentation(true), []);
  const closePresentation = useCallback(() => setPresentation(false), []);
  const togglePresentation = useCallback(() => setPresentation((p) => !p), []);

  const indexOf = useCallback((id) => JOURNEY.findIndex((a) => a.id === id), []);

  const startJourney = useCallback(() => {
    setGuided(true);
    setSeen({}); // on rejoue le parcours depuis le début
    setPresentation(true); // l'expérience démarre en plein écran
  }, []);

  const exitJourney = useCallback(() => {
    setGuided(false);
    setPresentation(false);
  }, []);

  const markSeen = useCallback((id) => {
    setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const neighbors = useCallback(
    (id) => {
      const i = JOURNEY.findIndex((a) => a.id === id);
      return {
        index: i,
        total: JOURNEY.length,
        prev: i > 0 ? JOURNEY[i - 1] : null,
        next: i >= 0 && i < JOURNEY.length - 1 ? JOURNEY[i + 1] : null,
      };
    },
    [],
  );

  const value = useMemo(
    () => ({
      guided,
      seen,
      presentation,
      startJourney,
      exitJourney,
      markSeen,
      indexOf,
      neighbors,
      openPresentation,
      closePresentation,
      togglePresentation,
      journey: JOURNEY,
    }),
    [
      guided,
      seen,
      presentation,
      startJourney,
      exitJourney,
      markSeen,
      indexOf,
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