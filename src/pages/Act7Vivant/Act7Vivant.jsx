// src/pages/Act7Vivant/Act7Vivant.jsx
// ============================================================
// Acte 07 — Le vivant : Indice Liste Rouge (biodiversité) & pêche durable.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (mesure + sous-région +
// territoire), tendance régionale en SIGNATURE. Ajouts storytelling :
// course animée (BarRace) + carte 3D (géographie). 6 onglets.
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
import { fetchVivant } from "../../services/vivantApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import BarRace from "../../components/BarRace/BarRace";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act7Vivant.scss";

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
// Course : report en avant de la dernière valeur connue (animation fluide).
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

export default function Act7Vivant() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [metric, setMetric] = useState("redlist");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchVivant({ lang, signal: ctrl.signal }).then((res) => {
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
  const rl = data?.redList;
  const fish = data?.fishMgmt;

  const rlAll = useMemo(() => toSeries(rl, lang), [rl, lang]);
  const fishAll = useMemo(() => toSeries(fish, lang), [fish, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([
      ...rlAll.map((s) => s.area),
      ...fishAll.map((s) => s.area),
    ]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [rlAll, fishAll, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const rlSeries = useMemo(
    () => rlAll.filter((s) => areaVisible(s.area)),
    [rlAll, areaVisible],
  );
  const fishSeries = useMemo(
    () => fishAll.filter((s) => areaVisible(s.area)),
    [fishAll, areaVisible],
  );

  const regionLabel =
    country !== "all" ? pictName(country, lang) : t(`act1.filter.${region}`);
  const medName = `${regionLabel} · ${t("act7.median_name")}`;

  const rlA = rl?.firstYear ?? rl?.years?.[0] ?? 1993;
  const rlB = rl?.lastYear ?? rl?.years?.[rl?.years?.length - 1] ?? 2024;
  const fishA = fish?.firstYear ?? fish?.years?.[0] ?? 1980;
  const fishB =
    fish?.lastYear ?? fish?.years?.[fish?.years?.length - 1] ?? 2024;

  const rlYears = useMemo(() => rl?.years || [], [rl]);
  const fishYears = useMemo(() => fish?.years || [], [fish]);

  const rlRank = useMemo(() => buildRank(rlSeries, rlB), [rlSeries, rlB]);
  const rlDumb = useMemo(
    () => buildDumbbell(rlSeries, rlA, rlB),
    [rlSeries, rlA, rlB],
  );
  const rlMed = useMemo(() => median(rlRank.map((r) => r.value)), [rlRank]);
  const rlLine = useMemo(
    () => medianLine(rlSeries, rlYears, medName),
    [rlSeries, rlYears, medName],
  );
  const rlRace = useMemo(
    () => raceFrom(rlSeries, rlYears, lang),
    [rlSeries, rlYears, lang],
  );

  const fishRank = useMemo(
    () => buildRank(fishSeries, fishB),
    [fishSeries, fishB],
  );
  const fishDumb = useMemo(
    () => buildDumbbell(fishSeries, fishA, fishB),
    [fishSeries, fishA, fishB],
  );
  const fishMed = useMemo(
    () => median(fishRank.map((r) => r.value)),
    [fishRank],
  );
  const fishLine = useMemo(
    () => medianLine(fishSeries, fishYears, medName),
    [fishSeries, fishYears, medName],
  );
  const fishRace = useMemo(
    () => raceFrom(fishSeries, fishYears, lang),
    [fishSeries, fishYears, lang],
  );

  const isRl = metric === "redlist";
  const M = isRl
    ? {
        series: rlSeries,
        line: rlLine,
        dumb: rlDumb,
        rank: rlRank,
        race: rlRace,
        med: rlMed,
        years: rlYears,
        unit: t("act7.redlist_unit"),
        A: rlA,
        B: rlB,
      }
    : {
        series: fishSeries,
        line: fishLine,
        dumb: fishDumb,
        rank: fishRank,
        race: fishRace,
        med: fishMed,
        years: fishYears,
        unit: t("act7.fish_unit"),
        A: fishA,
        B: fishB,
      };

  const titles = isRl
    ? {
        trend: t("act7.regional_rl_title"),
        multiples: t("act7.redlist_title"),
        heat: t("act7.rl_heatmap_title"),
        change: t("act7.rl_compare_title"),
      }
    : {
        trend: t("act7.regional_fish_title"),
        multiples: t("act7.fish_title"),
        heat: t("act7.fish_heatmap_title"),
        change: t("act7.fish_compare_title"),
      };

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    return xs.length
      ? { min: Math.min(...xs), max: Math.max(...xs) }
      : { min: 0, max: 1 };
  }, [M.series]);

  const kpiItems = useMemo(() => {
    if (!M.rank.length) return [];
    const sorted = [...M.rank].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    return [
      {
        key: "med",
        value: fmtVal(M.med),
        unit: M.unit,
        label: t("act7.board.kpi_med"),
        tone: "accent",
      },
      {
        key: "high",
        value: fmtVal(high.value),
        unit: high.name,
        label: t("act7.board.kpi_high"),
        tone: "positive",
      },
      {
        key: "low",
        value: fmtVal(low.value),
        unit: low.name,
        label: t("act7.board.kpi_low"),
        tone: "negative",
      },
    ];
  }, [M.rank, M.med, M.unit, t]);

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
    fetchVivant({ lang }).then((res) =>
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
    { v: "redlist", label: t("act7.board.metric_rl") },
    { v: "fish", label: t("act7.board.metric_fish") },
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
        label={t("act7.board.metric_label")}
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
            tab: t("act7.board.tab_trend"),
            title: titles.trend,
            finding: t("act7.board.trend_find"),
            takeaway: t("act7.board.trend_take"),
            node: (
              <div className="act7b__fit">
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
            tab: t("act7.board.tab_multiples"),
            title: titles.multiples,
            finding: t("act7.board.multiples_find"),
            takeaway: t("act7.board.multiples_take"),
            node: (
              <div className="act7b__scroll">
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
            tab: t("act7.board.tab_race"),
            title: t("act7.board.race_title"),
            finding: t("act7.board.race_find"),
            takeaway: t("act7.board.race_take"),
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
            tab: t("act7.board.tab_change"),
            title: `${titles.change} · ${M.A}–${M.B}`,
            finding: t("act7.board.change_find"),
            takeaway: t("act7.board.change_take"),
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
            tab: t("act7.board.tab_heat"),
            title: titles.heat,
            finding: t("act7.board.heat_find"),
            takeaway: t("act7.board.heat_take"),
            node: (
              <div className="act7b__fit">
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
            id: "map",
            empty: M.rank.length === 0,
            tab: t("act7.board.tab_map"),
            title: `${t("act7.board.map_title")} · ${M.B}`,
            finding: t("act7.board.map_find"),
            takeaway: t("act7.board.map_take"),
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
      eyebrow={t("act7.tag")}
      title={t("act7.title")}
      thesis={t("act7.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 7, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act7.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act7.board.switch_hint"),
        signature: t("act7.board.signature"),
        takeawayKicker: t("act7.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act7.board.start"),
        conclusion: t("act7.board.conclusion"),
        backIntro: t("act7.board.back_intro"),
        reviseData: t("act7.board.revise_data"),
      }}
      outro={{
        kicker: t("act7.outro.kicker"),
        title: t("act7.outro.title"),
        text: t("act7.outro.text"),
        primary: { to: "/ciel", label: t("act7.outro.next") },
        secondary: { to: "/", label: t("act7.outro.home") },
      }}
    />
  );
}
