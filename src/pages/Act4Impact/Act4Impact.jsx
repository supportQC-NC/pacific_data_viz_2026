// src/pages/Act4Impact/Act4Impact.jsx
// ============================================================
// Acte 04 — L'impact humain et matériel des catastrophes (PDH/SPC).
// Deux mesures : personnes affectées & pertes économiques ($).
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (sous-région + mesure),
// la frise des catastrophes en SIGNATURE. 4 graphes.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import EventTimeline from "../../components/EventTimeline/EventTimeline";
import RankBars from "../../components/RankBars/RankBars";
import TrendChart from "../../components/charts/TrendChart";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
import "./Act4Impact.scss";

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

const fmtNum = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(Math.round(n));
const fmtMoney = (n) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1).replace(".", ",")} Md$`
    : n >= 1e6
      ? `${Math.round(n / 1e6)} M$`
      : n >= 1e3
        ? `${Math.round(n / 1e3)} k$`
        : `${Math.round(n)} $`;

function buildEvents(d, lang) {
  if (!d) return [];
  const out = [];
  d.areas.forEach((a) => {
    if (!isPict(a)) return;
    (d.byArea[a] || []).forEach((p) => {
      if (Number.isFinite(p.value) && p.value > 0) out.push({ area: a, name: pictName(a, lang), year: p.year, value: p.value });
    });
  });
  return out;
}
function buildTotals(d, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const s = d.byArea[a] || [];
      const total = s.reduce((x, p) => x + (Number.isFinite(p.value) ? p.value : 0), 0);
      return { area: a, code: a, name: pictName(a, lang), value: total };
    })
    .filter((r) => r.value > 0);
}

function buildCoverageSeries(d, lang, inRegion) {
  if (!d) return { series: [], years: [] };
  const yearsSet = new Set();
  const series = d.areas
    .filter((a) => isPict(a) && inRegion(a))
    .map((a) => {
      const values = (d.byArea[a] || [])
        .filter((p) => Number.isFinite(p.value) && p.value > 0)
        .map((p) => {
          yearsSet.add(p.year);
          return { year: p.year, value: p.value };
        });
      return { area: a, name: pictName(a, lang), values };
    })
    .filter((s) => s.values.length);
  return { series, years: [...yearsSet].sort((x, y) => x - y) };
}

/* ---------- Menu déroulant (filtres globaux) ---------- */
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

export default function Act4Impact() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const affected = useSelector(selectDataset("disastersAffected"));
  const loss = useSelector(selectDataset("disastersLoss"));

  const [region, setRegion] = useState("all");
  const [metric, setMetric] = useState("affected");

  useEffect(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const ready = affected.status === "succeeded";
  const failed = affected.status === "failed";

  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);

  const affEvents = useMemo(() => buildEvents(affected.data, lang).filter((e) => inRegion(e.area)), [affected.data, lang, inRegion]);
  const lossEvents = useMemo(() => buildEvents(loss.data, lang).filter((e) => inRegion(e.area)), [loss.data, lang, inRegion]);
  const affTotals = useMemo(() => buildTotals(affected.data, lang).filter((r) => inRegion(r.area)), [affected.data, lang, inRegion]);
  const lossTotals = useMemo(() => buildTotals(loss.data, lang).filter((r) => inRegion(r.area)), [loss.data, lang, inRegion]);

  const totalAff = useMemo(() => affEvents.reduce((s, e) => s + e.value, 0), [affEvents]);
  const totalLoss = useMemo(() => lossEvents.reduce((s, e) => s + e.value, 0), [lossEvents]);
  const worst = useMemo(() => affEvents.reduce((m, e) => (e.value > (m ? m.value : -1) ? e : m), null), [affEvents]);

  const isLoss = metric === "loss";
  const selEvents = isLoss ? lossEvents : affEvents;
  const selTotals = isLoss ? lossTotals : affTotals;
  const selUnit = isLoss ? t("act4.loss_unit") : t("act4.affected_unit");
  const selFormat = isLoss ? fmtMoney : fmtNum;
  const metricLabel = isLoss ? t("act4.loss_title") : t("act4.affected_title");
  const selMax = useMemo(() => selTotals.reduce((m, r) => Math.max(m, r.value), 0), [selTotals]);

  const coverage = useMemo(
    () => buildCoverageSeries(isLoss ? loss.data : affected.data, lang, inRegion),
    [isLoss, loss.data, affected.data, lang, inRegion],
  );

  // Total par année (la fréquence/intensité s'aggrave-t-elle avec le temps ?).
  const annual = useMemo(() => {
    const m = new Map();
    selEvents.forEach((e) => m.set(e.year, (m.get(e.year) || 0) + e.value));
    const yrs = [...m.keys()].sort((a, b) => a - b);
    return { years: yrs, series: [{ name: metricLabel, values: yrs.map((y) => ({ year: y, value: m.get(y) })) }] };
  }, [selEvents, metricLabel]);

  const kpiItems = useMemo(() => {
    if (!ready) return [];
    const items = [
      { key: "aff", value: fmtNum(totalAff), unit: t("act4.affected_unit"), label: t("act4.kpi_affected"), tone: "warm" },
      { key: "loss", value: fmtMoney(totalLoss), unit: "", label: t("act4.kpi_loss"), tone: "warm" },
      { key: "events", value: String(affEvents.length), unit: "", label: t("act4.kpi_events"), tone: "accent" },
    ];
    if (worst) items.push({ key: "worst", value: fmtNum(worst.value), unit: `${worst.name} ${worst.year}`, label: t("act4.kpi_worst"), tone: "warm" });
    return items;
  }, [ready, totalAff, totalLoss, affEvents, worst, t]);

  const retry = useCallback(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const metricOpts = [
    { v: "affected", label: t("act4.affected_title") },
    { v: "loss", label: t("act4.loss_title") },
  ];

  const status = failed ? "error" : !ready ? "loading" : selEvents.length === 0 && selTotals.length === 0 ? "empty" : "ready";

  const filtersEl = (
    <>
      <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <Select label={t("act4.board.metric_label")} options={metricOpts} value={metric} onChange={setMetric} />
    </>
  );

  // Carte d'identité DOUBLE (personnes affectées + pertes) — 100 % i18n / fiches UNDRR.
  const spotlightRows = [
    { k: t("act4.spotlight.r1k"), v: t("act4.spotlight.r1v") },
    { k: t("act4.spotlight.r2k"), v: t("act4.spotlight.r2v") },
    { k: t("act4.spotlight.r3k"), v: t("act4.spotlight.r3v") },
    { k: t("act4.spotlight.r4k"), v: t("act4.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act4.spotlight.n1"),
    t("act4.spotlight.n2"),
    t("act4.spotlight.n3"),
    t("act4.spotlight.n4"),
    t("act4.spotlight.n5"),
  ];

  const charts =
    status === "ready"
      ? [
          {
            id: "timeline",
            signature: true,
            empty: selEvents.length === 0,
            tab: t("act4.board.tab_timeline"),
            title: `${t("act4.timeline_title")} · ${metricLabel}`,
            finding: t("act4.board.timeline_find"),
            takeaway: t("act4.board.timeline_take"),
            node: (
              <div className="act4b__scroll">
                <EventTimeline events={selEvents} unit={selUnit} format={selFormat} />
              </div>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act4.board.tab_read"),
            title: t("act4.read_title"),
            finding: t("act4.board.read_find"),
            takeaway: t("act4.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{ kicker: t("act4.spotlight.ex_kicker"), text: t("act4.spotlight.ex_text") }}
                link={{ href: "https://www.preventionweb.net/files/54970_collectionoftechnicalguidancenoteso.pdf", label: t("act4.spotlight.link_label") }}
              />
            ),
          },
          {
            id: "annual",
            empty: annual.years.length < 2,
            tab: t("act4.board.tab_annual"),
            title: `${t("act4.board.annual_title")} · ${metricLabel}`,
            finding: t("act4.board.annual_find"),
            takeaway: t("act4.board.annual_take"),
            node: <TrendChart series={annual.series} years={annual.years} unit={selUnit} scale="lin" />,
          },
          {
            id: "rank",
            empty: selTotals.length === 0,
            tab: t("act4.board.tab_rank"),
            title: `${t("act4.rank_title")} · ${metricLabel}`,
            finding: t("act4.board.rank_find"),
            takeaway: t("act4.board.rank_take"),
            node: (
              <div className="act4b__scroll">
                <RankBars data={selTotals} unit={selUnit} />
              </div>
            ),
          },
          {
            id: "map",
            empty: selTotals.length === 0,
            tab: t("act4.board.tab_map"),
            title: `${t("act4.map_title")} · ${metricLabel}`,
            finding: t("act4.board.map_find"),
            takeaway: t("act4.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap data={selTotals} unit={selUnit} range={{ min: 0, max: selMax }} logScale lowLabel={t("act4.map_low")} highLabel={t("act4.map_high")} noTokenMsg={t("act1.map_no_token")} />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "coverage",
            empty: coverage.series.length === 0,
            tab: t("act4.board.tab_coverage"),
            title: `${t("act4.coverage_title")} · ${metricLabel}`,
            finding: t("act4.board.coverage_find"),
            takeaway: t("act4.board.coverage_take"),
            node: (
              <CoverageChart
                series={coverage.series}
                years={coverage.years}
                labels={{ present: t("act1.coverage.present"), absent: t("act1.coverage.absent") }}
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
      eyebrow={t("home.acts.a4_tag")}
      title={t("home.acts.a4_title")}
      thesis={t("act4.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 9, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act4.board.switch_hint"),
        signature: t("act4.board.signature"),
        takeawayKicker: t("act4.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act4.board.start"),
        conclusion: t("act4.board.conclusion"),
        backIntro: t("act4.board.back_intro"),
        reviseData: t("act4.board.revise_data"),
      }}
      outro={{
        kicker: t("act4.outro.kicker"),
        title: t("act4.outro.title"),
        text: t("act4.outro.text"),
        primary: { to: "/momentum", label: t("act4.outro.next") },
        secondary: { to: "/", label: t("act4.outro.home") },
      }}
    />
  );
}