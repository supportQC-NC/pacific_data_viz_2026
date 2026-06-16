// src/hooks/useCiel.js
// ============================================================
// Accès robuste aux séries « ciel » du Pacific Data Hub (pluie + température),
// via le service dédié cielApi (sonde plusieurs longueurs de clé + repli proxy)
// — là où le fetch générique échoue (clé fixe). Le résultat est MIS EN CACHE
// par langue au niveau module : plusieurs composants (SkyRain, SeaWarm) le
// partagent sans déclencher plusieurs appels réseau.
//
// Retour : { status: 'loading' | 'done' | 'error', data: { rain, landTemp, meteo } | null }
// Chaque indicateur a la forme { status: 'live' | 'unavailable', byArea, areas,
// years, unit, ... }.
// ============================================================

import { useEffect, useState } from "react";
import { fetchCiel } from "../services/cielApi";

const cache = new Map(); // lang -> Promise<result>

export default function useCiel(lang) {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", data: null });
    if (!cache.has(lang)) cache.set(lang, fetchCiel({ lang }));
    cache
      .get(lang)
      .then((res) => {
        if (alive) setState({ status: "done", data: res });
      })
      .catch(() => {
        cache.delete(lang); // permet un nouvel essai au prochain montage
        if (alive) setState({ status: "error", data: null });
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  return state;
}