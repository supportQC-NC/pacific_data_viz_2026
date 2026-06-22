// src/pages/Terre/Terre.jsx — Chapitre 2 : La Terre (Rendement & Couverture).
import React from "react";
import ChapterShell from "../../components/ChapterShell/ChapterShell";
import PlantGrowth from "../../components/PlantGrowth/PlantGrowth";
import ForestCover from "../../components/ForestCover/ForestCover";
import CattleThrive from "../../components/CattleThrive/CattleThrive";
import BiodiversityReef from "../../components/BiodiversityReef/BiodiversityReef";

export default function Terre() {
  return (
    <ChapterShell
      accent="terre"
      eyebrowKey="chapters.terre.eyebrow"
      titleKey="chapters.terre.title"
      ledeKey="chapters.terre.lede"
    >
      <PlantGrowth />
      <ForestCover />
      <CattleThrive />
      <BiodiversityReef />
    </ChapterShell>
  );
}