// src/pages/Act3Territory/Act3Territory.jsx
// ============================================================
// Acte 06 (parcours) — « La côte, ligne de front ».
// CROISE deux jeux PDH/SPC joints par GEO_PICT :
//   • niveau de la mer  : DF_CLIMATE_CHANGE · SEA_LVL  (anomalie, m ; réf. 1993–2012 ; Copernicus C3S/DUACS)
//   • population        : DF_NMDI_POP                  (taux de croissance annuel, %)
//
// Le niveau de la mer monte de façon QUASI UNIFORME (faible variance entre
// territoires) ; ce qui DIFFÉRENCIE les territoires, c'est la démographie.
// On raconte donc : (1) la mer monte pour tous (bande) ; (2) profil
// d'exposition territoire par territoire — rang mer ↔ rang pression
// démographique (barres miroir) ; (3) qui se densifie / se vide (barres
// divergentes) ; (4) la carte ; (5) la trajectoire démographique (haltère).
// Un nuage de points serait dégénéré ici (axe « mer » plat) — remplacé.
// Format DASHBOARD (ActBoard). 100 % ApexCharts (hors carte Mapbox).
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import AnomalyBandChart from "../../components/charts/AnomalyBandChart";
import MirrorBars from "../../components/charts/MirrorBars";
import ChangeChart from "../../components/charts/ChangeChart";
import DumbbellChart from "../../components/charts/DumbbellChart";
import { median, fmt } from "../../components/charts/echartsBase";
import "./Act3Territory.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

// Couche « trait de côte » (Digital Earth Pacific — Landsat Coastlines, CC BY-NC).
// GeoJSON dégraissé servi depuis public/data/.
const COAST_URL = `${process.env.PUBLIC_URL || ""}/data/coastline-hotspots.geojson`;

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

function allSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)).sort((x, y) => x.year - y.year),
    }))
    .filter((s) => s.values.length);
}
function pointsAt(d, year, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const p = (d.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value) ? { area: a, name: pictName(a, lang), value: p.value, year } : null;
    })
    .filter(Boolean);
}
function latestValue(series) {
  return series.values.length ? series.values[series.values.length - 1].value : null;
}
function firstValue(series) {
  return series.values.length ? series.values[0].value : null;
}
// Rang relatif 0–100 (percentile) à partir d'un dico { area: valeur }.
// Évite l'écrasement quand les valeurs sont peu dispersées (cas du niveau de
// la mer) : on lit la POSITION relative, pas la valeur brute.
function rankIndex(byArea) {
  const entries = Object.entries(byArea).filter(([, v]) => Number.isFinite(v));
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const n = sorted.length;
  const out = {};
  sorted.forEach(([area], i) => {
    out[area] = n > 1 ? Math.round((i / (n - 1)) * 100) : 50;
  });
  return out;
}

