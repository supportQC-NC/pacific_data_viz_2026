// src/components/CountryMiniMap/CountryMiniMap.jsx
// ============================================================
// Carte de LOCALISATION d'un territoire, en 3D (satellite + relief).
// Vue inclinée mais rapprochée : le zoom et le pitch sont passés en props pour
// cadrer réellement le territoire (un atoll minuscule et la Papouasie n'ont pas
// le même zoom). Terrain exagéré pour le volume, marqueur lumineux. Drag/
// rotation possibles ; zoom molette désactivé pour ne pas piéger le scroll.
// Prop `controls` : ajoute des boutons +/- (et boussole) pour zoomer SANS
// capturer la molette de la page.
// Token : REACT_APP_MAPBOX_TOKEN (sinon message discret). Mapbox via window.
// ============================================================

import React, { useEffect, useRef } from "react";
import "./CountryMiniMap.scss";

const mapboxgl = window.mapboxgl;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Couleur de l'aura « trait de côte » selon le bilan recul/avancée (tokens).
function coastColor(bal) {
  if (!Number.isFinite(bal)) return null;
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
  if (bal < -2) return v("--c-warm", "#ff7a5c");
  if (bal > 2) return v("--c-positive", "#3ecf8e");
  return v("--c-text-mute", "#8aa0b3");
}

export default function CountryMiniMap({
  coords,
  zoom = 50,
  pitch = 45,
  controls = false,
  coast = null,
  noTokenMsg = "",
}) {
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

    // La molette reste désactivée (ne pas piéger le scroll de la page) ; les
    // boutons +/- permettent quand même de zoomer quand `controls` est actif.
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
    });

    // Aura « trait de côte » (derrière le marqueur), colorée par le bilan.
    let coastMarker = null;
    const cc = coast ? coastColor(coast.bal) : null;
    if (cc) {
      const aura = document.createElement("div");
      aura.className = "cmm__coast";
      aura.style.setProperty("--coast-c", cc);
      coastMarker = new mapboxgl.Marker({ element: aura })
        .setLngLat(coords)
        .addTo(map);
    }

    const el = document.createElement("div");
    el.className = "cmm__marker";
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat(coords)
      .addTo(map);

    return () => {
      if (coastMarker) coastMarker.remove();
      marker.remove();
      map.remove();
    };
  }, [coords, zoom, pitch, controls, coast]);

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
