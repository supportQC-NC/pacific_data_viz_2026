// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Le paradoxe. 100 % donnees reelles (Pacific Data Hub).
// Repere = MEDIANE Pacifique (robuste). 17 territoires conserves ;
// FILTRE par sous-region qui pilote toutes les vues par territoire.
// Couleur semantique : emissions = jugement vs mediane (vert sous, rouge
// au-dessus), y compris sur le globe Mapbox. Guide enrichi « Source & methode ».
// Encart « part infime » : part du Pacifique dans les emissions mondiales
// de CO2 (World Bank Data360 / OWID, CC BY 4.0).
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
import { getDatasetSource } from "../../data/datasetSources";
import sourceLabels from "../../i18n/sourceLabels";
import { fetchPacificCO2Share } from "../../services/data360Api";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import RankBars from "../../components/RankBars/RankBars";
import TrendLines from "../../components/TrendLines/TrendLines";
import ChangeBars from "../../components/ChangeBars/ChangeBars";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import ParadoxScatter from "../../components/ParadoxScatter/ParadoxScatter";
import ParadoxShare from "../../components/ParadoxShare/ParadoxShare";
import DataTable from "../../components/DataTable/DataTable";
import ExportBar from "../../components/ExportBar/ExportBar";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./Act1Emissions.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

const TREND_TOP = 7;
const IMPACT_CANDIDATES = ["seaLevel", "sst", "disastersAffected"];

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

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function latestByArea(entry) {
  if (!entry || entry.status !== "succeeded" || !entry.data) return {};
  const out = {};
  Object.entries(entry.data.byArea).forEach(([area, serie]) => {
    if (!isPict(area)) return;
    const last = serie[serie.length - 1];
    if (last && Number.isFinite(last.value)) out[area] = last.value;
  });
  return out;
}

