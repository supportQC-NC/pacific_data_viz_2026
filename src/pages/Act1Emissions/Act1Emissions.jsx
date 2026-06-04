// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Les émissions du Pacifique (Pacific Data Hub / SPC).
// Format DASHBOARD (composant partagé ActBoard) : un seul écran, un hero
// (thèse + chiffres-chocs), des filtres GLOBAUX (sous-région + année +
// échelle) et un graphe à la fois via onglets, dont « Classement » en
// SIGNATURE. Une ligne « à retenir » explicite sous chaque graphe.
// 100 % PDH. Aucune option ECharts ici.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import BarRace from "../../components/BarRace/BarRace";
import RankChart from "../../components/charts/RankChart";
import TrendChart from "../../components/charts/TrendChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import ScatterChart from "../../components/charts/ScatterChart";
import { median, fmt, valAt, paletteOf } from "../../components/charts/echartsBase";
import "./Act1Emissions.scss";

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

/* ---------- Contrôles de filtre (globaux à l'acte) ---------- */
function Pills({ label, options, value, onChange }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__pills">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            className={`act1f__pill ${value === o.v ? "is-active" : ""}`}
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearSlider({ label, years, index, onChange }) {
  if (!years.length) return null;
  return (
    <div className="act1f act1f--year">
      <span className="act1f__lbl">
        {label} <strong>{years[index] ?? ""}</strong>
      </span>
      <input
        className="act1f__range"
        type="range"
        min={0}
        max={years.length - 1}
        value={index ?? years.length - 1}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export default function Act1Emissions() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  const emissions = useSelector(selectDataset("emissions"));

  // Filtres GLOBAUX (un seul jeu pour tout l'acte).
  const [region, setRegion] = useState("all");
  const [scale, setScale] = useState("lin");
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("emissions"));
  }, [dispatch]);

  const ready = emissions.status === "succeeded";
  const failed = emissions.status === "failed";
  const years = ready && emissions.data ? emissions.data.years : [];
  const empty = ready && years.length === 0;
  const firstYear = years[0] ?? null;
  const lastYear = years[years.length - 1] ?? null;

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);

  useEffect(() => {
    if (!playing || !years.length) return undefined;
    const id = setInterval(() => {
      setYearIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= years.length) {
          setPlaying(false);
          return years.length - 1;
        }
        return next;
      });
    }, 1100);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const allSeries = useMemo(() => {
    if (!ready || !emissions.data) return [];
    return Object.entries(emissions.data.byArea)
      .filter(([area]) => isPict(area))
      .map(([area, series]) => ({
        area,
        name: pictName(area, lang),
        values: series.filter((p) => Number.isFinite(p.value) && p.value > 0).sort((a, b) => a.year - b.year),
      }))
      .filter((s) => s.values.length);
  }, [ready, emissions.data, lang]);

  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);

  const pointsFor = useCallback(
    (year) =>
      allSeries
        .filter((s) => inRegion(s.area))
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, year) }))
        .filter((p) => Number.isFinite(p.value) && p.value > 0),
    [allSeries, inRegion],
  );

  const medianAll = useMemo(() => median(pointsFor(currentYear).map((p) => p.value)) ?? 0, [pointsFor, currentYear]);

  const subNames = useMemo(
    () => ({ melanesia: t("act1.filter.melanesia"), polynesia: t("act1.filter.polynesia"), micronesia: t("act1.filter.micronesia") }),
    [t],
  );

  const regionSeries = useMemo(() => allSeries.filter((s) => inRegion(s.area)), [allSeries, inRegion]);

  // Nuage niveau × évolution (groupé par sous-région).
  const scatterGroups = useMemo(() => {
    const palette = paletteOf(tk);
    const inReg = allSeries.filter((s) => inRegion(s.area));
    return Object.keys(SUBREGIONS)
      .map((reg, i) => ({
        name: subNames[reg],
        color: palette[i],
        points: inReg
          .filter((s) => REGION_OF[s.area] === reg)
          .map((s) => {
            const last = valAt(s, lastYear);
            const first = valAt(s, firstYear);
            if (!Number.isFinite(last) || !Number.isFinite(first) || first <= 0) return null;
            return { name: s.name, x: Number(last.toFixed(2)), y: Number((((last - first) / first) * 100).toFixed(1)) };
          })
          .filter(Boolean),
      }))
      .filter((g) => g.points.length);
  }, [allSeries, lastYear, firstYear, subNames, inRegion, tk]);

  const scatterMedianX = useMemo(() => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0, [scatterGroups]);

  // Chiffres-chocs (PDH).
  const kpiItems = useMemo(() => {
    const pts = pointsFor(currentYear);
    if (!pts.length) return [];
    const med = median(pts.map((p) => p.value));
    const sorted = [...pts].sort((a, b) => a.value - b.value);
    const medFirst = median(pointsFor(firstYear).map((p) => p.value));
    const medLast = median(pointsFor(lastYear).map((p) => p.value));
    const evo = medFirst && medFirst > 0 ? ((medLast - medFirst) / medFirst) * 100 : null;
    return [
      { key: "median", value: fmt(med, 1), unit: t("act1.unit"), label: t("act1.stats.median"), tone: "accent" },
      { key: "high", value: fmt(sorted[sorted.length - 1].value, 1), unit: sorted[sorted.length - 1].name, label: t("act1.stats.highest"), tone: "warm" },
      { key: "low", value: fmt(sorted[0].value, 1), unit: sorted[0].name, label: t("act1.stats.lowest"), tone: "positive" },
      {
        key: "evo",
        value: evo == null ? "—" : `${evo > 0 ? "+" : ""}${evo.toFixed(0)}%`,
        unit: firstYear ? `${t("act1.kpi.since")} ${firstYear}` : "",
        label: t("act1.kpi.evolution"),
        tone: evo != null && evo <= 0 ? "positive" : "warm",
      },
    ];
  }, [pointsFor, currentYear, firstYear, lastYear, t]);

  const mapPoints = useMemo(() => pointsFor(currentYear).map((p) => ({ ...p, year: currentYear })), [pointsFor, currentYear]);
  const mapRange = useMemo(() => {
    if (!mapPoints.length) return { min: 0, max: 1 };
    const vals = mapPoints.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [mapPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => dispatch(loadDataset("emissions")), [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const scaleOpts = [
    { v: "lin", label: t("act1.f.scale_lin") },
    { v: "log", label: t("act1.f.scale_log") },
  ];

  const status = failed ? "error" : !ready ? "loading" : empty ? "empty" : "ready";

  const filtersEl = (
    <>
      <Pills label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <Pills label={t("act1.f.scale")} options={scaleOpts} value={scale} onChange={setScale} />
      <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />
    </>
  );

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            id: "rank",
            signature: true,
            tab: t("act1.board.tab_rank"),
            title: t("act1.viz.rank_title"),
            finding: t("act1.board.rank_find"),
            takeaway: t("act1.board.rank_take"),
            node: (
              <RankChart
                points={pointsFor(currentYear)}
                unit={t("act1.unit")}
                median={medianAll}
                refLabel={t("act1.ref_median")}
                sort="desc"
                scale={scale}
              />
            ),
          },
          {
            id: "race",
            tab: t("act1.board.tab_race"),
            title: t("act1.viz.race_title"),
            finding: t("act1.board.race_find"),
            takeaway: t("act1.board.race_take"),
            node: <BarRace series={regionSeries} years={years} unit={t("act1.unit")} tk={tk} labels={{ play: t("act1.race.play"), pause: t("act1.race.pause") }} />,
          },
          {
            id: "trend",
            tab: t("act1.board.tab_trend"),
            title: t("act1.viz.trend_title"),
            finding: t("act1.board.trend_find"),
            takeaway: t("act1.board.trend_take"),
            node: <TrendChart series={regionSeries} years={years} unit={t("act1.unit")} scale={scale} />,
          },
          {
            id: "scatter",
            tab: t("act1.board.tab_scatter"),
            title: t("act1.viz.scatter_title"),
            finding: t("act1.board.scatter_find"),
            takeaway: t("act1.board.scatter_take"),
            node: <ScatterChart groups={scatterGroups} unit={t("act1.unit")} medianX={scatterMedianX} />,
          },
          {
            id: "map",
            tab: t("act1.board.tab_map"),
            title: t("act1.viz.map_title"),
            finding: t("act1.board.map_find"),
            takeaway: t("act1.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={mapPoints}
                    unit={t("act1.unit")}
                    range={mapRange}
                    logScale
                    ramp="semantic"
                    mid={medianAll}
                    lowLabel={t("act1.map_low")}
                    midLabel={t("act1.ref_median")}
                    highLabel={t("act1.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                    years={years}
                    yearIndex={yearIdx}
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onScrub={scrubYear}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "heat",
            tab: t("act1.board.tab_heat"),
            title: t("act1.viz.heat_title"),
            finding: t("act1.board.heat_find"),
            takeaway: t("act1.board.heat_take"),
            node: <HeatmapChart series={regionSeries} years={years} unit={t("act1.unit")} mode="rank" labels={{ low: t("act1.heatmap.low"), high: t("act1.heatmap.high") }} />,
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a1_tag")}
      title={t("home.acts.a1_title")}
      thesis={t("act1.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 1, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act1.board.switch_hint"),
        signature: t("act1.board.signature"),
        takeawayKicker: t("act1.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act1.board.start"),
        conclusion: t("act1.board.conclusion"),
        backIntro: t("act1.board.back_intro"),
        reviseData: t("act1.board.revise_data"),
      }}
      outro={{
        kicker: t("act1.outro.kicker"),
        title: t("act1.outro.title"),
        text: t("act1.outro.text"),
        primary: { to: "/ocean", label: t("act1.outro.next") },
        secondary: { to: "/", label: t("act1.outro.home") },
      }}
    />
  );
}