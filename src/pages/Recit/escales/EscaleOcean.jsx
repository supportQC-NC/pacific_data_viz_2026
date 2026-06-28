// src/pages/Recit/escales/EscaleOcean.jsx
// ============================================================
// ESCALE I — « La Fièvre de l'Océan » (contenu).
// Première escale du Récit, recentrée sur le Pacifique : l'océan que lit le
// navigateur sous sa coque. Données RÉELLES : anomalie de température de
// surface (SST_ANOM, Pacific Data Hub) via climateSlice.
//
// Scène signature « LA LIGNE DE FIÈVRE » : la médiane régionale de l'anomalie
// SST, tracée comme la SURFACE de l'océan — elle se dessine et se réchauffe
// au scroll (dégradé thermique cyan→corail). Le territoire le plus chaud
// compte en grand. La pirogue reste posée sur l'horizon (fil rouge).
//
// Style : Archivo / Spectral, accent cyan, GSAP au scroll, reduced-motion ok.
// ============================================================

import React, { useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLang } from "../../../store/context/langContext";
import { loadDataset, selectDataset } from "../../../store/slices/climateSlice";
import { isPict, pictName } from "../../../i18n/pictNames";
import useInView from "../../../hooks/UseInView";
import "./EscaleOcean.scss";

gsap.registerPlugin(ScrollTrigger);

const COPY = {
  fr: {
    kicker: "Escale I",
    title: "La Fièvre de l’Océan",
    lead: "Sous la coque, une mer qui se réchauffe et se soulève.",
    cue: "Descendre",
    sceneKicker: "Anomalie de température de surface",
    sceneTitle: "L’océan a de la fièvre.",
    sceneText:
      "Année après année, la surface du Pacifique s’écarte de sa normale. " +
      "Voici la courbe de cette fièvre — la médiane de tous les territoires, " +
      "tracée comme la surface de la mer.",
    statCap: "le plus chaud, dernière mesure",
    normal: "normale",
    take: "Quand la ligne s’éloigne de la normale, c’est tout ce qui vit dessous qui change.",
    source: "Source : Pacific Data Hub · anomalie SST (NOAA / NCEI)",
    loading: "Lecture de la donnée…",
    empty: "Donnée de température indisponible.",
    unit: "°C",
  },
  en: {
    kicker: "Leg I",
    title: "The Ocean’s Fever",
    lead: "Beneath the hull, a sea that warms and swells.",
    cue: "Scroll",
    sceneKicker: "Sea-surface temperature anomaly",
    sceneTitle: "The ocean runs a fever.",
    sceneText:
      "Year after year, the Pacific surface drifts from its normal. " +
      "Here is the curve of that fever — the median of every territory, " +
      "drawn like the surface of the sea.",
    statCap: "warmest, latest reading",
    normal: "normal",
    take: "When the line pulls away from normal, everything living beneath it changes.",
    source: "Source: Pacific Data Hub · SST anomaly (NOAA / NCEI)",
    loading: "Reading the data…",
    empty: "Temperature data unavailable.",
    unit: "°C",
  },
};

function median(nums) {
  const a = nums
    .filter(Number.isFinite)
    .slice()
    .sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (serie[i] && Number.isFinite(serie[i].value)) return serie[i];
  return null;
}

