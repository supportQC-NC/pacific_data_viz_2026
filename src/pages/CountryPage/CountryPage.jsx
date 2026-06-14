// src/pages/CountryPage/CountryPage.jsx
// ============================================================
// Page TERRITOIRE — refonte immersive.
//   1. Hero : carte 3D plein cadre (satellite + relief, boutons de zoom) avec
//      drapeau + nom en overlay.
//   2. « En bref » : rangée de chiffres-clés de synthèse (dont le bilan du
//      trait de côte, stats Digital Earth Pacific agrégées par territoire).
//   3. Chapitres en CARROUSEL (même langage que les actes) : un chapitre à la
//      fois, navigation par onglets soulignés.
//   4. Croisements : lectures combinées à double axe, en cartes.
// Sources réelles du projet (PDH/SPC, agriApi, powerApi, coastlineByTerritory).
// 100 % i18n, couleurs via tokens.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FiArrowLeft } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import useThemeTokens from "../../hooks/UseThemeTokens";
import PICT_NAMES, { pictName, isPict } from "../../i18n/pictNames";
import PICT_GEO from "../../data/pictGeo";
import COASTLINE_BY_TERRITORY from "../../data/coastlineByTerritory";
import { flagUrl } from "../../i18n/flagUrl";
import { loadDataset } from "../../store/slices/climateSlice";
import { fetchAgriProduction } from "../../services/agriApi";
import { fetchPowerMix } from "../../services/powerApi";
import TrendChart from "../../components/charts/TrendChart";
import AnnualBarsChart from "../../components/charts/AnnualBarsChart";
import StackedColsChart from "../../components/charts/StackedColsChart";
import DualAxisChart from "../../components/charts/DualAxisChart";
import ChartCarousel from "../../components/ChartCarousel/ChartCarousel";
import CountryMiniMap from "../../components/CountryMiniMap/CountryMiniMap";
import Loader from "../../components/Loader/Loader";
import "./CountryPage.scss";

const DEC = {
  emissions: 2,
  seaLevel: 3,
  sst: 2,
  rain: 1,
  tourism: 0,
  renewables: 1,
  water: 1,
  tuberculosis: 1,
  redList: 3,
  disastersAffected: 0,
  disastersLoss: 0,
  population: 0,
  landCover: 1,
};
const ALL = Object.keys(DEC);

const BAR = new Set(["disastersAffected", "disastersLoss"]);
const ANOMALY = new Set(["seaLevel", "sst", "rain"]);

