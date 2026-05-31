// src/components/ReadingGuide/ReadingGuide.jsx
// ============================================================
// Guide de lecture d'un acte. Contenu 100 % externalisé (i18n).
// Props :
//   title    : string
//   intro    : string
//   steps    : [{ k: "titre court", v: "explication" }]
//   takeaway : string (encart "à retenir")
// ============================================================

import React from "react";
import "./ReadingGuide.scss";

export default function ReadingGuide({ title, intro, steps = [], takeaway }) {
  return (
    <aside className="guide">
      <h2 className="guide__title">{title}</h2>
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
          <span className="guide__takeaway-tag">★</span>
          {takeaway}
        </p>
      )}
    </aside>
  );
}
