// src/components/Vaa/Vaa.jsx
// ============================================================
// LA PIROGUE (va'a) — silhouette unique, réutilisable.
//
// Le même tracé existait déjà, copié, dans EscaleTransition (traversées) et
// LanguageGate (départ). Ce composant est là pour que les prochains usages
// n'en fassent pas une troisième copie ; il n'impose rien aux deux existants,
// qui pourront l'adopter plus tard (hors périmètre pour l'instant).
//
// Purement présentational : aucune couleur ici. L'appelant style les parties
// via `className` + les classes internes `vaacraft__*`, comme le reste du projet.
//   coque (hull) · deux voiles (sail) · mât · flotteur (ama) · bras (iako)
// ============================================================

import React from "react";
import "./Vaa.scss";

export default function Vaa({ className = "", withWake = false }) {
  return (
    <svg className={`vaacraft ${className}`} viewBox="0 0 260 200" aria-hidden="true">
      {withWake && (
        <>
          <path className="vaacraft__wake" d="M8 174 Q 70 169 120 174" />
          <path className="vaacraft__wake" d="M22 184 Q 78 181 122 184" />
        </>
      )}
      <ellipse className="vaacraft__shadow" cx="150" cy="186" rx="76" ry="6" />
      <path
        className="vaacraft__sail"
        d="M150 26 C 200 48 218 102 216 152 C 184 141 162 124 150 109 Z"
      />
      <path
        className="vaacraft__sail vaacraft__sail--back"
        d="M150 32 C 122 57 112 102 114 146 C 137 133 146 120 150 109 Z"
      />
      <line className="vaacraft__mast" x1="150" y1="24" x2="150" y2="166" />
      <path
        className="vaacraft__hull"
        d="M90 168 Q 150 193 210 168 Q 183 181 150 181 Q 117 181 90 168 Z"
      />
      <path className="vaacraft__ama" d="M86 191 Q 150 201 208 191" />
      <line className="vaacraft__iako" x1="121" y1="177" x2="115" y2="191" />
      <line className="vaacraft__iako" x1="179" y1="177" x2="185" y2="191" />
    </svg>
  );
}
