// src/components/VaaMap/VaaMap.jsx
// ============================================================
// LA CARTE DU VA'A. Mapbox satellite si dispo (window.mapboxgl + token),
// sinon repli SVG (points + pirogue). `route` = territoires effectivement
// parcourus (filtrés sur la donnée par le chapitre).
// ============================================================

import React, { useMemo } from "react";
import PICT_GEO from "../../data/pictGeo";
import { VAA_ROUTE } from "../../data/vaaRoute";
import { pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import VaaMapbox from "../VaaMapbox/VaaMapbox";
import "./VaaMap.scss";

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const HAS_MAPBOX = typeof window !== "undefined" && !!window.mapboxgl && !!TOKEN;

const W = 480;
const H = 300;
const PAD = 30;
const voyageLng = (lng) => (lng < 0 ? lng + 360 : lng);

export default function VaaMap({ code = null, index = 0, route }) {
  const { lang } = useLang();
  const path = route && route.length ? route : VAA_ROUTE;

  const pts = useMemo(() => {
    // Échelle calculée sur TOUS les territoires (cadre stable, indépendant
    // du sous-ensemble parcouru).
    const all = VAA_ROUTE;
    const lngs = all.map((c) => voyageLng(PICT_GEO[c][0]));
    const lats = all.map((c) => PICT_GEO[c][1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const sx = (W - 2 * PAD) / (maxLng - minLng || 1);
    const sy = (H - 2 * PAD) / (maxLat - minLat || 1);
    return path.map((c) => ({
      code: c,
      x: PAD + (voyageLng(PICT_GEO[c][0]) - minLng) * sx,
      y: H - PAD - (PICT_GEO[c][1] - minLat) * sy,
    }));
  }, [path]);

  if (HAS_MAPBOX) {
    return <VaaMapbox code={code} index={index} route={path} />;
  }

  const byCode = Object.fromEntries(pts.map((p) => [p.code, p]));
  const wake = pts
    .slice(0, index + 1)
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const here = code ? byCode[code] : null;

  return (
    <figure className="vaamap" aria-label={here ? pictName(code, lang) : "Pacifique"}>
      <svg viewBox={`0 0 ${W} ${H}`} className="vaamap__svg" role="img">
        <defs>
          <radialGradient id="vaaSea" cx="50%" cy="40%" r="75%">
            <stop offset="0%" className="vaamap__sea-0" />
            <stop offset="100%" className="vaamap__sea-1" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} rx="14" fill="url(#vaaSea)" />
        {index > 0 && <path className="vaamap__wake" d={wake} />}
        {pts.map((p) => (
          <circle
            key={p.code}
            className={`vaamap__isle ${p.code === code ? "is-active" : ""}`}
            cx={p.x}
            cy={p.y}
            r={p.code === code ? 5.5 : 2.6}
          />
        ))}
        {here && (
          <g className="vaamap__vaa" transform={`translate(${here.x} ${here.y})`}>
            <circle className="vaamap__halo" r="12" />
            <path className="vaamap__hull" d="M-8 0 Q0 7 8 0 Q0 2.5 -8 0 Z" />
            <path className="vaamap__sail" d="M0 -11 L0 1 L7 -4 Z" />
          </g>
        )}
      </svg>
      {here && <figcaption className="vaamap__cap">{pictName(code, lang)}</figcaption>}
    </figure>
  );
}