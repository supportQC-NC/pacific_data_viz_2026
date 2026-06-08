// src/components/charts/DonutChart.jsx
// ============================================================
// Donut (part-to-whole) du mix électrique d'une sélection (territoire,
// région ou ensemble) pour une année. Centre = part renouvelable.
// • Couleurs sémantiques fournies par l'appelant (une par source).
// • Label % de chaque part en couleur ADAPTATIVE (foncé sur fond clair,
//   blanc sur fond foncé) → toujours lisible.
// • Hauteur EXPLICITE (contenue) pour ne pas déborder du conteneur.
// Props : labels[], series[](GWh), colors[], unit, centerLabel, centerValue.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseLegend, baseTooltip, SANS } from "./apexBase";

function toRGB(c) {
  if (!c) return [80, 80, 80];
  if (c[0] === "#") {
    const h = c.slice(1);
    const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    const n = parseInt(f, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/(\d+(?:\.\d+)?)/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [80, 80, 80];
}
function contrastText(c) {
  const [r, g, b] = toRGB(c);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.58 ? "#0a1822" : "#ffffff";
}

export default function DonutChart({ labels = [], series = [], colors = [], unit = "", centerLabel = "", centerValue = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const labelColors = (colors.length ? colors : labels.map(() => tk.accent)).map((c) => contrastText(c));
    return {
      chart: { ...baseChart(tk, { type: "donut" }), height: 460 },
      series,
      labels,
      colors: colors.length ? colors : undefined,
      legend: baseLegend(tk),
      stroke: { width: 2, colors: [tk.bg || "transparent"] },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Number(val).toFixed(0)}%`,
        style: { fontFamily: SANS, fontSize: "12px", fontWeight: 700, colors: labelColors },
        dropShadow: { enabled: false },
      },
      plotOptions: {
        pie: {
          donut: {
            size: "62%",
            labels: {
              show: true,
              value: { show: true, fontFamily: SANS, fontSize: "22px", fontWeight: 700, color: tk.text, formatter: (v) => `${fmt(v)} ${unit}` },
              total: { show: true, showAlways: true, label: centerLabel, fontFamily: SANS, fontSize: "13px", color: tk.textSoft, formatter: () => centerValue },
            },
          },
        },
      },
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
    };
  }, [labels, series, colors, unit, centerLabel, centerValue, tk]);

  return <ApexChart options={option} className="apexchart--donut" />;
}