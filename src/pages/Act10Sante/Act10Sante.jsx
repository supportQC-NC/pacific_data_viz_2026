// src/pages/Act10Sante/Act10Sante.jsx
// ============================================================
// Acte 10 — « Le corps et l'eau ». Deux indicateurs réels du PDH, joints par GEO_PICT :
//   • Eau potable sûre (DF_SDG_06)  — % de la population. Plus haut = mieux.
//   • Tuberculose      (DF_SDG_03)  — cas / 100 000 hab. Plus bas = mieux.
//
// Sens de lecture géré explicitement (guides + libellés). L'eau emploie le
// codage couleur par défaut (hausse = positif) ; la tuberculose s'appuie sur
// des vues neutres au niveau (heatmap = intensité de cas, classement = fardeau)
// et des libellés amélioration/aggravation clairs.
// 100 % données API. Aucune valeur inventée. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSante } from "../../services/santeApi";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
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
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => ({ area: s.area, name: s.name, a: valueAt(s.values, yearA), b: valueAt(s.values, yearB) }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}
// médiane régionale (territoires visibles) année par année — adaptée aux taux
function medianLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n));
      const m = median(got);
      return m == null ? null : { year: y, value: Math.round(m * 100) / 100 };
    })
    .filter(Boolean);
  return vals.length ? [{ area: "MED", name, values: vals }] : [];
}

