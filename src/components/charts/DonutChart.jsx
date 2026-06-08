// src/components/charts/DonutChart.jsx
// ============================================================
// Donut (part-to-whole) du mix électrique d'une sélection (territoire,
// région ou ensemble) pour une année. Centre = part renouvelable.
// • Couleurs sémantiques fournies par l'appelant (une par source).
// • Label % en BLANC + ombre portée → lisible sur toute couleur de part.
// • Hauteur EXPLICITE (contenue) pour ne pas déborder du conteneur.
// NB : le parent doit fournir une `key` qui change avec les filtres pour
//      forcer le remontage (ApexCharts ne rafraîchit pas fiablement un
//      donut via updateOptions quand les parts changent).
// Props : labels[], series[](GWh), colors[], unit, centerLabel, centerValue.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseLegend, baseTooltip, SANS } from "./apexBase";

export default function DonutChart({ labels = [], series = [], colors = [], unit = "", centerLabel = "", centerValue = "" }) {
  const tk = useThemeTokens();

  const option = useMemo(
    () => ({
      chart: { ...baseChart(tk, { type: "donut" }), height: 460 },
      series,
      labels,
      colors: colors.length ? colors : undefined,
      legend: {
        ...baseLegend(tk),
        formatter: (name, opts) => {
          const g = opts.w.globals;
          const v = g.series[opts.seriesIndex] || 0;
          const tot = g.series.reduce((a, b) => a + b, 0);
          const pct = tot > 0 ? Math.round((v / tot) * 100) : 0;
          return `${name} · ${pct}%`;
        },
      },
      stroke: { width: 2, colors: [tk.bg || "transparent"] },
      // % posés sur les parts d'un donut illisibles (ApexCharts ignore la
      // couleur) → on les met dans la légende. Survol = GWh exacts.
      dataLabels: { enabled: false },
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
    }),
    [labels, series, colors, unit, centerLabel, centerValue, tk],
  );

  return <ApexChart options={option} className="apexchart--donut" />;
}