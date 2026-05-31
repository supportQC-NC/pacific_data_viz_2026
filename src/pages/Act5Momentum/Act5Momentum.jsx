// src/pages/Act5Momentum/Act5Momentum.jsx
// ============================================================
// Acte 05 — La réponse. « L'élan. »
// Étape 1 : récupération Redux du dataset `renewables` (part des
// renouvelables dans la conso finale d'énergie, %) + LOG STRUCTURÉ
// pour caler les visualisations. Design complet ensuite.
// ============================================================

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import "./Act5Momentum.scss";

function logDataset(id, d) {
  if (!d) return;
  /* eslint-disable no-console */
  console.groupCollapsed(
    `%c[Acte5] ${id} · source=${d.source} · ${d.firstYear}–${d.lastYear} · ${d.areas.length} zones`,
    "color:#3fbf7f;font-weight:700",
  );
  console.log("years:", d.years);
  console.log("areas:", d.areas);
  console.log("range:", d.range);
  const latest = d.lastYear;
  const table = d.areas.map((a) => {
    const s = d.byArea[a] || [];
    const lp = s.find((p) => p.year === latest) || s[s.length - 1];
    return {
      area: a,
      points: s.length,
      first: s[0] && s[0].year,
      last: s[s.length - 1] && s[s.length - 1].year,
      latestValue: lp && lp.value,
    };
  });
  console.table(table);
  const sample = d.areas[0];
  console.log(`série exemple [${sample}] :`, d.byArea[sample]);
  console.log("objet normalisé complet :", d);
  console.groupEnd();
  /* eslint-enable no-console */
}

function DataPanel({ ds, title, sub, unit, t }) {
  const ready = ds.status === "succeeded";
  const failed = ds.status === "failed";
  const isDemo = ready && ds.data && ds.data.source === "fallback";

  return (
    <article className="act5__panel">
      <div className="act5__panel-head">
        <h2 className="act5__panel-title">{title}</h2>
        <span className="act5__panel-sub">
          {sub} · {unit}
          {isDemo ? ` · ${t("act5.demo_badge")}` : ""}
        </span>
      </div>

      {!ready && !failed && <p className="act5__state">{t("scene.loading")}</p>}
      {failed && (
        <p className="act5__state act5__state--err">{t("scene.error")}</p>
      )}

      {ready && (
        <dl className="act5__stats">
          <div className="act5__stat">
            <dt>{t("act5.coverage")}</dt>
            <dd>{ds.data.areas.length}</dd>
          </div>
          <div className="act5__stat">
            <dt>{t("act5.period")}</dt>
            <dd>
              {ds.data.firstYear}–{ds.data.lastYear}
            </dd>
          </div>
          <div className="act5__stat">
            <dt>min · max</dt>
            <dd>
              {ds.data.range.min.toFixed(1)} · {ds.data.range.max.toFixed(1)}
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export default function Act5Momentum() {
  const { t } = useLang();
  const dispatch = useDispatch();
  const renew = useSelector(selectDataset("renewables"));

  useEffect(() => {
    dispatch(loadDataset("renewables"));
  }, [dispatch]);

  useEffect(() => {
    if (renew.status === "succeeded") logDataset("renewables", renew.data);
  }, [renew.status, renew.data]);

  return (
    <main className="act5">
      <div className="container">
        <header className="act5__head">
          <p className="eyebrow">{t("home.acts.a5_tag")}</p>
          <h1 className="act5__title">{t("home.acts.a5_title")}</h1>
          <p className="act5__lead">{t("act5.lead")}</p>
        </header>

        <section className="act5__panels">
          <DataPanel
            ds={renew}
            title={t("act5.ren_title")}
            sub={t("act5.ren_sub")}
            unit={t("act5.ren_unit")}
            t={t}
          />
        </section>

        <p className="act5__coming">{t("act5.coming")}</p>

        <Link to="/" className="act5__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}
