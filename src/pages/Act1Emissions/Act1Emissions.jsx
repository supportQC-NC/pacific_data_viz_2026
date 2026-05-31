// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Le paradoxe. Lecture analyste, multi-angles & dynamique.
// La moyenne mondiale est désormais MOBILE (série annuelle réelle).
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
import { worldAvgFor } from "../../data/worldAvg";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import BeeswarmChart from "../../components/BeeswarmChart/BeeswarmChart";
import RankBars from "../../components/RankBars/RankBars";
import TrendLines from "../../components/TrendLines/TrendLines";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import DataTable from "../../components/DataTable/DataTable";
import ExportBar from "../../components/ExportBar/ExportBar";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./Act1Emissions.scss";

const PacificMap = lazy(() => import("../../components/PacificMap/PacificMap"));

const WORLD_AVG_FALLBACK = 4.76;
const TREND_TOP = 7;

export default function Act1Emissions() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const emissions = useSelector(selectDataset("emissions"));
  const chartRef = useRef(null);

  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("emissions"));
  }, [dispatch]);

  const ready = emissions.status === "succeeded";
  const failed = emissions.status === "failed";
  const isDemo =
    ready && emissions.data && emissions.data.source === "fallback";

  const years = ready && emissions.data ? emissions.data.years : [];
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
    }, 1100);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  // Moyenne mondiale MOBILE (année courante).
  const worldAvg = useMemo(
    () =>
      currentYear != null
        ? (worldAvgFor(currentYear) ?? WORLD_AVG_FALLBACK)
        : WORLD_AVG_FALLBACK,
    [currentYear],
  );
  const worldByYear = useMemo(
    () => Object.fromEntries(years.map((y) => [y, worldAvgFor(y)])),
    [years],
  );

  const points = useMemo(() => {
    if (!ready || !emissions.data || currentYear == null) return [];
    const { byArea } = emissions.data;
    return Object.entries(byArea)
      .filter(([area]) => isPict(area))
      .map(([area, series]) => {
        const pt = series.find((p) => p.year === currentYear);
        return pt
          ? {
              area,
              name: pictName(area, lang),
              value: pt.value,
              year: currentYear,
            }
          : null;
      })
      .filter((d) => d && Number.isFinite(d.value) && d.value > 0);
  }, [ready, emissions.data, currentYear, lang]);

  const allSeries = useMemo(() => {
    if (!ready || !emissions.data) return [];
    const { byArea } = emissions.data;
    return Object.entries(byArea)
      .filter(([area]) => isPict(area))
      .map(([area, series]) => ({
        area,
        code: area,
        name: pictName(area, lang),
        values: series.filter((p) => Number.isFinite(p.value) && p.value > 0),
      }));
  }, [ready, emissions.data, lang]);

  const trends = useMemo(() => {
    if (!allSeries.length || !years.length) return [];
    const latest = years[years.length - 1];
    return [...allSeries]
      .map((s) => {
        const lp =
          s.values.find((p) => p.year === latest) ||
          s.values[s.values.length - 1];
        return { ...s, latest: lp ? lp.value : 0 };
      })
      .filter((s) => s.values.length > 1)
      .sort((a, b) => b.latest - a.latest)
      .slice(0, TREND_TOP);
  }, [allSeries, years]);

  // ----- Props mémoïsées -----
  const exportRows = useMemo(
    () =>
      points.map((p) => ({
        name: p.name,
        code: p.area,
        value: p.value,
        year: p.year,
      })),
    [points],
  );
  const exportMeta = useMemo(
    () => ({
      title: t("act1.chart_title"),
      subtitle: `${t("act1.chart_sub")} · ${currentYear ?? ""}`,
      source: t("act1.caption"),
      filename: `emissions_pacifique_${currentYear ?? ""}`,
      sheet: "Emissions",
      unit: t("act1.unit"),
      refValue: worldAvg,
      refLabel: t("act1.world_avg"),
      year: currentYear ?? "",
      series: allSeries,
      years,
      worldByYear,
    }),
    [t, currentYear, worldAvg, allSeries, years, worldByYear],
  );
  const exportLabels = useMemo(
    () => ({
      title: t("export.title"),
      pdf: t("export.pdf"),
      excel: t("export.excel"),
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: t("export.col_value"),
      col_vs_world: t("export.col_vs_world"),
      sheet_data: t("export.sheet_data"),
      sheet_series: t("export.sheet_series"),
      sheet_summary: t("export.sheet_summary"),
      summary_title: t("export.summary_title"),
      summary_year: t("export.summary_year"),
      summary_count: t("export.summary_count"),
      summary_max: t("export.summary_max"),
      summary_min: t("export.summary_min"),
      summary_median: t("export.summary_median"),
      summary_mean: t("export.summary_mean"),
      summary_world: t("export.summary_world"),
      summary_source: t("export.summary_source"),
      summary_generated: t("export.summary_generated"),
    }),
    [t],
  );
  const evoLabels = useMemo(
    () => ({
      improved: t("act1.evo.improved"),
      worsened: t("act1.evo.worsened"),
      since: t("act1.evo.since"),
      no_data: t("act1.evo.no_data"),
    }),
    [t],
  );
  // ---------------------------

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);

  const retry = useCallback(() => {
    dispatch(loadDataset("emissions"));
  }, [dispatch]);

  return (
    <main className="act1">
      <div className="container">
        <header className="act1__head">
          <p className="eyebrow">{t("home.acts.a1_tag")}</p>
          <h1 className="act1__title">{t("home.acts.a1_title")}</h1>
          <p className="act1__lead">{t("act1.lead")}</p>
        </header>

        <ReadingGuide
          title={t("act1.guide.title")}
          intro={t("act1.guide.intro")}
          steps={t("act1.guide.steps")}
          takeaway={t("act1.guide.takeaway")}
        />

        <section className="act1__chart">
          <div className="act1__chart-head">
            <div>
              <h2 className="act1__chart-title">{t("act1.chart_title")}</h2>
              <span className="act1__chart-sub">
                {t("act1.chart_sub")}
                {isDemo ? ` · ${t("act1.demo_badge")}` : ""}
              </span>
            </div>
            {ready && !empty && (
              <ExportBar
                targetRef={chartRef}
                rows={exportRows}
                meta={exportMeta}
                labels={exportLabels}
              />
            )}
          </div>

          {!ready && !failed && (
            <p className="act1__state">{t("scene.loading")}</p>
          )}

          {failed && (
            <div className="act1__state act1__state--err">
              <span>{t("scene.error")}</span>
              <button className="act1__play" onClick={retry}>
                {t("act1.retry")}
              </button>
            </div>
          )}

          {empty && <p className="act1__state">{t("act1.empty")}</p>}

          {ready && !empty && currentYear != null && (
            <>
              <div className="act1__timeline">
                <button className="act1__play" onClick={togglePlay}>
                  {playing ? t("act1.pause") : t("act1.play")}
                </button>
                <input
                  className="act1__slider"
                  type="range"
                  min={0}
                  max={years.length - 1}
                  value={yearIdx ?? 0}
                  onChange={(e) => {
                    setPlaying(false);
                    setYearIdx(Number(e.target.value));
                  }}
                  aria-label={t("act1.year")}
                />
                <span className="act1__year">{currentYear}</span>
              </div>

              <div ref={chartRef} className="act1__capture">
                <BeeswarmChart
                  data={points}
                  worldAvg={worldAvg}
                  unit={t("act1.unit")}
                  refLabel={t("act1.world_avg")}
                  scaleLabels={{
                    linear: t("act1.scale_linear"),
                    log: t("act1.scale_log"),
                  }}
                />
              </div>

              <div className="act1__map-head">
                <h3 className="act1__map-title">{t("act1.viz_rank_title")}</h3>
                <span className="act1__chart-sub">
                  {t("act1.viz_rank_sub")}
                </span>
              </div>
              <RankBars
                data={points}
                unit={t("act1.unit")}
                worldAvg={worldAvg}
                refLabel={t("act1.world_avg")}
              />

              <div className="act1__map-head">
                <h3 className="act1__map-title">{t("act1.viz_trend_title")}</h3>
                <span className="act1__chart-sub">
                  {t("act1.viz_trend_sub")}
                </span>
              </div>
              <TrendLines
                series={trends}
                years={years}
                currentYear={currentYear}
                unit={t("act1.unit")}
              />

              <div className="act1__map-head">
                <h3 className="act1__map-title">{t("act1.map_title")}</h3>
                <span className="act1__chart-sub">{t("act1.map_sub")}</span>
              </div>
              <ErrorBoundary
                fallback={
                  <div className="act1__state act1__state--err">
                    {t("scene.error")}
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="act1__state">{t("scene.loading")}</div>
                  }
                >
                  <PacificMap
                    data={points}
                    unit={t("act1.unit")}
                    legendLow={t("act1.map_low")}
                    legendHigh={t("act1.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>

              <div className="act1__map-head">
                <h3 className="act1__map-title">{t("act1.evo.title")}</h3>
                <span className="act1__chart-sub">{t("act1.evo.sub")}</span>
              </div>
              <EvolutionPanel
                series={allSeries}
                labels={evoLabels}
                unit={t("act1.unit")}
                topN={5}
              />

              <div className="act1__map-head">
                <h3 className="act1__map-title">{t("act1.table.title")}</h3>
                <span className="act1__chart-sub">{t("act1.table.sub")}</span>
              </div>
              <DataTable
                rows={exportRows}
                labels={exportLabels}
                unit={t("act1.unit")}
                refValue={worldAvg}
              />
            </>
          )}

          <p className="act1__paradox">{t("act1.paradox")}</p>
          <p className="act1__caption">{t("act1.caption")}</p>
        </section>

        <Link to="/" className="act1__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}
