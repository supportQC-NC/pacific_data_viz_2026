// src/pages/Act2Ocean/Act2Ocean.jsx
// ============================================================
// Acte 02 — L'océan en première ligne. Niveau de la mer (m) & anomalie de
// température de surface (°C), anomalies (0 = référence) — données PDH/SPC.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (sous-région + mesure
// mer/température + année), un graphe à la fois via le rail, « la montée
// des eaux » en SIGNATURE. 6 graphes, le reste est coupé.
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
import ScatterChart from "../../components/charts/ScatterChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import { median, fmt, valAt, paletteOf } from "../../components/charts/echartsBase";
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

/* ---------- Contrôles de filtre (globaux à l'acte) ---------- */
function Pills({ label, options, value, onChange, help }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      {label ? (
        <span className="act1f__lbl">
          {label}
          {help ? (
            <span className="act1f__info">
              <button type="button" className="act1f__help" aria-label={help}>
                ?
              </button>
              <span className="act1f__tip" role="tooltip">
                {help}
              </span>
            </span>
          ) : null}
        </span>
      ) : null}
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

export default function Act2Ocean() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  const sea = useSelector(selectDataset("seaLevel"));
  const sst = useSelector(selectDataset("sst"));

  // Filtres GLOBAUX.
  const [region, setRegion] = useState("all");
  const [metric, setMetric] = useState("sea");
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const ready = sea.status === "succeeded" && sst.status === "succeeded";
  const failed = sea.status === "failed" || sst.status === "failed";

  const seriesOf = useCallback(
    (data) => {
      if (!data) return [];
      return data.areas
        .filter((a) => isPict(a))
        .map((a) => ({
          area: a,
          name: pictName(a, lang),
          values: (data.byArea[a] || []).filter((p) => Number.isFinite(p.value)).sort((x, y) => x.year - y.year),
        }))
        .filter((s) => s.values.length);
    },
    [lang],
  );

  const DATA = useMemo(
    () => ({
      sea: { series: seriesOf(sea.data), years: sea.data?.years || [] },
      sst: { series: seriesOf(sst.data), years: sst.data?.years || [] },
    }),
    [sea.data, sst.data, seriesOf],
  );

  const unitOf = useCallback((m) => (m === "sea" ? t("act2.sea_unit") : t("act2.sst_unit")), [t]);
  const metricLabel = useCallback((m) => (m === "sea" ? t("act2.f.sea") : t("act2.f.sst")), [t]);

  const masterYears = useMemo(() => {
    const set = new Set([...(DATA.sea.years || []), ...(DATA.sst.years || [])]);
    return [...set].sort((a, b) => a - b);
  }, [DATA]);

  const empty = ready && masterYears.length === 0;

  useEffect(() => {
    if (masterYears.length && yearIdx === null) setYearIdx(masterYears.length - 1);
  }, [masterYears, yearIdx]);

  useEffect(() => {
    if (!playing || !masterYears.length) return undefined;
    const id = setInterval(() => {
      setYearIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= masterYears.length) {
          setPlaying(false);
          return masterYears.length - 1;
        }
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, masterYears]);

  const currentYear = masterYears.length && yearIdx != null ? masterYears[yearIdx] : null;

  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);
  const seriesFor = useCallback((m) => DATA[m].series.filter((s) => inRegion(s.area)), [DATA, inRegion]);

  const yearForMetric = useCallback(
    (m, year) => {
      const ys = DATA[m].years;
      if (!ys.length) return year;
      if (ys.indexOf(year) !== -1) return year;
      const le = ys.filter((y) => y <= year);
      return le.length ? le[le.length - 1] : ys[ys.length - 1];
    },
    [DATA],
  );

  const pointsFor = useCallback(
    (m, year) => {
      const yy = yearForMetric(m, year);
      return DATA[m].series
        .filter((s) => inRegion(s.area))
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, yy) }))
        .filter((p) => Number.isFinite(p.value));
    },
    [DATA, inRegion, yearForMetric],
  );

  const subNames = useMemo(
    () => ({ melanesia: t("act1.filter.melanesia"), polynesia: t("act1.filter.polynesia"), micronesia: t("act1.filter.micronesia") }),
    [t],
  );

  // Corrélation mer × température (point dans le temps, combiné).
  const corrGroups = useMemo(() => {
    const palette = paletteOf(tk);
    const seaYear = yearForMetric("sea", currentYear);
    const sstYear = yearForMetric("sst", currentYear);
    const seaSeries = DATA.sea.series.filter((s) => inRegion(s.area));
    return Object.keys(SUBREGIONS)
      .map((reg, i) => ({
        name: subNames[reg],
        color: palette[i],
        points: seaSeries
          .filter((s) => REGION_OF[s.area] === reg)
          .map((s) => {
            const x = valAt(s, seaYear);
            const sstS = DATA.sst.series.find((q) => q.area === s.area);
            const y = sstS ? valAt(sstS, sstYear) : null;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { name: s.name, x: Number(x.toFixed(3)), y: Number(y.toFixed(2)) };
          })
          .filter(Boolean),
      }))
      .filter((g) => g.points.length);
  }, [DATA, currentYear, subNames, inRegion, yearForMetric, tk]);

  const corrMedianX = useMemo(() => median(corrGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0, [corrGroups]);

  const kpiItems = useMemo(() => {
    if (!ready || !currentYear) return [];
    const seaPts = pointsFor("sea", currentYear);
    const sstPts = pointsFor("sst", currentYear);
    const seaMean = median(seaPts.map((p) => p.value));
    const sstMean = median(sstPts.map((p) => p.value));
    const top = [...seaPts].sort((a, b) => b.value - a.value)[0];
    const seaFirst = median(pointsFor("sea", DATA.sea.years[0]).map((p) => p.value));
    const change = Number.isFinite(seaMean) && Number.isFinite(seaFirst) ? seaMean - seaFirst : null;
    const items = [];
    if (Number.isFinite(seaMean)) items.push({ key: "sea", value: `${seaMean > 0 ? "+" : ""}${fmt(seaMean)}`, unit: t("act2.sea_unit"), label: t("act2.kpi.sea_mean"), tone: "accent" });
    if (Number.isFinite(sstMean)) items.push({ key: "sst", value: `${sstMean > 0 ? "+" : ""}${fmt(sstMean, 1)}`, unit: t("act2.sst_unit"), label: t("act2.kpi.sst_mean"), tone: "warm" });
    if (top) items.push({ key: "top", value: `+${fmt(top.value)}`, unit: top.name, label: t("act2.kpi.most_exposed"), tone: "warm" });
    if (change != null) items.push({ key: "chg", value: `${change > 0 ? "+" : ""}${fmt(change)}`, unit: `${t("act2.kpi.since")} ${DATA.sea.years[0]}`, label: t("act2.kpi.sea_change"), tone: change > 0 ? "warm" : "positive" });
    return items;
  }, [ready, currentYear, pointsFor, DATA, t]);

  const mapPoints = useMemo(() => pointsFor(metric, currentYear).map((p) => ({ ...p, year: currentYear })), [pointsFor, metric, currentYear]);
  const mapRange = useMemo(() => {
    if (!mapPoints.length) return { min: -1, max: 1 };
    const vals = mapPoints.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [mapPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === masterYears.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [masterYears.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const metricOpts = [
    { v: "sea", label: t("act2.f.sea") },
    { v: "sst", label: t("act2.f.sst") },
  ];

  const status = failed ? "error" : !ready ? "loading" : empty ? "empty" : "ready";
  const ml = metricLabel(metric);

  const filtersEl = (
    <>
      <Pills label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <Pills label={t("act2.f.metric")} options={metricOpts} value={metric} onChange={setMetric} />
      <YearSlider label={t("act1.f.year")} years={masterYears} index={yearIdx} onChange={scrubYear} />
    </>
  );

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            id: "band",
            signature: true,
            tab: t("act2.board.tab_band"),
            title: `${t("act2.viz.band_title")} · ${ml}`,
            finding: t("act2.board.band_find"),
            takeaway: t("act2.board.band_take"),
            node: <AnomalyBandChart series={seriesFor(metric)} years={DATA[metric].years} unit={unitOf(metric)} />,
          },
          {
            id: "rank",
            tab: t("act2.board.tab_rank"),
            title: `${t("act2.viz.rank_title")} · ${ml}`,
            finding: t("act2.board.rank_find"),
            takeaway: t("act2.board.rank_take"),
            node: <RankChart points={pointsFor(metric, currentYear)} unit={unitOf(metric)} median={0} refLabel={t("act2.ref")} sort="desc" scale="lin" />,
          },
          {
            id: "map",
            tab: t("act2.board.tab_map"),
            title: `${t("act2.viz.map_title")} · ${ml}`,
            finding: t("act2.board.map_find"),
            takeaway: t("act2.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={mapPoints}
                    unit={unitOf(metric)}
                    range={mapRange}
                    ramp="semantic"
                    mid={0}
                    lowLabel={t("act2.map_low")}
                    midLabel={t("act2.ref")}
                    highLabel={t("act2.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                    years={masterYears}
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
            id: "corr",
            tab: t("act2.board.tab_corr"),
            title: t("act2.viz.corr_title"),
            finding: t("act2.board.corr_find"),
            takeaway: t("act2.board.corr_take"),
            node: <ScatterChart groups={corrGroups} unit={t("act2.sea_unit")} medianX={corrMedianX} xName={t("act2.sea_unit")} yName={t("act2.sst_unit")} />,
          },
          {
            id: "heat",
            tab: t("act2.board.tab_heat"),
            title: `${t("act2.viz.heat_title")} · ${ml}`,
            finding: t("act2.board.heat_find"),
            takeaway: t("act2.board.heat_take"),
            node: <HeatmapChart series={seriesFor(metric)} years={DATA[metric].years} unit={unitOf(metric)} mode="rank" labels={{ low: t("act2.heatmap_low"), high: t("act2.heatmap_high") }} />,
          },
          {
            id: "dual",
            tab: t("act2.board.tab_dual"),
            title: t("act2.viz.dual_title"),
            finding: t("act2.board.dual_find"),
            takeaway: t("act2.board.dual_take"),
            node: (
              <DualAxisChart
                seaSeries={seriesFor("sea")}
                seaYears={DATA.sea.years}
                sstSeries={seriesFor("sst")}
                sstYears={DATA.sst.years}
                seaName={t("act2.f.sea")}
                sstName={t("act2.f.sst")}
                seaUnit={t("act2.sea_unit")}
                sstUnit={t("act2.sst_unit")}
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
        primary: { to: "/territory", label: t("act2.outro.next") },
        secondary: { to: "/", label: t("act2.outro.home") },
      }}
    />
  );
}