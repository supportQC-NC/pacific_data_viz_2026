// src/components/charts/RadialBarsChart.jsx
// Barres RADIALES concentriques (radialBar multi-pistes) : compare quelques
// valeurs 0–100 en anneaux. Pour la synthèse : les territoires les plus
// exposés (indice composite). Props : rows [{name, value}], unit.
// NB : radialBar ne se met pas à jour via updateOptions → on remonte via key.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { apexPalette, baseChart, MONO } from "./apexBase";

export default function RadialBarsChart({ rows = [], unit = "" }) {
  const tk = useThemeTokens();
  const data = rows.filter((r) => Number.isFinite(r.value)).slice(0, 6);

  const option = useMemo(() => {
    const series = data.map((r) => Math.max(0, Math.min(100, Math.round(r.value))));
    const labels = data.map((r) => r.name);
    const colors = apexPalette(tk).slice(0, Math.max(1, series.length));
    return {
      chart: baseChart(tk, { type: "radialBar" }),
      colors,
      series,
      labels,
      plotOptions: {
        radialBar: {
          hollow: { size: "28%" },
          track: { background: tk.bg2, margin: 6 },
          dataLabels: {
            name: { fontFamily: MONO, fontSize: "12px", color: tk.textMute },
            value: { fontFamily: MONO, fontSize: "16px", color: tk.text, formatter: (v) => `${Math.round(v)}` },
            total: { show: true, label: "", color: tk.textMute, formatter: () => "" },
          },
        },
      },
      stroke: { lineCap: "round" },
      legend: { show: true, position: "bottom", fontFamily: MONO, fontSize: "11px", labels: { colors: tk.textSoft }, markers: { width: 9, height: 9, radius: 3 } },
    };
  }, [data, tk]);

  const hash = data.map((r) => `${r.name}:${Math.round(r.value)}`).join("|");
  return <ApexChart key={`radbars-${hash}`} options={option} className="apexchart--tall" />;
}