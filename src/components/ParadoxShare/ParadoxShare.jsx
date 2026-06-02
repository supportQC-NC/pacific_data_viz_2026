// src/components/ParadoxShare/ParadoxShare.jsx
// ============================================================
// "Part infime" : anneau ou la quasi-totalite represente le reste du monde
// et un mince filet vert le Pacifique, + le chiffre exact en grand. Le filet
// a un minimum visible (0,6 %) pour rester perceptible ; le NOMBRE reste
// exact. Donnees via data360Api (World Bank Data360 / OWID, CC BY 4.0).
// ============================================================

import React from "react";
import { useLang } from "../../store/context/langContext";
import paradoxShareLabels from "../../i18n/paradoxShareLabels";
import "./ParadoxShare.scss";

const R = 52;
const C = 2 * Math.PI * R;

function fmtShare(v) {
  if (v == null) return "—";
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.1) return v.toFixed(2);
  return v.toFixed(3);
}

export default function ParadoxShare({
  share = null,
  year = null,
  loading = false,
  approx = false,
}) {
  const { lang } = useLang();
  const L = paradoxShareLabels[lang] || paradoxShareLabels.fr;

  const pct = share == null ? 0 : share;
  const visual = Math.max(pct, 0.6);
  const dash = (visual / 100) * C;

  return (
    <figure className="pshare">
      <div className="pshare__viz">
        <svg viewBox="0 0 120 120" className="pshare__ring" aria-hidden="true">
          <circle className="pshare__rest" cx="60" cy="60" r={R} />
          <circle
            className="pshare__pac"
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={`${dash} ${C - dash}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span className="pshare__num">
          {loading ? "…" : fmtShare(share)}
          <em>%</em>
        </span>
      </div>
      <figcaption className="pshare__cap">
        <p className="eyebrow pshare__eyebrow">{L.eyebrow}</p>
        <p className="pshare__lead">
          {L.lead}
          {year ? ` (${year})` : ""}
          {approx ? ` ${L.approx}` : ""}
        </p>
        <p className="pshare__src">{L.source}</p>
      </figcaption>
    </figure>
  );
}