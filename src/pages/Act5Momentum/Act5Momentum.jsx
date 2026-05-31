// src/pages/Act5Momentum/Act5Momentum.jsx
// ============================================================
// Acte 05 — La réponse. « L'élan. »
// Donnée : part des renouvelables dans la conso finale d'énergie (%),
// série annuelle 2000–2023. Tonalité POSITIVE (vert), haut = mieux.
// Trajectoire (moyenne + bande robuste), carte 3D verte, podium des
// champions, plus fortes progressions, tableau. Curseur d'année partagé.
// ============================================================

import React, {
  useEffect,
  useMemo,
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
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import RankBars from "../../components/RankBars/RankBars";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import DataTable from "../../components/DataTable/DataTable";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./Act5Momentum.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

function pct(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi
    ? sorted[lo]
    : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
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
      values: (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }));
}
function pointsAt(d, year, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const p = (d.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value)
        ? { area: a, code: a, name: pictName(a, lang), value: p.value, year }
        : null;
    })
    .filter(Boolean);
}

export default function Act5Momentum() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
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
    }, 650);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const trend = useMemo(() => meanSeries(data), [data]);
  const series = useMemo(() => allSeries(data, lang), [data, lang]);
  const points = useMemo(
    () =>
      data && currentYear != null ? pointsAt(data, currentYear, lang) : [],
    [data, currentYear, lang],
  );
  const regionalMean = useMemo(
    () =>
      points.length
        ? points.reduce((s, p) => s + p.value, 0) / points.length
        : 0,
    [points],
  );
  const overallMax = useMemo(
    () => (data ? Math.max(1, data.range.max) : 100),
    [data],
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
  const retry = useCallback(() => {
    dispatch(loadDataset("renewables"));
  }, [dispatch]);

  return (
    <main className="act5">
      <div className="container">
        <header className="act5__head">
          <p className="eyebrow">{t("home.acts.a5_tag")}</p>
          <h1 className="act5__title">{t("home.acts.a5_title")}</h1>
          <p className="act5__lead">{t("act5.lead")}</p>
        </header>

        <ReadingGuide
          title={t("act5.guide.title")}
          intro={t("act5.guide.intro")}
          steps={t("act5.guide.steps")}
          takeaway={t("act5.guide.takeaway")}
        />

        {!ready && !failed && (
          <p className="act5__state">{t("scene.loading")}</p>
        )}
        {failed && (
          <div className="act5__state act5__state--err">
            <span>{t("scene.error")}</span>
            <button className="act5__btn" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {ready && currentYear != null && (
          <>
            <div className="act5__timeline">
              <button className="act5__btn" onClick={togglePlay}>
                {playing ? t("act1.pause") : t("act1.play")}
              </button>
              <input
                className="act5__slider"
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
              <span className="act5__year">{currentYear}</span>
              {isDemo && (
                <span className="act5__demo">{t("act5.demo_badge")}</span>
              )}
            </div>

            {/* Trajectoire de la part renouvelable */}
            <section className="act5__chart">
              <div className="act5__chart-head">
                <h2 className="act5__chart-title">{t("act5.ren_title")}</h2>
                <span className="act5__sub">
                  {t("act5.value_label")} · {unit}
                </span>
              </div>
              <AnomalyTrend
                data={trend}
                currentYear={currentYear}
                unit={unit}
                tone="green"
                baselineLabel={t("act5.baseline")}
                meanLabel={t("act5.mean_label")}
              />
            </section>

            {/* Carte 3D verte */}
            <div className="act5__sec-head">
              <h3 className="act5__sec-title">{t("act5.map_title")}</h3>
              <span className="act5__sub">
                {t("act5.map_sub")} · {currentYear}
              </span>
            </div>
            <ErrorBoundary
              fallback={
                <div className="act5__state act5__state--err">
                  {t("scene.error")}
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="act5__state">{t("scene.loading")}</div>
                }
              >
                <OceanMap
                  data={points}
                  unit={unit}
                  range={{ min: 0, max: overallMax }}
                  ramp="good"
                  lowLabel={t("act5.map_low")}
                  highLabel={t("act5.map_high")}
                  noTokenMsg={t("act1.map_no_token")}
                />
              </Suspense>
            </ErrorBoundary>

            {/* Podium des champions (année courante) */}
            <div className="act5__sec-head">
              <h3 className="act5__sec-title">{t("act5.rank_title")}</h3>
              <span className="act5__sub">
                {t("act5.rank_sub")} · {currentYear}
              </span>
            </div>
            <RankBars data={points} unit={unit} />

            {/* Plus fortes progressions */}
            <div className="act5__sec-head">
              <h3 className="act5__sec-title">{t("act5.evo_title")}</h3>
              <span className="act5__sub">{t("act5.evo_sub")}</span>
            </div>
            <EvolutionPanel
              series={series}
              labels={evoLabels}
              unit={unit}
              mode="absolute"
              topN={5}
            />

            {/* Tableau */}
            <div className="act5__sec-head">
              <h3 className="act5__sec-title">{t("act5.table_title")}</h3>
              <span className="act5__sub">
                {t("act5.table_sub")} · {currentYear}
              </span>
            </div>
            <DataTable
              rows={points}
              labels={tableLabels}
              unit={unit}
              refValue={regionalMean}
            />
          </>
        )}

        <Link to="/" className="act5__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}
