// src/pages/Act7Vivant/Act7Vivant.jsx
// ============================================================
// Acte 07 — Le vivant. Deux indicateurs réels du PDH, joints par GEO_PICT :
//   • Liste Rouge (DF_SDG_15, ER_RSK_LST) — indice de risque d'extinction (0–1, recule = pire).
//   • Gestion des pêches (DF_CLIMATE_CHANGE, FISH_MNGT_MULT_BILAT_ARGMT) — mesures en place (cumul, monte).
//
// MÊME EXPÉRIENCE que les actes 3–6 : diaporama plein écran, filtres
// repliables (sous-région + focus territoire), navigation clavier/boutons,
// écran de fin. On GARDE l'existant (small multiples, heatmap, classement,
// dumbbell) et on AJOUTE des vues ApexCharts :
//   • BandTrend (médiane + bande de dispersion) pour chaque trajectoire,
//   • jauge « santé biodiversité » (indice Liste Rouge ×100),
//   • scatter CROISÉ Liste Rouge × gestion des pêches (la gestion protège-t-elle ?).
// 100 % données API. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchVivant } from "../../services/vivantApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import VizPanel from "../../components/charts/VizPanel";
import BandTrendChart from "../../components/charts/BandTrendChart";
import RadialGauge from "../../components/charts/RadialGauge";
import ScatterChart from "../../components/charts/ScatterChart";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import Loader from "../../components/Loader/Loader";
import "./Act7Vivant.scss";

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

function valueAt(values, year) {
  if (!values || !values.length) return null;
  let out = null;
  for (const p of values) {
    if (p.year === year) return p.value;
    if (p.year <= year) out = p.value;
  }
  return out;
}
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function pct(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function toSeries(ind, lang) {
  if (!ind || ind.status !== "live") return [];
  return (ind.areas || [])
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (ind.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }))
    .filter((s) => s.values.length);
}
function buildRank(series, year) {
  return series
    .map((s) => ({ area: s.area, name: s.name, value: valueAt(s.values, year) }))
    .filter((r) => Number.isFinite(r.value));
}
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => ({ area: s.area, name: s.name, a: valueAt(s.values, yearA), b: valueAt(s.values, yearB) }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}
// Bande régionale : médiane + p10/p90 par année sur les territoires visibles.
function bandOf(series, years) {
  return (years || [])
    .map((y) => {
      const v = series
        .map((s) => valueAt(s.values, y))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (!v.length) return null;
      const md = median(v);
      return { year: y, mean: md, min: pct(v, 0.1), max: pct(v, 0.9) };
    })
    .filter(Boolean);
}

