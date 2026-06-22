// src/components/VaaMapbox/VaaMapbox.jsx
// ============================================================
// VRAIE CARTE DU VA'A (Mapbox satellite). La pirogue est FIXE au centre de la
// carte (overlay) — elle ne saute jamais ; c'est le monde qui glisse dessous
// quand la carte se recentre/zoome sur chaque pays (easeTo). Pas de marqueurs
// (ils se décalaient au scroll). Sillage « déroulé » (pas de tour du globe).
// ============================================================

import React, { useEffect, useRef } from "react";
import PICT_GEO from "../../data/pictGeo";
import { pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import "./VaaMapbox.scss";

const mapboxgl = typeof window !== "undefined" ? window.mapboxgl : null;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function unwrap(coords) {
  let prev = null;
  return coords.map(([lng, lat]) => {
    let l = lng;
    if (prev !== null) {
      while (l - prev > 180) l -= 360;
      while (l - prev < -180) l += 360;
    }
    prev = l;
    return [l, lat];
  });
}

export default function VaaMapbox({ code = null, index = 0, route = [] }) {
  const { lang } = useLang();
  const container = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const codeRef = useRef(code);
  const indexRef = useRef(index);
  codeRef.current = code;
  indexRef.current = index;

  const codes = route.length ? route : Object.keys(PICT_GEO);

  const apply = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const c = codeRef.current;
    if (c && PICT_GEO[c]) {
      m.easeTo({ center: PICT_GEO[c], zoom: 3.8, duration: 600, essential: true });
    }
    const raw = codes
      .slice(0, indexRef.current + 1)
      .filter((k) => PICT_GEO[k])
      .map((k) => PICT_GEO[k]);
    const src = m.getSource("vaa-wake");
    if (src) {
      src.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: unwrap(raw) },
      });
    }
  };

  useEffect(() => {
    if (!mapboxgl || !TOKEN || !container.current || map.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const m = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [198, -11],
      zoom: 2.6,
      attributionControl: false,
      interactive: false,
    });
    map.current = m;

    m.on("load", () => {
      ready.current = true;
      m.addSource("vaa-wake", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
      });
      m.addLayer({
        id: "vaa-wake",
        type: "line",
        source: "vaa-wake",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#54e0c7", "line-width": 1.6, "line-opacity": 0.6 },
      });
      apply();
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        ready.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, index]);

  if (!mapboxgl || !TOKEN) return null;
  return (
    <figure className="vaamapbox-wrap">
      <div className="vaamapbox">
        <div
          ref={container}
          className="vaamapbox__canvas"
          aria-label={code ? pictName(code, lang) : "Pacifique"}
        />
        {/* Pirogue fixe au centre — le monde glisse dessous. */}
        <div className="vaamapbox__canoe" aria-hidden="true">
          <svg viewBox="-15 -17 30 28" width="58" height="56">
            <path className="hull" d="M-11 0 Q0 9 11 0 Q0 3.5 -11 0 Z" />
            <path className="sail" d="M0 -15 L0 1.5 L9 -5 Z" />
            <line className="mast" x1="0" y1="-15" x2="0" y2="2" />
          </svg>
        </div>
      </div>
      {code && <figcaption className="vaamapbox__cap">{pictName(code, lang)}</figcaption>}
    </figure>
  );
}