const ZOOM = {
  PG: 5.4,
  FJ: 6.6,
  NC: 6.6,
  SB: 6.0,
  VU: 6.2,
  PF: 6.0,
  FM: 5.4,
  MH: 6.4,
  KI: 5.6,
  TO: 7.0,
  WS: 7.6,
  AS: 8.2,
  CK: 6.0,
  GU: 8.6,
  MP: 6.8,
  PW: 7.6,
  NR: 9.4,
  NU: 8.8,
  TK: 8.0,
  TV: 7.6,
  WF: 8.0,
  PN: 9.0,
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

// Synthèse « En bref » : ordre de priorité des chiffres-clés.
const KEY_ORDER = [
  "sst",
  "seaLevel",
  "emissions",
  "renewables",
  "population",
  "tourism",
  "rain",
];

// Couleur d'une source d'énergie (répliqué de l'Acte 5 pour cohérence visuelle).
function energyColor(label, tk) {
  const n = (label || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/charbon|coal|tourbe|peat/.test(n)) return tk.textMute;
  if (/biogaz|biogas|bio|biomass|biocombustible|biofuel/.test(n))
    return tk.positive;
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
  const [chIdx, setChIdx] = useState(0);

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
        if (res && res.commodities && res.commodities.length)
          setAgriRaw({ status: "ok", res });
        else setAgriRaw((p) => (p.res ? p : { status: "failed", res: null }));
      })
      .catch(
        () =>
          alive &&
          setAgriRaw((p) => (p.res ? p : { status: "failed", res: null })),
      );
    fetchPowerMix({ lang })
      .then((res) => {
        if (!alive) return;
        if (res && res.byArea && Object.keys(res.byArea).length)
          setPowerRaw({ status: "ok", res });
        else setPowerRaw((p) => (p.res ? p : { status: "failed", res: null }));
      })
      .catch(
        () =>
          alive &&
          setPowerRaw((p) => (p.res ? p : { status: "failed", res: null })),
      );
    return () => {
      alive = false;
    };
  }, [valid, lang]);

  const fmt = (v, dec) =>
    v.toLocaleString(nf, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });

  // Repli si une clé i18n n'est pas encore présente (évite la clé brute à l'écran).
  const tf = (key, fr, en) => {
    const v = t(key);
    if (v && v !== key) return v;
    return lang === "fr" ? fr : en;
  };

  const data = useMemo(() => {
    if (!valid) return {};
    const out = {};
    ALL.forEach((id) => {
      const ds = datasets[id];
      const raw =
        (ds && ds.data && ds.data.byArea && ds.data.byArea[code]) || [];
      const s = buildSeries({ id }, raw, DEC[id]);
      if (s) out[id] = s;
    });
    return out;
  }, [datasets, code, valid]);

  // Cultures & élevage dominants du territoire (top 5 par produit).
  const agri = useMemo(() => {
    const res = agriRaw.res;
    const list = (res && res.commodities) || [];
    const bc = (res && res.byCommodity) || {};
    const mk = (kind) =>
      list
        .filter((c) => c.kind === kind)
        .map((c) => {
          const dec = /(\/ha|kg)/i.test(c.unit || "") ? 1 : 0;
          const raw =
            bc[c.code] && bc[c.code].byArea && bc[c.code].byArea[code];
          return buildSeries(
            { id: c.code, label: c.label, unit: c.unit || "" },
            raw,
            dec,
          );
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

  // Sécurité : on révèle la page au bout de ~9,5 s même si une source traîne.
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
      : {
          ...d,
          label: t(`country.ind.${d.id}`),
          unit: t(`country.unit.${d.id}`),
        };

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

  // Tonalité d'un chiffre-clé (vert = favorable, corail = défavorable).
  const keyTone = (id, trend) => {
    const up = trend > 0;
    if (id === "renewables") return up ? "positive" : "warm";
    if (["sst", "seaLevel", "rain", "emissions"].includes(id))
      return up ? "warm" : "positive";
    return "accent";
  };

  if (!valid) {
    return (
      <main className="country">
        <div className="country__inner container">
          <Link to="/" className="country__back">
            <FiArrowLeft aria-hidden="true" /> {t("country.back")}
          </Link>
          <h1 className="cpHero__title">{t("country.unknown")}</h1>
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
        .map((sx) => ({
          name: sx.label,
          color: energyColor(sx.label, tk),
          map: a.detail[sx.label] || {},
        }))
        .filter((s) => Object.keys(s.map).length);
      if (!sources.length) {
        sources = [
          Object.keys(a.fossil || {}).length
            ? {
                name: t("country.energy.fossil"),
                color: tk.warm,
                map: a.fossil,
              }
            : null,
          Object.keys(a.renew || {}).length
            ? {
                name: t("country.energy.renew"),
                color: tk.positive,
                map: a.renew,
              }
            : null,
        ].filter(Boolean);
      }
      if (!sources.length) return null;
      const totalVals = years.map((y) => ({
        year: y,
        value: sources.reduce((s, src) => s + (src.map[y] || 0), 0),
      }));
      const feature = buildSeries(
        { id: "electricity", label: t("country.ind.electricity"), unit: "GWh" },
        totalVals,
        0,
      );
      if (!feature) return null;
      const viz = (
        <StackedColsChart
          series={sources.map((s) => ({
            name: s.name,
            color: s.color,
            data: years.map((y) => s.map[y] || 0),
          }))}
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
      const years = [...new Set(arr.flatMap((s) => s.years))].sort(
        (x, y) => x - y,
      );
      const viz = (
        <TrendChart
          series={arr.map((s) => ({ name: s.label, values: s.values }))}
          years={years}
          unit={feature.unit}
        />
      );
      return { key: ch.key, feature, viz, chips: [] };
    }

    // Indicateurs pdhApi
    const present = ch.ind.map((id) => data[id]).filter(Boolean);
    if (!present.length) return null;
    const base = present.find((d) => d.multi) || present[0];
    const feature = resolve(base);
    const chips = present.filter((d) => d !== base).map(resolve);
    const viz = feature.multi ? (
      BAR.has(feature.id) ? (
        <AnnualBarsChart
          data={feature.values}
          unit={feature.unit}
          color={feature.trend < 0 ? tk.warm : tk.accent}
          format={(v) => fmt(Number(v), feature.dec)}
        />
      ) : (
        <TrendChart
          series={[{ name: feature.label, values: feature.values }]}
          years={feature.years}
          unit={feature.unit}
        />
      )
    ) : null;
    return { key: ch.key, feature, viz, chips };
  }).filter(Boolean);

  const crosses = CROSS.map((x) => {
    const L = data[x.l];
    const R = data[x.r];
    if (!L || !R || !L.multi || !R.multi) return null;
    return { key: x.key, L: resolve(L), R: resolve(R) };
  }).filter(Boolean);

  // Chiffres-clés de synthèse (+ bilan du trait de côte).
  const keyFigs = [];
  KEY_ORDER.forEach((id) => {
    const d = data[id];
    if (!d || keyFigs.length >= 5) return;
    const r = resolve(d);
    const delta =
      !ANOMALY.has(id) && d.trendPct != null
        ? `${d.trendPct > 0 ? "+" : "\u2212"}${Math.round(Math.abs(d.trendPct))}\u00a0%`
        : `${d.trend > 0 ? "+" : "\u2212"}${fmt(Math.abs(d.trend), d.dec)}`;
    keyFigs.push({
      id,
      label: r.label,
      val: fmt(d.last, d.dec),
      unit: r.unit,
      year: d.lastYear,
      delta,
      tone: keyTone(id, d.trend),
    });
  });
  const coast = COASTLINE_BY_TERRITORY.find((c) => c.area === code);
  if (coast) {
    keyFigs.push({
      id: "coast",
      label: tf("country.coast.label", "Trait de côte", "Coastline"),
      val: `${coast.bal > 0 ? "+" : coast.bal < 0 ? "\u2212" : ""}${fmt(Math.abs(coast.bal), 0)}`,
      unit: "%",
      delta: `${fmt(coast.ero, 0)}\u00a0% ${tf("country.coast.eroding", "en recul", "eroding")}`,
      tone: coast.bal > 0 ? "positive" : coast.bal < 0 ? "warm" : "accent",
    });
  }
  const coastTone = coast
    ? coast.bal > 0
      ? "positive"
      : coast.bal < 0
        ? "warm"
        : "accent"
    : "accent";
  const coastStr = coast
    ? `${coast.bal > 0 ? "+" : coast.bal < 0 ? "\u2212" : ""}${fmt(Math.abs(coast.bal), 0)}\u00a0% · ${fmt(coast.ero, 0)}\u00a0% ${tf("country.coast.eroding", "en recul", "eroding")}`
    : "";

  // Loader plein écran tant que TOUS les indicateurs ne sont pas chargés.
  if (loading) {
    return <Loader fullscreen label={loadingLabel} />;
  }

  const chapterTabs = chapters.map((ch) => ({
    id: ch.key,
    tab: t(`country.story.${ch.key}.title`),
  }));
  const safeIdx = Math.max(0, Math.min(chIdx, chapters.length - 1));
  const activeCh = chapters[safeIdx];

  return (
    <main className="country">
      <div className="country__glow" aria-hidden="true" />

      {/* 1. Hero immersif plein écran : carte 3D + points trait de côte + aura */}
      <header className="cpHero">
        <div className="cpHero__map">
          <CountryMiniMap
            coords={PICT_GEO[code]}
            zoom={ZOOM[code] || 7}
            controls
            coast={coast || null}
            coastlineUrl={`${process.env.PUBLIC_URL || ""}/data/coastline-hotspots.geojson`}
            noTokenMsg={t("country.no_token")}
          />
        </div>
        <div className="cpHero__scrim" aria-hidden="true" />
        <div className="cpHero__grain" aria-hidden="true" />

        {coast ? (
          <div className={`cpCoast cpCoast--${coastTone}`}>
            <span className="cpCoast__dot" aria-hidden="true" />
            <span className="cpCoast__txt">
              <span className="cpCoast__k">
                {tf("country.coast.label", "Trait de côte", "Coastline")}
              </span>
              <span className="cpCoast__v">{coastStr}</span>
            </span>
          </div>
        ) : null}

        <div className="cpHero__overlay">
          <p className="eyebrow cpHero__eyebrow">{t("country.eyebrow")}</p>
          <div className="cpHero__id">
            <span className="cpHero__flag">
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
            <h1 className="cpHero__title">{pictName(code, lang)}</h1>
          </div>
          <p className="cpHero__lead">{t("country.lead")}</p>
        </div>
      </header>

      {/* 2. En bref : chiffres-clés (bande instrument) */}
      {keyFigs.length ? (
        <section
          className="cpKeys"
          aria-label={tf("country.keys_title", "En bref", "At a glance")}
        >
          <p className="eyebrow cpKeys__title">
            {tf("country.keys_title", "En bref", "At a glance")}
          </p>
          <div className="cpKeys__strip">
            {keyFigs.map((k) => (
              <div className={`cpStat cpStat--${k.tone}`} key={k.id}>
                <span className="cpStat__val">
                  {k.val}
                  {k.unit ? <i className="cpStat__unit">{k.unit}</i> : null}
                </span>
                <span className="cpStat__label">{k.label}</span>
                <span className="cpStat__delta">{k.delta}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="country__inner container">
        {/* 3. Chapitres en carrousel */}
        {chapters.length ? (
          <section className="cpChapters">
            <ChartCarousel
              charts={chapterTabs}
              index={safeIdx}
              onSelect={setChIdx}
              labels={{
                prev: tf("country.nav.prev", "Précédent", "Previous"),
                next: tf("country.nav.next", "Suivant", "Next"),
                group: tf("country.nav.group", "Chapitre", "Chapter"),
              }}
            />
            {activeCh ? (
              <article className="cpChapter chcar-fade" key={activeCh.key}>
                <div className="cpChapter__head">
                  <p className="eyebrow cpChapter__kicker">
                    {t(`country.story.${activeCh.key}.kicker`)}
                  </p>
                  <h2 className="cpChapter__title">
                    {t(`country.story.${activeCh.key}.title`)}
                  </h2>
                  <div className="cpChapter__metric">
                    <span className="cpChapter__val">
                      {fmt(activeCh.feature.last, activeCh.feature.dec)}
                    </span>
                    {activeCh.feature.unit ? (
                      <span className="cpChapter__unit">
                        {activeCh.feature.unit}
                      </span>
                    ) : null}
                    <span className="cpChapter__of">
                      {activeCh.feature.label}
                    </span>
                  </div>
                  {activeCh.feature.multi ? (
                    <p className="cpChapter__narr">
                      {narrative(activeCh.feature)}
                    </p>
                  ) : null}
                  {activeCh.chips.length ? (
                    <ul className="cpChapter__chips">
                      {activeCh.chips.map((d) => (
                        <li className="cpChip" key={d.id}>
                          <span className="cpChip__k">{d.label}</span>
                          <span className="cpChip__v">
                            {fmt(d.last, d.dec)} {d.unit} · {d.lastYear}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="cpChapter__viz">
                  {activeCh.viz || (
                    <p className="cpChapter__single">
                      {fmt(activeCh.feature.last, activeCh.feature.dec)}{" "}
                      {activeCh.feature.unit} · {activeCh.feature.lastYear}
                    </p>
                  )}
                </div>
              </article>
            ) : null}
          </section>
        ) : anyLoading ? (
          <p className="cpHint">{t("country.loading")}</p>
        ) : (
          <p className="cpHint">{t("country.no_data")}</p>
        )}

        {/* 4. Croisements */}
        {crosses.length ? (
          <section className="cpCross">
            <p className="eyebrow cpCross__title">{t("country.cross_title")}</p>
            <div className="cpCross__grid">
              {crosses.map((x) => (
                <article className="cpCross__card" key={`x-${x.key}`}>
                  <h3 className="cpCross__card-title">
                    {t(`country.cross.${x.key}.title`)}
                  </h3>
                  <p className="cpCross__note">
                    {t(`country.cross.${x.key}.note`)}
                  </p>
                  <div className="cpCross__viz">
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
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {chapters.length && anyLoading ? (
          <p className="cpHint cpHint--soft">{t("country.loading")}</p>
        ) : null}
      </div>
    </main>
  );
}
