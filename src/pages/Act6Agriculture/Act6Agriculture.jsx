// src/pages/Act6Agriculture/Act6Agriculture.jsx
// ============================================================
// Acte 06 — L'assiette. « La terre nourricière sous pression. »
// UNE seule source réelle : le jeu DÉSAGRÉGÉ (agriApi). À partir de lui :
//   • Sous-acte 1 : AGRÉGÉ calculé par nous = rendement MÉDIAN par
//     territoire, toutes cultures confondues (kg/ha) → couverture complète,
//     pas de série corrompue. (On n'utilise plus l'indicateur SPC
//     A.CROP_YIELD. qui était limité à 4 territoires et bruité.)
//   • Explorateur par culture (icônes) sur la même donnée (pas de 2e appel).
// 100 % données API — l'agrégat est une médiane de valeurs réelles, rien
// n'est inventé.
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
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchAgriProduction } from "../../services/agriApi";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import CropRanking from "../../components/CropRanking/CropRanking";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import RankBars from "../../components/RankBars/RankBars";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import ChangeBars from "../../components/ChangeBars/ChangeBars";
import DataTable from "../../components/DataTable/DataTable";
import CropExplorer from "../../components/CropExplorer/CropExplorer";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./Act6Agriculture.scss";

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

const median = (arr) => {
  if (!arr.length) return null;
  const v = [...arr].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Agrégat calculé : rendement MÉDIAN par territoire-année (toutes cultures).
function buildAggregate(data) {
  if (!data || !data.commodities) return null;
  const cropCodes = data.commodities.filter((c) => c.kind === "crop").map((c) => c.code);
  const bucket = {}; // geo -> year -> [values]
  cropCodes.forEach((code) => {
    const d = data.byCommodity[code];
    if (!d) return;
    Object.entries(d.byArea).forEach(([geo, serie]) => {
      serie.forEach(({ year, value }) => {
        if (!Number.isFinite(value)) return;
        bucket[geo] = bucket[geo] || {};
        (bucket[geo][year] = bucket[geo][year] || []).push(value);
      });
    });
  });

  const byArea = {};
  const yearsSet = new Set();
  let min = Infinity;
  let max = -Infinity;
  Object.entries(bucket).forEach(([geo, years]) => {
    const serie = Object.entries(years)
      .map(([y, vals]) => {
        const value = median(vals);
        const year = Number(y);
        yearsSet.add(year);
        if (value < min) min = value;
        if (value > max) max = value;
        return { year, value };
      })
      .sort((a, b) => a.year - b.year);
    byArea[geo] = serie;
  });

  const years = [...yearsSet].sort((a, b) => a - b);
  return {
    byArea,
    years,
    areas: Object.keys(byArea),
    range: { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max },
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

function allSeries(agg, lang) {
  if (!agg) return [];
  return agg.areas
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (agg.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }));
}
function pointsAt(agg, year, lang) {
  if (!agg) return [];
  return agg.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const p = (agg.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value)
        ? { area: a, name: pictName(a, lang), value: p.value, year }
        : null;
    })
    .filter(Boolean);
}

