// src/components/Echart/EChartLive.jsx
// ============================================================
// Wrapper ECharts INTERACTIF : comme Echart, mais expose les événements
// (clic, survol…) via `onEvents` pour faire communiquer les graphes entre eux.
// Les handlers passent par une ref → toujours frais sans re-binder.
// ============================================================
import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "./Echart.scss";

function alive(c) {
  return c && !c.isDisposed();
}

export default function EChartLive({
  option,
  className = "",
  onEvents,
  onReady,
}) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const rafRef = useRef(0);
  const evRef = useRef(onEvents);
  evRef.current = onEvents;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    const chart = echarts.init(el, null, { renderer: "canvas" });
    chartRef.current = chart;

    const fit = () => {
      if (!alive(chartRef.current)) return;
      try {
        chartRef.current.resize();
      } catch (err) {
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

    // Liaison des événements une seule fois ; dispatch via la ref.
    const names = evRef.current ? Object.keys(evRef.current) : [];
    const handlers = names.map((name) => {
      const h = (params) => {
        const fn = evRef.current && evRef.current[name];
        if (typeof fn === "function") fn(params);
      };
      chart.on(name, h);
      return h;
    });

    if (typeof onReady === "function") onReady(chart);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", fit);
      ro.disconnect();
      names.forEach((name, i) => {
        if (alive(chart)) chart.off(name, handlers[i]);
      });
      if (alive(chart)) chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!alive(chart) || !option) return;
    try {
      chart.setOption(option, true);
    } catch (err) {
      /* noop */
    }
  }, [option]);

  return <div ref={elRef} className={`echart ${className}`} />;
}
