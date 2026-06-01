// src/pages/Act9Eco/Act9Eco.jsx
// ============================================================
// Acte 09 — « L'économie exposée ». Trois indicateurs réels du PDH, joints par GEO_PICT :
//   • Tourisme    (DF_CLIMATE_CHANGE, TRSM_ARR)  — arrivées de visiteurs (effectifs).
//   • Électricité (DF_CLIMATE_CHANGE, POWER_GEN) — production (GWh).
//   • Fiscalité   (DF_ENV_TAXES)                 — taxes environnementales (% du PIB).
//
// Acte complet : filtre sous-région + focus territoire, trajectoire régionale
// (total pour tourisme/électricité, médiane pour la fiscalité), petits multiples,
// carte de chaleur, classement, avant→après, et un GUIDE DE LECTURE par indicateur.
// 100 % données API. Aucune valeur inventée. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchEco } from "../../services/ecoApi";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
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
// classement par PIC atteint sur toute la période (utile pour un jeu creux aux extrémités, ex. fiscalité)
function buildRankMax(series) {
  return series
    .map((s) => {
      const vals = s.values.map((p) => p.value).filter((n) => Number.isFinite(n));
      return { area: s.area, name: s.name, value: vals.length ? Math.max(...vals) : null };
    })
    .filter((r) => Number.isFinite(r.value) && r.value > 0);
}
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => ({ area: s.area, name: s.name, a: valueAt(s.values, yearA), b: valueAt(s.values, yearB) }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}
// total régional (somme des territoires visibles) année par année
function totalLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n));
      return got.length ? { year: y, value: got.reduce((a, b) => a + b, 0) } : null;
    })
    .filter(Boolean);
  return vals.length ? [{ area: "REG", name, values: vals }] : [];
}
// médiane régionale (territoires visibles) année par année — pour un ratio comme le %PIB
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

