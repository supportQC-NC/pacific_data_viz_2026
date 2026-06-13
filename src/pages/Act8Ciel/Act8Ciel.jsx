// src/pages/Act8Ciel/Act8Ciel.jsx
// ============================================================
// Acte « Lire le ciel » — 3ᵉ étape du parcours (JOURNEY), trois jeux
// officiels du Challenge servis par cielApi :
//   • Pluie        : GPCP v2.3 (NOAA, CC0) — mm, anomalie vs normale
//     1991–2020 (standard OMM) ; totaux annuels sommés du mensuel.
//   • Température  : NOAAGlobalTemp v6.0.0 (NOAA/NCEI, CC0) — °C à 2 m,
//     anomalie vs normale 1971–2000, moyenne spatiale par pays.
//   • Réseau météo : OMM/OSCAR (CC BY-SA 4.0) — stations opérationnelles
//     cumulées (statuts « Silent »/« Unknown » exclus par le producteur).
// Un sélecteur de MESURE pilote tout le board ; chaque mesure se lit
// contre SA PROPRE référence — jamais contre celle d'une autre.
//
// Vues « maîtrise de la donnée » (jury) :
//   • Les données : carte d'identité TRIPLE (sources, normales, licences,
//     définition du cumul OSCAR) + exemple officiel (Wallis-et-Futuna).
//   • Couverture  : matrice binaire territoires × années, ADAPTATIVE —
//     elle suit la mesure choisie ; les vides montrés, jamais comblés.
// ============================================================

import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchCiel } from "../../services/cielApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import DatasetSwitcher from "../../components/DatasetSwitcher/DatasetSwitcher";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ApexYearHeatmap from "../../components/charts/ApexYearHeatmap";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import BarRace from "../../components/BarRace/BarRace";
import CoverageChart from "../../components/charts/CoverageChart";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act8Ciel.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = Object.entries(SUBREGIONS).reduce((acc, [r, codes]) => {
  codes.forEach((c) => (acc[c] = r));
  return acc;
}, {});
const REGION_KEYS = ["all", "melanesia", "polynesia", "micronesia"];

const fmtVal = (v, kind) =>
  !Number.isFinite(v)
    ? "—"
    : kind === "count"
      ? String(Math.round(v))
      : Math.abs(v) < 10
        ? String(Math.round(v * 100) / 100).replace(".", ",")
        : String(Math.round(v));

function valueAt(values, year) {
  if (!values || !values.length) return null;
  let out = null;
  for (const p of values) {
    if (p.year === year) return p.value;
    if (p.year <= year) out = p.value;
  }
  return out;
}
function exactAt(values, year) {
  if (!values || !values.length) return null;
  const hit = values.find((p) => p.year === year);
  return hit ? hit.value : null;
}
function mean(nums) {
  const a = nums.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function toSeries(ind, lang) {
  if (!ind || ind.status !== "live") return [];
  return (ind.areas || [])
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (ind.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }))
    .filter((s) => s.values.length);
}
function buildRank(series, year) {
  return series
    .map((s) => ({
      area: s.area,
      name: s.name,
      value: valueAt(s.values, year),
    }))
    .filter((r) => Number.isFinite(r.value));
}
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => ({
      area: s.area,
      name: s.name,
      a: valueAt(s.values, yearA),
      b: valueAt(s.values, yearB),
    }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}
function anomalyBand(series, years) {
  return years
    .map((y) => {
      const vals = series
        .map((s) => exactAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      if (!vals.length) return null;
      return {
        year: y,
        mean: mean(vals),
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    })
    .filter(Boolean);
}
function totalLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series
        .map((s) => valueAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      return got.length
        ? { year: y, value: got.reduce((a, b) => a + b, 0) }
        : null;
    })
    .filter(Boolean);
  return vals.length ? [{ area: "REG", name, values: vals }] : [];
}
function raceFrom(series, years, lang) {
  return series
    .map((s) => {
      const sorted = [...s.values].sort((a, b) => a.year - b.year);
      let last = null;
      const values = years.map((y) => {
        const ex = sorted.find((p) => p.year === y);
        if (ex) last = ex.value;
        return { year: y, value: last == null ? 0 : last };
      });
      return { area: s.area, name: pictName(s.area, lang), values };
    })
    .filter((r) => r.values.some((v) => v.value > 0));
}

