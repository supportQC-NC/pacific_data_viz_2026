// // src/components/EvolutionPanel/EvolutionPanel.jsx
// // ============================================================
// // Analyse d'évolution : variation de chaque territoire entre sa
// // première et sa dernière année disponibles. Émissions : BAISSE =
// // amélioration. Top des plus améliorés / plus dégradés (variation %).
// // Barres en SVG (aucun style inline). Contenu via i18n (props).
// // Props :
// //   series : [{ area, name, values:[{year,value}] }]
// //   labels : { improved, worsened, no_data, since }
// //   unit   : string
// //   topN   : number (défaut 5)
// // ============================================================

// import React, { useMemo } from "react";
// import "./EvolutionPanel.scss";

// const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");
// const fmtPct = (n) => `${n > 0 ? "+" : ""}${n.toFixed(0)} %`;

// export default function EvolutionPanel({
//   series = [],
//   labels = {},
//   unit = "",
//   topN = 5,
// }) {
//   const { improved, worsened, span } = useMemo(() => {
//     const rows = series
//       .map((s) => {
//         const v = s.values.filter(
//           (p) => Number.isFinite(p.value) && p.value > 0,
//         );
//         if (v.length < 2) return null;
//         const first = v[0];
//         const last = v[v.length - 1];
//         const pct = ((last.value - first.value) / first.value) * 100;
//         return { area: s.area, name: s.name, first, last, pct };
//       })
//       .filter(Boolean);
//     const byPct = [...rows].sort((a, b) => a.pct - b.pct);
//     const fy = rows.length ? Math.min(...rows.map((r) => r.first.year)) : 0;
//     const ly = rows.length ? Math.max(...rows.map((r) => r.last.year)) : 0;
//     return {
//       improved: byPct.slice(0, topN),
//       worsened: byPct.slice(-topN).reverse(),
//       span: rows.length ? `${fy} – ${ly}` : "",
//     };
//   }, [series, topN]);

//   const maxAbs = useMemo(() => {
//     const all = [...improved, ...worsened].map((r) => Math.abs(r.pct));
//     return Math.max(1, ...all);
//   }, [improved, worsened]);

//   if (!series.length || (!improved.length && !worsened.length)) {
//     return <p className="evo__empty">{labels.no_data}</p>;
//   }

//   const Item = ({ r, kind }) => (
//     <li className={`evo__item evo__item--${kind}`}>
//       <span className="evo__name">{r.name}</span>
//       <svg
//         className="evo__bar"
//         viewBox="0 0 100 8"
//         preserveAspectRatio="none"
//         aria-hidden="true"
//       >
//         <rect
//           className="evo__bar-track"
//           x="0"
//           y="2.5"
//           width="100"
//           height="3"
//           rx="1.5"
//         />
//         <rect
//           className={`evo__bar-fill evo__bar-fill--${kind}`}
//           x="0"
//           y="2"
//           width={(Math.abs(r.pct) / maxAbs) * 100}
//           height="4"
//           rx="2"
//         />
//       </svg>
//       <span className="evo__vals">
//         {fmt2(r.first.value)} → {fmt2(r.last.value)}
//       </span>
//       <span className={`evo__pct evo__pct--${kind}`}>
//         {kind === "down" ? "▼" : "▲"} {fmtPct(r.pct)}
//       </span>
//     </li>
//   );

//   return (
//     <div className="evo">
//       <div className="evo__col">
//         <h4 className="evo__head evo__head--down">
//           {labels.improved}
//           {span && (
//             <span className="evo__span">
//               {labels.since} {span}
//             </span>
//           )}
//         </h4>
//         <ul className="evo__list">
//           {improved.map((r) => (
//             <Item r={r} kind="down" key={r.area} />
//           ))}
//         </ul>
//       </div>
//       <div className="evo__col">
//         <h4 className="evo__head evo__head--up">
//           {labels.worsened}
//           {span && (
//             <span className="evo__span">
//               {labels.since} {span}
//             </span>
//           )}
//         </h4>
//         <ul className="evo__list">
//           {worsened.map((r) => (
//             <Item r={r} kind="up" key={r.area} />
//           ))}
//         </ul>
//       </div>
//       {unit && <p className="evo__unit">{unit}</p>}
//     </div>
//   );
// }

