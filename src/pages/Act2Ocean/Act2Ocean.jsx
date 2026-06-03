// src/pages/Act2Ocean/Act2Ocean.jsx
// ============================================================
// Acte 02 — L'océan. Niveau de la mer (m) & anomalie de température (°C),
// territoire par territoire (données PDH/SPC — anomalies, 0 = référence).
// Même expérience que l'Acte 1 : diaporama plein écran (texte -> graphique),
// filtres repliables, navigation clavier/boutons, écran de fin.
// Réutilise les composants charts et les styles de l'Acte 1.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import useThemeTokens from "../../hooks/UseThemeTokens";
import KpiRow from "../../components/KpiRow/KpiRow";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import VizPanel from "../../components/charts/VizPanel";
import AnomalyBandChart from "../../components/charts/AnomalyBandChart";
import RankChart from "../../components/charts/RankChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import BoxplotChart from "../../components/charts/BoxplotChart";
import ScatterChart from "../../components/charts/ScatterChart";
import ChangeChart from "../../components/charts/ChangeChart";
import RiverChart from "../../components/charts/RiverChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import ShareAboveChart from "../../components/charts/ShareAboveChart";
import DumbbellChart from "../../components/charts/DumbbellChart";
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

function Pills({ label, options, value, onChange, help }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      {label ? (
        <span className="act1f__lbl">
          {label}
          {help ? (
            <button type="button" className="act1f__help" title={help} aria-label={help}>
              ?
            </button>
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
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const activeRef = useRef(0);

  const sea = useSelector(selectDataset("seaLevel"));
  const sst = useSelector(selectDataset("sst"));

  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  const [mBand, setMBand] = useState("sea");
  const [rBand, setRBand] = useState("all");
  const [mRank, setMRank] = useState("sea");
  const [rRank, setRRank] = useState("all");
  const [sortRank, setSortRank] = useState("desc");
  const [mMap, setMMap] = useState("sea");
  const [rMap, setRMap] = useState("all");
  const [mHeat, setMHeat] = useState("sea");
  const [rHeat, setRHeat] = useState("all");
  const [mBox, setMBox] = useState("sea");
  const [rBox, setRBox] = useState("all");
  const [rCorr, setRCorr] = useState("all");
  const [mChange, setMChange] = useState("sea");
  const [rChange, setRChange] = useState("all");
  const [dirChange, setDirChange] = useState("all");
  const [mRiver, setMRiver] = useState("sea");
  const [rDual, setRDual] = useState("all");
  const [mShare, setMShare] = useState("sea");
  const [rShare, setRShare] = useState("all");
  const [mDumb, setMDumb] = useState("sea");
  const [rDumb, setRDumb] = useState("all");

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
          values: (data.byArea[a] || [])
            .filter((p) => Number.isFinite(p.value))
            .sort((x, y) => x.year - y.year),
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

  const unitOf = useCallback(
    (m) => (m === "sea" ? t("act2.sea_unit") : t("act2.sst_unit")),
    [t],
  );

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

  const inRegion = useCallback(
    (area, region) => region === "all" || REGION_OF[area] === region,
    [],
  );

  const seriesFor = useCallback(
    (m, region) => DATA[m].series.filter((s) => inRegion(s.area, region)),
    [DATA, inRegion],
  );

  // Dernière année RÉELLEMENT disponible pour une mesure (<= year, sinon la
  // plus récente). Évite les graphiques vides quand une année manque.
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
    (m, region, year) => {
      const yy = yearForMetric(m, year);
      return DATA[m].series
        .filter((s) => inRegion(s.area, region))
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, yy) }))
        .filter((p) => Number.isFinite(p.value));
    },
    [DATA, inRegion, yearForMetric],
  );

  const subNames = useMemo(
    () => ({
      melanesia: t("act1.filter.melanesia"),
      polynesia: t("act1.filter.polynesia"),
      micronesia: t("act1.filter.micronesia"),
    }),
    [t],
  );

  const subAvgFor = useCallback(
    (m) => {
      const yrs = DATA[m].years;
      if (!yrs.length) return [];
      return Object.keys(SUBREGIONS)
        .map((reg) => {
          const members = DATA[m].series.filter((s) => REGION_OF[s.area] === reg);
          const values = yrs
            .map((y) => {
              const vs = members.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
              return vs.length ? { year: y, value: vs.reduce((a, b) => a + b, 0) / vs.length } : null;
            })
            .filter(Boolean);
          return { name: subNames[reg], values };
        })
        .filter((g) => g.values.length);
    },
    [DATA, subNames],
  );

  const corrGroups = useMemo(() => {
    const palette = paletteOf(tk);
    const seaYear = yearForMetric("sea", currentYear);
    const sstYear = yearForMetric("sst", currentYear);
    const seaSeries = DATA.sea.series.filter((s) => inRegion(s.area, rCorr));
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
  }, [DATA, rCorr, currentYear, subNames, inRegion, yearForMetric, tk]);

  const corrMedianX = useMemo(
    () => median(corrGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [corrGroups],
  );

  const changeRows = useMemo(
    () =>
      DATA[mChange].series
        .filter((s) => inRegion(s.area, rChange) && s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          delta: Number((s.values[s.values.length - 1].value - s.values[0].value).toFixed(3)),
        })),
    [DATA, mChange, rChange, inRegion],
  );

  const dumbRows = useMemo(
    () =>
      DATA[mDumb].series
        .filter((s) => inRegion(s.area, rDumb) && s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          start: s.values[0].value,
          end: s.values[s.values.length - 1].value,
        })),
    [DATA, mDumb, rDumb, inRegion],
  );

  const kpiItems = useMemo(() => {
    if (!ready || !currentYear) return [];
    const seaPts = pointsFor("sea", "all", currentYear);
    const sstPts = pointsFor("sst", "all", currentYear);
    const seaMean = median(seaPts.map((p) => p.value));
    const sstMean = median(sstPts.map((p) => p.value));
    const top = [...seaPts].sort((a, b) => b.value - a.value)[0];
    const seaFirst = median(pointsFor("sea", "all", DATA.sea.years[0]).map((p) => p.value));
    const change = Number.isFinite(seaMean) && Number.isFinite(seaFirst) ? seaMean - seaFirst : null;
    const items = [];
    if (Number.isFinite(seaMean))
      items.push({ key: "sea", value: `${seaMean > 0 ? "+" : ""}${fmt(seaMean)}`, unit: t("act2.sea_unit"), label: t("act2.kpi.sea_mean"), tone: "accent" });
    if (Number.isFinite(sstMean))
      items.push({ key: "sst", value: `${sstMean > 0 ? "+" : ""}${fmt(sstMean, 1)}`, unit: t("act2.sst_unit"), label: t("act2.kpi.sst_mean"), tone: "warm" });
    if (top)
      items.push({ key: "top", value: `+${fmt(top.value)}`, unit: top.name, label: t("act2.kpi.most_exposed"), tone: "warm" });
    if (change != null)
      items.push({ key: "chg", value: `${change > 0 ? "+" : ""}${fmt(change)}`, unit: `${t("act2.kpi.since")} ${DATA.sea.years[0]}`, label: t("act2.kpi.sea_change"), tone: change > 0 ? "warm" : "positive" });
    return items;
  }, [ready, currentYear, pointsFor, DATA, t]);

  const mapPoints = useMemo(
    () => pointsFor(mMap, rMap, currentYear).map((p) => ({ ...p, year: currentYear })),
    [pointsFor, mMap, rMap, currentYear],
  );
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

  useEffect(() => {
    if (!ready || empty) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const compute = () => {
      const nodes = Array.from(root.querySelectorAll(".act1slide"));
      setSlideCount(nodes.length);
      const mid = window.innerHeight * 0.4;
      let idx = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const r = nodes[i].getBoundingClientRect();
        if (r.top <= mid) idx = i;
        else break;
      }
      setActive(idx);
      activeRef.current = idx;
    };
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ready, empty, currentYear, lang]);

  const goTo = useCallback((i) => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll(".act1slide"));
    if (!nodes.length) return;
    const idx = Math.max(0, Math.min(nodes.length - 1, i));
    const el = nodes[idx];
    const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!ready || empty) return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(activeRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, empty, goTo]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const metricOpts = [
    { v: "sea", label: t("act2.f.sea") },
    { v: "sst", label: t("act2.f.sst") },
  ];
  const sortOpts = [
    { v: "desc", label: t("act1.f.sort_desc") },
    { v: "asc", label: t("act1.f.sort_asc") },
  ];
  const dirOpts = [
    { v: "all", label: t("act1.f.dir_all") },
    { v: "up", label: t("act1.f.dir_up") },
    { v: "down", label: t("act1.f.dir_down") },
  ];

  return (
    <main className="act1 act2" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("home.acts.a2_tag")}</p>
          <h1 className="act1__title">{t("home.acts.a2_title")}</h1>
          <p className="act1__lead">{t("act2.lead")}</p>
          {kpiItems.length > 0 && (
            <KpiRow items={kpiItems} title={t("act1.stats.title")} />
          )}
        </header>

        {!ready && !failed && <Loader fullscreen label={t("scene.loading")} />}

        {failed && (
          <div className="act1__state act1__state--err">
            <span>{t("scene.error")}</span>
            <button className="act1__retry" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {empty && <p className="act1__state">{t("act1.empty")}</p>}

        {ready && !empty && currentYear != null && (
          <>
            <VizPanel
              title={t("act2.viz.band_title")}
              subtitle={t("act2.viz.band_sub")}
              story={t("act2.story.band")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mBand} onChange={setMBand} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rBand} onChange={setRBand} />
                </>
              }
            >
              <AnomalyBandChart series={seriesFor(mBand, rBand)} years={DATA[mBand].years} unit={unitOf(mBand)} />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.rank_title")}
              subtitle={t("act2.viz.rank_sub")}
              story={t("act2.story.rank")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mRank} onChange={setMRank} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rRank} onChange={setRRank} />
                  <Pills label={t("act1.f.sort")} options={sortOpts} value={sortRank} onChange={setSortRank} />
                  <YearSlider label={t("act1.f.year")} years={masterYears} index={yearIdx} onChange={scrubYear} />
                </>
              }
            >
              <RankChart
                points={pointsFor(mRank, rRank, currentYear)}
                unit={unitOf(mRank)}
                median={0}
                refLabel={t("act2.ref")}
                sort={sortRank}
                scale="lin"
              />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.map_title")}
              subtitle={t("act2.viz.map_sub")}
              story={t("act2.story.map")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mMap} onChange={setMMap} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rMap} onChange={setRMap} />
                  <YearSlider label={t("act1.f.year")} years={masterYears} index={yearIdx} onChange={scrubYear} />
                </>
              }
            >
              <ErrorBoundary fallback={<div className="act1__state act1__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={mapPoints}
                    unit={unitOf(mMap)}
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
            </VizPanel>

            <VizPanel
              title={t("act2.viz.heat_title")}
              subtitle={t("act2.viz.heat_sub")}
              story={t("act2.story.heat")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mHeat} onChange={setMHeat} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rHeat} onChange={setRHeat} />
                </>
              }
            >
              <HeatmapChart
                series={seriesFor(mHeat, rHeat)}
                years={DATA[mHeat].years}
                unit={unitOf(mHeat)}
                mode="rank"
                labels={{ low: t("act2.heatmap_low"), high: t("act2.heatmap_high") }}
              />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.corr_title")}
              subtitle={t("act2.viz.corr_sub")}
              story={t("act2.story.corr")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rCorr} onChange={setRCorr} />
                  <YearSlider label={t("act1.f.year")} years={masterYears} index={yearIdx} onChange={scrubYear} />
                </>
              }
            >
              <ScatterChart
                groups={corrGroups}
                unit={t("act2.sea_unit")}
                medianX={corrMedianX}
                xName={t("act2.sea_unit")}
                yName={t("act2.sst_unit")}
              />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.box_title")}
              subtitle={t("act2.viz.box_sub")}
              story={t("act2.story.box")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mBox} onChange={setMBox} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rBox} onChange={setRBox} />
                </>
              }
            >
              <BoxplotChart series={seriesFor(mBox, rBox)} years={DATA[mBox].years} unit={unitOf(mBox)} scale="lin" />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.river_title")}
              subtitle={t("act2.viz.river_sub")}
              story={t("act2.story.river")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <Pills label={t("act2.f.metric")} options={metricOpts} value={mRiver} onChange={setMRiver} />
              }
            >
              <RiverChart subAvg={subAvgFor(mRiver)} years={DATA[mRiver].years} />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.change_title")}
              subtitle={t("act2.viz.change_sub")}
              story={t("act2.story.change")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mChange} onChange={setMChange} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rChange} onChange={setRChange} />
                  <Pills label={t("act1.f.dir")} options={dirOpts} value={dirChange} onChange={setDirChange} />
                </>
              }
            >
              <ChangeChart rows={changeRows} unit={unitOf(mChange)} direction={dirChange} />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.dual_title")}
              subtitle={t("act2.viz.dual_sub")}
              story={t("act2.story.dual")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <Pills label={t("act1.filter.title")} options={regionOpts} value={rDual} onChange={setRDual} />
              }
            >
              <DualAxisChart
                seaSeries={seriesFor("sea", rDual)}
                seaYears={DATA.sea.years}
                sstSeries={seriesFor("sst", rDual)}
                sstYears={DATA.sst.years}
                seaName={t("act2.f.sea")}
                sstName={t("act2.f.sst")}
                seaUnit={t("act2.sea_unit")}
                sstUnit={t("act2.sst_unit")}
              />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.share_title")}
              subtitle={t("act2.viz.share_sub")}
              story={t("act2.story.share")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mShare} onChange={setMShare} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rShare} onChange={setRShare} />
                </>
              }
            >
              <ShareAboveChart series={seriesFor(mShare, rShare)} years={DATA[mShare].years} />
            </VizPanel>

            <VizPanel
              title={t("act2.viz.dumb_title")}
              subtitle={t("act2.viz.dumb_sub")}
              story={t("act2.story.dumb")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  <Pills label={t("act2.f.metric")} options={metricOpts} value={mDumb} onChange={setMDumb} />
                  <Pills label={t("act1.filter.title")} options={regionOpts} value={rDumb} onChange={setRDumb} />
                </>
              }
            >
              <DumbbellChart
                rows={dumbRows}
                unit={unitOf(mDumb)}
                startLabel={t("act2.dumb.start")}
                endLabel={t("act2.dumb.end")}
              />
            </VizPanel>

            <p className="act1__caption">{t("act2.caption")}</p>

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act2.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act2.outro.title")}</h2>
                <p className="act1outro__text">{t("act2.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/territory" className="act1outro__btn act1outro__btn--primary">
                    {t("act2.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act2.outro.home")}
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}

        <Link to="/" className="act1__back">
          ← {t("act1.back")}
        </Link>
      </div>

      {ready && !empty && slideCount > 0 && (
        <div className="act1nav" role="group" aria-label={t("act1.nav.next")}>
          <button
            type="button"
            className="act1nav__btn"
            onClick={() => goTo(active - 1)}
            disabled={active <= 0}
            aria-label={t("act1.nav.prev")}
          >
            ↑
          </button>
          <span className="act1nav__count">
            {active + 1}/{slideCount}
          </span>
          <button
            type="button"
            className="act1nav__btn"
            onClick={() => goTo(active + 1)}
            disabled={active >= slideCount - 1}
            aria-label={t("act1.nav.next")}
          >
            ↓
          </button>
        </div>
      )}
    </main>
  );
}