/* ---------- Filtres globaux ---------- */
function Select({ label, options, value, onChange }) {
  return (
    <div className="act1f act1f--select">
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__selwrap">
        <select className="act1f__select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          {options.map((o) => (
            <option key={String(o.v)} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="act1f__caret" aria-hidden="true">
          ▾
        </span>
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

export default function Act3Territory() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();

  const sea = useSelector(selectDataset("seaLevel"));
  const pop = useSelector(selectDataset("population"));

  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null); // index sur les années de la MER
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const ready = sea.status === "succeeded" && pop.status === "succeeded";
  const failed = sea.status === "failed" || pop.status === "failed";

  const seaYears = useMemo(() => (sea.data ? sea.data.years : []), [sea.data]);
  const firstSeaYear = seaYears[0] ?? null;
  const lastSeaYear = seaYears[seaYears.length - 1] ?? null;
  const empty = ready && seaYears.length === 0;

  useEffect(() => {
    if (seaYears.length && yearIdx === null) setYearIdx(seaYears.length - 1);
  }, [seaYears, yearIdx]);

  useEffect(() => {
    if (!playing || !seaYears.length) return undefined;
    const id = setInterval(() => {
      setYearIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= seaYears.length) {
          setPlaying(false);
          return seaYears.length - 1;
        }
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, seaYears]);

  const currentSeaYear = seaYears.length && yearIdx != null ? seaYears[yearIdx] : null;

  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);

  // Séries par territoire (mer & population), filtrées par sous-région.
  const seaSeries = useMemo(() => allSeries(sea.data, lang, inRegion), [sea.data, lang, inRegion]);
  const popSeries = useMemo(() => allSeries(pop.data, lang, inRegion), [pop.data, lang, inRegion]);

  // Points « niveau de la mer » à l'année courante (carte + KPIs).
  const seaPoints = useMemo(
    () => (sea.data && currentSeaYear != null ? pointsAt(sea.data, currentSeaYear, lang, inRegion) : []),
    [sea.data, currentSeaYear, lang, inRegion],
  );
  const seaMedian = useMemo(() => median(seaPoints.map((p) => p.value)) ?? 0, [seaPoints]);

  // Dernières valeurs par territoire.
  const seaLatestByArea = useMemo(() => {
    const m = {};
    seaSeries.forEach((s) => {
      const v = latestValue(s);
      if (Number.isFinite(v)) m[s.area] = v;
    });
    return m;
  }, [seaSeries]);
  const popLatestByArea = useMemo(() => {
    const m = {};
    popSeries.forEach((s) => {
      const v = latestValue(s);
      if (Number.isFinite(v)) m[s.area] = v;
    });
    return m;
  }, [popSeries]);

  // PROFIL D'EXPOSITION (barres miroir) : rang relatif mer (gauche) vs rang
  // relatif de pression démographique (droite), territoire par territoire.
  const profileRows = useMemo(() => {
    const seaRank = rankIndex(seaLatestByArea);
    const popRank = rankIndex(popLatestByArea);
    const names = {};
    seaSeries.forEach((s) => (names[s.area] = s.name));
    popSeries.forEach((s) => (names[s.area] = s.name));
    return Object.keys(names)
      .filter((a) => Number.isFinite(seaRank[a]) && Number.isFinite(popRank[a]))
      .map((a) => ({ name: names[a], area: a, left: seaRank[a], right: popRank[a] }))
      .sort((x, y) => x.left + x.right - (y.left + y.right)); // plus exposé en haut (Apex empile du bas)
  }, [seaLatestByArea, popLatestByArea, seaSeries, popSeries]);

  // PEUPLEMENT (barres divergentes) : taux de croissance le plus récent, par
  // territoire — qui gagne encore des habitants, qui en perd.
  const growthRows = useMemo(
    () =>
      popSeries
        .map((s) => ({ name: s.name, delta: latestValue(s) }))
        .filter((r) => Number.isFinite(r.delta)),
    [popSeries],
  );

  // TRAJECTOIRE (haltère) : taux de croissance 1re année → dernière, par territoire.
  const pathRows = useMemo(
    () =>
      popSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => ({ name: s.name, start: firstValue(s), end: latestValue(s) }))
        .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end)),
    [popSeries],
  );

  const seaUnit = t("act3.sea_unit");
  const popUnit = t("act3.unit");

  // Chiffres-chocs : 3 sur la mer (exposition) + 1 sur le peuplement.
  const kpiItems = useMemo(() => {
    if (!ready || !seaPoints.length) return [];
    const sorted = [...seaPoints].sort((a, b) => a.value - b.value);
    const top = sorted[sorted.length - 1];
    const medFirst = median(pointsAt(sea.data, firstSeaYear, lang, inRegion).map((p) => p.value));
    const medLast = median(pointsAt(sea.data, lastSeaYear, lang, inRegion).map((p) => p.value));
    const rise = Number.isFinite(medFirst) && Number.isFinite(medLast) ? medLast - medFirst : null;
    const popLatest = Object.values(popLatestByArea);
    const popMed = popLatest.length ? median(popLatest) : null;
    const items = [
      { key: "sea", value: `${seaMedian > 0 ? "+" : ""}${fmt(seaMedian, 2)}`, unit: seaUnit, label: t("act3.board.kpi_sea_median"), tone: "accent" },
      { key: "top", value: `${top.value > 0 ? "+" : ""}${fmt(top.value, 2)}`, unit: top.name, label: t("act3.board.kpi_most_exposed"), tone: "warm" },
    ];
    if (rise != null) {
      items.push({
        key: "rise",
        value: `${rise > 0 ? "+" : ""}${fmt(rise, 2)}`,
        unit: firstSeaYear ? `${t("act3.board.kpi_since")} ${firstSeaYear}` : seaUnit,
        label: t("act3.board.kpi_sea_rise"),
        tone: rise > 0 ? "warm" : "positive",
      });
    }
    if (popMed != null) {
      items.push({
        key: "pop",
        value: `${popMed > 0 ? "+" : ""}${fmt(popMed, 1)}`,
        unit: popUnit,
        label: t("act3.board.kpi_pop_growth"),
        tone: popMed > 0 ? "warm" : "positive",
      });
    }
    return items;
  }, [ready, seaPoints, seaMedian, sea.data, firstSeaYear, lastSeaYear, lang, inRegion, popLatestByArea, seaUnit, popUnit, t]);

  const mapRange = useMemo(() => {
    if (!seaPoints.length) return { min: -0.2, max: 0.2 };
    const vals = seaPoints.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [seaPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === seaYears.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [seaYears.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const status = failed ? "error" : !ready ? "loading" : empty ? "empty" : "ready";

  const noSeaSeries = seaSeries.length === 0;
  const noSeaPts = currentSeaYear != null && seaPoints.length === 0;
  const noProfile = profileRows.length === 0;
  const noGrowth = growthRows.length === 0;
  const noPath = pathRows.length < 1;

  const filtersEl = (
    <>
      <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <YearSlider label={t("act1.f.year")} years={seaYears} index={yearIdx} onChange={(i) => { setPlaying(false); setYearIdx(i); }} />
    </>
  );

  const charts =
    status === "ready" && currentSeaYear != null
      ? [
          {
            id: "band",
            signature: true,
            empty: noSeaSeries,
            tab: t("act3.board.tab_band"),
            title: t("act3.viz.band_title"),
            finding: t("act3.board.band_find"),
            takeaway: t("act3.board.band_take"),
            node: <AnomalyBandChart series={seaSeries} years={seaYears} unit={seaUnit} />,
          },
          {
            id: "profile",
            empty: noProfile,
            tab: t("act3.board.tab_profile"),
            title: t("act3.viz.profile_title"),
            finding: t("act3.board.profile_find"),
            takeaway: t("act3.board.profile_take"),
            node: (
              <MirrorBars
                rows={profileRows}
                leftLabel={t("act3.viz.profile_left")}
                rightLabel={t("act3.viz.profile_right")}
                unit={t("act3.viz.profile_unit")}
                format={(v) => fmt(v, 0)}
              />
            ),
          },
          {
            id: "growth",
            empty: noGrowth,
            tab: t("act3.board.tab_pop"),
            title: t("act3.viz.pop_title"),
            finding: t("act3.board.pop_find"),
            takeaway: t("act3.board.pop_take"),
            node: <ChangeChart rows={growthRows} unit={popUnit} direction="all" polarity="up_good" />,
          },
          {
            id: "map",
            empty: noSeaPts,
            tab: t("act3.board.tab_map"),
            title: `${t("act3.viz.map_title")} · ${currentSeaYear}`,
            finding: t("act3.board.map_find"),
            takeaway: t("act3.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={seaPoints}
                    unit={seaUnit}
                    range={mapRange}
                    ramp="semantic"
                    mid={0}
                    lowLabel={t("act3.map_low")}
                    midLabel={t("act3.map_mid")}
                    highLabel={t("act3.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                    years={seaYears}
                    yearIndex={yearIdx}
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onScrub={scrubYear}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "coast",
            empty: false,
            tab: t("act3.board.tab_coast"),
            title: t("act3.viz.coast_title"),
            finding: t("act3.board.coast_find"),
            takeaway: t("act3.board.coast_take"),
            node: (
              <div className="act6coast">
                <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                  <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                    <OceanMap
                      data={[]}
                      unit={seaUnit}
                      range={mapRange}
                      ramp="semantic"
                      mid={0}
                      lowLabel={t("act3.map_low")}
                      midLabel={t("act3.map_mid")}
                      highLabel={t("act3.map_high")}
                      noTokenMsg={t("act1.map_no_token")}
                      coastlineUrl={COAST_URL}
                    />
                  </Suspense>
                </ErrorBoundary>
                <div className="act6coast__legend">
                  <div className="act6coast__scale">
                    <span className="act6coast__end">
                      {t("act3.coast.legend_erosion")}
                    </span>
                    <span className="act6coast__bar" aria-hidden="true" />
                    <span className="act6coast__end">
                      {t("act3.coast.legend_accretion")}
                    </span>
                  </div>
                  <span className="act6coast__attr">{t("act3.coast.attr")}</span>
                </div>
              </div>
            ),
          },
          {
            id: "path",
            empty: noPath,
            tab: t("act3.board.tab_path"),
            title: t("act3.viz.path_title"),
            finding: t("act3.board.path_find"),
            takeaway: t("act3.board.path_take"),
            node: (
              <DumbbellChart rows={pathRows} unit={popUnit} startLabel={t("act3.path_start")} endLabel={t("act3.path_end")} />
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a3_tag")}
      title={t("home.acts.a3_title")}
      thesis={t("act3.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 6, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act3.board.switch_hint"),
        signature: t("act3.board.signature"),
        takeawayKicker: t("act3.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act3.board.start"),
        conclusion: t("act3.board.conclusion"),
        backIntro: t("act3.board.back_intro"),
        reviseData: t("act3.board.revise_data"),
      }}
      outro={{
        kicker: t("act3.outro.kicker"),
        title: t("act3.outro.title"),
        text: t("act3.outro.text"),
        primary: { to: "/sante", label: t("act3.outro.next") },
        secondary: { to: "/", label: t("act3.outro.home") },
      }}
    />
  );
}