function Pills({ label, value, isActive, onChange }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      <span className="act1f__lbl">{label}</span>
      <div className="act1f__pills">
        {REGION_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`act1f__pill ${isActive(k) ? "is-active" : ""}`}
            onClick={() => onChange(k)}
            aria-pressed={isActive(k)}
          >
            {value(k)}
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

export default function Act7Vivant() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const activeRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchVivant({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({ status: res.source === "live" ? "ready" : "empty", data: res });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const rl = data?.redList;
  const fish = data?.fishMgmt;

  const rlAll = useMemo(() => toSeries(rl, lang), [rl, lang]);
  const fishAll = useMemo(() => toSeries(fish, lang), [fish, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([...rlAll.map((s) => s.area), ...fishAll.map((s) => s.area)]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [rlAll, fishAll, lang]);

  const areaVisible = useMemo(() => {
    if (country !== "all") return (a) => a === country;
    return (a) => region === "all" || REGION_OF[a] === region;
  }, [region, country]);

  const rlSeries = useMemo(() => rlAll.filter((s) => areaVisible(s.area)), [rlAll, areaVisible]);
  const fishSeries = useMemo(() => fishAll.filter((s) => areaVisible(s.area)), [fishAll, areaVisible]);

  const regionLabel = country !== "all" ? pictName(country, lang) : t(`act1.filter.${region}`);
  const medName = `${regionLabel} · ${t("act7.median_name")}`;
  const single = country !== "all";

  const rlA = rl?.firstYear ?? (rl?.years?.[0] ?? 1993);
  const rlB = rl?.lastYear ?? (rl?.years?.[rl?.years?.length - 1] ?? 2024);
  const fishA = fish?.firstYear ?? (fish?.years?.[0] ?? 1980);
  const fishB = fish?.lastYear ?? (fish?.years?.[fish?.years?.length - 1] ?? 2024);

  const rlRank = useMemo(() => buildRank(rlSeries, rlB), [rlSeries, rlB]);
  const rlDumb = useMemo(() => buildDumbbell(rlSeries, rlA, rlB), [rlSeries, rlA, rlB]);
  const rlMed = useMemo(() => {
    const m = median(rlRank.map((r) => r.value));
    return m == null ? null : Math.round(m * 100) / 100;
  }, [rlRank]);
  const rlBand = useMemo(() => bandOf(rlSeries, rl?.years || []), [rlSeries, rl]);

  const fishRank = useMemo(() => buildRank(fishSeries, fishB), [fishSeries, fishB]);
  const fishDumb = useMemo(() => buildDumbbell(fishSeries, fishA, fishB), [fishSeries, fishA, fishB]);
  const fishMed = useMemo(() => {
    const m = median(fishRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [fishRank]);
  const fishBand = useMemo(() => bandOf(fishSeries, fish?.years || []), [fishSeries, fish]);

  // Scatter croisé : gestion des pêches (x) × indice Liste Rouge (y), par territoire.
  const REGION_COLOR = useMemo(
    () => ({ melanesia: tk.accent, polynesia: tk.warm, micronesia: tk.positive }),
    [tk],
  );
  const scatterGroups = useMemo(() => {
    const rlBy = {};
    rlRank.forEach((r) => (rlBy[r.area] = r.value));
    const fishBy = {};
    fishRank.forEach((r) => (fishBy[r.area] = r.value));
    const areas = Object.keys(rlBy).filter((a) => fishBy[a] != null);
    return REGIONS3.map((rg) => ({
      name: t(`act1.filter.${rg}`),
      color: REGION_COLOR[rg],
      points: areas
        .filter((a) => REGION_OF[a] === rg)
        .map((a) => ({ x: fishBy[a], y: rlBy[a], name: pictName(a, lang) })),
    })).filter((g) => g.points.length);
  }, [rlRank, fishRank, lang, t, REGION_COLOR]);
  const scatterCount = useMemo(
    () => scatterGroups.reduce((s, g) => s + g.points.length, 0),
    [scatterGroups],
  );
  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  const hmLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  const onRegion = useCallback((k) => {
    setRegion(k);
    setCountry("all");
  }, []);

  // ---------- Navigation diaporama ----------
  const goTo = useCallback((i) => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll(".act1slide"));
    if (!nodes.length) return;
    const idx = Math.max(0, Math.min(nodes.length - 1, i));
    const top = nodes[idx].getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const compute = () => {
      const nodes = Array.from(root.querySelectorAll(".act1slide"));
      setSlideCount(nodes.length);
      const mid = window.innerHeight * 0.4;
      let idx = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const r = nodes[i].getBoundingClientRect();
        if (r.top <= mid) idx = i;
        else break;
      }
      setActive(idx);
      activeRef.current = idx;
    };
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [state.status, region, country, lang]);

  useEffect(() => {
    if (state.status !== "ready") return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(activeRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status, goTo]);

  const filtersEl = (
    <>
      <Pills
        label={t("act1.filter.title")}
        isActive={(k) => country === "all" && region === k}
        value={(k) => t(`act1.filter.${k}`)}
        onChange={onRegion}
      />
      <Selecter
        label={t("act7.country_label")}
        value={country}
        options={[{ v: "all", label: t("act7.country_all") }].concat(
          countryOptions.map((c) => ({ v: c.area, label: c.name })),
        )}
        onChange={setCountry}
      />
    </>
  );
  const FT = t("act1.f.toggle");

  return (
    <main className="act1 act7" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("act7.tag")}</p>
          <h1 className="act1__title">{t("act7.title")}</h1>
          <p className="act1__lead">{t("act7.lead")}</p>
        </header>

        {state.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {state.status === "empty" && (
          <p className="act1__state act1__state--err">{t("act7.unavailable")}</p>
        )}

        {state.status === "ready" && (
          <>
            {/* ---------- Liste Rouge ---------- */}
            {rlSeries.length > 0 && (
              <>
                <section className="act1slide act1text">
                  <div className="act1text__inner">
                    <h2 className="act1text__title">{t("act7.redlist_title")}</h2>
                    <p className="act1text__lead">{t("act7.redlist_sub")}</p>
                    <span className="act1text__hint" aria-hidden="true">↓</span>
                  </div>
                </section>

                {!single && rlBand.length > 0 && (
                  <VizPanel title={t("act7.regional_rl_title")} subtitle={t("act7.regional_rl_sub")} story={t("act7.story.rl_trend")} filtersLabel={FT} filters={filtersEl}>
                    <BandTrendChart data={rlBand} unit={t("act7.redlist_unit")} refValue={null} meanLabel={t("act7.median_name")} currentYear={rlB} color={tk.accent} />
                  </VizPanel>
                )}

                <VizPanel title={t("act7.redlist_title")} subtitle={`${rlA}–${rlB} · ${rlSeries.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={rlSeries} years={rl.years} unit={t("act7.redlist_unit")} currentYear={rlB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act7.rl_heatmap_title")} subtitle={t("act7.rl_heatmap_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={rlSeries} years={rl.years} unit={t("act7.redlist_unit")} scale="sequential" labels={hmLabels} />
                </VizPanel>

                <VizPanel title={t("act7.rl_rank_title")} subtitle={t("act7.rl_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={rlRank} unit={t("act7.redlist_unit")} worldAvg={rlMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                <VizPanel title={t("act7.rl_compare_title")} subtitle={t("act7.rl_compare_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={rlDumb} yearA={rlA} yearB={rlB} unit={t("act7.redlist_unit")} labels={cmpLabels} />
                </VizPanel>

                <VizPanel title={t("act7.gauge_title")} subtitle={t("act7.gauge_sub")} story={t("act7.story.gauge")} filtersLabel={FT} filters={filtersEl}>
                  <RadialGauge value={Math.round((rlMed ?? 0) * 100)} label={t("act7.gauge_label")} color={tk.positive} />
                </VizPanel>
              </>
            )}

            {/* ---------- Gestion des pêches ---------- */}
            {fishSeries.length > 0 && (
              <>
                <section className="act1slide act1text">
                  <div className="act1text__inner">
                    <h2 className="act1text__title">{t("act7.fish_title")}</h2>
                    <p className="act1text__lead">{t("act7.fish_sub")}</p>
                    <span className="act1text__hint" aria-hidden="true">↓</span>
                  </div>
                </section>

                {!single && fishBand.length > 0 && (
                  <VizPanel title={t("act7.regional_fish_title")} subtitle={t("act7.regional_fish_sub")} story={t("act7.story.fish_trend")} filtersLabel={FT} filters={filtersEl}>
                    <BandTrendChart data={fishBand} unit={t("act7.fish_unit")} refValue={null} meanLabel={t("act7.median_name")} currentYear={fishB} color={tk.positive} />
                  </VizPanel>
                )}

                <VizPanel title={t("act7.fish_title")} subtitle={`${fish.firstYear}–${fishB} · ${fishSeries.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={fishSeries} years={fish.years} unit={t("act7.fish_unit")} currentYear={fishB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act7.fish_heatmap_title")} subtitle={t("act7.fish_heatmap_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={fishSeries} years={fish.years} unit={t("act7.fish_unit")} scale="sequential" labels={hmLabels} />
                </VizPanel>

                <VizPanel title={t("act7.fish_rank_title")} subtitle={t("act7.fish_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={fishRank} unit={t("act7.fish_unit")} worldAvg={fishMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                <VizPanel title={t("act7.fish_compare_title")} subtitle={t("act7.fish_compare_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={fishDumb} yearA={fishA} yearB={fishB} unit={t("act7.fish_unit")} labels={cmpLabels} />
                </VizPanel>
              </>
            )}

            {/* ---------- Croisement : la gestion protège-t-elle le vivant ? ---------- */}
            {scatterCount >= 3 && (
              <VizPanel title={t("act7.scatter_title")} subtitle={t("act7.scatter_sub")} story={t("act7.story.scatter")} filtersLabel={FT} filters={filtersEl}>
                <ScatterChart
                  groups={scatterGroups}
                  unit={t("act7.fish_unit")}
                  medianX={scatterMedianX}
                  xName={t("act7.scatter_x")}
                  yName={t("act7.redlist_unit")}
                />
              </VizPanel>
            )}

            {rlSeries.length === 0 && fishSeries.length === 0 && (
              <p className="act1__state">{t("act1.change.empty")}</p>
            )}

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act7.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act7.outro.title")}</h2>
                <p className="act1outro__text">{t("act7.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/ciel" className="act1outro__btn act1outro__btn--primary">
                    {t("act7.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act7.outro.home")}
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}

        <Link to="/" className="act1__back">
          ← {t("act1.back")}
        </Link>
      </div>

      {state.status === "ready" && slideCount > 0 && (
        <div className="act1nav" role="group" aria-label={t("act1.nav.next")}>
          <button type="button" className="act1nav__btn" onClick={() => goTo(active - 1)} disabled={active <= 0} aria-label={t("act1.nav.prev")}>
            ↑
          </button>
          <span className="act1nav__count">
            {active + 1}/{slideCount}
          </span>
          <button type="button" className="act1nav__btn" onClick={() => goTo(active + 1)} disabled={active >= slideCount - 1} aria-label={t("act1.nav.next")}>
            ↓
          </button>
        </div>
      )}
    </main>
  );
}