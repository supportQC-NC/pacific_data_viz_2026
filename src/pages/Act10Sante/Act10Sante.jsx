// src/pages/Act10Sante/Act10Sante.jsx
// ============================================================
// Acte 10 — La santé : accès à l'eau potable & tuberculose.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (mesure + sous-région +
// territoire). Onglets variés : tendance (signature), petits multiples,
// course animée, évolution (haltères), chaleur, radar (profil régional)
// et carte 3D. Guides/cartes dépliables retirés.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSante } from "../../services/santeApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import DatasetSwitcher from "../../components/DatasetSwitcher/DatasetSwitcher";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ApexYearHeatmap from "../../components/charts/ApexYearHeatmap";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import RadarChart from "../../components/charts/RadarChart";
import BarRace from "../../components/BarRace/BarRace";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act10Sante.scss";

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

const fmtVal = (v, decimals) =>
  !Number.isFinite(v)
    ? "—"
    : decimals === 0
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
function medianLine(series, years, name) {
  const vals = years
    .map((y) => {
      const v = series
        .map((s) => valueAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      const m = median(v);
      return m == null ? null : { year: y, value: m };
    })
    .filter(Boolean);
  return vals.length ? [{ area: "MED", name, values: vals }] : [];
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
function subAverages(all, years, t) {
  return Object.keys(SUBREGIONS)
    .map((reg) => {
      const members = all.filter((s) => REGION_OF[s.area] === reg);
      if (!members.length) return null;
      const values = years
        .map((y) => {
          const vs = members
            .map((s) => valueAt(s.values, y))
            .filter((n) => Number.isFinite(n));
          return vs.length
            ? { year: y, value: vs.reduce((a, b) => a + b, 0) / vs.length }
            : null;
        })
        .filter(Boolean);
      return values.length ? { name: t(`act1.filter.${reg}`), values } : null;
    })
    .filter(Boolean);
}

export default function Act10Sante() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [metric, setMetric] = useState("water");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSante({ lang, signal: ctrl.signal }).then((res) => {
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
  const water = data?.water;
  const tb = data?.tb;

  const waterAll = useMemo(() => toSeries(water, lang), [water, lang]);
  const tbAll = useMemo(() => toSeries(tb, lang), [tb, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const waterS = useMemo(
    () => waterAll.filter((s) => areaVisible(s.area)),
    [waterAll, areaVisible],
  );
  const tbS = useMemo(
    () => tbAll.filter((s) => areaVisible(s.area)),
    [tbAll, areaVisible],
  );

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [waterA, waterB] = span(water, 2000, 2022);
  const [tbA, tbB] = span(tb, 2000, 2023);

  const waterYears = useMemo(() => water?.years || [], [water]);
  const tbYears = useMemo(() => tb?.years || [], [tb]);

  const waterLine = useMemo(
    () => medianLine(waterS, waterYears, t("act10.water_med_name")),
    [waterS, waterYears, t],
  );
  const tbLine = useMemo(
    () => medianLine(tbS, tbYears, t("act10.tb_med_name")),
    [tbS, tbYears, t],
  );

  const waterRank = useMemo(() => buildRank(waterS, waterB), [waterS, waterB]);
  const tbRank = useMemo(() => buildRank(tbS, tbB), [tbS, tbB]);

  const waterDumb = useMemo(
    () => buildDumbbell(waterS, waterA, waterB),
    [waterS, waterA, waterB],
  );
  const tbDumb = useMemo(() => buildDumbbell(tbS, tbA, tbB), [tbS, tbA, tbB]);

  const waterRace = useMemo(
    () => raceFrom(waterS, waterYears, lang),
    [waterS, waterYears, lang],
  );
  const tbRace = useMemo(
    () => raceFrom(tbS, tbYears, lang),
    [tbS, tbYears, lang],
  );

  const waterSub = useMemo(
    () => subAverages(waterAll, waterYears, t),
    [waterAll, waterYears, t],
  );
  const tbSub = useMemo(
    () => subAverages(tbAll, tbYears, t),
    [tbAll, tbYears, t],
  );

  const isWater = metric === "water";
  const metricDecimals = isWater ? 1 : 0;
  const M = isWater
    ? {
        series: waterS,
        line: waterLine,
        rank: waterRank,
        dumb: waterDumb,
        race: waterRace,
        sub: waterSub,
        years: waterYears,
        unit: t("act10.water_unit"),
        A: waterA,
        B: waterB,
        ramp: "good",
        highTone: "positive",
        lowTone: "warm",
        cmp: { up: t("act10.water_cmp_up"), down: t("act10.water_cmp_down") },
        titles: {
          trend: t("act10.regional_water_title"),
          multiples: t("act10.water_title"),
          heat: t("act10.water_hm_title"),
          change: t("act10.water_cmp_title"),
          rank: t("act10.water_rank_title"),
        },
      }
    : {
        series: tbS,
        line: tbLine,
        rank: tbRank,
        dumb: tbDumb,
        race: tbRace,
        sub: tbSub,
        years: tbYears,
        unit: t("act10.tb_unit"),
        A: tbA,
        B: tbB,
        ramp: undefined,
        highTone: "warm",
        lowTone: "positive",
        cmp: { up: t("act10.tb_cmp_up"), down: t("act10.tb_cmp_down") },
        titles: {
          trend: t("act10.regional_tb_title"),
          multiples: t("act10.tb_title"),
          heat: t("act10.tb_hm_title"),
          change: t("act10.tb_cmp_title"),
          rank: t("act10.tb_rank_title"),
        },
      };

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    return xs.length ? { min: 0, max: Math.max(...xs) } : { min: 0, max: 1 };
  }, [M.series]);

  const kpiItems = useMemo(() => {
    if (!M.rank.length) return [];
    const sorted = [...M.rank].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    const med = median(M.rank.map((r) => r.value));
    return [
      {
        key: "med",
        value: fmtVal(med, metricDecimals),
        unit: M.unit,
        label: t("act10.board.kpi_med"),
        tone: "accent",
      },
      {
        key: "high",
        value: fmtVal(high.value, metricDecimals),
        unit: high.name,
        label: t("act10.board.kpi_high"),
        tone: M.highTone,
      },
      {
        key: "low",
        value: fmtVal(low.value, metricDecimals),
        unit: low.name,
        label: t("act10.board.kpi_low"),
        tone: M.lowTone,
      },
    ];
  }, [M.rank, M.unit, M.highTone, M.lowTone, metricDecimals, t]);

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchSante({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  // Deux JEUX DE DONNÉES traités à égalité, basculés par icônes.
  const metricItems = [
    {
      id: "water",
      label: t("act10.board.metric_water"),
      icon: "rain",
      tone: "accent",
    },
    {
      id: "tb",
      label: t("act10.board.metric_tb"),
      icon: "pulse",
      tone: "warm",
    },
  ];
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));

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
        label={t("act10.board.metric_label")}
        items={metricItems}
        value={metric}
        onChange={setMetric}
        iconOnly
        hideSpark
      />
      <DatasetSwitcher
        label={t("act1.filter.title")}
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

  // Carte d'identité DOUBLE (eau + tuberculose) — 100 % i18n / métadonnées ONU.
  const spotlightRows = [
    { k: t("act10.spotlight.r1k"), v: t("act10.spotlight.r1v") },
    { k: t("act10.spotlight.r2k"), v: t("act10.spotlight.r2v") },
    { k: t("act10.spotlight.r3k"), v: t("act10.spotlight.r3v") },
    { k: t("act10.spotlight.r4k"), v: t("act10.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act10.spotlight.n1"),
    t("act10.spotlight.n2"),
    t("act10.spotlight.n3"),
    t("act10.spotlight.n4"),
    t("act10.spotlight.n5"),
  ];

  const charts =
    status === "ready"
      ? [
          {
            id: "trend",
            signature: true,
            empty: !M.line.length,
            tab: t("act10.board.tab_trend"),
            title: M.titles.trend,
            finding: t("act10.board.trend_find"),
            takeaway: t("act10.board.trend_take"),
            node: (
              <div className="act10b__fit">
                <TrendLines
                  series={M.line}
                  years={M.years}
                  currentYear={M.B}
                  unit={M.unit}
                />
              </div>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act10.board.tab_read"),
            title: t("act10.read_title"),
            finding: t("act10.board.read_find"),
            takeaway: t("act10.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act10.spotlight.ex_kicker"),
                  text: t("act10.spotlight.ex_text"),
                }}
                link={{
                  href: "https://washdata.org/",
                  label: t("act10.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "multiples",
            empty: M.series.length === 0,
            tab: t("act10.board.tab_multiples"),
            title: M.titles.multiples,
            finding: t("act10.board.multiples_find"),
            takeaway: t("act10.board.multiples_take"),
            node: (
              <div className="act10b__scroll">
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
            id: "race",
            empty: M.race.length < 2,
            tab: t("act10.board.tab_race"),
            title: M.titles.rank,
            finding: t("act10.board.race_find"),
            takeaway: t("act10.board.race_take"),
            node: (
              <BarRace
                series={M.race}
                years={M.years}
                unit={M.unit}
                decimals={metricDecimals}
                tk={tk}
                labels={{
                  play: t("act1.race.play"),
                  pause: t("act1.race.pause"),
                  restart: t("act1.race.restart"),
                }}
              />
            ),
          },
          {
            id: "change",
            empty: M.dumb.length === 0,
            tab: t("act10.board.tab_change"),
            title: `${M.titles.change} · ${M.A}–${M.B}`,
            finding: t("act10.board.change_find"),
            takeaway: t("act10.board.change_take"),
            node: (
              <div className="act10b__scroll">
                <DumbbellChart
                  rows={M.dumb}
                  yearA={M.A}
                  yearB={M.B}
                  unit={M.unit}
                  decimals={metricDecimals}
                  labels={M.cmp}
                />
              </div>
            ),
          },
          {
            id: "heat",
            empty: M.series.length === 0,
            tab: t("act10.board.tab_heat"),
            title: M.titles.heat,
            finding: t("act10.board.heat_find"),
            takeaway: t("act10.board.heat_take"),
            node: (
              <div className="act10b__scroll">
                <ApexYearHeatmap
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  scale="sequential"
                  decimals={metricDecimals}
                  labels={{
                    low: t("act6.heatmap_low"),
                    high: t("act6.heatmap_high"),
                  }}
                />
              </div>
            ),
          },
          {
            id: "radar",
            empty: M.sub.length < 2,
            tab: t("act10.board.tab_radar"),
            title: t("act10.board.radar_title"),
            finding: t("act10.board.radar_find"),
            takeaway: t("act10.board.radar_take"),
            node: (
              <div className="act10b__fit">
                <RadarChart subAvg={M.sub} years={M.years} />
              </div>
            ),
          },
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: t("act10.board.tab_map"),
            title: `${t("act10.board.map_title")} · ${M.B}`,
            finding: t("act10.board.map_find"),
            takeaway: t("act10.board.map_take"),
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
                    ramp={M.ramp}
                    lowLabel={t("act6.heatmap_low")}
                    highLabel={t("act6.heatmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "coverage",
            empty: M.series.length === 0,
            tab: t("act10.board.tab_coverage"),
            title: t("act10.coverage_title"),
            finding: t("act10.board.coverage_find"),
            takeaway: t("act10.board.coverage_take"),
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
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act10.tag")}
      title={t("act10.title")}
      thesis={t("act10.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      nav="carousel"
      progress={{ index: 8, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act10.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act10.board.switch_hint"),
        signature: t("act10.board.signature"),
        takeawayKicker: t("act10.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act10.board.start"),
        conclusion: t("act10.board.conclusion"),
        backIntro: t("act10.board.back_intro"),
        reviseData: t("act10.board.revise_data"),
        viewGroup: t("act10.board.group_view"),
      }}
      outro={{
        kicker: t("act10.outro.kicker"),
        title: t("act10.outro.title"),
        text: t("act10.outro.text"),
        primary: { to: "/impact", label: t("act10.outro.next") },
        secondary: { to: "/", label: t("act10.outro.home") },
      }}
    />
  );
}
