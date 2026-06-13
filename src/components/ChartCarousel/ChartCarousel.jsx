// src/components/ChartCarousel/ChartCarousel.jsx
// ============================================================
// Navigation des graphes d'un acte en CARROUSEL (alternative au rail
// vertical). Pilules dans le style des filtres : numéro + nom, étoile pour
// le graphe signature, pilule active en accent. Flèches précédent / suivant,
// piste qui défile et RECENTRE automatiquement la pilule active. Le contenu
// du graphe se fait en fondu à chaque changement (voir .chcar-fade + key).
// Props : charts [{ id, tab, signature }], index, onSelect(i), labels { prev, next, signature }.
// ============================================================

import React, { useEffect, useRef } from "react";
import "./ChartCarousel.scss";

export default function ChartCarousel({
  charts = [],
  index = 0,
  onSelect,
  labels = {},
}) {
  const trackRef = useRef(null);
  const activeRef = useRef(null);

  // Recentre la pilule active dans la piste (sans faire défiler la page).
  useEffect(() => {
    const track = trackRef.current;
    const el = activeRef.current;
    if (!track || !el) return;
    const target = el.offsetLeft - track.clientWidth / 2 + el.clientWidth / 2;
    track.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [index]);

  const go = (i) => {
    if (!charts.length || !onSelect) return;
    onSelect(Math.max(0, Math.min(charts.length - 1, i)));
  };

  if (!charts.length) return null;

  return (
    <div
      className="chcar"
      role="tablist"
      aria-label={labels.signature || undefined}
    >
      {labels.group ? (
        <span className="chcar__group">{labels.group}</span>
      ) : null}
      <button
        type="button"
        className="chcar__arrow"
        onClick={() => go(index - 1)}
        disabled={index <= 0}
        aria-label={labels.prev || "Précédent"}
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div className="chcar__track" ref={trackRef}>
        {charts.map((c, i) => {
          const active = i === index;
          return (
            <button
              key={c.id}
              ref={active ? activeRef : null}
              type="button"
              role="tab"
              aria-selected={active}
              className={`chcar__item ${active ? "is-active" : ""} ${c.signature ? "is-signature" : ""}`}
              onClick={() => go(i)}
            >
              {c.signature ? (
                <span className="chcar__star" aria-hidden="true">
                  ★
                </span>
              ) : null}
              <span className="chcar__label">{c.tab}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="chcar__arrow"
        onClick={() => go(index + 1)}
        disabled={index >= charts.length - 1}
        aria-label={labels.next || "Suivant"}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
