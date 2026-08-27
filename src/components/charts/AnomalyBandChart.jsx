// src/components/charts/AnomalyBandChart.jsx
// Anomalie dans le temps : ligne MÉDIANE + bande min/max (dispersion entre
// territoires) + repère 0. ApexCharts (rangeArea + line).
// Traitement Acte 1 : légende en PILULES colorées cliquables (clic = masque /
// affiche une série) + tooltip custom. Idéal niveau de la mer / SST.
//
// Props : { series, years, unit, labels:{ dispersion, mean, ref }, zones,
//           uncertainty, centralTendency }
//
// ── Corrections apportées lors de l'audit de l'acte 02 ────────────────────
//
// 1. AXE DES X VIDE (bug). On passait `xaxis.type:"category"` + `categories`
//    à des séries dont les points sont des objets `{x, y}`. Dans ce cas Apex
//    ignore `categories` : les 13 graduations sortaient avec un libellé VIDE.
//    Une série de 56 ans s'affichait donc sans une seule année. On passe en
//    `type:"numeric"` — l'année est déjà portée par `x`, elle n'a jamais eu
//    besoin d'être répétée dans `categories`.
//
// 2. LISSAGE. `curve:"smooth"` interpolait entre deux années et arrondissait
//    les à-coups El Niño / La Niña. La fiche méthode de l'acte affirme
//    « aucun lissage, aucune correction » : le graphique la contredisait.
//    Courbe droite, un sommet = une année observée.
//
// 3. TENDANCE CENTRALE. La moyenne était affichée alors que les KPI et le
//    reste de l'acte raisonnent en médiane. `centralTendency` permet
//    d'aligner les deux (défaut "mean" : les appelants existants ne bougent
//    pas).
//
// 4. ZONES DE POLARITÉ (`zones`). Deux aplats très translucides tirés de la
//    rampe divergente validée : au-dessus de la référence, au-dessous. Le
//    croisement du 0 — le fait principal d'un indicateur d'anomalie —
//    devient visible sans lire l'axe. Opt-in : rien ne change ailleurs.
//
// 5. INCERTITUDE (`uncertainty`). Les points portent désormais `err`
//    (erreur type de la source, cf. pdhApi). Affichée en tooltip : une
//    anomalie de +0,1 °C assortie d'une erreur de 0,1 °C n'est pas
//    distinguable de zéro, et le lecteur doit pouvoir le savoir.
import React, { useMemo, useState, useCallback } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import {
  fmt,
  valAt,
  median as medianOf,
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

// Erreur type du territoire pour une année (null si la source n'en fournit pas).
const errAt = (serie, year) => {
  const p = serie.values.find((d) => d.year === year);
  return p && Number.isFinite(p.err) ? p.err : null;
};

export default function AnomalyBandChart({
  series = [],
  years = [],
  unit = "",
  labels = {},
  zones = false,
  uncertainty = false,
  centralTendency = "mean",
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
    const useMedian = centralTendency === "median";
    const rows = years.map((y) => {
      const vals = series
        .map((s) => valAt(s, y))
        .filter((v) => Number.isFinite(v));
      if (!vals.length) return { year: y, mid: null, min: null, max: null, err: null };
      const mid = useMedian
        ? medianOf(vals)
        : vals.reduce((a, b) => a + b, 0) / vals.length;
      // Erreur type représentative de l'année : la médiane des erreurs types
      // des territoires. On ne l'agrège pas statistiquement (ce serait une
      // reconstruction) — elle sert d'ordre de grandeur en infobulle.
      const errs = series
        .map((s) => errAt(s, y))
        .filter((v) => Number.isFinite(v));
      return {
        year: y,
        mid: Number(mid.toFixed(3)),
        min: Number(Math.min(...vals).toFixed(3)),
        max: Number(Math.max(...vals).toFixed(3)),
        err: errs.length ? Number(medianOf(errs).toFixed(2)) : null,
      };
    });

    const bandData = rows.map((r) => ({
      x: r.year,
      y: hidden.dispersion || r.min == null ? null : [r.min, r.max],
    }));
    const midData = rows.map((r) => ({
      x: r.year,
      y: hidden.moyenne ? null : r.mid,
    }));

    // Domaine Y serré sur la donnée réelle. Avant, Apex rembourrait sous le
    // minimum : ~30 % de la zone de tracé était du vide, autant de hauteur
    // perdue pour le signal.
    const all = rows.flatMap((r) => [r.min, r.max]).filter(Number.isFinite);
    const rawLo = all.length ? Math.min(...all, 0) : -1;
    const rawHi = all.length ? Math.max(...all, 0) : 1;

    // Graduations « rondes » ALIGNÉES SUR ZÉRO. Laissé à Apex, le domaine
    // brut donnait des paliers du type 1,2 / 0,8 / 0,4 / −0,1 / −0,5 : la
    // ligne de référence tombait ENTRE deux graduations, et le lecteur d'un
    // graphique d'anomalie ne pouvait pas situer le zéro à l'œil. On arrondit
    // donc les bornes à un pas rond, ce qui garantit que 0 est une graduation.
    const niceStep = (raw) => {
      const exp = Math.floor(Math.log10(Math.abs(raw) || 1));
      const base = 10 ** exp;
      return [1, 2, 2.5, 5, 10].find((m) => m * base >= raw) * base;
    };
    const step = niceStep((rawHi - rawLo) / 6);
    const lo = Math.floor(rawLo / step) * step;
    const hi = Math.ceil(rawHi / step) * step;
    const pad = 0;
    const ticks = Math.round((hi - lo) / step);

    // Zones de polarité : aplats très translucides des deux pôles de la rampe
    // divergente. Ils ne portent pas de valeur — ils disent « côté au-dessus »
    // et « côté au-dessous » — d'où l'opacité très basse.
    const zoneAnn = zones
      ? [
          { y: 0, y2: hi + pad, fillColor: tk.div9, opacity: 0.07, borderColor: "transparent" },
          { y: lo - pad, y2: 0, fillColor: tk.div1, opacity: 0.07, borderColor: "transparent" },
        ]
      : [];

    return {
      chart: baseChart(tk, { type: "rangeArea" }),
      colors: [tk.accentDeep, tk.accent],
      series: [
        { name: items[0].name, type: "rangeArea", data: bandData },
        { name: items[1].name, type: "line", data: midData },
      ],
      // Courbe droite : un sommet = une année observée (cf. note 2).
      stroke: { curve: "straight", width: [0, 2.5] },
      fill: { opacity: [0.16, 1] },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        // numeric, PAS category : l'année est portée par `x` (cf. note 1).
        type: "numeric",
        tickAmount: Math.min(10, Math.max(2, years.length - 1)),
        decimalsInFloat: 0,
        labels: {
          style: { colors: tk.text, fontFamily: "DM Mono", fontSize: "13.5px" },
          formatter: (v) => String(Math.round(Number(v))),
        },
      }),
      yaxis: baseYaxis(tk, {
        min: lo - pad,
        max: hi + pad,
        tickAmount: ticks,
        title: { text: unit },
        labels: {
          style: {
            colors: tk.text,
            fontFamily: "DM Mono",
            fontSize: "13.5px",
          },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = rows[dataPointIndex];
          if (!r || r.mid == null) return "";
          const midRow = hidden.moyenne
            ? ""
            : `<div class="apexchart__tt-row">${items[1].name} <strong>${fmt(r.mid)}</strong> ${unit}</div>`;
          const bandRow = hidden.dispersion
            ? ""
            : `<div class="apexchart__tt-row">min ${fmt(r.min)} · max ${fmt(r.max)}</div>`;
          const errRow =
            uncertainty && r.err != null
              ? `<div class="apexchart__tt-row apexchart__tt-row--mute">${labels.uncertainty || "erreur type"} ± ${fmt(r.err, 2)} ${unit}</div>`
              : "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.year}</div>
            ${midRow}${bandRow}${errRow}
          </div>`;
        },
      }),
      annotations: {
        yaxis: [
          ...zoneAnn,
          refLineY(tk, 0, labels.ref || "réf. 0", tk.lineStrong),
        ],
      },
    };
  }, [
    series,
    years,
    unit,
    hidden,
    items,
    labels.ref,
    labels.uncertainty,
    zones,
    uncertainty,
    centralTendency,
    tk,
  ]);

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
