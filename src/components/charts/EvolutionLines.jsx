// src/components/charts/EvolutionLines.jsx
// « Évolution » en lignes superposées — remplace les petits multiples.
// • mode "index" (défaut) : chaque territoire indexé à 100 à sa 1re année
//   valide -> trajectoires RELATIVES comparables sur un seul axe (résout
//   l'écrasement des magnitudes très inégales).
// • mode "absolute" : valeurs brutes (l'axe se recale sur les séries visibles).
// • Légende = PILULES colorées cliquables (clic = masque/affiche -> l'axe se
//   recale, couleurs stables par territoire).
// • Tooltip TRIÉ décroissant ; la valeur absolue est toujours conservée.
// series : [{ area?, name, values:[{year, value}] }]
import React, { useMemo, useState, useCallback } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, apexPalette } from "./apexBase";
import "./EvolutionLines.scss";

// ⚠️ OBSOLÈTE — conservé uniquement pour ne pas casser les imports existants.
// C'était une palette de 18 teintes codées en dur, non validée : deux paires y
// étaient indiscernables (#6d28d9 ↔ #1d4ed8 : ΔE 0,3 en deutéranopie, cible
// ≥ 8), et les appelants la recyclaient avec `i % BRAND.length`, ce qui donnait
// la même couleur à plusieurs territoires.
//
// À la place : passer une `colorBy` explicite (voir plus bas), alimentée par la
// palette validée de _variables.scss § PALETTE DATAVIZ.
export const BRAND = [];

// Encre lisible selon la luminance du fond (YIQ).
function inkFor(hex) {
  const h = String(hex).replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#04121c" : "#eef6fb";
}

