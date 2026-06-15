// src/components/charts/RiverChart.jsx
// Aire EMPILÉE lissée (baseline 0) — un territoire par bande.
// • Palette de marque (famille froide cyan), alternance clair/foncé.
// • Légende en PILULES cliquables (façon onglets) : un clic masque/affiche
//   une bande (on met ses valeurs à 0 → couleurs stables, survit aux re-renders).
// • Tooltip custom TRIÉ : plus gros émetteur en haut, plus petit en bas.
// subAvg : [{ area?, name, values:[{year, value}] }]
import React, { useMemo, useState, useCallback } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis } from "./apexBase";
import "./RiverChart.scss";

// Palette de marque : famille FROIDE (cyan primaire → teals/bleus/verts/violets),
// ordonnée en alternant clair/foncé pour un contraste lisible entre bandes.
const BRAND = [
  "#0e7490",
  "#67e8f9",
  "#0d9488",
  "#5eead4",
  "#1d4ed8",
  "#93c5fd",
  "#15803d",
  "#86efac",
  "#6d28d9",
  "#c4b5fd",
  "#0891b2",
  "#a5f3fc",
  "#0f766e",
  "#99f6e4",
  "#2563eb",
  "#bfdbfe",
  "#16a34a",
  "#4ade80",
];

export default function RiverChart({
  subAvg = [],
  years = [],
  colors,
  compactLegend = false,
}) {
  const tk = useThemeTokens();
  const [hidden, setHidden] = useState({});

  const palette = colors && colors.length ? colors : BRAND;
  const toggle = useCallback(
    (name) => setHidden((h) => ({ ...h, [name]: !h[name] })),
    [],
  );

  const option = useMemo(() => {
    const at = (grp, y) => {
      const p = grp.values.find((d) => d.year === y);
      return p && Number.isFinite(p.value) ? Number(p.value.toFixed(3)) : 0;
    };
    const series = subAvg.map((g) => ({
      name: g.name,
      data: hidden[g.name] ? years.map(() => 0) : years.map((y) => at(g, y)),
    }));

    return {
      chart: baseChart(tk, { type: "area", stacked: true }),
      colors: palette,
      stroke: { curve: "smooth", width: 1 },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0.45,
          opacityFrom: 0.62,
          opacityTo: 0.28,
          stops: [0, 100],
        },
      },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 4 } },
      legend: { show: false },
      grid: baseGrid(tk),
      series,
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        tickAmount: Math.min(12, Math.max(2, years.length - 1)),
      }),
      yaxis: baseYaxis(tk, {
        labels: {
          style: {
            colors: tk.textMute,
            fontFamily: "IBM Plex Mono",
            fontSize: "11px",
          },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: {
        shared: true,
        intersect: false,
        // Tooltip TRIÉ décroissant : plus gros émetteur en haut.
        custom: ({ series: s, dataPointIndex, w }) => {
          const year =
            years[dataPointIndex] != null ? years[dataPointIndex] : "";
          const rows = (w.globals.seriesNames || [])
            .map((nm, i) => ({
              name: nm,
              value: s[i] ? s[i][dataPointIndex] : 0,
              color: (w.globals.colors && w.globals.colors[i]) || tk.accent,
            }))
            .filter((r) => Number.isFinite(r.value) && !hidden[r.name])
            .sort((a, b) => b.value - a.value);
          const items = rows
            .map(
              (r) =>
                `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;">
                  <span style="width:9px;height:9px;border-radius:3px;background:${r.color};flex:none;"></span>
                  <span style="flex:1;white-space:nowrap;color:${tk.textSoft};">${r.name}</span>
                  <span style="font-weight:600;color:${tk.text};">${fmt(r.value)}</span>
                </div>`,
            )
            .join("");
          return `<div style="padding:10px 12px;background:${tk.bg2};border:1px solid ${tk.line};border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;min-width:210px;max-height:340px;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,0.45);">
            <div style="color:${tk.textMute};margin-bottom:6px;letter-spacing:0.08em;">${year}</div>${items}</div>`;
        },
      },
    };
  }, [subAvg, years, palette, hidden, tk]);

  return (
    <div className="riverchart">
      <div
        className={`riverlegend ${compactLegend ? "riverlegend--dense" : ""}`}
        role="group"
      >
        {subAvg.map((g, i) => (
          <button
            key={g.name}
            type="button"
            className={`riverlegend__item ${hidden[g.name] ? "is-off" : ""}`}
            onClick={() => toggle(g.name)}
            aria-pressed={!hidden[g.name]}
          >
            <span
              className="riverlegend__dot"
              ref={(el) => {
                if (el)
                  el.style.setProperty("--dot", palette[i % palette.length]);
              }}
            />
            <span className="riverlegend__name">{g.name}</span>
          </button>
        ))}
      </div>
      <div className="riverchart__chart">
        <ApexChart options={option} className="apexchart--tall" />
      </div>
    </div>
  );
}
