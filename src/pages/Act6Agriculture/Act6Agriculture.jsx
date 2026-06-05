// src/pages/Act6Agriculture/Act6Agriculture.jsx
// ============================================================
// Acte 06 — La terre nourricière : rendements agricoles (FAO via agriApi).
// Format DASHBOARD (ActBoard) recentré sur les CULTURES (kg/ha) :
// filtres GLOBAUX (sous-région + année), petits multiples en SIGNATURE.
// Tableau retiré. 7 onglets, dont l'explorateur de cultures.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchAgriProduction } from "../../services/agriApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import CropRanking from "../../components/CropRanking/CropRanking";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankChart from "../../components/charts/RankChart";
import CropExplorer from "../../components/CropExplorer/CropExplorer";
import { fmt } from "../../components/charts/echartsBase";
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

// Rendement MÉDIAN par territoire-année pour un type ("crop" = kg/ha).
function buildAggregate(data, kind = "crop") {
  if (!data || !data.commodities) return null;
  const codes = data.commodities.filter((c) => c.kind === kind).map((c) => c.code);
  const bucket = {};
  codes.forEach((code) => {
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
    .map((a) => ({ area: a, name: pictName(a, lang), values: (agg.byArea[a] || []).filter((p) => Number.isFinite(p.value)) }));
}
function pointsAt(agg, year, lang) {
  if (!agg) return [];
  return agg.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const p = (agg.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value) ? { area: a, name: pictName(a, lang), value: p.value, year } : null;
    })
    .filter(Boolean);
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

export default function Act6Agriculture() {
  const { t, lang } = useLang();

  const [agri, setAgri] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [kind, setKind] = useState("crop");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
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

  const agg = useMemo(() => (agri.data ? buildAggregate(agri.data, kind) : null), [agri.data, kind]);
  const years = useMemo(() => agg?.years || [], [agg]);

  // Le type (cultures/élevage) a ses propres années → on réinitialise le curseur.
  useEffect(() => {
    setYearIdx(null);
  }, [kind]);

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);
  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const areaVisible = useCallback((a) => region === "all" || REGION_OF[a] === region, [region]);

  const vSeries = useMemo(() => allSeries(agg, lang).filter((s) => areaVisible(s.area) && s.values.length), [agg, lang, areaVisible]);
  const points = useMemo(
    () => (agg && currentYear != null ? pointsAt(agg, currentYear, lang) : []).filter((p) => areaVisible(p.area)),
    [agg, currentYear, lang, areaVisible],
  );
  const refMedian = useMemo(() => median(points.map((p) => p.value)) ?? 0, [points]);

  const firstYear = agg?.firstYear ?? null;
  const lastYear = agg?.lastYear ?? null;

  const cropRankRows = useMemo(() => {
    if (!agri.data || currentYear == null) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === kind)
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        const vals = d.areas
          .filter((a) => isPict(a) && areaVisible(a))
          .map((a) => (d.byArea[a] || []).find((p) => p.year === currentYear))
          .filter((p) => p && Number.isFinite(p.value))
          .map((p) => p.value);
        if (!vals.length) return null;
        return { code: c.code, label: c.label, value: median(vals), year: currentYear };
      })
      .filter(Boolean);
  }, [agri.data, currentYear, areaVisible, kind]);

  const dumbbellRows = useMemo(() => {
    if (!agg || firstYear == null || lastYear == null) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area))
      .map((s) => {
        const pa = s.values.find((p) => p.year === firstYear);
        const pb = s.values.find((p) => p.year === lastYear);
        return pa && pb && Number.isFinite(pa.value) && Number.isFinite(pb.value) ? { area: s.area, name: s.name, a: pa.value, b: pb.value } : null;
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible, firstYear, lastYear]);

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

  const unit = kind === "crop" ? t("act6.unit") : t("act6.livestock_unit");

  // Stabilité = coefficient de variation (%) du rendement dans le temps,
  // par territoire. Faible CV = production régulière (résiliente).
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
        return { name: s.name, value: Math.round(cv * 10) / 10 };
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible]);
  const volatilityMedian = useMemo(() => median(volatilityRows.map((r) => r.value)) ?? 0, [volatilityRows]);

  const kpiItems = useMemo(() => {
    if (agri.status !== "ready" || !points.length) return [];
    const sorted = [...points].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    return [
      { key: "median", value: fmt(refMedian, 0), unit, label: t("act6.board.kpi_median"), tone: "accent" },
      { key: "high", value: fmt(high.value, 0), unit: high.name, label: t("act6.board.kpi_high"), tone: "positive" },
      { key: "low", value: fmt(low.value, 0), unit: low.name, label: t("act6.board.kpi_low"), tone: "warm" },
    ];
  }, [agri.status, points, refMedian, unit, t]);

  const retry = useCallback(() => {
    setAgri({ status: "loading", data: null });
    setYearIdx(null);
    fetchAgriProduction({ lang }).then((res) => {
      const ok = res.source === "live" && res.commodities.length;
      setAgri({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
  }, [lang]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const status = agri.status === "ready" ? (years.length ? "ready" : "empty") : agri.status === "loading" ? "loading" : "empty";

  const heatLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };

  const filtersEl = (
    <>
      <Select label={t("act6.board.kind_label")} options={[{ v: "crop", label: t("act6.board.kind_crop") }, { v: "livestock", label: t("act6.board.kind_livestock") }]} value={kind} onChange={setKind} />
      <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={(i) => setYearIdx(i)} />
    </>
  );

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            id: "small",
            signature: true,
            empty: vSeries.length === 0,
            tab: t("act6.board.tab_small"),
            title: t("act6.trend_title"),
            finding: t("act6.board.small_find"),
            takeaway: t("act6.board.small_take"),
            node: (
              <div className="act6b__scroll">
                <SmallMultiples series={vSeries} years={years} unit={unit} currentYear={currentYear} labels={{ last: t("act6.smallmult_last") }} />
              </div>
            ),
          },
          {
            id: "regional",
            empty: !regionalSeries.length || regionalSeries[0].values.length < 2,
            tab: t("act6.board.tab_regional"),
            title: t("act6.regional_title"),
            finding: t("act6.board.regional_find"),
            takeaway: t("act6.board.regional_take"),
            node: (
              <div className="act6b__fit">
                <TrendLines series={regionalSeries} years={years} currentYear={currentYear} unit={unit} />
              </div>
            ),
          },
          {
            id: "crops",
            empty: cropRankRows.length === 0,
            tab: kind === "crop" ? t("act6.board.tab_crops") : t("act6.board.tab_animals"),
            title: `${kind === "crop" ? t("act6.crop_rank_title") : t("act6.animal_rank_title")} · ${currentYear}`,
            finding: t("act6.board.crops_find"),
            takeaway: t("act6.board.crops_take"),
            node: (
              <div className="act6b__scroll">
                <CropRanking rows={cropRankRows} unit={unit} max={12} />
              </div>
            ),
          },
          {
            id: "change",
            empty: dumbbellRows.length === 0,
            tab: t("act6.board.tab_change"),
            title: `${t("act6.compare_title")} · ${firstYear}–${lastYear}`,
            finding: t("act6.board.change_find"),
            takeaway: t("act6.board.change_take"),
            node: <DumbbellChart rows={dumbbellRows} yearA={firstYear} yearB={lastYear} unit={unit} labels={{ up: t("act6.compare_up"), down: t("act6.compare_down") }} />,
          },
          {
            id: "stability",
            empty: volatilityRows.length === 0,
            tab: t("act6.board.tab_stability"),
            title: t("act6.board.stability_title"),
            finding: t("act6.board.stability_find"),
            takeaway: t("act6.board.stability_take"),
            node: <RankChart points={volatilityRows} unit="%" median={volatilityMedian} refLabel={t("act6.median_ref")} sort="desc" scale="lin" />,
          },
          {
            id: "heat",
            empty: vSeries.length === 0,
            tab: t("act6.board.tab_heat"),
            title: t("act6.heatmap_title"),
            finding: t("act6.board.heat_find"),
            takeaway: t("act6.board.heat_take"),
            node: (
              <div className="act6b__fit">
                <EmissionsHeatmap series={vSeries} years={years} unit={unit} scale="sequential" labels={heatLabels} />
              </div>
            ),
          },
          {
            id: "map",
            empty: points.length === 0,
            tab: t("act6.board.tab_map"),
            title: `${t("act6.map_title")} · ${currentYear}`,
            finding: t("act6.board.map_find"),
            takeaway: t("act6.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap data={points} unit={unit} range={agg ? agg.range : null} logScale lowLabel={t("act6.map_low")} midLabel={t("act6.map_mid")} highLabel={t("act6.map_high")} noTokenMsg={t("act1.map_no_token")} />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "explorer",
            empty: !agri.data,
            tab: t("act6.board.tab_explorer"),
            title: t("act6.explorer_title"),
            finding: t("act6.board.explorer_find"),
            takeaway: t("act6.board.explorer_take"),
            node: (
              <div className="act6b__scroll">
                <CropExplorer data={agri.data} kind={kind} labels={{ pick: kind === "crop" ? t("act6.explorer_pick") : t("act6.explorer_animal_pick") }} />
              </div>
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act6.tag")}
      title={t("act6.title")}
      thesis={t("act6.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 6, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act6.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act6.board.switch_hint"),
        signature: t("act6.board.signature"),
        takeawayKicker: t("act6.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act6.board.start"),
        conclusion: t("act6.board.conclusion"),
        backIntro: t("act6.board.back_intro"),
        reviseData: t("act6.board.revise_data"),
      }}
      outro={{
        kicker: t("act6.outro.kicker"),
        title: t("act6.outro.title"),
        text: t("act6.outro.text"),
        primary: { to: "/vivant", label: t("act6.outro.next") },
        secondary: { to: "/", label: t("act6.outro.home") },
      }}
    />
  );
}