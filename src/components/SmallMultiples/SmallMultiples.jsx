// src/components/SmallMultiples/SmallMultiples.jsx
// ============================================================
// Petits multiples — « registre classé ». Une entrée par territoire, triée
// par dernière valeur décroissante : RANG discret (mono), NOM complet, dernière
// VALEUR en gros chiffre serif, badge de TENDANCE (▲/▼ % entre premier et
// dernier point) et une sparkline posée sur une « ligne d'eau » (baseline
// filaire commune par rangée). Pas de cadre : la hiérarchie vient de la typo
// et de l'alignement. Chaque cellule garde sa propre échelle Y (on lit la
// FORME) ; la comparaison des NIVEAUX se fait via la heatmap.
//
// Cliquer une entrée l'AGRANDIT dans une modale autonome (grand graphe annoté,
// axes, fermeture par Échap / clic sur le fond / bouton).
//
// SCSS only, couleurs via tokens. Aucune dépendance.
// Props (API inchangée) :
//   series : [{ area, name, values:[{year,value}] }]
//   years  : [number]  (axe X commun)
//   unit   : string
//   labels : { last, close } (libellés optionnels)
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import "./SmallMultiples.scss";

const W = 140;
const H = 44;
const PAD = 4;

// Grand graphe de la modale
const BW = 640;
const BH = 320;
const BL = 56; // marge gauche (libellés Y)
const BR = 18;
const BT = 18;
const BB = 30; // marge bas (années)

