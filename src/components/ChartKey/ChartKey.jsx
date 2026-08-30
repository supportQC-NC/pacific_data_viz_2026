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
import KeyFigures from "../KeyFigures/KeyFigures";
import "./ChartKey.scss";

export default function ChartKey({
  title,
  more = null,
  // Les chiffres-clés de l'ESCALE — les mêmes sur toutes ses vues, donc un
  // point d'ancrage : un repère qui changerait à chaque onglet n'en serait pas un.
  figures = null,
  finding,
  y,
  x,
  color,
  caveat,
  note,
  takeaway,
  hint,
  controls,
  swatch = "polarity",
  labels = {},
}) {
  if (
    !title &&
    !finding &&
    !(figures && figures.length) &&
    !y &&
    !x &&
    !color &&
    !note &&
    !takeaway &&
    !hint &&
    !controls
  )
    return null;

  const hasAxes = y || x || color || caveat;

  return (
    <aside className="chartkey">
      {/* LE TITRE DE LA VUE VIT ICI, pas au-dessus du tracé.
          Au-dessus, il occupait une bande pleine largeur avec sa phrase de
          résumé — deux lignes de texte à traverser avant d'atteindre la
          donnée, et autant de hauteur en moins pour elle. Dans la colonne,
          il a la place de respirer et il ouvre la lecture au bon endroit :
          juste avant les explications qui le suivent.
          LA PHRASE DE RÉSUMÉ EST DE RETOUR — ET C'ÉTAIT UNE ERREUR DE
          L'AVOIR RETIRÉE. On l'avait jugée redondante avec la clé de lecture.
          Elle ne l'est pas : la clé nomme les AXES (« émissions par habitant,
          en tonnes »), la phrase nomme ce qu'on REGARDE (« une barre = un
          territoire, sa longueur = ce qu'il émet cette année-là »). Un
          lecteur qui n'a pas l'habitude des graphiques a besoin de la
          seconde avant la première : il faut savoir ce qu'est une marque
          avant de savoir ce que mesure l'axe qui la porte.
          Écrite pour les onze escales, elle ne s'affichait nulle part sur un
          écran large — seulement derrière le « + » et sous 1180 px. */}
      {/* LES COMMANDES, EN TÊTE DE COLONNE ET SUR UNE LIGNE.
          Elles étaient plus bas, sous un intertitre « Régler », chacune
          précédée de son étiquette en capitales. Trois lignes de texte pour
          deux menus déroulants — qu'un menu déroulant se manipule, personne
          n'a besoin qu'on le lui écrive.

          Elles passent donc au-dessus du titre : c'est le premier geste
          qu'on fait sur une vue, avant même de lire ce qu'elle montre. Sans
          intertitre, sans étiquettes, côte à côte. */}
      {controls ? <div className="chartkey__controls">{controls}</div> : null}

      {/* LA ZONE QUI DÉFILE. Elle tient le titre et les explications ; les
          commandes restent au-dessus et la source en dessous, toutes deux
          toujours visibles. Sans cette séparation, ajouter « Ce que vous
          regardez » repoussait la source hors de l'écran sur sept vues. */}
      <div className="chartkey__flow">
        {/* LES CHIFFRES D'ABORD, AVANT MÊME LE TITRE DE LA VUE.
            C'est ce que le lecteur emporte s'il ne lit rien d'autre, et ils ne
            changent pas d'un onglet à l'autre : le titre, lui, change. */}
        {figures && figures.length ? (
          <KeyFigures items={figures} label={labels.figures} />
        ) : null}

          {title ? (
          <header className="chartkey__top">
            <h2 className="chartkey__title">{title}</h2>
            {more}
          </header>
        ) : null}

        {finding ? (
          <section className="chartkey__block chartkey__block--finding">
            <h3 className="chartkey__head">{labels.finding || "Ce que vous regardez"}</h3>
            <p className="chartkey__finding">{finding}</p>
          </section>
        ) : null}

      {/* L'ORDRE DE LA COLONNE : QUOI, PUIS POURQUOI, PUIS COMMENT.
          « Comment lire » venait en deuxième et poussait « Ce qu'il faut
          retenir » — la phrase qui donne l'intérêt de la vue — sous la ligne
          de flottaison sur les escales bavardes. Or les étiquettes d'axes
          sont de la référence : on y revient, on ne commence pas par elles.
          Le lecteur voit maintenant ce qu'il regarde, pourquoi ça compte,
          puis le détail des axes. */}
        {takeaway ? (
          <section className="chartkey__block chartkey__block--take">
            <h3 className="chartkey__head">{labels.takeaway || "À retenir"}</h3>
            <p className="chartkey__take">{takeaway}</p>
          </section>
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

            {/* UNE MISE EN GARDE DE MÉTHODE, quand la vue en appelle une.
                Certaines lectures sont justes en apparence et fausses en fait :
                une colonne qui couvre cinq ans à côté de colonnes qui en
                couvrent dix, un total qui dépend autant de la déclaration que du
                phénomène. Ces réserves vivaient dans la fiche « + », que
                personne n'ouvre avant de regarder. Elles se lisent maintenant
                avec les axes, là où elles changent la lecture. */}
            {caveat ? (
              <div className="chartkey__row chartkey__row--caveat">
                <span className="chartkey__glyph" aria-hidden="true">
                  !
                </span>
                <span className="chartkey__txt">
                  <span className="u-sr-only">{labels.caveat || "À savoir :"} </span>
                  {caveat}
                </span>
              </div>
            ) : null}
          </section>
        ) : null}

        {hint ? (
          <section className="chartkey__block">
            <h3 className="chartkey__head">{labels.explore || "Explorer"}</h3>
            <p className="chartkey__hint">{hint}</p>
          </section>
        ) : null}

      </div>

      {note ? <p className="chartkey__note">{note}</p> : null}
    </aside>
  );
}
