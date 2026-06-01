// src/pages/Act8Ciel/Act8Ciel.jsx
// ============================================================
// Acte 08 — « Le ciel se dérègle ». Trois indicateurs réels du PDH, joints par GEO_PICT :
//   • Précipitations (DF_CLIMATE_CHANGE, RAIN_ANOM) — anomalie mm vs 1991–2020 (−sec / +humide).
//   • Température terre (DF_CLIMATE_CHANGE, *_ANOM) — anomalie °C vs 1971–2000 (réchauffement).
//   • Réseau météo (DF_METEO_MONITOR_NET) — nb de stations opérationnelles (cumul, la riposte).
//
// Acte complet : filtre sous-région + focus territoire, trajectoire régionale avec
// bande de dispersion + ligne de référence (AnomalyTrend), petits multiples, carte
// de chaleur divergente, avant→après, réseau météo, et un GUIDE DE LECTURE par
// indicateur (source, méthode, interprétation) — toute la méthodo externalisée.
// 100 % données API. Aucune valeur inventée. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchCiel } from "../../services/cielApi";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
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
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => ({ area: s.area, name: s.name, a: valueAt(s.values, yearA), b: valueAt(s.values, yearB) }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}
// anomalie régionale : moyenne + dispersion (min–max) sur les territoires visibles, année par année
function anomalyBand(series, years) {
  return years
    .map((y) => {
      const vals = series.map((s) => exactAt(s.values, y)).filter((n) => Number.isFinite(n));
      if (!vals.length) return null;
      return { year: y, mean: mean(vals), min: Math.min(...vals), max: Math.max(...vals) };
    })
    .filter(Boolean);
}
// réseau : total régional (somme des stations des territoires visibles) année par année
function totalLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n));
      return got.length ? { year: y, value: got.reduce((a, b) => a + b, 0) } : null;
    })
    .filter(Boolean);
  return vals.length ? [{ area: "REG", name, values: vals }] : [];
}

