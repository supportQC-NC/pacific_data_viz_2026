// src/pages/Act9Eco/Act9Eco.jsx
// ============================================================
// Acte 09 — L'économie : tourisme, électricité, fiscalité verte.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (mesure + sous-région +
// territoire). Onglets variés : tendance (signature), petits multiples,
// course animée, évolution (haltères), chaleur, RADAR par décennie
// (profil régional) et carte 3D. Deck/guides/tableau retirés.
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
import { fetchEco } from "../../services/ecoApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import RadarChart from "../../components/charts/RadarChart";
import BarRace from "../../components/BarRace/BarRace";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act9Eco.scss";

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

const fmtVal = (v) =>
  !Number.isFinite(v)
    ? "—"
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
function buildRankMax(series) {
  return series
    .map((s) => {
      const vals = s.values
        .map((p) => p.value)
        .filter((n) => Number.isFinite(n));
      return {
        area: s.area,
        name: s.name,
        value: vals.length ? Math.max(...vals) : null,
      };
    })
    .filter((r) => Number.isFinite(r.value) && r.value > 0);
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
// Moyenne par sous-région et par année → groupes pour le radar (par décennie).
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

export default function Act9Eco() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [metric, setMetric] = useState("tour");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchEco({ lang, signal: ctrl.signal }).then((res) => {
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
  const tour = data?.tourism;
  const power = data?.power;
  const tax = data?.envTax;

  const tourAll = useMemo(() => toSeries(tour, lang), [tour, lang]);
  const powerAll = useMemo(() => toSeries(power, lang), [power, lang]);
  const taxAll = useMemo(() => toSeries(tax, lang), [tax, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([
      ...tourAll.map((s) => s.area),
      ...powerAll.map((s) => s.area),
      ...taxAll.map((s) => s.area),
    ]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [tourAll, powerAll, taxAll, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const tourS = useMemo(
    () => tourAll.filter((s) => areaVisible(s.area)),
    [tourAll, areaVisible],
  );
  const powerS = useMemo(
    () => powerAll.filter((s) => areaVisible(s.area)),
    [powerAll, areaVisible],
  );
  const taxS = useMemo(
    () => taxAll.filter((s) => areaVisible(s.area)),
    [taxAll, areaVisible],
  );

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [tourA, tourB] = span(tour, 1995, 2024);
  const [powerA, powerB] = span(power, 2000, 2023);
  const [taxA, taxB] = span(tax, 1995, 2021);

  const tourYears = useMemo(() => tour?.years || [], [tour]);
  const powerYears = useMemo(() => power?.years || [], [power]);
  const taxYears = useMemo(() => tax?.years || [], [tax]);

  const tourLine = useMemo(
    () => totalLine(tourS, tourYears, t("act9.tour_total_name")),
    [tourS, tourYears, t],
  );
  const powerLine = useMemo(
    () => totalLine(powerS, powerYears, t("act9.power_total_name")),
    [powerS, powerYears, t],
  );
  const taxLine = useMemo(
    () => medianLine(taxS, taxYears, t("act9.tax_median_name")),
    [taxS, taxYears, t],
  );

  const tourRank = useMemo(() => buildRank(tourS, tourB), [tourS, tourB]);
  const powerRank = useMemo(() => buildRank(powerS, powerB), [powerS, powerB]);
  const taxRank = useMemo(() => buildRankMax(taxS), [taxS]);

  const tourDumb = useMemo(
    () => buildDumbbell(tourS, tourA, tourB),
    [tourS, tourA, tourB],
  );
  const powerDumb = useMemo(
    () => buildDumbbell(powerS, powerA, powerB),
    [powerS, powerA, powerB],
  );
  const taxDumb = useMemo(
    () => buildDumbbell(taxS, taxA, taxB),
    [taxS, taxA, taxB],
  );

  const tourRace = useMemo(
    () => raceFrom(tourS, tourYears, lang),
    [tourS, tourYears, lang],
  );
  const powerRace = useMemo(
    () => raceFrom(powerS, powerYears, lang),
    [powerS, powerYears, lang],
  );
  const taxRace = useMemo(
    () => raceFrom(taxS, taxYears, lang),
    [taxS, taxYears, lang],
  );

  // Profil radar par sous-région (toujours sur l'ensemble — vue régionale).
  const tourSub = useMemo(
    () => subAverages(tourAll, tourYears, t),
    [tourAll, tourYears, t],
  );
  const powerSub = useMemo(
    () => subAverages(powerAll, powerYears, t),
    [powerAll, powerYears, t],
  );
  const taxSub = useMemo(
    () => subAverages(taxAll, taxYears, t),
    [taxAll, taxYears, t],
  );

  const M = useMemo(() => {
    if (metric === "tour")
      return {
        series: tourS,
        line: tourLine,
        rank: tourRank,
        dumb: tourDumb,
        race: tourRace,
        sub: tourSub,
        years: tourYears,
        unit: t("act9.tour_unit"),
        A: tourA,
        B: tourB,
        titles: {
          trend: t("act9.regional_tour_title"),
          multiples: t("act9.tour_title"),
          heat: t("act9.tour_hm_title"),
          change: t("act9.tour_cmp_title"),
          rank: t("act9.tour_rank_title"),
        },
      };
    if (metric === "power")
      return {
        series: powerS,
        line: powerLine,
        rank: powerRank,
        dumb: powerDumb,
        race: powerRace,
        sub: powerSub,
        years: powerYears,
        unit: t("act9.power_unit"),
        A: powerA,
        B: powerB,
        titles: {
          trend: t("act9.regional_power_title"),
          multiples: t("act9.power_title"),
          heat: t("act9.power_hm_title"),
          change: t("act9.power_cmp_title"),
          rank: t("act9.power_rank_title"),
        },
      };
    return {
      series: taxS,
      line: taxLine,
      rank: taxRank,
      dumb: taxDumb,
      race: taxRace,
      sub: taxSub,
      years: taxYears,
      unit: t("act9.tax_unit"),
      A: taxA,
      B: taxB,
      titles: {
        trend: t("act9.regional_tax_title"),
        multiples: t("act9.tax_title"),
        heat: t("act9.tax_hm_title"),
        change: t("act9.tax_cmp_title"),
        rank: t("act9.tax_rank_title"),
      },
    };
  }, [
    metric,
    tourS,
    tourLine,
    tourRank,
    tourDumb,
    tourRace,
    tourSub,
    tourYears,
    tourA,
    tourB,
    powerS,
    powerLine,
    powerRank,
    powerDumb,
    powerRace,
    powerSub,
    powerYears,
    powerA,
    powerB,
    taxS,
    taxLine,
    taxRank,
    taxDumb,
    taxRace,
    taxSub,
    taxYears,
    taxA,
    taxB,
    t,
  ]);

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
        value: fmtVal(med),
        unit: M.unit,
        label: t("act9.board.kpi_med"),
        tone: "accent",
      },
      {
        key: "high",
        value: fmtVal(high.value),
        unit: high.name,
        label: t("act9.board.kpi_high"),
        tone: "positive",
      },
      {
        key: "low",
        value: fmtVal(low.value),
        unit: low.name,
        label: t("act9.board.kpi_low"),
        tone: "warm",
      },
    ];
  }, [M.rank, M.unit, t]);

  const heatLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchEco({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  const regionOpts = REGION_KEYS.map((k) => ({
    v: k,
    label: t(`act1.filter.${k}`),
  }));
  const metricOpts = [
    { v: "tour", label: t("act9.board.metric_tour") },
    { v: "power", label: t("act9.board.metric_power") },
    { v: "tax", label: t("act9.board.metric_tax") },
  ];
  const countryOpts = [
    { v: "all", label: t("act7.country_all") },
    ...countryOptions.map((c) => ({ v: c.area, label: c.name })),
  ];

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
      <Select
        label={t("act9.board.metric_label")}
        options={metricOpts}
        value={metric}
        onChange={setMetric}
      />
      <Select
        label={t("act1.filter.title")}
        options={regionOpts}
        value={region}
        onChange={(k) => {
          setRegion(k);
          setCountry("all");
        }}
      />
      <Select
        label={t("act7.country_label")}
        options={countryOpts}
        value={country}
        onChange={setCountry}
      />
    </>
  );

  const charts =
    status === "ready"
      ? [
          {
            id: "trend",
            signature: true,
            empty: !M.line.length,
            tab: t("act9.board.tab_trend"),
            title: M.titles.trend,
            finding: t("act9.board.trend_find"),
            takeaway: t("act9.board.trend_take"),
            node: (
              <div className="act9b__fit">
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
            id: "multiples",
            empty: M.series.length === 0,
            tab: t("act9.board.tab_multiples"),
            title: M.titles.multiples,
            finding: t("act9.board.multiples_find"),
            takeaway: t("act9.board.multiples_take"),
            node: (
              <div className="act9b__scroll">
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
            tab: t("act9.board.tab_race"),
            title: M.titles.rank,
            finding: t("act9.board.race_find"),
            takeaway: t("act9.board.race_take"),
            node: (
              <BarRace
                series={M.race}
                years={M.years}
                unit={M.unit}
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
            tab: t("act9.board.tab_change"),
            title: `${M.titles.change} · ${M.A}–${M.B}`,
            finding: t("act9.board.change_find"),
            takeaway: t("act9.board.change_take"),
            node: (
              <DumbbellChart
                rows={M.dumb}
                yearA={M.A}
                yearB={M.B}
                unit={M.unit}
                labels={cmpLabels}
              />
            ),
          },
          {
            id: "heat",
            empty: M.series.length === 0,
            tab: t("act9.board.tab_heat"),
            title: M.titles.heat,
            finding: t("act9.board.heat_find"),
            takeaway: t("act9.board.heat_take"),
            node: (
              <div className="act9b__fit">
                <EmissionsHeatmap
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  scale="sequential"
                  labels={heatLabels}
                />
              </div>
            ),
          },
          {
            id: "radar",
            empty: M.sub.length < 2,
            tab: t("act9.board.tab_radar"),
            title: t("act9.board.radar_title"),
            finding: t("act9.board.radar_find"),
            takeaway: t("act9.board.radar_take"),
            node: (
              <div className="act9b__fit">
                <RadarChart subAvg={M.sub} years={M.years} />
              </div>
            ),
          },
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: t("act9.board.tab_map"),
            title: `${t("act9.board.map_title")} · ${M.B}`,
            finding: t("act9.board.map_find"),
            takeaway: t("act9.board.map_take"),
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
                    ramp="good"
                    lowLabel={t("act6.heatmap_low")}
                    highLabel={t("act6.heatmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act9.tag")}
      title={t("act9.title")}
      thesis={t("act9.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 9, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act9.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act9.board.switch_hint"),
        signature: t("act9.board.signature"),
        takeawayKicker: t("act9.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act9.board.start"),
        conclusion: t("act9.board.conclusion"),
        backIntro: t("act9.board.back_intro"),
        reviseData: t("act9.board.revise_data"),
      }}
      outro={{
        kicker: t("act9.outro.kicker"),
        title: t("act9.outro.title"),
        text: t("act9.outro.text"),
        primary: { to: "/sante", label: t("act9.outro.next") },
        secondary: { to: "/", label: t("act9.outro.home") },
      }}
    />
  );
}
