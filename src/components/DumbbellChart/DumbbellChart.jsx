// // src/components/DumbbellChart/DumbbellChart.jsx
// // ============================================================
// // Comparaison AVANT / APRÈS : un « haltère » par territoire, reliant la
// // valeur de l'année A (point creux) à celle de l'année B (point plein).
// // Échelle partagée → on compare les niveaux d'un coup d'œil ; couleur du
// // trait selon la direction (hausse = accent, baisse = chaud).
// // Barres/positions en SVG (aucun style inline). Couleurs via tokens.
// // Props :
// //   rows    : [{ area, name, a, b }]  (a = année A, b = année B)
// //   yearA   : number
// //   yearB   : number
// //   unit    : string
// //   labels  : { up, down } (optionnel, pour le pied de légende)
// //   controls: node (sélecteurs d'années, rendus au-dessus)
// // ============================================================

// import React, { useMemo } from "react";
// import "./DumbbellChart.scss";

// function fmt(v) {
//   if (v == null || Number.isNaN(v)) return "—";
//   return Math.round(v).toLocaleString("fr-FR");
// }

// export default function DumbbellChart({ rows, yearA, yearB, unit, labels = {}, controls = null }) {
//   const { data, min, max } = useMemo(() => {
//     const valid = (rows || []).filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
//     const all = valid.flatMap((r) => [r.a, r.b]);
//     const mn = all.length ? Math.min(...all) : 0;
//     const mx = all.length ? Math.max(...all) : 1;
//     const sorted = [...valid].sort((x, y) => y.b - x.b);
//     return { data: sorted, min: mn, max: mx };
//   }, [rows]);

//   if (!data.length) return null;
//   const span = max - min || 1;
//   const x = (v) => 2 + ((v - min) / span) * 96;

//   return (
//     <div className="dumbbell">
//       {controls && <div className="dumbbell__controls">{controls}</div>}

//       <div className="dumbbell__legend">
//         <span className="dumbbell__leg-item">
//           <span className="dumbbell__leg-dot dumbbell__leg-dot--a" /> {yearA}
//         </span>
//         <span className="dumbbell__leg-item">
//           <span className="dumbbell__leg-dot dumbbell__leg-dot--b" /> {yearB}
//         </span>
//       </div>

//       <ul className="dumbbell__list">
//         {data.map((r) => {
//           const up = r.b >= r.a;
//           return (
//             <li key={r.area} className={`dumbbell__row ${up ? "is-up" : "is-down"}`}>
//               <span className="dumbbell__name" title={r.name}>{r.name}</span>
//               <svg className="dumbbell__track" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
//                 <line className="dumbbell__bar" x1={x(r.a)} y1="5" x2={x(r.b)} y2="5" />
//                 <circle className="dumbbell__pt dumbbell__pt--a" cx={x(r.a)} cy="5" r="2.6" />
//                 <circle className="dumbbell__pt dumbbell__pt--b" cx={x(r.b)} cy="5" r="2.6" />
//               </svg>
//               <span className="dumbbell__vals">
//                 {fmt(r.a)} → {fmt(r.b)}
//                 <span className="dumbbell__unit"> {unit}</span>
//               </span>
//             </li>
//           );
//         })}
//       </ul>

//       {(labels.up || labels.down) && (
//         <p className="dumbbell__foot">
//           <span className="dumbbell__foot-up">▲ {labels.up}</span>
//           {"  ·  "}
//           <span className="dumbbell__foot-down">▼ {labels.down}</span>
//         </p>
//       )}
//     </div>
//   );
// }

