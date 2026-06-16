// src/components/charts/VerdictPanel/VerdictPanel.jsx
// ============================================================
// Final de la synthèse — version moderne. Chaque sous-bloc porte
// "scene__anim" pour entrer en cascade (GSAP staggered de l'acte). KPI à
// hauteurs égales (libellés alignés en bas, barre d'accent en tête), panneau
// limites aéré avec filet central, CTA monochromes inversés. Tout via tokens,
// aucune dépendance au SCSS de l'acte. Textes en props (i18n par le parent).
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import "./VerdictPanel.scss";

export default function VerdictPanel({
  className = "",
  eyebrow = "",
  title = "",
  text = "",
  stats = [],
  limitsKicker = "",
  limits = [],
  primary = null,
  secondary = null,
}) {
  return (
    <div className={`verdict ${className}`.trim()}>
      <p className="verdict__eyebrow scene__anim">{eyebrow}</p>
      <h2 className="verdict__title scene__anim">{title}</h2>
      <p className="verdict__intro scene__anim">{text}</p>

      {stats.length ? (
        <div className="verdict__kpis">
          {stats.map((k, i) => (
            <div className="verdict__kpi scene__anim" key={i}>
              <span
                className={`verdict__kpi-bar is-${k.tone || "accent"}`}
                aria-hidden="true"
              />
              <span className="verdict__kpi-value">
                {k.value}
                {k.suffix ? (
                  <span className="verdict__kpi-suffix">{k.suffix}</span>
                ) : null}
              </span>
              <span className="verdict__kpi-label">{k.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {limits.length ? (
        <div className="verdict__limits scene__anim">
          <p className="verdict__limits-kicker">{limitsKicker}</p>
          <ul className="verdict__limits-list">
            {limits.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {primary || secondary ? (
        <div className="verdict__cta-row scene__anim">
          {primary ? (
            <Link
              to={primary.to}
              className="verdict__cta verdict__cta--primary"
            >
              {primary.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link to={secondary.to} className="verdict__cta">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}