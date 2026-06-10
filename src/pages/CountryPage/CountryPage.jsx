// src/pages/CountryPage/CountryPage.jsx
// ============================================================
// 4e mode de lecture : EXPLORER PAR TERRITOIRE (récit). Route /territoire/:code.
// Carte 3D -> en-tête -> chapitres. Sources réelles du projet :
//   • pdhApi (climateSlice)   : climat, tourisme, eau, santé, biodiversité…
//   • powerApi (DF_POWER_GEN) : électricité PAR SOURCE -> histogramme empilé par source
//   • agriApi (DF_AGRI_PROD)  : CULTURES & ÉLEVAGE par produit -> multi-courbes
// Commentaire d'évolution enrichi (dernier relevé, qualification, période, %, pic).
// Composants du projet (TrendChart / AnnualBarsChart / StackedColsChart / DualAxisChart). Cyclones
// exclus. 100 % données réelles.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiArrowLeft } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import useThemeTokens from "../../hooks/UseThemeTokens";
import PICT_NAMES, { pictName, isPict } from "../../i18n/pictNames";
import PICT_GEO from "../../data/pictGeo";
import { flagUrl } from "../../i18n/flagUrl";
import { loadDataset } from "../../store/slices/climateSlice";
import { fetchAgriProduction } from "../../services/agriApi";
import { fetchPowerMix } from "../../services/powerApi";
import TrendChart from "../../components/charts/TrendChart";
import AnnualBarsChart from "../../components/charts/AnnualBarsChart";
import StackedColsChart from "../../components/charts/StackedColsChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import CountryMiniMap from "../../components/CountryMiniMap/CountryMiniMap";
import Loader from "../../components/Loader/Loader";
import "./CountryPage.scss";

const DEC = {
  emissions: 2, seaLevel: 3, sst: 2, rain: 1, tourism: 0, renewables: 1,
  water: 1, tuberculosis: 1, redList: 3, disastersAffected: 0, disastersLoss: 0,
  population: 0, landCover: 1,
};
const ALL = Object.keys(DEC);

const BAR = new Set(["disastersAffected", "disastersLoss"]);
const ANOMALY = new Set(["seaLevel", "sst", "rain"]);

const ZOOM = {
  PG: 5.4, FJ: 6.6, NC: 6.6, SB: 6.0, VU: 6.2, PF: 6.0, FM: 5.4, MH: 6.4,
  KI: 5.6, TO: 7.0, WS: 7.6, AS: 8.2, CK: 6.0, GU: 8.6, MP: 6.8, PW: 7.6,
  NR: 9.4, NU: 8.8, TK: 8.0, TV: 7.6, WF: 8.0, PN: 9.0,
};

const CHAPTERS = [
  { key: "warming", ind: ["sst"] },
  { key: "sea", ind: ["seaLevel"] },
  { key: "rain", ind: ["rain"] },
  { key: "carbon", ind: ["emissions"] },
  { key: "energy", kind: "power" },
  { key: "people", ind: ["tourism", "population"] },
  { key: "health", ind: ["water", "tuberculosis"] },
  { key: "nature", ind: ["redList", "landCover"] },
  { key: "crops", kind: "crops" },
  { key: "livestock", kind: "livestock" },
  { key: "shocks", ind: ["disastersAffected", "disastersLoss"] },
];

// Croisements à double axe (lecture combinée de deux indicateurs).
const CROSS = [
  { key: "climate", l: "sst", r: "seaLevel" },
  { key: "carbon", l: "emissions", r: "renewables" },
  { key: "health", l: "water", r: "tuberculosis" },
  { key: "human", l: "population", r: "tourism" },
];

// Couleur d'une source d'énergie (répliqué de l'Acte 5 pour cohérence visuelle).
function energyColor(label, tk) {
  const n = (label || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/charbon|coal|tourbe|peat/.test(n)) return tk.textMute;
  if (/biogaz|biogas|bio|biomass|biocombustible|biofuel/.test(n)) return tk.positive;
  if (/petrole|oil|gaz|gas/.test(n)) return tk.warm;
  if (/hydro/.test(n)) return tk.accentDeep;
  if (/solaire|solar/.test(n)) return tk.warmSoft || tk.warm;
  if (/eolien|wind/.test(n)) return tk.accent;
  if (/geotherm/.test(n)) return tk.negative;
  return tk.secondary || tk.accent;
}

