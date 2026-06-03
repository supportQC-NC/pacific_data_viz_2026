// src/components/charts/RankChart.jsx
// Classement horizontal des territoires + repère médiane + couleur sémantique.
// MIGRÉ ECharts -> ApexCharts. Props inchangées (compat Acte 1 & Acte 2).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineX, MONO } from "./apexBase";

export default function RankChart({
  points = [],
  unit = "",
  median = 0,
  refLabel = "",
  sort = "desc",
  scale = "lin",
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    // ApexCharts dessine les barres horizontales du bas vers le haut :
    // pour un "desc" visuel (plus grand en haut), on trie en ascendant.
    const pts = [...points].sort((a, b) =>
      sort === "desc" ? a.value - b.value : b.value - a.value,
    );
    const colors = pts.map((p) => (p.value >= median ? tk.warm : tk.positive));

    return {
      chart: baseChart(tk, { type: "bar" }),
      colors,
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          barHeight: "62%",
          borderRadius: 4,
          borderRadiusApplication: "end",
        },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      series: [
        {
          name: unit || "valeur",
          data: pts.map((p) => ({ x: p.name, y: Number(p.value) })),
        },
      ],
      xaxis: baseXaxis(tk, {
        type: "numeric",
        logarithmic: scale === "log",
        title: { text: unit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
          formatter: (v) => fmt(Number(v), 1),
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "12px" } },
      }),
      tooltip: baseTooltip({
        y: { formatter: (v) => `${fmt(v)} ${unit}`, title: { formatter: () => "" } },
      }),
      annotations: {
        xaxis: median ? [refLineX(tk, median, refLabel, tk.accent)] : [],
      },
      states: { active: { filter: { type: "none" } } },
    };
  }, [points, unit, median, refLabel, sort, scale, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}