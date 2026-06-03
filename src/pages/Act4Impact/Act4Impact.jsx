// src/pages/Act4Impact/Act4Impact.jsx
// ============================================================
// Acte 04 — L'impact. « Le coût humain. »
// Données ÉVÉNEMENTIELLES (pics, beaucoup de zéros) → pas de courbe :
// chiffres-chocs cumulés, frise des catastrophes (essaim temporel),
// classement par cumul et carte 3D (échelle log). Bascule affectés/pertes.
// ============================================================

import React, {
  useEffect,
  useMemo,
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
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import EventTimeline from "../../components/EventTimeline/EventTimeline";
import RankBars from "../../components/RankBars/RankBars";
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
        out.push({
          area: a,
          name: pictName(a, lang),
          year: p.year,
          value: p.value,
        });
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
      const total = s.reduce(
        (x, p) => x + (Number.isFinite(p.value) ? p.value : 0),
        0,
      );
      return { area: a, code: a, name: pictName(a, lang), value: total };
    })
    .filter((r) => r.value > 0);
}

function Kpi({ value, label }) {
  return (
    <div className="act4__kpi">
      <span className="act4__kpi-val">{value}</span>
      <span className="act4__kpi-lbl">{label}</span>
    </div>
  );
}

export default function Act4Impact() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const affected = useSelector(selectDataset("disastersAffected"));
  const loss = useSelector(selectDataset("disastersLoss"));
  const [metric, setMetric] = useState("affected");

  useEffect(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const ready = affected.status === "succeeded";
  const failed = affected.status === "failed";

  const affEvents = useMemo(
    () => buildEvents(affected.data, lang),
    [affected.data, lang],
  );
  const lossEvents = useMemo(
    () => buildEvents(loss.data, lang),
    [loss.data, lang],
  );
  const affTotals = useMemo(
    () => buildTotals(affected.data, lang),
    [affected.data, lang],
  );
  const lossTotals = useMemo(
    () => buildTotals(loss.data, lang),
    [loss.data, lang],
  );

  const totalAff = useMemo(
    () => affEvents.reduce((s, e) => s + e.value, 0),
    [affEvents],
  );
  const totalLoss = useMemo(
    () => lossEvents.reduce((s, e) => s + e.value, 0),
    [lossEvents],
  );
  const worst = useMemo(
    () =>
      affEvents.reduce((m, e) => (e.value > (m ? m.value : -1) ? e : m), null),
    [affEvents],
  );

  const isLoss = metric === "loss";
  const selEvents = isLoss ? lossEvents : affEvents;
  const selTotals = isLoss ? lossTotals : affTotals;
  const selUnit = isLoss ? t("act4.loss_unit") : t("act4.affected_unit");
  const selFormat = isLoss ? fmtMoney : fmtNum;
  const selMax = useMemo(
    () => selTotals.reduce((m, r) => Math.max(m, r.value), 0),
    [selTotals],
  );

  const retry = useCallback(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  return (
    <main className="act4">
      <div className="container">
        <header className="act4__head">
          <p className="eyebrow">{t("home.acts.a4_tag")}</p>
          <h1 className="act4__title">{t("home.acts.a4_title")}</h1>
          <p className="act4__lead">{t("act4.lead")}</p>
        </header>

        <ReadingGuide
          title={t("act4.guide.title")}
          intro={t("act4.guide.intro")}
          steps={t("act4.guide.steps")}
          takeaway={t("act4.guide.takeaway")}
        />

        {!ready && !failed && (
          <Loader fullscreen label={t("scene.loading")} />
        )}
        {failed && (
          <div className="act4__state act4__state--err">
            <span>{t("scene.error")}</span>
            <button className="act4__btn" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {ready && (
          <>
            {/* Chiffres-chocs (cumuls sur toute la période) */}
            <section className="act4__kpis">
              <Kpi value={fmtNum(totalAff)} label={t("act4.kpi_affected")} />
              <Kpi value={fmtMoney(totalLoss)} label={t("act4.kpi_loss")} />
              <Kpi value={affEvents.length} label={t("act4.kpi_events")} />
              {worst && (
                <Kpi
                  value={fmtNum(worst.value)}
                  label={`${t("act4.kpi_worst")} — ${worst.name} ${worst.year}`}
                />
              )}
            </section>

            {/* Bascule métrique */}
            <div className="act4__metric">
              <span className="act4__metric-label">{t("act4.explore")}</span>
              <div className="act4__toggle">
                <button
                  className={`act4__toggle-btn ${!isLoss ? "is-on" : ""}`}
                  onClick={() => setMetric("affected")}
                >
                  {t("act4.affected_title")}
                </button>
                <button
                  className={`act4__toggle-btn ${isLoss ? "is-on" : ""}`}
                  onClick={() => setMetric("loss")}
                >
                  {t("act4.loss_title")}
                </button>
              </div>
            </div>

            {/* Frise des catastrophes */}
            <div className="act4__sec-head">
              <h3 className="act4__sec-title">{t("act4.timeline_title")}</h3>
              <span className="act4__sub">
                {t("act4.timeline_sub")} · {selUnit}
              </span>
            </div>
            <EventTimeline
              events={selEvents}
              unit={selUnit}
              format={selFormat}
            />

            {/* Classement cumulé */}
            <div className="act4__sec-head">
              <h3 className="act4__sec-title">{t("act4.rank_title")}</h3>
              <span className="act4__sub">
                {t("act4.rank_sub")} · {selUnit}
              </span>
            </div>
            <RankBars data={selTotals} unit={selUnit} />

            {/* Carte 3D (échelle log) */}
            <div className="act4__sec-head">
              <h3 className="act4__sec-title">{t("act4.map_title")}</h3>
              <span className="act4__sub">
                {t("act4.map_sub")} · {selUnit}
              </span>
            </div>
            <ErrorBoundary
              fallback={
                <div className="act4__state act4__state--err">
                  {t("scene.error")}
                </div>
              }
            >
              <Suspense
                fallback={
                  <Loader compact label={t("scene.loading")} />
                }
              >
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
          </>
        )}

        <Link to="/" className="act4__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}