// src/pages/Act2Ocean/Act2Ocean.jsx
// ============================================================
// Acte 02 — L'océan. « La mer change. »
// Niveau de la mer + température de surface, sur un curseur partagé.
// Les deux courbes sont EMPILÉES par défaut (lisibles pleine largeur),
// avec bascule « côte à côte » et bouton « agrandir » par graphe.
// + carte 3D divergente, écart par territoire (ChangeBars), évolution,
//   tableau. 100 % données réelles (live ou snapshot).
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
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import ChangeBars from "../../components/ChangeBars/ChangeBars";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import DataTable from "../../components/DataTable/DataTable";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import "./Act2Ocean.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

const clampYear = (d, year) =>
  d ? Math.min(d.lastYear, Math.max(d.firstYear, year)) : year;

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
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      return { year, mean, min: Math.min(...vals), max: Math.max(...vals) };
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

export default function Act2Ocean() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const sea = useSelector(selectDataset("seaLevel"));
  const sst = useSelector(selectDataset("sst"));

  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [metric, setMetric] = useState("sst");
  const [pairLayout, setPairLayout] = useState("stacked"); // "stacked" | "cols"

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const ready = sea.status === "succeeded" && sst.status === "succeeded";
  const failed = sea.status === "failed" || sst.status === "failed";
  const source = ready && sea.data ? sea.data.source : null;

  const masterYears = useMemo(() => {
    const set = new Set([...(sea.data?.years || []), ...(sst.data?.years || [])]);
    return [...set].sort((a, b) => a - b);
  }, [sea.data, sst.data]);

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
    }, 700);
    return () => clearInterval(id);
  }, [playing, masterYears]);

  const currentYear =
    masterYears.length && yearIdx != null ? masterYears[yearIdx] : null;

  const seaMean = useMemo(() => meanSeries(sea.data), [sea.data]);
  const sstMean = useMemo(() => meanSeries(sst.data), [sst.data]);
  const seaAll = useMemo(() => allSeries(sea.data, lang), [sea.data, lang]);
  const sstAll = useMemo(() => allSeries(sst.data, lang), [sst.data, lang]);

  const selDs = metric === "sst" ? sst : sea;
  const selData = selDs.data;
  const selUnit = metric === "sst" ? t("act2.sst_unit") : t("act2.sea_unit");
  const selAll = metric === "sst" ? sstAll : seaAll;
  const selYear = currentYear != null ? clampYear(selData, currentYear) : null;

  const selPoints = useMemo(
    () => (selData && selYear != null ? pointsAt(selData, selYear, lang) : []),
    [selData, selYear, lang],
  );
  const selRegionalMean = useMemo(() => {
    if (!selPoints.length) return 0;
    return selPoints.reduce((s, p) => s + p.value, 0) / selPoints.length;
  }, [selPoints]);

  // Écart à la référence par territoire (année courante) — barres divergentes.
  const anomalyRows = useMemo(
    () =>
      selPoints.map((p) => ({
        area: p.area,
        name: p.name,
        delta: p.value,
        first: 0,
        last: p.value,
      })),
    [selPoints],
  );

  const tableLabels = useMemo(
    () => ({
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: `${t("act2.value_label")} (${selUnit})`,
      col_vs_world: t("act2.vs_mean"),
    }),
    [t, selUnit],
  );
  const evoLabels = useMemo(
    () => ({
      improved: t("act2.evo_down"),
      worsened: t("act2.evo_up"),
      since: t("act1.evo.since"),
      no_data: t("act1.evo.no_data"),
    }),
    [t],
  );

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === masterYears.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [masterYears.length]);

  const retry = useCallback(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };

  return (
    <main className="act2">
      <div className="container">
        <header className="act2__head">
          <p className="eyebrow">{t("home.acts.a2_tag")}</p>
          <h1 className="act2__title">{t("home.acts.a2_title")}</h1>
          <p className="act2__lead">{t("act2.lead")}</p>
        </header>

        <ReadingGuide
          title={t("act2.guide.title")}
          intro={t("act2.guide.intro")}
          steps={t("act2.guide.steps")}
          takeaway={t("act2.guide.takeaway")}
        />

        {!ready && !failed && <Loader fullscreen label={t("scene.loading")} />}
        {failed && (
          <div className="act2__state act2__state--err">
            <span>{t("scene.error")}</span>
            <button className="act2__btn" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {ready && currentYear != null && (
          <>
            {/* Curseur partagé + source */}
            <div className="act2__timeline">
              <button className="act2__btn" onClick={togglePlay}>
                {playing ? t("act1.pause") : t("act1.play")}
              </button>
              <input
                className="act2__slider"
                type="range"
                min={0}
                max={masterYears.length - 1}
                value={yearIdx ?? 0}
                onChange={(e) => {
                  setPlaying(false);
                  setYearIdx(Number(e.target.value));
                }}
                aria-label={t("act1.year")}
              />
              <span className="act2__year">{currentYear}</span>
              {source && <span className="act2__source">{t(`act1.src_${source}`)}</span>}
            </div>

            {/* Disposition des deux courbes */}
            <div className="act2__layout" role="group" aria-label={t("act2.layout_label")}>
              <span className="act2__layout-lbl">{t("act2.layout_label")}</span>
              <div className="act2__layout-pills">
                <button
                  className={`act2__pill ${pairLayout === "stacked" ? "is-active" : ""}`}
                  onClick={() => setPairLayout("stacked")}
                  aria-pressed={pairLayout === "stacked"}
                >
                  {t("act2.layout_stacked")}
                </button>
                <button
                  className={`act2__pill ${pairLayout === "cols" ? "is-active" : ""}`}
                  onClick={() => setPairLayout("cols")}
                  aria-pressed={pairLayout === "cols"}
                >
                  {t("act2.layout_cols")}
                </button>
              </div>
            </div>

            {/* Les deux courbes — empilées par défaut, agrandissables */}
            <div className={`act2__charts act2__charts--${pairLayout}`}>
              <ExpandableCard
                title={t("act2.sea_title")}
                sub={`${t("act2.sea_sub")} · ${t("act2.sea_unit")}`}
                {...xc}
              >
                <AnomalyTrend
                  data={seaMean}
                  currentYear={currentYear != null ? clampYear(sea.data, currentYear) : null}
                  unit={t("act2.sea_unit")}
                  tone="sea"
                  baselineLabel={t("act2.baseline")}
                  meanLabel={t("act2.mean_label")}
                  bandLabel={t("act2.band_label")}
                />
              </ExpandableCard>

              <ExpandableCard
                title={t("act2.sst_title")}
                sub={`${t("act2.sst_sub")} · ${t("act2.sst_unit")}`}
                {...xc}
              >
                <AnomalyTrend
                  data={sstMean}
                  currentYear={currentYear != null ? clampYear(sst.data, currentYear) : null}
                  unit={t("act2.sst_unit")}
                  tone="warm"
                  baselineLabel={t("act2.baseline")}
                  meanLabel={t("act2.mean_label")}
                  bandLabel={t("act2.band_label")}
                />
              </ExpandableCard>
            </div>

            {/* Sélecteur de métrique pour les vues par territoire */}
            <div className="act2__metric">
              <span className="act2__metric-label">{t("act2.explore")}</span>
              <div className="act2__toggle">
                <button
                  className={`act2__toggle-btn ${metric === "sst" ? "is-on" : ""}`}
                  onClick={() => setMetric("sst")}
                >
                  {t("act2.sst_title")}
                </button>
                <button
                  className={`act2__toggle-btn ${metric === "seaLevel" ? "is-on" : ""}`}
                  onClick={() => setMetric("seaLevel")}
                >
                  {t("act2.sea_title")}
                </button>
              </div>
            </div>

            {/* Écart à la référence par territoire (divergent) */}
            <ExpandableCard
              title={t("act2.anom_title")}
              sub={`${t("act2.anom_sub")} · ${selYear}`}
              {...xc}
            >
              <ChangeBars
                rows={anomalyRows}
                unit={selUnit}
                labels={{
                  up: t("act2.anom_up"),
                  down: t("act2.anom_down"),
                  empty: t("act1.change.empty"),
                }}
              />
            </ExpandableCard>

            {/* Carte satellite divergente (pleine largeur) */}
            <div className="act2__map-head">
              <h3 className="act2__map-title">{t("act2.map_title")}</h3>
              <span className="act2__chart-sub">
                {t("act2.map_sub")} · {selYear}
              </span>
            </div>
            <ErrorBoundary
              fallback={<div className="act2__state act2__state--err">{t("scene.error")}</div>}
            >
              <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                <OceanMap
                  data={selPoints}
                  unit={selUnit}
                  range={selData ? selData.range : null}
                  lowLabel={t("act2.map_low")}
                  midLabel={t("act2.map_mid")}
                  highLabel={t("act2.map_high")}
                  noTokenMsg={t("act1.map_no_token")}
                />
              </Suspense>
            </ErrorBoundary>

            {/* Évolution */}
            <div className="act2__map-head">
              <h3 className="act2__map-title">{t("act2.evo_title")}</h3>
              <span className="act2__chart-sub">{t("act2.evo_sub")}</span>
            </div>
            <EvolutionPanel series={selAll} labels={evoLabels} unit={selUnit} mode="absolute" topN={5} />

            {/* Tableau */}
            <div className="act2__map-head">
              <h3 className="act2__map-title">{t("act2.table_title")}</h3>
              <span className="act2__chart-sub">
                {t("act2.table_sub")} · {selYear}
              </span>
            </div>
            <DataTable rows={selPoints} labels={tableLabels} unit={selUnit} refValue={selRegionalMean} />
          </>
        )}

        <Link to="/" className="act2__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}