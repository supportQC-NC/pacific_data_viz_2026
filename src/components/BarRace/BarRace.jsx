// src/components/BarRace/BarRace.jsx
// ============================================================
// Course de barres animée (ECharts realtimeSort).
//   • DÉMARRE EN PAUSE : aucune animation ne se lance sans action de
//     l'utilisateur (bouton ▶). Règle d'expérience du projet : c'est
//     toujours la personne qui décide de lancer une animation.
//   • HAUTEUR FORCÉE EN JS en mode diaporama (~74% de l'écran).
//   • Tous les appels protégés par isDisposed() + frames annulées au démontage
//     pour éviter "layerStack" null quand le graphique est détruit pendant
//     l'animation.
//   • Options :
//       autoplay (false) : false = en pause (défaut) ; true = lecture auto ;
//       loop (true)      : reboucle ; false = s'arrête à la dernière année ;
//       tick (900 ms)    : durée d'un pas (plus grand = plus lent).
//   • Bouton « retour au début » (⟲) pour rejouer.
// Props : series [{name, values:[{year,value}]}], years [], unit, tk,
//         labels { play, pause, restart }, autoplay, loop, tick.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import "./BarRace.scss";

const MONO = "IBM Plex Mono";
const SANS = "Hanken Grotesk";

function targetHeight(el) {
  const inDeck = el && el.closest && el.closest(".act1viz__chart");
  if (inDeck) return Math.max(240, Math.round(window.innerHeight * 0.74));
  return el && el.clientHeight ? el.clientHeight : 420;
}

function alive(chart) {
  return chart && !chart.isDisposed();
}

export default function BarRace({ series = [], years = [], unit = "", tk = {}, labels = {}, autoplay = false, loop = true, tick = 900, decimals = 1 }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const rafRef = useRef(0);
  const idxRef = useRef(0);
  const playingRef = useRef(autoplay);
  const applyRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(autoplay);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !series.length || !years.length) return undefined;

    const chart = echarts.init(el, null, { renderer: "canvas" });
    chartRef.current = chart;

    const palette = [tk.accent, tk.warm, tk.secondary, tk.positive, tk.accentDeep, tk.negative].filter(Boolean);
    const colorOf = (i) => (palette.length ? palette[i % palette.length] : "#8fa1ea");
    const names = series.map((s) => s.name);
    const valuesFor = (yi) =>
      series.map((s, i) => {
        const p = s.values.find((v) => v.year === years[yi]);
        return {
          value: p ? Number(p.value.toFixed(2)) : 0,
          itemStyle: { color: colorOf(i), borderRadius: [0, 4, 4, 0] },
        };
      });

    if (idxRef.current >= years.length) idxRef.current = 0;

    // Permet à l'UI (boutons) d'aller à une année précise.
    applyRef.current = (i) => {
      idxRef.current = i;
      setIdx(i);
      if (alive(chartRef.current)) {
        try {
          chartRef.current.setOption({ series: [{ id: "race", data: valuesFor(i) }] });
        } catch (e) {
          /* noop */
        }
      }
    };

    chart.setOption({
      grid: { top: 8, bottom: 28, left: 8, right: 96, containLabel: true },
      xAxis: {
        max: "dataMax",
        axisLabel: { color: tk.textMute || "#8893b5", fontFamily: MONO },
        axisLine: { lineStyle: { color: tk.line || "#2a3350" } },
        splitLine: { lineStyle: { color: tk.line || "#2a3350", type: "dashed", opacity: 0.4 } },
      },
      yAxis: {
        type: "category",
        data: names,
        inverse: true,
        animationDuration: 300,
        animationDurationUpdate: 300,
        axisLabel: { color: tk.textSoft || "#ccd5ee", fontFamily: SANS },
        axisLine: { lineStyle: { color: tk.line || "#2a3350" } },
        axisTick: { show: false },
      },
      series: [
        {
          id: "race",
          type: "bar",
          realtimeSort: true,
          data: valuesFor(idxRef.current),
          barMaxWidth: 28,
          label: {
            show: true,
            position: "right",
            valueAnimation: true,
            fontFamily: MONO,
            fontSize: 12,
            color: tk.textSoft || "#ccd5ee",
            formatter: (p) => ` ${Number(p.value).toFixed(decimals)} ${unit}`,
          },
        },
      ],
      animationDuration: 0,
      animationDurationUpdate: tick,
      animationEasing: "linear",
      animationEasingUpdate: "linear",
    });

    const fit = () => {
      if (!alive(chartRef.current)) return;
      try {
        chartRef.current.resize({ height: targetHeight(el) });
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
    fit();

    const timer = setInterval(() => {
      if (!playingRef.current || !alive(chartRef.current)) return;
      const next = idxRef.current + 1;
      if (next >= years.length) {
        if (loop) {
          idxRef.current = 0;
          setIdx(0);
          try {
            chartRef.current.setOption({ series: [{ id: "race", data: valuesFor(0) }] });
          } catch (e) {
            /* noop */
          }
        } else {
          // Fin : on s'arrête sur la dernière année (pas de boucle).
          playingRef.current = false;
          setPlaying(false);
        }
        return;
      }
      idxRef.current = next;
      setIdx(next);
      try {
        chartRef.current.setOption({ series: [{ id: "race", data: valuesFor(next) }] });
      } catch (e) {
        /* noop */
      }
    }, tick);

    return () => {
      clearInterval(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", fit);
      ro.disconnect();
      applyRef.current = null;
      if (alive(chart)) chart.dispose();
      chartRef.current = null;
    };
  }, [series, years, unit, tk, loop, tick, decimals]);

  const atEnd = idx >= years.length - 1;

  const togglePlay = () => {
    // Si on relance alors qu'on est à la fin (sans boucle), on repart du début.
    if (!playing && atEnd && !loop && applyRef.current) applyRef.current(0);
    setPlaying((p) => !p);
  };
  const restart = () => {
    if (applyRef.current) applyRef.current(0);
  };

  return (
    <div className="barrace">
      <div className="barrace__top">
        <button type="button" className="barrace__play" onClick={togglePlay}>
          {playing ? labels.pause || "Pause" : labels.play || "Lecture"}
        </button>
        <button type="button" className="barrace__restart" onClick={restart} aria-label={labels.restart || "Retour au début"} title={labels.restart || "Retour au début"}>
          ⟲
        </button>
        <span className="barrace__yr">{years[idx]}</span>
      </div>
      <div className="barrace__canvas" ref={elRef} />
      <span className="barrace__ghost" aria-hidden="true">
        {years[idx]}
      </span>
    </div>
  );
}