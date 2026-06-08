// src/pages/Act2Ocean/Act2Ocean.jsx
// ============================================================
// Acte 02 — L'océan se réchauffe. Anomalie de température de surface de la mer
// (SST, °C ; 0 = référence) — données PDH/SPC (DF_CLIMATE_CHANGE · SST_ANOM).
// Le niveau de la mer a été DÉPLACÉ vers l'acte « littoral » (croisé à la
// population) pour éviter tout doublon : ici, un seul signal physique, la
// chaleur de l'océan. Format DASHBOARD (ActBoard) : filtre GLOBAL sous-région,
// « le réchauffement, année après année » en SIGNATURE. 5 graphes.
// 100 % ApexCharts (hors carte Mapbox).
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
import AnomalyBandChart from "../../components/charts/AnomalyBandChart";
import RankChart from "../../components/charts/RankChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import ChangeChart from "../../components/charts/ChangeChart";
import { median, fmt, valAt } from "../../components/charts/echartsBase";
import "./Act2Ocean.scss";

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

/* ---------- Contrôle de filtre (global à l'acte) ---------- */
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

export default function Act2Ocean() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  const sst = useSelector(selectDataset("sst"));

  // Filtre GLOBAL (un seul jeu pour tout l'acte).
  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const ready = sst.status === "succeeded";
  const failed = sst.status === "failed";

  const allSeries = useMemo(() => {
    if (!ready || !sst.data) return [];
    return sst.data.areas
      .filter((a) => isPict(a))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        values: (sst.data.byArea[a] || []).filter((p) => Number.isFinite(p.value)).sort((x, y) => x.year - y.year),
      }))
      .filter((s) => s.values.length);
  }, [ready, sst.data, lang]);

  const years = useMemo(() => sst.data?.years || [], [sst.data]);
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
    }, 900);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);
  const regionSeries = useMemo(() => allSeries.filter((s) => inRegion(s.area)), [allSeries, inRegion]);

  const pointsFor = useCallback(
    (year) =>
      allSeries
        .filter((s) => inRegion(s.area))
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, year) }))
        .filter((p) => Number.isFinite(p.value)),
    [allSeries, inRegion],
  );

  const medianAll = useMemo(() => median(pointsFor(currentYear).map((p) => p.value)) ?? 0, [pointsFor, currentYear]);

  // Évolution depuis le début (dernière − première valeur), par territoire.
  // delta > 0 = réchauffement ; delta < 0 = refroidissement relatif.
  const changeRows = useMemo(
    () =>
      regionSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          delta: Number((s.values[s.values.length - 1].value - s.values[0].value).toFixed(3)),
        })),
    [regionSeries],
  );

  // Chiffres-chocs (SST).
  const kpiItems = useMemo(() => {
    if (!ready || !currentYear) return [];
    const pts = pointsFor(currentYear);
    if (!pts.length) return [];
    const med = median(pts.map((p) => p.value));
    const sorted = [...pts].sort((a, b) => a.value - b.value);
    const medFirst = median(pointsFor(firstYear).map((p) => p.value));
    const medLast = median(pointsFor(lastYear).map((p) => p.value));
    const change = Number.isFinite(medFirst) && Number.isFinite(medLast) ? medLast - medFirst : null;
    const hi = sorted[sorted.length - 1];
    const lo = sorted[0];
    return [
      { key: "median", value: `${med > 0 ? "+" : ""}${fmt(med, 1)}`, unit: t("act2.sst_unit"), label: t("act2.kpi.sst_median"), tone: "accent" },
      { key: "warm", value: `${hi.value > 0 ? "+" : ""}${fmt(hi.value, 1)}`, unit: hi.name, label: t("act2.kpi.most_warm"), tone: "warm" },
      { key: "cool", value: `${lo.value > 0 ? "+" : ""}${fmt(lo.value, 1)}`, unit: lo.name, label: t("act2.kpi.least_warm"), tone: "positive" },
      {
        key: "chg",
        value: change == null ? "—" : `${change > 0 ? "+" : ""}${fmt(change, 1)}`,
        unit: firstYear ? `${t("act2.kpi.since")} ${firstYear}` : "",
        label: t("act2.kpi.sst_change"),
        tone: change != null && change > 0 ? "warm" : "positive",
      },
    ];
  }, [ready, currentYear, pointsFor, firstYear, lastYear, t]);

  const mapPoints = useMemo(() => pointsFor(currentYear).map((p) => ({ ...p, year: currentYear })), [pointsFor, currentYear]);
  const mapRange = useMemo(() => {
    if (!mapPoints.length) return { min: -1, max: 1 };
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
  const retry = useCallback(() => dispatch(loadDataset("sst")), [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));

  const status = failed ? "error" : !ready ? "loading" : empty ? "empty" : "ready";

  const noSeries = regionSeries.length === 0;
  const noPts = currentYear != null && pointsFor(currentYear).length === 0;
  const noChange = changeRows.length === 0;

  const filtersEl = (
    <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
  );

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            id: "band",
            signature: true,
            empty: noSeries,
            tab: t("act2.board.tab_band"),
            title: t("act2.viz.band_title"),
            finding: t("act2.board.band_find"),
            takeaway: t("act2.board.band_take"),
            node: <AnomalyBandChart series={regionSeries} years={years} unit={t("act2.sst_unit")} />,
          },
          {
            id: "rank",
            empty: noPts,
            tab: t("act2.board.tab_rank"),
            title: t("act2.viz.rank_title"),
            finding: t("act2.board.rank_find"),
            takeaway: t("act2.board.rank_take"),
            node: <RankChart points={pointsFor(currentYear)} unit={t("act2.sst_unit")} median={0} refLabel={t("act2.ref")} sort="desc" scale="lin" />,
          },
          {
            id: "change",
            empty: noChange,
            tab: t("act2.board.tab_change"),
            title: t("act2.board.change_title"),
            finding: t("act2.board.change_find"),
            takeaway: t("act2.board.change_take"),
            node: <ChangeChart rows={changeRows} unit={t("act2.sst_unit")} direction="all" />,
          },
          {
            id: "map",
            empty: noPts,
            tab: t("act2.board.tab_map"),
            title: t("act2.viz.map_title"),
            finding: t("act2.board.map_find"),
            takeaway: t("act2.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={mapPoints}
                    unit={t("act2.sst_unit")}
                    range={mapRange}
                    ramp="semantic"
                    mid={0}
                    lowLabel={t("act2.map_low")}
                    midLabel={t("act2.ref")}
                    highLabel={t("act2.map_high")}
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
            empty: noSeries,
            tab: t("act2.board.tab_heat"),
            title: t("act2.viz.heat_title"),
            finding: t("act2.board.heat_find"),
            takeaway: t("act2.board.heat_take"),
            node: <HeatmapChart series={regionSeries} years={years} unit={t("act2.sst_unit")} mode="rank" ramp={[tk.positive, tk.warm, tk.negative]} labels={{ low: t("act2.heatmap_low"), high: t("act2.heatmap_high") }} />,
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a2_tag")}
      title={t("home.acts.a2_title")}
      thesis={t("act2.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 2, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act2.board.switch_hint"),
        signature: t("act2.board.signature"),
        takeawayKicker: t("act2.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act2.board.start"),
        conclusion: t("act2.board.conclusion"),
        backIntro: t("act2.board.back_intro"),
        reviseData: t("act2.board.revise_data"),
      }}
      outro={{
        kicker: t("act2.outro.kicker"),
        title: t("act2.outro.title"),
        text: t("act2.outro.text"),
        primary: { to: "/ciel", label: t("act2.outro.next") },
        secondary: { to: "/", label: t("act2.outro.home") },
      }}
    />
  );
}