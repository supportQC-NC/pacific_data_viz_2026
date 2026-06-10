// src/components/CountryMiniMap/CountryMiniMap.jsx
// ============================================================
// Carte de LOCALISATION d'un territoire, en 3D (satellite + relief).
// Vue inclinée mais rapprochée : le zoom et le pitch sont passés en props pour
// cadrer réellement le territoire (un atoll minuscule et la Papouasie n'ont pas
// le même zoom). Terrain exagéré pour le volume, marqueur lumineux. Drag/
// rotation possibles ; zoom molette désactivé pour ne pas piéger le scroll.
// Token : REACT_APP_MAPBOX_TOKEN (sinon message discret). Mapbox via window.
// ============================================================

import React, { useEffect, useRef } from "react";
import "./CountryMiniMap.scss";

const mapboxgl = window.mapboxgl;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

export default function CountryMiniMap({ coords, zoom = 50, pitch = 45, noTokenMsg = "" }) {
  const ref = useRef(null);

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

    if (map.scrollZoom) map.scrollZoom.disable();

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
    });

    const el = document.createElement("div");
    el.className = "cmm__marker";
    const marker = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);

    return () => {
      marker.remove();
      map.remove();
    };
  }, [coords, zoom, pitch]);

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