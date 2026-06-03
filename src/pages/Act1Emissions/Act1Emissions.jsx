// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Les émissions du Pacifique (Pacific Data Hub / SPC).
// Page de COMPOSITION : sélectionne la donnée (filtres par graphique) et
// compose des composants de graphiques réutilisables (src/components/charts).
// Aucune option ECharts ici — chaque composant construit la sienne et se
// thématise tout seul. 100 % PDH, aucun téléchargement, aucun tableau.
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
import useThemeTokens from "../../hooks/UseThemeTokens";
import KpiRow from "../../components/KpiRow/KpiRow";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import BarRace from "../../components/BarRace/BarRace";
import RankChart from "../../components/charts/RankChart";
import TrendChart from "../../components/charts/TrendChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import BoxplotChart from "../../components/charts/BoxplotChart";
import RiverChart from "../../components/charts/RiverChart";
import RadarChart from "../../components/charts/RadarChart";
import SunburstChart from "../../components/charts/SunburstChart";
import ScatterChart from "../../components/charts/ScatterChart";
import ChangeChart from "../../components/charts/ChangeChart";
import { median, fmt, valAt, paletteOf } from "../../components/charts/echartsBase";
import "./Act1Emissions.scss";

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

/* ---------- Contrôles de filtre réutilisables ---------- */
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