/* ---------- Filtres globaux ---------- */
function Select({ label, options, value, onChange }) {
  return (
    <div className="act1f act1f--select">
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__selwrap">
        <select
          className="act1f__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {options.map((o) => (
            <option key={String(o.v)} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="act1f__caret" aria-hidden="true">
          ▾
        </span>
      </div>
    </div>
  );
}

export default function Act8Ciel() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [metric, setMetric] = useState("rain");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchCiel({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const rain = data?.rain;
  const temp = data?.landTemp;
  const meteo = data?.meteo;

  const rainAll = useMemo(() => toSeries(rain, lang), [rain, lang]);
  const tempAll = useMemo(() => toSeries(temp, lang), [temp, lang]);
  const meteoAll = useMemo(() => toSeries(meteo, lang), [meteo, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([
      ...rainAll.map((s) => s.area),
      ...tempAll.map((s) => s.area),
      ...meteoAll.map((s) => s.area),
    ]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [rainAll, tempAll, meteoAll, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const rainS = useMemo(
    () => rainAll.filter((s) => areaVisible(s.area)),
    [rainAll, areaVisible],
  );
  const tempS = useMemo(
    () => tempAll.filter((s) => areaVisible(s.area)),
    [tempAll, areaVisible],
  );
  const meteoS = useMemo(
    () => meteoAll.filter((s) => areaVisible(s.area)),
    [meteoAll, areaVisible],
  );

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [rainA, rainB] = span(rain, 1979, 2025);
  const [tempA, tempB] = span(temp, 1850, 2025);
  const [meteoA, meteoB] = span(meteo, 1889, 2026);

  const rainYears = useMemo(() => rain?.years || [], [rain]);
  const tempYears = useMemo(() => temp?.years || [], [temp]);
  const meteoYears = useMemo(() => meteo?.years || [], [meteo]);

  const rainBand = useMemo(
    () => anomalyBand(rainS, rainYears),
    [rainS, rainYears],
  );
  const tempBand = useMemo(
    () => anomalyBand(tempS, tempYears),
    [tempS, tempYears],
  );
  const meteoLine = useMemo(
    () => totalLine(meteoS, meteoYears, t("act8.meteo_total_name")),
    [meteoS, meteoYears, t],
  );
  const meteoRace = useMemo(
    () => raceFrom(meteoS, meteoYears, lang),
    [meteoS, meteoYears, lang],
  );

  const rainRank = useMemo(() => buildRank(rainS, rainB), [rainS, rainB]);
  const tempRank = useMemo(() => buildRank(tempS, tempB), [tempS, tempB]);
  const meteoRank = useMemo(() => buildRank(meteoS, meteoB), [meteoS, meteoB]);

  const rainDumb = useMemo(
    () => buildDumbbell(rainS, rainA, rainB),
    [rainS, rainA, rainB],
  );
  const tempDumb = useMemo(
    () => buildDumbbell(tempS, tempA, tempB),
    [tempS, tempA, tempB],
  );
  const meteoDumb = useMemo(
    () => buildDumbbell(meteoS, meteoA, meteoB),
    [meteoS, meteoA, meteoB],
  );

  // Définition de la mesure active.
  const M = useMemo(() => {
    if (metric === "rain")
      return {
        kind: "anom",
        series: rainS,
        band: rainBand,
        rank: rainRank,
        dumb: rainDumb,
        years: rainYears,
        unit: t("act8.rain_unit"),
        A: rainA,
        B: rainB,
        tone: "accent",
        baseline: t("act8.rain_baseline"),
        below: t("act8.rain_hm_below"),
        above: t("act8.rain_hm_above"),
        titles: {
          trend: t("act8.regional_rain_title"),
          multiples: t("act8.rain_title"),
          heat: t("act8.rain_hm_title"),
          change: t("act8.rain_cmp_title"),
        },
      };
    if (metric === "temp")
      return {
        kind: "anom",
        series: tempS,
        band: tempBand,
        rank: tempRank,
        dumb: tempDumb,
        years: tempYears,
        unit: t("act8.temp_unit"),
        A: tempA,
        B: tempB,
        tone: "warm",
        baseline: t("act8.temp_baseline"),
        below: t("act8.temp_hm_below"),
        above: t("act8.temp_hm_above"),
        titles: {
          trend: t("act8.regional_temp_title"),
          multiples: t("act8.temp_title"),
          heat: t("act8.temp_hm_title"),
          change: t("act8.temp_cmp_title"),
        },
      };
    return {
      kind: "count",
      series: meteoS,
      line: meteoLine,
      race: meteoRace,
      rank: meteoRank,
      dumb: meteoDumb,
      years: meteoYears,
      unit: t("act8.meteo_unit"),
      A: meteoA,
      B: meteoB,
      titles: {
        trend: t("act8.regional_meteo_title"),
        multiples: t("act8.meteo_title"),
        heat: t("act8.meteo_hm_title"),
        change: t("act8.meteo_cmp_title"),
        rank: t("act8.meteo_rank_title"),
      },
    };
  }, [
    metric,
    rainS,
    rainBand,
    rainRank,
    rainDumb,
    rainYears,
    rainA,
    rainB,
    tempS,
    tempBand,
    tempRank,
    tempDumb,
    tempYears,
    tempA,
    tempB,
    meteoS,
    meteoLine,
    meteoRace,
    meteoRank,
    meteoDumb,
    meteoYears,
    meteoA,
    meteoB,
    t,
  ]);

  // Décimales par mesure : mm en entiers, °C à 2 décimales, stations en entiers.
  const metricDecimals = metric === "temp" ? 2 : 0;

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    if (!xs.length) return { min: 0, max: 1 };
    if (M.kind === "anom") {
      const m = Math.max(...xs.map((v) => Math.abs(v)));
      return { min: -m, max: m };
    }
    return { min: 0, max: Math.max(...xs) };
  }, [M.series, M.kind]);

  const kpiItems = useMemo(() => {
    if (!M.rank.length) return [];
    const sorted = [...M.rank].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    const med = median(M.rank.map((r) => r.value));
    return [
      {
        key: "med",
        value: fmtVal(med, M.kind),
        unit: M.unit,
        label: t("act8.board.kpi_med"),
        tone: "accent",
      },
      {
        key: "high",
        value: fmtVal(high.value, M.kind),
        unit: high.name,
        label: t("act8.board.kpi_high"),
        tone: "warm",
      },
      {
        key: "low",
        value: fmtVal(low.value, M.kind),
        unit: low.name,
        label: t("act8.board.kpi_low"),
        tone: "positive",
      },
    ];
  }, [M.rank, M.unit, M.kind, t]);

  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchCiel({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  // Jeux de données pour le sélecteur en cartes (icône + unité + sparkline).
  // Spark : moyenne régionale annuelle (anomalies) ou total réseau par an.
  const measureItems = [
    {
      id: "rain",
      label: t("act8.board.metric_rain"),
      unit: t("act8.rain_unit"),
      icon: "rain",
      tone: "accent",
      spark: rainBand.map((d) => d.mean),
    },
    {
      id: "temp",
      label: t("act8.board.metric_temp"),
      unit: t("act8.temp_unit"),
      icon: "temp",
      tone: "warm",
      spark: tempBand.map((d) => d.mean),
    },
    {
      id: "meteo",
      label: t("act8.board.metric_meteo"),
      unit: t("act8.meteo_unit"),
      icon: "network",
      tone: "positive",
      spark: meteoLine[0] ? meteoLine[0].values.map((v) => v.value) : [],
    },
  ];
  // Régions en cartes : sparkline = agrégat régional de la mesure active
  // (moyenne des anomalies, ou total réseau par an) → la couleur suit le jeu.
  const metricAll =
    metric === "rain" ? rainAll : metric === "temp" ? tempAll : meteoAll;
  const regionSpark = (subset) =>
    M.kind === "count"
      ? ((totalLine(subset, M.years, "")[0] || {}).values || []).map(
          (v) => v.value,
        )
      : anomalyBand(subset, M.years).map((d) => d.mean);
  const regionItems = REGION_KEYS.map((k) => {
    const subset =
      k === "all"
        ? metricAll
        : metricAll.filter((s) => REGION_OF[s.area] === k);
    return {
      id: k,
      label: t(`act1.filter.${k}`),
      unit: String(subset.length),
      icon: k === "all" ? "globe" : "map",
      tone: M.tone || "positive",
      spark: regionSpark(subset),
    };
  });

  const status =
    state.status === "ready"
      ? M.series.length
        ? "ready"
        : "empty"
      : state.status === "loading"
        ? "loading"
        : "empty";

  const filtersEl = (
    <>
      <DatasetSwitcher
        label={t("act8.board.group_measure")}
        items={measureItems}
        value={metric}
        onChange={setMetric}
        iconOnly
        hideSpark
      />
      <DatasetSwitcher
        label={t("act8.board.group_zone")}
        items={regionItems}
        value={region}
        onChange={(k) => {
          setRegion(k);
          setCountry("all");
        }}
        dense
        hideSpark
      />
    </>
  );

  // Carte d'identité TRIPLE (pluie + température + réseau) — 100 % i18n / fiches officielles.
  const spotlightRows = [
    { k: t("act8.spotlight.r1k"), v: t("act8.spotlight.r1v") },
    { k: t("act8.spotlight.r2k"), v: t("act8.spotlight.r2v") },
    { k: t("act8.spotlight.r3k"), v: t("act8.spotlight.r3v") },
    { k: t("act8.spotlight.r4k"), v: t("act8.spotlight.r4v") },
    { k: t("act8.spotlight.r5k"), v: t("act8.spotlight.r5v") },
    { k: t("act8.spotlight.r6k"), v: t("act8.spotlight.r6v") },
  ];
  const spotlightNotes = [
    t("act8.spotlight.n1"),
    t("act8.spotlight.n2"),
    t("act8.spotlight.n3"),
    t("act8.spotlight.n4"),
    t("act8.spotlight.n5"),
  ];

  const readChart = {
    id: "read",
    empty: false,
    tab: t("act8.board.tab_read"),
    title: t("act8.read_title"),
    finding: t("act8.board.read_find"),
    takeaway: t("act8.board.read_take"),
    node: (
      <DataSpotlight
        rows={spotlightRows}
        notes={spotlightNotes}
        example={{
          kicker: t("act8.spotlight.ex_kicker"),
          text: t("act8.spotlight.ex_text"),
        }}
        link={{
          href: "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly",
          label: t("act8.spotlight.link_label"),
        }}
      />
    ),
  };

  const coverageChart = {
    id: "coverage",
    empty: M.series.length === 0,
    tab: t("act8.board.tab_coverage"),
    title: t("act8.coverage_title"),
    finding: t("act8.board.coverage_find"),
    takeaway: t("act8.board.coverage_take"),
    node: (
      <CoverageChart
        series={M.series}
        years={M.years}
        labels={{
          present: t("act1.coverage.present"),
          absent: t("act1.coverage.absent"),
        }}
      />
    ),
  };

  // Onglet « tendance » : bande d'anomalie (pluie/temp) ou total réseau (météo).
  const trendChart =
    M.kind === "anom"
      ? {
          id: "trend",
          signature: true,
          empty: !M.band.length,
          tab: t("act8.board.tab_trend"),
          title: M.titles.trend,
          finding: t("act8.board.trend_find"),
          takeaway: t("act8.board.trend_take"),
          node: (
            <div className="act8b__fit">
              <AnomalyTrend
                data={M.band}
                currentYear={M.B}
                unit={M.unit}
                tone={M.tone}
                baselineLabel={M.baseline}
                meanLabel={t("act8.mean_label")}
              />
            </div>
          ),
        }
      : {
          id: "trend",
          signature: true,
          empty: !M.line.length,
          tab: t("act8.board.tab_trend"),
          title: M.titles.trend,
          finding: t("act8.board.trend_find"),
          takeaway: t("act8.board.trend_take"),
          node: (
            <div className="act8b__fit">
              <TrendLines
                series={M.line}
                years={M.years}
                currentYear={M.B}
                unit={M.unit}
              />
            </div>
          ),
        };

  // Onglet variable : haltères (anomalies) ou course animée (météo).
  const changeChart =
    M.kind === "anom"
      ? {
          id: "change",
          empty: M.dumb.length === 0,
          tab: t("act8.board.tab_change"),
          title: `${M.titles.change} · ${M.A}–${M.B}`,
          finding: t("act8.board.change_find"),
          takeaway: t("act8.board.change_take"),
          node: (
            <div className="act8b__scroll">
              <DumbbellChart
                rows={M.dumb}
                yearA={M.A}
                yearB={M.B}
                unit={M.unit}
                decimals={metricDecimals}
                labels={cmpLabels}
              />
            </div>
          ),
        }
      : {
          id: "race",
          empty: M.race.length < 2,
          tab: t("act8.board.tab_race"),
          title: M.titles.rank,
          finding: t("act8.board.race_find"),
          takeaway: t("act8.board.race_take"),
          node: (
            <BarRace
              series={M.race}
              years={M.years}
              unit={M.unit}
              decimals={0}
              tk={tk}
              labels={{
                play: t("act1.race.play"),
                pause: t("act1.race.pause"),
                restart: t("act1.race.restart"),
              }}
            />
          ),
        };

  const charts =
    status === "ready"
      ? [
          trendChart,
          readChart,
          {
            id: "multiples",
            empty: M.series.length === 0,
            tab: t("act8.board.tab_multiples"),
            title: M.titles.multiples,
            finding: t("act8.board.multiples_find"),
            takeaway: t("act8.board.multiples_take"),
            node: (
              <div className="act8b__scroll">
                <SmallMultiples
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  currentYear={M.B}
                  labels={{ last: t("act6.smallmult_last") }}
                />
              </div>
            ),
          },
          {
            id: "heat",
            empty: M.series.length === 0,
            tab: t("act8.board.tab_heat"),
            title: M.titles.heat,
            finding: t("act8.board.heat_find"),
            takeaway: t("act8.board.heat_take"),
            node: (
              <div className="act8b__scroll">
                <ApexYearHeatmap
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  scale={M.kind === "anom" ? "diverging" : "sequential"}
                  scheme="greenRed"
                  decimals={metricDecimals}
                  labels={{
                    below: M.below,
                    above: M.above,
                    mid: t("act8.board.map_mid"),
                    low: t("act6.heatmap_low"),
                    high: t("act6.heatmap_high"),
                  }}
                />
              </div>
            ),
          },
          changeChart,
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: t("act8.board.tab_map"),
            title: `${t("act8.board.map_title")} · ${M.B}`,
            finding: t("act8.board.map_find"),
            takeaway: t("act8.board.map_take"),
            node: (
              <ErrorBoundary
                fallback={
                  <div className="board__state board__state--err">
                    {t("scene.error")}
                  </div>
                }
              >
                <Suspense
                  fallback={<Loader compact label={t("scene.loading")} />}
                >
                  <OceanMap
                    data={M.rank}
                    unit={M.unit}
                    range={mapRange}
                    lowLabel={t("act6.heatmap_low")}
                    midLabel={
                      M.kind === "anom" ? t("act8.board.map_mid") : undefined
                    }
                    highLabel={t("act6.heatmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          coverageChart,
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act8.tag")}
      title={t("act8.title")}
      thesis={t("act8.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      nav="carousel"
      initialTab="map"
      progress={{ index: 3, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act8.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act8.board.switch_hint"),
        signature: t("act8.board.signature"),
        takeawayKicker: t("act8.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act8.board.start"),
        conclusion: t("act8.board.conclusion"),
        backIntro: t("act8.board.back_intro"),
        reviseData: t("act8.board.revise_data"),
        viewGroup: t("act8.board.group_view"),
      }}
      outro={{
        kicker: t("act8.outro.kicker"),
        title: t("act8.outro.title"),
        text: t("act8.outro.text"),
        primary: { to: "/cyclones", label: t("act8.outro.next") },
        secondary: { to: "/", label: t("act8.outro.home") },
      }}
    />
  );
}
