// src/pages/Humain/HumainCharts.jsx
// ============================================================
// Tableau de lecture « Humain » pour décideur, placé en fin de chapitre
// (avant Océan). Conçu en entonnoir : du chiffre-clé à l'action.
//   • KPI    — moyenne régionale eau, incidence TB, écart entre territoires,
//              avec tendance depuis le début du suivi.
//   • 01 Trajectoire (DualAxisChart) — eau (axe gauche) & TB (axe droit) dans
//              le temps : où va-t-on ?
//   • 02 Le lien (FlagScatter)       — accès à l'eau × tuberculose : drapeau
//              par territoire : pourquoi investir dans l'eau.
//   • 03/04 Classements (RankChart)  — où agir (eau, puis TB).
// Données réelles (Redux : water / tuberculosis), composants déjà présents
// (DualAxisChart, FlagScatter, RankChart). Rien n'est inventé.
// ============================================================

import React, { useMemo } from "react";
import RankChart from "../../components/charts/RankChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import FlagScatter from "./FlagScatter";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import { isPict, pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import "./HumainCharts.scss";

const GOOD = "#2bbf76"; // au-dessus de la médiane d'eau / amélioration
const BAD = "#e8453c"; // en dessous / dégradation

function meanOf(nums) {
  const s = nums.filter(Number.isFinite);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
}
function median(nums) {
  const s = nums.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function valueAt(values, year) {
  const hit = (values || []).find((p) => p && p.year === year);
  return hit && Number.isFinite(hit.value) ? hit.value : null;
}
function meanAtYear(series, year) {
  return meanOf(series.map((s) => valueAt(s.values, year)));
}
function latestValue(values) {
  let best = null;
  (values || []).forEach((p) => {
    if (p && Number.isFinite(p.value) && (!best || p.year >= best.year)) best = p;
  });
  return best ? best.value : null;
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

const TXT = {
  fr: {
    eyebrow: "Tableau de lecture · Humain",
    title: "L'eau et la tuberculose : ce que disent les données",
    lede:
      "Avant de gagner l'océan, quatre lectures — du chiffre-clé à la décision — sur deux mesures vitales : boire une eau sûre, ne pas mourir de la tuberculose.",
    kpi_water_label: "Accès à l'eau · moyenne régionale",
    kpi_water_unit: "%",
    kpi_tb_label: "Tuberculose · incidence moyenne",
    kpi_tb_unit: "cas/100k",
    kpi_gap_label: "Écart entre territoires · eau",
    kpi_gap_unit: "pts",
    kpi_since: "depuis",
    kpi_gap_note: (lo, hi) => `du plus bas (${lo} %) au plus haut (${hi} %)`,
    s1: "01",
    s2: "02",
    s3: "03",
    s4: "04",
    evo_title: "La trajectoire régionale",
    evo_find:
      "Moyenne du Pacifique, année après année : l'accès à l'eau (axe gauche) monte tandis que l'incidence de la tuberculose (axe droit) reflue — sans effacer les retards.",
    evo_water: "Accès à l'eau potable",
    evo_tb: "Tuberculose (incidence)",
    link_title: "Le lien : eau et tuberculose",
    link_find:
      "Chaque drapeau est un territoire. En bas à droite : eau sûre et peu de tuberculose. En haut à gauche : faible accès à l'eau et forte incidence — la zone à cibler en priorité.",
    link_x: "Accès à l'eau (%)",
    link_y: "Tuberculose (cas/100k)",
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
      "Sources : Pacific Data Hub — eau (SDG 6) · tuberculose (SDG 3, OMS). Chiffres : dernière mesure connue par territoire ; tendances sur la période suivie.",
    loading: "Données en cours de chargement…",
  },
  en: {
    eyebrow: "Decision board · Human",
    title: "Water and tuberculosis: what the data says",
    lede:
      "Before reaching the ocean, four readings — from headline figure to decision — on two vital measures: drinking safe water, and not dying of tuberculosis.",
    kpi_water_label: "Water access · regional average",
    kpi_water_unit: "%",
    kpi_tb_label: "Tuberculosis · average incidence",
    kpi_tb_unit: "cases/100k",
    kpi_gap_label: "Gap between territories · water",
    kpi_gap_unit: "pts",
    kpi_since: "since",
    kpi_gap_note: (lo, hi) => `from lowest (${lo}%) to highest (${hi}%)`,
    s1: "01",
    s2: "02",
    s3: "03",
    s4: "04",
    evo_title: "The regional trajectory",
    evo_find:
      "Pacific average, year by year: water access (left axis) climbs while tuberculosis incidence (right axis) recedes — without closing the gaps.",
    evo_water: "Safe drinking water",
    evo_tb: "Tuberculosis (incidence)",
    link_title: "The link: water and tuberculosis",
    link_find:
      "Each flag is a territory. Bottom-right: safe water and little tuberculosis. Top-left: low water access and high incidence — the priority zone to target.",
    link_x: "Water access (%)",
    link_y: "Tuberculosis (cases/100k)",
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
      "Sources: Pacific Data Hub — water (SDG 6) · tuberculosis (SDG 3, WHO). Figures: latest known measure per territory; trends over the tracked period.",
    loading: "Data loading…",
  },
};

export default function HumainCharts({ water = null, tb = null }) {
  const { lang } = useLang();
  const T = TXT[lang] || TXT.fr;
  const loc = lang === "en" ? "en" : "fr-FR";
  const num = (v, d = 0) =>
    Number.isFinite(v)
      ? v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d })
      : "—";
  const signed = (v, d = 0) => (v > 0 ? "+" : "") + num(v, d);

  // Séries dans le temps.
  const waterSeries = useMemo(() => seriesFrom(water, lang), [water, lang]);
  const tbSeries = useMemo(() => seriesFrom(tb, lang), [tb, lang]);
  const waterYears = useMemo(() => yearsOf(waterSeries), [waterSeries]);
  const tbYears = useMemo(() => yearsOf(tbSeries), [tbSeries]);

  // Dernière mesure par territoire.
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
  const waterMed = useMemo(() => median(waterRank.map((r) => r.value)), [waterRank]);
  const tbMed = useMemo(() => median(tbRank.map((r) => r.value)), [tbRank]);

  // KPI (chiffres-clés + tendance sur la période).
  const kpis = useMemo(() => {
    const wVals = waterRank.map((r) => r.value);
    const tVals = tbRank.map((r) => r.value);
    const wNow = meanOf(wVals);
    const tNow = meanOf(tVals);
    const wLo = wVals.length ? Math.min(...wVals) : null;
    const wHi = wVals.length ? Math.max(...wVals) : null;

    const wY0 = waterYears[0];
    const wY1 = waterYears[waterYears.length - 1];
    const tY0 = tbYears[0];
    const tY1 = tbYears[tbYears.length - 1];
    const wDelta =
      wY0 != null && wY1 != null && wY0 !== wY1
        ? meanAtYear(waterSeries, wY1) - meanAtYear(waterSeries, wY0)
        : null;
    const tDelta =
      tY0 != null && tY1 != null && tY0 !== tY1
        ? meanAtYear(tbSeries, tY1) - meanAtYear(tbSeries, tY0)
        : null;

    return [
      {
        id: "water",
        label: T.kpi_water_label,
        value: num(wNow, 0),
        unit: T.kpi_water_unit,
        delta:
          wDelta != null ? `${signed(wDelta, 1)} pts ${T.kpi_since} ${wY0}` : null,
        tone: wDelta == null ? "flat" : wDelta >= 0 ? "good" : "bad",
      },
      {
        id: "tb",
        label: T.kpi_tb_label,
        value: num(tNow, 0),
        unit: T.kpi_tb_unit,
        delta:
          tDelta != null ? `${signed(tDelta, 0)} ${T.kpi_since} ${tY0}` : null,
        tone: tDelta == null ? "flat" : tDelta <= 0 ? "good" : "bad",
      },
      {
        id: "gap",
        label: T.kpi_gap_label,
        value: wLo != null ? num(wHi - wLo, 0) : "—",
        unit: T.kpi_gap_unit,
        note: wLo != null ? T.kpi_gap_note(num(wLo, 0), num(wHi, 0)) : null,
        tone: "flat",
      },
    ];
  }, [waterRank, tbRank, waterSeries, tbSeries, waterYears, tbYears, T, loc]);

  // Eau : classement coloré (accès élevé = mieux).
  const waterPoints = useMemo(
    () =>
      waterRank.map((r) => ({
        name: r.name,
        value: r.value,
        color: waterMed != null && r.value >= waterMed ? GOOD : BAD,
      })),
    [waterRank, waterMed],
  );

  // Lien eau × TB : un point (drapeau) par territoire ayant les deux mesures.
  const linkPoints = useMemo(() => {
    const tbByArea = new Map(tbRank.map((r) => [r.area, r.value]));
    return waterRank
      .filter((r) => tbByArea.has(r.area))
      .map((r) => ({
        x: r.value,
        y: tbByArea.get(r.area),
        name: r.name,
        code: r.area,
      }));
  }, [waterRank, tbRank]);
  const scatterEmpty = !linkPoints.length;

  const renderCard = (step, title, find, empty, node, wide) => (
    <article
      className={`humaincharts__card${wide ? " humaincharts__card--wide" : ""}`}
    >
      <div className="humaincharts__cardhead">
        <div className="humaincharts__cardtop">
          <span className="humaincharts__step">{step}</span>
          <h3 className="humaincharts__cardtitle">{title}</h3>
        </div>
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

        {/* Chiffres-clés */}
        <div className="humaincharts__kpis">
          {kpis.map((k) => (
            <div className="humaincharts__kpi" key={k.id}>
              <p className="humaincharts__kpi-label">{k.label}</p>
              <p className="humaincharts__kpi-value">
                {k.value}
                <span className="humaincharts__kpi-unit">{k.unit}</span>
              </p>
              {k.delta && (
                <p
                  className={`humaincharts__kpi-delta humaincharts__kpi-delta--${k.tone}`}
                >
                  {k.delta}
                </p>
              )}
              {k.note && <p className="humaincharts__kpi-note">{k.note}</p>}
            </div>
          ))}
        </div>

        {/* Lectures */}
        <div className="humaincharts__stack">
          {renderCard(
            T.s1,
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

          {renderCard(
            T.s2,
            T.link_title,
            T.link_find,
            scatterEmpty,
            <FlagScatter
              points={linkPoints}
              medianX={waterMed}
              medianY={tbMed}
              xName={T.link_x}
              yName={T.link_y}
              medXLabel={T.water_ref}
              medYLabel={T.tb_ref}
              xDecimals={0}
              yDecimals={0}
            />,
            true,
          )}

          <div className="humaincharts__grid">
            {renderCard(
              T.s3,
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
              T.s4,
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