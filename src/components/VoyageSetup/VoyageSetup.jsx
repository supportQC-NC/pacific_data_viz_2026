// src/components/VoyageSetup/VoyageSetup.jsx
// ============================================================
// LE SEUIL DU VOYAGE — un réglage, avant la première scène : LA LANGUE.
//
// « Découvrir » partait droit vers /recit, et la langue était devinée
// depuis `navigator.language` : un lecteur anglophone sur un poste
// configuré en français commençait le voyage en français, puis devait
// trouver un sélecteur dans l'en-tête pour recommencer. Le concours exige
// les deux langues : autant demander plutôt que parier.
//
// L'étape « Affichage » a été RETIRÉE. Datamoana se lit en sombre, et
// seulement en sombre (voir store/context/themeContext.js) : proposer un
// thème clair revenait à ouvrir une version qu'on ne défend pas.
//
// Deux règles de conception, inchangées :
//
//   1. LE CHOIX SE VOIT AVANT D'ÊTRE VALIDÉ. Cliquer une langue l'applique
//      immédiatement — le panneau lui-même change de langue. On ne demande
//      pas au lecteur de choisir à l'aveugle entre deux mots.
//   2. RENONCER NE COÛTE RIEN. Échap, le fond, ou « Pas encore » remettent
//      la langue d'avant l'ouverture. Un panneau qui laisse des traces
//      quand on le referme est un piège.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../../store/context/langContext";
import "./VoyageSetup.scss";

export default function VoyageSetup({ open, onConfirm, onCancel }) {
  const { lang, setLang, t } = useLang();

  // L'état d'AVANT. On le fige à l'ouverture pour pouvoir le rendre intact si
  // le lecteur renonce — les aperçus en direct ont modifié le vrai réglage,
  // pas une copie.
  const entering = useRef({ lang });
  const panelRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }
    entering.current = { lang };
    setReady(true);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cancel = useCallback(() => {
    setLang(entering.current.lang);
    if (onCancel) onCancel();
  }, [onCancel, setLang]);

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
