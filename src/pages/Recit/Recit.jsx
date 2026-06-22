// src/pages/Recit/Recit.jsx
// ============================================================
// LE RÉCIT — expérience CONTINUE. Les chapitres Va'a s'enchaînent dans un seul
// défilement : on plonge dans un chapitre (hero plein écran) puis on navigue
// le Pacifique, et le chapitre suivant prend le relais — sans coupure.
// Ordre actuel : Humain → Océan. (Terre, Économie, Énergie viendront s'insérer
// dans l'ordre causal au fur et à mesure.)
// ============================================================

import React from "react";
import Humain from "../Humain/Humain";
import Ocean from "../Ocean/Ocean";

export default function Recit() {
  return (
    <>
      <Humain />
      <Ocean />
    </>
  );
}