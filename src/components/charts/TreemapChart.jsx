// src/components/charts/TreemapChart.jsx
// ============================================================
// Treemap (part-to-whole) : chaque rectangle = une source d'énergie,
// surface ∝ production. Couleur sémantique fournie par node (distributed).
// Le texte de chaque tuile s'adapte au fond (foncé sur clair, blanc sur
// foncé) pour rester lisible quelle que soit la couleur de la source.
// Props : points [{ label, value, color }], unit.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseTooltip, SANS } from "./apexBase";

// Parse "#rgb" / "#rrggbb" / "rgb(r,g,b)" -> [r,g,b].
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
// Texte foncé sur fond clair, blanc sur fond foncé (luminance perçue).
function contrastText(c) {
  const [r, g, b] = toRGB(c);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.58 ? "#0a1822" : "#ffffff";
}

export default function TreemapChart({ points = [], unit = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const colors = points.map((p) => p.color || tk.accent);
    const labelColors = points.map((p) => contrastText(p.color || tk.accent));
    return {
      chart: baseChart(tk, { type: "treemap" }),
      colors,
      legend: { show: false },
      plotOptions: { treemap: { distributed: true, enableShades: false, borderRadius: 4 } },
      stroke: { width: 2, colors: [tk.bg || "transparent"] },
      dataLabels: {
        enabled: true,
        style: { fontFamily: SANS, fontSize: "12px", fontWeight: 700, colors: labelColors },
        formatter: (text, op) => [text, `${fmt(op.value)} ${unit}`],
        offsetY: -2,
      },
      series: [{ data: points.map((p) => ({ x: p.label, y: p.value })) }],
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
    };
  }, [points, unit, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}