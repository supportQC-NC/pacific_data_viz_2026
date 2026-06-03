// src/components/charts/StackedCountChart.jsx
// Histogramme de « bascule » : pour chaque année, NOMBRE de territoires en
// croissance (au-dessus de 0) vs en déclin (en dessous de 0). Les colonnes
// plongent sous l'axe à mesure que le déclin gagne -> la bascule se voit.
// ApexCharts (bar empilé, valeurs +/-). Props :
//   data   : [{ year, up, down }]
//   labels : { up, down }
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { baseChart, baseGrid, baseLegend, baseXaxis, baseYaxis, baseTooltip, refLineY } from "./apexBase";

export default function StackedCountChart({ data = [], labels = {} }) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const years = data.map((d) => d.year);
    const up = data.map((d) => d.up);
    const down = data.map((d) => -d.down); // sous l'axe
    const step = Math.max(1, Math.ceil(years.length / 12));

    return {
      chart: baseChart(tk, { type: "bar", stacked: true }),
      colors: [tk.positive, tk.warm],
      series: [
        { name: labels.up || "croissance", data: up },
        { name: labels.down || "déclin", data: down },
      ],
      plotOptions: { bar: { columnWidth: "72%", borderRadius: 2 } },
      dataLabels: { enabled: false },
      legend: baseLegend(tk),
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: years,
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "10px" },
          formatter: (val, _ts, opts) => {
            const i = opts && opts.i != null ? opts.i : 0;
            return i % step === 0 ? val : "";
          },
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: {
          style: { colors: tk.textMute, fontFamily: "IBM Plex Mono", fontSize: "11px" },
          formatter: (v) => String(Math.abs(Math.round(Number(v)))),
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        y: { formatter: (v) => `${Math.abs(Number(v))}` },
      }),
      annotations: { yaxis: [refLineY(tk, 0, "", tk.lineStrong)] },
    };
  }, [data, labels, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}