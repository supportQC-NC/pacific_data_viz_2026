// src/components/OceanMap/OceanMap.jsx
// ============================================================
// Carte Mapbox SATELLITE (globe) — champ d'anomalie en HEATMAP.
// Plus de pastilles ni de disques : une nappe lumineuse continue
// dont l'intensité suit l'anomalie et s'accentue au fil des années
// (sensation de montée / réchauffement). Mode "water" / "heat".
// Codes territoires en repère. Token : REACT_APP_MAPBOX_TOKEN.
// Props : data [{area,name,value,year}], unit, range {min,max},
//         mode "water"|"heat", lowLabel, midLabel, highLabel, noTokenMsg
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import PICT_GEO from "../../data/pictGeo";
import "./OceanMap.scss";

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const HEAT_COLOR = {
  water: [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(8,24,40,0)",
    0.2,
    "#123f5c",
    0.45,
    "#1f9bc9",
    0.7,
    "#46c7e8",
    1,
    "#b6f3ff",
  ],
  heat: [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(40,18,8,0)",
    0.2,
    "#c9772a",
    0.45,
    "#ff7a3d",
    0.7,
    "#ff4f2f",
    1,
    "#ffd2b3",
  ],
};

export default function OceanMap({
  data,
  unit,
  range,
  mode = "water",
  lowLabel,
  midLabel,
  highLabel,
  noTokenMsg,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const rafRef = useRef(0);
  const [loaded, setLoaded] = useState(false);

  const min = range?.min ?? -1;
  const max = range?.max ?? 1;
  const norm = useMemo(
    () => (v) =>
      max === min ? 0.5 : Math.max(0, Math.min(1, (v - min) / (max - min))),
    [min, max],
  );

  const fc = useMemo(() => {
    const features = [];
    data.forEach((d) => {
      const c = PICT_GEO[d.area];
      if (!c) return;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: c },
        properties: {
          code: d.area,
          name: d.name,
          value: d.value,
          year: d.year,
          norm: norm(d.value),
        },
      });
    });
    return { type: "FeatureCollection", features };
  }, [data, norm]);

  // Init unique.
  useEffect(() => {
    if (!TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [180, -12],
      zoom: 2.1,
      projection: "globe",
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
      map.addSource("anom", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "heat",
        type: "heatmap",
        source: "anom",
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "norm"],
            0,
            0.12,
            1,
            1,
          ],
          "heatmap-intensity": 1.2,
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            26,
            2,
            55,
            4,
            95,
            6,
            150,
          ],
          "heatmap-opacity": 0.85,
          "heatmap-color": HEAT_COLOR[mode],
        },
      });
      map.addLayer({
        id: "code",
        type: "symbol",
        source: "anom",
        layout: {
          "text-field": ["get", "code"],
          "text-size": 11,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.4,
        },
      });

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "pm-popup",
      });
      popupRef.current = popup;
      map.on("mousemove", "code", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        const v = f.properties.value;
        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `<strong>${f.properties.name}</strong><br/>${v > 0 ? "+" : ""}${v} ${unit} · ${f.properties.year}`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "code", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      setLoaded(true);

      // Respiration douce du champ.
      const T0 = performance.now();
      const tick = (now) => {
        const pulse = 0.5 + 0.5 * Math.sin(((now - T0) / 1000) * 1.4);
        if (map.getLayer("heat"))
          map.setPaintProperty("heat", "heatmap-intensity", 1.05 + 0.4 * pulse);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode (eau / chaleur) → re-ramp.
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("heat"))
      map.setPaintProperty("heat", "heatmap-color", HEAT_COLOR[mode]);
  }, [loaded, mode]);

  // Données (année / métrique).
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const src = mapRef.current.getSource("anom");
    if (src) src.setData(fc);
  }, [loaded, fc]);

  if (!TOKEN) return <div className="omap omap--notoken">{noTokenMsg}</div>;

  return (
    <div className="omap">
      <div ref={containerRef} className="omap__map" />
      <div className={`omap__legend omap__legend--${mode}`}>
        <span>{lowLabel}</span>
        <span className="omap__legend-bar" />
        <span>{highLabel}</span>
        <span className="omap__legend-mid">· {midLabel}</span>
      </div>
    </div>
  );
}