// src/components/DumbbellChart/DumbbellChart.jsx
// ============================================================
// Haltère « avant → après » (interface a/b) — utilisé par les actes Ciel
// et Agriculture : pour chaque territoire, la valeur de la PREMIÈRE année
// (yearA, point sourd) reliée à celle de la DERNIÈRE (yearB, point chaud).
// ⚠ NE PAS CONFONDRE avec components/charts/DumbbellChart.jsx (interface
//   start/end + startLabel/endLabel), utilisé par l'acte Territoire.
//   • HAUTEUR DYNAMIQUE : rows × ligne → toutes les lignes visibles, jamais
//     de coupure (le wrapper ApexChart respecte une hauteur explicite ; le
//     parent peut défiler si besoin).
//   • `decimals` pilote axe + tooltip (0 = entiers : mm, kg/ha, stations…).
//   • Légende up/down (labels) : sens de l'évolution par la couleur du
//     point d'arrivée.
// Props { rows:[{name,a,b}], yearA, yearB, unit, labels:{up,down}, decimals }.
// ============================================================
import React, { useMemo } from "react";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ApexChart from "../ApexChart/ApexChart";
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, refLineX, MONO, SANS } from "../charts/apexBase";
import "./DumbbellChart.scss";

const ROW_H = 30; // hauteur d'une ligne (px) — défaut historique
const EXTRA_H = 96; // axe X + légende + marges

