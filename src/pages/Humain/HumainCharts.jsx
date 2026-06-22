// src/pages/Humain/HumainCharts.jsx
// ============================================================
// Graphiques PERTINENTS sur les données du chapitre Humain (avant Océan).
// Récit en trois temps, sans dashboard surchargé :
//   1) ÉVOLUTION (DualAxisChart) — moyenne du Pacifique année après année :
//      accès à l'eau (axe gauche, %) ET tuberculose (axe droit, cas/100k).
//      Une seule lecture pour voir les deux trajectoires.
//   2) CLASSEMENT EAU (RankChart) — territoire par territoire vs médiane.
//   3) CLASSEMENT TUBERCULOSE (RankChart) — où l'incidence persiste.
// Données réelles passées en props depuis Humain (Redux : water / tuberculosis).
// Composants déjà présents dans l'app (DualAxisChart : CountryPage ; RankChart :
// Act2/Act6/OceanSST). Rien n'est inventé : vide propre si non chargé.
// ============================================================

import React, { useMemo } from "react";
import RankChart from "../../components/charts/RankChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import { isPict, pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import "./HumainCharts.scss";

const GOOD = "#2bbf76"; // vert : au-dessus de la médiane = mieux (eau)
const BAD = "#e8453c"; // rouge : en dessous de la médiane = moins bien (eau)

function median(nums) {
  const s = nums.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Dataset Redux → séries par territoire [{ area, name, values:[{year,value}] }].
function seriesFrom(ds, lang) {
  if (!ds || ds.status !== "succeeded" || !ds.data || !ds.data.byArea) return [];
  const areas =
    Array.isArray(ds.data.areas) && ds.data.areas.length
      ? ds.data.areas
      : Object.keys(ds.data.byArea);
  return areas
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (ds.data.byArea[a] || []).filter(
        (p) => p && Number.isFinite(p.value),
      ),
    }))
    .filter((s) => s.values.length);
}

function yearsOf(series) {
  return [
    ...new Set(series.flatMap((s) => s.values.map((v) => v.year))),
  ].sort((a, b) => a - b);
}

// Dernière valeur finie connue d'un territoire (année la plus récente).
function latestValue(values) {
  let best = null;
  (values || []).forEach((p) => {
    if (p && Number.isFinite(p.value) && (!best || p.year >= best.year)) best = p;
  });
  return best ? best.value : null;
}

const TXT = {
  fr: {
    eyebrow: "Deux mesures vitales",
    title: "L'eau et la tuberculose, vingt ans de données",
    lede:
      "Boire une eau sûre, ne pas mourir de la tuberculose. Sur deux décennies, les deux progressent — lentement — mais l'écart entre territoires, lui, reste béant.",
    evo_title: "La trajectoire régionale",
    evo_find:
      "Moyenne du Pacifique, année après année : l'accès à l'eau (axe gauche) monte tandis que l'incidence de la tuberculose (axe droit) reflue. Deux courbes qui vont dans le bon sens — sans effacer les retards.",
    evo_water: "Accès à l'eau potable",
    evo_tb: "Tuberculose (incidence)",
    water_title: "Le fossé de l'eau, aujourd'hui",
    water_find:
      "Au-dessus de la médiane du Pacifique (vert) ou en dessous (rouge) : l'eau sûre n'est toujours pas acquise partout.",
    water_ref: "Médiane Pacifique",
    water_unit: "%",
    tb_title: "Les foyers de tuberculose",
    tb_find:
      "Les cas pour 100 000 habitants restent concentrés dans quelques territoires, très au-dessus du reste de la région.",
    tb_ref: "Médiane",
    tb_unit: "cas/100k",
    source:
      "Sources : Pacific Data Hub — eau (SDG 6) · tuberculose (SDG 3, OMS). Classements : dernière mesure connue par territoire.",
    loading: "Données en cours de chargement…",
  },
  en: {
    eyebrow: "Two vital measures",
    title: "Water and tuberculosis, twenty years of data",
    lede:
      "Safe water to drink, and not dying of tuberculosis. Over two decades both improve — slowly — yet the gap between territories stays wide open.",
    evo_title: "The regional trajectory",
    evo_find:
      "Pacific average, year by year: water access (left axis) climbs while tuberculosis incidence (right axis) recedes. Two curves moving the right way — without closing the gaps.",
    evo_water: "Safe drinking water",
    evo_tb: "Tuberculosis (incidence)",
    water_title: "The water gap, today",
    water_find:
      "Above the Pacific median (green) or below it (red): safe water is still not a given everywhere.",
    water_ref: "Pacific median",
    water_unit: "%",
    tb_title: "Tuberculosis hotspots",
    tb_find:
      "Cases per 100,000 stay concentrated in a few territories, far above the rest of the region.",
    tb_ref: "Median",
    tb_unit: "cases/100k",
    source:
      "Sources: Pacific Data Hub — water (SDG 6) · tuberculosis (SDG 3, WHO). Rankings: latest known measure per territory.",
    loading: "Data loading…",
  },
};

