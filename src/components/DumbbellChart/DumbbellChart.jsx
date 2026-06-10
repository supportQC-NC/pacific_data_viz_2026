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
import { fmt, baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, MONO, SANS } from "../charts/apexBase";
import "./DumbbellChart.scss";

const ROW_H = 30; // hauteur d'une ligne (px)
const EXTRA_H = 96; // axe X + légende + marges

export default function DumbbellChart({
  rows = [],
  yearA = "",
  yearB = "",
  unit = "",
  labels = {},
  decimals = 2,
}) {
  const tk = useThemeTokens();

  const option = useMemo(() => {
    // Tri ascendant sur la valeur finale : Apex empile du bas vers le haut →
    // plus grande valeur finale en haut.
    const r = [...rows]
      .filter((x) => Number.isFinite(x.a) && Number.isFinite(x.b))
      .sort((x, y) => x.b - y.b);

    const data = r.map((x) => ({
      x: x.name,
      y: [Number(x.a.toFixed(3)), Number(x.b.toFixed(3))],
      // Couleur du point d'arrivée selon le sens (hausse / baisse).
      fillColor: x.b >= x.a ? tk.accent : tk.warm,
    }));

    const height = Math.max(320, r.length * ROW_H + EXTRA_H);
    const fmtD = (v) => fmt(Number(v), decimals);

    return {
      chart: { ...baseChart(tk, { type: "rangeBar" }), height },
      colors: [tk.lineStrong],
      series: [{ data }],
      plotOptions: {
        bar: {
          horizontal: true,
          isDumbbell: true,
          dumbbellColors: [[tk.textMute, tk.accent]],
          barHeight: "55%",
        },
      },
      fill: {
        type: "gradient",
        gradient: { type: "horizontal", gradientToColors: [tk.accent], stops: [0, 100] },
      },
      stroke: { width: 2, colors: [tk.lineStrong] },
      markers: { size: 0 },
      dataLabels: { enabled: false },
      legend: {
        show: !!(labels.up || labels.down),
        position: "top",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textSoft },
        markers: { width: 10, height: 10, radius: 5 },
        customLegendItems: [labels.up, labels.down].filter(Boolean),
      },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "numeric",
        title: { text: unit, style: { color: tk.textMute, fontFamily: MONO, fontWeight: 400, fontSize: "11px" } },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
          formatter: (v) => fmtD(v),
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: { style: { colors: tk.textSoft, fontFamily: SANS, fontSize: "12px" } },
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
    };
  }, [rows, yearA, yearB, unit, labels, decimals, tk]);

  return <ApexChart options={option} className="apexchart--tall" />;
}