// src/components/charts/RadialGauge.jsx
// Jauge radiale (ApexCharts radialBar) — affiche un POURCENTAGE marquant au
// centre, dégradé. Idéal pour un KPI « part de … » réactif au curseur.
// Props : value (0–100), label, color (défaut tk.positive).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { baseChart, MONO } from "./apexBase";

export default function RadialGauge({ value = 0, label = "", color }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const main = color || tk.positive;
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    return {
      chart: baseChart(tk, { type: "radialBar", sparkline: { enabled: false } }),
      colors: [main],
      series: [v],
      labels: [label],
      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 135,
          hollow: { size: "58%" },
          track: { background: tk.bg2, strokeWidth: "100%", margin: 6 },
          dataLabels: {
            name: { show: true, color: tk.textMute, fontFamily: MONO, fontSize: "13px", offsetY: 26 },
            value: {
              show: true,
              color: tk.text,
              fontFamily: MONO,
              fontSize: "46px",
              fontWeight: 700,
              offsetY: -6,
              formatter: (val) => `${Math.round(val)} %`,
            },
          },
        },
      },
      fill: {
        type: "gradient",
        gradient: { shade: "dark", type: "horizontal", gradientToColors: [tk.accent], stops: [0, 100] },
      },
      stroke: { lineCap: "round" },
    };
  }, [value, label, color, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}