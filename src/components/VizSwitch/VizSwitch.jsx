// src/components/VizSwitch/VizSwitch.jsx
// ============================================================
// BASCULE ENTRE LES VISUELS D'UNE MÊME ESCALE
//
// Plusieurs escales portent deux ou trois dessins interactifs : la pousse et
// la bête pour l'agriculture, le verre et le bacille pour la santé, la foule
// et la pile pour l'impact. Chacun occupait son propre onglet dans la barre
// de navigation.
//
// Le problème n'est pas la place, c'est le RANG. La barre énumère les vues du
// raisonnement — tendance, matrice, carte —, chacune répondant à une question
// différente. Deux visuels y entraient comme deux étapes distinctes alors
// qu'ils sont deux faces d'une même chose : « à quoi ressemble cet
// indicateur ? ». Ils poussaient au passage les vraies vues vers la droite,
// jusqu'à les tronquer sur les escales chargées.
//
// Une seule entrée dans la barre, donc, et le choix DANS le panneau — là où
// il porte, à côté du dessin qu'il change. Un contrôle segmenté plutôt qu'un
// menu : deux ou trois options, toutes visibles, un seul geste.
//
// Le composant ne s'affiche pas quand il n'y a qu'un visuel à montrer : un
// sélecteur à un seul choix est un mensonge sur l'interface.
// ============================================================

import React from "react";
import "./VizSwitch.scss";

export default function VizSwitch({ items = [], value, onChange, label }) {
  if (!items || items.length < 2) return null;

  return (
    <div className="vizswitch" role="group" aria-label={label}>
      {label ? <span className="vizswitch__label">{label}</span> : null}
      <div className="vizswitch__track">
        {items.map((it) => {
          const on = it.id === value;
          return (
            <button
              key={it.id}
              type="button"
              className={`vizswitch__item ${on ? "is-on" : ""}`}
              aria-pressed={on}
              onClick={() => onChange(it.id)}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
