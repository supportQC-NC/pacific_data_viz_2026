// src/components/charts/ActsRecap/ActsRecap.jsx
// ============================================================
// Récap des actes — liste éditoriale moderne. Numéros marquants, filets de
// séparation, barre d'accent au survol, acte courant souligné. Entrée en
// cascade via .scene__anim (GSAP de l'acte). Tokens du thème, textes en props.
// ============================================================

import React from "react";
import "./ActsRecap.scss";

export default function ActsRecap({
  eyebrow = "",
  title = "",
  text = "",
  items = [],
}) {
  return (
    <div className="actsrecap">
      <header className="actsrecap__head scene__anim">
        <span className="actsrecap__mark" aria-hidden="true" />
        <p className="actsrecap__eyebrow">{eyebrow}</p>
        <h2 className="actsrecap__title">{title}</h2>
        <p className="actsrecap__intro">{text}</p>
      </header>

      <ol className="actsrecap__list">
        {items.map((it, i) => (
          <li
            key={it.num || i}
            className={`actsrecap__row scene__anim ${it.current ? "is-current" : ""}`.trim()}
          >
            <span className="actsrecap__num">{it.num}</span>
            <span className="actsrecap__name">{it.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}