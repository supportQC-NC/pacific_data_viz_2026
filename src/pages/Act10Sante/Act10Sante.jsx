// src/pages/Act10Sante/Act10Sante.jsx
// ============================================================
// Acte 10 — « Le corps et l'eau ». Deux indicateurs réels du PDH :
//   • Eau potable sûre (DF_SDG_06) — % de la population. Plus haut = mieux.
//   • Tuberculose      (DF_SDG_03) — cas / 100 000 hab. Plus bas = mieux.
//
// MÊME EXPÉRIENCE que les actes 3–9 : diaporama plein écran, filtres
// repliables (sous-région + territoire), navigation clavier/boutons, écran
// de fin. Guides retirés. On GARDE l'existant (small multiples, heatmap,
// classement, dumbbell) et on AJOUTE :
//   • BandTrend (médiane + bande p10–p90, la trajectoire régionale + écart),
//   • Boxplot (dispersion entre territoires, par année),
//   • Scatter croisé eau × tuberculose (assainissement ↔ fardeau),
//   • jauge accès eau potable médian (%).
// Dumbbell corrigé (1re→dernière valeur propre à chaque territoire).
// 100 % données API. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSante } from "../../services/santeApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import VizPanel from "../../components/charts/VizPanel";
import BandTrendChart from "../../components/charts/BandTrendChart";
import BoxplotChart from "../../components/charts/BoxplotChart";
import ScatterChart from "../../components/charts/ScatterChart";
import RadialGauge from "../../components/charts/RadialGauge";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import Loader from "../../components/Loader/Loader";
import "./Act10Sante.scss";

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
function pct(sortedAsc, q) {
  if (!sortedAsc.length) return null;
  const i = (sortedAsc.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sortedAsc[lo] : sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (i - lo);
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
// Médiane + bande p10–p90 (territoires visibles) année par année.
function bandLine(series, years) {
  return years
    .map((y) => {
      const vals = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      if (!vals.length) return null;
      return { year: y, mean: median(vals), min: pct(vals, 0.1), max: pct(vals, 0.9) };
    })
    .filter(Boolean);
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

export default function Act10Sante() {
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
    fetchSante({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({ status: res.source === "live" ? "ready" : "empty", data: res });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const water = data?.water;
  const tb = data?.tb;

  const waterAll = useMemo(() => toSeries(water, lang), [water, lang]);
  const tbAll = useMemo(() => toSeries(tb, lang), [tb, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([...waterAll.map((s) => s.area), ...tbAll.map((s) => s.area)]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [waterAll, tbAll, lang]);

  const areaVisible = useMemo(() => {
    if (country !== "all") return (a) => a === country;
    return (a) => region === "all" || REGION_OF[a] === region;
  }, [region, country]);

  const waterS = useMemo(() => waterAll.filter((s) => areaVisible(s.area)), [waterAll, areaVisible]);
  const tbS = useMemo(() => tbAll.filter((s) => areaVisible(s.area)), [tbAll, areaVisible]);

  const onRegion = useCallback((k) => {
    setRegion(k);
    setCountry("all");
  }, []);
  const single = country !== "all";

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? (ind?.years?.[0] ?? fb0),
    ind?.lastYear ?? (ind?.years?.[ind?.years?.length - 1] ?? fb1),
  ];
  const [waterA, waterB] = span(water, 2000, 2022);
  const [tbA, tbB] = span(tb, 2000, 2023);

  const waterBand = useMemo(() => bandLine(waterS, water?.years || []), [waterS, water]);
  const tbBand = useMemo(() => bandLine(tbS, tb?.years || []), [tbS, tb]);

  const waterRank = useMemo(() => buildRank(waterS, waterB), [waterS, waterB]);
  const tbRank = useMemo(() => buildRank(tbS, tbB), [tbS, tbB]);
  const waterMed = useMemo(() => {
    const m = median(waterRank.map((r) => r.value));
    return m == null ? null : Math.round(m * 10) / 10;
  }, [waterRank]);
  const tbMed = useMemo(() => {
    const m = median(tbRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [tbRank]);

  const waterDumb = useMemo(() => buildEnds(waterS), [waterS]);
  const tbDumb = useMemo(() => buildEnds(tbS), [tbS]);

  // Scatter croisé : eau potable (X) × tuberculose (Y), par territoire.
  const REGION_COLOR = useMemo(
    () => ({ melanesia: tk.accent, polynesia: tk.warm, micronesia: tk.positive }),
    [tk],
  );
  const scatterGroups = useMemo(() => {
    const wBy = {};
    waterRank.forEach((r) => (wBy[r.area] = r.value));
    const tBy = {};
    tbRank.forEach((r) => (tBy[r.area] = r.value));
    const areas = Object.keys(wBy).filter((a) => tBy[a] != null);
    return REGIONS3.map((rg) => ({
      name: t(`act1.filter.${rg}`),
      color: REGION_COLOR[rg],
      points: areas
        .filter((a) => REGION_OF[a] === rg)
        .map((a) => ({ x: wBy[a], y: tBy[a], name: pictName(a, lang) })),
    })).filter((g) => g.points.length);
  }, [waterRank, tbRank, lang, t, REGION_COLOR]);
  const scatterCount = useMemo(() => scatterGroups.reduce((s, g) => s + g.points.length, 0), [scatterGroups]);
  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  const seqLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const waterCmp = { up: t("act10.water_cmp_up"), down: t("act10.water_cmp_down") };
  const tbCmp = { up: t("act10.tb_cmp_up"), down: t("act10.tb_cmp_down") };

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
  const meanLbl = single ? pictName(country, lang) : t("act10.median_label");

  return (
    <main className="act1 act10" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("act10.tag")}</p>
          <h1 className="act1__title">{t("act10.title")}</h1>
          <p className="act1__lead">{t("act10.lead")}</p>
        </header>

        {state.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {state.status === "empty" && <p className="act1__state act1__state--err">{t("act10.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            {/* ---------- Eau potable : plus haut = mieux ---------- */}
            {waterS.length > 0 && (
              <>
                <TextSlide title={t("act10.water_title")} sub={t("act10.water_sub")} />

                {waterBand.length > 0 && (
                  <VizPanel title={t("act10.regional_water_title")} subtitle={t("act10.regional_water_sub")} story={t("act10.story.water_band")} filtersLabel={FT} filters={filtersEl}>
                    <BandTrendChart data={waterBand} unit={t("act10.water_unit")} refValue={null} meanLabel={meanLbl} currentYear={waterB} color={tk.positive} />
                  </VizPanel>
                )}

                <VizPanel title={t("act10.water_sm_title")} subtitle={`${waterA}–${waterB} · ${waterS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={waterS} years={water.years} unit={t("act10.water_unit")} currentYear={waterB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act10.water_hm_title")} subtitle={t("act10.water_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={waterS} years={water.years} unit={t("act10.water_unit")} scale="sequential" labels={seqLabels} />
                </VizPanel>

                <VizPanel title={t("act10.water_rank_title")} subtitle={t("act10.water_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={waterRank} unit={t("act10.water_unit")} worldAvg={waterMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                {!single && (
                  <VizPanel title={t("act10.box_title")} subtitle={`${t("act10.box_sub")} · ${t("act10.water_unit")}`} story={t("act10.story.box")} filtersLabel={FT} filters={filtersEl}>
                    <BoxplotChart series={waterS} years={water.years} unit={t("act10.water_unit")} scale="lin" />
                  </VizPanel>
                )}

                <VizPanel title={t("act10.gauge_title")} subtitle={`${t("act10.gauge_sub")} · ${waterB}`} story={t("act10.story.gauge")} filtersLabel={FT} filters={filtersEl}>
                  <RadialGauge value={Math.round(waterMed ?? 0)} label={t("act10.gauge_label")} color={tk.positive} />
                </VizPanel>

                <VizPanel title={t("act10.water_cmp_title")} subtitle={t("act10.water_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={waterDumb} yearA={waterA} yearB={waterB} unit={t("act10.water_unit")} labels={waterCmp} />
                </VizPanel>
              </>
            )}

            {/* ---------- Tuberculose : plus bas = mieux ---------- */}
            {tbS.length > 0 && (
              <>
                <TextSlide title={t("act10.tb_title")} sub={t("act10.tb_sub")} />

                {tbBand.length > 0 && (
                  <VizPanel title={t("act10.regional_tb_title")} subtitle={t("act10.regional_tb_sub")} story={t("act10.story.tb_band")} filtersLabel={FT} filters={filtersEl}>
                    <BandTrendChart data={tbBand} unit={t("act10.tb_unit")} refValue={null} meanLabel={meanLbl} currentYear={tbB} color={tk.warm} />
                  </VizPanel>
                )}

                <VizPanel title={t("act10.tb_sm_title")} subtitle={`${tbA}–${tbB} · ${tbS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={tbS} years={tb.years} unit={t("act10.tb_unit")} currentYear={tbB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act10.tb_hm_title")} subtitle={t("act10.tb_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={tbS} years={tb.years} unit={t("act10.tb_unit")} scale="sequential" labels={seqLabels} />
                </VizPanel>

                <VizPanel title={t("act10.tb_rank_title")} subtitle={t("act10.tb_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={tbRank} unit={t("act10.tb_unit")} worldAvg={tbMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                {!single && (
                  <VizPanel title={t("act10.box_title")} subtitle={`${t("act10.box_sub")} · ${t("act10.tb_unit")}`} story={t("act10.story.box")} filtersLabel={FT} filters={filtersEl}>
                    <BoxplotChart series={tbS} years={tb.years} unit={t("act10.tb_unit")} scale="lin" />
                  </VizPanel>
                )}

                <VizPanel title={t("act10.tb_cmp_title")} subtitle={t("act10.tb_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={tbDumb} yearA={tbA} yearB={tbB} unit={t("act10.tb_unit")} labels={tbCmp} />
                </VizPanel>
              </>
            )}

            {/* ---------- Croisement eau × tuberculose ---------- */}
            {scatterCount >= 3 && (
              <VizPanel title={t("act10.scatter_title")} subtitle={t("act10.scatter_sub")} story={t("act10.story.scatter")} filtersLabel={FT} filters={filtersEl}>
                <ScatterChart groups={scatterGroups} unit={t("act10.water_unit")} medianX={scatterMedianX} xName={t("act10.scatter_x")} yName={t("act10.tb_unit")} />
              </VizPanel>
            )}

            {waterS.length === 0 && tbS.length === 0 && <p className="act1__state">{t("act1.change.empty")}</p>}

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act10.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act10.outro.title")}</h2>
                <p className="act1outro__text">{t("act10.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/synthese" className="act1outro__btn act1outro__btn--primary">
                    {t("act10.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act10.outro.home")}
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