// src/components/OceanMap/OceanMap.jsx
// ============================================================
// Carte Mapbox SATELLITE en PROJECTION GLOBE — colonnes extrudees.
// Double encodage : HAUTEUR ∝ valeur, COULEUR = position vs mediane
// (rampe "semantic" vert -> cyan -> rouge centree sur `mid`). La VALEUR
// s'affiche sur chaque colonne. Globe + atmosphere + terrain + ciel.
// Bouton PLEIN ECRAN (toggle CSS + map.resize(), Echap pour fermer).
// CONTROLE PLAY + curseur d'annee sur la carte, pilote par le parent
// (props years/yearIndex/playing/onTogglePlay/onScrub) -> une seule
// timeline synchronisee avec le reste de l'acte. Le bloc n'apparait que
// si onTogglePlay est fourni (autres actes inchanges).
// Token : REACT_APP_MAPBOX_TOKEN.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import PICT_GEO from "../../data/pictGeo";
import { useLang } from "../../store/context/langContext";
import mapLabels from "../../i18n/mapLabels";
import "./OceanMap.scss";

// Mapbox GL est charge via le CDN officiel dans public/index.html
// (build pre-compile par Mapbox, jamais minifie par Terser) -> evite le
// bug "ReferenceError: x is not defined" au "npm run build". Identique en
// dev et en prod : on lit l'instance globale window.mapboxgl.
const mapboxgl = window.mapboxgl;

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const RAMPS = {
  diverging: { cold: "#2c7fb8", neutral: "#e6edf3", hot: "#e8453c" },
  good: { cold: "#1f8f54", neutral: "#d6efe0", hot: "#1f8f54" },
  semantic: { cold: "#25e09a", neutral: "#00e6ff", hot: "#ff4d6d" },
};
const MAX_H = 750000;
const BASE_H = 45000;

function cssVarRaw(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function colorExpr(lo, hi, pal, mid) {
  const { cold, neutral, hot } = pal;
  if (mid != null && lo < mid && mid < hi)
    return ["interpolate", ["linear"], ["get", "cv"], lo, cold, mid, neutral, hi, hot];
  if (lo < 0 && hi > 0)
    return ["interpolate", ["linear"], ["get", "cv"], lo, cold, 0, neutral, hi, hot];
  if (hi <= 0)
    return ["interpolate", ["linear"], ["get", "cv"], lo, cold, hi === lo ? lo + 1e-6 : hi, neutral];
  return ["interpolate", ["linear"], ["get", "cv"], lo, neutral, hi === lo ? lo + 1e-6 : hi, hot];
}

function squareKm([lng, lat], km) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ];
}

