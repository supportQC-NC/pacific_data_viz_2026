// src/components/CountryMiniMap/CountryMiniMap.jsx
// ============================================================
// Carte 3D d'un territoire (satellite + relief), RÉACTIVE aux switch :
//   • `coastlineUrl` : vrais points du trait de côte (rouge=recul → bleu=avancée).
//   • `themePoints`  : bulles par territoire colorées par la valeur d'un thème
//                      (le territoire courant mis en avant). Permet d'afficher
//                      la donnée de chaque acte SUR la carte.
//   • `coast`        : aura de synthèse colorée par le bilan côtier.
// La carte n'est créée qu'une fois ; les couches changent sans recréation
// (pas de flicker au switch). Token : REACT_APP_MAPBOX_TOKEN.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import "./CountryMiniMap.scss";

const mapboxgl = window.mapboxgl;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function tokenColor(name, fb) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fb;
}
function coastColor(bal) {
  if (!Number.isFinite(bal)) return null;
  if (bal < -2) return tokenColor("--c-warm", "#ff7a5c");
  if (bal > 2) return tokenColor("--c-positive", "#3ecf8e");
  return tokenColor("--c-text-mute", "#8aa0b3");
}
// Couleurs FIXES pour les couches Mapbox (un paint n'accepte ni token CSS ni
// color-mix : on évite tout risque de couleur non parsable).
const TONE_HEX = {
  warm: "#ff7a5c",
  positive: "#3ecf8e",
  accent: "#22d3ee",
  negative: "#ef4444",
};

export default function CountryMiniMap({
  coords,
  zoom = 50,
  pitch = 45,
  controls = false,
  coast = null,
  coastlineUrl = null,
  themePoints = null,
  themeTone = "accent",
  themeKey = null,
  noTokenMsg = "",
}) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // 1. Création de la carte (uniquement sur changement de cadrage).
  useEffect(() => {
    if (!TOKEN || !mapboxgl || !coords || !ref.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: coords,
      zoom,
      pitch,
      bearing: 0,
      projection: "mercator",
      antialias: true,
      attributionControl: false,
    });
    mapRef.current = map;

    if (map.scrollZoom) map.scrollZoom.disable();
    if (controls && mapboxgl.NavigationControl) {
      map.addControl(
        new mapboxgl.NavigationControl({
          showCompass: true,
          visualizePitch: true,
        }),
        "top-right",
      );
    }

    map.on("load", () => {
      try {
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      } catch (e) {
        /* terrain absent sur certaines versions — sans gravité */
      }
      setLoaded(true);
    });

    return () => {
      setLoaded(false);
      mapRef.current = null;
      map.remove();
    };
  }, [coords, pitch, controls]);

  // Zoom animé (immersion territoire ↔ vue régionale) sans recréer la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return undefined;
    map.flyTo({ zoom, duration: 900, essential: true });
    return undefined;
  }, [loaded, zoom]);

  // 2. Aura « trait de côte » (synthèse), colorée par le bilan.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return undefined;
    const cc = coast ? coastColor(coast.bal) : null;
    if (!cc) return undefined;
    const aura = document.createElement("div");
    aura.className = "cmm__coast";
    aura.style.setProperty("--coast-c", cc);
    const m = new mapboxgl.Marker({ element: aura })
      .setLngLat(coords)
      .addTo(map);
    return () => m.remove();
  }, [loaded, coast, coords]);

  // 3. Couche de données : bulles par thème OU points du trait de côte.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map) return undefined;
    let cancelled = false;

    const drop = () => {
      ["coast", "theme"].forEach((id) => {
        try {
          if (map.getLayer(id)) map.removeLayer(id);
          if (map.getSource(id)) map.removeSource(id);
        } catch (e) {
          /* ignore */
        }
      });
    };
    drop();

    try {
      if (themePoints) {
        const hi = TONE_HEX[themeTone] || TONE_HEX.accent;
        const lo = "#8aa0b3";
        map.addSource("theme", { type: "geojson", data: themePoints });
        map.addLayer({
          id: "theme",
          type: "circle",
          source: "theme",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              5,
              7,
              12,
              11,
              22,
            ],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "v"],
              0,
              lo,
              1,
              hi,
            ],
            "circle-opacity": 0.9,
            "circle-stroke-width": ["case", ["==", ["get", "cur"], 1], 3.5, 1],
            "circle-stroke-color": "#ffffff",
          },
        });
      } else if (coastlineUrl) {
        fetch(coastlineUrl)
          .then((r) => r.json())
          .then((gj) => {
            if (cancelled || !mapRef.current || !gj || !gj.features) return;
            try {
              if (map.getSource("coast")) {
                map.getSource("coast").setData(gj);
                return;
              }
              const absR = ["abs", ["get", "r"]];
              map.addSource("coast", { type: "geojson", data: gj });
              map.addLayer({
                id: "coast",
                type: "circle",
                source: "coast",
                paint: {
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    4,
                    ["interpolate", ["linear"], absR, 0, 2.5, 1, 5, 6, 11],
                    9,
                    ["interpolate", ["linear"], absR, 0, 5, 1, 9, 6, 18],
                    13,
                    ["interpolate", ["linear"], absR, 0, 8, 1, 15, 6, 28],
                  ],
                  "circle-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "r"],
                    -2,
                    "#b3122a",
                    -0.6,
                    "#e8453c",
                    -0.2,
                    "#f3a08a",
                    0,
                    "#aeb7bd",
                    0.2,
                    "#86c6e6",
                    0.6,
                    "#2c7fb8",
                    2,
                    "#0b4f9e",
                  ],
                  "circle-opacity": 0.92,
                  "circle-stroke-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    4,
                    0.6,
                    10,
                    1.6,
                  ],
                  "circle-stroke-color": "rgba(255,255,255,0.9)",
                },
              });
            } catch (e) {
              /* couche côte non posée — sans gravité */
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      /* couche non posée — on ne casse jamais le rendu */
    }

    return () => {
      cancelled = true;
      drop();
    };
  }, [loaded, coastlineUrl, themeKey, themeTone]);

  if (!TOKEN || !mapboxgl) {
    return <div className="cmm cmm--notoken">{noTokenMsg}</div>;
  }
  return (
    <div className="cmm">
      <div className="cmm__map" ref={ref} />
      <div className="cmm__vignette" aria-hidden="true" />
    </div>
  );
}
