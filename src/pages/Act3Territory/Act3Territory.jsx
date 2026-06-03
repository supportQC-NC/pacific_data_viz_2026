// src/pages/Act3Territory/Act3Territory.jsx
// ============================================================
// Acte 03 — Le territoire. « La côte recule. »
// Donnée : TAUX de croissance annuel de la population (%) par territoire.
// 0 = stable ; > 0 = l'île gagne des habitants ; < 0 = elle en perd.
// Courbe (moyenne + bande robuste 10e–90e centile + référence 0),
// carte 3D, évolution, tableau, guide — curseur d'année partagé.
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
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import DataTable from "../../components/DataTable/DataTable";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import "./Act3Territory.scss";

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
      return { year, mean, min: pct(s, 0.1), max: pct(s, 0.9) }; // bande robuste
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
        ? { area: a, name: pictName(a, lang), value: p.value, year }
        : null;
    })
    .filter(Boolean);
}

export default function Act3Territory() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
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
  const retry = useCallback(() => {
    dispatch(loadDataset("population"));
  }, [dispatch]);

  return (
    <main className="act3">
      <div className="container">
        <header className="act3__head">
          <p className="eyebrow">{t("home.acts.a3_tag")}</p>
          <h1 className="act3__title">{t("home.acts.a3_title")}</h1>
          <p className="act3__lead">{t("act3.lead")}</p>
        </header>

        <ReadingGuide
          title={t("act3.guide.title")}
          intro={t("act3.guide.intro")}
          steps={t("act3.guide.steps")}
          takeaway={t("act3.guide.takeaway")}
        />

        {!ready && !failed && (
          <Loader fullscreen label={t("scene.loading")} />
        )}
        {failed && (
          <div className="act3__state act3__state--err">
            <span>{t("scene.error")}</span>
            <button className="act3__btn" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {ready && currentYear != null && (
          <>
            <div className="act3__timeline">
              <button className="act3__btn" onClick={togglePlay}>
                {playing ? t("act1.pause") : t("act1.play")}
              </button>
              <input
                className="act3__slider"
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
              <span className="act3__year">{currentYear}</span>
              {isDemo && (
                <span className="act3__demo">{t("act3.demo_badge")}</span>
              )}
            </div>

            {/* Courbe du taux de croissance */}
            <section className="act3__chart">
              <div className="act3__chart-head">
                <h2 className="act3__chart-title">{t("act3.pop_title")}</h2>
                <span className="act3__chart-sub">
                  {t("act3.value_label")} · {unit}
                </span>
              </div>
              <AnomalyTrend
                data={trend}
                currentYear={currentYear}
                unit={unit}
                tone="warm"
                baselineLabel={t("act3.baseline")}
                meanLabel={t("act3.mean_label")}
              />
            </section>

            {/* Carte 3D */}
            <div className="act3__sec-head">
              <h3 className="act3__sec-title">{t("act3.map_title")}</h3>
              <span className="act3__chart-sub">
                {t("act3.map_sub")} · {currentYear}
              </span>
            </div>
            <ErrorBoundary
              fallback={
                <div className="act3__state act3__state--err">
                  {t("scene.error")}
                </div>
              }
            >
              <Suspense
                fallback={
                  <Loader compact label={t("scene.loading")} />
                }
              >
                <OceanMap
                  data={points}
                  unit={unit}
                  range={robustRange}
                  lowLabel={t("act3.map_low")}
                  midLabel={t("act3.map_mid")}
                  highLabel={t("act3.map_high")}
                  noTokenMsg={t("act1.map_no_token")}
                />
              </Suspense>
            </ErrorBoundary>

            {/* Évolution */}
            <div className="act3__sec-head">
              <h3 className="act3__sec-title">{t("act3.evo_title")}</h3>
              <span className="act3__chart-sub">{t("act3.evo_sub")}</span>
            </div>
            <EvolutionPanel
              series={series}
              labels={evoLabels}
              unit={unit}
              mode="absolute"
              topN={5}
            />

            {/* Tableau */}
            <div className="act3__sec-head">
              <h3 className="act3__sec-title">{t("act3.table_title")}</h3>
              <span className="act3__chart-sub">
                {t("act3.table_sub")} · {currentYear}
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

        <Link to="/" className="act3__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}