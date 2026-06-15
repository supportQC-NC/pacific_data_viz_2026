// src/components/charts/AnomalyBandChart.jsx
// Anomalie dans le temps : ligne MOYENNE + bande min/max (dispersion entre
// territoires) + repère 0. ApexCharts (rangeArea + line).
// Traitement Acte 1 : légende en PILULES colorées cliquables (clic = masque /
// affiche une série) + tooltip custom. Idéal niveau de la mer / SST.
// Props : { series, years, unit, labels:{ dispersion, mean } }
import React, { useMemo, useState, useCallback } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import {
  fmt,
  valAt,
  baseChart,
  baseGrid,
  baseXaxis,
  baseYaxis,
  baseTooltip,
  refLineY,
} from "./apexBase";
import "./AnomalyBandChart.scss";

// Encre lisible selon la luminance du fond (YIQ).
function inkFor(hex) {
  const h = String(hex).replace("#", "");
  if (h.length < 6) return "#eef6fb";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#04121c" : "#eef6fb";
}

export default function AnomalyBandChart({
  series = [],
  years = [],
  unit = "",
  labels = {},
}) {
  const tk = useThemeTokens();
  const [hidden, setHidden] = useState({});

  const toggle = useCallback(
    (key) => setHidden((h) => ({ ...h, [key]: !h[key] })),
    [],
  );

  const items = useMemo(
    () => [
      {
        key: "dispersion",
        name: labels.dispersion || "dispersion",
        color: tk.accentDeep,
      },
      { key: "moyenne", name: labels.mean || "moyenne", color: tk.accent },
    ],
    [labels.dispersion, labels.mean, tk],
  );

  const option = useMemo(() => {
    const rows = years.map((y) => {
      const vals = series
        .map((s) => valAt(s, y))
        .filter((v) => Number.isFinite(v));
      if (!vals.length) return { year: y, mean: null, min: null, max: null };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return {
        year: y,
        mean: Number(mean.toFixed(3)),
        min: Number(Math.min(...vals).toFixed(3)),
        max: Number(Math.max(...vals).toFixed(3)),
      };
    });

    const bandData = rows.map((r) => ({
      x: r.year,
      y: hidden.dispersion || r.min == null ? null : [r.min, r.max],
    }));
    const meanData = rows.map((r) => ({
      x: r.year,
      y: hidden.moyenne ? null : r.mean,
    }));

    return {
      chart: baseChart(tk, { type: "rangeArea" }),
      colors: [tk.accentDeep, tk.accent],
      series: [
        { name: items[0].name, type: "rangeArea", data: bandData },
        { name: items[1].name, type: "line", data: meanData },
      ],
      stroke: { curve: "smooth", width: [0, 2.5] },
      fill: { opacity: [0.16, 1] },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        title: { text: unit },
        labels: {
          style: {
            colors: tk.textMute,
            fontFamily: "IBM Plex Mono",
            fontSize: "11px",
          },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = rows[dataPointIndex];
          if (!r || r.mean == null) return "";
          const meanRow = hidden.moyenne
            ? ""
            : `<div class="apexchart__tt-row">${items[1].name} <strong>${fmt(r.mean)}</strong> ${unit}</div>`;
          const bandRow = hidden.dispersion
            ? ""
            : `<div class="apexchart__tt-row">min ${fmt(r.min)} · max ${fmt(r.max)}</div>`;
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.year}</div>
            ${meanRow}${bandRow}
          </div>`;
        },
      }),
      annotations: {
        yaxis: [refLineY(tk, 0, labels.ref || "réf. 0", tk.lineStrong)],
      },
    };
  }, [series, years, unit, hidden, items, labels.ref, tk]);

  return (
    <div className="bandchart">
      <div className="bandlegend" role="group">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`bandlegend__item ${hidden[it.key] ? "is-off" : ""}`}
            onClick={() => toggle(it.key)}
            aria-pressed={!hidden[it.key]}
            ref={(el) => {
              if (el) {
                el.style.setProperty("--dot", it.color);
                el.style.setProperty("--ink", inkFor(it.color));
              }
            }}
          >
            {it.name}
          </button>
        ))}
      </div>
      <div className="bandchart__chart">
        <ApexChart options={option} className="apexchart--tall" />
      </div>
    </div>
  );
}
