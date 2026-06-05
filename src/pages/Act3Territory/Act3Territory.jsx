// src/pages/Act3Territory/Act3Territory.jsx
// ============================================================
// Acte 03 — Le territoire : dynamique de population par territoire (PDH/SPC).
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (sous-région + année),
// la bande de tendance régionale en SIGNATURE. Tableau retiré ; ajout de
// deux graphes (trajectoires + classement). 5 graphes.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import BarRace from "../../components/BarRace/BarRace";
import TrendChart from "../../components/charts/TrendChart";
import useThemeTokens from "../../hooks/UseThemeTokens";
import { fmt } from "../../components/charts/echartsBase";
import "./Act3Territory.scss";

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

function pct(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function meanSeries(d, inR) {
  if (!d) return [];
  return d.years
    .map((year) => {
      const vals = [];
      d.areas.forEach((a) => {
        if (!isPict(a) || !inR(a)) return;
        const p = (d.byArea[a] || []).find((q) => q.year === year);
        if (p && Number.isFinite(p.value)) vals.push(p.value);
      });
      if (!vals.length) return null;
      const s = [...vals].sort((x, y) => x - y);
      const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;
      return { year, mean, min: pct(s, 0.1), max: pct(s, 0.9) };
    })
    .filter(Boolean);
}
function allSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => ({ area: a, name: pictName(a, lang), values: (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)) }));
}
function pointsAt(d, year, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const p = (d.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value) ? { area: a, name: pictName(a, lang), value: p.value, year } : null;
    })
    .filter(Boolean);
}

/* ---------- Filtres globaux ---------- */
function Select({ label, options, value, onChange }) {
  return (
    <div className="act1f act1f--select">
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__selwrap">
        <select className="act1f__select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
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

export default function Act3Territory() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();
  const pop = useSelector(selectDataset("population"));

  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);

  useEffect(() => {
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const ready = pop.status === "succeeded";
  const failed = pop.status === "failed";
  const data = pop.data;
  const years = useMemo(() => (data ? data.years : []), [data]);

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;
  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);

  const trend = useMemo(() => meanSeries(data, inRegion), [data, inRegion]);
  const series = useMemo(() => allSeries(data, lang, inRegion), [data, lang, inRegion]);
  const points = useMemo(() => (data && currentYear != null ? pointsAt(data, currentYear, lang, inRegion) : []), [data, currentYear, lang, inRegion]);
  const regionalMean = useMemo(() => (points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : 0), [points]);

  const robustRange = useMemo(() => {
    if (!data) return { min: -3, max: 3 };
    const abs = [];
    data.areas.forEach((a) => {
      if (!isPict(a) || !inRegion(a)) return;
      (data.byArea[a] || []).forEach((p) => {
        if (Number.isFinite(p.value)) abs.push(Math.abs(p.value));
      });
    });
    abs.sort((x, y) => x - y);
    const p = abs.length ? pct(abs, 0.92) : 3;
    const m = Math.max(2, Math.min(8, p));
    return { min: -m, max: m };
  }, [data, inRegion]);

  const unit = t("act3.unit");

  const evoLabels = useMemo(
    () => ({ improved: t("act3.evo_down"), worsened: t("act3.evo_up"), since: t("act1.evo.since"), no_data: t("act1.evo.no_data") }),
    [t],
  );

  const kpiItems = useMemo(() => {
    if (!ready || !points.length) return [];
    const sorted = [...points].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    return [
      { key: "mean", value: fmt(regionalMean, 1), unit, label: t("act3.board.kpi_mean"), tone: "accent" },
      { key: "high", value: fmt(high.value, 1), unit: high.name, label: t("act3.board.kpi_high"), tone: "warm" },
      { key: "low", value: fmt(low.value, 1), unit: low.name, label: t("act3.board.kpi_low"), tone: "positive" },
    ];
  }, [ready, points, regionalMean, unit, t]);

  const retry = useCallback(() => dispatch(loadDataset("population")), [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const status = failed ? "error" : !ready ? "loading" : years.length === 0 ? "empty" : "ready";

  const filtersEl = (
    <>
      <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={(i) => setYearIdx(i)} />
    </>
  );

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            id: "trend",
            signature: true,
            empty: trend.length < 2,
            tab: t("act3.board.tab_trend"),
            title: t("act3.pop_title"),
            finding: t("act3.board.trend_find"),
            takeaway: t("act3.board.trend_take"),
            node: (
              <div className="act3b__scroll">
                <AnomalyTrend data={trend} currentYear={currentYear} unit={unit} tone="warm" baselineLabel={t("act3.baseline")} meanLabel={t("act3.mean_label")} />
              </div>
            ),
          },
          {
            id: "lines",
            empty: series.length === 0,
            tab: t("act3.board.tab_lines"),
            title: t("act3.board.lines_title"),
            finding: t("act3.board.lines_find"),
            takeaway: t("act3.board.lines_take"),
            node: <TrendChart series={series} years={years} unit={unit} scale="lin" />,
          },
          {
            id: "rank",
            empty: series.length === 0,
            tab: t("act3.board.tab_rank"),
            title: t("act3.board.rank_title"),
            finding: t("act3.board.rank_find"),
            takeaway: t("act3.board.rank_take"),
            node: <BarRace series={series} years={years} unit={unit} tk={tk} labels={{ play: t("act1.race.play"), pause: t("act1.race.pause") }} />,
          },
          {
            id: "map",
            empty: points.length === 0,
            tab: t("act3.board.tab_map"),
            title: `${t("act3.map_title")} · ${currentYear}`,
            finding: t("act3.board.map_find"),
            takeaway: t("act3.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap data={points} unit={unit} range={robustRange} lowLabel={t("act3.map_low")} midLabel={t("act3.map_mid")} highLabel={t("act3.map_high")} noTokenMsg={t("act1.map_no_token")} />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "evo",
            empty: series.length === 0,
            tab: t("act3.board.tab_evo"),
            title: t("act3.evo_title"),
            finding: t("act3.board.evo_find"),
            takeaway: t("act3.board.evo_take"),
            node: (
              <div className="act3b__scroll">
                <EvolutionPanel series={series} labels={evoLabels} unit={unit} mode="absolute" topN={5} />
              </div>
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a3_tag")}
      title={t("home.acts.a3_title")}
      thesis={t("act3.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 3, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act3.board.switch_hint"),
        signature: t("act3.board.signature"),
        takeawayKicker: t("act3.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act3.board.start"),
        conclusion: t("act3.board.conclusion"),
        backIntro: t("act3.board.back_intro"),
        reviseData: t("act3.board.revise_data"),
      }}
      outro={{
        kicker: t("act3.outro.kicker"),
        title: t("act3.outro.title"),
        text: t("act3.outro.text"),
        primary: { to: "/impact", label: t("act3.outro.next") },
        secondary: { to: "/", label: t("act3.outro.home") },
      }}
    />
  );
}