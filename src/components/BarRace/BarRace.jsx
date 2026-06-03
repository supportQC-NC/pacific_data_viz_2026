// src/components/BarRace/BarRace.jsx
// ============================================================
// Course de barres animée (ECharts realtimeSort) : le classement des
// émissions par habitant se réordonne année après année. Autonome : gère
// sa propre instance ECharts, le minuteur, lecture/pause/rejouer.
// Couleurs liées à la charte (prop `tk`). Dépendance : echarts.
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as echarts from "echarts";
import { FiPlay, FiPause } from "react-icons/fi";
import "./BarRace.scss";

export default function BarRace({
  series,
  years,
  unit = "",
  tk = {},
  labels = {},
  topN = 10,
  tickMs = 850,
}) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const idxRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [year, setYear] = useState(years[0] ?? null);

  const palette = [tk.accent, tk.warm, tk.secondary, tk.positive, tk.accentDeep, tk.negative];
  const colorOf = (i) => palette[i % palette.length] || tk.accent;
  const valAt = (s, y) => {
    const p = s.values.find((d) => d.year === y);
    return p ? p.value : 0;
  };

  const frame = useCallback(
    (yi) => {
      const y = years[yi];
      return {
        series: [
          {
            type: "bar",
            data: series.map((s, i) => ({
              value: Number(valAt(s, y).toFixed(2)),
              itemStyle: { color: colorOf(i), borderRadius: [0, 4, 4, 0] },
            })),
          },
        ],
        graphic: { elements: [{ style: { text: String(y) } }] },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, years, tk],
  );

  // Init / ré-init (changement de données filtrées ou de thème)
  useEffect(() => {
    if (!elRef.current || !series.length || !years.length) return undefined;
    const chart = chartRef.current || echarts.init(elRef.current, null, { renderer: "canvas" });
    chartRef.current = chart;
    const names = series.map((s) => s.name);
    const y0 = years[idxRef.current] ?? years[0];
    chart.setOption(
      {
        grid: { left: 8, right: 72, top: 12, bottom: 24, containLabel: true },
        xAxis: {
          max: "dataMax",
          axisLabel: { color: tk.textMute, fontFamily: "IBM Plex Mono", formatter: (v) => Number(v).toFixed(0) },
          splitLine: { lineStyle: { color: tk.line } },
        },
        yAxis: {
          type: "category",
          data: names,
          inverse: true,
          max: Math.min(topN, names.length) - 1,
          axisLabel: { color: tk.textSoft, fontFamily: "Hanken Grotesk" },
          axisLine: { lineStyle: { color: tk.line } },
          axisTick: { show: false },
          animationDuration: 300,
          animationDurationUpdate: 300,
        },
        series: [
          {
            realtimeSort: true,
            type: "bar",
            data: series.map((s, i) => ({
              value: Number(valAt(s, y0).toFixed(2)),
              itemStyle: { color: colorOf(i), borderRadius: [0, 4, 4, 0] },
            })),
            label: {
              show: true,
              position: "right",
              valueAnimation: true,
              fontFamily: "IBM Plex Mono",
              color: tk.textSoft,
              formatter: (p) => `${Number(p.value).toFixed(1)} ${unit}`,
            },
          },
        ],
        legend: { show: false },
        animationDuration: 0,
        animationDurationUpdate: tickMs,
        animationEasing: "linear",
        animationEasingUpdate: "linear",
        graphic: {
          elements: [
            {
              type: "text",
              right: 56,
              bottom: 28,
              z: 100,
              style: {
                text: String(y0),
                fontSize: 60,
                fontFamily: "Fraunces, serif",
                fontWeight: 600,
                fill: tk.textMute,
                opacity: 0.55,
              },
            },
          ],
        },
      },
      true,
    );
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, years, tk, topN, tickMs, unit]);

  // Démontage : dispose
  useEffect(
    () => () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    },
    [],
  );

  // Minuteur
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      idxRef.current += 1;
      if (idxRef.current >= years.length) idxRef.current = 0; // boucle infinie
      if (chartRef.current) chartRef.current.setOption(frame(idxRef.current));
      setYear(years[idxRef.current]);
    }, tickMs);
    return () => clearInterval(id);
  }, [playing, years, frame, tickMs]);

  const toggle = () => setPlaying((p) => !p);

  const label = playing ? labels.pause : labels.play;
  const Icon = playing ? FiPause : FiPlay;

  return (
    <div className="barrace">
      <div className="barrace__ctrl">
        <button type="button" className="barrace__btn" onClick={toggle}>
          <Icon aria-hidden="true" /> {label}
        </button>
        <span className="barrace__year">{year}</span>
      </div>
      <div ref={elRef} className="barrace__canvas" aria-hidden="true" />
    </div>
  );
}