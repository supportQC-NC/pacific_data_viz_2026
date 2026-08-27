// src/components/ChartKey/ChartKey.jsx
// ============================================================
// COLONNE « COMMENT LIRE » d'un graphique — brique réutilisable par toutes
// les escales.
//
// Pourquoi elle existe : un tracé plein cadre n'est pas plus lisible qu'un
// tracé plus étroit dont on comprend les axes. Sur écran large, on rend donc
// de la largeur au graphique pour la donner à une colonne qui explique.
//
// CE QU'ELLE PORTE, et pourquoi tout est là plutôt qu'éparpillé :
//
//   1. LIRE      ce que porte la verticale, l'horizontale, la couleur.
//   2. À RETENIR la phrase de lecture. Elle vivait dans un bandeau pleine
//                largeur sous le tracé — une phrase courte étalée sur près
//                de deux mètres, qui volait 44 px de hauteur au graphique
//                et, comme elle n'apparaissait que sur la vue signature,
//                faisait sauter la hauteur du tracé d'un onglet à l'autre.
//   3. EXPLORER  ce qu'on peut faire. C'était caché derrière une pastille
//                de survol : une aide qui n'existe que si l'on pense à
//                chercher de l'aide.
//   4. SOURCE    d'où vient le chiffre, en pied de colonne.
//
// La colonne était remplie à 16–30 % de sa hauteur (mesuré : 524 à 631 px de
// vide selon la vue). Rassembler ici tout le texte du panneau la remplit,
// libère le tracé, et surtout regroupe en UN endroit ce que le lecteur doit
// savoir — au lieu de trois zones qu'il faut découvrir séparément.
//
// La pastille de couleur affiche la vraie rampe divergente du thème : elle
// MONTRE l'échelle au lieu de la décrire, et suit la bascule clair/sombre
// puisqu'elle est peinte en var(--c-div-*).
// ============================================================

import React from "react";
import "./ChartKey.scss";

export default function ChartKey({
  title,
  more = null,
  y,
  x,
  color,
  note,
  takeaway,
  hint,
  swatch = "polarity",
  labels = {},
}) {
  if (!title && !y && !x && !color && !note && !takeaway && !hint) return null;

  const hasAxes = y || x || color;

  return (
    <aside className="chartkey">
      {/* LE TITRE DE LA VUE VIT ICI, pas au-dessus du tracé.
          Au-dessus, il occupait une bande pleine largeur avec sa phrase de
          résumé — deux lignes de texte à traverser avant d'atteindre la
          donnée, et autant de hauteur en moins pour elle. Dans la colonne,
          il a la place de respirer et il ouvre la lecture au bon endroit :
          juste avant les explications qui le suivent.
          La phrase de résumé, elle, ne s'affiche plus : elle disait ce que
          la clé de lecture dit déjà, en plus long. Elle reste dans la fiche
          « + » pour qui veut le détail. */}
      {title ? (
        <header className="chartkey__top">
          <h2 className="chartkey__title">{title}</h2>
          {more}
        </header>
      ) : null}

      {hasAxes ? (
        <section className="chartkey__block">
          <h3 className="chartkey__head">{labels.read || "Lire"}</h3>

          {y ? (
            <div className="chartkey__row">
              <span className="chartkey__glyph" aria-hidden="true">
                ↕
              </span>
              <span className="chartkey__txt">
                <span className="u-sr-only">{labels.y || "Axe vertical :"} </span>
                {y}
              </span>
            </div>
          ) : null}

          {x ? (
            <div className="chartkey__row">
              <span className="chartkey__glyph" aria-hidden="true">
                ↔
              </span>
              <span className="chartkey__txt">
                <span className="u-sr-only">{labels.x || "Axe horizontal :"} </span>
                {x}
              </span>
            </div>
          ) : null}

          {color ? (
            <div className="chartkey__row">
              {/* La pastille MONTRE l'échelle au lieu de la décrire — encore
                  faut-il qu'elle montre la bonne. Elle affichait toujours la
                  rampe divergente, y compris en face d'une vue peinte en
                  grandeur : la colonne annonçait « une seule teinte » à côté
                  d'un dégradé à deux pôles. `swatch` suit donc l'encodage
                  déclaré par la vue. */}
              <span
                className={`chartkey__swatch chartkey__swatch--${swatch}`}
                aria-hidden="true"
              />
              <span className="chartkey__txt">
                <span className="u-sr-only">{labels.color || "Couleur :"} </span>
                {color}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {takeaway ? (
        <section className="chartkey__block chartkey__block--take">
          <h3 className="chartkey__head">{labels.takeaway || "À retenir"}</h3>
          <p className="chartkey__take">{takeaway}</p>
        </section>
      ) : null}

      {hint ? (
        <section className="chartkey__block">
          <h3 className="chartkey__head">{labels.explore || "Explorer"}</h3>
          <p className="chartkey__hint">{hint}</p>
        </section>
      ) : null}

      {note ? <p className="chartkey__note">{note}</p> : null}
    </aside>
  );
}
