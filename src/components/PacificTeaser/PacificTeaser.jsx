// src/components/PacificTeaser/PacificTeaser.jsx
// ============================================================
// Teaser : vraie carte MAPBOX (globe satellite) du Pacifique avec les 22
// territoires en points lumineux. Carte figée (pas de zoom/drag) mais
// SURVOL actif : une infobox donne le nom du territoire (bilingue). Clic
// (point ou carte) -> page des actes (/actes).
// Mapbox GL via le CDN (window.mapboxgl). Token : REACT_APP_MAPBOX_TOKEN.
// ============================================================

import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName } from "../../i18n/pictNames";
import PICT_GEO from "../../data/pictGeo";
import "./PacificTeaser.scss";

const mapboxgl = window.mapboxgl;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Les 22 territoires en points (aucune donnée chiffrée : c'est un aperçu).
const FEATURES = Object.entries(PICT_GEO).map(([code, coordinates]) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: { code },
}));

export default function PacificTeaser() {
  const navigate = useNavigate();
  const { lang, t } = useLang();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    if (!mapboxgl || !TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [185, -10],
      zoom: 1.6,
      projection: "globe",
      attributionControl: false,
    });
    mapRef.current = map;

    // Carte figée : on coupe les gestes de navigation, on garde le survol.
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.dragPan.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(186, 210, 235)",
        "high-color": "rgb(36, 92, 158)",
        "horizon-blend": 0.06,
        "space-color": "rgb(4, 10, 22)",
        "star-intensity": 0.3,
      });
    });

    map.on("load", () => {
      map.addSource("terr", {
        type: "geojson",
        data: { type: "FeatureCollection", features: FEATURES },
      });
      map.addLayer({
        id: "halo",
        type: "circle",
        source: "terr",
        paint: {
          "circle-radius": 16,
          "circle-color": "#00e6ff",
          "circle-opacity": 0.22,
          "circle-blur": 0.85,
        },
      });
      map.addLayer({
        id: "dot",
        type: "circle",
        source: "terr",
        paint: {
          "circle-radius": 5,
          "circle-color": "#34e1ff",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
        },
      });
      // Zone de survol élargie (transparente) pour viser facilement.
      map.addLayer({
        id: "hit",
        type: "circle",
        source: "terr",
        paint: { "circle-radius": 15, "circle-color": "#000000", "circle-opacity": 0 },
      });

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "pacteaser-popup",
        offset: 14,
      });

      map.on("mouseenter", "hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mousemove", "hit", (e) => {
        const f = e.features[0];
        const name = pictName(f.properties.code, langRef.current);
        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(`<span class="pacteaser-popup__name">${name}</span>`)
          .addTo(map);
      });
      map.on("mouseleave", "hit", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = () => navigate("/actes");
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  };

  return (
    <section className="pacteaser">
      <div className="pacteaser__inner container">
        <div className="pacteaser__copy">
          <p className="eyebrow pacteaser__kicker">{t("home.teaser.kicker")}</p>
          <h2 className="pacteaser__title">{t("home.teaser.title")}</h2>
          <p className="pacteaser__lead">{t("home.teaser.lead")}</p>
          <button type="button" className="pacteaser__cta" onClick={go}>
            {t("home.teaser.cta")} <span aria-hidden="true">→</span>
          </button>
        </div>

        {mapboxgl && TOKEN ? (
          <div
            className="pacteaser__map"
            role="button"
            tabIndex={0}
            aria-label={t("home.teaser.cta")}
            onClick={go}
            onKeyDown={onKey}
          >
            <div ref={containerRef} className="pacteaser__canvas" />
            <span className="pacteaser__overlay" aria-hidden="true" />
          </div>
        ) : (
          <div className="pacteaser__notoken">{t("home.teaser.notoken")}</div>
        )}
      </div>
    </section>
  );
}