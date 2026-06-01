// src/pages/Act11Synthese/Act11Synthese.jsx
// ============================================================
// Acte 11 — « La Synthèse ». Croise les jeux utilisés en UNE histoire :
//   responsabilité (GES/hab) confrontée à un INDICE DE VULNÉRABILITÉ composite
//   (niveau de la mer + anomalie SST + |anomalie pluies| + eau potable + tuberculose
//    + recul du vivant), normalisé 0–100, polarité orientée « 100 = le plus exposé ».
//
// • Nuage responsabilité × vulnérabilité (coloré par sous-région, quadrants médians).
// • Classement composite (tous) OU profil détaillé d'un territoire (sélection).
// • Guide de lecture avec la méthode ET ses limites (poids égaux, min-max, données
//   manquantes, ce n'est pas un indice officiel).
// 100 % données API. Aucune valeur inventée (agrégats = normalisations/médianes réelles).
// Zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSynthese } from "../../services/syntheseApi";
import { worldAvgFor } from "../../data/worldAvg";
import ScatterPlot from "../../components/ScatterPlot/ScatterPlot";
import RankBars from "../../components/RankBars/RankBars";
import ExpandableCard from "../../components/ExpandableCard/ExpandableCard";
import ReadingGuide from "../../components/ReadingGuide/ReadingGuide";
import "./Act11Synthese.scss";

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

// indicateurs de vulnérabilité et leur libellé i18n
const VULN = ["seaLevel", "sst", "rain", "water", "tb", "rli"];

function valueAt(values, year) {
  if (!values || !values.length) return null;
  let out = null;
  for (const p of values) {
    if (p.year === year) return p.value;
    if (p.year <= year) out = p.value;
  }
  return out;
}
function latestOf(ind) {
  if (!ind || ind.status !== "live") return {};
  const out = {};
  const last = ind.lastYear;
  (ind.areas || []).forEach((a) => {
    const v = valueAt(ind.byArea[a], last);
    if (Number.isFinite(v)) out[a] = v;
  });
  return out;
}
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
// transforme une valeur brute en « contribution de vulnérabilité » selon la polarité
function vulnContribution(value, dir) {
  if (!Number.isFinite(value)) return NaN;
  if (dir === "down") return -value; // bas = pire
  if (dir === "abs") return Math.abs(value); // écart = pire
  return value; // up : haut = pire
}
// min-max → 0..100 sur les territoires disponibles
function normalizeMap(rawByArea) {
  const vals = Object.values(rawByArea).filter((v) => Number.isFinite(v));
  if (!vals.length) return {};
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const out = {};
  Object.entries(rawByArea).forEach(([a, v]) => {
    if (!Number.isFinite(v)) return;
    out[a] = hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
  });
  return out;
}

