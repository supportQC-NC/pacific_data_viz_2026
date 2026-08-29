// src/components/VoyageSetup/VoyageSetup.jsx
// ============================================================
// LE SEUIL DU VOYAGE — deux réglages, avant la première scène.
//
// « Découvrir » partait droit vers /recit. Deux choix restaient alors
// implicites, et ce sont précisément les deux qui décident de ce que le
// lecteur va voir :
//
//   • LA LANGUE. Elle était devinée depuis `navigator.language` — un
//     lecteur anglophone sur un poste configuré en français commençait le
//     voyage en français et devait trouver un sélecteur dans l'en-tête,
//     après coup, pour recommencer. Le concours exige les deux langues :
//     autant demander plutôt que parier.
//
//   • L'AFFICHAGE. Le thème suivait `prefers-color-scheme`, donc un système
//     en clair ouvrait l'expérience en clair — alors que le récit est dessiné
//     pour l'obscurité : ciel étoilé, pirogue sur la houle, cartes de nuit,
//     trajectoires de cyclones. Ça reste lisible en clair (les rampes sont
//     déclarées dans les deux thèmes), mais ce n'est pas ce qu'on a composé.
//
// Deux règles de conception :
//
//   1. LE CHOIX SE VOIT AVANT D'ÊTRE VALIDÉ. Cliquer une option l'applique
//      immédiatement — la page derrière le panneau change de thème, le
//      panneau lui-même change de langue. On ne demande pas au lecteur de
//      choisir à l'aveugle entre deux mots.
//   2. RENONCER NE COÛTE RIEN. Échap, le fond, ou « Pas encore » remettent
//      l'état exact d'avant l'ouverture — langue ET thème. Un panneau qui
//      laisse des traces quand on le referme est un piège.
//
// Le sombre est présélectionné à l'ouverture, quel que soit le réglage
// système : c'est la recommandation, et elle est écrite sur la carte.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../../store/context/langContext";
import { useTheme } from "../../store/context/themeContext";
import "./VoyageSetup.scss";

export default function VoyageSetup({ open, onConfirm, onCancel }) {
  const { lang, setLang, t } = useLang();
  const { theme, setTheme } = useTheme();

  // L'état d'AVANT. On le fige à l'ouverture pour pouvoir le rendre intact si
  // le lecteur renonce — les aperçus en direct ont modifié le vrai réglage,
  // pas une copie.
  const entering = useRef({ lang, theme });
  const panelRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }
    entering.current = { lang, theme };
    // LE SOMBRE EST LE DÉFAUT RECOMMANDÉ, pas le réglage système. Si le poste
    // est en clair, le panneau bascule en sombre dès l'ouverture : c'est la
    // proposition, et elle se voit au lieu de se lire.
    setTheme("dark");
    setReady(true);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cancel = useCallback(() => {
    setLang(entering.current.lang);
    setTheme(entering.current.theme);
    if (onCancel) onCancel();
  }, [onCancel, setLang, setTheme]);

  // Échap referme et restaure. Le panneau prend le focus à l'ouverture pour
  // que la touche arrive bien ici et non sur la page dessous.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    const el = panelRef.current;
    if (el) {
      const first = el.querySelector("button");
      if (first) first.focus();
    }
    // La page dessous ne défile plus tant que le seuil est ouvert.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, cancel]);

  if (!open || !ready) return null;

  // Les libellés de langue ne passent PAS par le dictionnaire : une langue se
  // nomme dans sa propre langue, sinon le lecteur anglophone cherche
  // « Anglais » dans une liste écrite en français.
  const LANGS = [
    { id: "fr", label: "Français", note: "Version française" },
    { id: "en", label: "English", note: "English version" },
  ];

  const MODES = [
    {
      id: "dark",
      label: t("home.setup.dark"),
      note: t("home.setup.dark_note"),
      recommended: true,
    },
    { id: "light", label: t("home.setup.light"), note: t("home.setup.light_note") },
  ];

  return createPortal(
    <div
      className="vsetup"
      role="dialog"
      aria-modal="true"
      aria-label={t("home.setup.title")}
    >
      <button
        type="button"
        className="vsetup__scrim"
        aria-label={t("home.setup.cancel")}
        onClick={cancel}
      />

      <div className="vsetup__panel" role="document" ref={panelRef}>
        <header className="vsetup__head">
          <p className="eyebrow vsetup__eyebrow">{t("home.setup.kicker")}</p>
          <h2 className="vsetup__title">{t("home.setup.title")}</h2>
          <p className="vsetup__sub">{t("home.setup.sub")}</p>
        </header>

        {/* ---------- LA LANGUE ---------- */}
        <fieldset className="vsetup__group">
          <legend className="vsetup__legend">{t("home.setup.lang")}</legend>
          <div className="vsetup__cards">
            {LANGS.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`vsetup__card ${lang === it.id ? "is-on" : ""}`}
                aria-pressed={lang === it.id}
                onClick={() => setLang(it.id)}
              >
                <span className="vsetup__card-code" aria-hidden="true">
                  {it.id.toUpperCase()}
                </span>
                <span className="vsetup__card-body">
                  <span className="vsetup__card-label">{it.label}</span>
                  <span className="vsetup__card-note">{it.note}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* ---------- L'AFFICHAGE ---------- */}
        <fieldset className="vsetup__group">
          <legend className="vsetup__legend">{t("home.setup.display")}</legend>
          <div className="vsetup__cards">
            {MODES.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`vsetup__card vsetup__card--mode ${
                  theme === it.id ? "is-on" : ""
                }`}
                aria-pressed={theme === it.id}
                onClick={() => setTheme(it.id)}
              >
                {/* L'ÉCHANTILLON MONTRE LE THÈME QU'IL PROPOSE, PAS LE THÈME
                    ACTIF. C'est le seul endroit de l'application où une
                    couleur en dur est juste : `var(--c-*)` donnerait ici deux
                    vignettes identiques, celles du thème courant, et la carte
                    « Clair » se peindrait en sombre. Les valeurs sont celles
                    des deux blocs de `_variables.scss`. */}
                <span
                  className={`vsetup__swatch vsetup__swatch--${it.id}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
                <span className="vsetup__card-body">
                  <span className="vsetup__card-label">
                    {it.label}
                    {it.recommended ? (
                      <em className="vsetup__badge">
                        {t("home.setup.recommended")}
                      </em>
                    ) : null}
                  </span>
                  <span className="vsetup__card-note">{it.note}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <footer className="vsetup__foot">
          <button
            type="button"
            className="vsetup__go"
            onClick={() => onConfirm && onConfirm()}
          >
            {t("home.setup.start")} <span aria-hidden="true">✦</span>
          </button>
          <button type="button" className="vsetup__back" onClick={cancel}>
            {t("home.setup.cancel")}
          </button>
          <p className="vsetup__later">{t("home.setup.later")}</p>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
