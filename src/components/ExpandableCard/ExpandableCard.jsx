// src/components/ExpandableCard/ExpandableCard.jsx
// ============================================================
// Cadre réutilisable pour un graphique : en-tête (titre + sous-titre) et
// bouton « Agrandir » qui ouvre le contenu en grand dans un overlay
// (modal). Fermeture par Échap, clic sur le fond, ou bouton. Verrou de
// défilement de la page pendant l'ouverture.
// Le contenu (children) est rendu en place ET, quand ouvert, dans le
// modal — adapté aux graphiques SVG (viewBox) qui s'agrandissent seuls.
// Aucun style inline : tout est dans ExpandableCard.scss.
// ============================================================

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./ExpandableCard.scss";

export default function ExpandableCard({
  title,
  sub,
  expandLabel = "Agrandir",
  closeLabel = "Fermer",
  children,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("is-modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-modal-open");
    };
  }, [open]);

  return (
    <section className="xcard">
      <div className="xcard__head">
        <div className="xcard__titles">
          {title && <h3 className="xcard__title">{title}</h3>}
          {sub && <span className="xcard__sub">{sub}</span>}
        </div>
        <button
          className="xcard__expand"
          onClick={() => setOpen(true)}
          aria-label={expandLabel}
        >
          <span aria-hidden="true">⤢</span> {expandLabel}
        </button>
      </div>

      <div className="xcard__body">{children}</div>

      {open &&
        createPortal(
          <div
            className="xmodal"
            role="dialog"
            aria-modal="true"
            aria-label={title || expandLabel}
            onClick={() => setOpen(false)}
          >
            <div className="xmodal__panel" onClick={(e) => e.stopPropagation()}>
              <div className="xmodal__head">
                <div className="xcard__titles">
                  {title && <h3 className="xmodal__title">{title}</h3>}
                  {sub && <span className="xcard__sub">{sub}</span>}
                </div>
                <button className="xmodal__close" onClick={() => setOpen(false)}>
                  <span aria-hidden="true">✕</span> {closeLabel}
                </button>
              </div>
              <div className="xmodal__body">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}