export default function OceanMap({
  data,
  unit,
  range,
  logScale = false,
  ramp = "diverging",
  mid = null,
  lowLabel,
  midLabel,
  highLabel,
  noTokenMsg,
  years = [],
  yearIndex = null,
  playing = false,
  onTogglePlay = null,
  onScrub = null,
}) {
  const { lang } = useLang();
  const ml = mapLabels[lang] || mapLabels.fr;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const rafRef = useRef(0);
  const fittedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [full, setFull] = useState(false);

  const min = range?.min ?? -1;
  const max = range?.max ?? 1;
  const pal = RAMPS[ramp] || RAMPS.diverging;

  const { dom, loD, hiD, midD } = useMemo(() => {
    const fn = logScale ? (v) => Math.log10(1 + Math.max(0, v)) : (v) => v;
    return {
      dom: fn,
      loD: logScale ? fn(Math.max(0, min)) : min,
      hiD: fn(max),
      midD: mid != null && Number.isFinite(mid) ? fn(mid) : null,
    };
  }, [logScale, min, max, mid]);

  const norm = useMemo(
    () => (v) =>
      hiD === loD ? 0.5 : Math.max(0, Math.min(1, (dom(v) - loD) / (hiD - loD))),
    [dom, loD, hiD],
  );

  const fc = useMemo(() => {
    const features = [];
    data.forEach((d) => {
      const c = PICT_GEO[d.area];
      if (!c) return;
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: squareKm(c, 26) },
        properties: {
          code: d.area,
          name: d.name,
          value: d.value,
          year: d.year,
          cv: dom(d.value),
          height: BASE_H + norm(d.value) * MAX_H,
          lng: c[0],
          lat: c[1],
        },
      });
    });
    return { type: "FeatureCollection", features };
  }, [data, dom, norm]);

  const centers = useMemo(
    () => ({
      type: "FeatureCollection",
      features: fc.features.map((f) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.properties.lng, f.properties.lat] },
        properties: { code: f.properties.code, val: f.properties.value },
      })),
    }),
    [fc],
  );

  useEffect(() => {
    if (!TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      projection: "globe",
      center: [200, -13],
      zoom: 2.0,
      pitch: 45,
      bearing: -8,
      maxPitch: 72,
      renderWorldCopies: true,
      antialias: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0.0, 90.0],
          "sky-atmosphere-sun-intensity": 6,
        },
      });

      if (typeof map.setFog === "function") {
        map.setFog({
          range: [0.8, 8],
          color: cssVarRaw("--c-bg-2", "#051421"),
          "high-color": cssVarRaw("--c-accent-deep", "#0090c8"),
          "horizon-blend": 0.2,
          "space-color": cssVarRaw("--c-bg", "#020912"),
          "star-intensity": 0.12,
        });
      }

      if (!map.getSource("dem")) {
        map.addSource("dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: "dem", exaggeration: 1.3 });
      map.setLight({
        anchor: "viewport",
        color: "#ffffff",
        intensity: 0.45,
        position: [1.4, 210, 30],
      });

      map.addSource("cols", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("centers", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      map.addLayer({
        id: "cols",
        type: "fill-extrusion",
        source: "cols",
        paint: {
          "fill-extrusion-color": colorExpr(loD, hiD, pal, midD),
          "fill-extrusion-height": ["*", ["get", "height"], 0],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      });
      map.addLayer({
        id: "code",
        type: "symbol",
        source: "centers",
        layout: {
          "text-field": [
            "format",
            ["get", "code"],
            { "font-scale": 1.0 },
            "\n",
            {},
            ["number-format", ["get", "val"], { "max-fraction-digits": 1 }],
            { "font-scale": 0.82 },
          ],
          "text-size": 12,
          "text-line-height": 1.1,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.75)",
          "text-halo-width": 1.4,
        },
      });

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "pm-popup" });
      popupRef.current = popup;
      map.on("mousemove", "cols", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        const v = f.properties.value;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${f.properties.name}</strong><br/>${Number(v).toLocaleString()} ${unit}${f.properties.year ? ` · ${f.properties.year}` : ""}`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "cols", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      setLoaded(true);

      const T0 = performance.now();
      const DUR = 1100;
      const grow = (now) => {
        const k = Math.min(1, (now - T0) / DUR);
        const e = 1 - Math.pow(1 - k, 3);
        if (map.getLayer("cols"))
          map.setPaintProperty("cols", "fill-extrusion-height", ["*", ["get", "height"], e]);
        if (k < 1) rafRef.current = requestAnimationFrame(grow);
      };
      rafRef.current = requestAnimationFrame(grow);
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("cols"))
      map.setPaintProperty("cols", "fill-extrusion-color", colorExpr(loD, hiD, pal, midD));
  }, [loaded, loD, hiD, pal, midD]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    const cs = map.getSource("cols");
    const ce = map.getSource("centers");
    if (cs) cs.setData(fc);
    if (ce) ce.setData(centers);
    if (map.getLayer("cols"))
      map.setPaintProperty("cols", "fill-extrusion-height", ["get", "height"]);

    if (!fittedRef.current && fc.features.length) {
      const lngs = fc.features.map((f) => (f.properties.lng < 0 ? f.properties.lng + 360 : f.properties.lng));
      const lats = fc.features.map((f) => f.properties.lat);
      const bounds = [
        [Math.min(...lngs) - 4, Math.min(...lats) - 4],
        [Math.max(...lngs) + 4, Math.max(...lats) + 4],
      ];
      map.fitBounds(bounds, { padding: 60, pitch: 45, bearing: -8, maxZoom: 4.2, duration: 0 });
      fittedRef.current = true;
    }
  }, [loaded, fc, centers]);

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const id = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 340);
    return () => clearTimeout(id);
  }, [full]);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (!TOKEN) return <div className="omap omap--notoken">{noTokenMsg}</div>;

  const hasTimeline = years.length > 0 && typeof onTogglePlay === "function";
  const curYear = years.length ? years[yearIndex ?? 0] : "";

  return (
    <div className={`omap ${full ? "omap--full" : ""}`}>
      <div className="omap__stage">
        <div ref={containerRef} className="omap__map" />

        <button type="button" className="omap__expand" onClick={() => setFull((f) => !f)} aria-label={full ? ml.close : ml.expand} title={full ? ml.close : ml.expand}>
          {full ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M9 4 H4 V9 M15 4 H20 V9 M9 20 H4 V15 M15 20 H20 V15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {hasTimeline && (
          <div className="omap__timeline">
            <button type="button" className="omap__play" onClick={onTogglePlay} aria-label={playing ? ml.pause : ml.play} title={playing ? ml.pause : ml.play}>
              {playing ? (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                  <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <input
              type="range"
              className="omap__scrub"
              min={0}
              max={years.length - 1}
              value={yearIndex ?? 0}
              onChange={(e) => onScrub && onScrub(Number(e.target.value))}
              aria-label={ml.year}
            />
            <span className="omap__year">{curYear}</span>
          </div>
        )}
      </div>

      <div className={`omap__legend omap__legend--${ramp}`}>
        <span>{lowLabel}</span>
        <span className="omap__legend-bar" />
        <span>{highLabel}</span>
        {midLabel ? <span className="omap__legend-mid">{"\u00b7"} {midLabel}</span> : null}
      </div>
    </div>
  );
}