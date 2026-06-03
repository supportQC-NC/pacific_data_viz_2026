// src/components/charts/ChangeChart.jsx
// Variation entre la première et la dernière année (barres divergentes).
// MIGRÉ ECharts -> ApexCharts. Props inchangées.
// rows : [{ name, delta }]
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineX, MONO } from "./apexBase";

export default function ChangeChart({ rows = [], unit = "", direction = "all" }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    let r = [...rows];
    if (direction === "up") r = r.filter((x) => x.delta > 0);
    if (direction === "down") r = r.filter((x) => x.delta < 0);
    // ApexCharts empile du bas vers le haut : tri ascendant -> plus négatif en bas.
    r.sort((a, b) => a.delta - b.delta);

    const colors = r.map((x) => (x.delta <= 0 ? tk.positive : tk.warm));

    return {
      chart: baseChart(tk, { type: "bar" }),
      colors,
      plotOptions: {
        bar: { horizontal: true, distributed: true, barHeight: "60%", borderRadius: 3 },
      },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      series: [
        { name: unit || "Δ", data: r.map((x) => ({ x: x.name, y: Number(x.delta) })) },
      ],
      xaxis: baseXaxis(tk, {
        type: "numeric",
        title: { text: unit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
          formatter: (v) => `${Number(v) > 0 ? "+" : ""}${fmt(Number(v), 1)}`,
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: "Hanken Grotesk", fontSize: "12px" } },
      }),
      tooltip: baseTooltip({
        y: {
          formatter: (v) => `${v > 0 ? "+" : ""}${fmt(v)} ${unit}`,
          title: { formatter: () => "" },
        },
      }),
      annotations: { xaxis: [refLineX(tk, 0, "", tk.lineStrong)] },
      states: { active: { filter: { type: "none" } } },
    };
  }, [rows, unit, direction, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}