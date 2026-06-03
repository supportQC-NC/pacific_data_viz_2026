// src/pages/Act3Territory/Act3Territory.jsx
// ============================================================
// Acte 03 — Le territoire. « La côte recule. »
// Donnée : TAUX de croissance annuel de la population (%) par territoire.
// 0 = stable ; > 0 = l'île gagne des habitants ; < 0 = elle en perd.
//
// MÊME EXPÉRIENCE que les Actes 1 & 2 : diaporama plein écran (diapo texte
// -> diapo contenu), filtres repliables, navigation clavier/boutons, écran
// de fin. On GARDE l'existant (guide, carte 3D, évolution, tableau) et on
// AJOUTE des vues ApexCharts pertinentes :
//   • tendance migrée -> BandTrendChart (rangeArea + moyenne + réf 0),
//   • barres divergentes « gagne / perd des habitants » (polarité population),
//   • dumbbell 1re -> dernière année,
//   • heatmap DIVERGENTE territoire × année (vert = croissance, rouge = déclin).
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
import StackedCountChart from "../../components/charts/StackedCountChart";
import ChangeChart from "../../components/charts/ChangeChart";
import DumbbellChart from "../../components/charts/DumbbellChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import DataTable from "../../components/DataTable/DataTable";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import "./Act3Territory.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

/* ---------- Stats robustes ---------- */
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
      return { year, mean, min: pct(s, 0.1), max: pct(s, 0.9) }; // bande robuste 10–90
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
      const p = (d.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value)
        ? { area: a, name: pictName(a, lang), value: p.value, year }
        : null;
    })
    .filter(Boolean);
}