export default function Act1Emissions() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  const emissions = useSelector(selectDataset("emissions"));

  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Filtres propres à chaque graphique.
  const [regionRank, setRegionRank] = useState("all");
  const [sortRank, setSortRank] = useState("desc");
  const [scaleRank, setScaleRank] = useState("lin");
  const [regionTrend, setRegionTrend] = useState("all");
  const [scaleTrend, setScaleTrend] = useState("lin");
  const [regionScatter, setRegionScatter] = useState("all");
  const [regionMap, setRegionMap] = useState("all");
  const [regionHeat, setRegionHeat] = useState("all");
  const [colorHeat, setColorHeat] = useState("rank");
  const [regionBox, setRegionBox] = useState("all");
  const [scaleBox, setScaleBox] = useState("lin");
  const [regionTree, setRegionTree] = useState("all");
  const [regionChange, setRegionChange] = useState("all");
  const [dirChange, setDirChange] = useState("all");
  const [regionRace, setRegionRace] = useState("all");

  useEffect(() => {
    dispatch(loadDataset("emissions"));
  }, [dispatch]);

  const ready = emissions.status === "succeeded";
  const failed = emissions.status === "failed";
  const years = ready && emissions.data ? emissions.data.years : [];
  const empty = ready && years.length === 0;
  const firstYear = years[0] ?? null;
  const lastYear = years[years.length - 1] ?? null;

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

  const allSeries = useMemo(() => {
    if (!ready || !emissions.data) return [];
    return Object.entries(emissions.data.byArea)
      .filter(([area]) => isPict(area))
      .map(([area, series]) => ({
        area,
        name: pictName(area, lang),
        values: series
          .filter((p) => Number.isFinite(p.value) && p.value > 0)
          .sort((a, b) => a.year - b.year),
      }))
      .filter((s) => s.values.length);
  }, [ready, emissions.data, lang]);

  const inRegion = useCallback(
    (area, region) => region === "all" || REGION_OF[area] === region,
    [],
  );

  const pointsFor = useCallback(
    (region, year) =>
      allSeries
        .filter((s) => inRegion(s.area, region))
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, year) }))
        .filter((p) => Number.isFinite(p.value) && p.value > 0),
    [allSeries, inRegion],
  );

  const medianAll = useMemo(
    () => median(pointsFor("all", currentYear).map((p) => p.value)) ?? 0,
    [pointsFor, currentYear],
  );

  const subNames = useMemo(
    () => ({
      melanesia: t("act1.filter.melanesia"),
      polynesia: t("act1.filter.polynesia"),
      micronesia: t("act1.filter.micronesia"),
    }),
    [t],
  );

  // Moyennes par sous-région (River + Radar).
  const subAvg = useMemo(() => {
    if (!years.length) return [];
    return Object.keys(SUBREGIONS)
      .map((reg) => {
        const members = allSeries.filter((s) => REGION_OF[s.area] === reg);
        const values = years
          .map((y) => {
            const vs = members.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
            return vs.length ? { year: y, value: vs.reduce((a, b) => a + b, 0) / vs.length } : null;
          })
          .filter(Boolean);
        return { name: subNames[reg], values };
      })
      .filter((g) => g.values.length);
  }, [allSeries, years, subNames]);

  // Hiérarchie (Sunburst).
  const sunburstGroups = useMemo(() => {
    const palette = paletteOf(tk);
    return Object.keys(SUBREGIONS).map((reg, i) => ({
      name: subNames[reg],
      color: palette[i],
      children: allSeries
        .filter((s) => REGION_OF[s.area] === reg && inRegion(s.area, regionTree))
        .map((s) => ({ name: s.name, real: valAt(s, currentYear) })),
    }));
  }, [allSeries, regionTree, currentYear, subNames, inRegion, tk]);

  // Nuage niveau × évolution (groupé par sous-région).
  const scatterGroups = useMemo(() => {
    const palette = paletteOf(tk);
    const inReg = allSeries.filter((s) => inRegion(s.area, regionScatter));
    return Object.keys(SUBREGIONS)
      .map((reg, i) => ({
        name: subNames[reg],
        color: palette[i],
        points: inReg
          .filter((s) => REGION_OF[s.area] === reg)
          .map((s) => {
            const last = valAt(s, lastYear);
            const first = valAt(s, firstYear);
            if (!Number.isFinite(last) || !Number.isFinite(first) || first <= 0) return null;
            return {
              name: s.name,
              x: Number(last.toFixed(2)),
              y: Number((((last - first) / first) * 100).toFixed(1)),
            };
          })
          .filter(Boolean),
      }))
      .filter((g) => g.points.length);
  }, [allSeries, regionScatter, lastYear, firstYear, subNames, inRegion, tk]);

  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  const changeRows = useMemo(
    () =>
      allSeries
        .filter((s) => inRegion(s.area, regionChange) && s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          delta: Number((s.values[s.values.length - 1].value - s.values[0].value).toFixed(3)),
        })),
    [allSeries, regionChange, inRegion],
  );

  // KPI (PDH).
  const kpiItems = useMemo(() => {
    const pts = pointsFor("all", currentYear);
    if (!pts.length) return [];
    const med = median(pts.map((p) => p.value));
    const sorted = [...pts].sort((a, b) => a.value - b.value);
    const medFirst = median(pointsFor("all", firstYear).map((p) => p.value));
    const medLast = median(pointsFor("all", lastYear).map((p) => p.value));
    const evo = medFirst && medFirst > 0 ? ((medLast - medFirst) / medFirst) * 100 : null;
    return [
      { key: "median", value: fmt(med, 1), unit: t("act1.unit"), label: t("act1.stats.median"), tone: "accent" },
      { key: "high", value: fmt(sorted[sorted.length - 1].value, 1), unit: sorted[sorted.length - 1].name, label: t("act1.stats.highest"), tone: "warm" },
      { key: "low", value: fmt(sorted[0].value, 1), unit: sorted[0].name, label: t("act1.stats.lowest"), tone: "positive" },
      {
        key: "evo",
        value: evo == null ? "—" : `${evo > 0 ? "+" : ""}${evo.toFixed(0)}%`,
        unit: firstYear ? `${t("act1.kpi.since")} ${firstYear}` : "",
        label: t("act1.kpi.evolution"),
        tone: evo != null && evo <= 0 ? "positive" : "warm",
      },
    ];
  }, [pointsFor, currentYear, firstYear, lastYear, t]);

  const mapPoints = useMemo(
    () => pointsFor(regionMap, currentYear).map((p) => ({ ...p, year: currentYear })),
    [pointsFor, regionMap, currentYear],
  );
  const mapRange = useMemo(() => {
    if (!mapPoints.length) return { min: 0, max: 1 };
    const vals = mapPoints.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [mapPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => dispatch(loadDataset("emissions")), [dispatch]);

  // Options de filtres
  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const sortOpts = [
    { v: "desc", label: t("act1.f.sort_desc") },
    { v: "asc", label: t("act1.f.sort_asc") },
  ];
  const scaleOpts = [
    { v: "lin", label: t("act1.f.scale_lin") },
    { v: "log", label: t("act1.f.scale_log") },
  ];
  const colorOpts = [
    { v: "rank", label: t("act1.f.color_rank") },
    { v: "abs", label: t("act1.f.color_abs") },
  ];
  const dirOpts = [
    { v: "all", label: t("act1.f.dir_all") },
    { v: "down", label: t("act1.f.dir_down") },
    { v: "up", label: t("act1.f.dir_up") },
  ];

  const trendSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area, regionTrend)),
    [allSeries, regionTrend, inRegion],
  );
  const heatSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area, regionHeat)),
    [allSeries, regionHeat, inRegion],
  );
  const boxSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area, regionBox)),
    [allSeries, regionBox, inRegion],
  );
  const raceSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area, regionRace)),
    [allSeries, regionRace, inRegion],
  );

  return (
    <main className="act1">
      <div className="container">
        <header className="act1__head">
          <p className="eyebrow">{t("home.acts.a1_tag")}</p>
          <h1 className="act1__title">{t("home.acts.a1_title")}</h1>
          <p className="act1__lead">{t("act1.lead")}</p>
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
            {kpiItems.length > 0 && (
              <KpiRow items={kpiItems} title={t("act1.stats.title")} />
            )}

            {/* 0 — COURSE ANIMÉE (en tête, boucle) */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.race_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.race_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionRace} onChange={setRegionRace} />
              </div>
              <BarRace
                series={raceSeries}
                years={years}
                unit={t("act1.unit")}
                tk={tk}
                labels={{ play: t("act1.race.play"), pause: t("act1.race.pause") }}
              />
              <p className="act1viz__story">{t("act1.story.race")}</p>
            </section>

            {/* 1 — CLASSEMENT */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.rank_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.rank_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionRank} onChange={setRegionRank} />
                <Pills label={t("act1.f.sort")} options={sortOpts} value={sortRank} onChange={setSortRank} />
                <Pills label={t("act1.f.scale")} options={scaleOpts} value={scaleRank} onChange={setScaleRank} help={t("act1.f.scale_help")} />
                <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />
              </div>
              <RankChart
                points={pointsFor(regionRank, currentYear)}
                unit={t("act1.unit")}
                median={medianAll}
                refLabel={t("act1.ref_median")}
                sort={sortRank}
                scale={scaleRank}
              />
              <p className="act1viz__story">{t("act1.story.rank")}</p>
            </section>

            {/* 2 — TRAJECTOIRES */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.trend_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.trend_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionTrend} onChange={setRegionTrend} />
                <Pills label={t("act1.f.scale")} options={scaleOpts} value={scaleTrend} onChange={setScaleTrend} help={t("act1.f.scale_help")} />
              </div>
              <TrendChart series={trendSeries} years={years} unit={t("act1.unit")} scale={scaleTrend} />
              <p className="act1viz__story">{t("act1.story.trend")}</p>
            </section>

            {/* 3 — NUAGE niveau × évolution */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.scatter_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.scatter_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionScatter} onChange={setRegionScatter} />
              </div>
              <ScatterChart groups={scatterGroups} unit={t("act1.unit")} medianX={scatterMedianX} />
              <p className="act1viz__story">{t("act1.story.scatter")}</p>
            </section>

            {/* 4 — CARTE */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.map_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.map_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionMap} onChange={setRegionMap} />
                <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />
              </div>
              <ErrorBoundary fallback={<div className="act1__state act1__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={mapPoints}
                    unit={t("act1.unit")}
                    range={mapRange}
                    logScale
                    ramp="semantic"
                    mid={medianAll}
                    lowLabel={t("act1.map_low")}
                    midLabel={t("act1.ref_median")}
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
              <p className="act1viz__story">{t("act1.story.map")}</p>
            </section>

            {/* 5 — HEATMAP */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.heat_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.heat_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionHeat} onChange={setRegionHeat} />
                <Pills label={t("act1.f.color")} options={colorOpts} value={colorHeat} onChange={setColorHeat} help={t("act1.f.color_help")} />
              </div>
              <HeatmapChart
                series={heatSeries}
                years={years}
                unit={t("act1.unit")}
                mode={colorHeat}
                labels={{ low: t("act1.heatmap.low"), high: t("act1.heatmap.high") }}
              />
              <p className="act1viz__story">{t("act1.story.heat")}</p>
            </section>

            {/* 6 — RADAR sous-régions */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.radar_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.radar_sub")}</p>
                </div>
              </div>
              <RadarChart subAvg={subAvg} years={years} />
              <p className="act1viz__story">{t("act1.story.radar")}</p>
            </section>

            {/* 7 — DISTRIBUTION (boxplot) */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.box_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.box_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionBox} onChange={setRegionBox} />
                <Pills label={t("act1.f.scale")} options={scaleOpts} value={scaleBox} onChange={setScaleBox} help={t("act1.f.scale_help")} />
              </div>
              <BoxplotChart series={boxSeries} years={years} unit={t("act1.unit")} scale={scaleBox} />
              <p className="act1viz__story">{t("act1.story.box")}</p>
            </section>

            {/* 8 — FLUX (themeRiver) */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.river_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.river_sub")}</p>
                </div>
              </div>
              <RiverChart subAvg={subAvg} years={years} />
              <p className="act1viz__story">{t("act1.story.river")}</p>
            </section>

            {/* 9 — HIÉRARCHIE (sunburst) */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.tree_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.tree_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionTree} onChange={setRegionTree} />
                <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />
              </div>
              <SunburstChart groups={sunburstGroups} unit={t("act1.unit")} />
              <p className="act1viz__story">{t("act1.story.tree")}</p>
            </section>

            {/* 10 — CHANGEMENT */}
            <section className="act1viz">
              <div className="act1viz__head">
                <div>
                  <h3 className="act1viz__title">{t("act1.viz.change_title")}</h3>
                  <p className="act1viz__sub">{t("act1.viz.change_sub")}</p>
                </div>
              </div>
              <div className="act1viz__filters">
                <Pills label={t("act1.filter.title")} options={regionOpts} value={regionChange} onChange={setRegionChange} />
                <Pills label={t("act1.f.dir")} options={dirOpts} value={dirChange} onChange={setDirChange} />
              </div>
              <ChangeChart rows={changeRows} unit={t("act1.unit")} direction={dirChange} />
              <p className="act1viz__story">{t("act1.story.change")}</p>
            </section>

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