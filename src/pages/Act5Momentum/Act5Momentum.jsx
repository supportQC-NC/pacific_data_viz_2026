// src/pages/Act5Momentum/Act5Momentum.jsx
// ============================================================
// Acte 05 — La réponse. « L'élan. »
// Donnée : part des renouvelables dans la conso finale d'énergie (%),
// série annuelle. Tonalité POSITIVE (vert), haut = mieux.
//
// MÊME EXPÉRIENCE que les Actes 1–4 : diaporama plein écran, filtres
// repliables, navigation clavier/boutons, écran de fin. Guide retiré.
// On GARDE l'existant (carte verte, podium, progressions, tableau) et on
// AJOUTE des vues ApexCharts adaptées au récit positif :
//   • trajectoire migrée -> BandTrendChart (vert, sans réf-0),
//   • jauge radiale (part renouvelable moyenne régionale),
//   • barres de progression (hausse = vert),
//   • dumbbell 1re -> dernière année,
//   • heatmap territoire × année à rampe INVERSÉE (haut = vert).
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
import VizPanel from "../../components/charts/VizPanel";
import BandTrendChart from "../../components/charts/BandTrendChart";
import RadialGauge from "../../components/charts/RadialGauge";
import ChangeChart from "../../components/charts/ChangeChart";
import DumbbellChart from "../../components/charts/DumbbellChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import RankBars from "../../components/RankBars/RankBars";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import DataTable from "../../components/DataTable/DataTable";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import "./Act5Momentum.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

