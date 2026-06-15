// src/components/ChartCarousel/ChartCarousel.jsx
// ============================================================
// Navigation des graphes d'un acte en BARRE PLEINE LARGEUR. Tous les onglets
// sont visibles d'un coup (flex 1, répartis sur toute la largeur) ; un
// INDICATEUR glissant souligne l'onglet actif (accent, ou « warm » pour le
// graphe signature). Repli en scroll horizontal si l'écran est trop étroit.
// Aucun style inline en JSX : la position de l'indicateur est posée via ref
// (el.style) dans un effet.
// Props : charts [{ id, tab, signature }], index, onSelect(i), labels { group, signature }.
// ============================================================

import React, { useEffect, useRef } from "react";
import "./ChartCarousel.scss";

export default function ChartCarousel({ charts = [], index = 0, onSelect, labels = {} }) {
  const trackRef = useRef(null);
  const itemRefs = useRef([]);
  const indRef = useRef(null);

  // Positionne l'indicateur sous l'onglet actif (et recentre si scrollable).
  const place = () => {
    const el = itemRefs.current[index];
    const track = trackRef.current;
    const ind = indRef.current;
    if (!el || !track) return;
    if (ind) {
      ind.style.transform = `translateX(${el.offsetLeft}px)`;
      ind.style.width = `${el.offsetWidth}px`;
      const sig = !!(charts[index] && charts[index].signature);
      ind.classList.toggle("is-signature", sig);
    }
    if (track.scrollWidth > track.clientWidth + 1) {
      const target = el.offsetLeft - track.clientWidth / 2 + el.clientWidth / 2;
      track.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
  };

  useEffect(() => {
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, charts]);

  useEffect(() => {
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const go = (i) => {
    if (!charts.length || !onSelect) return;
    onSelect(Math.max(0, Math.min(charts.length - 1, i)));
  };

  if (!charts.length) return null;

  return (
    <div className="chcar">
      {labels.group ? <span className="chcar__group">{labels.group}</span> : null}

      <div
        className="chcar__track"
        ref={trackRef}
        role="tablist"
        aria-label={labels.signature || undefined}
      >
        {charts.map((c, i) => {
          const active = i === index;
          return (
            <button
              key={c.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
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

        <span className="chcar__indicator" ref={indRef} aria-hidden="true" />
      </div>
    </div>
  );
}