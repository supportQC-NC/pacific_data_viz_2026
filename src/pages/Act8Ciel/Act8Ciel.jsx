// src/pages/Act8Ciel/Act8Ciel.jsx
// ============================================================
// Acte 08 — « Le ciel se dérègle ». Trois indicateurs réels du PDH :
//   • Précipitations (RAIN_ANOM) — anomalie mm vs 1991–2020 (−sec / +humide).
//   • Température terre (*_ANOM) — anomalie °C vs 1971–2000 (réchauffement).
//   • Réseau météo (METEO_MONITOR_NET) — nb de stations (cumul, la riposte).
//
// MÊME EXPÉRIENCE que les actes 3–7 : diaporama plein écran, filtres
// repliables (sous-région + focus territoire), navigation clavier/boutons,
// écran de fin. Guides retirés. On GARDE l'existant (small multiples,
// heatmap divergente, classement, dumbbell, ligne du réseau) et on AJOUTE :
//   • BandTrend (médiane + bande + ligne de référence 0 = la normale),
//   • ShareAbove (% de territoires en anomalie positive),
//   • Boxplot (dispersion des anomalies par année),
//   • Scatter croisé température × précipitations,
//   • jauge « % de territoires en réchauffement ».
// 100 % données API. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchCiel } from "../../services/cielApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import VizPanel from "../../components/charts/VizPanel";
import BandTrendChart from "../../components/charts/BandTrendChart";
import ShareAboveChart from "../../components/charts/ShareAboveChart";
import BoxplotChart from "../../components/charts/BoxplotChart";
import ScatterChart from "../../components/charts/ScatterChart";
import RadialGauge from "../../components/charts/RadialGauge";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import Loader from "../../components/Loader/Loader";
import "./Act8Ciel.scss";

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
function exactAt(values, year) {
  if (!values || !values.length) return null;
  const hit = values.find((p) => p.year === year);
  return hit ? hit.value : null;
}
function mean(nums) {
  const a = nums.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
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
// « Avant → après » PROPRE À CHAQUE TERRITOIRE : première et dernière valeur
// réellement observées (≠ année globale, qui écartait les territoires sans
// donnée à la borne de début, ex. réseau météo en 1889).
function buildEnds(series) {
  return series
    .map((s) => {
      const v = (s.values || []).filter((p) => Number.isFinite(p.value));
      if (!v.length) return null;
      return { area: s.area, name: s.name, a: v[0].value, b: v[v.length - 1].value };
    })
    .filter(Boolean);
}
function anomalyBand(series, years) {
  return years
    .map((y) => {
      const vals = series.map((s) => exactAt(s.values, y)).filter((n) => Number.isFinite(n));
      if (!vals.length) return null;
      return { year: y, mean: mean(vals), min: Math.min(...vals), max: Math.max(...vals) };
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

function Pills({ label, isActive, labelOf, onChange }) {
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

export default function Act8Ciel() {
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
    fetchCiel({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({ status: res.source === "live" ? "ready" : "empty", data: res });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const rain = data?.rain;
  const temp = data?.landTemp;
  const meteo = data?.meteo;

  const rainAll = useMemo(() => toSeries(rain, lang), [rain, lang]);
  const tempAll = useMemo(() => toSeries(temp, lang), [temp, lang]);
  const meteoAll = useMemo(() => toSeries(meteo, lang), [meteo, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([...rainAll.map((s) => s.area), ...tempAll.map((s) => s.area), ...meteoAll.map((s) => s.area)]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [rainAll, tempAll, meteoAll, lang]);

  const areaVisible = useMemo(() => {
    if (country !== "all") return (a) => a === country;
    return (a) => region === "all" || REGION_OF[a] === region;
  }, [region, country]);

  const rainS = useMemo(() => rainAll.filter((s) => areaVisible(s.area)), [rainAll, areaVisible]);
  const tempS = useMemo(() => tempAll.filter((s) => areaVisible(s.area)), [tempAll, areaVisible]);
  const meteoS = useMemo(() => meteoAll.filter((s) => areaVisible(s.area)), [meteoAll, areaVisible]);

  const onRegion = useCallback((k) => {
    setRegion(k);
    setCountry("all");
  }, []);
  const single = country !== "all";

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? (ind?.years?.[0] ?? fb0),
    ind?.lastYear ?? (ind?.years?.[ind?.years?.length - 1] ?? fb1),
  ];
  const [rainA, rainB] = span(rain, 1979, 2025);
  const [tempA, tempB] = span(temp, 1850, 2025);
  const [meteoA, meteoB] = span(meteo, 1889, 2026);

  const rainBand = useMemo(() => anomalyBand(rainS, rain?.years || []), [rainS, rain]);
  const tempBand = useMemo(() => anomalyBand(tempS, temp?.years || []), [tempS, temp]);
  const meteoLine = useMemo(
    () => totalLine(meteoS, meteo?.years || [], t("act8.meteo_total_name")),
    [meteoS, meteo, t],
  );
  const meteoRank = useMemo(() => buildRank(meteoS, meteoB), [meteoS, meteoB]);
  const meteoMed = useMemo(() => {
    const m = median(meteoRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [meteoRank]);

  const rainDumb = useMemo(() => buildEnds(rainS), [rainS]);
  const tempDumb = useMemo(() => buildEnds(tempS), [tempS]);
  const meteoDumb = useMemo(() => buildEnds(meteoS), [meteoS]);

  // Jauge : part des territoires en anomalie de température positive (dernière année).
  const warmPct = useMemo(() => {
    const vs = tempS.map((s) => valueAt(s.values, tempB)).filter((n) => Number.isFinite(n));
    if (!vs.length) return 0;
    return Math.round((vs.filter((v) => v > 0).length / vs.length) * 100);
  }, [tempS, tempB]);

  // Scatter croisé : anomalie de température (X) × anomalie de précipitations (Y).
  const REGION_COLOR = useMemo(
    () => ({ melanesia: tk.accent, polynesia: tk.warm, micronesia: tk.positive }),
    [tk],
  );
  const scatterGroups = useMemo(() => {
    const tBy = {};
    tempS.forEach((s) => {
      const v = valueAt(s.values, tempB);
      if (Number.isFinite(v)) tBy[s.area] = v;
    });
    const rBy = {};
    rainS.forEach((s) => {
      const v = valueAt(s.values, rainB);
      if (Number.isFinite(v)) rBy[s.area] = v;
    });
    const areas = Object.keys(tBy).filter((a) => rBy[a] != null);
    return REGIONS3.map((rg) => ({
      name: t(`act1.filter.${rg}`),
      color: REGION_COLOR[rg],
      points: areas
        .filter((a) => REGION_OF[a] === rg)
        .map((a) => ({ x: tBy[a], y: rBy[a], name: pictName(a, lang) })),
    })).filter((g) => g.points.length);
  }, [tempS, rainS, tempB, rainB, lang, t, REGION_COLOR]);
  const scatterCount = useMemo(() => scatterGroups.reduce((s, g) => s + g.points.length, 0), [scatterGroups]);
  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  const divLabels = (below, above) => ({
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    below,
    above,
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  });
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
  const meanLbl = single ? pictName(country, lang) : t("act8.mean_label");

  return (
    <main className="act1 act8" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("act8.tag")}</p>
          <h1 className="act1__title">{t("act8.title")}</h1>
          <p className="act1__lead">{t("act8.lead")}</p>
        </header>

        {state.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {state.status === "empty" && <p className="act1__state act1__state--err">{t("act8.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            {/* ---------- Précipitations ---------- */}
            {rainS.length > 0 && (
              <>
                <TextSlide title={t("act8.rain_title")} sub={t("act8.rain_sub")} />

                {rainBand.length > 0 && (
                  <VizPanel title={t("act8.regional_rain_title")} subtitle={t("act8.regional_rain_sub")} story={t("act8.story.rain_trend")} filtersLabel={FT} filters={filtersEl}>
                    <BandTrendChart data={rainBand} unit={t("act8.rain_unit")} refValue={0} refLabel={t("act8.rain_baseline")} meanLabel={meanLbl} currentYear={rainB} color={tk.accent} />
                  </VizPanel>
                )}

                <VizPanel title={t("act8.rain_sm_title")} subtitle={`${rainA}–${rainB} · ${rainS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={rainS} years={rain.years} unit={t("act8.rain_unit")} currentYear={rainB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act8.rain_hm_title")} subtitle={t("act8.rain_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={rainS} years={rain.years} unit={t("act8.rain_unit")} scale="diverging" labels={divLabels(t("act8.rain_hm_below"), t("act8.rain_hm_above"))} />
                </VizPanel>

                {!single && (
                  <VizPanel title={t("act8.box_title")} subtitle={`${t("act8.box_sub")} · ${t("act8.rain_unit")}`} story={t("act8.story.box")} filtersLabel={FT} filters={filtersEl}>
                    <BoxplotChart series={rainS} years={rain.years} unit={t("act8.rain_unit")} scale="lin" />
                  </VizPanel>
                )}

                {!single && (
                  <VizPanel title={t("act8.share_wet_title")} subtitle={t("act8.share_wet_sub")} story={t("act8.story.share_wet")} filtersLabel={FT} filters={filtersEl}>
                    <ShareAboveChart series={rainS} years={rain.years} />
                  </VizPanel>
                )}

                <VizPanel title={t("act8.rain_cmp_title")} subtitle={t("act8.rain_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={rainDumb} yearA={rainA} yearB={rainB} unit={t("act8.rain_unit")} labels={cmpLabels} />
                </VizPanel>
              </>
            )}

            {/* ---------- Température de surface ---------- */}
            {tempS.length > 0 && (
              <>
                <TextSlide title={t("act8.temp_title")} sub={t("act8.temp_sub")} />

                {tempBand.length > 0 && (
                  <VizPanel title={t("act8.regional_temp_title")} subtitle={t("act8.regional_temp_sub")} story={t("act8.story.temp_trend")} filtersLabel={FT} filters={filtersEl}>
                    <BandTrendChart data={tempBand} unit={t("act8.temp_unit")} refValue={0} refLabel={t("act8.temp_baseline")} meanLabel={meanLbl} currentYear={tempB} color={tk.warm} />
                  </VizPanel>
                )}

                <VizPanel title={t("act8.temp_sm_title")} subtitle={`${tempA}–${tempB} · ${tempS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={tempS} years={temp.years} unit={t("act8.temp_unit")} currentYear={tempB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act8.temp_hm_title")} subtitle={t("act8.temp_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={tempS} years={temp.years} unit={t("act8.temp_unit")} scale="diverging" labels={divLabels(t("act8.temp_hm_below"), t("act8.temp_hm_above"))} />
                </VizPanel>

                {!single && (
                  <VizPanel title={t("act8.box_title")} subtitle={`${t("act8.box_sub")} · ${t("act8.temp_unit")}`} story={t("act8.story.box")} filtersLabel={FT} filters={filtersEl}>
                    <BoxplotChart series={tempS} years={temp.years} unit={t("act8.temp_unit")} scale="lin" />
                  </VizPanel>
                )}

                {!single && (
                  <VizPanel title={t("act8.share_warm_title")} subtitle={t("act8.share_warm_sub")} story={t("act8.story.share_warm")} filtersLabel={FT} filters={filtersEl}>
                    <ShareAboveChart series={tempS} years={temp.years} />
                  </VizPanel>
                )}

                <VizPanel title={t("act8.gauge_title")} subtitle={`${t("act8.gauge_sub")} · ${tempB}`} story={t("act8.story.gauge")} filtersLabel={FT} filters={filtersEl}>
                  <RadialGauge value={warmPct} label={t("act8.gauge_label")} color={tk.warm} />
                </VizPanel>

                <VizPanel title={t("act8.temp_cmp_title")} subtitle={t("act8.temp_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={tempDumb} yearA={tempA} yearB={tempB} unit={t("act8.temp_unit")} labels={cmpLabels} />
                </VizPanel>
              </>
            )}

            {/* ---------- Croisement température × précipitations ---------- */}
            {scatterCount >= 3 && (
              <VizPanel title={t("act8.scatter_title")} subtitle={t("act8.scatter_sub")} story={t("act8.story.scatter")} filtersLabel={FT} filters={filtersEl}>
                <ScatterChart groups={scatterGroups} unit={t("act8.temp_unit")} medianX={scatterMedianX} xName={t("act8.scatter_x")} yName={t("act8.rain_unit")} />
              </VizPanel>
            )}

            {/* ---------- Réseau de surveillance météo (la riposte) ---------- */}
            {meteoS.length > 0 && (
              <>
                <TextSlide title={t("act8.meteo_title")} sub={t("act8.meteo_sub")} />

                {!single && meteoLine.length > 0 && (
                  <VizPanel title={t("act8.regional_meteo_title")} subtitle={t("act8.regional_meteo_sub")} filtersLabel={FT} filters={filtersEl}>
                    <TrendLines series={meteoLine} years={meteo.years} currentYear={meteoB} unit={t("act8.meteo_unit")} />
                  </VizPanel>
                )}

                <VizPanel title={t("act8.meteo_sm_title")} subtitle={`${meteoA}–${meteoB} · ${meteoS.length} ${t("act2.coverage")}`} filtersLabel={FT} filters={filtersEl}>
                  <SmallMultiples series={meteoS} years={meteo.years} unit={t("act8.meteo_unit")} currentYear={meteoB} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act8.meteo_hm_title")} subtitle={t("act8.meteo_hm_sub")} filtersLabel={FT} filters={filtersEl}>
                  <EmissionsHeatmap series={meteoS} years={meteo.years} unit={t("act8.meteo_unit")} scale="sequential" labels={seqLabels} />
                </VizPanel>

                <VizPanel title={t("act8.meteo_rank_title")} subtitle={t("act8.meteo_rank_sub")} filtersLabel={FT} filters={filtersEl}>
                  <RankBars data={meteoRank} unit={t("act8.meteo_unit")} worldAvg={meteoMed} refLabel={t("act6.median_ref")} />
                </VizPanel>

                <VizPanel title={t("act8.meteo_cmp_title")} subtitle={t("act8.meteo_cmp_sub")} filtersLabel={FT} filters={filtersEl}>
                  <DumbbellChart rows={meteoDumb} yearA={meteoA} yearB={meteoB} unit={t("act8.meteo_unit")} labels={cmpLabels} />
                </VizPanel>
              </>
            )}

            {rainS.length === 0 && tempS.length === 0 && meteoS.length === 0 && (
              <p className="act1__state">{t("act1.change.empty")}</p>
            )}

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act8.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act8.outro.title")}</h2>
                <p className="act1outro__text">{t("act8.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/economie" className="act1outro__btn act1outro__btn--primary">
                    {t("act8.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act8.outro.home")}
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