// src/components/charts/HeatmapChart.jsx
// Heatmap territoires × années. Mode "rank" = bandes discrètes (quantiles),
// mode "abs" = dégradé continu. Tooltip = valeur réelle.
//
// ── Corrections apportées lors de l'audit de l'acte 02 ────────────────────
//
// 1. LÉGENDE ILLISIBLE (bug). En mode "rank" les bornes de quantiles étaient
//    laissées à ECharts, qui les rendait avec sa précision par défaut : la
//    légende affichait « 0 - 0 » DEUX FOIS, puis « -0 - 0 » et « < -0 ».
//    Les libellés sont désormais formatés explicitement, avec un nombre de
//    décimales déduit de l'ÉTENDUE des données (une série d'anomalies
//    comprise entre −0,4 et +1,1 a besoin de 2 décimales, pas de 0).
//
// 2. `labels.low` / `labels.high` IGNORÉS en mode discret. Ils n'étaient lus
//    que par la branche continue : les pages les passaient, sans effet.
//    Ils encadrent maintenant la légende dans les deux modes.
//
// 3. ÉCHELLE POLAIRE NON CENTRÉE. `kind:"polarity"` demandait bien la rampe
//    divergente, mais la branche continue fixait le domaine à `[0, max]` :
//    le gris neutre ne tombait donc PAS sur zéro et le signe de l'anomalie
//    restait illisible. Le domaine est maintenant SYMÉTRIQUE autour de zéro
//    quand la couleur encode une polarité — c'est la seule façon que le pas
//    central signifie « à la normale ».
//
// 4. LIGNES NON ORDONNÉES. L'ordre des territoires était celui d'arrivée de
//    l'API. Une matrice dont les lignes ne sont triées par rien perd son
//    principal pouvoir : faire apparaître des groupes. `order` permet de
//    trier (défaut "none" : les appelants existants ne bougent pas).
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import EChart from "../Echart/Echart";
import { fmt, quantile, valAt, tooltipStyle, seqRampOf, ordRampOf, divRampOf, SANS, MONO, AXIS_FS } from "./echartsBase";

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
  //                 (anomalie vs normale). Impose un domaine SYMÉTRIQUE
  //                 centré sur 0 ; à utiliser avec mode="abs".
  kind = "stress",
  // Ordre des lignes : "none" (arrivée de l'API) · "last" (valeur de la
  // dernière année disponible) · "mean" (moyenne de la série).
  order = "none",
}) {
  const tk = useThemeTokens();
  const option = useMemo(() => {
    // --- Ordre des lignes ---------------------------------------------------
    const scoreOf = (s) => {
      const vals = years.map((y) => valAt(s, y)).filter(Number.isFinite);
      if (!vals.length) return -Infinity;
      if (order === "mean") return vals.reduce((a, b) => a + b, 0) / vals.length;
      return vals[vals.length - 1];
    };
    // ECharts empile l'axe catégoriel du BAS vers le haut : tri ascendant
    // pour que la plus forte valeur se retrouve en haut de la matrice.
    const rows =
      order === "none" ? series : [...series].sort((a, b) => scoreOf(a) - scoreOf(b));

    const names = rows.map((s) => s.name);
    const all = [];
    rows.forEach((s) =>
      years.forEach((y) => {
        const v = valAt(s, y);
        if (Number.isFinite(v)) all.push(v);
      }),
    );
    const sorted = [...all].sort((a, b) => a - b);
    const max = sorted[sorted.length - 1] || 1;
    const min = sorted[0] ?? 0;
    const data = [];
    rows.forEach((s, yi) =>
      years.forEach((y, xi) => {
        const v = valAt(s, y);
        if (Number.isFinite(v)) data.push({ value: [xi, yi, Number(v.toFixed(2))] });
      }),
    );
    const useRank = mode === "rank";
    const isPolarity = kind === "polarity";

    // Décimales déduites de l'étendue : une échelle de 1,5 °C n'a aucun sens
    // affichée en entiers (c'est ce qui produisait « 0 - 0 »).
    const span = Math.abs(max - min);
    const dec = span >= 100 ? 0 : span >= 10 ? 1 : 2;
    const lab = (v) => fmt(Number(v), dec);

    // La rampe découle de ce que la couleur ENCODE, pas du hasard de la page.
    const ramp =
      Array.isArray(rampProp) && rampProp.length
        ? rampProp
        : isPolarity
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
        // Libellé explicite (cf. note 1) : ECharts formatait « 0 - 0 ».
        if (i === 0) piece.label = `< ${lab(ths[0])}`;
        else if (i === nb - 1) piece.label = `≥ ${lab(ths[ths.length - 1])}`;
        else piece.label = `${lab(ths[i - 1])} → ${lab(ths[i])}`;
        pieces.push(piece);
      }
      visualMap = {
        type: "piecewise",
        pieces,
        orient: "vertical",
        right: 8,
        top: "middle",
        itemWidth: 16,
        itemHeight: 16,
        // Les bornes vont du plus fort (en haut) au plus faible : on encadre
        // avec les libellés de la page, jusqu'ici inutilisés en mode discret.
        text: [labels.high, labels.low],
        // La légende est le SEUL décodeur de la couleur sur une heatmap :
        // à 10 px en encre sourde, la matrice devenait indéchiffrable.
        textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: AXIS_FS },
      };
    } else {
      // Domaine SYMÉTRIQUE si la couleur encode une polarité (cf. note 3) :
      // sans cela le pas central de la rampe divergente ne tombe pas sur 0
      // et ne peut pas signifier « à la normale ».
      const bound = Math.max(Math.abs(min), Math.abs(max)) || 1;
      visualMap = {
        type: "continuous",
        min: isPolarity ? -bound : 0,
        max: isPolarity ? bound : Math.max(1, Math.ceil(max)),
        calculable: true,
        orient: "vertical",
        right: 8,
        top: "middle",
        itemHeight: 170,
        itemWidth: 18,
        text: [labels.high, labels.low],
        textStyle: { color: tk.textSoft, fontFamily: MONO, fontSize: AXIS_FS },
        formatter: (v) => `${Number(v) > 0 ? "+" : ""}${lab(v)}`,
        inRange: { color: ramp },
      };
    }
    const step = Math.max(1, Math.ceil(years.length / 12));
    return {
      // Marge droite élargie : la légende de valeurs a grandi.
      grid: { left: 8, right: 124, top: 12, bottom: 40, containLabel: true },
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
        axisLabel: { color: tk.textSoft, fontFamily: MONO, fontSize: AXIS_FS, interval: step - 1 },
        axisLine: { lineStyle: { color: tk.line } },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLabel: { color: tk.textSoft, fontFamily: SANS, fontSize: AXIS_FS },
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
  }, [series, years, unit, mode, labels, rampProp, kind, order, tk]);

  return <EChart option={option} className="echart--tall" />;
}
