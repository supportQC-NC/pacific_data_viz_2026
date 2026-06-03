// src/components/BarRace/BarRace.jsx
// ============================================================
// Course de barres animée (ECharts realtimeSort).
//   • HAUTEUR FORCÉE EN JS en mode diaporama (~74% de l'écran) → ne déborde
//     jamais, indépendamment du CSS. Sinon suit le conteneur.
//   • Démarre seul et BOUCLE. Bouton lecture/pause. Année en filigrane.
// Props : series [{name, values:[{year,value}]}], years [], unit, tk, labels.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import "./BarRace.scss";

const MONO = "IBM Plex Mono";
const SANS = "Hanken Grotesk";
const TICK = 900;

function targetHeight(el) {
  const inDeck = el && el.closest && el.closest(".act1viz__chart");
  if (inDeck) return Math.max(240, Math.round(window.innerHeight * 0.74));
  return el && el.clientHeight ? el.clientHeight : 420;
}

export default function BarRace({ series = [], years = [], unit = "", tk = {}, labels = {} }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const idxRef = useRef(0);
  const playingRef = useRef(true);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

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
            formatter: (p) => ` ${Number(p.value).toFixed(1)} ${unit}`,
          },
        },
      ],
      animationDuration: 0,
      animationDurationUpdate: TICK,
      animationEasing: "linear",
      animationEasingUpdate: "linear",
    });

    const fit = () => {
      if (!chartRef.current) return;
      try {
        chartRef.current.resize({ height: targetHeight(el) });
      } catch (e) {
        /* noop */
      }
    };

    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(fit);
    });
    ro.observe(el);
    window.addEventListener("resize", fit);
    fit();

    const timer = setInterval(() => {
      if (!playingRef.current) return;
      const ni = (idxRef.current + 1) % years.length;
      idxRef.current = ni;
      setIdx(ni);
      chart.setOption({ series: [{ id: "race", data: valuesFor(ni) }] });
    }, TICK);

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", fit);
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [series, years, unit, tk]);

  return (
    <div className="barrace">
      <div className="barrace__top">
        <button
          type="button"
          className="barrace__play"
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? labels.pause || "Pause" : labels.play || "Lecture"}
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