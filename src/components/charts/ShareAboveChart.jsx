// src/components/charts/ShareAboveChart.jsx
// Part des territoires AU-DESSUS de la référence (anomalie > 0), année après
// année. Montre l'exposition qui se généralise.
//
// ── Corrections apportées lors de l'audit de l'acte 02 ────────────────────
//
// 1. i18n. Le nom de série était la chaîne française « % > réf. » codée en
//    dur dans le composant : elle apparaissait telle quelle en anglais.
//    Il passe par une prop.
//
// 2. COULEUR. L'aire utilisait `tk.warm`, un token d'INTERFACE (il encode une
//    intention, pas une donnée). Elle prend le pôle « au-dessus » de la rampe
//    divergente : le même rouge que la heatmap, la carte et les KPI de
//    l'acte. Un lecteur qui a appris « rouge = au-dessus de la normale » sur
//    ce graphique relit tous les autres sans réapprendre.
//
// 3. LISSAGE. `curve:"smooth"` interpolait entre deux années et adoucissait
//    les creux El Niño / La Niña, alors que la fiche méthode de l'acte
//    affirme « aucun lissage ». Courbe droite.
//
// 4. LECTURE. Le repère 50 % était étiqueté en gris minuscule à l'extrême
//    droite. Il est nommé, et le graphique accepte des ANNOTATIONS d'année
//    (`marks`) pour poser les bascules directement sur la courbe, plus une
//    étiquette directe sur la dernière valeur — la valeur n'est plus
//    accessible seulement au survol.
//
// Props : { series, years, name, refLabel, marks:[{year,text}], lastLabel,
//           countLabel }
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { valAt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineY, MONO } from "./apexBase";

export default function ShareAboveChart({
  series = [],
  years = [],
  name = "%",
  refLabel = "50 %",
  marks = [],
  countLabel = "",
  lastLabel = true,
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    // On garde le compte brut (n au-dessus / n total) : c'est lui qui parle,
    // le pourcentage n'en est que la mise à l'échelle.
    const rows = years.map((y) => {
      const vs = series.map((s) => valAt(s, y)).filter((v) => Number.isFinite(v));
      if (!vs.length) return { x: y, pct: null, above: 0, total: 0 };
      const above = vs.filter((v) => v > 0).length;
      return {
        x: y,
        pct: Number(((above / vs.length) * 100).toFixed(0)),
        above,
        total: vs.length,
      };
    });
    const data = rows.map((r) => ({ x: r.x, y: r.pct }));
    const last = [...rows].reverse().find((r) => r.pct != null);

    // Deux registres d'annotation, volontairement distincts :
    //
    //  • `rule: true`  -> REPÈRE DE RÉGIME. Une verticale en pointillé avec
    //    son libellé collé en haut du cadre. Posé sur la courbe, le texte
    //    passait DEVANT elle et devenait illisible ; une verticale dit
    //    « à partir d'ici » sans masquer la donnée.
    //  • sinon         -> point remarquable, étiqueté à côté du point.
    const ruleAnn = marks
      .filter((m) => m.rule && rows.some((r) => r.x === m.year))
      .map((m) => ({
        x: m.year,
        strokeDashArray: 4,
        borderColor: tk.lineStrong,
        label: {
          text: m.text,
          // EN BAS, pas en haut : la courbe plafonne à 100 % sur toute la
          // période récente, donc un libellé posé en haut du cadre tombe
          // pile dessus. Le bas du cadre est vide.
          position: "bottom",
          orientation: "horizontal",
          offsetY: -8,
          borderWidth: 0,
          style: {
            background: "transparent",
            color: tk.textMute,
            fontFamily: MONO,
            fontSize: "12px",
          },
        },
      }));

    const pointAnn = marks
      .filter((m) => !m.rule && rows.some((r) => r.x === m.year && r.pct != null))
      .map((m) => {
        const r = rows.find((x) => x.x === m.year);
        return {
          x: m.year,
          y: r.pct,
          marker: { size: 4, fillColor: tk.surface, strokeColor: tk.div9, strokeWidth: 2 },
          label: {
            text: m.text,
            borderWidth: 0,
            offsetY: m.below ? 26 : -8,
            textAnchor: "start",
            style: {
              background: "transparent",
              color: tk.textSoft,
              fontFamily: MONO,
              fontSize: "12.5px",
            },
          },
        };
      });

    if (lastLabel && last) {
      pointAnn.push({
        x: last.x,
        y: last.pct,
        marker: { size: 5, fillColor: tk.div9, strokeColor: tk.surface, strokeWidth: 2 },
        label: {
          text: `${last.pct} %`,
          borderWidth: 0,
          offsetY: -8,
          // ancré à DROITE du point : sinon l'étiquette de la dernière année
          // sort du cadre et se fait rogner.
          textAnchor: "end",
          style: {
            background: "transparent",
            color: tk.div9,
            fontFamily: MONO,
            fontSize: "14px",
          },
        },
      });
    }

    return {
      chart: baseChart(tk, { type: "area" }),
      // Pôle « au-dessus » de la rampe divergente (cf. note 2) — mais au pas
      // div-8, pas div-9.
      //
      // RÈGLE : les grands aplats prennent le pas ADOUCI, les petites marques
      // (point de dernière valeur, étiquette, filet de « à retenir ») gardent
      // le pôle vif. Une couleur saturée étalée sur un tiers de l'écran
      // agresse et fait paraître le graphique criard ; la même teinte sur un
      // point de 5 px attire l'œil exactement là où il faut. Même sémantique,
      // deux intensités selon la surface couverte.
      colors: [tk.div8],
      series: [{ name, data }],
      stroke: { curve: "straight", width: 2 },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 0.3, opacityFrom: 0.2, opacityTo: 0.02, stops: [0, 100] },
      },
      markers: { size: 0, hover: { size: 5 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      // Marge droite : le point de la dernière année et son étiquette
      // tombaient sur le bord du cadre.
      // Marge HAUTE généreuse : la courbe plafonne à 100 % sur toute la
      // période récente. Sans elle, l'étiquette de dernière valeur et le
      // libellé du repère de régime se posaient SUR la courbe.
      grid: baseGrid(tk, { padding: { left: 8, right: 26, top: 34, bottom: 2 } }),
      xaxis: baseXaxis(tk, {
        type: "numeric",
        tickAmount: Math.min(10, Math.max(2, years.length - 1)),
        decimalsInFloat: 0,
        labels: {
          style: { colors: tk.text, fontFamily: MONO, fontSize: "13.5px" },
          formatter: (v) => String(Math.round(Number(v))),
        },
      }),
      yaxis: baseYaxis(tk, {
        min: 0,
        max: 100,
        tickAmount: 4,
        labels: {
          style: { colors: tk.text, fontFamily: MONO, fontSize: "13.5px" },
          formatter: (v) => `${Math.round(Number(v))} %`,
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = rows[dataPointIndex];
          if (!r || r.pct == null) return "";
          const cnt = countLabel
            ? `<div class="apexchart__tt-row apexchart__tt-row--mute">${r.above} / ${r.total} ${countLabel}</div>`
            : "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.x}</div>
            <div class="apexchart__tt-row"><strong>${r.pct} %</strong></div>
            ${cnt}
          </div>`;
        },
      }),
      annotations: {
        yaxis: [refLineY(tk, 50, refLabel, tk.lineStrong)],
        xaxis: ruleAnn,
        points: pointAnn,
      },
    };
  }, [series, years, name, refLabel, marks, countLabel, lastLabel, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}
