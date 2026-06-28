// src/pages/Recit/Recit.jsx
// ============================================================
// LE RÉCIT — coque du voyage (en construction).
// Couverture (Prologue) → TRAVERSÉE EN PIROGUE → contenu de l'Escale I.
// Phases : "cover" → "transition" → "escale1".
// ============================================================

import React, { useState } from "react";
import RecitPrologue from "../../components/RecitPrologue/RecitPrologue";
import EscaleTransition from "../../components/EscaleTransition/EscaleTransition";
import EscaleOcean from "./escales/EscaleOcean";
import { useLang } from "../../store/context/langContext";

export default function Recit() {
  const { lang } = useLang();
  const [phase, setPhase] = useState("cover");

  const e1 =
    lang === "en"
      ? {
          kicker: "Leg I",
          title: "The Ocean’s Fever",
          subtitle: "Beneath the hull, a sea that warms and swells.",
          enter: "Enter the leg",
        }
      : {
          kicker: "Escale I",
          title: "La Fièvre de l’Océan",
          subtitle: "Sous la coque, une mer qui se réchauffe et se soulève.",
          enter: "Entrer dans l’escale",
        };

  return (
    <>
      {phase === "cover" && (
        <RecitPrologue onStart={() => setPhase("transition")} />
      )}

      {phase === "transition" && (
        <EscaleTransition
          kicker={e1.kicker}
          title={e1.title}
          subtitle={e1.subtitle}
          accent="#5ec8d8"
          enterLabel={e1.enter}
          onEnter={() => setPhase("escale1")}
        />
      )}

      {phase === "escale1" && <EscaleOcean />}
    </>
  );
}