export default function Act11Synthese() {
  const { t, lang } = useLang();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSynthese({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      // eslint-disable-next-line no-console
      console.info("[Act11] reçu:", res.source);
      setState({ status: res.source === "live" ? "ready" : "empty", data: res });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;

  // valeurs les plus récentes par indicateur
  const latest = useMemo(() => {
    if (!data) return {};
    const out = {};
    ["emissions", ...VULN].forEach((k) => {
      out[k] = latestOf(data[k]);
    });
    return out;
  }, [data]);

  // normalisation des contributions de vulnérabilité (0..100, 100 = pire)
  const normByInd = useMemo(() => {
    if (!data) return {};
    const out = {};
    VULN.forEach((k) => {
      const ind = data[k];
      if (!ind || ind.status !== "live") {
        out[k] = {};
        return;
      }
      const raw = {};
      Object.entries(latest[k] || {}).forEach(([a, v]) => {
        const c = vulnContribution(v, ind.dir);
        if (Number.isFinite(c)) raw[a] = c;
      });
      out[k] = normalizeMap(raw);
    });
    return out;
  }, [data, latest]);

  // indice composite par territoire = moyenne des indicateurs disponibles
  const composite = useMemo(() => {
    const acc = {};
    VULN.forEach((k) => {
      Object.entries(normByInd[k] || {}).forEach(([a, v]) => {
        if (!isPict(a)) return;
        (acc[a] = acc[a] || []).push(v);
      });
    });
    const out = {};
    Object.entries(acc).forEach(([a, arr]) => {
      if (arr.length) out[a] = arr.reduce((s, v) => s + v, 0) / arr.length;
    });
    return out;
  }, [normByInd]);

  const activeVuln = useMemo(() => VULN.filter((k) => data && data[k] && data[k].status === "live"), [data]);

  const onRegion = (k) => {
    setRegion(k);
    setCountry("all");
  };
  const inRegion = (a) => region === "all" || REGION_OF[a] === region;

  const countryOptions = useMemo(() => {
    return Object.keys(composite)
      .filter((a) => isPict(a))
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [composite, lang]);

  // points du nuage : x = GES/hab, y = indice composite
  const scatterPoints = useMemo(() => {
    const emi = latest.emissions || {};
    return Object.keys(composite)
      .filter((a) => isPict(a) && Number.isFinite(emi[a]))
      .filter((a) => (country !== "all" ? true : inRegion(a)))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        x: emi[a],
        y: composite[a],
        region: REGION_OF[a] || "other",
      }));
  }, [composite, latest, lang, region, country]);

  const medians = useMemo(
    () => ({ x: median(scatterPoints.map((p) => p.x)), y: median(scatterPoints.map((p) => p.y)) }),
    [scatterPoints],
  );

  // repère mondial mobile (moyenne mondiale CO₂/hab à l'année la plus récente)
  const worldRef = useMemo(() => {
    const yr = data && data.emissions ? data.emissions.lastYear : null;
    return worldAvgFor(yr) ?? worldAvgFor(2023);
  }, [data]);

  // chiffres-chocs (agrégats réels)
  const stats = useMemo(() => {
    if (scatterPoints.length < 3 || !Number.isFinite(worldRef)) return null;
    const pacMed = median(scatterPoints.map((p) => p.x));
    const ratio = pacMed > 0 ? worldRef / pacMed : null;
    const yMed = medians.y;
    const below = scatterPoints.filter((p) => p.x < worldRef && Number.isFinite(yMed) && p.y > yMed).length;
    const most = scatterPoints.reduce((m, p) => (!m || p.y > m.y ? p : m), null);
    return { pacMed, ratio, below, total: scatterPoints.length, most };
  }, [scatterPoints, worldRef, medians]);

  // classement composite (mode « tous ») filtré région
  const rankComposite = useMemo(() => {
    return Object.keys(composite)
      .filter((a) => isPict(a) && inRegion(a))
      .map((a) => ({ area: a, name: pictName(a, lang), value: Math.round(composite[a]) }))
      .sort((x, y) => y.value - x.value);
  }, [composite, lang, region]);

  // profil d'un territoire (mode sélection) : ses indicateurs normalisés
  const profile = useMemo(() => {
    if (country === "all") return [];
    return activeVuln
      .map((k) => ({ area: k, name: t(`act11.ind_${k}`), value: Math.round((normByInd[k] || {})[country] ?? NaN) }))
      .filter((r) => Number.isFinite(r.value))
      .sort((x, y) => y.value - x.value);
  }, [country, activeVuln, normByInd, t]);

  const compMed = useMemo(() => {
    const m = median(rankComposite.map((r) => r.value));
    return m == null ? null : Math.round(m);
  }, [rankComposite]);

  const xc = { expandLabel: t("act2.expand"), closeLabel: t("act2.close") };
  const regionLabels = {
    melanesia: t("act1.filter.melanesia"),
    polynesia: t("act1.filter.polynesia"),
    micronesia: t("act1.filter.micronesia"),
    other: t("act11.region_other"),
  };

  const guide = {
    title: t("act11.guide_title"),
    intro: t("act11.guide_intro"),
    steps: [
      { k: t("act11.guide_s1_k"), v: t("act11.guide_s1_v") },
      { k: t("act11.guide_s2_k"), v: t("act11.guide_s2_v") },
      { k: t("act11.guide_s3_k"), v: t("act11.guide_s3_v") },
    ],
    takeaway: t("act11.guide_takeaway"),
  };

  const single = country !== "all";

  return (
    <main className="act11">
      <div className="container">
        <header className="act11__head">
          <p className="eyebrow">{t("act11.tag")}</p>
          <h1 className="act11__title">{t("act11.title")}</h1>
          <p className="act11__lead">{t("act11.lead")}</p>
        </header>

        {state.status === "loading" && <p className="act11__state">{t("scene.loading")}</p>}
        {state.status === "empty" && <p className="act11__state act11__state--err">{t("act11.unavailable")}</p>}

        {state.status === "ready" && (
          <>
            <ReadingGuide {...guide} />

            <div className="act11__controls">
              <div className="act11__filter" role="group" aria-label={t("act1.filter.title")}>
                <span className="act11__filter-lbl">{t("act1.filter.title")}</span>
                {REGION_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`act11__pill ${country === "all" && region === k ? "is-active" : ""}`}
                    onClick={() => onRegion(k)}
                    aria-pressed={country === "all" && region === k}
                  >
                    {t(`act1.filter.${k}`)}
                  </button>
                ))}
              </div>
              <label className="act11__select-wrap">
                <span className="act11__select-lbl">{t("act7.country_label")}</span>
                <select className="act11__select" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="all">{t("act7.country_all")}</option>
                  {countryOptions.map((c) => (
                    <option key={c.area} value={c.area}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {stats && (
              <div className="act11__stats">
                <div className="act11__stat">
                  <span className="act11__stat-num">
                    {stats.pacMed.toFixed(1)}
                    <span className="act11__stat-u"> t/hab</span>
                  </span>
                  <span className="act11__stat-lbl">{t("act11.stat_emi_label")}</span>
                  <span className="act11__stat-sub">
                    {stats.ratio ? `≈ ${stats.ratio.toFixed(1)}× ${t("act11.stat_emi_sub")}` : ""}
                  </span>
                </div>
                <div className="act11__stat">
                  <span className="act11__stat-num">
                    {stats.below}
                    <span className="act11__stat-u"> / {stats.total}</span>
                  </span>
                  <span className="act11__stat-lbl">{t("act11.stat_inj_label")}</span>
                  <span className="act11__stat-sub">{t("act11.stat_inj_sub")}</span>
                </div>
                <div className="act11__stat">
                  <span className="act11__stat-num act11__stat-num--name">{stats.most ? stats.most.name : "—"}</span>
                  <span className="act11__stat-lbl">{t("act11.stat_vuln_label")}</span>
                  <span className="act11__stat-sub">
                    {stats.most ? `${t("act11.stat_vuln_sub")} · ${Math.round(stats.most.y)}/100` : ""}
                  </span>
                </div>
              </div>
            )}

            <ExpandableCard title={t("act11.scatter_title")} sub={t("act11.scatter_sub")} {...xc}>
              <ScatterPlot
                points={scatterPoints}
                xLabel={t("act11.scatter_x")}
                yLabel={t("act11.scatter_y")}
                xUnit={t("act11.scatter_x_unit")}
                xRef={{ value: worldRef, label: t("act11.world_ref_label") }}
                yDivider={medians.y}
                quadrants={{ tl: t("act11.q_tl"), tr: t("act11.q_tr"), bl: t("act11.q_bl"), br: t("act11.q_br") }}
                highlight={single ? country : null}
                regionLabels={regionLabels}
              />
            </ExpandableCard>

            {!single && (
              <ExpandableCard title={t("act11.rank_title")} sub={t("act11.rank_sub")} {...xc}>
                <RankBars data={rankComposite} unit={t("act11.index_unit")} worldAvg={compMed} refLabel={t("act6.median_ref")} />
              </ExpandableCard>
            )}

            {single && profile.length > 0 && (
              <ExpandableCard title={`${t("act11.profile_title")} — ${pictName(country, lang)}`} sub={t("act11.profile_sub")} {...xc}>
                <RankBars data={profile} unit={t("act11.index_unit")} worldAvg={50} refLabel={t("act11.profile_ref")} />
              </ExpandableCard>
            )}

            <p className="act11__credit">
              {t("act11.credit")}
              {activeVuln.length < VULN.length ? ` ${t("act11.credit_partial")}` : ""}
            </p>
          </>
        )}

        <Link to="/" className="act11__back">
          ← {t("act1.back")}
        </Link>
      </div>
    </main>
  );
}