export default function EvolutionLines({
  series = [],
  years = [],
  unit = "",
  labels = {},
  mode = "index",
  // Carte { nom de série -> couleur }. À FOURNIR par la page : elle seule
  // connaît une clé d'identité stable (le code territoire) indépendante du
  // filtre courant. Sans elle, on retombe sur un repli sûr (ci-dessous).
  colorBy,
}) {
  const tk = useThemeTokens();
  const [hidden, setHidden] = useState({});

  const toggle = useCallback(
    (name) => setHidden((h) => ({ ...h, [name]: !h[name] })),
    [],
  );

  // La couleur suit l'ENTITÉ, jamais sa position dans le tableau filtré :
  // sinon masquer une série repeint toutes les autres, et un lecteur qui a
  // appris « Fidji est lavande » est trompé.
  //
  // Repli (si la page ne fournit pas `colorBy`) : au plus 8 teintes validées,
  // jamais recyclées. Au-delà de 8 séries, aucune palette catégorielle ne tient
  // — les suivantes passent en encre neutre et restent identifiables par la
  // légende cliquable et l'infobulle.
  const colorOf = useMemo(() => {
    if (colorBy) return colorBy;
    const pal = apexPalette(tk);
    const m = {};
    series.forEach((g, i) => {
      m[g.name] = i < pal.length ? pal[i] : tk.textMute;
    });
    return m;
  }, [colorBy, series, tk]);

  const visible = useMemo(
    () => series.filter((g) => !hidden[g.name]),
    [series, hidden],
  );

  const option = useMemo(() => {
    const rawAt = (g, y) => {
      const p = g.values.find((d) => d.year === y);
      return p && Number.isFinite(p.value) ? p.value : null;
    };
    // Base d'indexation : 1re valeur finie > 0.
    const baseOf = (g) => {
      for (let i = 0; i < years.length; i += 1) {
        const v = rawAt(g, years[i]);
        if (v != null && v > 0) return v;
      }
      return null;
    };

    const absMap = {};
    const series2 = visible.map((g) => {
      const abs = years.map((y) => rawAt(g, y));
      absMap[g.name] = abs;
      if (mode === "index") {
        const b = baseOf(g);
        const data = abs.map((v) =>
          v != null && b ? Number(((v / b) * 100).toFixed(1)) : null,
        );
        return { name: g.name, data };
      }
      return {
        name: g.name,
        data: abs.map((v) => (v != null ? Number(v) : null)),
      };
    });
    const colors = visible.map((g) => colorOf[g.name]);

    const yFmt =
      mode === "index" ? (v) => fmt(Number(v), 0) : (v) => fmt(Number(v), 1);

    return {
      chart: baseChart(tk, {
        type: "line",
        animations: { enabled: true, speed: 500 },
      }),
      colors,
      stroke: { curve: "smooth", width: 2, lineCap: "round" },
      fill: { type: "solid", opacity: 1 },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 5 } },
      legend: { show: false },
      grid: baseGrid(tk),
      series: series2,
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
          formatter: yFmt,
        },
      }),
      annotations:
        mode === "index"
          ? {
              yaxis: [
                {
                  y: 100,
                  borderColor: tk.lineStrong,
                  strokeDashArray: 4,
                  label: {
                    text: labels.base || "base 100",
                    position: "left",
                    textAnchor: "start",
                    offsetX: 4,
                    style: {
                      background: "transparent",
                      color: tk.textMute,
                      fontFamily: "IBM Plex Mono",
                      fontSize: "10px",
                    },
                  },
                },
              ],
            }
          : {},
      tooltip: {
        shared: true,
        intersect: false,
        custom: ({ series: s, dataPointIndex, w }) => {
          const year =
            years[dataPointIndex] != null ? years[dataPointIndex] : "";
          const rows = (w.globals.seriesNames || [])
            .map((nm, i) => ({
              name: nm,
              plotted: s[i] ? s[i][dataPointIndex] : null,
              abs: absMap[nm] ? absMap[nm][dataPointIndex] : null,
              color: (w.globals.colors && w.globals.colors[i]) || tk.accent,
            }))
            .filter((r) => Number.isFinite(r.plotted))
            .sort((a, b) => b.plotted - a.plotted);
          const items = rows
            .map((r) => {
              const main =
                mode === "index"
                  ? fmt(r.plotted, 0)
                  : `${fmt(r.plotted, 1)} ${unit}`;
              const sub =
                mode === "index" && r.abs != null
                  ? `<span style="color:${tk.textMute};margin-left:6px;">${fmt(r.abs, 1)} ${unit}</span>`
                  : "";
              return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;">
                <span style="width:9px;height:9px;border-radius:3px;background:${r.color};flex:none;"></span>
                <span style="flex:1;white-space:nowrap;color:${tk.textSoft};">${r.name}</span>
                <span style="font-weight:600;color:${tk.text};white-space:nowrap;">${main}${sub}</span>
              </div>`;
            })
            .join("");
          return `<div style="padding:10px 12px;background:${tk.bg2};border:1px solid ${tk.line};border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:11px;min-width:230px;max-height:340px;overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,0.45);">
            <div style="color:${tk.textMute};margin-bottom:6px;letter-spacing:0.08em;">${year}</div>${items}</div>`;
        },
      },
    };
  }, [visible, years, unit, mode, colorOf, labels.base, tk]);

  return (
    <div className="evolines">
      <div className="evolegend" role="group">
        {series.map((g) => {
          const color = colorOf[g.name];
          return (
            <button
              key={g.name}
              type="button"
              className={`evolegend__item ${hidden[g.name] ? "is-off" : ""}`}
              onClick={() => toggle(g.name)}
              aria-pressed={!hidden[g.name]}
              ref={(el) => {
                if (el) {
                  el.style.setProperty("--dot", color);
                  el.style.setProperty("--ink", inkFor(color));
                }
              }}
            >
              {g.name}
            </button>
          );
        })}
      </div>
      <div className="evolines__chart">
        <ApexChart options={option} className="apexchart--tall" />
      </div>
    </div>
  );
}