export default function Act1Emissions() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const chartRef = useRef(null);

  const emissions = useSelector(selectDataset("emissions"));
  const seaLevel = useSelector(selectDataset("seaLevel"));
  const sst = useSelector(selectDataset("sst"));
  const disasters = useSelector(selectDataset("disastersAffected"));

  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [region, setRegion] = useState("all");
  const [worldShare, setWorldShare] = useState(null);

  useEffect(() => {
    dispatch(loadDataset("emissions"));
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
    dispatch(loadDataset("disastersAffected"));
  }, [dispatch]);

  useEffect(() => {
    let alive = true;
    fetchPacificCO2Share().then((r) => {
      if (alive) setWorldShare(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ready = emissions.status === "succeeded";
  const failed = emissions.status === "failed";
  const source = ready && emissions.data ? emissions.data.source : null;

  const years = ready && emissions.data ? emissions.data.years : [];
  const empty = ready && years.length === 0;
  const firstYear = years[0] ?? null;

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
  const areaVisible = useCallback(
    (a) => region === "all" || REGION_OF[a] === region,
    [region],
  );

  const allPoints = useMemo(() => {
    if (!ready || !emissions.data || currentYear == null) return [];
    return Object.entries(emissions.data.byArea)
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

  const points = useMemo(
    () => allPoints.filter((p) => areaVisible(p.area)),
    [allPoints, areaVisible],
  );

  const allSeries = useMemo(() => {
    if (!ready || !emissions.data) return [];
    return Object.entries(emissions.data.byArea)
      .filter(([area]) => isPict(area))
      .map(([area, series]) => ({
        area,
        code: area,
        name: pictName(area, lang),
        values: series.filter((p) => Number.isFinite(p.value) && p.value > 0),
      }));
  }, [ready, emissions.data, lang]);

  const vSeries = useMemo(
    () => allSeries.filter((s) => areaVisible(s.area)),
    [allSeries, areaVisible],
  );

  const trends = useMemo(() => {
    if (!vSeries.length || !years.length) return [];
    const latest = years[years.length - 1];
    return [...vSeries]
      .map((s) => {
        const lp =
          s.values.find((p) => p.year === latest) ||
          s.values[s.values.length - 1];
        return { ...s, latest: lp ? lp.value : 0 };
      })
      .filter((s) => s.values.length > 1)
      .sort((a, b) => b.latest - a.latest)
      .slice(0, TREND_TOP);
  }, [vSeries, years]);

  const subregionSeries = useMemo(() => {
    if (!allSeries.length || !years.length) return [];
    const names = {
      melanesia: t("act1.filter.melanesia"),
      polynesia: t("act1.filter.polynesia"),
      micronesia: t("act1.filter.micronesia"),
    };
    return Object.keys(SUBREGIONS).map((reg) => {
      const members = allSeries.filter((s) => REGION_OF[s.area] === reg);
      const values = years
        .map((y) => {
          const vs = members
            .map((s) => s.values.find((p) => p.year === y)?.value)
            .filter((v) => Number.isFinite(v));
          return vs.length
            ? { year: y, value: vs.reduce((a, b) => a + b, 0) / vs.length }
            : null;
        })
        .filter(Boolean);
      return { area: reg, name: names[reg], values };
    });
  }, [allSeries, years, t]);

  const changeRows = useMemo(
    () =>
      vSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => {
          const f = s.values[0];
          const l = s.values[s.values.length - 1];
          return {
            area: s.area,
            name: s.name,
            delta: l.value - f.value,
            first: f.value,
            last: l.value,
          };
        }),
    [vSeries],
  );

  const stats = useMemo(() => {
    const vals = points.map((p) => p.value);
    if (!vals.length) return null;
    const med = median(vals);
    const sorted = [...points].sort((a, b) => a.value - b.value);
    return {
      count: points.length,
      med,
      lo: sorted[0],
      hi: sorted[sorted.length - 1],
      outliers: points
        .filter((p) => p.value > med * 3)
        .sort((a, b) => b.value - a.value),
    };
  }, [points]);
  const pacRef = stats?.med ?? 0;

  const mapRange = useMemo(() => {
    if (!points.length) return { min: 0, max: 1 };
    const vals = points.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [points]);

  const emLast = useMemo(() => latestByArea(emissions), [emissions]);
  const impact = useMemo(() => {
    const entries = { seaLevel, sst, disastersAffected: disasters };
    const meta = {
      seaLevel: { y: t("act1.scatter.y_sea"), unit: t("act1.scatter.u_sea") },
      sst: { y: t("act1.scatter.y_sst"), unit: t("act1.scatter.u_sst") },
      disastersAffected: {
        y: t("act1.scatter.y_dis"),
        unit: t("act1.scatter.u_dis"),
      },
    };
    let best = null;
    IMPACT_CANDIDATES.forEach((id) => {
      const last = latestByArea(entries[id]);
      const rows = Object.keys(emLast)
        .filter(
          (a) =>
            areaVisible(a) &&
            Number.isFinite(emLast[a]) &&
            Number.isFinite(last[a]),
        )
        .map((a) => ({
          area: a,
          name: pictName(a, lang),
          x: emLast[a],
          y: last[a],
        }));
      if (rows.length >= 3 && (!best || rows.length > best.rows.length)) {
        best = { id, rows, ...meta[id] };
      }
    });
    return best;
  }, [emissions, seaLevel, sst, disasters, emLast, lang, t, areaVisible]);

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
  const exportLabels = useMemo(
    () => ({
      title: t("export.title"),
      pdf: t("export.pdf"),
      excel: t("export.excel"),
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: t("export.col_value"),
      col_vs_world: t("act1.vs_ref"),
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
      summary_world: t("act1.pac_ref"),
      summary_source: t("export.summary_source"),
      summary_generated: t("export.summary_generated"),
    }),
    [t],
  );
  const exportMeta = useMemo(
    () => ({
      title: t("act1.chart_title"),
      subtitle: `${t("act1.chart_sub")} · ${currentYear ?? ""}`,
      source: t("act1.caption"),
      filename: `emissions_pacifique_${currentYear ?? ""}`,
      sheet: "Emissions",
      unit: t("act1.unit"),
      refValue: pacRef,
      refLabel: t("act1.pac_ref"),
      year: currentYear ?? "",
      series: vSeries,
      years,
      worldByYear: {},
    }),
    [t, currentYear, pacRef, vSeries, years],
  );

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);

  const retry = useCallback(
    () => dispatch(loadDataset("emissions")),
    [dispatch],
  );

  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);

  const guideSource = useMemo(
    () => getDatasetSource("emissions", lang),
    [lang],
  );

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
          source={guideSource}
          sourceLabels={sourceLabels[lang] || sourceLabels.fr}
        />

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
            {stats && (
              <section
                className="act1__stats"
                aria-label={t("act1.stats.title")}
              >
                <div className="act1__stat">
                  <span className="act1__stat-num">{stats.count}</span>
                  <span className="act1__stat-lbl">
                    {t("act1.stats.count")}
                  </span>
                </div>
                <div className="act1__stat">
                  <span className="act1__stat-num">
                    {stats.med.toFixed(1)}
                    <em>{t("act1.unit")}</em>
                  </span>
                  <span className="act1__stat-lbl">
                    {t("act1.stats.median")}
                  </span>
                </div>
                <div className="act1__stat">
                  <span className="act1__stat-num">
                    {stats.lo.value}
                    <em>{stats.lo.area}</em>
                  </span>
                  <span className="act1__stat-lbl">
                    {t("act1.stats.lowest")}
                  </span>
                </div>
                <div className="act1__stat act1__stat--warm">
                  <span className="act1__stat-num">
                    {stats.hi.value}
                    <em>{stats.hi.area}</em>
                  </span>
                  <span className="act1__stat-lbl">
                    {t("act1.stats.highest")}
                  </span>
                </div>
              </section>
            )}

            <div
              className="act1__filter"
              role="group"
              aria-label={t("act1.filter.title")}
            >
              <span className="act1__filter-lbl">{t("act1.filter.title")}</span>
              <div className="act1__filter-pills">
                {REGION_KEYS.map((k) => (
                  <button
                    key={k}
                    className={`act1__pill ${region === k ? "is-active" : ""}`}
                    onClick={() => setRegion(k)}
                    aria-pressed={region === k}
                  >
                    {t(`act1.filter.${k}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="act1__chart-head">
              <div>
                <h2 className="act1__chart-title">{t("act1.chart_title")}</h2>
                <span className="act1__chart-sub">
                  {t("act1.chart_sub")}
                  {source ? ` · ${t(`act1.src_${source}`)}` : ""}
                </span>
              </div>
              <ExportBar
                targetRef={chartRef}
                rows={exportRows}
                meta={exportMeta}
                labels={exportLabels}
              />
            </div>

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
              <RankBars
                data={points}
                unit={t("act1.unit")}
                worldAvg={pacRef}
                refLabel={t("act1.pac_ref")}
                betterWhen="low"
              />
            </div>

            {stats?.outliers?.length > 0 && (
              <p className="act1__outliers">
                <strong>{stats.outliers.map((o) => o.name).join(", ")}</strong>{" "}
                {t("act1.outlier_note")}
              </p>
            )}

            <div className="act1__map-head">
              <h3 className="act1__map-title">{t("act1.viz_trend_title")}</h3>
              <span className="act1__chart-sub">{t("act1.viz_trend_sub")}</span>
            </div>
            <TrendLines
              series={trends}
              years={years}
              currentYear={currentYear}
              unit={t("act1.unit")}
            />

            <div className="act1__map-head">
              <h3 className="act1__map-title">{t("act1.heatmap.title")}</h3>
              <span className="act1__chart-sub">{t("act1.heatmap.sub")}</span>
            </div>
            <EmissionsHeatmap
              series={vSeries}
              years={years}
              unit={t("act1.unit")}
              labels={{
                low: t("act1.heatmap.low"),
                high: t("act1.heatmap.high"),
                empty: t("act1.change.empty"),
              }}
            />

            <div className="act1__map-head">
              <h3 className="act1__map-title">{t("act1.subregion.title")}</h3>
              <span className="act1__chart-sub">{t("act1.subregion.sub")}</span>
            </div>
            <TrendLines
              series={subregionSeries}
              years={years}
              currentYear={currentYear}
              unit={t("act1.unit")}
            />

            <div className="act1__map-head">
              <h3 className="act1__map-title">
                {t("act1.change.title")} {firstYear ?? ""}
              </h3>
              <span className="act1__chart-sub">{t("act1.change.sub")}</span>
            </div>
            <ChangeBars
              rows={changeRows}
              unit={t("act1.unit")}
              betterWhen="low"
              labels={{
                up: t("act1.change.up"),
                down: t("act1.change.down"),
                empty: t("act1.change.empty"),
              }}
            />

            <ParadoxShare
              share={worldShare ? worldShare.share : null}
              year={worldShare ? worldShare.year : null}
              loading={!worldShare}
              approx={worldShare ? worldShare.source === "fallback" : false}
            />

            <div className="act1__map-head">
              <h3 className="act1__map-title">{t("act1.scatter.title")}</h3>
              <span className="act1__chart-sub">{t("act1.scatter.sub")}</span>
            </div>
            <ParadoxScatter
              rows={impact ? impact.rows : []}
              xLabel={t("act1.scatter.x")}
              yLabel={impact ? impact.y : t("act1.scatter.y_sea")}
              xUnit={t("act1.unit")}
              yUnit={impact ? impact.unit : ""}
              xLog
              medianX={pacRef}
              labels={{
                empty: t("act1.scatter.empty"),
                hint: t("act1.pac_ref"),
                paradox: t("act1.scatter.paradox"),
              }}
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
                <OceanMap
                  data={points}
                  unit={t("act1.unit")}
                  range={mapRange}
                  logScale
                  ramp="semantic"
                  mid={pacRef}
                  lowLabel={t("act1.map_low")}
                  midLabel={t("act1.pac_ref")}
                  highLabel={t("act1.map_high")}
                  noTokenMsg={t("act1.map_no_token")}
                  years={years}
                  yearIndex={yearIdx}
                  playing={playing}
                  onTogglePlay={togglePlay}
                  onScrub={scrubYear}
                />
              </Suspense>
            </ErrorBoundary>

            <div className="act1__map-head">
              <h3 className="act1__map-title">{t("act1.table.title")}</h3>
              <span className="act1__chart-sub">{t("act1.table.sub")}</span>
            </div>
            <DataTable
              rows={exportRows}
              labels={exportLabels}
              unit={t("act1.unit")}
              refValue={pacRef}
            />

            <p className="act1__paradox">{t("act1.paradox")}</p>
            <p className="act1__caption">{t("act1.caption")}</p>
          </>
        )}

        <Link to="/" className="act1__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}