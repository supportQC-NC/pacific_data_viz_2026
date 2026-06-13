// src/components/DatasetSwitcher/DatasetSwitcher.jsx
// ============================================================
// Sélecteur de JEUX DE DONNÉES — alternative parlante au menu déroulant.
// Chaque jeu = une carte cliquable, toutes visibles d'un coup d'œil :
//   • icône d'identité (goutte, thermomètre, réseau…) ;
//   • nom + unité ;
//   • MINI-SPARKLINE de la trajectoire du jeu (on « voit » la différence
//     avant même de cliquer) ;
//   • couleur d'accent propre au jeu (tonalité), reprise dans les graphes.
// 100 % tokens : aucune couleur en dur, aucun style inline. La couleur vient
// d'une classe de tonalité (is-accent / is-warm / is-positive / …) qui pose
// --dsw-c ; l'icône et la sparkline l'héritent via currentColor.
// Props : label, items [{ id, label, unit, icon, tone, spark:number[] }],
//         value, onChange.
// ============================================================

import React, { useMemo } from "react";
import "./DatasetSwitcher.scss";

// Jeux d'icônes (tracé au trait, colorés via currentColor).
const ICONS = {
  rain: (
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  ),
  temp: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
  network: (
    <>
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.86a10 10 0 0 1 14 0" />
      <path d="M8.5 16.43a5 5 0 0 1 7 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </>
  ),
  generic: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  map: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
    </>
  ),
};

// Petite sparkline normalisée (silhouette de la trajectoire du jeu).
function Spark({ values }) {
  const points = useMemo(() => {
    const v = (values || []).filter((n) => Number.isFinite(n));
    if (v.length < 2) return "";
    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = max - min || 1;
    const W = 100;
    const H = 28;
    const pad = 3;
    return v
      .map((n, i) => {
        const x = pad + (i / (v.length - 1)) * (W - pad * 2);
        const y = H - pad - ((n - min) / span) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  if (!points)
    return <span className="dsw__spark dsw__spark--empty" aria-hidden="true" />;
  return (
    <svg
      className="dsw__spark"
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DatasetSwitcher({
  label,
  items = [],
  value,
  onChange,
  dense = false,
  hideSpark = false,
  iconOnly = false,
}) {
  return (
    <div
      className={`dsw ${dense ? "dsw--dense" : ""} ${iconOnly ? "dsw--icononly" : ""}`}
    >
      {label ? <span className="dsw__label">{label}</span> : null}
      <div
        className="dsw__list"
        role="radiogroup"
        aria-label={label || undefined}
      >
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`dsw__card is-${it.tone || "neutral"} ${active ? "is-active" : ""} ${
                dense ? "dsw__card--dense" : ""
              }`}
              onClick={() => onChange && onChange(it.id)}
            >
              <span className="dsw__top">
                <span className="dsw__ico" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {ICONS[it.icon] || ICONS.generic}
                  </svg>
                </span>
                <span className="dsw__meta">
                  <span className="dsw__name">{it.label}</span>
                  {it.unit ? (
                    <span className="dsw__unit">{it.unit}</span>
                  ) : null}
                </span>
              </span>
              {!hideSpark && <Spark values={it.spark} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
