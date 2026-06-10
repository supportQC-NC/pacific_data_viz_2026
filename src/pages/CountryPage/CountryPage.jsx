// src/pages/CountryPage/CountryPage.jsx
// ============================================================
// 4e mode de lecture : EXPLORER PAR TERRITOIRE (récit). Route /territoire/:code.
// Ordre : carte de localisation 3D -> en-tête (drapeau + nom) -> RÉCIT en
// chapitres thématiques. Chaque chapitre raconte une facette du territoire avec
// UN grand graphique (axes, tooltip) + un texte d'évolution généré à partir des
// données réelles (sens, ampleur, période, %, pic), et des indicateurs
// secondaires en pastilles. Cyclones EXCLUS (jeu propre à la NC).
//
// Séries via le service générique (climateSlice/pdhApi) : byArea[code].
// ============================================================

import React, { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiArrowLeft } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import useThemeTokens from "../../hooks/UseThemeTokens";
import PICT_NAMES, { pictName, isPict } from "../../i18n/pictNames";
import PICT_GEO from "../../data/pictGeo";
import { flagUrl } from "../../i18n/flagUrl";
import { loadDataset } from "../../store/slices/climateSlice";
import ApexChart from "../../components/ApexChart/ApexChart";
import { baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip } from "../../components/charts/apexBase";
import CountryMiniMap from "../../components/CountryMiniMap/CountryMiniMap";
import "./CountryPage.scss";

// Indicateurs (clé pdhApi + décimales).
const DEC = {
  emissions: 2, seaLevel: 3, sst: 2, rain: 1, tourism: 0, electricity: 0,
  renewables: 1, water: 1, tuberculosis: 1, redList: 3, disastersAffected: 0,
  disastersLoss: 0, population: 0, cropYield: 1, livestockYield: 1, landCover: 1,
};
const ALL = Object.keys(DEC);

// Type de graphe par indicateur (défaut : aire).
const CHART_TYPE = {
  disastersAffected: "bar", disastersLoss: "bar",
  renewables: "line", water: "line", tuberculosis: "line", redList: "line",
};

// Indicateurs en anomalie : pas de % (la série oscille autour de 0).
const ANOMALY = new Set(["seaLevel", "sst", "rain"]);

// Zoom de la carte selon la taille du territoire.
const ZOOM = {
  PG: 5.4, FJ: 6.6, NC: 6.6, SB: 6.0, VU: 6.2, PF: 6.0, FM: 5.4, MH: 6.4,
  KI: 5.6, TO: 7.0, WS: 7.6, AS: 8.2, CK: 6.0, GU: 8.6, MP: 6.8, PW: 7.6,
  NR: 9.4, NU: 8.8, TK: 8.0, TV: 7.6, WF: 8.0, PN: 9.0,
};

// Chapitres du récit : le 1er indicateur disponible devient la « une », les
// autres deviennent des pastilles secondaires.
const CHAPTERS = [
  { key: "warming", ind: ["sst"] },
  { key: "sea", ind: ["seaLevel"] },
  { key: "rain", ind: ["rain"] },
  { key: "carbon", ind: ["emissions"] },
  { key: "energy", ind: ["electricity", "renewables"] },
  { key: "people", ind: ["tourism", "population"] },
  { key: "health", ind: ["water", "tuberculosis"] },
  { key: "nature", ind: ["redList", "landCover"] },
  { key: "food", ind: ["cropYield", "livestockYield"] },
  { key: "shocks", ind: ["disastersAffected", "disastersLoss"] },
];

