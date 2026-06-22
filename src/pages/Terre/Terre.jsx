// src/pages/Terre/Terre.jsx
// ============================================================
// Chapitre 3 : LA TERRE — DEUX courses Va'a enchaînées (2 indicateurs chacune,
// comme Humain/Océan). On sépare ce que la terre PRODUIT de ce qu'elle ABRITE :
//
//   Course 1 — NOURRIR (hero d'entrée du chapitre)
//     • Agriculture — rendement des cultures   (PlantGrowth → cropYield)
//     • Élevage — rendement                     (CattleThrive → livestockYield)
//     → valence claire (plus = mieux) : badge de tendance hausse/baisse.
//
//   Course 2 — LE VIVANT (intro enchaînée, sans hero plein écran)
//     • Couverture des terres                   (ForestCover → landCover, CALCI)
//     • Biodiversité — espèces                  (BiodiversityReef → redList)
//     → valence ambiguë : PAS de badge de tendance.
//
// Chaque course ne visite que les territoires pertinents (union de ses deux
// indicateurs). « Indisponible » si la donnée manque pour un territoire.
// ============================================================

import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import VaaChapter from "../../components/VaaChapter/VaaChapter";
import PlantGrowth from "../../components/PlantGrowth/PlantGrowth";
import ForestCover from "../../components/ForestCover/ForestCover";
import CattleThrive from "../../components/CattleThrive/CattleThrive";
import BiodiversityReef from "../../components/BiodiversityReef/BiodiversityReef";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { VAA_ROUTE } from "../../data/vaaRoute";
import { isPict } from "../../i18n/pictNames";
import heroImage from "../../bgHistory.jpg";

function median(arr) {
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Tendance d'un territoire : médiane des deux dernières années disponibles.
function trendOf(ds, code) {
  if (!ds || ds.status !== "succeeded" || !ds.data || !ds.data.byArea) return null;
  const rows = ds.data.byArea[code];
  if (!rows || !rows.length) return null;
  const byYear = {};
  rows.forEach((p) => {
    if (Number.isFinite(p.value)) (byYear[p.year] = byYear[p.year] || []).push(p.value);
  });
  const yrs = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  if (yrs.length < 2) return null;
  const last = median(byYear[yrs[yrs.length - 1]]);
  const prev = median(byYear[yrs[yrs.length - 2]]);
  if (last == null || prev == null) return null;
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "flat";
}

const areasOf = (ds) =>
  ds && ds.status === "succeeded" && ds.data && ds.data.byArea
    ? new Set(Object.keys(ds.data.byArea).filter(isPict))
    : null;

// Traversée = territoires couverts par au moins un des indicateurs de la course.
function routeFrom(sets) {
  const live = sets.filter(Boolean);
  if (!live.length) return undefined;
  const r = VAA_ROUTE.filter((c) => live.some((s) => s.has(c)));
  return r.length ? r : undefined;
}

export default function Terre() {
  const dispatch = useDispatch();
  const crop = useSelector(selectDataset("cropYield"));
  const cattle = useSelector(selectDataset("livestockYield"));
  const forest = useSelector(selectDataset("landCover"));
  const bio = useSelector(selectDataset("redList"));

  useEffect(() => {
    dispatch(loadDataset("cropYield"));
    dispatch(loadDataset("livestockYield"));
    dispatch(loadDataset("landCover"));
    dispatch(loadDataset("redList"));
  }, [dispatch]);

  const cropAreas = useMemo(() => areasOf(crop), [crop]);
  const cattleAreas = useMemo(() => areasOf(cattle), [cattle]);
  const forestAreas = useMemo(() => areasOf(forest), [forest]);
  const bioAreas = useMemo(() => areasOf(bio), [bio]);

  // Course 1 — NOURRIR (production : cultures + élevage).
  const routeNourrir = useMemo(
    () => routeFrom([cropAreas, cattleAreas]),
    [cropAreas, cattleAreas],
  );
  const indNourrir = useMemo(
    () => [
      {
        render: (code) => <PlantGrowth embed code={code} />,
        labelKey: "vaa.terre.crop",
        available: cropAreas,
        trend: (code) => trendOf(crop, code),
        goodWhen: "up", // plus de rendement = mieux
      },
      {
        render: (code) => <CattleThrive embed code={code} />,
        labelKey: "vaa.terre.cattle",
        available: cattleAreas,
        trend: (code) => trendOf(cattle, code),
        goodWhen: "up", // plus de rendement = mieux
      },
    ],
    [crop, cattle, cropAreas, cattleAreas],
  );

  // Course 2 — LE VIVANT (milieu : couverture des terres + biodiversité).
  const routeVivant = useMemo(
    () => routeFrom([forestAreas, bioAreas]),
    [forestAreas, bioAreas],
  );
  const indVivant = useMemo(
    () => [
      {
        render: (code) => <ForestCover embed code={code} />,
        labelKey: "vaa.terre.forest",
        available: forestAreas,
        // Indice de couverture des terres (CALCI, 2015 = 100) : valence
        // ambiguë → pas de badge de tendance.
      },
      {
        render: (code) => <BiodiversityReef embed code={code} />,
        labelKey: "vaa.terre.bio",
        available: bioAreas,
        // Pression sur les espèces (Liste rouge UICN) : valence ambiguë → pas
        // de badge de tendance.
      },
    ],
    [forestAreas, bioAreas],
  );

  return (
    <>
      {/* Course 1 — NOURRIR : hero d'entrée du chapitre */}
      <VaaChapter
        accent="terre"
        heroImage={heroImage}
        eyebrowKey="chapters.terre.eyebrow"
        titleKey="chapters.terre.title"
        ledeKey="chapters.terre.lede"
        problemKey="chapters.terre.problem"
        messageKey="chapters.terre.message"
        questionKey="vaa.terre.q1"
        route={routeNourrir}
        indicators={indNourrir}
      />

      {/* Course 2 — LE VIVANT : enchaînée, bandeau d'intro (pas de hero) */}
      <VaaChapter
        accent="terre"
        noHero
        eyebrowKey="chapters.terre2.eyebrow"
        titleKey="chapters.terre2.title"
        ledeKey="chapters.terre2.lede"
        messageKey="chapters.terre2.message"
        questionKey="vaa.terre.q2"
        route={routeVivant}
        indicators={indVivant}
      />
    </>
  );
}