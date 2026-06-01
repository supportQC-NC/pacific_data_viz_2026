// src/components/ReadingGuide/ReadingGuide.jsx
// ============================================================
// Guide de lecture d'un acte, en ACCORDEON (ferme par defaut).
// En-tete (titre + chevron) qui deplie / replie le corps en douceur.
// Sous-panneau repliable "Source & methode". Contenu externalise (i18n).
// Props : title, intro, steps[{k,v}], takeaway, defaultOpen,
//         source{provider,dataset,frequency,updated,license,method,
//         example,link}, sourceLabels
// ============================================================

import React, { useId, useState } from "react";
import "./ReadingGuide.scss";

export default function ReadingGuide({
  title,
  intro,
  steps = [],
  takeaway,
  defaultOpen = false,
  source = null,
  sourceLabels = null,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [srcOpen, setSrcOpen] = useState(false);
  const bodyId = useId();
  const srcId = useId();

  const L = sourceLabels || {};
  const meta = source
    ? [
        { label: L.provider, value: source.provider },
        { label: L.dataset, value: source.dataset },
        { label: L.frequency, value: source.frequency },
        { label: L.updated, value: source.updated },
        { label: L.license, value: source.license },
      ].filter((row) => row.value)
    : [];

  const toggleOpen = () => setOpen((o) => !o);
  const toggleSrc = () => setSrcOpen((o) => !o);

  return (
    <aside className={`guide ${open ? "guide--open" : ""}`}>
      <button type="button" className="guide__head" aria-expanded={open} aria-controls={bodyId} onClick={toggleOpen}>
        <h2 className="guide__title">{title}</h2>
        <span className="guide__chevron" aria-hidden="true" />
      </button>

      <div className="guide__body" id={bodyId} role="region" aria-label={title}>
        <div className="guide__body-inner">
          {intro && <p className="guide__intro">{intro}</p>}

          {steps.length > 0 && (
            <ol className="guide__steps">
              {steps.map((s, i) => (
                <li className="guide__step" key={s.k || i}>
                  <span className="guide__num">{i + 1}</span>
                  <span className="guide__step-body">
                    <span className="guide__step-k">{s.k}</span>
                    <span className="guide__step-v">{s.v}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {takeaway && (
            <p className="guide__takeaway">
              <span className="guide__takeaway-tag">{"\u2605"}</span>
              {takeaway}
            </p>
          )}

          {source && sourceLabels && (
            <div className={`guide__src ${srcOpen ? "guide__src--open" : ""}`}>
              <button type="button" className="guide__src-toggle" aria-expanded={srcOpen} aria-controls={srcId} onClick={toggleSrc}>
                <span className="guide__src-heading">{L.heading}</span>
                <span className="guide__src-chevron" aria-hidden="true" />
              </button>

              <div className="guide__src-body" id={srcId} role="region" aria-label={L.heading}>
                <div className="guide__src-inner">
                  {meta.length > 0 && (
                    <dl className="guide__src-list">
                      {meta.map((row) => (
                        <div className="guide__src-row" key={row.label}>
                          <dt className="guide__src-dt">{row.label}</dt>
                          <dd className="guide__src-dd">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {source.method && (
                    <p className="guide__src-note">
                      <span className="guide__src-tag">{L.method}</span>
                      {source.method}
                    </p>
                  )}

                  {source.example && (
                    <p className="guide__src-note guide__src-note--ex">
                      <span className="guide__src-tag">{L.example}</span>
                      {source.example}
                    </p>
                  )}

                  {source.link && (
                    <a className="guide__src-link" href={source.link} target="_blank" rel="noreferrer">
                      {L.link} {"\u2197"}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}