export default function HumainCharts({ water = null, tb = null }) {
  const { lang } = useLang();
  const T = TXT[lang] || TXT.fr;

  // Séries dans le temps (pour la courbe d'évolution).
  const waterSeries = useMemo(() => seriesFrom(water, lang), [water, lang]);
  const tbSeries = useMemo(() => seriesFrom(tb, lang), [tb, lang]);
  const waterYears = useMemo(() => yearsOf(waterSeries), [waterSeries]);
  const tbYears = useMemo(() => yearsOf(tbSeries), [tbSeries]);

  // Classements (dernière mesure par territoire).
  const waterRank = useMemo(
    () =>
      waterSeries
        .map((s) => ({ area: s.area, name: s.name, value: latestValue(s.values) }))
        .filter((r) => Number.isFinite(r.value)),
    [waterSeries],
  );
  const tbRank = useMemo(
    () =>
      tbSeries
        .map((s) => ({ area: s.area, name: s.name, value: latestValue(s.values) }))
        .filter((r) => Number.isFinite(r.value)),
    [tbSeries],
  );

  const waterMed = useMemo(
    () => median(waterRank.map((r) => r.value)),
    [waterRank],
  );
  const tbMed = useMemo(() => median(tbRank.map((r) => r.value)), [tbRank]);

  // Eau : couleur inversée (accès élevé = mieux).
  const waterPoints = useMemo(
    () =>
      waterRank.map((r) => ({
        name: r.name,
        value: r.value,
        color: waterMed != null && r.value >= waterMed ? GOOD : BAD,
      })),
    [waterRank, waterMed],
  );

  const renderCard = (id, title, find, empty, node, wide) => (
    <article
      key={id}
      className={`humaincharts__card${wide ? " humaincharts__card--wide" : ""}`}
    >
      <div className="humaincharts__cardhead">
        <h3 className="humaincharts__cardtitle">{title}</h3>
        <p className="humaincharts__find">{find}</p>
      </div>
      <div className="humaincharts__chart">
        {empty ? (
          <div className="humaincharts__empty">{T.loading}</div>
        ) : (
          <ErrorBoundary fallback={<div className="humaincharts__empty">—</div>}>
            {node}
          </ErrorBoundary>
        )}
      </div>
    </article>
  );

  return (
    <section className="humaincharts" aria-label={T.title}>
      <div className="humaincharts__inner">
        <header className="humaincharts__head">
          <p className="humaincharts__eyebrow">{T.eyebrow}</p>
          <h2 className="humaincharts__title">{T.title}</h2>
          <p className="humaincharts__lede">{T.lede}</p>
        </header>

        <div className="humaincharts__stack">
          {/* 1 · Évolution dans le temps — deux courbes, deux axes. */}
          {renderCard(
            "evo",
            T.evo_title,
            T.evo_find,
            !waterSeries.length && !tbSeries.length,
            <DualAxisChart
              seaSeries={waterSeries}
              seaYears={waterYears}
              sstSeries={tbSeries}
              sstYears={tbYears}
              seaName={T.evo_water}
              sstName={T.evo_tb}
              seaUnit={T.water_unit}
              sstUnit={T.tb_unit}
            />,
            true,
          )}

          {/* 2 & 3 · Classements territoire par territoire. */}
          <div className="humaincharts__grid">
            {renderCard(
              "water",
              T.water_title,
              T.water_find,
              !waterPoints.length,
              <RankChart
                points={waterPoints}
                unit={T.water_unit}
                median={waterMed ?? 0}
                refLabel={T.water_ref}
                sort="desc"
              />,
            )}
            {renderCard(
              "tb",
              T.tb_title,
              T.tb_find,
              !tbRank.length,
              <RankChart
                points={tbRank.map((r) => ({ name: r.name, value: r.value }))}
                unit={T.tb_unit}
                median={tbMed ?? 0}
                refLabel={T.tb_ref}
                sort="desc"
              />,
            )}
          </div>
        </div>

        <p className="humaincharts__source">{T.source}</p>
      </div>
    </section>
  );
}