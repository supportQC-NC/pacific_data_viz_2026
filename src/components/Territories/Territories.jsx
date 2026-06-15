// src/components/Territories/Territories.jsx
// ============================================================
// Section d'accueil : galerie des 22 pays & territoires couverts par Datamoana.
// Drapeaux servis directement par flagcdn (domaine public) — aucun fichier
// local à gérer. Les codes PICT étant des codes ISO 3166, l'URL se déduit du
// code (voir src/i18n/flagUrl.js). Repli SVG -> PNG -> code à 2 lettres si le
// CDN ne répond pas.
// Tokens only, dark/light, libellés via t().
// ============================================================

import React, { useState } from "react";
import { useLang } from "../../store/context/langContext";
import PICT_NAMES, { pictName } from "../../i18n/pictNames";
import { flagUrl } from "../../i18n/flagUrl";
import "./Territories.scss";

function FlagTile({ code, name }) {
  // 0 = svg, 1 = png (repli), 2 = pastille code (repli ultime)
  const [step, setStep] = useState(0);
  const src =
    step === 0
      ? flagUrl(code, { format: "svg" })
      : step === 1
        ? flagUrl(code, { format: "png", size: "256x192" })
        : null;

  return (
    <li className="territories__item">
      <div className="territories__link" aria-label={name}>
        <span className="territories__flag">
          {src ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setStep((s) => s + 1)}
            />
          ) : (
            <span className="territories__fallback" aria-hidden="true">
              {code}
            </span>
          )}
        </span>
        <span className="territories__name">{name}</span>
      </div>
    </li>
  );
}

export default function Territories() {
  const { t, lang } = useLang();
  const codes = Object.keys(PICT_NAMES);

  return (
    <section className="territories">
      <div className="territories__inner container">
        <p className="eyebrow territories__kicker">{t("home.territories.kicker")}</p>
        <h2 className="territories__title">{t("home.territories.title")}</h2>
        <p className="territories__lead">{t("home.territories.subtitle")}</p>

        <ul className="territories__grid">
          {codes.map((code) => (
            <FlagTile key={code} code={code} name={pictName(code, lang)} />
          ))}
        </ul>
      </div>
    </section>
  );
}