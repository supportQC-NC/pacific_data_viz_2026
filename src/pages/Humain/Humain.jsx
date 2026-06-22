// src/pages/Humain/Humain.jsx
// ============================================================
// Chapitre 1 : L'HUMAIN. Hero plein écran (image de fond) puis voyage Va'a :
// pour chaque territoire, eau potable + tuberculose, avec tendance
// (hausse/baisse calculée sur les dernières années) et « indisponible » si
// la donnée manque. Traversée = union (au moins une des deux données).
// Coda : foule affectée + démographie.
//
// IMAGE DE HERO : remplaçable par bg.jpg / popTare.jpg / pacificIntro.jpg…
// en changeant simplement l'import ci-dessous.
// ============================================================

import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import VaaChapter from "../../components/VaaChapter/VaaChapter";
import HumainCharts from "./HumainCharts";
import WaterGlass from "../../components/WaterGlass/WaterGlass";
import TbBacilli from "../../components/TbBacilli/TbBacilli";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { VAA_ROUTE } from "../../data/vaaRoute";
import { isPict } from "../../i18n/pictNames";
import heroImage from "../../pacificIntro.jpg";

function median(arr) {
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Tendance d'un territoire : compare la médiane des deux dernières années
// disponibles. 'up' | 'down' | 'flat' | null.
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

export default function Humain() {
  const dispatch = useDispatch();
  const water = useSelector(selectDataset("water"));
  const tb = useSelector(selectDataset("tuberculosis"));

  useEffect(() => {
    dispatch(loadDataset("water"));
    dispatch(loadDataset("tuberculosis"));
  }, [dispatch]);

  const areasOf = (ds) =>
    ds.status === "succeeded" && ds.data ? new Set(ds.data.areas.filter(isPict)) : null;

  const waterAreas = useMemo(() => areasOf(water), [water]);
  const tbAreas = useMemo(() => areasOf(tb), [tb]);

  const route = useMemo(() => {
    if (!waterAreas && !tbAreas) return undefined;
    const a = waterAreas || new Set();
    const b = tbAreas || new Set();
    const r = VAA_ROUTE.filter((c) => a.has(c) || b.has(c));
    return r.length ? r : undefined;
  }, [waterAreas, tbAreas]);

  const indicators = useMemo(
    () => [
      {
        render: (code) => <WaterGlass embed code={code} />,
        labelKey: "vaa.humain.water",
        available: waterAreas,
        trend: (code) => trendOf(water, code),
        goodWhen: "up", // plus d'accès = mieux
      },
      {
        render: (code) => <TbBacilli embed code={code} />,
        labelKey: "vaa.humain.tb",
        available: tbAreas,
        trend: (code) => trendOf(tb, code),
        goodWhen: "down", // moins de cas = mieux
      },
    ],
    [water, tb, waterAreas, tbAreas],
  );

  return (
    <>
      <VaaChapter
        accent="humain"
        heroImage={heroImage}
        eyebrowKey="chapters.humain.eyebrow"
        titleKey="chapters.humain.title"
        ledeKey="chapters.humain.lede"
        problemKey="chapters.humain.problem"
        messageKey="chapters.humain.message"
        questionKey="vaa.humain.question"
        route={route}
        indicators={indicators}
      />

      {/* Graphiques pertinents sur les données Humain — avant le chapitre Océan. */}
      <HumainCharts water={water} tb={tb} />
    </>
  );
}