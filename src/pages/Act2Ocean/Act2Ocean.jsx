// src/pages/Act2Ocean/Act2Ocean.jsx
// ============================================================
// Acte 02 — L'océan. « La mer change. »
// Étape 1 : récupération Redux (seaLevel + sst) + LOG STRUCTURÉ
// de la donnée réelle (console groupée + table + série d'exemple)
// pour caler les composants de visualisation à l'étape suivante.
// ============================================================

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import "./Act2Ocean.scss";

// --- Log lisible d'un jeu normalisé (à retirer une fois les visus faites) ---
function logDataset(id, d) {
  if (!d) return;
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[Acte2] ${id} · source=${d.source} · ${d.firstYear}–${d.lastYear} · ${d.areas.length} zones`,
    "color:#1f9bc9;font-weight:700",
  );
  /* eslint-disable no-console */
  console.log("years:", d.years);
  console.log("areas:", d.areas);
  console.log("range:", d.range);

  // Une ligne par territoire : nb de points, première/dernière année, dernière valeur.
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

  // Série complète d'un territoire d'exemple (forme exacte des points).
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
    <article className="act2__panel">
      <div className="act2__panel-head">
        <h2 className="act2__panel-title">{title}</h2>
        <span className="act2__panel-sub">
          {sub} · {unit}
          {isDemo ? ` · ${t("act2.demo_badge")}` : ""}
        </span>
      </div>

      {!ready && !failed && <p className="act2__state">{t("scene.loading")}</p>}
      {failed && (
        <p className="act2__state act2__state--err">{t("scene.error")}</p>
      )}

      {ready && (
        <dl className="act2__stats">
          <div className="act2__stat">
            <dt>{t("act2.coverage")}</dt>
            <dd>{ds.data.areas.length}</dd>
          </div>
          <div className="act2__stat">
            <dt>{t("act2.period")}</dt>
            <dd>
              {ds.data.firstYear}–{ds.data.lastYear}
            </dd>
          </div>
          <div className="act2__stat">
            <dt>min · max</dt>
            <dd>
              {ds.data.range.min.toFixed(2)} · {ds.data.range.max.toFixed(2)}
            </dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export default function Act2Ocean() {
  const { t } = useLang();
  const dispatch = useDispatch();
  const seaLevel = useSelector(selectDataset("seaLevel"));
  const sst = useSelector(selectDataset("sst"));

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  // Logs dès que chaque jeu est prêt.
  useEffect(() => {
    if (seaLevel.status === "succeeded") logDataset("seaLevel", seaLevel.data);
  }, [seaLevel.status, seaLevel.data]);
  useEffect(() => {
    if (sst.status === "succeeded") logDataset("sst", sst.data);
  }, [sst.status, sst.data]);

  return (
    <main className="act2">
      <div className="container">
        <header className="act2__head">
          <p className="eyebrow">{t("home.acts.a2_tag")}</p>
          <h1 className="act2__title">{t("home.acts.a2_title")}</h1>
          <p className="act2__lead">{t("act2.lead")}</p>
        </header>

        <section className="act2__panels">
          <DataPanel
            ds={seaLevel}
            title={t("act2.sea_title")}
            sub={t("act2.sea_sub")}
            unit={t("act2.sea_unit")}
            t={t}
          />
          <DataPanel
            ds={sst}
            title={t("act2.sst_title")}
            sub={t("act2.sst_sub")}
            unit={t("act2.sst_unit")}
            t={t}
          />
        </section>

        <p className="act2__coming">{t("act2.coming")}</p>

        <Link to="/" className="act2__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}
