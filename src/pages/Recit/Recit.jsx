// src/pages/Recit/Recit.jsx
// ============================================================
// LE RÉCIT — coque du voyage en pirogue.
//
// Chaque ACTE est une ESCALE. L'ordre vient de JOURNEY (journeyContext),
// source de vérité unique du parcours : réordonner le récit se fait là-bas,
// jamais ici.
//
// Phases : "cover" → "transition" → "escale" → … → "closing".
//   cover      · RecitPrologue (ciel étoilé, lanterne au curseur)
//   transition · EscaleTransition (mêmes étoiles) annonce l'escale
//   escale     · contenu de l'escale + <VoyageBar> (quitter · progression ·
//                continuer). C'est cette barre qui corrige le cul-de-sac :
//                avant, une fois entré dans une escale, on ne pouvait ni
//                poursuivre ni sortir du voyage.
//   closing    · clôture rédigée (recit.closing_*) puis sortie vers les actes.
//
// Seule l'escale Océan a un contenu sur mesure (EscaleOcean). Pour les autres
// actes, on ouvre la page d'acte existante : on ne réimplémente rien.
// ============================================================

import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RecitPrologue from "../../components/RecitPrologue/RecitPrologue";
import EscaleTransition from "../../components/EscaleTransition/EscaleTransition";
import VoyageBar from "../../components/VoyageBar/VoyageBar";
import EscaleOcean from "./escales/EscaleOcean";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";

// Escales disposant d'un contenu sur mesure dans le Récit. Les autres actes
// sont ouverts sur leur page existante (aucune duplication de contenu).
const BESPOKE = { a2: EscaleOcean };

// Accent par escale : repris de la teinte de série validée du slot 1 pour
// rester dans la charte (cf. _variables.scss § PALETTE DATAVIZ).
const ACCENT = "#606dd6";

// Décor de la traversée, dérivé du MOUVEMENT narratif de l'acte — pas d'une
// liste parallèle à maintenir. journeyContext groupe déjà les actes :
//   m3 « Ressources & vivant »        → agriculture, biodiversité
//   m4 « L'humain en première ligne » → la côte, l'eau, les catastrophes
// Ces deux mouvements se jouent à TERRE : la pirogue y accoste.
// Les autres (constat, climat physique, riposte) restent au large.
const LAND_MOVEMENTS = new Set(["m3", "m4"]);

export default function Recit() {
  const { t, lang } = useLang();
  const { journey, startJourney, exitJourney, movementOf } = useJourney();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("cover");
  const [index, setIndex] = useState(0); // position dans JOURNEY

  const total = journey.length;
  const act = journey[index] || null;

  // Repli lisible tant qu'une clé i18n n'existe pas encore.
  const tf = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );

  const copy = useMemo(
    () => ({
      exit: tf("recit.voyage_exit", "Quitter le voyage", "Leave the voyage"),
      next: tf("recit.voyage_next", "Escale suivante", "Next leg"),
      enter: tf("recit.voyage_enter", "Entrer dans l’escale", "Enter the leg"),
      bar: tf("recit.voyage_aria", "Navigation du voyage", "Voyage navigation"),
      progress: tf("recit.voyage_progress", "Progression du voyage", "Voyage progress"),
      legWord: tf("recit.voyage_leg", "Escale", "Leg"),
    }),
    [tf],
  );

  // Quitter : on coupe aussi le mode guidé, sinon les actes garderaient
  // l'ouvre-chapitre du parcours alors que le voyage est terminé.
  const leave = useCallback(() => {
    exitJourney();
    navigate("/");
  }, [exitJourney, navigate]);

  const beginVoyage = useCallback(() => {
    startJourney(); // le voyage EST le parcours guidé : même état, pas un doublon
    setIndex(0);
    setPhase("transition");
  }, [startJourney]);

  // Entrer dans l'escale : contenu sur mesure si on en a un, sinon la page
  // d'acte existante (le mode guidé y affiche déjà l'ouvre-chapitre).
  const enterLeg = useCallback(() => {
    const id = journey[index] && journey[index].id;
    if (BESPOKE[id]) setPhase("escale");
    else navigate(journey[index].to);
  }, [journey, index, navigate]);

  const nextLeg = useCallback(() => {
    if (index + 1 >= total) {
      setPhase("closing");
      return;
    }
    setIndex((i) => i + 1);
    setPhase("transition");
  }, [index, total]);

  const Bespoke = act ? BESPOKE[act.id] : null;

  // Atterrage ou haute mer, selon le mouvement narratif de l'escale.
  const legScene = useMemo(() => {
    if (!act) return "sea";
    const m = movementOf(act.id);
    return m && LAND_MOVEMENTS.has(m.id) ? "land" : "sea";
  }, [act, movementOf]);

  return (
    <>
      {phase === "cover" && <RecitPrologue onStart={beginVoyage} />}

      {phase === "transition" && act && (
        <EscaleTransition
          // `key` : sans elle React réutiliserait l'instance d'une escale à
          // l'autre et l'entrée cinématique GSAP ne rejouerait pas.
          key={act.id}
          kicker={`${copy.legWord} ${String(index + 1).padStart(2, "0")}`}
          title={t(`home.acts.${act.id}_title`)}
          subtitle={t(`home.acts.${act.id}_text`)}
          accent={ACCENT}
          enterLabel={copy.enter}
          scene={legScene}
          onEnter={enterLeg}
        />
      )}

      {phase === "escale" && Bespoke && (
        <>
          <Bespoke />
          <VoyageBar
            index={index + 1}
            total={total}
            label={copy.bar}
            progressAria={copy.progress}
            nextLabel={copy.next}
            exitLabel={copy.exit}
            onNext={nextLeg}
            onExit={leave}
          />
        </>
      )}

      {phase === "closing" && (
        <EscaleTransition
          kicker={t("recit.closing_eyebrow")}
          title={t("recit.closing_title")}
          subtitle={t("recit.closing_quote")}
          accent={ACCENT}
          enterLabel={t("recit.cta_acts")}
          onEnter={() => navigate("/actes")}
        />
      )}
    </>
  );
}
