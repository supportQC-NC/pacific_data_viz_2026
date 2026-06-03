// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Le paradoxe. 100 % donnees reelles (Pacific Data Hub).
// Repere = MEDIANE Pacifique (robuste). FILTRE par sous-region qui pilote
// toutes les vues par territoire. Couleur semantique vs mediane.
// - Encart "part infime" + histogramme "part par pays" : World Bank Data360
//   / OWID (OWID_CB, CC BY 4.0), une seule requete.
// - Nuage paradoxe : SELECTEUR d'axe vertical (montee des eaux / temperature
//   / population touchee), defaut = metrique qui varie le plus.
// - Chaque visuel est encadre par VizFrame (plein ecran) ; les visuels
//   pilotes par l'annee ont aussi un player. Plus de timeline globale ;
//   le telechargement PDF/Excel est mis en avant.
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
import {
  fetchCountryCO2Shares,
  fetchWorldPerCapita,
  pacificShareFromRows,
  PICT_ISO3,
} from "../../services/data360Api";
import { countryName } from "../../data/countryNames";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import RankBars from "../../components/RankBars/RankBars";
import TrendLines from "../../components/TrendLines/TrendLines";
import ChangeBars from "../../components/ChangeBars/ChangeBars";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import ParadoxScatter from "../../components/ParadoxScatter/ParadoxScatter";
import ParadoxShare from "../../components/ParadoxShare/ParadoxShare";
import CountryShareBars from "../../components/CountryShareBars/CountryShareBars";
import KpiRow from "../../components/KpiRow/KpiRow";
import kpiLabels from "../../i18n/kpiLabels";
import DataTable from "../../components/DataTable/DataTable";
import ExportBar from "../../components/ExportBar/ExportBar";
import VizFrame from "../../components/VizFrame/VizFrame";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
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
  const [shares, setShares] = useState(null);
  const [worldPC, setWorldPC] = useState(null);

  useEffect(() => {
    dispatch(loadDataset("emissions"));
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
    dispatch(loadDataset("disastersAffected"));
  }, [dispatch]);

  useEffect(() => {
    let alive = true;
    fetchCountryCO2Shares().then((r) => {
      if (alive) setShares(r);
    });
    fetchWorldPerCapita().then((r) => {
      if (alive) setWorldPC(r);
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
        values: series
          .filter((p) => Number.isFinite(p.value) && p.value > 0)
          .sort((a, b) => a.year - b.year),
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

  // Metriques "subies" pour le selecteur d'axe vertical du nuage.
  const scatterMetrics = useMemo(() => {
    const entries = { seaLevel, sst, disastersAffected: disasters };
    const meta = {
      seaLevel: { label: t("act1.scatter.y_sea"), unit: t("act1.scatter.u_sea") },
      sst: { label: t("act1.scatter.y_sst"), unit: t("act1.scatter.u_sst") },
      disastersAffected: {
        label: t("act1.scatter.y_dis"),
        unit: t("act1.scatter.u_dis"),
      },
    };
    return IMPACT_CANDIDATES.map((id) => {
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
      return { id, label: meta[id].label, unit: meta[id].unit, rows };
    }).filter((m) => m.rows.length >= 3);
  }, [seaLevel, sst, disasters, emLast, lang, t, areaVisible]);

  // Part par pays (Data360 / OWID) -> histogramme + somme Pacifique.
  const shareByIso = useMemo(() => {
    const m = {};
    if (shares) shares.rows.forEach((r) => { m[r.iso3] = r.share; });
    return m;
  }, [shares]);

  // Comparaison : chaque ligne porte perCapita (NOS donnees pour le Pacifique,
  // OWID pour les grands emetteurs) ET share (% mondial OWID, pour tous).
  // Le composant bascule entre les deux via un switch.
  const comparisonRows = useMemo(() => {
    const out = allPoints.map((p) => {
      const iso3 = PICT_ISO3[p.area] || p.area;
      return {
        iso3,
        name: p.name,
        pacific: true,
        perCapita: p.value,
        share: iso3 in shareByIso ? shareByIso[iso3] : null,
      };
    });
    if (worldPC) {
      worldPC.rows.forEach((r) => {
        out.push({
          iso3: r.iso3,
          name: countryName(r.iso3, lang),
          pacific: false,
          perCapita: r.value,
          share: r.iso3 in shareByIso ? shareByIso[r.iso3] : null,
        });
      });
    }
    return out;
  }, [allPoints, worldPC, shareByIso, lang]);

  const pacShare = useMemo(
    () => (shares ? pacificShareFromRows(shares.rows) : null),
    [shares],
  );

  // KPI : donnees officielles par habitant (table PDH) + 1 KPI mondial
  // (part du Pacifique dans le CO2 mondial) pour la COMPARAISON.
  const kpi = kpiLabels[lang] || kpiLabels.fr;
  const kpiItems = useMemo(() => {
    if (!stats) return [];
    const med = stats.med;
    const times = med > 0 ? Math.round(stats.hi.value / med) : null;
    return [
      {
        key: "median",
        value: med.toFixed(1),
        unit: t("act1.unit"),
        label: t("act1.stats.median"),
        tone: "accent",
      },
      {
        key: "high",
        value: stats.hi.value,
        unit: stats.hi.area,
        label: t("act1.stats.highest"),
        note: times ? `${times} ${kpi.timesMedian}` : null,
        tone: "warm",
      },
      {
        key: "low",
        value: stats.lo.value,
        unit: stats.lo.area,
        label: t("act1.stats.lowest"),
        tone: "positive",
      },
      {
        key: "world",
        value:
          pacShare != null ? pacShare.toFixed(pacShare < 0.1 ? 3 : 2) : "\u2014",
        unit: pacShare != null ? "%" : kpi.unavailable,
        label: kpi.worldShare,
        note: kpi.worldOf,
        tone: "compare",
      },
    ];
  }, [stats, pacShare, t, kpi]);

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
          <Loader fullscreen label={t("scene.loading")} />
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
            {kpiItems.length > 0 && (
              <KpiRow items={kpiItems} title={t("act1.stats.title")} />
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

            <div className="act1__downloads">
              <span className="act1__downloads-lbl">{t("export.title")}</span>
              <ExportBar
                targetRef={chartRef}
                rows={exportRows}
                meta={exportMeta}
                labels={exportLabels}
              />
            </div>

            <div ref={chartRef}>
              <VizFrame
                title={t("act1.chart_title")}
                subtitle={`${t("act1.chart_sub")}${source ? ` · ${t(`act1.src_${source}`)}` : ""}`}
                years={years}
                yearIndex={yearIdx}
                playing={playing}
                onTogglePlay={togglePlay}
                onScrub={scrubYear}
              >
                <RankBars
                  data={points}
                  unit={t("act1.unit")}
                  worldAvg={pacRef}
                  refLabel={t("act1.pac_ref")}
                  betterWhen="low"
                />
              </VizFrame>
            </div>

            {stats?.outliers?.length > 0 && (
              <p className="act1__outliers">
                <strong>{stats.outliers.map((o) => o.name).join(", ")}</strong>{" "}
                {t("act1.outlier_note")}
              </p>
            )}

            <VizFrame
              title={t("act1.viz_trend_title")}
              subtitle={t("act1.viz_trend_sub")}
              years={years}
              yearIndex={yearIdx}
              playing={playing}
              onTogglePlay={togglePlay}
              onScrub={scrubYear}
            >
              <TrendLines
                series={trends}
                years={years}
                currentYear={currentYear}
                unit={t("act1.unit")}
              />
            </VizFrame>

            <VizFrame title={t("act1.heatmap.title")} subtitle={t("act1.heatmap.sub")}>
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
            </VizFrame>

            <VizFrame
              title={t("act1.subregion.title")}
              subtitle={t("act1.subregion.sub")}
              years={years}
              yearIndex={yearIdx}
              playing={playing}
              onTogglePlay={togglePlay}
              onScrub={scrubYear}
            >
              <TrendLines
                series={subregionSeries}
                years={years}
                currentYear={currentYear}
                unit={t("act1.unit")}
              />
            </VizFrame>

            <VizFrame
              title={`${t("act1.change.title")} ${firstYear ?? ""}`}
              subtitle={t("act1.change.sub")}
            >
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
            </VizFrame>

            <ParadoxShare
              share={pacShare}
              year={shares ? shares.year : null}
              loading={!shares}
              approx={shares ? shares.source === "fallback" : false}
            />

            <VizFrame>
              <CountryShareBars
                rows={comparisonRows}
                year={currentYear}
                loading={comparisonRows.length === 0}
              />
            </VizFrame>

            <VizFrame title={t("act1.scatter.title")} subtitle={t("act1.scatter.sub")}>
              <ParadoxScatter
                metrics={scatterMetrics}
                xLabel={t("act1.scatter.x")}
                xUnit={t("act1.unit")}
                xLog
                medianX={pacRef}
                labels={{
                  empty: t("act1.scatter.empty"),
                  hint: t("act1.pac_ref"),
                  paradox: t("act1.scatter.paradox"),
                }}
              />
            </VizFrame>

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
                  <Loader compact label={t("scene.loading")} />
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