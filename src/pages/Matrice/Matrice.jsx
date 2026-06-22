// src/pages/Matrice/Matrice.jsx — Synthèse : Matrice de Résilience (radar à venir, étape 6).
import React from "react";
import ChapterShell from "../../components/ChapterShell/ChapterShell";
import { useLang } from "../../store/context/langContext";

export default function Matrice() {
  const { t } = useLang();
  return (
    <ChapterShell
      accent="ocean"
      eyebrowKey="chapters.matrice.eyebrow"
      titleKey="chapters.matrice.title"
      ledeKey="chapters.matrice.lede"
    >
      <p className="chapter__todo">{t("chapters.matrice.todo")}</p>
    </ChapterShell>
  );
}