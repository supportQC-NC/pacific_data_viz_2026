// src/components/DataSpotlight/DataSpotlight.jsx
// ============================================================
// « Fiche d'identité » d'un jeu de données, affichée comme une vue à part
// entière dans le board d'un acte : lignes clé/valeur (source, code
// indicateur, unité, licence…), notes de méthode, et un encart « lire une
// valeur » avec un exemple officiel. Zéro chiffre calculé ici : tout le
// contenu vient de l'i18n / des métadonnées officielles du jeu.
// Props :
//   rows  : [{ k, v }]            — lignes clé/valeur
//   notes : [string]              — puces de méthode / limites assumées
//   example : { kicker, text }    — encart « lire une valeur »
//   link  : { href, label }       — lien vers la source d'origine
// ============================================================
import React from "react";
import "./DataSpotlight.scss";

export default function DataSpotlight({ rows = [], notes = [], example, link }) {
  return (
    <div className="dataspot">
      {rows.length ? (
        <dl className="dataspot__grid">
          {rows.map((r) => (
            <div className="dataspot__row" key={r.k}>
              <dt className="dataspot__k">{r.k}</dt>
              <dd className="dataspot__v">{r.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {notes.length ? (
        <ul className="dataspot__notes">
          {notes.map((n) => (
            <li className="dataspot__note" key={n}>
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      {example && example.text ? (
        <div className="dataspot__example">
          {example.kicker ? <p className="dataspot__example-kicker">{example.kicker}</p> : null}
          <p className="dataspot__example-text">{example.text}</p>
        </div>
      ) : null}

      {link && link.href ? (
        <a className="dataspot__link" href={link.href} target="_blank" rel="noopener noreferrer">
          {link.label || link.href} <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </div>
  );
}