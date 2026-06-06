// src/pages/Act11Synthese/Act11Synthese.jsx
// ============================================================
// Acte 11 — LA SYNTHÈSE (bouquet final). On croise TOUS les jeux de données :
// la RESPONSABILITÉ (GES/hab) confrontée à un INDICE DE VULNÉRABILITÉ
// composite (mer, chaleur, pluie, eau, tuberculose, biodiversité, normalisés).
// Format DASHBOARD (ActBoard). Graphes ECharts marquants :
//   Le Paradoxe (nuage) · Classement vulnérabilité · La Matrice (territoires ×
//   stress) · Empreinte régionale (radar) · La Responsabilité (classement GES).
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSynthese } from "../../services/syntheseApi";
import { worldAvgFor } from "../../data/worldAvg";
import ActBoard from "../../components/ActBoard/ActBoard";
import ScatterChart from "../../components/charts/ScatterChart";
import RankChart from "../../components/charts/RankChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import ProfileRadar from "../../components/charts/ProfileRadar";
import useThemeTokens from "../../hooks/UseThemeTokens";
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

/* ---------- Filtres globaux ---------- */
function Select({ label, options, value, onChange }) {
  return (
    <div className="act1f act1f--select">
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__selwrap">
        <select
          className="act1f__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
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

export default function Act11Synthese() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSynthese({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const inRegion = useCallback(
    (a) => region === "all" || REGION_OF[a] === region,
    [region],
  );

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

  const activeVuln = useMemo(
    () => VULN.filter((k) => data && data[k] && data[k].status === "live"),
    [data],
  );

  const countryOptions = useMemo(
    () =>
      Object.keys(composite)
        .filter((a) => isPict(a))
        .map((a) => ({ area: a, name: pictName(a, lang) }))
        .sort((x, y) => x.name.localeCompare(y.name, lang)),
    [composite, lang],
  );

  const scatterPoints = useMemo(() => {
    const emi = latest.emissions || {};
    return Object.keys(composite)
      .filter((a) => isPict(a) && Number.isFinite(emi[a]))
      .filter((a) => (country !== "all" ? true : inRegion(a)))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        x: emi[a],
        y: composite[a],
        region: REGION_OF[a] || "other",
      }));
  }, [composite, latest, lang, country, inRegion]);

  const medianX = useMemo(
    () => median(scatterPoints.map((p) => p.x)) ?? 0,
    [scatterPoints],
  );

  const worldRef = useMemo(() => {
    const yr = data && data.emissions ? data.emissions.lastYear : null;
    return worldAvgFor(yr) ?? worldAvgFor(2023);
  }, [data]);

  const stats = useMemo(() => {
    if (scatterPoints.length < 3 || !Number.isFinite(worldRef)) return null;
    const pacMed = median(scatterPoints.map((p) => p.x));
    const ratio = pacMed > 0 ? worldRef / pacMed : null;
    const yMed = median(scatterPoints.map((p) => p.y));
    const below = scatterPoints.filter(
      (p) => p.x < worldRef && Number.isFinite(yMed) && p.y > yMed,
    ).length;
    const most = scatterPoints.reduce(
      (m, p) => (!m || p.y > m.y ? p : m),
      null,
    );
    return { ratio, below, total: scatterPoints.length, most };
  }, [scatterPoints, worldRef]);

  // Nuage groupé par sous-région.
  const scatterGroups = useMemo(() => {
    const pal = [tk.accent, tk.warm, tk.positive, tk.secondary];
    return Object.keys(SUBREGIONS)
      .map((reg, i) => ({
        name: t(`act1.filter.${reg}`),
        color: pal[i % pal.length],
        points: scatterPoints
          .filter((p) => p.region === reg)
          .map((p) => ({
            x: Number(p.x.toFixed(2)),
            y: Math.round(p.y),
            name: p.name,
          })),
      }))
      .filter((g) => g.points.length);
  }, [scatterPoints, t, tk]);

  // Classement composite (vulnérabilité) filtré région.
  const rankComposite = useMemo(
    () =>
      Object.keys(composite)
        .filter((a) => isPict(a) && inRegion(a))
        .map((a) => ({
          area: a,
          name: pictName(a, lang),
          value: Math.round(composite[a]),
        }))
        .sort((x, y) => y.value - x.value),
    [composite, lang, inRegion],
  );
  const compMed = useMemo(
    () => median(rankComposite.map((r) => r.value)) ?? 0,
    [rankComposite],
  );

  // Classement de la responsabilité (GES/hab) filtré région.
  const rankEmissions = useMemo(() => {
    const emi = latest.emissions || {};
    return Object.keys(emi)
      .filter((a) => isPict(a) && inRegion(a))
      .map((a) => ({
        name: pictName(a, lang),
        value: Math.round(emi[a] * 100) / 100,
      }))
      .sort((x, y) => y.value - x.value);
  }, [latest, lang, inRegion]);
  const emiMed = useMemo(
    () => median(rankEmissions.map((r) => r.value)) ?? 0,
    [rankEmissions],
  );

  // Matrice territoires × stress (chaque ligne un territoire, colonnes = indicateurs).
  const indLabels = useMemo(
    () => activeVuln.map((k) => t(`act11.ind_${k}`)),
    [activeVuln, t],
  );
  const matrixSeries = useMemo(
    () =>
      rankComposite.map((r) => ({
        name: r.name,
        values: activeVuln
          .map((k) => ({
            year: t(`act11.ind_${k}`),
            value: Math.round((normByInd[k] || {})[r.area] ?? NaN),
          }))
          .filter((v) => Number.isFinite(v.value)),
      })),
    [rankComposite, activeVuln, normByInd, t],
  );

  // Empreinte radar : profil moyen de chaque sous-région sur les stress.
  const radarSeries = useMemo(
    () =>
      Object.keys(SUBREGIONS)
        .map((reg) => {
          const members = Object.keys(composite).filter(
            (a) => isPict(a) && REGION_OF[a] === reg,
          );
          if (!members.length) return null;
          const values = activeVuln.map((k) => {
            const vs = members
              .map((a) => (normByInd[k] || {})[a])
              .filter((v) => Number.isFinite(v));
            return vs.length
              ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length)
              : 0;
          });
          return { name: t(`act1.filter.${reg}`), values };
        })
        .filter(Boolean),
    [composite, activeVuln, normByInd, t],
  );
  const radarIndicators = useMemo(
    () => activeVuln.map((k) => ({ name: t(`act11.ind_${k}`), max: 100 })),
    [activeVuln, t],
  );

  const kpiItems = useMemo(() => {
    if (!stats) return [];
    const items = [];
    if (Number.isFinite(stats.ratio))
      items.push({
        key: "emi",
        value: `${Math.round(stats.ratio)}×`,
        unit: "",
        label: t("act11.stat_emi_label"),
        tone: "warm",
      });
    if (stats.most)
      items.push({
        key: "vuln",
        value: String(Math.round(stats.most.y)),
        unit: stats.most.name,
        label: t("act11.stat_vuln_label"),
        tone: "negative",
      });
    items.push({
      key: "inj",
      value: `${stats.below}/${stats.total}`,
      unit: "",
      label: t("act11.stat_inj_label"),
      tone: "warm",
    });
    return items;
  }, [stats, t]);

  const heatLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchSynthese({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  const regionOpts = REGION_KEYS.map((k) => ({
    v: k,
    label: t(`act1.filter.${k}`),
  }));
  const countryOpts = [
    { v: "all", label: t("act7.country_all") },
    ...countryOptions.map((c) => ({ v: c.area, label: c.name })),
  ];

  const status =
    state.status === "ready"
      ? scatterPoints.length
        ? "ready"
        : "empty"
      : state.status === "loading"
        ? "loading"
        : "empty";

  const filtersEl = (
    <>
      <Select
        label={t("act1.filter.title")}
        options={regionOpts}
        value={region}
        onChange={(k) => {
          setRegion(k);
          setCountry("all");
        }}
      />
      <Select
        label={t("act7.country_label")}
        options={countryOpts}
        value={country}
        onChange={setCountry}
      />
    </>
  );

  const charts =
    status === "ready"
      ? [
          {
            id: "paradox",
            signature: true,
            empty: scatterGroups.length === 0,
            tab: t("act11.board.tab_paradox"),
            title: t("act11.scatter_title"),
            finding: t("act11.board.paradox_find"),
            takeaway: t("act11.board.paradox_take"),
            node: (
              <ScatterChart
                groups={scatterGroups}
                unit={t("act11.index_unit")}
                medianX={medianX}
                xName={t("act11.scatter_x_unit")}
                yName={t("act11.scatter_y")}
              />
            ),
          },
          {
            id: "vuln",
            empty: rankComposite.length === 0,
            tab: t("act11.board.tab_vuln"),
            title: t("act11.rank_title"),
            finding: t("act11.board.vuln_find"),
            takeaway: t("act11.board.vuln_take"),
            node: (
              <RankChart
                points={rankComposite}
                unit={t("act11.index_unit")}
                median={compMed}
                refLabel={t("act6.median_ref")}
                sort="desc"
                scale="lin"
              />
            ),
          },
          {
            id: "matrix",
            empty: matrixSeries.length === 0,
            tab: t("act11.board.tab_matrix"),
            title: t("act11.board.matrix_title"),
            finding: t("act11.board.matrix_find"),
            takeaway: t("act11.board.matrix_take"),
            node: (
              <HeatmapChart
                series={matrixSeries}
                years={indLabels}
                unit={t("act11.index_unit")}
                mode="abs"
                ramp={[tk.positive, tk.warm, tk.negative]}
                labels={heatLabels}
              />
            ),
          },
          {
            id: "radar",
            empty: radarSeries.length < 2,
            tab: t("act11.board.tab_radar"),
            title: t("act11.board.radar_title"),
            finding: t("act11.board.radar_find"),
            takeaway: t("act11.board.radar_take"),
            node: (
              <ProfileRadar indicators={radarIndicators} series={radarSeries} />
            ),
          },
          {
            id: "resp",
            empty: rankEmissions.length === 0,
            tab: t("act11.board.tab_resp"),
            title: t("act11.board.resp_title"),
            finding: t("act11.board.resp_find"),
            takeaway: t("act11.board.resp_take"),
            node: (
              <RankChart
                points={rankEmissions}
                unit={t("act11.scatter_x_unit")}
                median={emiMed}
                refLabel={t("act6.median_ref")}
                sort="desc"
                scale="lin"
              />
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act11.tag")}
      title={t("act11.title")}
      thesis={t("act11.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 11, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act11.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act11.board.switch_hint"),
        signature: t("act11.board.signature"),
        takeawayKicker: t("act11.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act11.board.start"),
        conclusion: t("act11.board.conclusion"),
        backIntro: t("act11.board.back_intro"),
        reviseData: t("act11.board.revise_data"),
      }}
      outro={{
        kicker: t("act11.outro.kicker"),
        title: t("act11.outro.title"),
        text: t("act11.outro.text"),
        primary: { to: "/", label: t("act11.outro.next") },
        secondary: { to: "/emissions", label: t("act11.outro.home") },
      }}
    />
  );
}
