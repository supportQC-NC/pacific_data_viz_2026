// src/components/EscaleImmersion/EscaleImmersion.jsx
// ============================================================
// VUE IMMERSIVE d'une escale — brique partagée (variante E du template).
//
// Certaines visualisations ne sont pas des graphiques : une carte du globe,
// une scène animée, un replay. Tassées dans un panneau de dashboard, elles
// sont trop petites pour qu'on s'y repère et trop grandes pour qu'on y
// compare quoi que ce soit. Elles ne se lisent qu'en plein écran.
//
// Ce composant sépare donc deux plans :
//   • le PANNEAU  — ce qu'on voit dans le flux du dashboard (`children`) ;
//   • le PLEIN ÉCRAN — la vraie visualisation, rendue par `renderFull`.
//
// COMPORTEMENT D'OUVERTURE (`autoOpen`) : arriver sur la vue ouvre
// directement le plein écran — on ne demande pas un clic pour accéder à ce
// qui est la raison d'être de la vue. Mais UNE SEULE FOIS : dès que la
// personne en est ressortie, le comportement s'inverse et c'est elle qui
// décide de rouvrir. Sans cette mémoire, quitter le plein écran le
// rouvrirait aussitôt et on ne pourrait plus jamais voir le panneau.
//
// Props :
//   children    : contenu du panneau (visuel d'ambiance, contexte)
//   renderFull  : (close) => node — la visualisation plein écran
//   autoOpen    : ouvrir dès le montage (défaut : false)
//   label/hint  : libellés du bouton d'ouverture
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./EscaleImmersion.scss";

export default function EscaleImmersion({
  children,
  renderFull = null,
  autoOpen = false,
  label,
  hint,
}) {
  const [open, setOpen] = useState(false);
  // Mémoire d'ouverture : une fois la personne sortie, on ne la renvoie pas
  // de force dans le plein écran.
  const openedOnce = useRef(false);

  useEffect(() => {
    if (autoOpen && renderFull && !openedOnce.current) {
      openedOnce.current = true;
      setOpen(true);
    }
  }, [autoOpen, renderFull]);

  const close = useCallback(() => setOpen(false), []);

  // Sans contenu de panneau, la vue N'EST QUE la porte vers le plein écran :
  // le bouton cesse d'être une pastille de coin pour devenir l'objet central.
  const bare = !children;

  return (
    <div className={`escimm ${bare ? "escimm--bare" : ""}`}>
      {children ? <div className="escimm__panel">{children}</div> : null}

      {renderFull ? (
        <button
          type="button"
          className="escimm__open"
          onClick={() => setOpen(true)}
        >
          <span className="escimm__open-icon" aria-hidden="true">
            ⤢
          </span>
          <span className="escimm__open-txt">
            <span className="escimm__open-label">{label}</span>
            {hint ? <span className="escimm__open-hint">{hint}</span> : null}
          </span>
        </button>
      ) : null}

      {/* PORTAIL vers <body>, et non rendu sur place.
          Un plein écran s'appuie sur `position: fixed`, qui se cale sur la
          fenêtre — SAUF si un ancêtre porte une transformation, un filtre ou
          un backdrop-filter : il devient alors lui-même le référentiel.
          C'est arrivé ici, et de la façon la plus discrète qui soit : le
          panneau du graphique conservait une matrice IDENTITÉ laissée par
          l'animation de transition du carrousel. La carte s'ancrait donc sur
          le panneau, laissant la barre d'escale visible au-dessus d'elle.
          Le portail rend ce piège impossible, quelle que soit l'escale et
          quels que soient les effets appliqués au board plus tard. */}
      {open && renderFull ? createPortal(renderFull(close), document.body) : null}
    </div>
  );
}
