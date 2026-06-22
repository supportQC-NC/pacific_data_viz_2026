// src/pages/Ocean/Ocean.jsx
// ============================================================
// Chapitre Océan — moteur Va'a. Cause → effet : le RÉCHAUFFEMENT de l'océan
// (anomalie de T° de surface, °C vs normale 1991–2020 — via useCiel/NOAA·PDH)
// et la variation du TRAIT DE CÔTE (m/an — Digital Earth Pacific, données
// statiques coastlineByTerritory). Pour chaque territoire, les deux ensemble ;
// « Donnée indisponible » si l'un manque. Traversée = union.
// (Pluie/biodiversité réintégrables plus tard comme indicateurs.)
//
// IMAGE DE HERO remplaçable (bg.jpg / pacificIntro.jpg / popTare.jpg…).
// ============================================================

import React, { useMemo } from "react";
import VaaChapter from "../../components/VaaChapter/VaaChapter";
import SeaWarm from "../../components/SeaWarm/SeaWarm";
import CoastlineShift from "../../components/CoastlineShift/CoastlineShift";
import COASTLINE from "../../data/coastlineByTerritory";
import { VAA_ROUTE } from "../../data/vaaRoute";
import { isPict } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import useCiel from "../../hooks/UseCiel";
import heroImage from "../../bg.jpg";

// Tendance de réchauffement : signe de (dernière − première valeur finie).
function seaTrendOf(landTemp, code) {
  if (!landTemp || landTemp.status !== "live" || !landTemp.byArea) return null;
  const serie = landTemp.byArea[code];
  if (!Array.isArray(serie)) return null;
  const fin = serie.filter((p) => p && Number.isFinite(p.value));
  if (fin.length < 2) return null;
  const d = fin[fin.length - 1].value - fin[0].value;
  return d > 0 ? "up" : d < 0 ? "down" : "flat";
}

export default function Ocean() {
  const { lang } = useLang();
  const ciel = useCiel(lang);
  const landTemp = ciel.data && ciel.data.landTemp;

  // Territoires documentés.
  const coastAreas = useMemo(
    () => new Set(COASTLINE.filter((d) => isPict(d.area)).map((d) => d.area)),
    [],
  );
  const seaAreas = useMemo(() => {
    if (!landTemp || landTemp.status !== "live" || !landTemp.byArea) return null;
    const s = new Set();
    Object.entries(landTemp.byArea).forEach(([code, serie]) => {
      if (isPict(code) && Array.isArray(serie) && serie.some((p) => p && Number.isFinite(p.value)))
        s.add(code);
    });
    return s.size ? s : null;
  }, [landTemp]);

  // Union : au moins une des deux données.
  const route = useMemo(() => {
    const r = VAA_ROUTE.filter((c) => coastAreas.has(c) || (seaAreas && seaAreas.has(c)));
    return r.length ? r : undefined;
  }, [coastAreas, seaAreas]);

  const indicators = useMemo(
    () => [
      {
        render: (code) => <SeaWarm embed code={code} />,
        labelKey: "vaa.ocean.sea",
        available: seaAreas,
        trend: (code) => seaTrendOf(landTemp, code),
        goodWhen: "down", // moins de réchauffement = mieux
      },
      {
        render: (code) => <CoastlineShift embed code={code} />,
        labelKey: "vaa.ocean.coast",
        available: coastAreas,
      },
    ],
    [seaAreas, coastAreas, landTemp],
  );

  return (
    <VaaChapter
      accent="ocean"
      heroImage={heroImage}
      eyebrowKey="chapters.ocean.eyebrow"
      titleKey="chapters.ocean.title"
      ledeKey="chapters.ocean.lede"
      problemKey="chapters.ocean.problem"
      messageKey="chapters.ocean.message"
      questionKey="vaa.ocean.question"
      route={route}
      indicators={indicators}
    />
  );
}