// src/components/WaterHealthStory/WaterHealthStory.jsx
// ============================================================
// CHAPITRE scrollytelling « Eau & santé ». On entre par l'ACCÈS À L'EAU, puis en
// défilant : la TUBERCULOSE, puis un panneau qui RELIE les deux (nuage de points
// eau × tuberculose). À chaque palier, un FILTRE s'allume (territoires sous le
// seuil) et une phrase explicative s'affiche (gérée par <ScrollStory>).
//
// Données live : `water` (% accès eau sûre) + `tuberculosis` (pour 100 000).
// Honnête : valeurs réelles ; le « lien » est présenté comme une CORRÉLATION,
// pas une causalité. Tokens, FR/EN, zéro inline (graphes en SVG, attributs).
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import ScrollStory from "../ScrollStory/ScrollStory";
import "./WaterHealthStory.scss";

function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function buildList(data, lang) {
  if (!data) return [];
  return Object.entries(data.byArea)
    .filter(([code]) => isPict(code))
    .map(([code, serie]) => {
      const pt = lastFinite(serie);
      if (!pt || !Number.isFinite(pt.value)) return null;
      return { code, name: pictName(code, lang), val: pt.value };
    })
    .filter(Boolean);
}

/* ---------- Graphe à barres (SVG) ---------- */
function Bars({ rows, max, unit, active, nf, tone }) {
  const padL = 132;
  const W = 520;
  const barMax = W - padL - 64;
  const rowH = 30;
  const top = 8;
  const H = top + rows.length * rowH + 8;
  return (
    <svg
      className={`ws__bars ${tone === "warm" ? "ws__bars--warm" : ""} ${active ? "is-on" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
    >
      {rows.map((r, i) => {
        const y = top + i * rowH;
        const w = Math.max(2, (r.val / max) * barMax);
        return (
          <g key={r.code}>
            <text className="ws__bar-label" x={padL - 10} y={y + 15}>
              {r.name}
            </text>
            <rect
              className={`ws__bar ${r.hi ? "ws__bar--hi" : ""}`}
              x={padL}
              y={y + 4}
              width={w}
              height={16}
              rx={4}
            />
            <text className="ws__bar-val" x={padL + w + 8} y={y + 15}>
              {nf.format(Math.round(r.val))}
              {unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Nuage de points eau × tuberculose (SVG) ---------- */
function Scatter({ points, maxTb, active, axisX, axisY, nf }) {
  const W = 520;
  const H = 360;
  const padL = 52;
  const padB = 46;
  const top = 16;
  const plotW = W - padL - 22;
  const plotH = H - padB - top;
  const px = (water) => padL + (water / 100) * plotW;
  const py = (tb) => top + (1 - tb / maxTb) * plotH;
  const xTicks = [0, 50, 100];
  const yTicks = [0, Math.round(maxTb / 2), Math.round(maxTb)];
  return (
    <svg
      className={`ws__scatter ${active ? "is-on" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
    >
      {/* axes */}
      <line className="ws__axis" x1={padL} y1={top} x2={padL} y2={top + plotH} />
      <line
        className="ws__axis"
        x1={padL}
        y1={top + plotH}
        x2={padL + plotW}
        y2={top + plotH}
      />
      {xTicks.map((tk) => (
        <text key={`x${tk}`} className="ws__tick" x={px(tk)} y={H - 26}>
          {tk}
        </text>
      ))}
      {yTicks.map((tk) => (
        <text key={`y${tk}`} className="ws__tick ws__tick--y" x={padL - 8} y={py(tk) + 3}>
          {nf.format(tk)}
        </text>
      ))}
      <text className="ws__axis-title" x={padL + plotW / 2} y={H - 6}>
        {axisX}
      </text>
      <text
        className="ws__axis-title"
        x={-(top + plotH / 2)}
        y={14}
        transform="rotate(-90)"
      >
        {axisY}
      </text>

      {points.map((p) => (
        <circle
          key={p.code}
          className={`ws__pt ${p.hi ? "ws__pt--hi" : ""}`}
          cx={px(p.water)}
          cy={py(p.tb)}
          r={p.hi ? 6.5 : 5}
        />
      ))}
    </svg>
  );
}

export default function WaterHealthStory() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );

  const water = useSelector(selectDataset("water"));
  const tb = useSelector(selectDataset("tuberculosis"));

  useEffect(() => {
    dispatch(loadDataset("water"));
    dispatch(loadDataset("tuberculosis"));
  }, [dispatch]);

  const ready =
    water.status === "succeeded" &&
    water.data &&
    tb.status === "succeeded" &&
    tb.data;
  const failed = water.status === "failed" || tb.status === "failed";

  const model = useMemo(() => {
    if (!ready) return null;
    const wList = buildList(water.data, lang);
    const tList = buildList(tb.data, lang);
    if (!wList.length || !tList.length) return null;

    const waterRows = [...wList]
      .sort((a, b) => a.val - b.val) // accès le plus faible d'abord
      .slice(0, 8)
      .map((o) => ({ ...o, hi: o.val < 80 }));

    const tbMed = median(tList.map((o) => o.val)) ?? 0;
    const tbRows = [...tList]
      .sort((a, b) => b.val - a.val) // incidence la plus forte d'abord
      .slice(0, 8)
      .map((o) => ({ ...o, hi: o.val > tbMed }));

    const tMap = {};
    tList.forEach((o) => {
      tMap[o.code] = o.val;
    });
    const merged = wList
      .filter((o) => tMap[o.code] != null)
      .map((o) => ({
        code: o.code,
        name: o.name,
        water: o.val,
        tb: tMap[o.code],
        hi: o.val < 80 && tMap[o.code] > tbMed,
      }));
    const maxTb = Math.max(...merged.map((o) => o.tb), tbMed * 2 || 1);

    return {
      waterRows,
      waterMax: 100,
      tbRows,
      tbMax: Math.max(...tbRows.map((o) => o.val), 1),
      merged,
      maxTb,
    };
  }, [ready, water.data, tb.data, lang]);

  // -1 = mode vertical (tous filtres allumés)
  const [step, setStep] = useState(0);
  const onStep = useCallback((s) => setStep(s), []);

  if (failed) {
    return (
      <section className="ws ws--state">
        <p className="ws__state">{t("home.story.unavailable")}</p>
      </section>
    );
  }
  if (!ready || !model) {
    return (
      <section className="ws ws--state">
        <p className="ws__state">{t("home.story.loading")}</p>
      </section>
    );
  }

  const on = (i) => step < 0 || step === i;

  const panels = [
    <article className="ws__panel" key="water">
      <p className="ws__kicker">{t("home.story.kicker_water")}</p>
      <h3 className="ws__title">{t("home.story.title_water")}</h3>
      <div className="ws__chart">
        <Bars
          rows={model.waterRows}
          max={model.waterMax}
          unit={t("home.story.unit_water")}
          active={on(0)}
          nf={nf}
        />
      </div>
      <p className={`ws__filter ${on(0) ? "is-on" : ""}`}>
        <span className="ws__filter-dot" aria-hidden="true" />
        {t("home.story.filter_water")}
      </p>
    </article>,

    <article className="ws__panel" key="tb">
      <p className="ws__kicker ws__kicker--warm">{t("home.story.kicker_tb")}</p>
      <h3 className="ws__title">{t("home.story.title_tb")}</h3>
      <div className="ws__chart">
        <Bars
          rows={model.tbRows}
          max={model.tbMax}
          unit={t("home.story.unit_tb")}
          active={on(1)}
          nf={nf}
          tone="warm"
        />
      </div>
      <p className={`ws__filter ws__filter--warm ${on(1) ? "is-on" : ""}`}>
        <span className="ws__filter-dot" aria-hidden="true" />
        {t("home.story.filter_tb")}
      </p>
    </article>,

    <article className="ws__panel" key="link">
      <p className="ws__kicker ws__kicker--warm">{t("home.story.kicker_link")}</p>
      <h3 className="ws__title">{t("home.story.title_link")}</h3>
      <div className="ws__chart ws__chart--scatter">
        <Scatter
          points={model.merged}
          maxTb={model.maxTb}
          active={on(2)}
          axisX={t("home.story.axis_water")}
          axisY={t("home.story.axis_tb")}
          nf={nf}
        />
      </div>
      <p className={`ws__filter ws__filter--warm ${on(2) ? "is-on" : ""}`}>
        <span className="ws__filter-dot" aria-hidden="true" />
        {t("home.story.filter_link")}
      </p>
    </article>,
  ];

  const captions = [
    t("home.story.cap_water"),
    t("home.story.cap_tb"),
    t("home.story.cap_link"),
  ];

  return (
    <div className="ws">
      <ScrollStory
        panels={panels}
        captions={captions}
        onStep={onStep}
        hint={t("home.story.hint")}
      />
      <p className="ws__source">{t("home.story.source")}</p>
    </div>
  );
}