function compact(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

export default function CountryPage() {
  const { code } = useParams();
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const dispatch = useDispatch();
  const datasets = useSelector((s) => s.climate.datasets);

  const nf = lang === "fr" ? "fr-FR" : "en-US";
  const valid = isPict(code);

  useEffect(() => {
    if (!valid) return;
    ALL.forEach((id) => dispatch(loadDataset(id)));
  }, [valid, dispatch]);

  const fmt = (v, dec) =>
    v.toLocaleString(nf, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtPct = (p) => `${Math.round(p) > 0 ? "+" : ""}${Math.round(p)}\u00a0%`;

  // Données calculées par indicateur disponible.
  const data = useMemo(() => {
    if (!valid) return {};
    const out = {};
    ALL.forEach((id) => {
      const ds = datasets[id];
      const raw = (ds && ds.data && ds.data.byArea && ds.data.byArea[code]) || [];
      const vals = raw
        .filter((p) => p && Number.isFinite(p.value))
        .sort((a, b) => a.year - b.year);
      if (!vals.length) return;
      const ys = vals.map((p) => p.value);
      const max = Math.max(...ys);
      const min = Math.min(...ys);
      const first = vals[0];
      const last = vals[vals.length - 1];
      const trend = last.value - first.value;
      const trendPct =
        Number.isFinite(first.value) && first.value !== 0
          ? (trend / Math.abs(first.value)) * 100
          : null;
      out[id] = {
        id,
        dec: DEC[id],
        points: vals.map((p) => ({ x: p.year, y: p.value })),
        first: first.value,
        last: last.value,
        firstYear: first.year,
        lastYear: last.year,
        trend,
        trendPct,
        max,
        min,
        maxYear: vals[ys.indexOf(max)].year,
        multi: vals.length >= 2,
      };
    });
    return out;
  }, [datasets, code, valid]);

  const anyLoading = ALL.some((id) => {
    const ds = datasets[id];
    return !ds || ds.status === "idle" || ds.status === "loading";
  });

  const buildOptions = (c, unit) => {
    const type = CHART_TYPE[c.id] || "area";
    const color = c.trend < 0 ? tk.warm : tk.accent;
    return {
      chart: baseChart(tk, { type, height: 340 }),
      colors: [color],
      stroke: { curve: "smooth", width: type === "bar" ? 0 : 2.75, lineCap: "round" },
      fill:
        type === "area"
          ? {
              type: "gradient",
              gradient: { shadeIntensity: 0.5, opacityFrom: 0.45, opacityTo: 0.04, stops: [0, 100] },
            }
          : { opacity: type === "bar" ? 0.85 : 1 },
      plotOptions: type === "bar" ? { bar: { columnWidth: "58%", borderRadius: 2 } } : {},
      dataLabels: { enabled: false },
      grid: baseGrid(tk, { padding: { left: 8, right: 14, top: 10, bottom: 0 } }),
      markers: { size: 0, strokeWidth: 0, hover: { size: 5 } },
      series: [{ name: t(`country.ind.${c.id}`), data: c.points }],
      xaxis: baseXaxis(tk, {
        type: "numeric",
        tickAmount: Math.min(7, Math.max(2, c.points.length - 1)),
        decimalsInFloat: 0,
        labels: { rotate: 0, formatter: (v) => String(Math.round(v)) },
      }),
      yaxis: baseYaxis(tk, { tickAmount: 5, labels: { formatter: (v) => compact(v) } }),
      tooltip: baseTooltip({
        marker: { show: false },
        x: { formatter: (v) => String(Math.round(v)) },
        y: {
          formatter: (v) => `${fmt(v, c.dec)}${unit ? ` ${unit}` : ""}`,
          title: { formatter: () => "" },
        },
      }),
    };
  };

  // Récit factuel pour l'indicateur à la une.
  const narrative = (c, unit) => {
    const u = unit ? ` ${unit}` : "";
    const period = `${c.firstYear}\u2013${c.lastYear}`;
    const pct =
      !ANOMALY.has(c.id) && c.trendPct != null
        ? ` (${c.trendPct > 0 ? "+" : "\u2212"}${Math.round(Math.abs(c.trendPct))}\u00a0%)`
        : "";
    const evolution = `${t("country.narr.from")} ${fmt(c.first, c.dec)}${u} ${t("country.narr.to")} ${fmt(c.last, c.dec)}${u}, ${period}${pct}.`;
    const peak =
      c.maxYear !== c.lastYear
        ? ` ${t("country.narr.peak")} ${fmt(c.max, c.dec)}${u} (${c.maxYear}).`
        : "";
    return evolution + peak;
  };

  if (!valid) {
    return (
      <main className="country">
        <div className="country__inner container">
          <Link to="/" className="country__back">
            <FiArrowLeft aria-hidden="true" /> {t("country.back")}
          </Link>
          <h1 className="country__title">{t("country.unknown")}</h1>
        </div>
      </main>
    );
  }

  // Chapitres réellement affichables (au moins un indicateur avec données).
  const chapters = CHAPTERS.map((ch) => {
    const present = ch.ind.map((id) => data[id]).filter(Boolean);
    if (!present.length) return null;
    const feature = present.find((d) => d.multi) || present[0];
    const chips = present.filter((d) => d !== feature);
    return { key: ch.key, feature, chips };
  }).filter(Boolean);

  return (
    <main className="country">
      <div className="country__glow" aria-hidden="true" />
      <div className="country__inner container">
        <Link to="/" className="country__back">
          <FiArrowLeft aria-hidden="true" /> {t("country.back")}
        </Link>

        {/* 1. Localisation */}
        <section className="country__map-sec">
          <p className="eyebrow country__map-eyebrow">{t("country.map_title")}</p>
          <CountryMiniMap
            coords={PICT_GEO[code]}
            zoom={ZOOM[code] || 7}
            noTokenMsg={t("country.no_token")}
          />
        </section>

        {/* 2. En-tête */}
        <header className="country__head">
          <span className="country__flag">
            <img
              src={flagUrl(code, { format: "svg" })}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>
          <div className="country__head-text">
            <p className="eyebrow country__eyebrow">{t("country.eyebrow")}</p>
            <h1 className="country__title">{pictName(code, lang)}</h1>
            <p className="country__lead">{t("country.lead")}</p>
          </div>
        </header>

        {/* 3. Récit */}
        {chapters.length ? (
          <div className="country__story">
            {chapters.map((ch, i) => {
              const f = ch.feature;
              const unit = t(`country.unit.${f.id}`);
              const showTrend =
                f.multi && f.trendPct != null && !ANOMALY.has(f.id) && Math.abs(f.trendPct) >= 1;
              return (
                <section className="country__chapter" key={ch.key}>
                  <div className="country__ch-text">
                    <p className="eyebrow country__ch-kicker">
                      <span className="country__ch-num">{String(i + 1).padStart(2, "0")}</span>
                      {t(`country.story.${ch.key}.kicker`)}
                    </p>
                    <h2 className="country__ch-title">{t(`country.story.${ch.key}.title`)}</h2>
                    <div className="country__ch-metric">
                      <span className="country__val">{fmt(f.last, f.dec)}</span>
                      {unit ? <span className="country__unit">{unit}</span> : null}
                      {showTrend ? (
                        <span className={`country__trend ${f.trend < 0 ? "is-down" : "is-up"}`}>
                          {f.trend < 0 ? "\u25be" : "\u25b4"} {fmtPct(f.trendPct)}
                        </span>
                      ) : null}
                    </div>
                    <p className="country__ch-lead">{t(`country.ind.${f.id}`)}</p>
                    {f.multi ? (
                      <p className="country__ch-narr">{narrative(f, unit)}</p>
                    ) : (
                      <p className="country__ch-narr">
                        {fmt(f.last, f.dec)} {unit} · {f.lastYear}
                      </p>
                    )}
                    {ch.chips.length ? (
                      <ul className="country__chips">
                        {ch.chips.map((d) => (
                          <li className="country__chip" key={d.id}>
                            <span className="country__chip-k">{t(`country.ind.${d.id}`)}</span>
                            <span className="country__chip-v">
                              {fmt(d.last, d.dec)} {t(`country.unit.${d.id}`)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className={`country__ch-chart ${f.trend < 0 ? "is-down" : "is-up"}`}>
                    {f.multi ? (
                      <ApexChart options={buildOptions(f, unit)} />
                    ) : (
                      <p className="country__single">
                        {fmt(f.last, f.dec)} {unit} · {f.lastYear}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : anyLoading ? (
          <p className="country__hint">{t("country.loading")}</p>
        ) : (
          <p className="country__hint">{t("country.no_data")}</p>
        )}

        {chapters.length && anyLoading ? (
          <p className="country__hint country__hint--soft">{t("country.loading")}</p>
        ) : null}
      </div>
    </main>
  );
}