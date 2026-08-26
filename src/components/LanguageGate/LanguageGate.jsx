// src/components/LanguageGate/LanguageGate.jsx
// ============================================================
// Écran d'OUVERTURE de l'immersion. Au lancement de l'expérience, l'utilisateur
// choisit d'abord sa langue (FR / EN) sur un panneau plein écran, sur fond de
// pluie binaire lente (mêmes données qui « tombent » que le loader, mais
// douces). Le voyage démarre ensuite dans la langue choisie (Acte 1).
// - Applique la langue via le contexte (setLang), lance startJourney(),
//   puis navigue vers le premier acte. Échap ferme sans démarrer.
// Aucun style inline. Les libellés sont affichés dans les DEUX langues :
// c'est l'écran de choix de langue lui-même, donc c'est volontaire.
// ============================================================

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import "./LanguageGate.scss";

export default function LanguageGate({ open, onClose }) {
  const { setLang } = useLang();
  const { startJourney, journey } = useJourney();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const choose = (lang) => {
    setLang(lang);
    startJourney();
    navigate(journey[0].to);
  };

  return (
    <div
      className="langgate"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your language / Choisissez votre langue"
    >
      {/* LE DÉPART — lagon au petit matin, la pirogue prête à partir.
          Remplace la pluie binaire : le voyage commence sur une plage, pas
          devant un écran de données. Décor entièrement en SVG (aucune image
          à charger), même vocabulaire graphique que la pirogue des
          traversées pour que le fil visuel soit continu.
          `BinaryRain` n'est pas supprimé : le Loader s'en sert toujours. */}
      <div className="langgate__lagoon" aria-hidden="true">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a2a4a" />
              <stop offset="42%" stopColor="#4d5f86" />
              <stop offset="72%" stopColor="#c98f80" />
              <stop offset="100%" stopColor="#f0c9a4" />
            </linearGradient>
            <linearGradient id="lg-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f7d8c" />
              <stop offset="100%" stopColor="#38a3a8" />
            </linearGradient>
            <linearGradient id="lg-shallow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#57c9c0" />
              <stop offset="100%" stopColor="#93e0d2" />
            </linearGradient>
            <linearGradient id="lg-sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8d3b4" />
              <stop offset="100%" stopColor="#d8bd99" />
            </linearGradient>
          </defs>

          {/* ciel + soleil bas */}
          <rect width="1440" height="560" fill="url(#lg-sky)" />
          <circle cx="1060" cy="486" r="52" fill="#ffe3bd" opacity="0.85" />

          {/* île lointaine et son motu */}
          <path
            d="M120 500 Q 250 404 372 500 Z"
            fill="#20364f"
            opacity="0.75"
          />
          <path
            d="M330 506 Q 420 462 512 506 Z"
            fill="#20364f"
            opacity="0.55"
          />

          {/* lagon : passe profonde, puis récif, puis eau claire */}
          <rect y="500" width="1440" height="120" fill="url(#lg-far)" />
          <path
            d="M0 596 Q 360 574 720 596 T 1440 596 V 700 H0 Z"
            fill="#6fd3c8"
            opacity="0.9"
          />
          <rect y="668" width="1440" height="132" fill="url(#lg-shallow)" />

          {/* frange d'écume sur le récif */}
          <path
            d="M0 600 Q 200 588 400 600 T 800 600 T 1200 600 T 1440 598"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.5"
            strokeWidth="3"
          />

          {/* plage */}
          <path d="M0 782 Q 720 742 1440 782 V900 H0 Z" fill="url(#lg-sand)" />
          <path
            d="M0 786 Q 720 748 1440 786"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth="4"
          />

          {/* Cocotier — pied bien PLANTÉ DANS LE SABLE (y ≈ 850, sous la ligne
              de plage à 782), sinon il paraissait pousser dans le lagon. */}
          <g className="langgate__palm">
            <path d="M150 856 Q 172 700 132 596" />
            <path d="M132 596 Q 78 566 42 588" />
            <path d="M132 596 Q 184 558 232 580" />
            <path d="M132 596 Q 118 546 138 512" />
            <path d="M132 596 Q 166 572 198 532" />
          </g>

          {/* LA PIROGUE — échouée sur le sable, prête à partir.
              Mêmes formes que la pirogue des traversées. */}
          {/* Placée à DROITE, dégagée du panneau central (qui occupe environ
              x 360→1080) : mesuré sur capture, à sa position précédente elle
              était intégralement masquée. Elle est le sujet de l'écran, elle
              doit se voir. */}
          <g className="langgate__vaa" transform="translate(1090 566) scale(1.28)">
            <ellipse className="langgate__vshadow" cx="150" cy="186" rx="76" ry="6" />
            <path
              className="langgate__sail"
              d="M150 26 C 200 48 218 102 216 152 C 184 141 162 124 150 109 Z"
            />
            <path
              className="langgate__sail langgate__sail--back"
              d="M150 32 C 122 57 112 102 114 146 C 137 133 146 120 150 109 Z"
            />
            <line className="langgate__mast" x1="150" y1="24" x2="150" y2="166" />
            <path
              className="langgate__hull"
              d="M90 168 Q 150 193 210 168 Q 183 181 150 181 Q 117 181 90 168 Z"
            />
            <path className="langgate__ama" d="M86 191 Q 150 201 208 191" />
            <line className="langgate__iako" x1="121" y1="177" x2="115" y2="191" />
            <line className="langgate__iako" x1="179" y1="177" x2="185" y2="191" />
          </g>
        </svg>
      </div>

      <div className="langgate__veil" aria-hidden="true" />

      <div className="langgate__inner">
        <span className="langgate__mark" aria-hidden="true">
          <span className="langgate__mark-core" />
          <span className="langgate__mark-ring" />
        </span>

        <p className="langgate__kicker">
          Datamoana · Pacific Dataviz Challenge 2026
        </p>
        <h2 className="langgate__title">
          <span lang="fr">Choisissez votre langue</span>
          <span className="langgate__title-sep" aria-hidden="true" />
          <span lang="en">Choose your language</span>
        </h2>

        <div className="langgate__choices">
          <button
            type="button"
            className="langgate__choice"
            onClick={() => choose("fr")}
          >
            <span className="langgate__code">FR</span>
            <span className="langgate__name">Français</span>
            <span className="langgate__go" aria-hidden="true">
              Commencer <span className="langgate__go-arrow">→</span>
            </span>
          </button>
          <button
            type="button"
            className="langgate__choice"
            onClick={() => choose("en")}
          >
            <span className="langgate__code">EN</span>
            <span className="langgate__name">English</span>
            <span className="langgate__go" aria-hidden="true">
              Start <span className="langgate__go-arrow">→</span>
            </span>
          </button>
        </div>

        <button type="button" className="langgate__skip" onClick={onClose}>
          <span lang="fr">Plus tard</span> · <span lang="en">Later</span>
        </button>
      </div>
    </div>
  );
}