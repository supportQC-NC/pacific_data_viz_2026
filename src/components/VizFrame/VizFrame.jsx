// src/components/VizFrame/VizFrame.jsx
// ============================================================
// Cadre reutilisable autour de n'importe quel visuel : bouton PLEIN ECRAN
// (toggle CSS + Echap pour fermer) et, si des donnees temporelles sont
// fournies, une BARRE DE LECTURE (play/pause + curseur d'annee) pilotee par
// le parent (annee partagee -> tous les visuels animes restent synchronises).
// Aucun style inline. Titre/sous-titre + emplacement "toolbar" optionnels.
// Props : title, subtitle, toolbar, children,
//         years, yearIndex, playing, onTogglePlay, onScrub
// ============================================================

import React, { useEffect, useState } from "react";
import { useLang } from "../../store/context/langContext";
import vizFrameLabels from "../../i18n/vizFrameLabels";
import "./VizFrame.scss";

export default function VizFrame({
  title = null,
  subtitle = null,
  toolbar = null,
  children,
  years = [],
  yearIndex = null,
  playing = false,
  onTogglePlay = null,
  onScrub = null,
}) {
  const { lang } = useLang();
  const L = vizFrameLabels[lang] || vizFrameLabels.fr;
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const hasTimeline = years.length > 0 && typeof onTogglePlay === "function";
  const curYear = years.length ? years[yearIndex ?? 0] : "";

  return (
    <section className={`vframe ${full ? "vframe--full" : ""}`}>
      <header className="vframe__head">
        <div className="vframe__titles">
          {title ? <h3 className="vframe__title">{title}</h3> : null}
          {subtitle ? <span className="vframe__sub">{subtitle}</span> : null}
        </div>
        <div className="vframe__tools">
          {toolbar}
          <button type="button" className="vframe__icon" onClick={() => setFull((f) => !f)} aria-label={full ? L.close : L.expand} title={full ? L.close : L.expand}>
            {full ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path d="M9 4 H4 V9 M15 4 H20 V9 M9 20 H4 V15 M15 20 H20 V15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="vframe__body">{children}</div>

      {hasTimeline && (
        <div className="vframe__timeline">
          <button type="button" className="vframe__play" onClick={onTogglePlay} aria-label={playing ? L.pause : L.play} title={playing ? L.pause : L.play}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
              </svg>
            )}
          </button>
          <input
            type="range"
            className="vframe__scrub"
            min={0}
            max={years.length - 1}
            value={yearIndex ?? 0}
            onChange={(e) => onScrub && onScrub(Number(e.target.value))}
            aria-label={L.year}
          />
          <span className="vframe__year">{curYear}</span>
        </div>
      )}
    </section>
  );
}