// src/pages/Act11Synthese/Act11Synthese.jsx
// ============================================================
// Acte 11 — « La Synthèse ». Le final : on croise TOUS les jeux utilisés.
// Responsabilité (GES/hab) confrontée à un INDICE DE VULNÉRABILITÉ composite
// (mer + SST + |pluies| + eau + tuberculose + recul du vivant), 0–100.
//
// FORME : un EXPLORATEUR. Un seul graphe affiché à la fois ; on bascule
// d'une lecture à l'autre via des onglets (ou les flèches ←/→). Chaque vue
// a son titre, son sous-titre et son récit, à côté du graphe. Filtres
// sous-région + territoire. Un MAXIMUM de types ApexCharts est déployé :
// nuage à quadrants, bulles 3D, slope, anneau, treemap, Pareto, matrice
// heatmap, radar, aire polaire, barres radiales, jauge, classement.
// 100 % données API. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSynthese } from "../../services/syntheseApi";
import { worldAvgFor } from "../../data/worldAvg";
import useThemeTokens from "../../hooks/UseThemeTokens";
import SynthScatter from "../../components/charts/SynthScatter";
import BubbleChart from "../../components/charts/BubbleChart";
import SlopeChart from "../../components/charts/SlopeChart";
import GapBars from "../../components/charts/GapBars";
import MirrorBars from "../../components/charts/MirrorBars";
import DonutChart from "../../components/charts/DonutChart";
import PolarAreaChart from "../../components/charts/PolarAreaChart";
import RadialBarsChart from "../../components/charts/RadialBarsChart";
import MatrixHeatmap from "../../components/charts/MatrixHeatmap";
import RadarProfileChart from "../../components/charts/RadarProfileChart";
import TreemapChart from "../../components/charts/TreemapChart";
import ParetoChart from "../../components/charts/ParetoChart";
import RadialGauge from "../../components/charts/RadialGauge";
import RankBars from "../../components/RankBars/RankBars";
import Loader from "../../components/Loader/Loader";
import "./Act11Synthese.scss";

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
const REGIONS3 = ["melanesia", "polynesia", "micronesia"];
const VULN = ["seaLevel", "sst", "rain", "water", "tb", "rli"];

function valueAt(values, year) {
  if (!values || !values.length) return null;
  let out = null;
  for (const p of values) {
    if (p.year === year) return p.value;
    if (p.year <= year) out = p.value;
  }
  return out;
}
function latestOf(ind) {
  if (!ind || ind.status !== "live") return {};
  const out = {};
  const last = ind.lastYear;
  (ind.areas || []).forEach((a) => {
    const v = valueAt(ind.byArea[a], last);
    if (Number.isFinite(v)) out[a] = v;
  });
  return out;
}
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function mean(nums) {
  const a = nums.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}
function vulnContribution(value, dir) {
  if (!Number.isFinite(value)) return NaN;
  if (dir === "down") return -value;
  if (dir === "abs") return Math.abs(value);
  return value;
}
function normalizeMap(rawByArea) {
  const vals = Object.values(rawByArea).filter((v) => Number.isFinite(v));
  if (!vals.length) return {};
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const out = {};
  Object.entries(rawByArea).forEach(([a, v]) => {
    if (!Number.isFinite(v)) return;
    out[a] = hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
  });
  return out;
}

