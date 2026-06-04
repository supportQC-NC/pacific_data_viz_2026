// src/pages/Act4Impact/Act4Impact.jsx
// ============================================================
// Acte 04 — L'impact. « Le coût humain. »
// Données ÉVÉNEMENTIELLES (pics, beaucoup de zéros). MÊME EXPÉRIENCE que les
// Actes 1–3 : diaporama plein écran, filtres repliables (bascule
// affectés/pertes par panneau), navigation clavier/boutons, écran de fin.
// On GARDE l'existant (frise essaim, classement, carte 3D log) et on AJOUTE
// des vues ApexCharts adaptées à l'événementiel :
//   • histogramme des totaux PAR ANNÉE,
//   • double-axe coût humain × coût économique,
//   • Pareto (concentration : barres triées + cumulé %),
//   • treemap (part cumulée par territoire),
//   • heatmap territoire × année (intensité, rangs).
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import useThemeTokens from "../../hooks/UseThemeTokens";
import KpiRow from "../../components/KpiRow/KpiRow";
import EventTimeline from "../../components/EventTimeline/EventTimeline";
import RankBars from "../../components/RankBars/RankBars";
import VizPanel from "../../components/charts/VizPanel";
import AnnualBarsChart from "../../components/charts/AnnualBarsChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import ParetoChart from "../../components/charts/ParetoChart";
import TreemapChart from "../../components/charts/TreemapChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import "./Act4Impact.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

const fmtNum = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1).replace(".", ",")} M`
    : n >= 1e3
      ? `${Math.round(n / 1e3)} k`
      : String(Math.round(n));
const fmtMoney = (n) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1).replace(".", ",")} Md$`
    : n >= 1e6
      ? `${Math.round(n / 1e6)} M$`
      : n >= 1e3
        ? `${Math.round(n / 1e3)} k$`
        : `${Math.round(n)} $`;

function buildEvents(d, lang) {
  if (!d) return [];
  const out = [];
  d.areas.forEach((a) => {
    if (!isPict(a)) return;
    (d.byArea[a] || []).forEach((p) => {
      if (Number.isFinite(p.value) && p.value > 0)
        out.push({ area: a, name: pictName(a, lang), year: p.year, value: p.value });
    });
  });
  return out;
}
function buildTotals(d, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const s = d.byArea[a] || [];
      const total = s.reduce((x, p) => x + (Number.isFinite(p.value) ? p.value : 0), 0);
      return { area: a, code: a, name: pictName(a, lang), value: total };
    })
    .filter((r) => r.value > 0);
}
function buildSeries(d, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }))
    .filter((s) => s.values.some((p) => p.value > 0));
}
function annualTotals(d) {
  if (!d) return [];
  return (d.years || []).map((year) => {
    let v = 0;
    d.areas.forEach((a) => {
      if (!isPict(a)) return;
      const p = (d.byArea[a] || []).find((q) => q.year === year);
      if (p && Number.isFinite(p.value)) v += p.value;
    });
    return { year, value: v };
  });
}