// src/components/EvolutionPanel/EvolutionPanel.jsx
// ============================================================
// Analyse d'évolution : variation entre la première et la dernière
// année disponibles de chaque territoire.
// mode="pct"      → variation en % (émissions) — défaut
// mode="absolute" → écart absolu last-first + unité (anomalies océan)
// Barres en SVG (aucun style inline). Contenu via i18n (props).
// Props :
//   series : [{ area, name, values:[{year,value}] }]
//   labels : { improved, worsened, no_data, since }
//   unit   : string
//   mode   : "pct" | "absolute"
//   topN   : number (défaut 5)
// ============================================================

import React, { useMemo } from "react";
import "./EvolutionPanel.scss";

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const fmtPct = (n) => `${n > 0 ? "+" : ""}${n.toFixed(0)} %`;
const fmtAbs = (n, unit) =>
  `${n > 0 ? "+" : ""}${n.toFixed(2)}${unit ? ` ${unit}` : ""}`;

export default function EvolutionPanel({
  series = [],
  labels = {},
  unit = "",
  mode = "pct",
  topN = 5,
}) {
  const { improved, worsened, span } = useMemo(() => {
    const rows = series
      .map((s) => {
        const v = s.values.filter((p) => Number.isFinite(p.value));
        if (v.length < 2) return null;
        const first = v[0];
        const last = v[v.length - 1];
        const delta = last.value - first.value;
        const pct =
          first.value !== 0 ? (delta / Math.abs(first.value)) * 100 : 0;
        const metric = mode === "absolute" ? delta : pct;
        return { area: s.area, name: s.name, first, last, delta, pct, metric };
      })
      .filter(Boolean);
    const byMetric = [...rows].sort((a, b) => a.metric - b.metric);
    const fy = rows.length ? Math.min(...rows.map((r) => r.first.year)) : 0;
    const ly = rows.length ? Math.max(...rows.map((r) => r.last.year)) : 0;
    // Colonne "recul/stagnation" : les plus faibles (souvent négatifs).
    // Colonne "progression" : les plus forts (souvent positifs).
    // On répartit l'ensemble sans jamais placer un territoire dans les deux
    // colonnes : on coupe au milieu quand la population est petite.
    const half = Math.ceil(byMetric.length / 2);
    const downCount = Math.min(topN, half);
    const upCount = Math.min(topN, byMetric.length - downCount);
    return {
      improved: byMetric.slice(0, downCount),
      worsened: byMetric.slice(byMetric.length - upCount).reverse(),
      span: rows.length ? `${fy} – ${ly}` : "",
    };
  }, [series, topN, mode]);

  const maxAbs = useMemo(() => {
    const all = [...improved, ...worsened].map((r) => Math.abs(r.metric));
    return Math.max(0.0001, ...all);
  }, [improved, worsened]);

  if (!series.length || (!improved.length && !worsened.length)) {
    return <p className="evo__empty">{labels.no_data}</p>;
  }

  const show = (r) =>
    mode === "absolute" ? fmtAbs(r.delta, unit) : fmtPct(r.pct);

  const Item = ({ r, kind }) => (
    <li className={`evo__item evo__item--${kind}`}>
      <span className="evo__name">{r.name}</span>
      <svg
        className="evo__bar"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          className="evo__bar-track"
          x="0"
          y="2.5"
          width="100"
          height="3"
          rx="1.5"
        />
        <rect
          className={`evo__bar-fill evo__bar-fill--${kind}`}
          x="0"
          y="2"
          width={(Math.abs(r.metric) / maxAbs) * 100}
          height="4"
          rx="2"
        />
      </svg>
      <span className="evo__meta">
        <span className="evo__vals">
          {fmt2(r.first.value)} → {fmt2(r.last.value)}
        </span>
        <span className={`evo__pct evo__pct--${kind}`}>
          {kind === "down" ? "▼" : "▲"} {show(r)}
        </span>
      </span>
    </li>
  );

  return (
    <div className="evo">
      <div className="evo__col">
        <h4 className="evo__head evo__head--down">
          {labels.improved}
          {span && (
            <span className="evo__span">
              {labels.since} {span}
            </span>
          )}
        </h4>
        <ul className="evo__list">
          {improved.map((r) => (
            <Item r={r} kind="down" key={r.area} />
          ))}
        </ul>
      </div>
      <div className="evo__col">
        <h4 className="evo__head evo__head--up">
          {labels.worsened}
          {span && (
            <span className="evo__span">
              {labels.since} {span}
            </span>
          )}
        </h4>
        <ul className="evo__list">
          {worsened.map((r) => (
            <Item r={r} kind="up" key={r.area} />
          ))}
        </ul>
      </div>
      {unit && <p className="evo__unit">{unit}</p>}
    </div>
  );
}