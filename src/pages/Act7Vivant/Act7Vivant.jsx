// src/pages/Act7Vivant/Act7Vivant.jsx
// ============================================================
// Acte 07 — Le vivant. Deux indicateurs réels du PDH, joints par GEO_PICT :
//   • Liste Rouge (DF_SDG_15, ER_RSK_LST) — indice de risque d'extinction (0–1, recule).
//   • Gestion des pêches (DF_CLIMATE_CHANGE, FISH_MNGT_MULT_BILAT_ARGMT) — mesures en place (cumul, monte).
//
// Acte complet : filtre par sous-région + focus par territoire, trajectoire
// régionale (médiane), petits multiples, carte de chaleur, classement,
// avant→après. Tout réagit au filtre. 100 % données API. Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchVivant } from "../../services/vivantApi";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import RankBars from "../../components/RankBars/RankBars";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
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

// valeur exacte à `year`, sinon dernière valeur connue ≤ year
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
// médiane par année sur les territoires visibles → une ligne régionale
function medianLine(series, years, name) {
  const vals = years
    .map((y) => {
      const v = series.map((s) => valueAt(s.values, y)).filter((n) => Number.isFinite(n));
      const m = median(v);
      return m == null ? null : { year: y, value: m };
    })
    .filter(Boolean);
  return vals.length ? [{ area: "MED", name, values: vals }] : [];
}

export default function Act7Vivant() {
  const { t, lang } = useLang();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchVivant({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      // eslint-disable-next-line no-console
      console.info("[Act7] reçu:", {
        source: res.source,
        redList: res.redList && { status: res.redList.status, areas: res.redList.areas?.length },
        fishMgmt: res.fishMgmt && { status: res.fishMgmt.status, areas: res.fishMgmt.areas?.length },
      });
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

  // liste des territoires (union) pour le sélecteur, triée par nom localisé
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

  const regionLabel =
    country !== "all" ? pictName(country, lang) : t(`act1.filter.${region}`);
  const medName = `${regionLabel} · ${t("act7.median_name")}`;

  // repères temporels
  // toujours la plage complète réellement renvoyée par l'API — aucune troncature
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
  const rlLine = useMemo(() => medianLine(rlSeries, rl?.years || [], medName), [rlSeries, rl, medName]);

  const fishRank = useMemo(() => buildRank(fishSeries, fishB), [fishSeries, fishB]);
  const fishDumb = useMemo(() => buildDumbbell(fishSeries, fishA, fishB), [fishSeries, fishA, fishB]);
  const fishMed = useMemo(() => {
    const m = median(fishRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [fishRank]);
  const fishLine = useMemo(() => medianLine(fishSeries, fish?.years || [], medName), [fishSeries, fish, medName]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };
  const hmLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };
  const single = country !== "all";

  const onRegion = (k) => {
    setRegion(k);
    setCountry("all");
  };

  return (
    <main className="act7">
      <div className="container">
        <header className="act7__head">
          <p className="eyebrow">{t("act7.tag")}</p>
          <h1 className="act7__title">{t("act7.title")}</h1>
          <p className="act7__lead">{t("act7.lead")}</p>
        </header>

        {state.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {state.status === "empty" && <p className="act7__state act7__state--err">{t("act7.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            {/* ---------- Barre de filtres ---------- */}
            <div className="act7__controls">
              <div className="act7__filter" role="group" aria-label={t("act1.filter.title")}>
                <span className="act7__filter-lbl">{t("act1.filter.title")}</span>
                {REGION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`act7__pill ${country === "all" && region === k ? "is-active" : ""}`}
                    onClick={() => onRegion(k)}
                    aria-pressed={country === "all" && region === k}
                  >
                    {t(`act1.filter.${k}`)}
                  </button>
                ))}
              </div>
              <label className="act7__select-wrap">
                <span className="act7__select-lbl">{t("act7.country_label")}</span>
                <select
                  className="act7__select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="all">{t("act7.country_all")}</option>
                  {countryOptions.map((c) => (
                    <option key={c.area} value={c.area}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* ---------- Liste Rouge ---------- */}
            {rlSeries.length > 0 && (
              <section className="act7__sub">
                <div className="act7__sub-head">
                  <h2 className="act7__sub-title">{t("act7.redlist_title")}</h2>
                  <p className="act7__sub-sub">{t("act7.redlist_sub")}</p>
                </div>

                {!single && rlLine.length > 0 && (
                  <ExpandableCard title={t("act7.regional_rl_title")} sub={t("act7.regional_rl_sub")} {...xc}>
                    <TrendLines series={rlLine} years={rl.years} currentYear={rlB} unit={t("act7.redlist_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard
                  title={t("act7.redlist_title")}
                  sub={`${rlA}–${rlB} · ${rlSeries.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples series={rlSeries} years={rl.years} unit={t("act7.redlist_unit")} currentYear={rlB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act7.rl_heatmap_title")} sub={t("act7.rl_heatmap_sub")} {...xc}>
                  <EmissionsHeatmap series={rlSeries} years={rl.years} unit={t("act7.redlist_unit")} scale="sequential" labels={hmLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act7.rl_rank_title")} sub={t("act7.rl_rank_sub")} {...xc}>
                  <RankBars data={rlRank} unit={t("act7.redlist_unit")} worldAvg={rlMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act7.rl_compare_title")} sub={t("act7.rl_compare_sub")} {...xc}>
                  <DumbbellChart rows={rlDumb} yearA={rlA} yearB={rlB} unit={t("act7.redlist_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {/* ---------- Gestion des pêches ---------- */}
            {fishSeries.length > 0 && (
              <section className="act7__sub">
                <div className="act7__sub-head">
                  <h2 className="act7__sub-title">{t("act7.fish_title")}</h2>
                  <p className="act7__sub-sub">{t("act7.fish_sub")}</p>
                </div>

                {!single && fishLine.length > 0 && (
                  <ExpandableCard title={t("act7.regional_fish_title")} sub={t("act7.regional_fish_sub")} {...xc}>
                    <TrendLines series={fishLine} years={fish.years} currentYear={fishB} unit={t("act7.fish_unit")} />
                  </ExpandableCard>
                )}

                <ExpandableCard
                  title={t("act7.fish_title")}
                  sub={`${fish.firstYear}–${fishB} · ${fishSeries.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples series={fishSeries} years={fish.years} unit={t("act7.fish_unit")} currentYear={fishB} labels={{ last: t("act6.smallmult_last") }} />
                </ExpandableCard>

                <ExpandableCard title={t("act7.fish_heatmap_title")} sub={t("act7.fish_heatmap_sub")} {...xc}>
                  <EmissionsHeatmap series={fishSeries} years={fish.years} unit={t("act7.fish_unit")} scale="sequential" labels={hmLabels} />
                </ExpandableCard>

                <ExpandableCard title={t("act7.fish_rank_title")} sub={t("act7.fish_rank_sub")} {...xc}>
                  <RankBars data={fishRank} unit={t("act7.fish_unit")} worldAvg={fishMed} refLabel={t("act6.median_ref")} />
                </ExpandableCard>

                <ExpandableCard title={t("act7.fish_compare_title")} sub={t("act7.fish_compare_sub")} {...xc}>
                  <DumbbellChart rows={fishDumb} yearA={fishA} yearB={fishB} unit={t("act7.fish_unit")} labels={cmpLabels} />
                </ExpandableCard>
              </section>
            )}

            {rlSeries.length === 0 && fishSeries.length === 0 && (
              <p className="act7__state">{t("act1.change.empty")}</p>
            )}
          </>
        )}

        <Link to="/" className="act7__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}