function buildSeries(extra, raw, dec) {
  const vals = (raw || [])
    .filter((p) => p && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
  if (!vals.length) return null;
  const ys = vals.map((p) => p.value);
  const max = Math.max(...ys);
  const first = vals[0];
  const last = vals[vals.length - 1];
  const trend = last.value - first.value;
  const trendPct =
    Number.isFinite(first.value) && first.value !== 0
      ? (trend / Math.abs(first.value)) * 100
      : null;
  return {
    dec,
    values: vals.map((p) => ({ year: p.year, value: p.value })),
    years: vals.map((p) => p.year),
    first: first.value,
    last: last.value,
    firstYear: first.year,
    lastYear: last.year,
    trend,
    trendPct,
    max,
    maxYear: vals[ys.indexOf(max)].year,
    multi: vals.length >= 2,
    ...extra,
  };
}

export default function CountryPage() {
  const { code } = useParams();
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const dispatch = useDispatch();
  const datasets = useSelector((s) => s.climate.datasets);
  const [agriRaw, setAgriRaw] = useState({ status: "idle", res: null });
  const [powerRaw, setPowerRaw] = useState({ status: "idle", res: null });
  const [tick, setTick] = useState(0);
  const [graceOver, setGraceOver] = useState(false);

  const nf = lang === "fr" ? "fr-FR" : "en-US";
  const valid = isPict(code);

  // Séries pdhApi : légèrement différées pour laisser agri/power (requêtes
  // multiples, plus lentes) prendre les premiers créneaux de connexion.
  useEffect(() => {
    if (!valid) return undefined;
    const id = setTimeout(() => {
      ALL.forEach((k) => dispatch(loadDataset(k)));
    }, 800);
    return () => clearTimeout(id);
  }, [valid, dispatch]);

  useEffect(() => {
    if (!valid) return undefined;
    let alive = true;
    setAgriRaw((p) => (p.res ? p : { status: "loading", res: null }));
    setPowerRaw((p) => (p.res ? p : { status: "loading", res: null }));
    fetchAgriProduction({ lang })
      .then((res) => {
        if (!alive) return;
        if (res && res.commodities && res.commodities.length) setAgriRaw({ status: "ok", res });
        else setAgriRaw((p) => (p.res ? p : { status: "failed", res: null }));
      })
      .catch(() => alive && setAgriRaw((p) => (p.res ? p : { status: "failed", res: null })));
    fetchPowerMix({ lang })
      .then((res) => {
        if (!alive) return;
        if (res && res.byArea && Object.keys(res.byArea).length) setPowerRaw({ status: "ok", res });
        else setPowerRaw((p) => (p.res ? p : { status: "failed", res: null }));
      })
      .catch(() => alive && setPowerRaw((p) => (p.res ? p : { status: "failed", res: null })));
    return () => {
      alive = false;
    };
  }, [valid, lang]);

  const fmt = (v, dec) =>
    v.toLocaleString(nf, { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const data = useMemo(() => {
    if (!valid) return {};
    const out = {};
    ALL.forEach((id) => {
      const ds = datasets[id];
      const raw = (ds && ds.data && ds.data.byArea && ds.data.byArea[code]) || [];
      const s = buildSeries({ id }, raw, DEC[id]);
      if (s) out[id] = s;
    });
    return out;
  }, [datasets, code, valid]);

  // Cultures & élevage dominants du territoire (top 5 par produit).
  // byArea est porté par data.byCommodity[code] (cf. Acte 6), pas par l'élément
  // de la liste commodities.
  const agri = useMemo(() => {
    const res = agriRaw.res;
    const list = (res && res.commodities) || [];
    const bc = (res && res.byCommodity) || {};
    const mk = (kind) =>
      list
        .filter((c) => c.kind === kind)
        .map((c) => {
          const dec = /(\/ha|kg)/i.test(c.unit || "") ? 1 : 0;
          const raw = bc[c.code] && bc[c.code].byArea && bc[c.code].byArea[code];
          return buildSeries({ id: c.code, label: c.label, unit: c.unit || "" }, raw, dec);
        })
        .filter(Boolean)
        .sort((a, b) => b.last - a.last)
        .slice(0, 5);
    return { crops: mk("crop"), livestock: mk("livestock") };
  }, [agriRaw, code]);

  const anyLoading =
    agriRaw.status === "loading" ||
    powerRaw.status === "loading" ||
    ALL.some((id) => {
      const ds = datasets[id];
      return !ds || ds.status === "idle" || ds.status === "loading";
    });

  // Sécurité : on révèle la page au bout de ~9,5 s même si une source traîne
  // (timeout SDMX à 8 s) — jamais de loader infini.
  useEffect(() => {
    if (!valid) return undefined;
    const id = setTimeout(() => setGraceOver(true), 9500);
    return () => clearTimeout(id);
  }, [valid]);

  const loading = anyLoading && !graceOver;

  // Fait défiler le label du loader pendant le chargement.
  useEffect(() => {
    if (!loading) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 650);
    return () => clearInterval(id);
  }, [loading]);

  // Indicateurs encore en cours de chargement (pour le label défilant).
  const pending = [
    ...ALL.filter((id) => {
      const ds = datasets[id];
      return !ds || ds.status === "idle" || ds.status === "loading";
    }).map((id) => t(`country.ind.${id}`)),
    ...(powerRaw.status === "loading" ? [t("country.ind.electricity")] : []),
    ...(agriRaw.status === "loading"
      ? [t("country.story.crops.kicker"), t("country.story.livestock.kicker")]
      : []),
  ];
  const loadingLabel = pending.length
    ? `${t("country.loading_one")} ${pending[tick % pending.length]}\u2026`
    : t("country.loading");

  const resolve = (d) =>
    d.label != null
      ? d
      : { ...d, label: t(`country.ind.${d.id}`), unit: t(`country.unit.${d.id}`) };

  const qualKey = (c) => {
    if (ANOMALY.has(c.id)) return c.trend < 0 ? "fall" : "rise";
    const p = c.trendPct == null ? 0 : Math.abs(c.trendPct);
    if (p < 2) return "stable";
    const dir = c.trend < 0 ? "fall" : "rise";
    if (p >= 50) return `${dir}_strong`;
    if (p < 10) return `${dir}_slight`;
    return dir;
  };

  const narrative = (c) => {
    const u = c.unit ? ` ${c.unit}` : "";
    const period = `${c.firstYear}\u2013${c.lastYear}`;
    const a = `${t("country.narr.latest")} ${fmt(c.last, c.dec)}${u} (${c.lastYear}).`;
    const qk = qualKey(c);
    let b;
    if (qk === "stable") {
      b = `${t("country.narr.stable")} ${t("country.narr.over")} ${period}.`;
    } else {
      const pct =
        !ANOMALY.has(c.id) && c.trendPct != null
          ? ` (${c.trendPct > 0 ? "+" : "\u2212"}${Math.round(Math.abs(c.trendPct))}\u00a0%)`
          : "";
      b = `${t(`country.narr.${qk}`)} ${t("country.narr.over")} ${period} : ${t("country.narr.from")} ${fmt(c.first, c.dec)}${u} ${t("country.narr.to")} ${fmt(c.last, c.dec)}${u}${pct}.`;
    }
    const peak =
      c.maxYear !== c.lastYear
        ? ` ${t("country.narr.peak")} ${fmt(c.max, c.dec)}${u} (${c.maxYear}).`
        : "";
    return `${a} ${b}${peak}`;
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

  const chapters = CHAPTERS.map((ch) => {
    // Électricité par source
    if (ch.kind === "power") {
      const res = powerRaw.res;
      const a = res && res.byArea && res.byArea[code];
      if (!a) return null;
      const years = res.years || [];
      let sources = (res.detailSources || [])
        .map((sx) => ({ name: sx.label, color: energyColor(sx.label, tk), map: a.detail[sx.label] || {} }))
        .filter((s) => Object.keys(s.map).length);
      if (!sources.length) {
        sources = [
          Object.keys(a.fossil || {}).length
            ? { name: t("country.energy.fossil"), color: tk.warm, map: a.fossil }
            : null,
          Object.keys(a.renew || {}).length
            ? { name: t("country.energy.renew"), color: tk.positive, map: a.renew }
            : null,
        ].filter(Boolean);
      }
      if (!sources.length) return null;
      const totalVals = years.map((y) => ({
        year: y,
        value: sources.reduce((s, src) => s + (src.map[y] || 0), 0),
      }));
      const feature = buildSeries({ id: "electricity", label: t("country.ind.electricity"), unit: "GWh" }, totalVals, 0);
      if (!feature) return null;
      const viz = (
        <StackedColsChart
          series={sources.map((s) => ({ name: s.name, color: s.color, data: years.map((y) => s.map[y] || 0) }))}
          years={years}
          unit="GWh"
        />
      );
      const chips = data.renewables ? [resolve(data.renewables)] : [];
      return { key: ch.key, feature, viz, chips };
    }

    // Cultures / élevage (multi-courbes par produit)
    if (ch.kind === "crops" || ch.kind === "livestock") {
      const arr = ch.kind === "crops" ? agri.crops : agri.livestock;
      if (!arr || !arr.length) return null;
      const feature = arr[0];
      const years = [...new Set(arr.flatMap((s) => s.years))].sort((x, y) => x - y);
      const viz = (
        <TrendChart series={arr.map((s) => ({ name: s.label, values: s.values }))} years={years} unit={feature.unit} />
      );
      return { key: ch.key, feature, viz, chips: [] };
    }

    // Indicateurs pdhApi
    const present = ch.ind.map((id) => data[id]).filter(Boolean);
    if (!present.length) return null;
    const base = present.find((d) => d.multi) || present[0];
    const feature = resolve(base);
    const chips = present.filter((d) => d !== base).map(resolve);
    const viz = feature.multi
      ? BAR.has(feature.id)
        ? (
          <AnnualBarsChart
            data={feature.values}
            unit={feature.unit}
            color={feature.trend < 0 ? tk.warm : tk.accent}
            format={(v) => fmt(Number(v), feature.dec)}
          />
        )
        : (
          <TrendChart series={[{ name: feature.label, values: feature.values }]} years={feature.years} unit={feature.unit} />
        )
      : null;
    return { key: ch.key, feature, viz, chips };
  }).filter(Boolean);

  const crosses = CROSS.map((x) => {
    const L = data[x.l];
    const R = data[x.r];
    if (!L || !R || !L.multi || !R.multi) return null;
    return { key: x.key, L: resolve(L), R: resolve(R) };
  }).filter(Boolean);

  // Loader plein écran (pluie binaire) tant que TOUS les indicateurs ne sont
  // pas chargés : la page n'est servie qu'une fois complète.
  if (loading) {
    return <Loader fullscreen label={loadingLabel} />;
  }

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
          <CountryMiniMap coords={PICT_GEO[code]} zoom={ZOOM[code] || 7} noTokenMsg={t("country.no_token")} />
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
              return (
                <section className="country__chapter" key={ch.key}>
                  <div className="country__ch-head">
                    <p className="eyebrow country__ch-kicker">
                      <span className="country__ch-num">{String(i + 1).padStart(2, "0")}</span>
                      {t(`country.story.${ch.key}.kicker`)}
                    </p>
                    <h2 className="country__ch-title">{t(`country.story.${ch.key}.title`)}</h2>

                    <div className="country__ch-row">
                      <div className="country__ch-metric">
                        <span className="country__val">{fmt(f.last, f.dec)}</span>
                        {f.unit ? <span className="country__unit">{f.unit}</span> : null}
                        <span className="country__ch-of">{f.label}</span>
                      </div>
                      {f.multi ? <p className="country__ch-narr">{narrative(f)}</p> : null}
                    </div>

                    {ch.chips.length ? (
                      <ul className="country__chips">
                        {ch.chips.map((d) => (
                          <li className="country__chip" key={d.id}>
                            <span className="country__chip-k">{d.label}</span>
                            <span className="country__chip-v">
                              {fmt(d.last, d.dec)} {d.unit} · {d.lastYear}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="country__ch-viz">
                    {ch.viz || (
                      <p className="country__single">
                        {fmt(f.last, f.dec)} {f.unit} · {f.lastYear}
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

        {crosses.length ? (
          <div className="country__story country__crosses">
            <p className="eyebrow country__section">{t("country.cross_title")}</p>
            {crosses.map((x) => (
              <section className="country__chapter" key={`x-${x.key}`}>
                <div className="country__ch-head">
                  <h2 className="country__ch-title">{t(`country.cross.${x.key}.title`)}</h2>
                  <p className="country__ch-narr">{t(`country.cross.${x.key}.note`)}</p>
                </div>
                <div className="country__ch-viz">
                  <DualAxisChart
                    seaSeries={[{ values: x.L.values }]}
                    seaYears={x.L.years}
                    sstSeries={[{ values: x.R.values }]}
                    sstYears={x.R.years}
                    seaName={x.L.label}
                    sstName={x.R.label}
                    seaUnit={x.L.unit}
                    sstUnit={x.R.unit}
                  />
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {chapters.length && anyLoading ? (
          <p className="country__hint country__hint--soft">{t("country.loading")}</p>
        ) : null}
      </div>
    </main>
  );
}