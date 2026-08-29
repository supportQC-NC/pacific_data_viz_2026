// src/components/charts/DonutChart.jsx
// ============================================================
// Donut (part-to-whole) du mix électrique d'une sélection (territoire,
// région ou ensemble) pour une année. Centre = part renouvelable.
// • Couleurs sémantiques fournies par l'appelant (une par source).
// • Label % en BLANC + ombre portée → lisible sur toute couleur de part.
// • L'anneau PREND SON PANNEAU. Il avait une hauteur fixe de 460 px, héritée
//   du diaporama : dans un panneau de tableau de bord de 809 px, il laissait
//   280 px de vide sous lui et l'anneau se lisait comme une vignette. En
//   laissant `chart.height` non numérique, le wrapper y injecte la hauteur
//   réelle du conteneur.
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
      chart: { ...baseChart(tk, { type: "donut" }) },
      series,
      labels,
      colors: colors.length ? colors : undefined,
      // LA LÉGENDE PASSE SUR LE CÔTÉ. En bas, elle prenait à l'anneau la
      // hauteur qu'on venait de lui rendre — et sur un panneau presque carré
      // c'est la LARGEUR qui est en trop, pas la hauteur. À droite, chaque
      // source tient sur une ligne, et la part se lit en colonne.
      legend: {
        ...baseLegend(tk),
        position: "right",
        horizontalAlign: "center",
        offsetY: 0,
        itemMargin: { vertical: 5, horizontal: 0 },
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
            // Un anneau plus fin : c'est l'ARC qui porte la part, et le
            // centre qui porte le chiffre. Une couronne épaisse fait lire
            // des surfaces, qu'on compare mal.
            size: "68%",
            labels: {
              show: true,
              value: { show: true, fontFamily: SANS, fontSize: "26px", fontWeight: 700, color: tk.text, formatter: (v) => `${fmt(v)} ${unit}` },
              total: { show: true, showAlways: true, label: centerLabel, fontFamily: SANS, fontSize: "12px", color: tk.textSoft, formatter: () => centerValue },
            },
          },
        },
      },
      tooltip: baseTooltip({ y: { formatter: (v) => `${fmt(v)} ${unit}` } }),
      // Sous 900 px la légende latérale étrangle l'anneau plus qu'elle ne le
      // sert : elle redescend, et c'est alors la hauteur qui est en trop.
      responsive: [
        {
          breakpoint: 900,
          options: { legend: { position: "bottom", horizontalAlign: "center" } },
        },
      ],
    }),
    [labels, series, colors, unit, centerLabel, centerValue, tk],
  );

  return <ApexChart options={option} className="apexchart--donut" />;
}