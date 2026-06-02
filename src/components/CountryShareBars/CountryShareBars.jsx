// src/components/CountryShareBars/CountryShareBars.jsx
// ============================================================
// Comparaison Pacifique vs grands emetteurs, avec un SWITCH :
//   • "Par habitant" (t CO2e/hab) : Pacifique = NOS donnees, grands
//     emetteurs = OWID (per-capita) -> on voit NC/Palaos tres hauts.
//   • "Part mondiale" (%) : OWID pour tous -> le Pacifique reste infime.
// Barres SVG (aucun style inline). Pacifique en vert. Histoire en
// paragraphes + sources affichees. Tri decroissant selon le mode actif.
// Props : rows [{iso3,name,pacific,perCapita,share}], year, loading
// ============================================================

import React, { useMemo, useState } from "react";
import { useLang } from "../../store/context/langContext";
import countryShareLabels from "../../i18n/countryShareLabels";
import "./CountryShareBars.scss";

const MAX_GLOBAL = 12;
const VW = 880;
const ROW = 26;
const BAR_H = 14;
const M = { top: 8, right: 64, bottom: 8, left: 220 };

function fmtPc(v) {
  if (v >= 100) return v.toFixed(0);
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}
function fmtShare(v) {
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  return `${v.toFixed(3)}%`;
}

export default function CountryShareBars({
  rows = [],
  year = null,
  loading = false,
}) {
  const { lang } = useLang();
  const L = countryShareLabels[lang] || countryShareLabels.fr;
  const [mode, setMode] = useState("pc"); // "pc" | "share"

  const field = mode === "share" ? "share" : "perCapita";

  const display = useMemo(() => {
    const clean = rows.filter((r) => Number.isFinite(r[field]));
    const sorted = [...clean].sort((a, b) => b[field] - a[field]);
    const top = sorted.filter((r) => !r.pacific).slice(0, MAX_GLOBAL);
    const pac = sorted.filter((r) => r.pacific);
    const seen = new Set();
    const out = [];
    [...top, ...pac].forEach((r) => {
      const k = r.iso3 || r.name;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(r);
    });
    return out.sort((a, b) => b[field] - a[field]);
  }, [rows, field]);

  if (loading) return <div className="csb csb--state">{L.loading}</div>;

  const innerW = VW - M.left - M.right;
  const VH = M.top + M.bottom + Math.max(1, display.length) * ROW;
  const max = display.length ? display[0][field] || 1 : 1;
  const lead = mode === "share" ? L.leadShare : L.leadPc;
  const fmt = mode === "share" ? fmtShare : fmtPc;
  const story = Array.isArray(L.story) ? L.story : [L.story];

  return (
    <figure className="csb">
      <figcaption className="csb__head">
        <p className="eyebrow">{L.eyebrow}</p>
        <div className="csb__switch" role="group" aria-label={L.eyebrow}>
          <button
            type="button"
            className={`csb__pill ${mode === "pc" ? "is-active" : ""}`}
            aria-pressed={mode === "pc"}
            onClick={() => setMode("pc")}
          >
            {L.modePc}
          </button>
          <button
            type="button"
            className={`csb__pill ${mode === "share" ? "is-active" : ""}`}
            aria-pressed={mode === "share"}
            onClick={() => setMode("share")}
          >
            {L.modeShare}
          </button>
        </div>
        <p className="csb__lead">
          {lead}
          {year ? ` (${year})` : ""}
        </p>
      </figcaption>

      {display.length === 0 ? (
        <div className="csb csb--state">{L.empty}</div>
      ) : (
        <div className="csb__chart">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="csb__svg" role="img" aria-label={L.eyebrow}>
            {display.map((r, i) => {
              const y = M.top + i * ROW;
              const cy = y + BAR_H / 2;
              const wRaw = (r[field] / max) * innerW;
              const w = Math.max(wRaw, r.pacific ? 5 : 2);
              const cls = r.pacific ? "csb__bar csb__bar--pac" : "csb__bar csb__bar--rest";
              const k = r.iso3 || r.name;
              return (
                <g key={k} className={r.pacific ? "csb__g is-pac" : "csb__g"}>
                  <text className="csb__name" x={M.left - 8} y={cy} textAnchor="end" dominantBaseline="middle">{r.name}</text>
                  <rect className="csb__track-bg" x={M.left} y={y} width={innerW} height={BAR_H} rx="3" />
                  <rect className={cls} x={M.left} y={y} width={w} height={BAR_H} rx="3" />
                  <text className="csb__val" x={M.left + w + 6} y={cy} dominantBaseline="middle">{fmt(r[field])}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="csb__story">
        {story.map((para, i) => (
          <p key={i} className="csb__story-p">{para}</p>
        ))}
      </div>

      <p className="csb__legend">
        <span className="csb__chip csb__chip--pac" aria-hidden="true" />
        {L.pacific}
        <span className="csb__chip csb__chip--rest" aria-hidden="true" />
        {L.rest}
      </p>
      <p className="csb__src">{L.source}</p>
    </figure>
  );
}