// src/components/charts/ApexYearHeatmap.jsx
// ============================================================
// Heatmap ApexCharts TERRITOIRES × ANNÉES, pensée pour les séries
// annuelles d'anomalies ou de comptages.
//   • HAUTEUR DYNAMIQUE : rows × cellule + légende → jamais de lignes
//     coupées (le wrapper ApexChart respecte une hauteur explicite).
//   • LÉGENDE PAR TRANCHES toujours visible (colorScale.ranges nommés).
//   • Deux échelles :
//       scale="diverging"  → centrée sur 0 (sous la normale d'un côté,
//                            neutre ≈ 0, chaud/rouge au-dessus) ;
//       scale="sequential" → 0 → max (faible → élevé).
//   • COULEURS : les deux échelles sont tirées des RAMPES DU THÈME, comme
//     partout ailleurs — `divRampOf` pour la polarité, `seqRampOf` pour la
//     grandeur. Elles suivent donc la bascule clair/sombre et disent la même
//     chose que les heatmaps ECharts des escales 01 et 02.
//     Auparavant : diverging peignait un VERT ↔ ROUGE (scheme="greenRed"),
//     que ~8 % des hommes lisent comme une seule couleur — mesuré ΔE 4.1 en
//     deutéranopie ; et sequential enchaînait cinq jetons d'INTERFACE
//     (line → accent → secondary → warm → negative), un arc-en-ciel dont la
//     clarté ne suivait pas la valeur (d'où le rose vif de l'escale santé).
//     La prop `scheme`, qui servait à choisir ce dégradé escale par escale,
//     est SUPPRIMÉE : la polarité d'un indicateur n'est pas un choix de page,
//     c'est une propriété de l'indicateur.
//   • `decimals` pilote le format des bornes ET du tooltip (0 = entiers,
//     indispensable pour les comptages comme les stations météo).
// Props : series [{name, values:[{year,value}]}], years[], unit,
//         scale, decimals, labels { below, above, mid, low, high }.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { baseChart, baseTooltip, MONO, SANS, valAt } from "./apexBase";
import { divRampOf, seqRampOf } from "./echartsBase";

const ROW_H = 26; // hauteur d'une ligne (px)
const EXTRA_H = 120; // axe X + légende

export default function ApexYearHeatmap({
  series = [],
  years = [],
  unit = "",
  scale = "diverging",
  decimals = 1,
  labels = {},
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    const fmtD = (v) =>
      Number.isFinite(v)
        ? Number(v).toFixed(decimals).replace(".", ",")
        : "—";

    // Apex empile du bas vers le haut → on inverse pour garder l'ordre lu.
    const ordered = [...series].reverse();
    const apexSeries = ordered.map((s) => ({
      name: s.name,
      data: years.map((y) => {
        const v = valAt(s, y);
        return { x: String(y), y: Number.isFinite(v) ? Number(v.toFixed(Math.max(decimals, 2))) : null };
      }),
    }));

    const vals = series
      .flatMap((s) => years.map((y) => valAt(s, y)))
      .filter((v) => Number.isFinite(v));
    const eps = 1e-9;

    let ranges;
    if (scale === "diverging") {
      const m = vals.length ? Math.max(...vals.map((v) => Math.abs(v))) : 1;
      const half = m / 2;
      const near = Math.max(m * 0.08, eps);
      // Dégradé « sous la normale » : vert (acte 8) ou bleu (défaut). La tranche
      // extrême est plus profonde que la tranche modérée (comme côté chaud).
      // Rampe divergente du thème : pôle froid → neutre → pôle chaud.
      const D = divRampOf(tk);
      const belowFar = D[0];
      const belowNear = D[2];
      ranges = [
        { from: -m - eps, to: -half, color: belowFar, name: `${labels.below || "−"} · ${fmtD(-m)} → ${fmtD(-half)}` },
        { from: -half, to: -near, color: belowNear, name: `${fmtD(-half)} → ${fmtD(-near)}` },
        { from: -near, to: near, color: D[4], name: `≈ ${labels.mid || "0"}` },
        { from: near, to: half, color: D[6], name: `${fmtD(near)} → ${fmtD(half)}` },
        { from: half, to: m + eps, color: D[8], name: `${labels.above || "+"} · ${fmtD(half)} → ${fmtD(m)}` },
      ];
    } else {
      const max = vals.length ? Math.max(...vals) : 1;
      const step = max / 4 || 1;
      const cuts = [0, step, step * 2, step * 3, max + eps];
      // Rampe séquentielle du thème : une seule teinte, clair → foncé sur le
      // thème clair, foncé → clair sur le sombre. La SALIENCE suit la valeur
      // dans les deux cas — c'est l'invariant des jetons seq.
      const S = seqRampOf(tk);
      const colors = [tk.bg2, S[2], S[4], S[6], S[8]];
      ranges = cuts.slice(0, 4).map((from, i) => ({
        from: i === 0 ? -eps : from,
        to: cuts[i + 1],
        color: colors[i + 1],
        name: `${fmtD(from)} → ${fmtD(cuts[i + 1])}`,
      }));
      ranges.unshift({ from: -eps, to: eps, color: tk.bg2, name: labels.low || "0" });
    }

    // HAUTEUR : celle du PANNEAU, pas celle du contenu.
    // Elle était calculée « nombre de lignes × 26 px + 120 » : quinze
    // territoires donnaient 510 px dans un panneau de 812, soit 302 px perdus
    // — 37 % de la place, alors que des cases plus hautes se lisent mieux.
    //
    // On demande donc 100 % de la boîte. Le plancher calculé subsiste comme
    // MINIMUM : au-delà d'une vingtaine de lignes, la matrice reprend sa
    // hauteur propre et le panneau défile, plutôt que d'écraser les cases.
    const minHeight = Math.max(280, ordered.length * ROW_H + EXTRA_H);

    return {
      chart: {
        ...baseChart(tk, { type: "heatmap" }),
        height: "100%",
        __minHeight: minHeight,
        animations: { enabled: false },
      },
      series: apexSeries,
      plotOptions: {
        heatmap: {
          radius: 2,
          enableShades: false,
          useFillColorAsStroke: false,
          colorScale: { ranges },
        },
      },
      stroke: { width: 1, colors: [tk.bg] },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "bottom",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textSoft },
        markers: { width: 10, height: 10, radius: 3 },
        itemMargin: { horizontal: 8, vertical: 2 },
      },
      grid: { borderColor: "transparent", padding: { left: 8, right: 14, top: 4, bottom: 0 } },
      xaxis: {
        type: "category",
        tickAmount: Math.min(14, Math.max(2, years.length - 1)),
        axisBorder: { color: tk.line },
        axisTicks: { color: tk.line },
        labels: {
          rotate: 0,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: { style: { colors: tk.textSoft, fontFamily: SANS, fontSize: "12px" } },
      },
      tooltip: baseTooltip({
        custom: ({ seriesIndex, dataPointIndex }) => {
          const s = ordered[seriesIndex];
          const y = years[dataPointIndex];
          const v = s ? valAt(s, y) : null;
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${s ? s.name : ""} · ${y}</div>
            <div class="apexchart__tt-row"><strong>${fmtD(v)}</strong> ${unit}</div>
          </div>`;
        },
      }),
    };
  }, [series, years, unit, scale, decimals, labels, tk]);

  // Le plancher voyage jusqu'au conteneur : c'est lui qui décide de faire
  // défiler quand les lignes sont trop nombreuses pour la boîte.
  return (
    <ApexChart
      options={option}
      className="apexchart--tall"
      style={{ minHeight: option.chart.__minHeight }}
    />
  );
}