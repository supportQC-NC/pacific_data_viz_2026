// src/pages/Act9Eco/Act9Eco.jsx
// ============================================================
// Acte 09 — « L'économie exposée ». Trois indicateurs réels du PDH :
//   • Tourisme    (TRSM_ARR)  — arrivées de visiteurs (exposition).
//   • Électricité (POWER_GEN) — production GWh (empreinte énergétique).
//   • Fiscalité   (DF_ENV_TAXES) — taxes environnementales (% du PIB, le levier).
//
// MÊME EXPÉRIENCE que les actes 3–8 : diaporama plein écran (la page EST le
// diaporama, plus de mode présentation séparé), filtres repliables
// (sous-région + territoire), navigation clavier/boutons, écran de fin.
// Guides retirés. On GARDE l'existant (tendance régionale, small multiples,
// heatmap, classement, dumbbell) et on AJOUTE :
//   • treemap (part du tourisme par territoire),
//   • Pareto (concentration du tourisme),
//   • scatter croisé tourisme × électricité,
//   • jauge fiscalité environnementale (médiane % PIB).
// Dumbbell corrigé (1re→dernière valeur propre à chaque territoire).
// 100 % données API. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchEco } from "../../services/ecoApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import VizPanel from "../../components/charts/VizPanel";
import TreemapChart from "../../components/charts/TreemapChart";
import ParetoChart from "../../components/charts/ParetoChart";
import ScatterChart from "../../components/charts/ScatterChart";
import RadialGauge from "../../components/charts/RadialGauge";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import Loader from "../../components/Loader/Loader";
import "./Act9Eco.scss";

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
function buildRankMax(series) {
  return series
    .map((s) => {
      const vals = s.values.map((p) => p.value).filter((n) => Number.isFinite(n));
      return { area: s.area, name: s.name, value: vals.length ? Math.max(...vals) : null };
    })
    .filter((r) => Number.isFinite(r.value) && r.value > 0);
}
// « Avant → après » propre à chaque territoire (1re et dernière valeur observées).
function buildEnds(series) {
  return series
    .map((s) => {
      const v = (s.values || []).filter((p) => Number.isFinite(p.value));
      if (!v.length) return null;
      return { area: s.area, name: s.name, a: v[0].value, b: v[v.length - 1].value };
    })
    .filter(Boolean);
}
function totalLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n));
      return got.length ? { year: y, value: got.reduce((a, b) => a + b, 0) } : null;
    })
    .filter(Boolean);
  return vals.length ? [{ area: "REG", name, values: vals }] : [];
}
function medianLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n));
      const m = median(got);
      return m == null ? null : { year: y, value: m };
    })
    .filter(Boolean);
  return vals.length ? [{ area: "MED", name, values: vals }] : [];
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
function TextSlide({ title, sub }) {
  return (
    <section className="act1slide act1text">
      <div className="act1text__inner">
        <h2 className="act1text__title">{title}</h2>
        {sub ? <p className="act1text__lead">{sub}</p> : null}
        <span className="act1text__hint" aria-hidden="true">↓</span>
      </div>
    </section>
  );
}

