// src/components/PacificMap/PacificMap.jsx
// ============================================================
// Carte Mapbox SATELLITE (globe) du Pacifique.
// 1 cercle = 1 territoire ; couleur + taille = valeur (émissions/hab.).
// Style satellite-streets pour une lecture visuelle (relief, océan,
// noms de lieux). Token requis : REACT_APP_MAPBOX_TOKEN.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import PICT_GEO from "../../data/pictGeo";
import "./PacificMap.scss";

// Mapbox GL est charge via le CDN officiel dans public/index.html
// (build pre-compile par Mapbox, jamais minifie par Terser) -> evite le
// bug "ReferenceError: x is not defined" au "npm run build". Identique en
// dev et en prod : on lit l'instance globale window.mapboxgl.
const mapboxgl = window.mapboxgl;

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

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
  12,
  5,
  18,
  20,
  30,
  60,
  50,
];
const DOT_R = [
  "interpolate",
  ["linear"],
  ["get", "value"],
  0,
  5,
  5,
  7,
  20,
  10,
  60,
  15,
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
            properties: {
              name: d.name,
              code: d.area,
              value: d.value,
              year: d.year,
            },
          };
        })
        .filter(Boolean),
    [data],
  );

  useEffect(() => {
    if (!TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [180, -12],
      zoom: 2.1,
      projection: "globe",
      attributionControl: true,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(186, 210, 235)",
        "high-color": "rgb(36, 92, 158)",
        "horizon-blend": 0.06,
        "space-color": "rgb(4, 10, 22)",
        "star-intensity": 0.25,
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
          "circle-opacity": 0.25,
          "circle-blur": 0.8,
        },
      });
      map.addLayer({
        id: "dot",
        type: "circle",
        source: "terr",
        paint: {
          "circle-radius": DOT_R,
          "circle-color": COLOR,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.6,
        },
      });
      map.addLayer({
        id: "code",
        type: "symbol",
        source: "terr",
        layout: {
          "text-field": ["get", "code"],
          "text-size": 11,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, -1.4],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.6)",
          "text-halo-width": 1.4,
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