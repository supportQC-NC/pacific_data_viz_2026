// src/components/LineRace/LineRace.jsx
// ============================================================
// Course de LIGNES animée (ApexCharts) — les trajectoires se tracent année
// après année avec play/pause, dans l'esprit du BarRace.
//   • DÉMARRE EN PAUSE : aucune animation ne se lance sans action de
//     l'utilisateur (bouton ▶). Règle d'expérience du projet : c'est
//     toujours la personne qui décide de lancer une animation.
//   • Axe Y FIXE (min/max sur toute la série) -> pas de re-cadrage qui saute.
//   • appendData() pour une croissance fluide ; boucle au bout.
//   • HAUTEUR FORCÉE EN JS en mode diaporama (~74% de l'écran).
//   • Tous les appels protégés ; frames/timer nettoyés au démontage.
// Props : series [{name, values:[{year,value}]}], years [], unit, tk,
//         labels { play, pause }, autoplay (false par défaut).
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import ApexCharts from "apexcharts";
import "./LineRace.scss";

const MONO = "IBM Plex Mono";
const SANS = "Hanken Grotesk";
const TICK = 900;

function targetHeight(el) {
  const inDeck = el && el.closest && el.closest(".act1viz__chart");
  if (inDeck) return Math.max(240, Math.round(window.innerHeight * 0.74));
  return el && el.clientHeight ? el.clientHeight : 420;
}

const finiteOr = (v) => (Number.isFinite(v) ? Number(v.toFixed(3)) : null);

export default function LineRace({ series = [], years = [], unit = "", tk = {}, labels = {}, autoplay = false }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const idxRef = useRef(0);
  const playingRef = useRef(autoplay);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !series.length || years.length < 2) return undefined;

    const palette = [tk.accent, tk.warm, tk.secondary, tk.positive, tk.accentDeep, tk.negative].filter(Boolean);
    const valAt = (s, y) => {
      const p = s.values.find((d) => d.year === y);
      return p ? p.value : null;
    };
    const allVals = [];
    series.forEach((s) => years.forEach((y) => {
      const v = valAt(s, y);
      if (Number.isFinite(v)) allVals.push(v);
    }));
    const lo = allVals.length ? Math.min(...allVals) : 0;
    const hi = allVals.length ? Math.max(...allVals) : 1;
    const pad = (hi - lo) * 0.08 || 0.5;

    const seriesAt = (yi) =>
      series.map((s) => ({
        name: s.name,
        data: years.slice(0, yi + 1).map((y) => finiteOr(valAt(s, y))),
      }));
    const appendAt = (yi) => series.map((s) => ({ data: [finiteOr(valAt(s, years[yi]))] }));

    idxRef.current = 0;

    const options = {
      chart: {
        type: "line",
        height: targetHeight(el),
        fontFamily: SANS,
        foreColor: tk.textMute || "#8893b5",
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, easing: "linear", dynamicAnimation: { enabled: true, speed: TICK } },
      },
      colors: palette.length ? palette : ["#8fa1ea"],
      series: seriesAt(0),
      stroke: { curve: "smooth", width: 1.8 },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: {
        position: "top",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textSoft || "#ccd5ee" },
        markers: { width: 9, height: 9, radius: 3 },
      },
      grid: { borderColor: tk.line || "#2a3350", strokeDashArray: 4, xaxis: { lines: { show: false } } },
      xaxis: {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
        axisBorder: { color: tk.line || "#2a3350" },
        axisTicks: { color: tk.line || "#2a3350" },
        labels: { style: { colors: tk.textMute || "#8893b5", fontFamily: MONO, fontSize: "11px" } },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: lo - pad,
        max: hi + pad,
        forceNiceScale: true,
        title: { text: unit, style: { color: tk.textMute || "#8893b5", fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: { style: { colors: tk.textMute || "#8893b5", fontFamily: MONO, fontSize: "11px" }, formatter: (v) => Number(v).toFixed(1) },
      },
      tooltip: {
        shared: true,
        intersect: false,
        style: { fontSize: "12px", fontFamily: SANS },
        y: { formatter: (v) => (v == null ? "—" : `${Number(v).toFixed(2)} ${unit}`) },
      },
    };

    let chart;
    try {
      chart = new ApexCharts(el, options);
      chartRef.current = chart;
      chart.render();
    } catch (e) {
      /* noop */
    }

    const fit = () => {
      if (!chartRef.current) return;
      try {
        chartRef.current.updateOptions({ chart: { height: targetHeight(el) } }, false, false);
      } catch (e) {
        /* noop */
      }
    };
    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(fit);
    });
    ro.observe(el);
    window.addEventListener("resize", fit);

    timerRef.current = setInterval(() => {
      if (!playingRef.current || !chartRef.current) return;
      const ni = idxRef.current + 1;
      try {
        if (ni >= years.length) {
          // Boucle : on repart de la première année.
          idxRef.current = 0;
          setIdx(0);
          chartRef.current.updateSeries(seriesAt(0), false);
        } else {
          idxRef.current = ni;
          setIdx(ni);
          chartRef.current.appendData(appendAt(ni));
        }
      } catch (e) {
        /* noop */
      }
    }, TICK);

    return () => {
      clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", fit);
      ro.disconnect();
      try {
        if (chartRef.current) chartRef.current.destroy();
      } catch (e) {
        /* noop */
      }
      chartRef.current = null;
    };
  }, [series, years, unit, tk]);

  return (
    <div className="linerace">
      <div className="linerace__top">
        <button type="button" className="linerace__play" onClick={() => setPlaying((p) => !p)}>
          {playing ? labels.pause || "Pause" : labels.play || "Lecture"}
        </button>
        <span className="linerace__yr">{years[idx]}</span>
      </div>
      <div className="linerace__canvas" ref={elRef} />
      <span className="linerace__ghost" aria-hidden="true">
        {years[idx]}
      </span>
    </div>
  );
}