export default function Act9Eco() {
  const { t, lang } = useLang();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchEco({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      // eslint-disable-next-line no-console
      console.info("[Act9] reçu:", {
        source: res.source,
        tourism: res.tourism && { status: res.tourism.status, areas: res.tourism.areas?.length, span: [res.tourism.firstYear, res.tourism.lastYear] },
        power: res.power && { status: res.power.status, areas: res.power.areas?.length, span: [res.power.firstYear, res.power.lastYear] },
        envTax: res.envTax && { status: res.envTax.status, areas: res.envTax.areas?.length, span: [res.envTax.firstYear, res.envTax.lastYear] },
      });
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

  const onRegion = (k) => {
    setRegion(k);
    setCountry("all");
  };

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? (ind?.years?.[0] ?? fb0),
    ind?.lastYear ?? (ind?.years?.[ind?.years?.length - 1] ?? fb1),
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

  const tourDumb = useMemo(() => buildDumbbell(tourS, tourA, tourB), [tourS, tourA, tourB]);
  const powerDumb = useMemo(() => buildDumbbell(powerS, powerA, powerB), [powerS, powerA, powerB]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };
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
    title: t(`act9.${key}_guide_title`),
    intro: t(`act9.${key}_guide_intro`),
    steps: [
      { k: t(`act9.${key}_guide_s1_k`), v: t(`act9.${key}_guide_s1_v`) },
      { k: t(`act9.${key}_guide_s2_k`), v: t(`act9.${key}_guide_s2_v`) },
      { k: t(`act9.${key}_guide_s3_k`), v: t(`act9.${key}_guide_s3_v`) },
    ],
    takeaway: t(`act9.${key}_guide_takeaway`),
  });

  return (
    <main className="act9">
      <div className="container">
        <header className="act9__head">
          <p className="eyebrow">{t("act9.tag")}</p>
          <h1 className="act9__title">{t("act9.title")}</h1>
          <p className="act9__lead">{t("act9.lead")}</p>
        </header>

        {state.status === "loading" && <p className="act9__state">{t("scene.loading")}</p>}
        {state.status === "empty" && <p className="act9__state act9__state--err">{t("act9.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            <div className="act9__controls">
              <div className="act9__filter" role="group" aria-label={t("act1.filter.title")}>
                <span className="act9__filter-lbl">{t("act1.filter.title")}</span>
                {REGION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`act9__pill ${country === "all" && region === k ? "is-active" : ""}`}
                    onClick={() => onRegion(k)}
                    aria-pressed={country === "all" && region === k}
                  >
                    {t(`act1.filter.${k}`)}
                  </button>
                ))}
              </div>
              <label className="act9__select-wrap">
                <span className="act9__select-lbl">{t("act7.country_label")}</span>
                <select className="act9__select" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="all">{t("act7.country_all")}</option>
                  {countryOptions.map((c) => (
                    <option key={c.area} value={c.area}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* ---------- Tourisme : l'exposition ---------- */}
            {tourS.length > 0 && (
              <section className="act9__sub">
                <div className="act9__sub-head">
                  <h2 className="act9__sub-title">{t("act9.tour_title")}</h2>
                  <p className="act9__sub-sub">{t("act9.tour_sub")}</p>
                </div>

                <ReadingGuide {...guide("tour")} />

                {!single && tourLine.length > 0 && (
                  <ExpandableCard title={t("act9.regional_tour_title")} sub={t("act9.regional_tour_sub")} {...xc}>
                    <TrendLines series={tourLine} years={tour.years} currentYear={tourB} unit={t("act9.tour_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard title={t("act9.tour_sm_title")} sub={`${tourA}–${tourB} · ${tourS.length} ${t("act2.coverage")}`} {...xc}>
                  <SmallMultiples series={tourS} years={tour.years} unit={t("act9.tour_unit")} currentYear={tourB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.tour_hm_title")} sub={t("act9.tour_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={tourS} years={tour.years} unit={t("act9.tour_unit")} scale="sequential" labels={seqLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.tour_rank_title")} sub={t("act9.tour_rank_sub")} {...xc}>
                  <RankBars data={tourRank} unit={t("act9.tour_unit")} worldAvg={tourMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.tour_cmp_title")} sub={t("act9.tour_cmp_sub")} {...xc}>
                  <DumbbellChart rows={tourDumb} yearA={tourA} yearB={tourB} unit={t("act9.tour_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {/* ---------- Électricité ---------- */}
            {powerS.length > 0 && (
              <section className="act9__sub">
                <div className="act9__sub-head">
                  <h2 className="act9__sub-title">{t("act9.power_title")}</h2>
                  <p className="act9__sub-sub">{t("act9.power_sub")}</p>
                </div>

                <ReadingGuide {...guide("power")} />

                {!single && powerLine.length > 0 && (
                  <ExpandableCard title={t("act9.regional_power_title")} sub={t("act9.regional_power_sub")} {...xc}>
                    <TrendLines series={powerLine} years={power.years} currentYear={powerB} unit={t("act9.power_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard title={t("act9.power_sm_title")} sub={`${powerA}–${powerB} · ${powerS.length} ${t("act2.coverage")}`} {...xc}>
                  <SmallMultiples series={powerS} years={power.years} unit={t("act9.power_unit")} currentYear={powerB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.power_hm_title")} sub={t("act9.power_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={powerS} years={power.years} unit={t("act9.power_unit")} scale="sequential" labels={seqLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.power_rank_title")} sub={t("act9.power_rank_sub")} {...xc}>
                  <RankBars data={powerRank} unit={t("act9.power_unit")} worldAvg={powerMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.power_cmp_title")} sub={t("act9.power_cmp_sub")} {...xc}>
                  <DumbbellChart rows={powerDumb} yearA={powerA} yearB={powerB} unit={t("act9.power_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {/* ---------- Fiscalité environnementale : le levier ---------- */}
            {taxS.length > 0 && (
              <section className="act9__sub">
                <div className="act9__sub-head">
                  <h2 className="act9__sub-title">{t("act9.tax_title")}</h2>
                  <p className="act9__sub-sub">{t("act9.tax_sub")}</p>
                </div>

                <ReadingGuide {...guide("tax")} />

                {!single && taxLine.length > 0 && (
                  <ExpandableCard title={t("act9.regional_tax_title")} sub={t("act9.regional_tax_sub")} {...xc}>
                    <TrendLines series={taxLine} years={tax.years} currentYear={taxB} unit={t("act9.tax_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard title={t("act9.tax_sm_title")} sub={`${taxA}–${taxB} · ${taxS.length} ${t("act2.coverage")}`} {...xc}>
                  <SmallMultiples series={taxS} years={tax.years} unit={t("act9.tax_unit")} currentYear={taxB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.tax_hm_title")} sub={t("act9.tax_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={taxS} years={tax.years} unit={t("act9.tax_unit")} scale="sequential" labels={seqLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act9.tax_rank_title")} sub={t("act9.tax_rank_sub")} {...xc}>
                  <RankBars data={taxRank} unit={t("act9.tax_unit")} worldAvg={taxMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>
              </section>
            )}

            {tourS.length === 0 && powerS.length === 0 && taxS.length === 0 && (
              <p className="act9__state">{t("act1.change.empty")}</p>
            )}

            <p className="act9__credit">{t("act9.credit")}</p>
          </>
        )}

        <Link to="/" className="act9__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}