// src/components/charts/VizPanel.jsx
// ============================================================
// Un graphique = DEUX diapos plein écran :
//   1) une page de TEXTE éditoriale qui explique (grand titre + lead + récit) ;
//   2) la page GRAPHIQUE seule — pas de titre répété, juste la commande
//      "Filtres" (repliable, en haut à gauche) et le chart qui remplit tout.
// Rythme : on explique -> suivant -> on montre -> suivant -> on explique...
// Style dans Act1Emissions.scss (.act1text / .act1viz / .act1slide).
// ============================================================

import React, { useState } from "react";
import { FiSliders } from "react-icons/fi";

export default function VizPanel({
  title,
  subtitle,
  story,
  filters = null,
  filtersLabel = "Filtres",
  children,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Diapo 1 — texte explicatif plein écran */}
      <section className="act1slide act1text">
        <div className="act1text__inner">
          <h2 className="act1text__title">{title}</h2>
          {subtitle ? <p className="act1text__lead">{subtitle}</p> : null}
          {story ? <p className="act1text__story">{story}</p> : null}
          <span className="act1text__hint" aria-hidden="true">
            ↓
          </span>
        </div>
      </section>

      {/* Diapo 2 — le graphique plein écran (titre non répété) */}
      <section className="act1slide act1viz" aria-label={title}>
        {filters ? (
          <div className="act1viz__head">
            <button
              type="button"
              className={`act1viz__toggle ${open ? "is-open" : ""}`}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              <FiSliders aria-hidden="true" /> {filtersLabel}
            </button>
          </div>
        ) : null}

        {filters && open ? <div className="act1viz__filters">{filters}</div> : null}

        <div className="act1viz__chart">{children}</div>
      </section>
    </>
  );
}