export default function Act10Sante() {
  const { t, lang } = useLang();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSante({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      // eslint-disable-next-line no-console
      console.info("[Act10] reçu:", {
        source: res.source,
        water: res.water && { status: res.water.status, areas: res.water.areas?.length, span: [res.water.firstYear, res.water.lastYear] },
        tb: res.tb && { status: res.tb.status, areas: res.tb.areas?.length, span: [res.tb.firstYear, res.tb.lastYear] },
      });
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

  const onRegion = (k) => {
    setRegion(k);
    setCountry("all");
  };

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? (ind?.years?.[0] ?? fb0),
    ind?.lastYear ?? (ind?.years?.[ind?.years?.length - 1] ?? fb1),
  ];
  const [waterA, waterB] = span(water, 2000, 2022);
  const [tbA, tbB] = span(tb, 2000, 2023);

  const waterLine = useMemo(() => medianLine(waterS, water?.years || [], t("act10.water_med_name")), [waterS, water, t]);
  const tbLine = useMemo(() => medianLine(tbS, tb?.years || [], t("act10.tb_med_name")), [tbS, tb, t]);

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

  const waterDumb = useMemo(() => buildDumbbell(waterS, waterA, waterB), [waterS, waterA, waterB]);
  const tbDumb = useMemo(() => buildDumbbell(tbS, tbA, tbB), [tbS, tbA, tbB]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };
  const seqLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const waterCmp = { up: t("act10.water_cmp_up"), down: t("act10.water_cmp_down") };
  const tbCmp = { up: t("act10.tb_cmp_up"), down: t("act10.tb_cmp_down") };
  const single = country !== "all";

  const guide = (key) => ({
    title: t(`act10.${key}_guide_title`),
    intro: t(`act10.${key}_guide_intro`),
    steps: [
      { k: t(`act10.${key}_guide_s1_k`), v: t(`act10.${key}_guide_s1_v`) },
      { k: t(`act10.${key}_guide_s2_k`), v: t(`act10.${key}_guide_s2_v`) },
      { k: t(`act10.${key}_guide_s3_k`), v: t(`act10.${key}_guide_s3_v`) },
    ],
    takeaway: t(`act10.${key}_guide_takeaway`),
  });

  return (
    <main className="act10">
      <div className="container">
        <header className="act10__head">
          <p className="eyebrow">{t("act10.tag")}</p>
          <h1 className="act10__title">{t("act10.title")}</h1>
          <p className="act10__lead">{t("act10.lead")}</p>
        </header>

        {state.status === "loading" && <p className="act10__state">{t("scene.loading")}</p>}
        {state.status === "empty" && <p className="act10__state act10__state--err">{t("act10.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            <div className="act10__controls">
              <div className="act10__filter" role="group" aria-label={t("act1.filter.title")}>
                <span className="act10__filter-lbl">{t("act1.filter.title")}</span>
                {REGION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`act10__pill ${country === "all" && region === k ? "is-active" : ""}`}
                    onClick={() => onRegion(k)}
                    aria-pressed={country === "all" && region === k}
                  >
                    {t(`act1.filter.${k}`)}
                  </button>
                ))}
              </div>
              <label className="act10__select-wrap">
                <span className="act10__select-lbl">{t("act7.country_label")}</span>
                <select className="act10__select" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="all">{t("act7.country_all")}</option>
                  {countryOptions.map((c) => (
                    <option key={c.area} value={c.area}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* ---------- Eau potable : plus haut = mieux ---------- */}
            {waterS.length > 0 && (
              <section className="act10__sub">
                <div className="act10__sub-head">
                  <h2 className="act10__sub-title">{t("act10.water_title")}</h2>
                  <p className="act10__sub-sub">{t("act10.water_sub")}</p>
                </div>

                <ReadingGuide {...guide("water")} />

                {!single && waterLine.length > 0 && (
                  <ExpandableCard title={t("act10.regional_water_title")} sub={t("act10.regional_water_sub")} {...xc}>
                    <TrendLines series={waterLine} years={water.years} currentYear={waterB} unit={t("act10.water_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard title={t("act10.water_sm_title")} sub={`${waterA}–${waterB} · ${waterS.length} ${t("act2.coverage")}`} {...xc}>
                  <SmallMultiples series={waterS} years={water.years} unit={t("act10.water_unit")} currentYear={waterB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act10.water_hm_title")} sub={t("act10.water_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={waterS} years={water.years} unit={t("act10.water_unit")} scale="sequential" labels={seqLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act10.water_rank_title")} sub={t("act10.water_rank_sub")} {...xc}>
                  <RankBars data={waterRank} unit={t("act10.water_unit")} worldAvg={waterMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act10.water_cmp_title")} sub={t("act10.water_cmp_sub")} {...xc}>
                  <DumbbellChart rows={waterDumb} yearA={waterA} yearB={waterB} unit={t("act10.water_unit")} labels={waterCmp} />
                </ExpandableCard>
              </section>
            )}

            {/* ---------- Tuberculose : plus bas = mieux ---------- */}
            {tbS.length > 0 && (
              <section className="act10__sub">
                <div className="act10__sub-head">
                  <h2 className="act10__sub-title">{t("act10.tb_title")}</h2>
                  <p className="act10__sub-sub">{t("act10.tb_sub")}</p>
                </div>

                <ReadingGuide {...guide("tb")} />

                {!single && tbLine.length > 0 && (
                  <ExpandableCard title={t("act10.regional_tb_title")} sub={t("act10.regional_tb_sub")} {...xc}>
                    <TrendLines series={tbLine} years={tb.years} currentYear={tbB} unit={t("act10.tb_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard title={t("act10.tb_sm_title")} sub={`${tbA}–${tbB} · ${tbS.length} ${t("act2.coverage")}`} {...xc}>
                  <SmallMultiples series={tbS} years={tb.years} unit={t("act10.tb_unit")} currentYear={tbB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act10.tb_hm_title")} sub={t("act10.tb_hm_sub")} {...xc}>
                  <EmissionsHeatmap series={tbS} years={tb.years} unit={t("act10.tb_unit")} scale="sequential" labels={seqLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act10.tb_rank_title")} sub={t("act10.tb_rank_sub")} {...xc}>
                  <RankBars data={tbRank} unit={t("act10.tb_unit")} worldAvg={tbMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act10.tb_cmp_title")} sub={t("act10.tb_cmp_sub")} {...xc}>
                  <DumbbellChart rows={tbDumb} yearA={tbA} yearB={tbB} unit={t("act10.tb_unit")} labels={tbCmp} />
                </ExpandableCard>
              </section>
            )}

            {waterS.length === 0 && tbS.length === 0 && <p className="act10__state">{t("act1.change.empty")}</p>}

            <p className="act10__credit">{t("act10.credit")}</p>
          </>
        )}

        <Link to="/" className="act10__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}