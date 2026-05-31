// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Le paradoxe (émissions de GES par habitant).
// Données via Redux. Viz : beeswarm d3 ANIMÉ dans le temps
// (curseur d'années + lecture) + ligne "moyenne mondiale".
// Export PDF / Excel via <ExportBar>.
//
// FIX boucle de rendu : les props passées à <ExportBar> (rows / meta /
// labels) sont MÉMOÏSÉES → références stables → plus de re-render infini.
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
import BeeswarmChart from "../../components/BeeswarmChart/BeeswarmChart";
import ExportBar from "../../components/ExportBar/ExportBar";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./Act1Emissions.scss";

// Carte chargée à la demande : mapbox-gl (lourd) n'alourdit pas le 1er rendu.
const PacificMap = lazy(() => import("../../components/PacificMap/PacificMap"));

const WORLD_AVG = 4.76; // t CO2e / hab — moyenne mondiale (EDGAR)

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

  // Cale l'année par défaut sur la plus récente une fois les données chargées.
  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);

  // Lecture automatique dans le temps.
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

  // Points du beeswarm pour l'année sélectionnée.
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

  // ----- Props MÉMOÏSÉES pour <ExportBar> (références stables) -----
  const exportRows = useMemo(
    () => points.map((p) => ({ name: p.name, value: p.value, year: p.year })),
    [points],
  );
  const exportMeta = useMemo(
    () => ({
      title: t("act1.chart_title"),
      subtitle: `${t("act1.chart_sub")} · ${currentYear ?? ""}`,
      source: t("act1.caption"),
      filename: `emissions_pacifique_${currentYear ?? ""}`,
      sheet: "Emissions",
    }),
    [t, currentYear],
  );
  const exportLabels = useMemo(
    () => ({
      title: t("export.title"),
      pdf: t("export.pdf"),
      excel: t("export.excel"),
      col_name: t("export.col_name"),
      col_value: t("export.col_value"),
      col_year: t("export.col_year"),
    }),
    [t],
  );
  // ------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i)); // relance depuis le début si à la fin
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
              {/* Curseur temporel */}
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

              {/* Cible capturée pour l'export */}
              <div ref={chartRef} className="act1__capture">
                <BeeswarmChart
                  data={points}
                  worldAvg={WORLD_AVG}
                  unit={t("act1.unit")}
                  refLabel={t("act1.world_avg")}
                  scaleLabels={{
                    linear: t("act1.scale_linear"),
                    log: t("act1.scale_log"),
                  }}
                />
              </div>

              {/* Carte Mapbox : où se situent les territoires (isolée + lazy) */}
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
