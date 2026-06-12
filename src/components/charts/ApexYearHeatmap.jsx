// src/components/charts/ApexYearHeatmap.jsx
// ============================================================
// Heatmap ApexCharts TERRITOIRES × ANNÉES, pensée pour les séries
// annuelles d'anomalies ou de comptages.
//   • HAUTEUR DYNAMIQUE : rows × cellule + légende → jamais de lignes
//     coupées (le wrapper ApexChart respecte une hauteur explicite).
//   • LÉGENDE PAR TRANCHES toujours visible (colorScale.ranges nommés).
//   • Deux échelles :
//       scale="diverging"  → centrée sur 0 (sous la normale d'un côté,
//                            neutre ≈ 0, chaud/rouge au-dessus) ;
//       scale="sequential" → 0 → max (faible → élevé).
//   • `scheme` pilote le DÉGRADÉ « sous la normale » de l'échelle diverging :
//       "blueRed"  (défaut) → bleu sous / rouge au-dessus (acte 6, etc.) ;
//       "greenRed"          → vert sous / rouge au-dessus (acte 8 « ciel »).
//     L'axe chaud (au-dessus) reste corail→rouge dans les deux cas.
//   • `decimals` pilote le format des bornes ET du tooltip (0 = entiers,
//     indispensable pour les comptages comme les stations météo).
// Props : series [{name, values:[{year,value}]}], years[], unit,
//         scale, scheme, decimals, labels { below, above, mid, low, high }.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { baseChart, baseTooltip, MONO, SANS, valAt } from "./apexBase";

const ROW_H = 26; // hauteur d'une ligne (px)
const EXTRA_H = 120; // axe X + légende

// --- Mélange de teintes depuis les tokens (dérive un « vert profond » propre
//     pour la tranche extrême, sans couleur de marque en dur). ---
function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}
function mixHex(h1, h2, t) {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  if (!a || !b) return null;
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
}

export default function ApexYearHeatmap({
  series = [],
  years = [],
  unit = "",
  scale = "diverging",
  scheme = "blueRed",
  decimals = 1,
  labels = {},
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const fmtD = (v) =>
      Number.isFinite(v)
        ? Number(v).toFixed(decimals).replace(".", ",")
        : "—";

    // Apex empile du bas vers le haut → on inverse pour garder l'ordre lu.
    const ordered = [...series].reverse();
    const apexSeries = ordered.map((s) => ({
      name: s.name,
      data: years.map((y) => {
        const v = valAt(s, y);
        return { x: String(y), y: Number.isFinite(v) ? Number(v.toFixed(Math.max(decimals, 2))) : null };
      }),
    }));

    const vals = series
      .flatMap((s) => years.map((y) => valAt(s, y)))
      .filter((v) => Number.isFinite(v));
    const eps = 1e-9;

    let ranges;
    if (scale === "diverging") {
      const m = vals.length ? Math.max(...vals.map((v) => Math.abs(v))) : 1;
      const half = m / 2;
      const near = Math.max(m * 0.08, eps);
      // Dégradé « sous la normale » : vert (acte 8) ou bleu (défaut). La tranche
      // extrême est plus profonde que la tranche modérée (comme côté chaud).
      const belowFar = scheme === "greenRed" ? mixHex(tk.positive, tk.bg, 0.28) || tk.positive : tk.accentDeep;
      const belowNear = scheme === "greenRed" ? tk.positive : tk.accent;
      ranges = [
        { from: -m - eps, to: -half, color: belowFar, name: `${labels.below || "−"} · ${fmtD(-m)} → ${fmtD(-half)}` },
        { from: -half, to: -near, color: belowNear, name: `${fmtD(-half)} → ${fmtD(-near)}` },
        { from: -near, to: near, color: tk.line, name: `≈ ${labels.mid || "0"}` },
        { from: near, to: half, color: tk.warm, name: `${fmtD(near)} → ${fmtD(half)}` },
        { from: half, to: m + eps, color: tk.negative, name: `${labels.above || "+"} · ${fmtD(half)} → ${fmtD(m)}` },
      ];
    } else {
      const max = vals.length ? Math.max(...vals) : 1;
      const step = max / 4 || 1;
      const cuts = [0, step, step * 2, step * 3, max + eps];
      const colors = [tk.line, tk.accent, tk.secondary, tk.warm, tk.negative];
      ranges = cuts.slice(0, 4).map((from, i) => ({
        from: i === 0 ? -eps : from,
        to: cuts[i + 1],
        color: colors[i + 1],
        name: `${fmtD(from)} → ${fmtD(cuts[i + 1])}`,
      }));
      ranges.unshift({ from: -eps, to: eps, color: tk.line, name: labels.low || "0" });
    }

    const height = Math.max(280, ordered.length * ROW_H + EXTRA_H);

    return {
      chart: {
        ...baseChart(tk, { type: "heatmap" }),
        height,
        animations: { enabled: false },
      },
      series: apexSeries,
      plotOptions: {
        heatmap: {
          radius: 2,
          enableShades: false,
          useFillColorAsStroke: false,
          colorScale: { ranges },
        },
      },
      stroke: { width: 1, colors: [tk.bg] },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "bottom",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textSoft },
        markers: { width: 10, height: 10, radius: 3 },
        itemMargin: { horizontal: 8, vertical: 2 },
      },
      grid: { borderColor: "transparent", padding: { left: 8, right: 14, top: 4, bottom: 0 } },
      xaxis: {
        type: "category",
        tickAmount: Math.min(14, Math.max(2, years.length - 1)),
        axisBorder: { color: tk.line },
        axisTicks: { color: tk.line },
        labels: {
          rotate: 0,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: { style: { colors: tk.textSoft, fontFamily: SANS, fontSize: "12px" } },
      },
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex }) => {
          const s = ordered[seriesIndex];
          const y = years[dataPointIndex];
          const v = s ? valAt(s, y) : null;
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${s ? s.name : ""} · ${y}</div>
            <div class="apexchart__tt-row"><strong>${fmtD(v)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [series, years, unit, scale, scheme, decimals, labels, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}