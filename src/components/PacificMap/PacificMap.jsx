// src/components/PacificMap/PacificMap.jsx
// ============================================================
// Carte Mapbox (globe sombre) du Pacifique.
// 1 cercle = 1 territoire ; couleur + taille = valeur (émissions/hab.).
// Pilotée par les mêmes données/année que le beeswarm de l'acte.
// Token requis : REACT_APP_MAPBOX_TOKEN (gratuit sur mapbox.com).
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import PICT_GEO from "../../data/pictGeo";
import "./PacificMap.scss";

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Paliers de couleur/taille (t CO2e/hab.) — la plupart du Pacifique est bas,
// Palaos / Nouvelle-Calédonie ressortent en rouge.
const COLOR = [
  "interpolate",
  ["linear"],
  ["get", "value"],
  0,
  "#1f9bc9",
  5,
  "#46c7b8",
  20,
  "#ffd166",
  60,
  "#ff5a36",
];
const HALO_R = [
  "interpolate",
  ["linear"],
  ["get", "value"],
  0,
  10,
  5,
  16,
  20,
  28,
  60,
  46,
];
const DOT_R = [
  "interpolate",
  ["linear"],
  ["get", "value"],
  0,
  4,
  5,
  6,
  20,
  9,
  60,
  13,
];

export default function PacificMap({
  data,
  unit,
  legendLow,
  legendHigh,
  noTokenMsg,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  const features = useMemo(
    () =>
      data
        .map((d) => {
          const c = PICT_GEO[d.area];
          if (!c) return null;
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: c },
            properties: { name: d.name, value: d.value, year: d.year },
          };
        })
        .filter(Boolean),
    [data],
  );

  // Initialisation unique de la carte.
  useEffect(() => {
    if (!TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [180, -12],
      zoom: 1.9,
      projection: "globe",
    });
    mapRef.current = map;

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(8,16,28)",
        "high-color": "rgb(16,40,72)",
        "horizon-blend": 0.1,
        "space-color": "rgb(2,6,14)",
        "star-intensity": 0.35,
      });
    });

    map.on("load", () => {
      map.addSource("terr", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "halo",
        type: "circle",
        source: "terr",
        paint: {
          "circle-radius": HALO_R,
          "circle-color": COLOR,
          "circle-opacity": 0.18,
          "circle-blur": 0.85,
        },
      });
      map.addLayer({
        id: "dot",
        type: "circle",
        source: "terr",
        paint: {
          "circle-radius": DOT_R,
          "circle-color": COLOR,
          "circle-stroke-color": "#02101c",
          "circle-stroke-width": 1.2,
        },
      });

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "pm-popup",
      });
      popupRef.current = popup;
      map.on("mousemove", "dot", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `<strong>${f.properties.name}</strong><br/>${f.properties.value} ${unit} · ${f.properties.year}`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "dot", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      setLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour des points à chaque changement de données / d'année.
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const src = mapRef.current.getSource("terr");
    if (src) src.setData({ type: "FeatureCollection", features });
  }, [loaded, features]);

  if (!TOKEN) {
    return <div className="pm pm--notoken">{noTokenMsg}</div>;
  }

  return (
    <div className="pm">
      <div ref={containerRef} className="pm__map" />
      <div className="pm__legend">
        <span>{legendLow}</span>
        <span className="pm__legend-bar" />
        <span>{legendHigh}</span>
      </div>
    </div>
  );
}
