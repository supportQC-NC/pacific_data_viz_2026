// src/pages/Act5Momentum/Act5Momentum.jsx
// ============================================================
// Acte 05 — L'élan : part des énergies renouvelables par territoire (SPC).
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (sous-région + année),
// la bande de tendance régionale en SIGNATURE. Tableau retiré ; classement
// ANIMÉ (BarRace) + trajectoires ajoutés. 5 graphes.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import BarRace from "../../components/BarRace/BarRace";
import TrendChart from "../../components/charts/TrendChart";
import PowerMixChart from "../../components/charts/PowerMixChart";
import MixCompositionChart from "../../components/charts/MixCompositionChart";
import RankChart from "../../components/charts/RankChart";
import { fetchPowerMix } from "../../services/powerApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import { fmt } from "../../components/charts/echartsBase";
import "./Act5Momentum.scss";

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

function pct(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function meanSeries(d, inR) {
  if (!d) return [];
  return d.years
    .map((year) => {
      const vals = [];
      d.areas.forEach((a) => {
        if (!isPict(a) || !inR(a)) return;
        const p = (d.byArea[a] || []).find((q) => q.year === year);
        if (p && Number.isFinite(p.value)) vals.push(p.value);
      });
      if (!vals.length) return null;
      const s = [...vals].sort((x, y) => x - y);
      const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;
      return { year, mean, min: pct(s, 0.1), max: pct(s, 0.9) };
    })
    .filter(Boolean);
}
function allSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => ({ area: a, name: pictName(a, lang), values: (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)) }));
}
// Pour la course : on remplit chaque année avec la dernière valeur connue
// (report en avant) pour une animation fluide malgré les trous.
function raceSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const s = (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)).sort((x, y) => x.year - y.year);
      let last = null;
      const values = d.years.map((y) => {
        const exact = s.find((p) => p.year === y);
        if (exact) last = exact.value;
        return { year: y, value: last == null ? 0 : last };
      });
      return { area: a, name: pictName(a, lang), values };
    })
    .filter((r) => r.values.some((v) => v.value > 0));
}
function pointsAt(d, year, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const s = d.byArea[a] || [];
      let chosen = null;
      for (let i = 0; i < s.length; i += 1) {
        if (s[i].year <= year && Number.isFinite(s[i].value)) chosen = s[i];
      }
      return chosen ? { area: a, code: a, name: pictName(a, lang), value: chosen.value, year: chosen.year } : null;
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

export default function Act5Momentum() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();
  const renew = useSelector(selectDataset("renewables"));

  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [mix, setMix] = useState({ status: "loading", data: null });

  useEffect(() => {
    dispatch(loadDataset("renewables"));
  }, [dispatch]);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setMix((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchPowerMix({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      const ok = res.source === "live" && res.years.length > 0;
      setMix({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const ready = renew.status === "succeeded";
  const failed = renew.status === "failed";
  const data = renew.data;
  const years = useMemo(() => (data ? data.years : []), [data]);

  // Année la mieux couverte (évite d'ouvrir sur une année creuse).
  const bestIdx = useMemo(() => {
    if (!data) return 0;
    let best = 0;
    let bestCov = -1;
    data.years.forEach((y, i) => {
      let cov = 0;
      data.areas.forEach((a) => {
        if (!isPict(a)) return;
        const p = (data.byArea[a] || []).find((q) => q.year === y);
        if (p && Number.isFinite(p.value)) cov += 1;
      });
      if (cov >= bestCov) {
        bestCov = cov;
        best = i;
      }
    });
    return best;
  }, [data]);

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(bestIdx);
  }, [years, yearIdx, bestIdx]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;
  const inRegion = useCallback((area) => region === "all" || REGION_OF[area] === region, [region]);

  const trend = useMemo(() => meanSeries(data, inRegion), [data, inRegion]);
  const series = useMemo(() => allSeries(data, lang, inRegion), [data, lang, inRegion]);
  const race = useMemo(() => raceSeries(data, lang, inRegion), [data, lang, inRegion]);
  const points = useMemo(() => (data && currentYear != null ? pointsAt(data, currentYear, lang, inRegion) : []), [data, currentYear, lang, inRegion]);
  const regionalMean = useMemo(() => (points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : 0), [points]);
  const overallMax = useMemo(() => (data ? Math.max(1, data.range.max) : 100), [data]);

  // ---- Mix électrique par source (powerApi, en parallèle des renouvelables) ----
  const mixReady = mix.status === "ready" && !!mix.data;
  const mixYears = useMemo(() => (mix.data ? mix.data.years : []), [mix.data]);
  const sumByYear = useCallback(
    (pick) => {
      const d = mix.data;
      if (!d) return [];
      return mixYears.map((y) => {
        let acc = 0;
        Object.keys(d.byArea).forEach((geo) => {
          if (!isPict(geo) || !inRegion(geo)) return;
          acc += pick(d.byArea[geo], y);
        });
        return acc;
      });
    },
    [mix.data, mixYears, inRegion],
  );
  const mixBandSeries = useMemo(() => {
    if (!mix.data) return [];
    return [
      { name: t("act5.mix.fossil"), color: tk.warm, data: sumByYear((a, y) => a.fossil[y] || 0) },
      { name: t("act5.mix.renew"), color: tk.positive, data: sumByYear((a, y) => a.renew[y] || 0) },
    ];
  }, [mix.data, sumByYear, t, tk]);
  const mixDetailSeries = useMemo(() => {
    const d = mix.data;
    if (!d) return [];
    const fossilPal = [tk.warm, tk.negative, tk.accentDeep, tk.secondary];
    const renewPal = [tk.positive, tk.accent, tk.secondary, tk.accentDeep, tk.warm];
    let fi = 0;
    let ri = 0;
    return d.detailSources.map((sx) => {
      const color = sx.kind === "fossil" ? fossilPal[fi++ % fossilPal.length] : renewPal[ri++ % renewPal.length];
      return { name: sx.label, color, data: sumByYear((a, y) => (a.detail[sx.label] || {})[y] || 0) };
    });
  }, [mix.data, sumByYear, tk]);

  // Année du mix alignée sur le curseur (mix : 2000→2023, sinon dernière connue).
  const mixYear = useMemo(() => {
    if (!mixYears.length) return null;
    if (currentYear == null) return mixYears[mixYears.length - 1];
    const le = mixYears.filter((y) => y <= currentYear);
    return le.length ? le[le.length - 1] : mixYears[0];
  }, [mixYears, currentYear]);
  const shareAt = (a, y) => {
    const f = a.fossil[y] || 0;
    const r = a.renew[y] || 0;
    return f + r > 0 ? r / (f + r) : null;
  };
  // Composition par territoire (barres empilées 100 % par source) à mixYear.
  const mixCompo = useMemo(() => {
    const d = mix.data;
    if (!d || mixYear == null) return { categories: [], series: [] };
    const terr = Object.keys(d.byArea)
      .filter((g) => isPict(g) && inRegion(g) && ((d.byArea[g].fossil[mixYear] || 0) + (d.byArea[g].renew[mixYear] || 0)) > 0)
      .sort((g1, g2) => (shareAt(d.byArea[g1], mixYear) || 0) - (shareAt(d.byArea[g2], mixYear) || 0));
    const fossilPal = [tk.warm, tk.negative, tk.accentDeep, tk.secondary];
    const renewPal = [tk.positive, tk.accent, tk.secondary, tk.accentDeep, tk.warm];
    let fi = 0;
    let ri = 0;
    const series = d.detailSources.map((sx) => {
      const color = sx.kind === "fossil" ? fossilPal[fi++ % fossilPal.length] : renewPal[ri++ % renewPal.length];
      return { name: sx.label, color, data: terr.map((g) => Math.round(((d.byArea[g].detail[sx.label] || {})[mixYear] || 0) * 10) / 10) };
    });
    return { categories: terr.map((g) => pictName(g, lang)), series };
  }, [mix.data, mixYear, inRegion, lang, tk]);
  // Classement de la part renouvelable (%) par territoire à mixYear.
  const mixShare = useMemo(() => {
    const d = mix.data;
    if (!d || mixYear == null) return { points: [], median: 0 };
    const points = Object.keys(d.byArea)
      .filter((g) => isPict(g) && inRegion(g))
      .map((g) => {
        const sh = shareAt(d.byArea[g], mixYear);
        return sh == null ? null : { name: pictName(g, lang), value: Math.round(sh * 1000) / 10 };
      })
      .filter(Boolean);
    const vals = points.map((pt) => pt.value).sort((x, y) => x - y);
    const n = vals.length;
    const med = n ? (n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2) : 0;
    return { points, median: med };
  }, [mix.data, mixYear, inRegion, lang]);

  const unit = t("act5.unit");
  const evoLabels = useMemo(
    () => ({ improved: t("act5.evo_down"), worsened: t("act5.evo_up"), since: t("act1.evo.since"), no_data: t("act1.evo.no_data") }),
    [t],
  );

  const kpiItems = useMemo(() => {
    if (!ready || !points.length) return [];
    const sorted = [...points].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    return [
      { key: "mean", value: fmt(regionalMean, 1), unit, label: t("act5.board.kpi_mean"), tone: "accent" },
      { key: "high", value: fmt(high.value, 1), unit: high.name, label: t("act5.board.kpi_high"), tone: "positive" },
      { key: "low", value: fmt(low.value, 1), unit: low.name, label: t("act5.board.kpi_low"), tone: "warm" },
    ];
  }, [ready, points, regionalMean, unit, t]);

  const retry = useCallback(() => dispatch(loadDataset("renewables")), [dispatch]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const status = failed ? "error" : !ready ? "loading" : years.length === 0 ? "empty" : "ready";

  const filtersEl = (
    <>
      <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
      <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={(i) => setYearIdx(i)} />
    </>
  );

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            id: "trend",
            signature: true,
            empty: trend.length < 2,
            tab: t("act5.board.tab_trend"),
            title: t("act5.ren_title"),
            finding: t("act5.board.trend_find"),
            takeaway: t("act5.board.trend_take"),
            node: (
              <div className="act5b__scroll">
                <AnomalyTrend data={trend} currentYear={currentYear} unit={unit} tone="green" baselineLabel={t("act5.baseline")} meanLabel={t("act5.mean_label")} />
              </div>
            ),
          },
          {
            id: "lines",
            empty: series.length === 0,
            tab: t("act5.board.tab_lines"),
            title: t("act5.board.lines_title"),
            finding: t("act5.board.lines_find"),
            takeaway: t("act5.board.lines_take"),
            node: <TrendChart series={series} years={years} unit={unit} scale="lin" />,
          },
          {
            id: "rank",
            empty: race.length === 0,
            tab: t("act5.board.tab_rank"),
            title: t("act5.board.rank_title"),
            finding: t("act5.board.rank_find"),
            takeaway: t("act5.board.rank_take"),
            node: <BarRace series={race} years={years} unit={unit} tk={tk} labels={{ play: t("act1.race.play"), pause: t("act1.race.pause"), restart: t("act1.race.restart") }} />,
          },
          {
            id: "map",
            empty: points.length === 0,
            tab: t("act5.board.tab_map"),
            title: `${t("act5.map_title")} · ${currentYear}`,
            finding: t("act5.board.map_find"),
            takeaway: t("act5.board.map_take"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap data={points} unit={unit} range={{ min: 0, max: overallMax }} ramp="good" lowLabel={t("act5.map_low")} highLabel={t("act5.map_high")} noTokenMsg={t("act1.map_no_token")} />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "evo",
            empty: series.length === 0,
            tab: t("act5.board.tab_evo"),
            title: t("act5.evo_title"),
            finding: t("act5.board.evo_find"),
            takeaway: t("act5.board.evo_take"),
            node: (
              <div className="act5b__scroll">
                <EvolutionPanel series={series} labels={evoLabels} unit={unit} mode="absolute" topN={5} />
              </div>
            ),
          },
          {
            id: "mix_band",
            empty: !mixReady || mixBandSeries.every((sx) => sx.data.every((v) => !v)),
            tab: t("act5.board.tab_mix_band"),
            title: t("act5.mix.band_title"),
            finding: t("act5.board.mix_band_find"),
            takeaway: t("act5.board.mix_band_take"),
            node: <PowerMixChart series={mixBandSeries} years={mixYears} unit={t("act5.mix.unit")} />,
          },
          {
            id: "mix_detail",
            empty: !mixReady || mixDetailSeries.length === 0,
            tab: t("act5.board.tab_mix_detail"),
            title: t("act5.mix.detail_title"),
            finding: t("act5.board.mix_detail_find"),
            takeaway: t("act5.board.mix_detail_take"),
            node: <PowerMixChart series={mixDetailSeries} years={mixYears} unit={t("act5.mix.unit")} />,
          },
          {
            id: "mix_compo",
            empty: !mixReady || mixCompo.categories.length === 0,
            tab: t("act5.board.tab_mix_compo"),
            title: `${t("act5.mix.compo_title")} · ${mixYear ?? ""}`,
            finding: t("act5.board.mix_compo_find"),
            takeaway: t("act5.board.mix_compo_take"),
            node: <MixCompositionChart series={mixCompo.series} categories={mixCompo.categories} unit={t("act5.mix.unit")} />,
          },
          {
            id: "mix_share",
            empty: !mixReady || mixShare.points.length === 0,
            tab: t("act5.board.tab_mix_share"),
            title: `${t("act5.mix.share_title")} · ${mixYear ?? ""}`,
            finding: t("act5.board.mix_share_find"),
            takeaway: t("act5.board.mix_share_take"),
            node: <RankChart points={mixShare.points} unit="%" median={mixShare.median} refLabel={t("act5.mix.share_ref")} sort="desc" scale="lin" />,
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a5_tag")}
      title={t("home.acts.a5_title")}
      thesis={t("act5.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 5, total: 11 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act5.board.switch_hint"),
        signature: t("act5.board.signature"),
        takeawayKicker: t("act5.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act5.board.start"),
        conclusion: t("act5.board.conclusion"),
        backIntro: t("act5.board.back_intro"),
        reviseData: t("act5.board.revise_data"),
      }}
      outro={{
        kicker: t("act5.outro.kicker"),
        title: t("act5.outro.title"),
        text: t("act5.outro.text"),
        primary: { to: "/agriculture", label: t("act5.outro.next") },
        secondary: { to: "/", label: t("act5.outro.home") },
      }}
    />
  );
}