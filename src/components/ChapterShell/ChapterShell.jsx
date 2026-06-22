// src/components/ChapterShell/ChapterShell.jsx
// ============================================================
// Ossature commune d'un CHAPITRE (Datamoana 2.0). Affiche une intro
// éditoriale (eyebrow + titre + chapô) puis le corps (les graphiques du
// chapitre passés en enfants). À l'étape 3, le corps deviendra un
// scrollytelling ; ici il empile simplement les composants existants.
// i18n via t() — aucune chaîne en dur. Zéro style inline.
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import "./ChapterShell.scss";

export default function ChapterShell({
  accent = "ocean",
  eyebrowKey,
  titleKey,
  ledeKey,
  children,
}) {
  const { t } = useLang();
  return (
    <main className={`chapter chapter--${accent}`}>
      <header className="chapter__intro">
        <Link to="/" className="chapter__back">
          <FiArrowLeft aria-hidden="true" />
          <span>{t("chapters.back")}</span>
        </Link>
        <p className="chapter__eyebrow">{t(eyebrowKey)}</p>
        <h1 className="chapter__title">{t(titleKey)}</h1>
        <p className="chapter__lede">{t(ledeKey)}</p>
      </header>

      <div className="chapter__body">{children}</div>
    </main>
  );
}