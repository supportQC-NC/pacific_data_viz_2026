// src/pages/Ocean/OceanCharts.jsx
// ============================================================
// Tableau de lecture « Océan » pour décideur, sous la carte des points de
// côte. Même modèle que Humain : chiffres-clés, puis lectures numérotées.
//   • KPI    — anomalie de température moyenne (+ tendance), territoires où la
//              côte recule, part moyenne du littoral en recul.
//   • 01 Le thermomètre (TrendLines)      — la température dans le temps.
//   • 02 Réchauffement × côtes (FlagScatter) — un drapeau par territoire ;
//              quadrant « à surveiller ». Sans surinterpréter : le sort des
//              côtes se joue localement.
//   • 03 Le bilan (CoastBalanceChart)     — recul vs avancée, par territoire.
//   • 04 La dispersion (CoastSpreadChart) — la moyenne masque les extrêmes.
// Données : température (useCiel/PDH, en prop), côte (Digital Earth Pacific).
// Composants déjà présents ; FlagScatter réutilisé depuis le chapitre Humain.
// ============================================================

import React, { useMemo } from "react";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import FlagScatter from "../Humain/FlagScatter";
import CoastBalanceChart from "../../components/charts/CoastBalanceChart";
import CoastSpreadChart from "../../components/charts/CoastSpreadChart";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import COASTLINE from "../../data/coastlineByTerritory";
import { isPict, pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import "./OceanCharts.scss";

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

// Température (useCiel) → séries par territoire. Statut "live".
function tempSeriesFrom(landTemp, lang) {
  if (!landTemp || landTemp.status !== "live" || !landTemp.byArea) return [];
  const areas =
    Array.isArray(landTemp.areas) && landTemp.areas.length
      ? landTemp.areas
      : Object.keys(landTemp.byArea);
  return areas
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (landTemp.byArea[a] || []).filter(
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
// Bande d'anomalie par année : moyenne régionale + min/max entre territoires.
function anomalyBand(series, years) {
  return years
    .map((y) => {
      const vals = series
        .map((s) => valueAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      if (!vals.length) return null;
      return {
        year: y,
        mean: meanOf(vals),
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    })
    .filter(Boolean);
}

const TXT = {
  fr: {
    eyebrow: "Tableau de lecture · Océan",
    title: "Une mer qui chauffe, des côtes qui se déplacent",
    lede:
      "Le réchauffement se mesure presque partout. Les côtes, elles, réagissent chacune à leur manière — ici elles reculent, là elles gagnent du terrain. Quatre lectures pour situer chaque territoire et choisir où porter l'effort.",
    kpi_temp_label: "Anomalie de température · moyenne régionale",
    kpi_temp_unit: "°C",
    kpi_retreat_label: "Territoires où la côte recule",
    kpi_ero_label: "Part du littoral en recul · moyenne",
    kpi_ero_unit: "%",
    kpi_since: "depuis",
    kpi_on: "sur",
    s1: "01",
    s2: "02",
    s3: "03",
    s4: "04",
    trend_title: "Le thermomètre régional",
    trend_find:
      "Le trait donne la moyenne régionale ; la bande, l'écart entre territoires. Le signal est net et partagé : un réchauffement de fond, pas l'accident d'une seule année.",
    trend_unit: "°C",
    trend_baseline: "normale 1971–2000",
    trend_mean: "moyenne régionale",
    trend_band: "min–max des territoires",
    link_title: "Réchauffement et côtes, territoire par territoire",
    link_find:
      "On croise le réchauffement (horizontal) et l'évolution du trait de côte (vertical). À regarder en premier : en bas à droite, les territoires qui se réchauffent et dont la côte recule. Le réchauffement est général ; le sort des rivages, lui, se décide localement — récifs, sédiments, houle.",
    link_x: "Anomalie de température (°C)",
    link_y: "Trait de côte (m/an)",
    link_xref: "Médiane",
    link_yref: "0 = stable",
    bal_title: "Le bilan côtier : recul ou avancée",
    bal_find:
      "Pour chaque territoire, la part de littoral qui recule (rouge) face à celle qui avance (bleu). Un même pays peut perdre du terrain d'un côté et en gagner de l'autre.",
    bal_retreat: "Recul",
    bal_advance: "Avancée",
    spread_title: "Ce que la moyenne cache",
    spread_find:
      "Au sein d'un même territoire, les segments de côte vont du fort recul à la forte avancée. La médiane rassure ; c'est la dispersion qui dit où ça fait vraiment mal.",
    spread_unit: "m/an",
    source:
      "Sources : Pacific Data Hub — température (anomalie vs normale 1971–2000) · trait de côte : Digital Earth Pacific (Landsat Coastlines, CC BY-NC 4.0). Médiane des segments par territoire.",
    loading: "Données en cours de chargement…",
  },
  en: {
    eyebrow: "Decision board · Ocean",
    title: "A warming sea, coasts on the move",
    lede:
      "Warming shows up almost everywhere. Coasts, though, each respond in their own way — here they retreat, there they gain ground. Four readings to place every territory and decide where to focus.",
    kpi_temp_label: "Temperature anomaly · regional average",
    kpi_temp_unit: "°C",
    kpi_retreat_label: "Territories with a retreating coast",
    kpi_ero_label: "Share of shoreline retreating · average",
    kpi_ero_unit: "%",
    kpi_since: "since",
    kpi_on: "of",
    s1: "01",
    s2: "02",
    s3: "03",
    s4: "04",
    trend_title: "The regional thermometer",
    trend_find:
      "The line is the regional mean; the band shows the gap between territories. The signal is clear and shared: a baseline warming, not a one-off year.",
    trend_unit: "°C",
    trend_baseline: "1971–2000 normal",
    trend_mean: "regional mean",
    trend_band: "min–max across territories",
    link_title: "Warming and coasts, territory by territory",
    link_find:
      "We cross warming (horizontal) with shoreline change (vertical). Look first at the bottom-right: territories that are warming and whose coast is retreating. Warming is broad; the fate of shores is decided locally — reefs, sediment, swell.",
    link_x: "Temperature anomaly (°C)",
    link_y: "Shoreline (m/yr)",
    link_xref: "Median",
    link_yref: "0 = stable",
    bal_title: "The coastal balance: retreat or advance",
    bal_find:
      "For each territory, the share of shoreline retreating (red) against the share advancing (blue). One country can lose ground on one side and gain it on another.",
    bal_retreat: "Retreat",
    bal_advance: "Advance",
    spread_title: "What the average hides",
    spread_find:
      "Within a single territory, coastal segments range from strong retreat to strong advance. The median reassures; it's the spread that shows where it really hurts.",
    spread_unit: "m/yr",
    source:
      "Sources: Pacific Data Hub — temperature (anomaly vs 1971–2000 normal) · coastline: Digital Earth Pacific (Landsat Coastlines, CC BY-NC 4.0). Median of segments per territory.",
    loading: "Data loading…",
  },
};

export default function OceanCharts({ landTemp = null }) {
  const { lang } = useLang();
  const T = TXT[lang] || TXT.fr;
  const loc = lang === "en" ? "en" : "fr-FR";
  const num = (v, d = 0) =>
    Number.isFinite(v)
      ? v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d })
      : "—";
  const signed = (v, d = 1) => (v > 0 ? "+" : "") + num(v, d);

  // Température dans le temps.
  const tempSeries = useMemo(() => tempSeriesFrom(landTemp, lang), [landTemp, lang]);
  const tempYears = useMemo(
    () =>
      landTemp && Array.isArray(landTemp.years) && landTemp.years.length
        ? landTemp.years
        : yearsOf(tempSeries),
    [landTemp, tempSeries],
  );
  const tempUnit = (landTemp && landTemp.unit) || "°C";
  const tempCurrent = tempYears.length ? tempYears[tempYears.length - 1] : null;
  const tempBand = useMemo(
    () => anomalyBand(tempSeries, tempYears),
    [tempSeries, tempYears],
  );

  // Dernière anomalie par territoire.
  const tempLatest = useMemo(() => {
    const m = new Map();
    tempSeries.forEach((s) => {
      const v = latestValue(s.values);
      if (Number.isFinite(v)) m.set(s.area, v);
    });
    return m;
  }, [tempSeries]);
  const tempMed = useMemo(
    () => median([...tempLatest.values()]),
    [tempLatest],
  );

  // Côte (agrégat statique enrichi du nom).
  const coastRows = useMemo(
    () =>
      COASTLINE.filter((d) => isPict(d.area)).map((d) => ({
        ...d,
        name: pictName(d.area, lang),
      })),
    [lang],
  );
  const spreadRows = useMemo(
    () =>
      coastRows
        .filter((d) => Array.isArray(d.box))
        .map((d) => ({ name: d.name, box: d.box, n: d.n })),
    [coastRows],
  );

  // KPI.
  const kpis = useMemo(() => {
    const tVals = [...tempLatest.values()];
    const tMean = meanOf(tVals);
    const tY0 = tempYears[0];
    const tY1 = tempYears[tempYears.length - 1];
    const tDelta =
      tY0 != null && tY1 != null && tY0 !== tY1
        ? meanAtYear(tempSeries, tY1) - meanAtYear(tempSeries, tY0)
        : null;

    const total = coastRows.length;
    const retreat = coastRows.filter((d) => Number(d.med) < 0).length;
    const meanEro = meanOf(coastRows.map((d) => d.ero));

    return [
      {
        id: "temp",
        label: T.kpi_temp_label,
        value: tMean != null ? signed(tMean, 1) : "—",
        unit: T.kpi_temp_unit,
        delta:
          tDelta != null ? `${signed(tDelta, 1)} °C ${T.kpi_since} ${tY0}` : null,
        tone: tDelta == null ? "flat" : tDelta <= 0 ? "good" : "bad",
      },
      {
        id: "retreat",
        label: T.kpi_retreat_label,
        value: total ? num(retreat, 0) : "—",
        unit: total ? `${T.kpi_on} ${total}` : "",
        tone: "flat",
      },
      {
        id: "ero",
        label: T.kpi_ero_label,
        value: meanEro != null ? num(meanEro, 0) : "—",
        unit: T.kpi_ero_unit,
        tone: "flat",
      },
    ];
  }, [tempLatest, tempSeries, tempYears, coastRows, T, loc]);

  // Lien réchauffement × côte : un drapeau par territoire ayant les deux.
  const linkPoints = useMemo(
    () =>
      coastRows
        .filter((d) => tempLatest.has(d.area) && Number.isFinite(d.med))
        .map((d) => ({
          x: tempLatest.get(d.area),
          y: Number(d.med),
          name: d.name,
          code: d.area,
        })),
    [coastRows, tempLatest],
  );

  const renderCard = (step, title, find, empty, node, wide) => (
    <article
      className={`oceancharts__card${wide ? " oceancharts__card--wide" : ""}`}
    >
      <div className="oceancharts__cardhead">
        <div className="oceancharts__cardtop">
          <span className="oceancharts__step">{step}</span>
          <h3 className="oceancharts__cardtitle">{title}</h3>
        </div>
        <p className="oceancharts__find">{find}</p>
      </div>
      <div className="oceancharts__chart">
        {empty ? (
          <div className="oceancharts__empty">{T.loading}</div>
        ) : (
          <ErrorBoundary fallback={<div className="oceancharts__empty">—</div>}>
            {node}
          </ErrorBoundary>
        )}
      </div>
    </article>
  );

  return (
    <section className="oceancharts" aria-label={T.title}>
      <div className="oceancharts__inner">
        <header className="oceancharts__head">
          <p className="oceancharts__eyebrow">{T.eyebrow}</p>
          <h2 className="oceancharts__title">{T.title}</h2>
          <p className="oceancharts__lede">{T.lede}</p>
        </header>

        <div className="oceancharts__kpis">
          {kpis.map((k) => (
            <div className="oceancharts__kpi" key={k.id}>
              <p className="oceancharts__kpi-label">{k.label}</p>
              <p className="oceancharts__kpi-value">
                {k.value}
                <span className="oceancharts__kpi-unit">{k.unit}</span>
              </p>
              {k.delta && (
                <p
                  className={`oceancharts__kpi-delta oceancharts__kpi-delta--${k.tone}`}
                >
                  {k.delta}
                </p>
              )}
              {k.note && <p className="oceancharts__kpi-note">{k.note}</p>}
            </div>
          ))}
        </div>

        <div className="oceancharts__stack">
          {renderCard(
            T.s1,
            T.trend_title,
            T.trend_find,
            !tempBand.length,
            <AnomalyTrend
              data={tempBand}
              currentYear={tempCurrent}
              unit={tempUnit}
              tone="warm"
              baselineLabel={T.trend_baseline}
              meanLabel={T.trend_mean}
              bandLabel={T.trend_band}
            />,
            true,
          )}

          {renderCard(
            T.s2,
            T.link_title,
            T.link_find,
            !linkPoints.length,
            <FlagScatter
              points={linkPoints}
              medianX={tempMed}
              medianY={0}
              xName={T.link_x}
              yName={T.link_y}
              medXLabel={T.link_xref}
              medYLabel={T.link_yref}
              xDecimals={1}
              yDecimals={2}
            />,
            true,
          )}

          <div className="oceancharts__grid">
            {renderCard(
              T.s3,
              T.bal_title,
              T.bal_find,
              !coastRows.length,
              <CoastBalanceChart
                rows={coastRows}
                retreatLabel={T.bal_retreat}
                advanceLabel={T.bal_advance}
                unit="%"
              />,
            )}
            {renderCard(
              T.s4,
              T.spread_title,
              T.spread_find,
              !spreadRows.length,
              <CoastSpreadChart rows={spreadRows} unit={T.spread_unit} />,
            )}
          </div>
        </div>

        <p className="oceancharts__source">{T.source}</p>
      </div>
    </section>
  );
}