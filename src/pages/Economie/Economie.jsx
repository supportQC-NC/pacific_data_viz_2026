// src/pages/Economie/Economie.jsx — Chapitre 4 : L'Économie (Pertes & Attractivité).
import React from "react";
import ChapterShell from "../../components/ChapterShell/ChapterShell";
import LossStack from "../../components/LossStack/LossStack";
import TourismBeach from "../../components/TourismBeach/TourismBeach";
import StiltHouse from "../../components/StiltHouse/StiltHouse";

export default function Economie() {
  return (
    <ChapterShell
      accent="economie"
      eyebrowKey="chapters.economie.eyebrow"
      titleKey="chapters.economie.title"
      ledeKey="chapters.economie.lede"
    >
      <LossStack />
      <TourismBeach />
      <StiltHouse />
    </ChapterShell>
  );
}