export default function Act9Eco() {
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
    fetchEco({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({ status: res.source === "live" ? "ready" : "empty", data: res });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const tour = data?.tourism;
  const power = data?.power;
  const tax = data?.envTax;

  const tourAll = useMemo(() => toSeries(tour, lang), [tour, lang]);
  const powerAll = useMemo(() => toSeries(power, lang), [power, lang]);
  const taxAll = useMemo(() => toSeries(tax, lang), [tax, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([...tourAll.map((s) => s.area), ...powerAll.map((s) => s.area), ...taxAll.map((s) => s.area)]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [tourAll, powerAll, taxAll, lang]);

  const areaVisible = useMemo(() => {
    if (country !== "all") return (a) => a === country;
    return (a) => region === "all" || REGION_OF[a] === region;
  }, [region, country]);

  const tourS = useMemo(() => tourAll.filter((s) => areaVisible(s.area)), [tourAll, areaVisible]);
  const powerS = useMemo(() => powerAll.filter((s) => areaVisible(s.area)), [powerAll, areaVisible]);
  const taxS = useMemo(() => taxAll.filter((s) => areaVisible(s.area)), [taxAll, areaVisible]);

  const onRegion = useCallback((k) => {
    setRegion(k);
    setCountry("all");
  }, []);
  const single = country !== "all";

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [tourA, tourB] = span(tour, 1995, 2024);
  const [powerA, powerB] = span(power, 2000, 2023);
  const [taxA, taxB] = span(tax, 1995, 2021);

  const tourLine = useMemo(() => totalLine(tourS, tour?.years || [], t("act9.tour_total_name")), [tourS, tour, t]);
  const powerLine = useMemo(() => totalLine(powerS, power?.years || [], t("act9.power_total_name")), [powerS, power, t]);
  const taxLine = useMemo(() => medianLine(taxS, tax?.years || [], t("act9.tax_median_name")), [taxS, tax, t]);

  const tourRank = useMemo(() => buildRank(tourS, tourB), [tourS, tourB]);
  const powerRank = useMemo(() => buildRank(powerS, powerB), [powerS, powerB]);
  const taxRank = useMemo(() => buildRankMax(taxS), [taxS]);
  const tourMed = useMemo(() => {
    const m = median(tourRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [tourRank]);
  const powerMed = useMemo(() => {
    const m = median(powerRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [powerRank]);
  const taxMed = useMemo(() => {
    const m = median(taxRank.map((r) => r.value));
    return m == null ? null : Math.round(m * 100) / 100;
  }, [taxRank]);

  const tourDumb = useMemo(() => buildEnds(tourS), [tourS]);
  const powerDumb = useMemo(() => buildEnds(powerS), [powerS]);

  // Scatter croisé : tourisme (X) × électricité (Y), par territoire.
  const REGION_COLOR = useMemo(
    () => ({ melanesia: tk.accent, polynesia: tk.warm, micronesia: tk.positive }),
    [tk],
  );
  const scatterGroups = useMemo(() => {
    const tBy = {};
    tourRank.forEach((r) => (tBy[r.area] = r.value));
    const pBy = {};
    powerRank.forEach((r) => (pBy[r.area] = r.value));
    const areas = Object.keys(tBy).filter((a) => pBy[a] != null);
    return REGIONS3.map((rg) => ({
      name: t(`act1.filter.${rg}`),
      color: REGION_COLOR[rg],
      points: areas
        .filter((a) => REGION_OF[a] === rg)
        .map((a) => ({ x: tBy[a], y: pBy[a], name: pictName(a, lang) })),
    })).filter((g) => g.points.length);
  }, [tourRank, powerRank, lang, t, REGION_COLOR]);
  const scatterCount = useMemo(() => scatterGroups.reduce((s, g) => s + g.points.length, 0), [scatterGroups]);
  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  const fmtN = useCallback(
    (v) => Math.round(Number(v) || 0).toLocaleString(lang === "en" ? "en-US" : "fr-FR"),
    [lang],
  );
  const seqLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

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
        labelOf={(k) => t(`act1.filter.${k}`)}
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
    <main className="act1 act9" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("act9.tag")}</p>
          <h1 className="act1__title">{t("act9.title")}</h1>
          <p className="act1__lead">{t("act9.lead")}</p>
        </header>

        {state.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {state.status === "empty" && <p className="act1__state act1__state--err">{t("act9.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            {/* ---------- Tourisme : l'exposition ---------- */}
            {tourS.length > 0 && (
              <>
                <TextSlide title={t("act9.tour_title")} sub={t("act9.tour_sub")} />

                {!single && tourLine.length > 0 && (
                  <VizPanel title={t("act9.regional_tour_title")} subtitle={t("act9.regional_tour_sub")} filtersLabel={FT} filters={filtersEl}>
                    <TrendLines series={tourLine} years={tour.years} currentYear={tourB} unit={t("act9.tour_unit")} />
                  </VizPanel>
                )}

                <VizPanel title={t("act9.tour_sm_title")} subtitle={`${tourA}–${tourB} · ${tourS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={tourS} years={tour.years} unit={t("act9.tour_unit")} currentYear={tourB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act9.tour_hm_title")} subtitle={t("act9.tour_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={tourS} years={tour.years} unit={t("act9.tour_unit")} scale="sequential" labels={seqLabels} />
                </VizPanel>

                <VizPanel title={t("act9.tour_rank_title")} subtitle={t("act9.tour_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={tourRank} unit={t("act9.tour_unit")} worldAvg={tourMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                <VizPanel title={t("act9.tour_tree_title")} subtitle={`${t("act9.tour_tree_sub")} · ${tourB}`} story={t("act9.story.tour_tree")} filtersLabel={FT} filters={filtersEl}>
                  <TreemapChart rows={tourRank} unit={t("act9.tour_unit")} format={fmtN} />
                </VizPanel>

                <VizPanel title={t("act9.tour_pareto_title")} subtitle={`${t("act9.tour_pareto_sub")} · ${tourB}`} story={t("act9.story.tour_pareto")} filtersLabel={FT} filters={filtersEl}>
                  <ParetoChart rows={tourRank} unit={t("act9.tour_unit")} cumulLabel={t("act4.pareto_cumul")} format={fmtN} />
                </VizPanel>

                <VizPanel title={t("act9.tour_cmp_title")} subtitle={t("act9.tour_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={tourDumb} yearA={tourA} yearB={tourB} unit={t("act9.tour_unit")} labels={cmpLabels} />
                </VizPanel>
              </>
            )}

            {/* ---------- Électricité : l'empreinte ---------- */}
            {powerS.length > 0 && (
              <>
                <TextSlide title={t("act9.power_title")} sub={t("act9.power_sub")} />

                {!single && powerLine.length > 0 && (
                  <VizPanel title={t("act9.regional_power_title")} subtitle={t("act9.regional_power_sub")} filtersLabel={FT} filters={filtersEl}>
                    <TrendLines series={powerLine} years={power.years} currentYear={powerB} unit={t("act9.power_unit")} />
                  </VizPanel>
                )}

                <VizPanel title={t("act9.power_sm_title")} subtitle={`${powerA}–${powerB} · ${powerS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={powerS} years={power.years} unit={t("act9.power_unit")} currentYear={powerB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act9.power_hm_title")} subtitle={t("act9.power_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={powerS} years={power.years} unit={t("act9.power_unit")} scale="sequential" labels={seqLabels} />
                </VizPanel>

                <VizPanel title={t("act9.power_rank_title")} subtitle={t("act9.power_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={powerRank} unit={t("act9.power_unit")} worldAvg={powerMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                <VizPanel title={t("act9.power_cmp_title")} subtitle={t("act9.power_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={powerDumb} yearA={powerA} yearB={powerB} unit={t("act9.power_unit")} labels={cmpLabels} />
                </VizPanel>
              </>
            )}

            {/* ---------- Croisement tourisme × électricité ---------- */}
            {scatterCount >= 3 && (
              <VizPanel title={t("act9.scatter_title")} subtitle={t("act9.scatter_sub")} story={t("act9.story.scatter")} filtersLabel={FT} filters={filtersEl}>
                <ScatterChart groups={scatterGroups} unit={t("act9.tour_unit")} medianX={scatterMedianX} xName={t("act9.scatter_x")} yName={t("act9.power_unit")} />
              </VizPanel>
            )}

            {/* ---------- Fiscalité environnementale : le levier ---------- */}
            {taxS.length > 0 && (
              <>
                <TextSlide title={t("act9.tax_title")} sub={t("act9.tax_sub")} />

                {!single && taxLine.length > 0 && (
                  <VizPanel title={t("act9.regional_tax_title")} subtitle={t("act9.regional_tax_sub")} filtersLabel={FT} filters={filtersEl}>
                    <TrendLines series={taxLine} years={tax.years} currentYear={taxB} unit={t("act9.tax_unit")} />
                  </VizPanel>
                )}

                <VizPanel title={t("act9.tax_sm_title")} subtitle={`${taxA}–${taxB} · ${taxS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={taxS} years={tax.years} unit={t("act9.tax_unit")} currentYear={taxB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act9.tax_hm_title")} subtitle={t("act9.tax_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={taxS} years={tax.years} unit={t("act9.tax_unit")} scale="sequential" labels={seqLabels} />
                </VizPanel>

                <VizPanel title={t("act9.tax_rank_title")} subtitle={t("act9.tax_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={taxRank} unit={t("act9.tax_unit")} worldAvg={taxMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                <VizPanel title={t("act9.gauge_title")} subtitle={t("act9.gauge_sub")} story={t("act9.story.gauge")} filtersLabel={FT} filters={filtersEl}>
                  <RadialGauge value={Math.round(taxMed ?? 0)} label={t("act9.gauge_label")} color={tk.positive} />
                </VizPanel>
              </>
            )}

            {tourS.length === 0 && powerS.length === 0 && taxS.length === 0 && (
              <p className="act1__state">{t("act1.change.empty")}</p>
            )}

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act9.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act9.outro.title")}</h2>
                <p className="act1outro__text">{t("act9.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/sante" className="act1outro__btn act1outro__btn--primary">
                    {t("act9.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act9.outro.home")}
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