// src/components/StatRotator/StatRotator.jsx
// ============================================================
// Chiffre-clé rotatif : fait défiler une liste de faits (num + texte) avec
// un fondu doux. Tous les chiffres sont RÉELS (fournis via i18n, écrits en
// dur et sourcés). Respecte prefers-reduced-motion (alors statique : 1er fait).
// Aucun style inline en JSX.
// Props : items [{ num, text }], interval (ms, défaut 3800)
// ============================================================

import React, { useEffect, useState } from "react";

export default function StatRotator({ items = [], interval = 3800 }) {
  const [i, setI] = useState(0);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced || items.length <= 1) return undefined;
    const id = setInterval(() => setI((p) => (p + 1) % items.length), interval);
    return () => clearInterval(id);
  }, [items.length, interval, reduced]);

  if (!items.length) return null;
  const cur = items[Math.min(i, items.length - 1)];

  return (
    <p className="statrot" aria-live="polite">
      {/* key force le remontage → rejoue le fondu à chaque changement */}
      <span className="statrot__item" key={i}>
        <span className="statrot__num">{cur.num}</span>
        <span className="statrot__text">{cur.text}</span>
      </span>
    </p>
  );
}