function pct(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function meanSeries(d) {
  if (!d) return [];
  return d.years
    .map((year) => {
      const vals = [];
      d.areas.forEach((a) => {
        if (!isPict(a)) return;
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
function allSeries(d, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (d.byArea[a] || [])
        .filter((p) => Number.isFinite(p.value))
        .sort((x, y) => x.year - y.year),
    }))
    .filter((s) => s.values.length);
}
function pointsAt(d, year, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const s = d.byArea[a] || [];
      let chosen = null;
      for (let i = 0; i < s.length; i += 1) {
        if (s[i].year <= year && Number.isFinite(s[i].value)) chosen = s[i];
      }
      return chosen
        ? { area: a, code: a, name: pictName(a, lang), value: chosen.value, year: chosen.year }
        : null;
    })
    .filter(Boolean);
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

export default function Act5Momentum() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const activeRef = useRef(0);

  const renew = useSelector(selectDataset("renewables"));
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("renewables"));
  }, [dispatch]);

  const ready = renew.status === "succeeded";
  const failed = renew.status === "failed";
  const isDemo = ready && renew.data && renew.data.source === "fallback";
  const data = renew.data;

  const years = useMemo(() => (data ? data.years : []), [data]);
  const empty = ready && years.length === 0;

  // Année la mieux couverte pour ouvrir sur une année pleine.
  const bestIdx = useMemo(() => {
    if (!data) return 0;
    let best = 0;
    let bestCov = -1;
    data.years.forEach((y, i) => {
      let cov = 0;
      data.areas.forEach((a) => {
        if (!isPict(a)) return;
        const p = (data.byArea[a] || []).find((q) => q.year === y);
        if (p && Number.isFinite(p.value)) cov += 1;
      });
      if (cov >= bestCov) {
        bestCov = cov;
        best = i;
      }
    });
    return best;
  }, [data]);

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(bestIdx);
  }, [years, yearIdx, bestIdx]);

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
    }, 700);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const trend = useMemo(() => meanSeries(data), [data]);
  const series = useMemo(() => allSeries(data, lang), [data, lang]);
  const points = useMemo(
    () => (data && currentYear != null ? pointsAt(data, currentYear, lang) : []),
    [data, currentYear, lang],
  );
  const regionalMean = useMemo(
    () => (points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : 0),
    [points],
  );
  const overallMax = useMemo(() => (data ? Math.max(1, data.range.max) : 100), [data]);

  // Progression (delta 1re -> dernière année) — hausse = bon.
  const changeRows = useMemo(
    () =>
      series
        .filter((s) => s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          delta: Number((s.values[s.values.length - 1].value - s.values[0].value).toFixed(2)),
        })),
    [series],
  );
  const dumbRows = useMemo(
    () =>
      series
        .filter((s) => s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          start: s.values[0].value,
          end: s.values[s.values.length - 1].value,
        })),
    [series],
  );

  const unit = t("act5.unit");
  const tableLabels = useMemo(
    () => ({
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: `${t("act5.value_label")} (${unit})`,
      col_vs_world: t("act5.vs_mean"),
    }),
    [t, unit],
  );
  const evoLabels = useMemo(
    () => ({
      improved: t("act5.evo_down"),
      worsened: t("act5.evo_up"),
      since: t("act1.evo.since"),
      no_data: t("act1.evo.no_data"),
    }),
    [t],
  );

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => dispatch(loadDataset("renewables")), [dispatch]);

  // Diaporama : suit la diapo active via le scroll + navigation prev/next.
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
    const top = nodes[idx].getBoundingClientRect().top + window.pageYOffset - 80;
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

  return (
    <main className="act1 act5" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("home.acts.a5_tag")}</p>
          <h1 className="act1__title">{t("home.acts.a5_title")}</h1>
          <p className="act1__lead">{t("act5.lead")}</p>
          {isDemo && <span className="act5__demo">{t("act5.demo_badge")}</span>}
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
            {/* Trajectoire de la part renouvelable */}
            <VizPanel
              title={t("act5.ren_title")}
              subtitle={t("act5.ren_sub")}
              story={t("act5.story.trend")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <BandTrendChart
                data={trend}
                unit={unit}
                refValue={null}
                meanLabel={t("act5.mean_label")}
                currentYear={currentYear}
                color={tk.positive}
              />
            </VizPanel>

            {/* Jauge : part renouvelable moyenne régionale */}
            <VizPanel
              title={t("act5.gauge_title")}
              subtitle={t("act5.gauge_sub")}
              story={t("act5.story.gauge")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <RadialGauge value={Math.round(regionalMean)} label={t("act5.gauge_label")} color={tk.positive} />
            </VizPanel>

            {/* Carte 3D verte */}
            <VizPanel
              title={t("act5.map_title")}
              subtitle={t("act5.map_sub")}
              story={t("act5.story.map")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <ErrorBoundary fallback={<div className="act1__state act1__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={points}
                    unit={unit}
                    range={{ min: 0, max: overallMax }}
                    ramp="good"
                    lowLabel={t("act5.map_low")}
                    highLabel={t("act5.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                    years={years}
                    yearIndex={yearIdx}
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onScrub={scrubYear}
                  />
                </Suspense>
              </ErrorBoundary>
            </VizPanel>

            {/* Podium des champions (année courante) */}
            <VizPanel
              title={t("act5.rank_title")}
              subtitle={t("act5.rank_sub")}
              story={t("act5.story.rank")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <RankBars data={points} unit={unit} />
            </VizPanel>

            {/* Progression (delta 1re -> dernière année) */}
            <VizPanel
              title={t("act5.change_title")}
              subtitle={t("act5.change_sub")}
              story={t("act5.story.change")}
            >
              <ChangeChart rows={changeRows} unit={unit} direction="all" polarity="up_good" />
            </VizPanel>

            {/* Dumbbell : 1re -> dernière année */}
            <VizPanel
              title={t("act5.dumb_title")}
              subtitle={t("act5.dumb_sub")}
              story={t("act5.story.dumb")}
            >
              <DumbbellChart
                rows={dumbRows}
                unit={unit}
                startLabel={t("act2.dumb.start")}
                endLabel={t("act2.dumb.end")}
              />
            </VizPanel>

            {/* Heatmap territoire × année (haut = vert) */}
            <VizPanel
              title={t("act5.heat_title")}
              subtitle={t("act5.heat_sub")}
              story={t("act5.story.heat")}
            >
              <HeatmapChart series={series} years={years} unit={unit} mode="rank" invert />
            </VizPanel>

            {/* Plus fortes progressions */}
            <VizPanel
              title={t("act5.evo_title")}
              subtitle={t("act5.evo_sub")}
              story={t("act5.story.evo")}
            >
              <EvolutionPanel series={series} labels={evoLabels} unit={unit} mode="absolute" topN={5} />
            </VizPanel>

            {/* Tableau */}
            <VizPanel
              title={t("act5.table_title")}
              subtitle={t("act5.table_sub")}
              story={t("act5.story.table")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <DataTable rows={points} labels={tableLabels} unit={unit} refValue={regionalMean} />
            </VizPanel>

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act5.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act5.outro.title")}</h2>
                <p className="act1outro__text">{t("act5.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/agriculture" className="act1outro__btn act1outro__btn--primary">
                    {t("act5.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act5.outro.home")}
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