// src/pages/Act7Vivant/Act7Vivant.jsx
// ============================================================
// Acte 07 — Le vivant. Deux indicateurs réels du PDH joints par GEO_PICT :
//   • Liste Rouge (DF_SDG_15, ER_RSK_LST) — indice de risque d'extinction (0–1, recule).
//   • Gestion des pêches (DF_CLIMATE_CHANGE, FISH_MNGT_MULT_BILAT_ARGMT) — mesures en place (cumul, monte).
// Par indicateur : petits multiples, carte de chaleur, classement, avant→après.
// 100 % données API. Aucun style inline en JSX.
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
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import "./Act7Vivant.scss";

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
    .map((s) => ({
      area: s.area,
      name: s.name,
      a: valueAt(s.values, yearA),
      b: valueAt(s.values, yearB),
    }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}

export default function Act7Vivant() {
  const { t, lang } = useLang();
  const [state, setState] = useState({ status: "loading", data: null });

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

  const rlSeries = useMemo(() => toSeries(rl, lang), [rl, lang]);
  const fishSeries = useMemo(() => toSeries(fish, lang), [fish, lang]);

  // Liste Rouge : repères temporels (couverture complète 1993→dernière)
  const rlA = rl?.firstYear ?? 1993;
  const rlB = rl?.lastYear ?? 2024;
  const rlRank = useMemo(() => buildRank(rlSeries, rlB), [rlSeries, rlB]);
  const rlDumb = useMemo(() => buildDumbbell(rlSeries, rlA, rlB), [rlSeries, rlA, rlB]);
  const rlMed = useMemo(() => {
    const m = median(rlRank.map((r) => r.value));
    return m == null ? null : Math.round(m * 100) / 100;
  }, [rlRank]);

  // Pêches : on compare une base récente (2000) à la dernière année
  const fishA = Math.max(fish?.firstYear ?? 2000, 2000);
  const fishB = fish?.lastYear ?? 2024;
  const fishRank = useMemo(() => buildRank(fishSeries, fishB), [fishSeries, fishB]);
  const fishDumb = useMemo(() => buildDumbbell(fishSeries, fishA, fishB), [fishSeries, fishA, fishB]);
  const fishMed = useMemo(() => {
    const m = median(fishRank.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [fishRank]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };
  const hmLabels = {
    low: t("act6.heatmap_low"),
    high: t("act6.heatmap_high"),
    empty: t("act1.change.empty"),
    mode_row: t("act6.heatmap_mode_row"),
    mode_abs: t("act6.heatmap_mode_abs"),
  };
  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  return (
    <main className="act7">
      <div className="container">
        <header className="act7__head">
          <p className="eyebrow">{t("act7.tag")}</p>
          <h1 className="act7__title">{t("act7.title")}</h1>
          <p className="act7__lead">{t("act7.lead")}</p>
        </header>

        {state.status === "loading" && <p className="act7__state">{t("scene.loading")}</p>}
        {state.status === "empty" && <p className="act7__state act7__state--err">{t("act7.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            {/* ---------- Liste Rouge ---------- */}
            {rlSeries.length > 0 && (
              <section className="act7__sub">
                <div className="act7__sub-head">
                  <h2 className="act7__sub-title">{t("act7.redlist_title")}</h2>
                  <p className="act7__sub-sub">{t("act7.redlist_sub")}</p>
                </div>

                <ExpandableCard
                  title={t("act7.redlist_title")}
                  sub={`${rlA}–${rlB} · ${rlSeries.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples
                    series={rlSeries}
                    years={rl.years}
                    unit={t("act7.redlist_unit")}
                    currentYear={rlB}
                    labels={{ last: t("act6.smallmult_last") }}
                  />
                </ExpandableCard>

                <ExpandableCard title={t("act7.rl_heatmap_title")} sub={t("act7.rl_heatmap_sub")} {...xc}>
                  <EmissionsHeatmap
                    series={rlSeries}
                    years={rl.years}
                    unit={t("act7.redlist_unit")}
                    scale="sequential"
                    labels={hmLabels}
                  />
                </ExpandableCard>

                <ExpandableCard title={t("act7.rl_rank_title")} sub={t("act7.rl_rank_sub")} {...xc}>
                  <RankBars
                    data={rlRank}
                    unit={t("act7.redlist_unit")}
                    worldAvg={rlMed}
                    refLabel={t("act6.median_ref")}
                  />
                </ExpandableCard>

                <ExpandableCard title={t("act7.rl_compare_title")} sub={t("act7.rl_compare_sub")} {...xc}>
                  <DumbbellChart
                    rows={rlDumb}
                    yearA={rlA}
                    yearB={rlB}
                    unit={t("act7.redlist_unit")}
                    labels={cmpLabels}
                  />
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

                <ExpandableCard
                  title={t("act7.fish_title")}
                  sub={`${fish.firstYear}–${fishB} · ${fishSeries.length} ${t("act2.coverage")}`}
                  {...xc}
                >
                  <SmallMultiples
                    series={fishSeries}
                    years={fish.years}
                    unit={t("act7.fish_unit")}
                    currentYear={fishB}
                    labels={{ last: t("act6.smallmult_last") }}
                  />
                </ExpandableCard>

                <ExpandableCard title={t("act7.fish_heatmap_title")} sub={t("act7.fish_heatmap_sub")} {...xc}>
                  <EmissionsHeatmap
                    series={fishSeries}
                    years={fish.years}
                    unit={t("act7.fish_unit")}
                    scale="sequential"
                    labels={hmLabels}
                  />
                </ExpandableCard>

                <ExpandableCard title={t("act7.fish_rank_title")} sub={t("act7.fish_rank_sub")} {...xc}>
                  <RankBars
                    data={fishRank}
                    unit={t("act7.fish_unit")}
                    worldAvg={fishMed}
                    refLabel={t("act6.median_ref")}
                  />
                </ExpandableCard>

                <ExpandableCard title={t("act7.fish_compare_title")} sub={t("act7.fish_compare_sub")} {...xc}>
                  <DumbbellChart
                    rows={fishDumb}
                    yearA={fishA}
                    yearB={fishB}
                    unit={t("act7.fish_unit")}
                    labels={cmpLabels}
                  />
                </ExpandableCard>
              </section>
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