function Pills({ label, isActive, labelOf, onChange }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      <span className="act1f__lbl">{label}</span>
      <div className="act1f__pills">
        {REGION_KEYS.map((k) => (
          <button key={k} type="button" className={`act1f__pill ${isActive(k) ? "is-active" : ""}`} onClick={() => onChange(k)} aria-pressed={isActive(k)}>
            {labelOf(k)}
          </button>
        ))}
      </div>
    </div>
  );
}
function Selecter({ label, value, options, onChange }) {
  return (
    <label className="act1f act1f--select">
      <span className="act1f__lbl">{label}</span>
      <select className="act1f__select" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={String(o.v)} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Act11Synthese() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [tab, setTab] = useState(0);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSynthese({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({ status: res.source === "live" ? "ready" : "empty", data: res });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;

  const latest = useMemo(() => {
    if (!data) return {};
    const out = {};
    ["emissions", ...VULN].forEach((k) => {
      out[k] = latestOf(data[k]);
    });
    return out;
  }, [data]);

  const normByInd = useMemo(() => {
    if (!data) return {};
    const out = {};
    VULN.forEach((k) => {
      const ind = data[k];
      if (!ind || ind.status !== "live") {
        out[k] = {};
        return;
      }
      const raw = {};
      Object.entries(latest[k] || {}).forEach(([a, v]) => {
        if (!isPict(a)) return;
        const c = vulnContribution(v, ind.dir);
        if (Number.isFinite(c)) raw[a] = c;
      });
      out[k] = normalizeMap(raw);
    });
    return out;
  }, [data, latest]);

  const composite = useMemo(() => {
    const acc = {};
    VULN.forEach((k) => {
      Object.entries(normByInd[k] || {}).forEach(([a, v]) => {
        if (!isPict(a)) return;
        (acc[a] = acc[a] || []).push(v);
      });
    });
    const out = {};
    Object.entries(acc).forEach(([a, arr]) => {
      if (arr.length) out[a] = arr.reduce((s, v) => s + v, 0) / arr.length;
    });
    return out;
  }, [normByInd]);

  const emiNorm = useMemo(() => {
    const raw = {};
    Object.entries(latest.emissions || {}).forEach(([a, v]) => {
      if (isPict(a) && Number.isFinite(v)) raw[a] = v;
    });
    return normalizeMap(raw);
  }, [latest]);

  const activeVuln = useMemo(() => VULN.filter((k) => data && data[k] && data[k].status === "live"), [data]);

  const onRegion = useCallback((k) => {
    setRegion(k);
    setCountry("all");
  }, []);
  const single = country !== "all";
  const inRegion = useCallback((a) => region === "all" || REGION_OF[a] === region, [region]);
  const areaVisible = useCallback((a) => (single ? a === country : inRegion(a)), [single, country, inRegion]);

  const countryOptions = useMemo(
    () =>
      Object.keys(composite)
        .filter((a) => isPict(a))
        .map((a) => ({ area: a, name: pictName(a, lang) }))
        .sort((x, y) => x.name.localeCompare(y.name, lang)),
    [composite, lang],
  );

  const vis = useMemo(() => Object.keys(composite).filter((a) => isPict(a) && areaVisible(a)), [composite, areaVisible]);

  const REGION_COLOR = useMemo(
    () => ({ melanesia: tk.accent, polynesia: tk.warm, micronesia: tk.positive, other: tk.secondary }),
    [tk],
  );
  const dimLabel = useCallback((k) => t(`act11.ind_${k}`), [t]);

  const pts = useMemo(() => {
    const emi = latest.emissions || {};
    return vis
      .filter((a) => Number.isFinite(emi[a]) && Number.isFinite(composite[a]))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        x: emi[a],
        y: composite[a],
        z: Number.isFinite((normByInd.seaLevel || {})[a]) ? normByInd.seaLevel[a] : 40,
        region: REGION_OF[a] || "other",
      }));
  }, [vis, latest, composite, normByInd, lang]);

  const groups = useMemo(
    () =>
      REGIONS3.map((rg) => ({
        name: t(`act1.filter.${rg}`),
        color: REGION_COLOR[rg],
        points: pts.filter((p) => p.region === rg),
      })).filter((g) => g.points.length),
    [pts, t, REGION_COLOR],
  );

  const medians = useMemo(() => ({ x: median(pts.map((p) => p.x)), y: median(pts.map((p) => p.y)) }), [pts]);

  const worldRef = useMemo(() => {
    const yr = data && data.emissions ? data.emissions.lastYear : null;
    return worldAvgFor(yr) ?? worldAvgFor(2023);
  }, [data]);

  const stats = useMemo(() => {
    if (pts.length < 3 || !Number.isFinite(worldRef)) return null;
    const pacMed = median(pts.map((p) => p.x));
    const ratio = pacMed > 0 ? worldRef / pacMed : null;
    const yMed = medians.y;
    const below = pts.filter((p) => p.x < worldRef && Number.isFinite(yMed) && p.y > yMed).length;
    const most = pts.reduce((m, p) => (!m || p.y > m.y ? p : m), null);
    return { pacMed, ratio, below, total: pts.length, most };
  }, [pts, worldRef, medians]);

  const slopeRows = useMemo(
    () =>
      vis
        .filter((a) => Number.isFinite(emiNorm[a]) && Number.isFinite(composite[a]))
        .map((a) => ({ name: pictName(a, lang), left: emiNorm[a], right: composite[a] }))
        .sort((x, y) => y.right - x.right),
    [vis, emiNorm, composite, lang],
  );

  // Territoires dotés des DEUX mesures (responsabilité normalisée + vulnérabilité).
  const bothAreas = useMemo(
    () => vis.filter((a) => Number.isFinite(emiNorm[a]) && Number.isFinite(composite[a])),
    [vis, emiNorm, composite],
  );
  // La dette climatique = vulnérabilité − responsabilité (0–100 chacune).
  const gapRows = useMemo(
    () =>
      bothAreas
        .map((a) => ({ name: pictName(a, lang), value: composite[a] - emiNorm[a] }))
        .sort((x, y) => y.value - x.value),
    [bothAreas, composite, emiNorm, lang],
  );
  // Émet ↔ subit (barres miroir).
  const mirrorRows = useMemo(
    () =>
      bothAreas
        .map((a) => ({ name: pictName(a, lang), left: emiNorm[a], right: composite[a] }))
        .sort((x, y) => y.right - x.right),
    [bothAreas, composite, emiNorm, lang],
  );
  // Renversement par RANG (1 = le plus responsable / le plus vulnérable).
  const slopeRankRows = useMemo(() => {
    const respRank = {};
    [...bothAreas].sort((a, b) => emiNorm[b] - emiNorm[a]).forEach((a, i) => (respRank[a] = i + 1));
    const vulnRank = {};
    [...bothAreas].sort((a, b) => composite[b] - composite[a]).forEach((a, i) => (vulnRank[a] = i + 1));
    return bothAreas
      .map((a) => ({ name: pictName(a, lang), left: respRank[a], right: vulnRank[a] }))
      .sort((x, y) => x.right - y.right);
  }, [bothAreas, composite, emiNorm, lang]);

  const donutRows = useMemo(
    () =>
      REGIONS3.map((rg) => ({
        name: t(`act1.filter.${rg}`),
        color: REGION_COLOR[rg],
        value: Object.keys(composite)
          .filter((a) => isPict(a) && REGION_OF[a] === rg)
          .reduce((s, a) => s + (composite[a] || 0), 0),
      })).filter((r) => r.value > 0),
    [composite, t, REGION_COLOR],
  );

  const treemapRows = useMemo(() => vis.map((a) => ({ name: pictName(a, lang), value: Math.round(composite[a]) })), [vis, composite, lang]);
  const paretoRows = useMemo(() => {
    const emi = latest.emissions || {};
    return vis.filter((a) => Number.isFinite(emi[a])).map((a) => ({ name: pictName(a, lang), value: emi[a] }));
  }, [vis, latest, lang]);

  const matrixRows = useMemo(
    () =>
      vis
        .map((a) => ({
          name: pictName(a, lang),
          cells: activeVuln.map((k) => ({ x: dimLabel(k), value: (normByInd[k] || {})[a] })).filter((c) => Number.isFinite(c.value)),
        }))
        .filter((r) => r.cells.length >= 3)
        .sort((x, y) => mean(y.cells.map((c) => c.value)) - mean(x.cells.map((c) => c.value))),
    [vis, activeVuln, normByInd, dimLabel, lang],
  );

  const radarCats = useMemo(() => activeVuln.map((k) => dimLabel(k)), [activeVuln, dimLabel]);
  const radarSeries = useMemo(
    () =>
      REGIONS3.map((rg) => ({
        name: t(`act1.filter.${rg}`),
        data: activeVuln.map((k) => {
          const m = mean(Object.keys(normByInd[k] || {}).filter((a) => REGION_OF[a] === rg).map((a) => normByInd[k][a]));
          return m == null ? 0 : Math.round(m);
        }),
      })),
    [activeVuln, normByInd, t],
  );

  const polarValues = useMemo(() => {
    if (single) return activeVuln.map((k) => (normByInd[k] || {})[country]);
    return activeVuln.map((k) => {
      const m = mean(vis.map((a) => (normByInd[k] || {})[a]));
      return m == null ? 0 : m;
    });
  }, [single, country, activeVuln, normByInd, vis]);

  const radialRows = useMemo(
    () =>
      [...vis]
        .sort((a, b) => composite[b] - composite[a])
        .slice(0, 6)
        .map((a) => ({ name: pictName(a, lang), value: composite[a] })),
    [vis, composite, lang],
  );

  const rankComposite = useMemo(
    () => vis.map((a) => ({ area: a, name: pictName(a, lang), value: Math.round(composite[a]) })).sort((x, y) => y.value - x.value),
    [vis, composite, lang],
  );
  const compMed = useMemo(() => {
    const m = median(rankComposite.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [rankComposite]);

  const profile = useMemo(() => {
    if (!single) return [];
    return activeVuln
      .map((k) => ({ area: k, name: dimLabel(k), value: Math.round((normByInd[k] || {})[country] ?? NaN) }))
      .filter((r) => Number.isFinite(r.value))
      .sort((x, y) => y.value - x.value);
  }, [single, activeVuln, normByInd, country, dimLabel]);

  const xRef = { value: worldRef, label: t("act11.world_ref_label") };
  const idxUnit = t("act11.index_unit");
  const fmt1 = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString(lang === "en" ? "en-US" : "fr-FR");
  const round0 = (v) => Math.round(v);

  // ---------- Liste des vues disponibles (un graphe = un onglet) ----------
  const charts = [];
  // 1) LA DETTE — le graphe-thèse, en ouverture.
  if (!single && gapRows.length >= 2) {
    charts.push({
      id: "gap",
      tab: t("act11.tab_gap"),
      title: t("act11.gap_title"),
      sub: t("act11.gap_sub"),
      story: t("act11.story.gap"),
      node: <GapBars rows={gapRows} unit={idxUnit} leftLabel={t("act11.gap_left")} rightLabel={t("act11.gap_right")} format={round0} />,
    });
  }
  // 2) LA PREUVE — le face-à-face.
  if (pts.length >= 3) {
    charts.push({
      id: "scatter",
      tab: t("act11.tab_scatter"),
      title: t("act11.scatter_title"),
      sub: t("act11.scatter_sub"),
      story: t("act11.story.scatter"),
      node: <SynthScatter groups={groups} xName={t("act11.scatter_x")} yName={t("act11.scatter_y")} xUnit={t("act11.scatter_x_unit")} xRef={xRef} yDivider={medians.y} />,
    });
  }
  // 3) LA JUXTAPOSITION — émet ↔ subit.
  if (!single && mirrorRows.length >= 2) {
    charts.push({
      id: "mirror",
      tab: t("act11.tab_mirror"),
      title: t("act11.mirror_title"),
      sub: t("act11.mirror_sub"),
      story: t("act11.story.mirror"),
      node: <MirrorBars rows={mirrorRows} leftLabel={t("act11.slope_left")} rightLabel={t("act11.slope_right")} unit={idxUnit} format={round0} />,
    });
  }
  // 4) LE RENVERSEMENT — en valeur puis en rang.
  if (!single && slopeRows.length >= 3) {
    charts.push({
      id: "slope",
      tab: t("act11.tab_slope"),
      title: t("act11.slope_title"),
      sub: t("act11.slope_sub"),
      story: t("act11.story.slope"),
      node: <SlopeChart rows={slopeRows} leftLabel={t("act11.slope_left")} rightLabel={t("act11.slope_right")} unit={idxUnit} />,
    });
  }
  if (!single && slopeRankRows.length >= 3) {
    charts.push({
      id: "sloperank",
      tab: t("act11.tab_sloperank"),
      title: t("act11.sloperank_title"),
      sub: t("act11.sloperank_sub"),
      story: t("act11.story.sloperank"),
      node: <SlopeChart rows={slopeRankRows} leftLabel={t("act11.sloperank_left")} rightLabel={t("act11.sloperank_right")} unit={t("act11.rank_word")} max={slopeRankRows.length} reverse invertColor />,
    });
  }
  // 5) EN RELIEF.
  if (pts.length >= 3) {
    charts.push({
      id: "bubble",
      tab: t("act11.tab_bubble"),
      title: t("act11.bubble_title"),
      sub: t("act11.bubble_sub"),
      story: t("act11.story.bubble"),
      node: <BubbleChart groups={groups} xName={t("act11.scatter_x")} yName={t("act11.scatter_y")} zName={t("act11.bubble_z")} xUnit={t("act11.scatter_x_unit")} xRef={xRef} />,
    });
  }
  // 6) L'EMPREINTE — matrice, profils, dimensions.
  if (matrixRows.length >= 2 && activeVuln.length >= 3) {
    charts.push({
      id: "matrix",
      tab: t("act11.tab_matrix"),
      title: t("act11.matrix_title"),
      sub: t("act11.matrix_sub"),
      story: t("act11.story.matrix"),
      node: <MatrixHeatmap rows={matrixRows} unit={idxUnit} format={round0} />,
    });
  }
  if (activeVuln.length >= 3 && radarSeries.some((s) => s.data.some((v) => v > 0))) {
    charts.push({
      id: "radar",
      tab: t("act11.tab_radar"),
      title: t("act11.radar_title"),
      sub: t("act11.radar_sub"),
      story: t("act11.story.radar"),
      node: <RadarProfileChart categories={radarCats} series={radarSeries} unit={idxUnit} max={100} />,
    });
  }
  if (activeVuln.length >= 3 && polarValues.some((v) => Number.isFinite(v))) {
    charts.push({
      id: "polar",
      tab: t("act11.tab_polar"),
      title: single ? `${t("act11.polar_title_one")} — ${pictName(country, lang)}` : t("act11.polar_title"),
      sub: t("act11.polar_sub"),
      story: t("act11.story.polar"),
      node: <PolarAreaChart categories={radarCats} values={polarValues} unit={idxUnit} max={100} />,
    });
  }
  // 7) LA HIÉRARCHIE — territoires, sous-régions, responsabilité.
  if (treemapRows.length >= 2) {
    charts.push({
      id: "treemap",
      tab: t("act11.tab_treemap"),
      title: t("act11.treemap_title"),
      sub: t("act11.treemap_sub"),
      story: t("act11.story.treemap"),
      node: <TreemapChart rows={treemapRows} unit={idxUnit} format={round0} />,
    });
  }
  if (!single && region === "all" && donutRows.length >= 2) {
    charts.push({
      id: "donut",
      tab: t("act11.tab_donut"),
      title: t("act11.donut_title"),
      sub: t("act11.donut_sub"),
      story: t("act11.story.donut"),
      node: <DonutChart rows={donutRows} unit={idxUnit} centerLabel={t("act11.donut_center")} format={round0} />,
    });
  }
  if (paretoRows.length >= 2) {
    charts.push({
      id: "pareto",
      tab: t("act11.tab_pareto"),
      title: t("act11.pareto_title"),
      sub: t("act11.pareto_sub"),
      story: t("act11.story.pareto"),
      node: <ParetoChart rows={paretoRows} unit={t("act11.scatter_x_unit")} cumulLabel={t("act4.pareto_cumul")} format={fmt1} />,
    });
  }
  if (radialRows.length >= 2) {
    charts.push({
      id: "radial",
      tab: t("act11.tab_radial"),
      title: t("act11.radial_title"),
      sub: t("act11.radial_sub"),
      story: t("act11.story.radial"),
      node: <RadialBarsChart rows={radialRows} unit={idxUnit} />,
    });
  }
  charts.push({
    id: "gauge",
    tab: t("act11.tab_gauge"),
    title: t("act11.gauge_title"),
    sub: t("act11.gauge_sub"),
    story: t("act11.story.gauge"),
    node: <RadialGauge value={Math.round(compMed ?? 0)} label={t("act11.gauge_label")} color={tk.warm} />,
  });
  if (single && profile.length > 0) {
    charts.push({
      id: "rank",
      tab: t("act11.tab_rank"),
      title: `${t("act11.profile_title")} — ${pictName(country, lang)}`,
      sub: t("act11.profile_sub"),
      story: t("act11.story.rank"),
      node: <RankBars data={profile} unit={idxUnit} worldAvg={50} refLabel={t("act11.profile_ref")} />,
    });
  } else if (!single && rankComposite.length > 0) {
    charts.push({
      id: "rank",
      tab: t("act11.tab_rank"),
      title: t("act11.rank_title"),
      sub: t("act11.rank_sub"),
      story: t("act11.story.rank"),
      node: <RankBars data={rankComposite} unit={idxUnit} worldAvg={compMed} refLabel={t("act6.median_ref")} />,
    });
  }

  const count = charts.length;
  useEffect(() => {
    setTab((i) => (i > count - 1 ? Math.max(0, count - 1) : i));
  }, [count]);

  const goTab = useCallback(
    (i) => setTab((prev) => Math.max(0, Math.min(count - 1, typeof i === "function" ? i(prev) : i))),
    [count],
  );

  useEffect(() => {
    if (state.status !== "ready") return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goTab((p) => p + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTab((p) => p - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, goTab]);

  const activeIdx = Math.min(tab, Math.max(0, count - 1));
  const activeChart = count ? charts[activeIdx] : null;

  const filtersEl = (
    <>
      <Pills label={t("act1.filter.title")} isActive={(k) => !single && region === k} labelOf={(k) => t(`act1.filter.${k}`)} onChange={onRegion} />
      <Selecter
        label={t("act7.country_label")}
        value={country}
        options={[{ v: "all", label: t("act7.country_all") }].concat(countryOptions.map((c) => ({ v: c.area, label: c.name })))}
        onChange={setCountry}
      />
    </>
  );

  return (
    <main className="synth">
      <div className="container">
        <header className="synth__hero">
          <p className="eyebrow">{t("act11.tag")}</p>
          <h1 className="synth__title">{t("act11.title")}</h1>
          <p className="synth__lead">{t("act11.lead")}</p>

          {stats && (
            <div className="synth__stats">
              <div className="synth__stat">
                <span className="synth__stat-num">
                  {stats.pacMed.toFixed(1)}
                  <span className="synth__stat-u"> t/hab</span>
                </span>
                <span className="synth__stat-lbl">{t("act11.stat_emi_label")}</span>
                <span className="synth__stat-sub">{stats.ratio ? `≈ ${stats.ratio.toFixed(1)}× ${t("act11.stat_emi_sub")}` : ""}</span>
              </div>
              <div className="synth__stat synth__stat--warm">
                <span className="synth__stat-num">
                  {stats.below}
                  <span className="synth__stat-u"> / {stats.total}</span>
                </span>
                <span className="synth__stat-lbl">{t("act11.stat_inj_label")}</span>
                <span className="synth__stat-sub">{t("act11.stat_inj_sub")}</span>
              </div>
              <div className="synth__stat synth__stat--warm">
                <span className="synth__stat-num synth__stat-num--name">{stats.most ? stats.most.name : "—"}</span>
                <span className="synth__stat-lbl">{t("act11.stat_vuln_label")}</span>
                <span className="synth__stat-sub">{stats.most ? `${t("act11.stat_vuln_sub")} · ${Math.round(stats.most.y)}/100` : ""}</span>
              </div>
            </div>
          )}
        </header>

        {state.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {state.status === "empty" && <p className="synth__state synth__state--err">{t("act11.unavailable")}</p>}

        {state.status === "ready" && activeChart && (
          <section className="synth__board" aria-label={t("act11.cross_title")}>
            <div className="synth__bar">
              <div className="synth__bar-filters">{filtersEl}</div>
              <span className="synth__bar-hint">{t("act11.switch_hint")}</span>
            </div>

            <nav className="synth__tabs" role="tablist" aria-label={t("act11.cross_title")}>
              {charts.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIdx}
                  className={`synth__tab ${i === activeIdx ? "is-active" : ""}`}
                  onClick={() => goTab(i)}
                >
                  {c.tab}
                </button>
              ))}
            </nav>

            <div className="synth__stage">
              <div className="synth__stage-main">
                <div className="synth__stage-head">
                  <span className="synth__num">
                    {String(activeIdx + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                  </span>
                  <h2 className="synth__chart-title">{activeChart.title}</h2>
                  <p className="synth__chart-sub">{activeChart.sub}</p>
                </div>
                <div className="synth__chart">{activeChart.node}</div>
                <div className="synth__pager">
                  <button type="button" className="synth__pager-btn" onClick={() => goTab((p) => p - 1)} disabled={activeIdx <= 0} aria-label={t("act11.prev")}>
                    ←
                  </button>
                  <span className="synth__pager-count">
                    {activeIdx + 1} / {count}
                  </span>
                  <button type="button" className="synth__pager-btn" onClick={() => goTab((p) => p + 1)} disabled={activeIdx >= count - 1} aria-label={t("act11.next")}>
                    →
                  </button>
                </div>
              </div>

              <aside className="synth__story">
                <div className="synth__story-card">
                  <span className="synth__story-k">{t("act11.story_kicker")}</span>
                  <p className="synth__story-t">{activeChart.story}</p>
                </div>
                <p className="synth__method">
                  {t("act11.method")}
                  {activeVuln.length < VULN.length ? ` ${t("act11.credit_partial")}` : ""}
                </p>
              </aside>
            </div>
          </section>
        )}

        {state.status === "ready" && (
          <section className="synth__outro">
            <p className="eyebrow">{t("act11.outro.kicker")}</p>
            <h2 className="synth__outro-title">{t("act11.outro.title")}</h2>
            <p className="synth__outro-text">{t("act11.outro.text")}</p>
            <div className="synth__actions">
              <Link to="/" className="synth__btn synth__btn--primary">
                {t("act11.outro.home")} <span aria-hidden="true">→</span>
              </Link>
              <Link to="/emissions" className="synth__btn">
                {t("act11.outro.restart")}
              </Link>
            </div>
          </section>
        )}

        <Link to="/" className="synth__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}