export default function Act6Agriculture() {
  const { t, lang } = useLang();

  const [agri, setAgri] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [rankScope, setRankScope] = useState("all");
  const [cmpA, setCmpA] = useState(null);
  const [cmpB, setCmpB] = useState(null);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    // On garde les données affichées pendant le rechargement (changement de
    // langue) pour éviter un flash de chargement.
    setAgri((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchAgriProduction({ signal: ctrl.signal, lang }).then((res) => {
      if (!alive) return;
      const ok = res.source === "live" && res.commodities.length;
      setAgri({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const agg = useMemo(() => (agri.data ? buildAggregate(agri.data) : null), [agri.data]);

  const years = useMemo(() => agg?.years || [], [agg]);
  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);
  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  useEffect(() => {
    if (years.length && cmpA == null) setCmpA(years[0]);
    if (years.length && cmpB == null) setCmpB(years[years.length - 1]);
  }, [years, cmpA, cmpB]);

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

  const areaVisible = useCallback(
    (a) => region === "all" || REGION_OF[a] === region,
    [region],
  );

  const vSeries = useMemo(
    () => allSeries(agg, lang).filter((s) => areaVisible(s.area) && s.values.length),
    [agg, lang, areaVisible],
  );
  const points = useMemo(
    () =>
      (agg && currentYear != null ? pointsAt(agg, currentYear, lang) : []).filter((p) =>
        areaVisible(p.area),
      ),
    [agg, currentYear, lang, areaVisible],
  );
  const refMedian = useMemo(() => median(points.map((p) => p.value)) ?? 0, [points]);

  const changeRows = useMemo(
    () =>
      vSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => {
          const f = s.values[0];
          const l = s.values[s.values.length - 1];
          return { area: s.area, name: s.name, delta: l.value - f.value, first: f.value, last: l.value };
        }),
    [vSeries],
  );

  const rankCountries = useMemo(() => {
    if (!agri.data) return [];
    const set = new Set();
    (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .forEach((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return;
        d.areas.filter(isPict).forEach((a) => {
          if ((d.byArea[a] || []).some((p) => Number.isFinite(p.value))) set.add(a);
        });
      });
    return [...set]
      .map((a) => ({ code: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [agri.data, lang]);

  const cropRankRows = useMemo(() => {
    if (!agri.data || currentYear == null) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        let vals;
        if (rankScope === "all") {
          vals = d.areas
            .filter((a) => isPict(a) && areaVisible(a))
            .map((a) => (d.byArea[a] || []).find((p) => p.year === currentYear))
            .filter((p) => p && Number.isFinite(p.value))
            .map((p) => p.value);
        } else {
          const p = (d.byArea[rankScope] || []).find((q) => q.year === currentYear);
          vals = p && Number.isFinite(p.value) ? [p.value] : [];
        }
        if (!vals.length) return null;
        return { code: c.code, label: c.label, value: median(vals), year: currentYear };
      })
      .filter(Boolean);
  }, [agri.data, currentYear, areaVisible, rankScope]);

  const dumbbellRows = useMemo(() => {
    if (!agg || cmpA == null || cmpB == null) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area))
      .map((s) => {
        const pa = s.values.find((p) => p.year === cmpA);
        const pb = s.values.find((p) => p.year === cmpB);
        return pa && pb && Number.isFinite(pa.value) && Number.isFinite(pb.value)
          ? { area: s.area, name: s.name, a: pa.value, b: pb.value }
          : null;
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible, cmpA, cmpB]);

  const regionalSeries = useMemo(() => {
    if (!agg) return [];
    const all = allSeries(agg, lang).filter((s) => areaVisible(s.area));
    const vals = years
      .map((y) => {
        const ptsY = all
          .map((s) => s.values.find((p) => p.year === y))
          .filter((p) => p && Number.isFinite(p.value))
          .map((p) => p.value);
        const m = median(ptsY);
        return m == null ? null : { year: y, value: m };
      })
      .filter(Boolean);
    return [{ area: "PAC", name: t("act6.regional_name"), values: vals }];
  }, [agg, years, lang, areaVisible, t]);

  const diversityRows = useMemo(() => {
    if (!agri.data || !agg) return [];
    const counts = {};
    (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .forEach((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return;
        d.areas.filter(isPict).forEach((a) => {
          if ((d.byArea[a] || []).some((p) => Number.isFinite(p.value)))
            counts[a] = (counts[a] || 0) + 1;
        });
      });
    return Object.entries(counts)
      .map(([area, value]) => ({ area, name: pictName(area, lang), value, year: agg.lastYear }))
      .filter((r) => areaVisible(r.area));
  }, [agri.data, agg, lang, areaVisible]);
  const diversityMedian = useMemo(
    () => median(diversityRows.map((r) => r.value)) ?? 0,
    [diversityRows],
  );

  const volatilityRows = useMemo(() => {
    if (!agg) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area) && s.values.length >= 3)
      .map((s) => {
        const xs = s.values.map((p) => p.value);
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
        if (!mean) return null;
        const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
        const cv = (Math.sqrt(variance) / mean) * 100;
        return { area: s.area, name: s.name, value: Math.round(cv * 10) / 10, year: agg.lastYear };
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible]);
  const volatilityMedian = useMemo(
    () => median(volatilityRows.map((r) => r.value)) ?? 0,
    [volatilityRows],
  );

  const unit = t("act6.unit");
  const tableLabels = useMemo(
    () => ({
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: `${t("act6.value_label")} (${unit})`,
      col_vs_world: t("act6.vs_median"),
    }),
    [t, unit],
  );

  const retry = useCallback(() => {
    setAgri({ status: "loading", data: null });
    setYearIdx(null);
    fetchAgriProduction({ lang }).then((res) => {
      const ok = res.source === "live" && res.commodities.length;
      setAgri({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
  }, [lang]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };

  return (
    <main className="act6">
      <div className="container">
        <header className="act6__head">
          <p className="eyebrow">{t("act6.tag")}</p>
          <h1 className="act6__title">{t("act6.title")}</h1>
          <p className="act6__lead">{t("act6.lead")}</p>
        </header>

        <ReadingGuide
          title={t("act6.guide.title")}
          intro={t("act6.guide.intro")}
          steps={t("act6.guide.steps")}
          takeaway={t("act6.guide.takeaway")}
        />

        {agri.status === "loading" && <p className="act6__state">{t("scene.loading")}</p>}
        {agri.status === "empty" && (
          <div className="act6__state act6__state--err">
            <span>{t("act6.unavailable")}</span>
            <button className="act6__btn" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {agri.status === "ready" && currentYear != null && (
          <>
            {/* ---------- Sous-acte 1 : la terre (agrégat médian calculé) ---------- */}
            <section className="act6__sub">
              <div className="act6__sub-head">
                <h2 className="act6__sub-title">{t("act6.sub1_title")}</h2>
                <p className="act6__sub-sub">{t("act6.sub1_sub")}</p>
              </div>

              <div className="act6__bar">
                <div className="act6__filter" role="group" aria-label={t("act1.filter.title")}>
                  <span className="act6__filter-lbl">{t("act1.filter.title")}</span>
                  <div className="act6__pills">
                    {REGION_KEYS.map((k) => (
                      <button
                        key={k}
                        className={`act6__pill ${region === k ? "is-active" : ""}`}
                        onClick={() => setRegion(k)}
                        aria-pressed={region === k}
                      >
                        {t(`act1.filter.${k}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="act6__source">{t("act1.src_live")}</span>
              </div>

              <ExpandableCard title={t("act6.trend_title")} sub={t("act6.trend_sub")} {...xc}>
                <SmallMultiples
                  series={vSeries}
                  years={years}
                  unit={unit}
                  currentYear={currentYear}
                  labels={{ last: t("act6.smallmult_last") }}
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.heatmap_title")} sub={t("act6.heatmap_sub")} {...xc}>
                <EmissionsHeatmap
                  series={vSeries}
                  years={years}
                  unit={unit}
                  scale="sequential"
                  labels={{
                    low: t("act6.heatmap_low"),
                    high: t("act6.heatmap_high"),
                    empty: t("act1.change.empty"),
                    mode_row: t("act6.heatmap_mode_row"),
                    mode_abs: t("act6.heatmap_mode_abs"),
                  }}
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.change_title")} sub={t("act6.change_sub")} {...xc}>
                <ChangeBars
                  rows={changeRows}
                  unit={unit}
                  labels={{
                    up: t("act6.change_up"),
                    down: t("act6.change_down"),
                    empty: t("act1.change.empty"),
                  }}
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.crop_rank_title")} sub={`${t("act6.crop_rank_sub")} · ${currentYear}`} {...xc}>
                <CropRanking
                  rows={cropRankRows}
                  unit={unit}
                  max={12}
                  controls={
                    <>
                      <span className="croprank__select-lbl">{t("act6.crop_rank_scope")}</span>
                      <select
                        className="croprank__select"
                        value={rankScope}
                        onChange={(e) => setRankScope(e.target.value)}
                        aria-label={t("act6.crop_rank_scope")}
                      >
                        <option value="all">{t("act6.crop_rank_scope_all")}</option>
                        {rankCountries.map((c) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </>
                  }
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.compare_title")} sub={t("act6.compare_sub")} {...xc}>
                <DumbbellChart
                  rows={dumbbellRows}
                  yearA={cmpA}
                  yearB={cmpB}
                  unit={unit}
                  labels={{ up: t("act6.compare_up"), down: t("act6.compare_down") }}
                  controls={
                    <>
                      <span className="dumbbell__select-lbl">{t("act6.compare_from")}</span>
                      <select
                        className="dumbbell__select"
                        value={cmpA ?? ""}
                        onChange={(e) => setCmpA(Number(e.target.value))}
                        aria-label={t("act6.compare_from")}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <span className="dumbbell__select-lbl">{t("act6.compare_to")}</span>
                      <select
                        className="dumbbell__select"
                        value={cmpB ?? ""}
                        onChange={(e) => setCmpB(Number(e.target.value))}
                        aria-label={t("act6.compare_to")}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </>
                  }
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.regional_title")} sub={t("act6.regional_sub")} {...xc}>
                <TrendLines
                  series={regionalSeries}
                  years={years}
                  currentYear={currentYear}
                  unit={unit}
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.diversity_title")} sub={t("act6.diversity_sub")} {...xc}>
                <RankBars
                  data={diversityRows}
                  unit={t("act6.diversity_unit")}
                  worldAvg={diversityMedian}
                  refLabel={t("act6.median_ref")}
                />
              </ExpandableCard>

              <ExpandableCard title={t("act6.volatility_title")} sub={t("act6.volatility_sub")} {...xc}>
                <RankBars
                  data={volatilityRows}
                  unit="%"
                  worldAvg={volatilityMedian}
                  refLabel={t("act6.median_ref")}
                />
              </ExpandableCard>

              <div className="act6__timeline">
                <button className="act6__btn act6__play" onClick={togglePlay}>
                  {playing ? t("act1.pause") : t("act1.play")}
                </button>
                <input
                  className="act6__slider"
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
                <span className="act6__year">{currentYear}</span>
              </div>

              <div className="act6__map-head">
                <h3 className="act6__map-title">{t("act6.map_title")}</h3>
                <span className="act6__sub-sub">
                  {t("act6.map_sub")} · {currentYear}
                </span>
              </div>
              <ErrorBoundary fallback={<div className="act6__state act6__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<div className="act6__state">{t("scene.loading")}</div>}>
                  <OceanMap
                    data={points}
                    unit={unit}
                    range={agg ? agg.range : null}
                    logScale
                    lowLabel={t("act6.map_low")}
                    midLabel={t("act6.map_mid")}
                    highLabel={t("act6.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>

              <div className="act6__map-head">
                <h3 className="act6__map-title">{t("act6.table_title")}</h3>
                <span className="act6__sub-sub">
                  {t("act6.table_sub")} · {currentYear}
                </span>
              </div>
              <DataTable rows={points} labels={tableLabels} unit={unit} refValue={refMedian} />
            </section>

            {/* ---------- Explorateur par culture (même donnée) ---------- */}
            <section className="act6__sub">
              <div className="act6__sub-head">
                <h2 className="act6__sub-title">{t("act6.explorer_title")}</h2>
                <p className="act6__sub-sub">{t("act6.explorer_lead")}</p>
              </div>
              <CropExplorer data={agri.data} />
            </section>

            {/* ---------- Avertissement de rigueur ---------- */}
            <aside className="act6__caveat">
              <h3 className="act6__caveat-title">{t("act6.caveat_title")}</h3>
              <p className="act6__caveat-body">{t("act6.caveat_body")}</p>
            </aside>

            <p className="act6__next">{t("act6.next")}</p>
          </>
        )}

        <Link to="/" className="act6__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}