function fmt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("fr-FR");
  return Math.round(v * 10) / 10;
}
function fmtPct(p) {
  if (!Number.isFinite(p)) return null;
  const s = Math.round(p);
  return `${s > 0 ? "+" : ""}${s}\u00a0%`;
}
function sparkPath(values, minYear, yearSpan, min, max) {
  const span = max - min || 1;
  return values
    .map((p, i) => {
      const x = PAD + ((p.year - minYear) / (yearSpan || 1)) * (W - 2 * PAD);
      const y = H - PAD - ((p.value - min) / span) * (H - 2 * PAD);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ---- Grand graphe (modale) -------------------------------------------------
function BigChart({ cell, minYear, maxYear }) {
  const vals = cell.values;
  const span = maxYear - minYear || 1;
  const vSpan = cell.max - cell.min || 1;
  const sx = (yr) => BL + ((yr - minYear) / span) * (BW - BL - BR);
  const sy = (v) => BT + (1 - (v - cell.min) / vSpan) * (BH - BT - BB);
  const line = vals
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${sx(p.year).toFixed(1)},${sy(p.value).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${sx(vals[vals.length - 1].year).toFixed(1)},${BH - BB} L${sx(
    vals[0].year,
  ).toFixed(1)},${BH - BB} Z`;
  // 3 graduations d'années (début, milieu, fin) sans surcharger
  const ticks = [
    vals[0],
    vals[Math.floor(vals.length / 2)],
    vals[vals.length - 1],
  ].filter((p, i, a) => a.indexOf(p) === i);
  const gid = `smbig-${cell.area}`;
  return (
    <svg
      className="smallmult__big"
      viewBox={`0 0 ${BW} ${BH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={cell.name}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="smallmult__g0" />
          <stop offset="100%" className="smallmult__g1" />
        </linearGradient>
      </defs>
      {/* repères haut / bas */}
      <line
        className="smallmult__axis"
        x1={BL}
        y1={sy(cell.max)}
        x2={BW - BR}
        y2={sy(cell.max)}
      />
      <line
        className="smallmult__axis"
        x1={BL}
        y1={sy(cell.min)}
        x2={BW - BR}
        y2={sy(cell.min)}
      />
      <text
        className="smallmult__ytick"
        x={BL - 8}
        y={sy(cell.max) + 4}
        textAnchor="end"
      >
        {fmt(cell.max)}
      </text>
      <text
        className="smallmult__ytick"
        x={BL - 8}
        y={sy(cell.min) + 4}
        textAnchor="end"
      >
        {fmt(cell.min)}
      </text>
      {/* aire + ligne */}
      <path className="smallmult__area" d={area} fill={`url(#${gid})`} />
      <path className="smallmult__bigline" d={line} />
      {/* points */}
      {vals.map((p) => (
        <circle
          key={p.year}
          className="smallmult__bigpt"
          cx={sx(p.year)}
          cy={sy(p.value)}
          r={p.year === cell.lastYear ? 4 : 2.4}
        />
      ))}
      {/* années */}
      {ticks.map((p) => (
        <text
          key={p.year}
          className="smallmult__xtick"
          x={sx(p.year)}
          y={BH - 10}
          textAnchor="middle"
        >
          {p.year}
        </text>
      ))}
    </svg>
  );
}

export default function SmallMultiples({ series, years, unit, labels = {} }) {
  const [open, setOpen] = useState(null); // cellule agrandie
  const minYear = years && years.length ? years[0] : 0;
  const maxYear = years && years.length ? years[years.length - 1] : 0;

  const cells = useMemo(() => {
    const yearSpan = maxYear - minYear;
    return (series || [])
      .filter((s) => s.values && s.values.length >= 2)
      .map((s) => {
        const vals = s.values;
        const ys = vals.map((p) => p.value);
        const min = Math.min(...ys);
        const max = Math.max(...ys);
        const last = vals[vals.length - 1];
        const first = vals[0];
        const trend = last.value - first.value;
        const trendPct =
          Number.isFinite(first.value) && first.value !== 0
            ? (trend / Math.abs(first.value)) * 100
            : null;
        return {
          area: String(s.area).replace(/[^a-zA-Z0-9]/g, ""),
          name: s.name,
          values: vals,
          min,
          max,
          last: last.value,
          lastYear: last.year,
          trend,
          trendPct,
          d: sparkPath(vals, minYear, yearSpan, min, max),
          lx: PAD + ((last.year - minYear) / (yearSpan || 1)) * (W - 2 * PAD),
          ly: H - PAD - ((last.value - min) / (max - min || 1)) * (H - 2 * PAD),
        };
      })
      .sort((a, b) => b.last - a.last);
  }, [series, years, minYear, maxYear]);

  // Échap pour fermer
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!cells.length) return null;

  return (
    <div className="smallmult">
      {cells.map((c, i) => (
        <div
          key={c.area}
          className={`smallmult__cell ${c.trend < 0 ? "is-down" : "is-up"}`}
          role="button"
          tabIndex={0}
          aria-label={c.name}
          onClick={() => setOpen(c)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(c);
            }
          }}
        >
          <div className="smallmult__head">
            <span className="smallmult__rank">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="smallmult__name" title={c.name}>
              {c.name}
            </span>
          </div>

          <div className="smallmult__metric">
            <span className="smallmult__val">{fmt(c.last)}</span>
            <span className="smallmult__unit">{unit}</span>
            {c.trendPct != null ? (
              <span className="smallmult__trend">
                {c.trend < 0 ? "\u25be" : "\u25b4"} {fmtPct(c.trendPct)}
              </span>
            ) : null}
          </div>

          <svg
            className="smallmult__spark"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id={`sm-${c.area}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="smallmult__g0" />
                <stop offset="100%" className="smallmult__g1" />
              </linearGradient>
            </defs>
            <path
              className="smallmult__area"
              d={`${c.d} L${c.lx.toFixed(1)},${H} L${PAD},${H} Z`}
              fill={`url(#sm-${c.area})`}
            />
            <path className="smallmult__line" d={c.d} />
            <circle className="smallmult__dot" cx={c.lx} cy={c.ly} r="2.6" />
          </svg>
        </div>
      ))}

      {open ? (
        <div
          className="smallmult__modal"
          role="dialog"
          aria-modal="true"
          aria-label={open.name}
          onClick={() => setOpen(null)}
        >
          <div
            className={`smallmult__dialog ${open.trend < 0 ? "is-down" : "is-up"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="smallmult__close"
              onClick={() => setOpen(null)}
              aria-label={labels.close || "Fermer"}
            >
              {"\u2715"}
            </button>
            <div className="smallmult__dlg-head">
              <span className="smallmult__dlg-name">{open.name}</span>
              <span className="smallmult__dlg-metric">
                <span className="smallmult__dlg-val">{fmt(open.last)}</span>
                <span className="smallmult__unit"> {unit}</span>
                {open.trendPct != null ? (
                  <span className="smallmult__trend">
                    {open.trend < 0 ? "\u25be" : "\u25b4"}{" "}
                    {fmtPct(open.trendPct)}
                  </span>
                ) : null}
              </span>
            </div>
            <BigChart cell={open} minYear={minYear} maxYear={maxYear} />
            <div className="smallmult__dlg-foot">
              {minYear} – {maxYear}
              {labels.last
                ? ` · ${labels.last} ${open.lastYear}`
                : ` · ${open.lastYear}`}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
