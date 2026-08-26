// src/components/charts/HeatmapChart.jsx
// Heatmap territoires × années. Mode "rank" = bandes discrètes (quantiles),
// mode "abs" = dégradé continu. Tooltip = valeur réelle.
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, quantile, valAt, tooltipStyle, seqRampOf, ordRampOf, divRampOf, SANS, MONO } from "./echartsBase";

export default function HeatmapChart({
  series = [],
  years = [],
  unit = "",
  mode = "rank",
  labels = {},
  ramp: rampProp,
  // Ce que la couleur ENCODE. À déclarer explicitement pour que toutes les
  // heatmaps du produit parlent la même langue :
  //   "magnitude" → grandeur sans jugement (population, arrivées, effectifs)
  //   "stress"    → grandeur orientée, sombre = toujours pire (défaut)
  //   "polarity"  → vraie polarité autour d'un zéro qui a un sens
  //                 (anomalie vs normale). Exige mode="abs" centré sur 0 :
  //                 sur des quantiles, le milieu n'est PAS le zéro.
  kind = "stress",
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    const names = series.map((s) => s.name);
    const all = [];
    series.forEach((s) =>
      years.forEach((y) => {
        const v = valAt(s, y);
        if (Number.isFinite(v)) all.push(v);
      }),
    );
    const sorted = [...all].sort((a, b) => a - b);
    const max = sorted[sorted.length - 1] || 1;
    const data = [];
    series.forEach((s, yi) =>
      years.forEach((y, xi) => {
        const v = valAt(s, y);
        if (Number.isFinite(v)) data.push({ value: [xi, yi, Number(v.toFixed(2))] });
      }),
    );
    const useRank = mode === "rank";
    // La rampe découle de ce que la couleur ENCODE, pas du hasard de la page.
    // Polarité → divergente (centre neutre = zéro). Sinon : ordinale pour des
    // bandes discrètes (plage resserrée), séquentielle pour un dégradé continu
    // (plage complète, le bout clair vaut « ~zéro »).
    const ramp =
      Array.isArray(rampProp) && rampProp.length
        ? rampProp
        : kind === "polarity"
          ? divRampOf(tk)
          : useRank
            ? ordRampOf(tk)
            : seqRampOf(tk);
    let visualMap;
    if (useRank && sorted.length > 4) {
      const ths = [...new Set([1, 2, 3, 4, 5].map((i) => Number(quantile(sorted, i / 6).toFixed(2))))].sort(
        (a, b) => a - b,
      );
      const nb = ths.length + 1;
      const pieces = [];
      for (let i = 0; i < nb; i += 1) {
        const color = ramp[Math.round((i / (nb - 1)) * (ramp.length - 1))];
        const piece = { color };
        if (i > 0) piece.gte = ths[i - 1];
        if (i < nb - 1) piece.lt = ths[i];
        pieces.push(piece);
      }
      visualMap = {
        type: "piecewise",
        pieces,
        orient: "vertical",
        right: 8,
        top: "middle",
        itemWidth: 14,
        itemHeight: 14,
        textStyle: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
      };
    } else {
      visualMap = {
        type: "continuous",
        min: 0,
        max: Math.max(1, Math.ceil(max)),
        calculable: true,
        orient: "vertical",
        right: 8,
        top: "middle",
        itemHeight: 150,
        text: [labels.high, labels.low],
        textStyle: { color: tk.textMute, fontFamily: MONO, fontSize: 10 },
        inRange: { color: ramp },
      };
    }
    const step = Math.max(1, Math.ceil(years.length / 12));
    return {
      grid: { left: 8, right: 100, top: 12, bottom: 40, containLabel: true },
      tooltip: {
        position: "top",
        ...tooltipStyle(tk),
        formatter: (p) =>
          `${names[p.value[1]]} · ${years[p.value[0]]}<br/><strong>${fmt(p.value[2])}</strong> ${unit}`,
      },
      xAxis: {
        type: "category",
        data: years,
        splitArea: { show: false },
        axisLabel: { color: tk.textMute, fontFamily: MONO, interval: step - 1 },
        axisLine: { lineStyle: { color: tk.line } },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLabel: { color: tk.textSoft, fontFamily: SANS },
        axisLine: { lineStyle: { color: tk.line } },
        splitArea: { show: false },
      },
      visualMap,
      series: [
        {
          type: "heatmap",
          data,
          itemStyle: { borderColor: tk.bg, borderWidth: 2, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: tk.text, borderWidth: 2 } },
        },
      ],
    };
  }, [series, years, unit, mode, labels, rampProp, kind, tk]);

  return <EChart option={option} className="echart--tall" />;
}