export default function Act8Ciel() {
  const { t, lang } = useLang();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchCiel({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      // eslint-disable-next-line no-console
      console.info("[Act8] reçu:", {
        source: res.source,
        rain: res.rain && { status: res.rain.status, areas: res.rain.areas?.length, span: [res.rain.firstYear, res.rain.lastYear] },
        landTemp: res.landTemp && { status: res.landTemp.status, key: res.landTemp.key, span: [res.landTemp.firstYear, res.landTemp.lastYear] },
        meteo: res.meteo && { status: res.meteo.status, areas: res.meteo.areas?.length, span: [res.meteo.firstYear, res.meteo.lastYear] },
      });
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

  const onRegion = (k) => {
    setRegion(k);
    setCountry("all");
  };

  // repères temporels (plage réelle de l'API)
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

  const rainDumb = useMemo(() => buildDumbbell(rainS, rainA, rainB), [rainS, rainA, rainB]);
  const tempDumb = useMemo(() => buildDumbbell(tempS, tempA, tempB), [tempS, tempA, tempB]);
  const meteoDumb = useMemo(() => buildDumbbell(meteoS, meteoA, meteoB), [meteoS, meteoA, meteoB]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };
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
  const single = country !== "all";

  const guide = (key) => ({
    title: t(`act8.${key}_guide_title`),
    intro: t(`act8.${key}_guide_intro`),
    steps: [
      { k: t(`act8.${key}_guide_s1_k`), v: t(`act8.${key}_guide_s1_v`) },
      { k: t(`act8.${key}_guide_s2_k`), v: t(`act8.${key}_guide_s2_v`) },
      { k: t(`act8.${key}_guide_s3_k`), v: t(`act8.${key}_guide_s3_v`) },
    ],
    takeaway: t(`act8.${key}_guide_takeaway`),
  });

  return (
    <main className="act8">
      <div className="container">
        <header className="act8__head">
          <p className="eyebrow">{t("act8.tag")}</p>
          <h1 className="act8__title">{t("act8.title")}</h1>
          <p className="act8__lead">{t("act8.lead")}</p>
        </header>

        {state.status === "loading" && <p className="act8__state">{t("scene.loading")}</p>}
        {state.status === "empty" && <p className="act8__state act8__state--err">{t("act8.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            <div className="act8__controls">
              <div className="act8__filter" role="group" aria-label={t("act1.filter.title")}>
                <span className="act8__filter-lbl">{t("act1.filter.title")}</span>
                {REGION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`act8__pill ${country === "all" && region === k ? "is-active" : ""}`}
                    onClick={() => onRegion(k)}
                    aria-pressed={country === "all" && region === k}
                  >
                    {t(`act1.filter.${k}`)}
                  </button>
                ))}
              </div>
              <label className="act8__select-wrap">
                <span className="act8__select-lbl">{t("act7.country_label")}</span>
                <select className="act8__select" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="all">{t("act7.country_all")}</option>
                  {countryOptions.map((c) => (
                    <option key={c.area} value={c.area}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* ---------- Précipitations ---------- */}
            {rainS.length > 0 && (
              <section className="act8__sub">
                <div className="act8__sub-head">
                  <h2 className="act8__sub-title">{t("act8.rain_title")}</h2>
                  <p className="act8__sub-sub">{t("act8.rain_sub")}</p>
                </div>

                <ReadingGuide {...guide("rain")} />

                {rainBand.length > 0 && (
                  <ExpandableCard title={t("act8.regional_rain_title")} sub={t("act8.regional_rain_sub")} {...xc}>
                    <AnomalyTrend
                      data={rainBand}
                      currentYear={rainB}
                      unit={t("act8.rain_unit")}
                      tone="sea"
                      baselineLabel={t("act8.rain_baseline")}
                      meanLabel={single ? pictName(country, lang) : t("act8.mean_label")}
                    />
                  </ExpandableCard>
                )}

                <ExpandableCard
                  title={t("act8.rain_sm_title")}
                  sub={`${rainA}–${rainB} · ${rainS.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples series={rainS} years={rain.years} unit={t("act8.rain_unit")} currentYear={rainB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.rain_hm_title")} sub={t("act8.rain_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={rainS} years={rain.years} unit={t("act8.rain_unit")} scale="diverging" labels={divLabels(t("act8.rain_hm_below"), t("act8.rain_hm_above"))} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.rain_cmp_title")} sub={t("act8.rain_cmp_sub")} {...xc}>
                  <DumbbellChart rows={rainDumb} yearA={rainA} yearB={rainB} unit={t("act8.rain_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {/* ---------- Température de surface (terre) ---------- */}
            {tempS.length > 0 && (
              <section className="act8__sub">
                <div className="act8__sub-head">
                  <h2 className="act8__sub-title">{t("act8.temp_title")}</h2>
                  <p className="act8__sub-sub">{t("act8.temp_sub")}</p>
                </div>

                <ReadingGuide {...guide("temp")} />

                {tempBand.length > 0 && (
                  <ExpandableCard title={t("act8.regional_temp_title")} sub={t("act8.regional_temp_sub")} {...xc}>
                    <AnomalyTrend
                      data={tempBand}
                      currentYear={tempB}
                      unit={t("act8.temp_unit")}
                      tone="warm"
                      baselineLabel={t("act8.temp_baseline")}
                      meanLabel={single ? pictName(country, lang) : t("act8.mean_label")}
                    />
                  </ExpandableCard>
                )}

                <ExpandableCard
                  title={t("act8.temp_sm_title")}
                  sub={`${tempA}–${tempB} · ${tempS.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples series={tempS} years={temp.years} unit={t("act8.temp_unit")} currentYear={tempB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.temp_hm_title")} sub={t("act8.temp_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={tempS} years={temp.years} unit={t("act8.temp_unit")} scale="diverging" labels={divLabels(t("act8.temp_hm_below"), t("act8.temp_hm_above"))} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.temp_cmp_title")} sub={t("act8.temp_cmp_sub")} {...xc}>
                  <DumbbellChart rows={tempDumb} yearA={tempA} yearB={tempB} unit={t("act8.temp_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {/* ---------- Réseau de surveillance météo (la riposte) ---------- */}
            {meteoS.length > 0 && (
              <section className="act8__sub">
                <div className="act8__sub-head">
                  <h2 className="act8__sub-title">{t("act8.meteo_title")}</h2>
                  <p className="act8__sub-sub">{t("act8.meteo_sub")}</p>
                </div>

                <ReadingGuide {...guide("meteo")} />

                {!single && meteoLine.length > 0 && (
                  <ExpandableCard title={t("act8.regional_meteo_title")} sub={t("act8.regional_meteo_sub")} {...xc}>
                    <TrendLines series={meteoLine} years={meteo.years} currentYear={meteoB} unit={t("act8.meteo_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard
                  title={t("act8.meteo_sm_title")}
                  sub={`${meteoA}–${meteoB} · ${meteoS.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples series={meteoS} years={meteo.years} unit={t("act8.meteo_unit")} currentYear={meteoB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.meteo_hm_title")} sub={t("act8.meteo_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={meteoS} years={meteo.years} unit={t("act8.meteo_unit")} scale="sequential" labels={seqLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.meteo_rank_title")} sub={t("act8.meteo_rank_sub")} {...xc}>
                  <RankBars data={meteoRank} unit={t("act8.meteo_unit")} worldAvg={meteoMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act8.meteo_cmp_title")} sub={t("act8.meteo_cmp_sub")} {...xc}>
                  <DumbbellChart rows={meteoDumb} yearA={meteoA} yearB={meteoB} unit={t("act8.meteo_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {rainS.length === 0 && tempS.length === 0 && meteoS.length === 0 && (
              <p className="act8__state">{t("act1.change.empty")}</p>
            )}

            <p className="act8__credit">{t("act8.credit")}</p>
          </>
        )}

        <Link to="/" className="act8__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}