/* ---------- Contrôle de filtre (mêmes pills que Actes 1–3) ---------- */
function Pills({ label, options, value, onChange }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__pills">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            className={`act1f__pill ${value === o.v ? "is-active" : ""}`}
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Act4Impact() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const activeRef = useRef(0);

  const affected = useSelector(selectDataset("disastersAffected"));
  const loss = useSelector(selectDataset("disastersLoss"));
  const [metric, setMetric] = useState("affected");

  useEffect(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const ready = affected.status === "succeeded";
  const failed = affected.status === "failed";

  const affEvents = useMemo(() => buildEvents(affected.data, lang), [affected.data, lang]);
  const lossEvents = useMemo(() => buildEvents(loss.data, lang), [loss.data, lang]);
  const affTotals = useMemo(() => buildTotals(affected.data, lang), [affected.data, lang]);
  const lossTotals = useMemo(() => buildTotals(loss.data, lang), [loss.data, lang]);
  const affSeries = useMemo(() => buildSeries(affected.data, lang), [affected.data, lang]);
  const lossSeries = useMemo(() => buildSeries(loss.data, lang), [loss.data, lang]);
  const affAnnual = useMemo(() => annualTotals(affected.data), [affected.data]);
  const lossAnnual = useMemo(() => annualTotals(loss.data), [loss.data]);

  const totalAff = useMemo(() => affEvents.reduce((s, e) => s + e.value, 0), [affEvents]);
  const totalLoss = useMemo(() => lossEvents.reduce((s, e) => s + e.value, 0), [lossEvents]);
  const worst = useMemo(
    () => affEvents.reduce((m, e) => (e.value > (m ? m.value : -1) ? e : m), null),
    [affEvents],
  );

  const isLoss = metric === "loss";
  const selData = isLoss ? loss.data : affected.data;
  const selEvents = isLoss ? lossEvents : affEvents;
  const selTotals = isLoss ? lossTotals : affTotals;
  const selSeries = isLoss ? lossSeries : affSeries;
  const selAnnual = isLoss ? lossAnnual : affAnnual;
  const selUnit = isLoss ? t("act4.loss_unit") : t("act4.affected_unit");
  const selFormat = isLoss ? fmtMoney : fmtNum;
  const selColor = isLoss ? tk.negative : tk.warm;
  const selYears = useMemo(() => (selData ? selData.years : []), [selData]);
  const selMax = useMemo(() => selTotals.reduce((m, r) => Math.max(m, r.value), 0), [selTotals]);

  const kpiItems = useMemo(() => {
    const items = [
      { key: "aff", value: fmtNum(totalAff), unit: t("act4.affected_unit"), label: t("act4.kpi_affected"), tone: "warm" },
      { key: "loss", value: fmtMoney(totalLoss), unit: "", label: t("act4.kpi_loss"), tone: "negative" },
      { key: "evt", value: String(affEvents.length), unit: "", label: t("act4.kpi_events"), tone: "accent" },
    ];
    if (worst)
      items.push({ key: "worst", value: fmtNum(worst.value), unit: `${worst.name} ${worst.year}`, label: t("act4.kpi_worst"), tone: "warm" });
    return items;
  }, [totalAff, totalLoss, affEvents.length, worst, t]);

  const metricOpts = [
    { v: "affected", label: t("act4.affected_title") },
    { v: "loss", label: t("act4.loss_title") },
  ];

  const retry = useCallback(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  // Diaporama : suit la diapo active via le scroll + navigation prev/next.
  useEffect(() => {
    if (!ready) return undefined;
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
  }, [ready, metric, lang]);

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
    if (!ready) return undefined;
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
  }, [ready, goTo]);

  const metricFilter = (
    <Pills label={t("act4.explore")} options={metricOpts} value={metric} onChange={setMetric} />
  );

  return (
    <main className="act1 act4" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("home.acts.a4_tag")}</p>
          <h1 className="act1__title">{t("home.acts.a4_title")}</h1>
          <p className="act1__lead">{t("act4.lead")}</p>
          {kpiItems.length > 0 && <KpiRow items={kpiItems} title={t("act1.stats.title")} />}
        </header>

        {!ready && !failed && <Loader fullscreen label={t("scene.loading")} />}

        {failed && (
          <div className="act1__state act1__state--err">
            <span>{t("scene.error")}</span>
            <button className="act1__retry" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {ready && (
          <>
            {/* Frise des catastrophes (essaim temporel) */}
            <VizPanel
              title={t("act4.timeline_title")}
              subtitle={`${t("act4.timeline_sub")} · ${selUnit}`}
              story={t("act4.story.timeline")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <EventTimeline events={selEvents} unit={selUnit} format={selFormat} />
            </VizPanel>

            {/* Totaux par année */}
            <VizPanel
              title={t("act4.annual_title")}
              subtitle={`${t("act4.annual_sub")} · ${selUnit}`}
              story={t("act4.story.annual")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <AnnualBarsChart data={selAnnual} unit={selUnit} color={selColor} format={selFormat} />
            </VizPanel>

            {/* Double-axe : coût humain × coût économique */}
            <VizPanel
              title={t("act4.dual_title")}
              subtitle={t("act4.dual_sub")}
              story={t("act4.story.dual")}
            >
              <DualAxisChart
                seaSeries={[{ name: t("act4.affected_title"), values: affAnnual }]}
                seaYears={affAnnual.map((d) => d.year)}
                sstSeries={[{ name: t("act4.loss_title"), values: lossAnnual }]}
                sstYears={lossAnnual.map((d) => d.year)}
                seaName={t("act4.affected_title")}
                sstName={t("act4.loss_title")}
                seaUnit={t("act4.affected_unit")}
                sstUnit={t("act4.loss_unit")}
              />
            </VizPanel>

            {/* Classement cumulé (existant) */}
            <VizPanel
              title={t("act4.rank_title")}
              subtitle={`${t("act4.rank_sub")} · ${selUnit}`}
              story={t("act4.story.rank")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <RankBars data={selTotals} unit={selUnit} />
            </VizPanel>

            {/* Pareto : concentration */}
            <VizPanel
              title={t("act4.pareto_title")}
              subtitle={`${t("act4.pareto_sub")} · ${selUnit}`}
              story={t("act4.story.pareto")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <ParetoChart rows={selTotals} unit={selUnit} cumulLabel={t("act4.pareto_cumul")} format={selFormat} />
            </VizPanel>

            {/* Treemap : part cumulée par territoire */}
            <VizPanel
              title={t("act4.treemap_title")}
              subtitle={`${t("act4.treemap_sub")} · ${selUnit}`}
              story={t("act4.story.treemap")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <TreemapChart rows={selTotals} unit={selUnit} format={selFormat} />
            </VizPanel>

            {/* Heatmap territoire × année */}
            <VizPanel
              title={t("act4.heat_title")}
              subtitle={`${t("act4.heat_sub")} · ${selUnit}`}
              story={t("act4.story.heat")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <HeatmapChart series={selSeries} years={selYears} unit={selUnit} mode="rank" />
            </VizPanel>

            {/* Carte 3D (échelle log) */}
            <VizPanel
              title={t("act4.map_title")}
              subtitle={`${t("act4.map_sub")} · ${selUnit}`}
              story={t("act4.story.map")}
              filtersLabel={t("act1.f.toggle")}
              filters={metricFilter}
            >
              <ErrorBoundary fallback={<div className="act1__state act1__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={selTotals}
                    unit={selUnit}
                    range={{ min: 0, max: selMax }}
                    logScale
                    lowLabel={t("act4.map_low")}
                    highLabel={t("act4.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            </VizPanel>

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act4.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act4.outro.title")}</h2>
                <p className="act1outro__text">{t("act4.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/momentum" className="act1outro__btn act1outro__btn--primary">
                    {t("act4.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act4.outro.home")}
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

      {ready && slideCount > 0 && (
        <div className="act1nav" role="group" aria-label={t("act1.nav.next")}>
          <button
            type="button"
            className="act1nav__btn"
            onClick={() => goTo(active - 1)}
            disabled={active <= 0}
            aria-label={t("act1.nav.prev")}
          >
            ↑
          </button>
          <span className="act1nav__count">
            {active + 1}/{slideCount}
          </span>
          <button
            type="button"
            className="act1nav__btn"
            onClick={() => goTo(active + 1)}
            disabled={active >= slideCount - 1}
            aria-label={t("act1.nav.next")}
          >
            ↓
          </button>
        </div>
      )}
    </main>
  );
}