/* ---------- Contrôles de filtre (mêmes que Actes 1 & 2) ---------- */
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
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const activeRef = useRef(0);

  const pop = useSelector(selectDataset("population"));
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const ready = pop.status === "succeeded";
  const failed = pop.status === "failed";
  const isDemo = ready && pop.data && pop.data.source === "fallback";
  const data = pop.data;

  const years = useMemo(() => (data ? data.years : []), [data]);
  const empty = ready && years.length === 0;

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
    }, 750);
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

  // Barres divergentes : taux de l'année courante par territoire.
  const divergeRows = useMemo(
    () => points.map((p) => ({ name: p.name, delta: Number(p.value.toFixed(3)) })),
    [points],
  );

  // Dumbbell : première -> dernière année observée.
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

  // Jauge : part des territoires en croissance (> 0) à l'année courante.
  const growingPct = useMemo(() => {
    if (!points.length) return 0;
    const up = points.filter((p) => p.value > 0).length;
    return Math.round((up / points.length) * 100);
  }, [points]);

  // Bascule : nb de territoires en croissance vs en déclin, par année.
  const balanceData = useMemo(() => {
    if (!data) return [];
    return years.map((y) => {
      let up = 0;
      let down = 0;
      data.areas.forEach((a) => {
        if (!isPict(a)) return;
        const p = (data.byArea[a] || []).find((q) => q.year === y);
        if (p && Number.isFinite(p.value)) {
          if (p.value > 0) up += 1;
          else if (p.value < 0) down += 1;
        }
      });
      return { year: y, up, down };
    });
  }, [data, years]);

  // Échelle robuste pour la carte (évite que les micro-îles outliers écrasent tout).
  const robustRange = useMemo(() => {
    if (!data) return { min: -3, max: 3 };
    const abs = [];
    data.areas.forEach((a) => {
      if (!isPict(a)) return;
      (data.byArea[a] || []).forEach((p) => {
        if (Number.isFinite(p.value)) abs.push(Math.abs(p.value));
      });
    });
    abs.sort((x, y) => x - y);
    const p = abs.length ? pct(abs, 0.92) : 3;
    const m = Math.max(2, Math.min(8, p));
    return { min: -m, max: m };
  }, [data]);

  const unit = t("act3.unit");
  const tableLabels = useMemo(
    () => ({
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: `${t("act3.value_label")} (${unit})`,
      col_vs_world: t("act3.vs_mean"),
    }),
    [t, unit],
  );
  const evoLabels = useMemo(
    () => ({
      improved: t("act3.evo_down"),
      worsened: t("act3.evo_up"),
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
  const retry = useCallback(() => dispatch(loadDataset("population")), [dispatch]);

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

  return (
    <main className="act1 act3" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("home.acts.a3_tag")}</p>
          <h1 className="act1__title">{t("home.acts.a3_title")}</h1>
          <p className="act1__lead">{t("act3.lead")}</p>
          {isDemo && <span className="act3__demo">{t("act3.demo_badge")}</span>}
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
            {/* Tendance (moyenne + bande robuste + réf 0) */}
            <VizPanel
              title={t("act3.pop_title")}
              subtitle={t("act3.pop_sub")}
              story={t("act3.story.trend")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <BandTrendChart
                data={trend}
                unit={unit}
                refLabel={t("act3.baseline")}
                meanLabel={t("act3.mean_label")}
                currentYear={currentYear}
                color={tk.warm}
              />
            </VizPanel>

            {/* Jauge : part des territoires en croissance */}
            <VizPanel
              title={t("act3.gauge_title")}
              subtitle={t("act3.gauge_sub")}
              story={t("act3.story.gauge")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <RadialGauge value={growingPct} label={t("act3.gauge_label")} color={tk.accent} />
            </VizPanel>

            {/* Carte 3D */}
            <VizPanel
              title={t("act3.map_title")}
              subtitle={t("act3.map_sub")}
              story={t("act3.story.map")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <ErrorBoundary fallback={<div className="act1__state act1__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={points}
                    unit={unit}
                    range={robustRange}
                    ramp="semantic"
                    mid={0}
                    lowLabel={t("act3.map_low")}
                    midLabel={t("act3.map_mid")}
                    highLabel={t("act3.map_high")}
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

            {/* Barres divergentes : gagne / perd des habitants (année courante) */}
            <VizPanel
              title={t("act3.diverge_title")}
              subtitle={t("act3.diverge_sub")}
              story={t("act3.story.diverge")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <ChangeChart rows={divergeRows} unit={unit} direction="all" polarity="up_good" />
            </VizPanel>

            {/* Bascule : croissance vs déclin par année */}
            <VizPanel
              title={t("act3.balance_title")}
              subtitle={t("act3.balance_sub")}
              story={t("act3.story.balance")}
            >
              <StackedCountChart
                data={balanceData}
                labels={{ up: t("act3.balance_up"), down: t("act3.balance_down") }}
              />
            </VizPanel>

            {/* Dumbbell : 1re -> dernière année */}
            <VizPanel
              title={t("act3.dumb_title")}
              subtitle={t("act3.dumb_sub")}
              story={t("act3.story.dumb")}
            >
              <DumbbellChart
                rows={dumbRows}
                unit={unit}
                startLabel={t("act2.dumb.start")}
                endLabel={t("act2.dumb.end")}
              />
            </VizPanel>

            {/* Heatmap DIVERGENTE territoire × année */}
            <VizPanel
              title={t("act3.heat_title")}
              subtitle={t("act3.heat_sub")}
              story={t("act3.story.heat")}
            >
              <HeatmapChart
                series={series}
                years={years}
                unit={unit}
                mode="diverge"
                labels={{ low: t("act3.heat_low"), high: t("act3.heat_high") }}
              />
            </VizPanel>

            {/* Évolution */}
            <VizPanel
              title={t("act3.evo_title")}
              subtitle={t("act3.evo_sub")}
              story={t("act3.story.evo")}
            >
              <EvolutionPanel series={series} labels={evoLabels} unit={unit} mode="absolute" topN={5} />
            </VizPanel>

            {/* Tableau */}
            <VizPanel
              title={t("act3.table_title")}
              subtitle={t("act3.table_sub")}
              story={t("act3.story.table")}
              filtersLabel={t("act1.f.toggle")}
              filters={<YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />}
            >
              <DataTable rows={points} labels={tableLabels} unit={unit} refValue={regionalMean} />
            </VizPanel>

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act3.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act3.outro.title")}</h2>
                <p className="act1outro__text">{t("act3.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/impact" className="act1outro__btn act1outro__btn--primary">
                    {t("act3.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act3.outro.home")}
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