// AJOUTS (audit acte 02) — tous optionnels, les appelants existants
// (actes 06 · 07 · 08 · 09 · 10) gardent exactement le rendu d'avant :
//   • rowHeight  : densifier quand il y a beaucoup de lignes. À 30 px,
//                  21 territoires réclamaient 726 px de haut, donc un
//                  défilement imbriqué dans le panneau.
//   • startColor / endColor : imposer la sémantique de couleur de l'acte.
//                  Par défaut la couleur suit la DIRECTION (hausse/baisse) ;
//                  quand toutes les évolutions vont dans le même sens, cela
//                  n'encode plus rien — mieux vaut alors que la couleur dise
//                  « départ » et « arrivée ».
//   • refX / refLabel : repère vertical (le zéro d'une anomalie, p.ex.).
export default function DumbbellChart({
  rows = [],
  yearA = "",
  yearB = "",
  unit = "",
  labels = {},
  decimals = 2,
  rowHeight = ROW_H,
  startColor = null,
  endColor = null,
  refX = null,
  refLabel = "",
  // "asc" = comportement historique (conservé par défaut pour les actes
  // 06 · 07 · 08 · 09 · 10) ; "desc" place la plus forte valeur d'arrivée
  // EN HAUT, ce qu'attend un lecteur d'un classement.
  sort = "asc",
  barHeight = "55%",
  // `fill` : occuper toute la hauteur du conteneur au lieu de la calculer
  // depuis le nombre de lignes.
  //
  // Par défaut le composant impose une hauteur explicite (lignes × rowHeight
  // + marges) : indispensable quand il y a plus de lignes que de place, pour
  // qu'aucune ne soit coupée. Mais dans un panneau plein écran l'effet
  // s'inverse — 21 territoires réclamaient 558 px dans un conteneur de
  // 747 px, soit 189 px de vide sous le graphique, alors que les autres vues
  // de l'escale occupaient toute la hauteur. Le passage d'un onglet à
  // l'autre faisait sauter la zone de tracé.
  //
  // En mode `fill`, on ne pose PAS de hauteur : le wrapper ApexChart mesure
  // le conteneur et les lignes se répartissent dessus. À réserver aux cas où
  // le nombre de lignes tient confortablement (ici 21 lignes sur ~750 px,
  // soit 35 px chacune — plus lisible que les 22 px imposés).
  fill = false,
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    // Tri ascendant sur la valeur finale : Apex empile du bas vers le haut →
    // plus grande valeur finale en haut.
    const r = [...rows]
      .filter((x) => Number.isFinite(x.a) && Number.isFinite(x.b))
      // Apex place le PREMIER élément du tableau en HAUT de l'axe.
      // "desc" = plus forte valeur d'arrivée en haut.
      .sort((x, y) => (sort === "desc" ? y.b - x.b : x.b - y.b));

    const data = r.map((x) => ({
      x: x.name,
      y: [Number(x.a.toFixed(3)), Number(x.b.toFixed(3))],
      // Couleur du point d'arrivée selon le sens (hausse / baisse).
      // `fillColor` par point ENCODE LA DIRECTION (hausse / baisse). Quand
      // l'appelant impose une couleur d'arrivée, on ne le pose PAS : il
      // écraserait le dégradé départ → arrivée d'un aplat uni, et l'haltère
      // se lisait alors comme une simple barre pleine.
      ...(endColor ? {} : { fillColor: x.b >= x.a ? tk.accent : tk.warm }),
    }));

    const cStart = startColor || tk.textMute;
    const cEnd = endColor || tk.accent;
    const height = Math.max(300, r.length * rowHeight + EXTRA_H);
    // `-0.0` apparaissait sur l'axe : un zéro négatif de virgule flottante.
    const fmtD = (v) => {
      const n = Number(v);
      return fmt(Math.abs(n) < 1e-9 ? 0 : n, decimals);
    };

    return {
      // Sans `height`, `hasExplicitHeight()` renvoie false côté wrapper et
      // celui-ci dimensionne le graphique sur le conteneur réel.
      chart: fill
        ? baseChart(tk, { type: "rangeBar" })
        : { ...baseChart(tk, { type: "rangeBar" }), height },
      // Sens du dégradé. Sur un `rangeBar` horizontal, Apex applique
      // `gradientToColors` à GAUCHE et `colors` à DROITE — l'inverse de ce
      // qu'on lit dans l'API. Sans inversion, le trajet partait de la
      // couleur d'ARRIVÉE : le graphique racontait l'histoire à l'envers.
      // (Inversion appliquée uniquement quand l'appelant impose ses
      // couleurs, pour ne pas repeindre les actes qui utilisaient déjà ce
      // composant avec les valeurs par défaut.)
      colors: [endColor ? cEnd : tk.lineStrong],
      series: [{ data }],
      plotOptions: {
        bar: {
          horizontal: true,
          isDumbbell: true,
          dumbbellColors: [[cStart, cEnd]],
          barHeight,
        },
      },
      fill: {
        type: "gradient",
        gradient: {
          type: "horizontal",
          gradientToColors: [endColor ? cStart : cEnd],
          stops: [0, 100],
        },
      },
      stroke: { width: 2, colors: [tk.lineStrong] },
      markers: { size: 0 },
      dataLabels: { enabled: false },
      legend: {
        show: !!(labels.up || labels.down),
        position: "top",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "12.5px",
        labels: { colors: tk.textSoft },
        markers: { width: 12, height: 12, radius: 6 },
        customLegendItems: [labels.up, labels.down].filter(Boolean),
      },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "numeric",
        title: { text: unit, style: { color: tk.textSoft, fontFamily: MONO, fontWeight: 400, fontSize: "12.5px" } },
        labels: {
          style: { colors: tk.text, fontFamily: MONO, fontSize: "13.5px" },
          formatter: (v) => fmtD(v),
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.text, fontFamily: SANS, fontSize: "13.5px" } },
      }),
      tooltip: baseTooltip({
        custom: ({ dataPointIndex }) => {
          const x = r[dataPointIndex];
          if (!x) return "";
          const dir = x.b >= x.a ? labels.up || "" : labels.down || "";
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${x.name}</div>
            <div class="apexchart__tt-row">${yearA}: ${fmtD(x.a)} ${unit}</div>
            <div class="apexchart__tt-row">${yearB}: <strong>${fmtD(x.b)}</strong> ${unit}</div>
            ${dir ? `<div class="apexchart__tt-row">${dir}</div>` : ""}
          </div>`;
        },
      }),
      ...(Number.isFinite(refX)
        ? { annotations: { xaxis: [refLineX(tk, refX, refLabel, tk.lineStrong)] } }
        : {}),
    };
  }, [
    rows,
    yearA,
    yearB,
    unit,
    labels,
    decimals,
    rowHeight,
    sort,
    barHeight,
    fill,
    startColor,
    endColor,
    refX,
    refLabel,
    tk,
  ]);

  return <ApexChart options={option} className="apexchart--tall" />;
}