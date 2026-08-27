// src/components/ChartHint/ChartHint.jsx
// ============================================================
// BULLE « COMMENT EXPLORER » — brique réutilisable par toutes les escales.
//
// Une consigne d'usage n'a pas besoin d'occuper la page en permanence :
// elle sert une fois, au moment où l'on se demande quoi faire. D'où une
// pastille discrète, et l'explication au survol.
//
// Elle s'ouvre aussi au FOCUS CLAVIER (`:focus-within` côté SCSS) : sans
// cela l'aide n'existerait que pour ceux qui ont une souris.
//
// Props :
//   text  : string — ce qu'on peut faire sur CE graphique
//   keys  : string — rappel des raccourcis, commun à toutes les vues
//   label : string — intitulé accessible du bouton
// ============================================================

import React from "react";
import "./ChartHint.scss";

export default function ChartHint({ text, keys, label }) {
  if (!text && !keys) return null;

  return (
    <div className="charthint">
      <button
        type="button"
        className="charthint__btn"
        aria-describedby="charthint-bubble"
      >
        <span aria-hidden="true">?</span>
        <span className="u-sr-only">{label || "Comment explorer"}</span>
      </button>
      <span className="charthint__bubble" id="charthint-bubble" role="tooltip">
        {text}
        {keys ? <em className="charthint__keys">{keys}</em> : null}
      </span>
    </div>
  );
}
