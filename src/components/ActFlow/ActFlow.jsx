// src/components/ActFlow/ActFlow.jsx
// ============================================================
// Enveloppe de PARCOURS pour une page d'acte. La page passe son contenu en
// children. En mode guidé : un ouvre-chapitre plein cadre ; puis le contenu
// de l'acte ; le header/footer globaux sont masqués sur une page d'acte.
// Le NUMÉRO d'acte, le MOUVEMENT et le tag sont dérivés du parcours
// (journeyContext) — aucune numérotation codée en dur ici. Textes via i18n.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import EscaleTransition from "../EscaleTransition/EscaleTransition";
import "./ActFlow.scss";

// Mouvements narratifs qui se jouent à TERRE (la pirogue accoste au lieu de
// passer au large). Même règle que la coque du Récit — cf. pages/Recit.
const LAND_MOVEMENTS = new Set(["m3", "m4"]);

// Teinte de l'escale : slot 1 de la palette de séries validée.
const ACCENT = "#606dd6";

export default function ActFlow({ actId, children }) {
  const { t } = useLang();
  const { guided, markSeen, neighbors, movementOf, setImmersive, lastActRef } =
    useJourney();
  const { index, total } = neighbors(actId);

  // Mouvement narratif de l'acte : il décide du décor de la traversée.
  const movement = movementOf(actId);
  const movementId = movement ? movement.id : "m1";

  // LA TRAVERSÉE EST UN DÉPLACEMENT, PAS UNE PREMIÈRE DÉCOUVERTE.
  //
  // Auparavant : `guided && !seen[actId]` — donc une seule traversée par acte,
  // et `seen` étant persisté en localStorage, un visiteur qui revenait le
  // lendemain n'en voyait plus aucune. Revenir sur un acte déjà vu n'en
  // déclenchait pas non plus (mesuré : 3 traversées sur 5 sur un parcours
  // 01→02→03→02→03).
  //
  // Désormais on compare l'acte affiché au DERNIER acte visité dans la
  // session : s'il a changé, il y a eu déplacement, donc traversée — même
  // vers un acte déjà visité, et dans les deux sens. Si `lastAct` est null,
  // c'est un (re)chargement de page : pas de traversée.
  //
  // ⚠️ La décision se prend dans un EFFET, pas dans l'initialiseur de state :
  // React RÉCONCILIE ActFlow d'une route d'acte à l'autre (les 12 routes
  // rendent le même composant au même endroit de l'arbre). Il n'est donc PAS
  // remonté — il reçoit seulement un nouveau `actId`, et un initialiseur ne
  // rejouerait jamais. Mesuré : 0 traversée sur 5 avec cette approche.
  const [revealed, setRevealed] = useState(true);

  // Garde-fou StrictMode : en développement les effets sont joués deux fois.
  // Sans ce témoin, la seconde exécution verrait `lastActRef` déjà à jour,
  // conclurait « pas de déplacement » et annulerait la traversée.
  const decidedFor = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (decidedFor.current === actId) return;
    const prev = lastActRef.current;
    // Déplacement = on était déjà sur un AUTRE acte dans cette session.
    // `prev === null` → (re)chargement de page, pas un déplacement.
    const moved = guided && prev !== null && prev !== actId;
    setRevealed(!moved);
    lastActRef.current = actId;
    decidedFor.current = actId;
  }, [actId, guided, lastActRef]);

  // Quitter le mode guidé depuis un acte doit révéler le contenu tout de
  // suite, sinon on resterait bloqué sur la traversée.
  useEffect(() => {
    if (!guided) setRevealed(true);
  }, [guided]);

  // Sur une page d'acte, header et footer globaux s'effacent (via le contexte).
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);

  // (L'ancienne image d'ouvre-chapitre --intro-img n'a plus d'objet : la
  // traversée fournit son propre décor — ciel, mer, aube, pirogue.)

  // L'image reste en FOND de tout l'acte (board + KPI + chargement).
  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.style.setProperty(
        "--act-img",
        `url("/intro/${actId}.jpg")`,
      );
    }
  }, [actId]);

  const reveal = () => {
    markSeen(actId);
    setRevealed(true);
  };

  const num = String(index + 1).padStart(2, "0");

  // Tag composé : « Acte 03 » (+ éventuel nom court de l'acte, ex. « — L'assiette »).
  const actName = t(`home.acts.${actId}_name`);
  const tag = `${t("flow.act")} ${num}${actName ? ` — ${actName}` : ""}`;

  return (
    <div className="actflow" ref={rootRef}>
      {/* LA TRAVERSÉE — écran d'entrée dans l'acte, en mode guidé.
          Ce n'est plus un simple ouvre-chapitre : c'est une escale du voyage.
          La pirogue avance entre CHAQUE dashboard, avec le même langage
          visuel que le Prologue (ciel étoilé, mer, aube qui se lève) — la
          donnée n'est pas une page qu'on ouvre, c'est une escale qu'on
          atteint. Même composant que le Récit : aucune duplication.

          Le décor vient du MOUVEMENT narratif de l'acte : les mouvements
          « Ressources & vivant » et « L'humain en première ligne » se jouent
          à terre, la pirogue y accoste. */}
      {!revealed && (
        <EscaleTransition
          key={actId}
          kicker={`${tag} · ${t("flow.step")} ${num} / ${total}`}
          title={t(`home.acts.${actId}_title`)}
          subtitle={t(`home.acts.${actId}_text`)}
          accent={ACCENT}
          enterLabel={t("flow.reveal")}
          scene={LAND_MOVEMENTS.has(movementId) ? "land" : "sea"}
          onEnter={reveal}
        />
      )}

      {/* Contenu réel de l'acte */}
      {revealed && children}
    </div>
  );
}