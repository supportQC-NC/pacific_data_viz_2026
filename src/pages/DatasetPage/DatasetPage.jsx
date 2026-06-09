// src/pages/DatasetPage/DatasetPage.jsx
// ============================================================
// Page détail d'un JEU DE DONNÉES (route /data/:id), atteinte en cliquant
// une carte de la page À propos.
//   • métadonnées : fournisseur / fréquence / licence / notes (datasetSources)
//   • liens de source (datasetCatalog)
//   • DONNÉES BRUTES : tableau {territoire, code, année, valeur} (tri, filtre,
//     pagination, export CSV) pour les jeux récupérables via le service générique (climateSlice/pdhApi).
//     Les autres affichent leurs liens + un message (consultables dans les actes).
// i18n via t(). SCSS only.
// ============================================================

import React, { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiArrowLeft, FiArrowUpRight, FiDatabase } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import DATASET_CATALOG, { datasetById } from "../../data/datasetCatalog";
import { getDatasetSource } from "../../data/datasetSources";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName } from "../../i18n/pictNames";
import RawDataTable from "../../components/RawDataTable/RawDataTable";
import "./DatasetPage.scss";

// id du catalogue -> clé pdhApi (jeux récupérables génériquement → table brute)
const RAW_LOADABLE = {
  emissions: "emissions",
  seaLevel: "seaLevel",
  sst: "sst",
  landcover: "landCover",
  agriculture: "cropYield",
  disasters: "disastersAffected",
  rain: "rain",
  tourism: "tourism",
  energy: "electricity",
  water: "water",
  health: "tuberculosis",
  biodiversity: "redList",
};
// id du catalogue -> clé datasetSources (métadonnées de provenance)
const META_KEY = {
  emissions: "emissions",
  seaLevel: "seaLevel",
  sst: "sst",
  disasters: "disastersAffected",
};

export default function DatasetPage() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const pick = (fr, en) => (lang === "fr" ? fr : en);

  const ds = datasetById(id);
  const rawKey = RAW_LOADABLE[id] || null;

  const dsState = useSelector(rawKey ? selectDataset(rawKey) : () => null);

  useEffect(() => {
    if (rawKey) dispatch(loadDataset(rawKey));
  }, [rawKey, dispatch]);

  const rows = useMemo(() => {
    const data = dsState && dsState.data;
    if (!data || !data.byArea) return [];
    const out = [];
    Object.keys(data.byArea).forEach((area) => {
      (data.byArea[area] || []).forEach((p) => {
        if (p && Number.isFinite(p.value)) {
          out.push({
            territoire: pictName(area, lang),
            code: area,
            annee: p.year,
            valeur: p.value,
          });
        }
      });
    });
    out.sort((a, b) =>
      a.territoire === b.territoire
        ? a.annee - b.annee
        : a.territoire.localeCompare(b.territoire),
    );
    return out;
  }, [dsState, lang]);

  const columns = useMemo(
    () => [
      { key: "territoire", label: t("dataset.col_territory"), type: "string" },
      { key: "code", label: t("dataset.col_code"), type: "string" },
      { key: "annee", label: t("dataset.col_year"), type: "year" },
      { key: "valeur", label: t("dataset.col_value"), type: "number" },
    ],
    [t],
  );

  // id inconnu → message + retour
  if (!ds) {
    return (
      <main className="datasetpage">
        <div className="datasetpage__inner container">
          <Link to="/a-propos" className="datasetpage__back">
            <FiArrowLeft aria-hidden="true" /> {t("dataset.back")}
          </Link>
          <h1 className="datasetpage__title">{t("dataset.unknown")}</h1>
        </div>
      </main>
    );
  }

  const meta = getDatasetSource(META_KEY[id] || id, lang);
  const status = dsState ? dsState.status : "idle";
  const nf = lang === "fr" ? "fr-FR" : "en-US";

  return (
    <main className="datasetpage">
      <div className="datasetpage__glow" aria-hidden="true" />
      <div className="datasetpage__inner container">
        <Link to="/a-propos" className="datasetpage__back">
          <FiArrowLeft aria-hidden="true" /> {t("dataset.back")}
        </Link>

        <p className="eyebrow datasetpage__eyebrow">
          <FiDatabase aria-hidden="true" /> {t("dataset.eyebrow")}
        </p>
        <h1 className="datasetpage__title">{pick(ds.labelFr, ds.labelEn)}</h1>
        <p className="datasetpage__desc">{pick(ds.descFr, ds.descEn)}</p>

        {/* Métadonnées de provenance (si disponibles) */}
        {meta && (meta.provider || meta.frequency || meta.license) ? (
          <dl className="datasetpage__meta">
            {meta.provider ? (
              <div className="datasetpage__meta-row">
                <dt>{t("dataset.provider")}</dt>
                <dd>{meta.provider}</dd>
              </div>
            ) : null}
            {meta.frequency ? (
              <div className="datasetpage__meta-row">
                <dt>{t("dataset.frequency")}</dt>
                <dd>{meta.frequency}</dd>
              </div>
            ) : null}
            {meta.license ? (
              <div className="datasetpage__meta-row">
                <dt>{t("dataset.license")}</dt>
                <dd>{meta.license}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {meta && meta.notes ? (
          <p className="datasetpage__notes">{meta.notes}</p>
        ) : null}

        {/* Liens de source */}
        <div className="datasetpage__sources">
          <span className="datasetpage__sources-label">{t("dataset.sources")}</span>
          <div className="datasetpage__sources-list">
            {ds.sources.map((s, i) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`datasetpage__src-pill ${i === 0 ? "is-origin" : ""}`}
              >
                {s.label} <FiArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {/* Données brutes */}
        <section className="datasetpage__raw">
          <h2 className="datasetpage__h2">{t("dataset.table_title")}</h2>
          {rawKey ? (
            status === "loading" ? (
              <p className="datasetpage__hint">{t("dataset.loading")}</p>
            ) : status === "failed" ? (
              <p className="datasetpage__hint">{t("dataset.error")}</p>
            ) : rows.length ? (
              <>
                <p className="datasetpage__hint">
                  {t("dataset.table_hint")} {rows.length.toLocaleString(nf)}.
                </p>
                <div className="datasetpage__grid">
                  <RawDataTable
                    columns={columns}
                    data={rows}
                    locale={nf}
                    fileName={`datamoana-${id}.csv`}
                    labels={{
                      search: t("dataset.search"),
                      export: t("dataset.export"),
                      prev: t("dataset.prev"),
                      next: t("dataset.next"),
                      empty: t("dataset.empty"),
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="datasetpage__hint">{t("dataset.empty")}</p>
            )
          ) : (
            <p className="datasetpage__hint">{t("dataset.no_table")}</p>
          )}
        </section>
      </div>
    </main>
  );
}