export default function EscaleOcean() {
  const { lang } = useLang();
  const c = COPY[lang === "en" ? "en" : "fr"];
  const dispatch = useDispatch();
  const sst = useSelector(selectDataset("sst"));

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const ready = sst.status === "succeeded" && !!sst.data;
  const failed = sst.status === "failed";

  // Médiane régionale par année (la « ligne de fièvre »).
  const series = useMemo(() => {
    if (!ready) return [];
    const { areas, years, byArea } = sst.data;
    const picts = areas.filter(isPict);
    return years
      .map((y) => {
        const vals = picts
          .map((a) => {
            const s = byArea[a];
            const pt = s && s.find((p) => p.year === y);
            return pt ? pt.value : null;
          })
          .filter(Number.isFinite);
        return { year: y, value: median(vals) };
      })
      .filter((p) => Number.isFinite(p.value));
  }, [ready, sst.data]);

  // Territoire le plus chaud (dernière mesure).
  const warmest = useMemo(() => {
    if (!ready) return null;
    let best = null;
    sst.data.areas.filter(isPict).forEach((a) => {
      const pt = lastFinite(sst.data.byArea[a] || []);
      if (pt && (!best || pt.value > best.value)) {
        best = {
          code: a,
          name: pictName(a, lang),
          value: pt.value,
          year: pt.year,
        };
      }
    });
    return best;
  }, [ready, sst.data, lang]);

  // Géométrie de la ligne de fièvre.
  const geo = useMemo(() => {
    const W = 1000;
    const H = 360;
    const padL = 56;
    const padR = 24;
    const padT = 34;
    const padB = 48;
    if (series.length < 2) return null;
    const vals = series.map((p) => p.value);
    const dMin = Math.min(0, ...vals);
    const dMax = Math.max(...vals) * 1.08 || 1;
    const n = series.length;
    const xs = (i) => padL + (i / (n - 1)) * (W - padL - padR);
    const ys = (v) =>
      padT + (1 - (v - dMin) / (dMax - dMin)) * (H - padT - padB);
    const line = series
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`,
      )
      .join(" ");
    const area = `${line} L${xs(n - 1).toFixed(1)},${ys(dMin).toFixed(1)} L${xs(0).toFixed(1)},${ys(dMin).toFixed(1)} Z`;
    return { W, H, line, area, baseY: ys(0), x0: xs(0), x1: xs(n - 1) };
  }, [series]);

  // Refs d'animation.
  const [vizRef, vizIn] = useInView({ threshold: 0.3 });
  const lineRef = useRef(null);
  const areaRef = useRef(null);
  const numRef = useRef(null);
  const rootRef = useRef(null);

  const nf = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [lang],
  );
  const signed = (v) => (v < 0 ? "\u2212" : "+") + nf.format(Math.abs(v));

  // Hero : révélation douce au montage.
  useLayoutEffect(() => {
    if (reduced || !rootRef.current) return undefined;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".escale__kicker", { y: 16, opacity: 0, duration: 0.6 })
        .from(".escale__title", { y: 28, opacity: 0, duration: 0.8 }, "-=0.3")
        .from(".escale__lead", { y: 20, opacity: 0, duration: 0.7 }, "-=0.4")
        .from(".escale__vaa", { y: 30, opacity: 0, duration: 1.0 }, "-=0.5")
        .from(".escale__cue", { opacity: 0, duration: 0.6 }, "-=0.2");
    }, rootRef);
    return () => ctx.revert();
  }, [reduced]);

  // Viz : tracé de la ligne + comptage du chiffre quand elle entre à l'écran.
  useEffect(() => {
    if (!geo || !vizIn) return undefined;
    const line = lineRef.current;
    const area = areaRef.current;
    if (reduced) {
      if (line) line.style.strokeDashoffset = "0";
      if (area) area.style.opacity = "1";
      if (numRef.current && warmest)
        numRef.current.textContent = signed(warmest.value);
      return undefined;
    }
    const len = line ? line.getTotalLength() : 0;
    if (line) {
      line.style.strokeDasharray = `${len}`;
      line.style.strokeDashoffset = `${len}`;
    }
    const tl = gsap.timeline();
    if (line)
      tl.to(
        line,
        { strokeDashoffset: 0, duration: 1.8, ease: "power2.out" },
        0,
      );
    if (area)
      tl.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 1.4 }, 0.4);
    if (warmest) {
      const o = { v: 0 };
      tl.to(
        o,
        {
          v: warmest.value,
          duration: 1.6,
          ease: "power1.out",
          onUpdate: () => {
            if (numRef.current) numRef.current.textContent = signed(o.v);
          },
        },
        0.3,
      );
    }
    return () => tl.kill();
  }, [geo, vizIn, reduced, warmest]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="escale escale--ocean" ref={rootRef}>
      {/* --- HERO de l'escale --- */}
      <section className="escale__hero">
        <div className="escale__hero-bg" aria-hidden="true" />
        <div className="escale__hero-inner">
          <p className="escale__kicker">{c.kicker}</p>
          <h1 className="escale__title">{c.title}</h1>
          <p className="escale__lead">{c.lead}</p>
        </div>

        <div className="escale__vaa" aria-hidden="true">
          <svg viewBox="0 0 260 200">
            <path
              className="escale__sail"
              d="M150 26 C 200 48 218 102 216 152 C 184 141 162 124 150 109 Z"
            />
            <path
              className="escale__sail escale__sail--back"
              d="M150 32 C 122 57 112 102 114 146 C 137 133 146 120 150 109 Z"
            />
            <line className="escale__mast" x1="150" y1="24" x2="150" y2="166" />
            <path
              className="escale__hull"
              d="M90 168 Q 150 193 210 168 Q 183 181 150 181 Q 117 181 90 168 Z"
            />
            <path className="escale__ama" d="M86 191 Q 150 201 208 191" />
            <line
              className="escale__iako"
              x1="121"
              y1="177"
              x2="115"
              y2="191"
            />
            <line
              className="escale__iako"
              x1="179"
              y1="177"
              x2="185"
              y2="191"
            />
          </svg>
        </div>

        <span className="escale__cue" aria-hidden="true">
          {c.cue} <span className="escale__cue-arrow">↓</span>
        </span>
      </section>

      {/* --- SCÈNE : la ligne de fièvre --- */}
      <section className="escale__scene" ref={vizRef}>
        <div className="escale__scene-grid">
          <div className="escale__narr">
            <p className="escale__scene-kicker">{c.sceneKicker}</p>
            <h2 className="escale__scene-title">{c.sceneTitle}</h2>
            <p className="escale__scene-text">{c.sceneText}</p>

            {warmest && (
              <p className="escale__stat">
                <span className="escale__stat-num" ref={numRef}>
                  {reduced ? signed(warmest.value) : `+0,00`}
                </span>
                <span className="escale__stat-unit">{c.unit}</span>
                <span className="escale__stat-cap">
                  {warmest.name} — {c.statCap}
                </span>
              </p>
            )}
          </div>

          <figure className="escale__viz">
            {!ready && !failed && <p className="escale__state">{c.loading}</p>}
            {(failed || (ready && !geo)) && (
              <p className="escale__state escale__state--err">{c.empty}</p>
            )}

            {geo && (
              <svg
                className="escale__fever"
                viewBox={`0 0 ${geo.W} ${geo.H}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label={c.sceneTitle}
              >
                <defs>
                  <linearGradient id="fever-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b4a" stopOpacity="0.55" />
                    <stop offset="55%" stopColor="#f0a35e" stopOpacity="0.22" />
                    <stop
                      offset="100%"
                      stopColor="#5ec8d8"
                      stopOpacity="0.06"
                    />
                  </linearGradient>
                  <linearGradient id="fever-line" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b4a" />
                    <stop offset="100%" stopColor="#5ec8d8" />
                  </linearGradient>
                </defs>

                {/* normale (0) */}
                <line
                  className="escale__base"
                  x1={geo.x0}
                  y1={geo.baseY}
                  x2={geo.x1}
                  y2={geo.baseY}
                />
                <text className="escale__base-tag" x={geo.x0} y={geo.baseY - 8}>
                  {c.normal}
                </text>

                {/* la surface qui se réchauffe */}
                <path ref={areaRef} className="escale__area" d={geo.area} />
                <path ref={lineRef} className="escale__line" d={geo.line} />
              </svg>
            )}

            <figcaption className="escale__take">{c.take}</figcaption>
            <p className="escale__source">{c.source}</p>
          </figure>
        </div>
      </section>
    </main>
  );
}
