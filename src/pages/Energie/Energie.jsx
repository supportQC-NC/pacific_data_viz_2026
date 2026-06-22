// src/pages/Energie/Energie.jsx — Chapitre 5 : L'Énergie (Transition & Atténuation).
import React from "react";
import ChapterShell from "../../components/ChapterShell/ChapterShell";
import PowerMix from "../../components/PowerMix/PowerMix";
import EnergyCell from "../../components/EnergyCell/EnergyCell";
import SmokePlume from "../../components/SmokePlume/SmokePlume";

export default function Energie() {
  return (
    <ChapterShell
      accent="energie"
      eyebrowKey="chapters.energie.eyebrow"
      titleKey="chapters.energie.title"
      ledeKey="chapters.energie.lede"
    >
      <PowerMix />
      <EnergyCell />
      <SmokePlume />
    </ChapterShell>
  );
}