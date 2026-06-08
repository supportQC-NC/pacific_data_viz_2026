// src/pages/FunFacts/FunFacts.jsx
// ============================================================
// « Le saviez-vous ? » — mode plein écran lancé depuis l'accueil.
// Enchaîne des faits tirés des VRAIES données (records live + cadrages
// remplis avec les vraies valeurs). Le format s'adapte au fait :
//   • map     → locator du territoire sur le Pacifique
//   • spark   → mini-courbe d'évolution
//   • compare → barre vs médiane du Pacifique
//   • kpi     → gros chiffre (faits régionaux)
// Suivant = fait aléatoire ; Échap / Retour = accueil. Rendu 100 % SVG léger.
// Couleur d'accent pilotée par data-accent + variables CSS (aucun style inline).
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { loadDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { pictName } from "../../i18n/pictNames";
import PICT_GEO from "../../data/pictGeo";
import { FF_DATASET_IDS, FF_DATASETS, buildFacts, shuffle } from "../../data/funFacts";
import "./FunFacts.scss";

// --- projection du Pacifique (décalage de l'antiméridien) ---
const MAPW = 520;
const MAPH = 300;
const PAD = 24;
const SHIFT = ([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat];
const SHIFTED = Object.fromEntries(Object.entries(PICT_GEO).map(([g, c]) => [g, SHIFT(c)]));
const XS = Object.values(SHIFTED).map((c) => c[0]);
const YS = Object.values(SHIFTED).map((c) => c[1]);
const MINX = Math.min(...XS);
const MAXX = Math.max(...XS);
const MINY = Math.min(...YS);
const MAXY = Math.max(...YS);
const projX = (lng) => PAD + ((lng - MINX) / (MAXX - MINX)) * (MAPW - 2 * PAD);
const projY = (lat) => PAD + ((MAXY - lat) / (MAXY - MINY)) * (MAPH - 2 * PAD);

function FFTop({ onHome, t }) {
  return (
    <header className="ff__top">
      <span className="ff__kicker">{t("funfacts.kicker")}</span>
      <button type="button" className="ff__home" onClick={onHome}>
        <span aria-hidden="true">←</span> {t("funfacts.home")}
      </button>
    </header>
  );
}

export default function FunFacts() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { lang, t } = useLang();

  const datasets = useSelector((s) => s.climate.datasets);

  useEffect(() => {
    FF_DATASET_IDS.forEach((id) => dispatch(loadDataset(id)));
  }, [dispatch]);

  const dataById = useMemo(() => {
    const out = {};
    FF_DATASET_IDS.forEach((id) => {
      const e = datasets[id];
      if (e && e.status === "succeeded" && e.data) out[id] = e.data;
    });
    return out;
  }, [datasets]);

  const settled = FF_DATASET_IDS.every((id) => {
    const e = datasets[id];
    return e && (e.status === "succeeded" || e.status === "failed");
  });

  const [facts, setFacts] = useState([]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!settled) return;
    setFacts(shuffle(buildFacts(dataById)));
    setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const next = useCallback(() => {
    setIdx((i) => {
      const n = i + 1;
      if (n >= facts.length) {
        setFacts((cur) => shuffle(cur));
        return 0;
      }
      return n;
    });
  }, [facts.length]);

  const goHome = useCallback(() => navigate("/"), [navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") goHome();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, goHome]);

  // --- formatage des valeurs selon la langue ---
  const loc = lang === "fr" ? "fr-FR" : "en-US";
  const nf = useCallback(
    (v, dsId) => {
      const cfg = FF_DATASETS[dsId];
      if (cfg.compact) return new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 }).format(v);
      return new Intl.NumberFormat(loc, { maximumFractionDigits: cfg.decimals, minimumFractionDigits: 0 }).format(v);
    },
    [loc],
  );
  const nfMult = useCallback((v) => new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(v), [loc]);
  const withUnit = useCallback(
    (v, dsId) => {
      const u = FF_DATASETS[dsId].unit;
      return u ? `${nf(v, dsId)} ${u}` : nf(v, dsId);
    },
    [nf],
  );
  const areaLabel = useCallback((f) => (f.region ? t(`funfacts.region.${f.region}`) : pictName(f.area, lang)), [t, lang]);

  const sentence = useCallback(
    (f) => {
      let s = t(`funfacts.tpl.${f.kind}`) || "";
      const repl = {
        "{area}": areaLabel(f),
        "{metric}": t(`funfacts.ds.${f.dsId}`) || "",
        "{value}": f.value != null ? withUnit(f.value, f.dsId) : "",
        "{v0}": f.v0 != null ? withUnit(f.v0, f.dsId) : "",
        "{v1}": f.v1 != null ? withUnit(f.v1, f.dsId) : "",
        "{mult}": f.mult != null ? `${nfMult(f.mult)}×` : "",
        "{year}": f.year != null ? String(f.year) : "",
        "{year0}": f.year0 != null ? String(f.year0) : "",
        "{year1}": f.year1 != null ? String(f.year1) : "",
      };
      Object.entries(repl).forEach(([k, val]) => { s = s.split(k).join(val); });
      return s;
    },
    [t, areaLabel, withUnit, nfMult],
  );

  // ---------- rendus par format ----------
  function Locator({ f }) {
    const c = SHIFTED[f.area];
    return (
      <svg className="ff__svg" viewBox={`0 0 ${MAPW} ${MAPH}`} role="img" aria-label={areaLabel(f)}>
        {Object.entries(SHIFTED).map(([g, [lng, lat]]) => (
          <circle key={g} cx={projX(lng)} cy={projY(lat)} r={g === f.area ? 0 : 3} className="ff__dot" />
        ))}
        {c && (
          <g>
            <circle cx={projX(c[0])} cy={projY(c[1])} r={16} className="ff__loc-ring" />
            <circle cx={projX(c[0])} cy={projY(c[1])} r={7} className="ff__loc-dot" />
          </g>
        )}
      </svg>
    );
  }

  function Spark({ f }) {
    const W = 520;
    const H = 220;
    const pad = 28;
    const xs = f.series.map((d) => d.year);
    const ys = f.series.map((d) => d.value);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const px = (x) => pad + ((x - minX) / ((maxX - minX) || 1)) * (W - 2 * pad);
    const py = (y) => H - pad - ((y - minY) / ((maxY - minY) || 1)) * (H - 2 * pad);
    const d = f.series.map((pt, i) => `${i ? "L" : "M"}${px(pt.year).toFixed(1)} ${py(pt.value).toFixed(1)}`).join(" ");
    const a = f.series[0];
    const b = f.series[f.series.length - 1];
    return (
      <svg className="ff__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        <path d={d} className="ff__spark-line" />
        <circle cx={px(a.year)} cy={py(a.value)} r="4" className="ff__spark-start" />
        <circle cx={px(b.year)} cy={py(b.value)} r="6" className="ff__spark-end" />
        <text className="ff__sparklab" x={px(a.year)} y={py(a.value) - 10} textAnchor="start">{a.year}</text>
        <text className="ff__sparklab" x={px(b.year)} y={py(b.value) - 12} textAnchor="end">{b.year}</text>
      </svg>
    );
  }

  function Compare({ f }) {
    const W = 520;
    const H = 200;
    const max = Math.max(f.value, f.ref) || 1;
    const barH = 46;
    const bw = (v) => 60 + (v / max) * (W - 200);
    return (
      <svg className="ff__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        <rect x="60" y="36" width={Math.max(0, bw(f.value) - 60)} height={barH} rx="6" className="ff__bar" />
        <rect x="60" y="118" width={Math.max(0, bw(f.ref) - 60)} height={barH} rx="6" className="ff__bar-ref" />
        <text className="ff__barlab" x="60" y="28">{areaLabel(f)}</text>
        <text className="ff__barval" x={bw(f.value) + 10} y={36 + barH / 2 + 5}>{withUnit(f.value, f.dsId)}</text>
        <text className="ff__barlab" x="60" y="110">{t("funfacts.median")}</text>
        <text className="ff__barval" x={bw(f.ref) + 10} y={118 + barH / 2 + 5}>{withUnit(f.ref, f.dsId)}</text>
      </svg>
    );
  }

  // ---------- états ----------
  if (!settled && facts.length === 0) {
    return (
      <main className="ff" data-loading="true">
        <FFTop onHome={goHome} t={t} />
        <div className="ff__stage"><p className="ff__loading">{t("funfacts.loading")}</p></div>
      </main>
    );
  }
  if (facts.length === 0) {
    return (
      <main className="ff">
        <FFTop onHome={goHome} t={t} />
        <div className="ff__stage"><p className="ff__loading">{t("funfacts.empty")}</p></div>
      </main>
    );
  }

  const f = facts[idx];

  return (
    <main className="ff">
      <FFTop onHome={goHome} t={t} />

      <div className="ff__stage">
        <div className="ff__card" data-accent={f.accent} key={f.id}>
          <p className="ff__eyebrow">{t(`funfacts.ds.${f.dsId}`)}</p>

          {f.format === "kpi" && <p className="ff__big">{withUnit(f.value, f.dsId)}</p>}
          {f.format === "compare" && <p className="ff__big">{nfMult(f.mult)}×</p>}

          <div className="ff__visual">
            {f.format === "map" && <Locator f={f} />}
            {f.format === "spark" && <Spark f={f} />}
            {f.format === "compare" && <Compare f={f} />}
            {f.format === "kpi" && <p className="ff__scope">{areaLabel(f)}</p>}
            {f.format === "map" && <p className="ff__big ff__big--onmap">{withUnit(f.value, f.dsId)}</p>}
          </div>

          <p className="ff__sentence">{sentence(f)}</p>
        </div>
      </div>

      <div className="ff__controls">
        <span className="ff__count">{idx + 1} / {facts.length}</span>
        <button type="button" className="ff__next" onClick={next}>
          {t("funfacts.next")} <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}