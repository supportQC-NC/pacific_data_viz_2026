// src/components/OceanMap/OceanMap.jsx
// ============================================================
// Carte Mapbox SATELLITE 3D — colonnes extrudées (fill-extrusion).
// HAUTEUR ∝ valeur, COULEUR selon le domaine. Vue inclinée + terrain
// réel + ciel + intro qui « pousse » les colonnes.
// logScale=true : échelle logarithmique (pour des valeurs sur plusieurs
// ordres de grandeur, ex. personnes affectées / pertes économiques).
// Token : REACT_APP_MAPBOX_TOKEN.
// Props : data [{area,name,value,year}], unit, range {min,max},
//         logScale, lowLabel, midLabel, highLabel, noTokenMsg
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import PICT_GEO from "../../data/pictGeo";
import "./OceanMap.scss";

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const RAMPS = {
  diverging: { cold: "#2c7fb8", neutral: "#e6edf3", hot: "#e8453c" },
  good: { cold: "#1f8f54", neutral: "#d6efe0", hot: "#1f8f54" },
};
const MAX_H = 750000;
const BASE_H = 45000;

function colorExpr(lo, hi, pal) {
  const { cold, neutral, hot } = pal;
  if (lo < 0 && hi > 0)
    return [
      "interpolate",
      ["linear"],
      ["get", "cv"],
      lo,
      cold,
      0,
      neutral,
      hi,
      hot,
    ];
  if (hi <= 0)
    return [
      "interpolate",
      ["linear"],
      ["get", "cv"],
      lo,
      cold,
      hi === lo ? lo + 1e-6 : hi,
      neutral,
    ];
  return [
    "interpolate",
    ["linear"],
    ["get", "cv"],
    lo,
    neutral,
    hi === lo ? lo + 1e-6 : hi,
    hot,
  ];
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
  const pal = RAMPS[ramp] || RAMPS.diverging;

  // Domaine couleur/hauteur (linéaire ou log).
  const { dom, loD, hiD } = useMemo(() => {
    const fn = logScale ? (v) => Math.log10(1 + Math.max(0, v)) : (v) => v;
    return {
      dom: fn,
      loD: logScale ? fn(Math.max(0, min)) : min,
      hiD: fn(max),
    };
  }, [logScale, min, max]);

  const norm = useMemo(
    () => (v) =>
      hiD === loD
        ? 0.5
        : Math.max(0, Math.min(1, (dom(v) - loD) / (hiD - loD))),
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
        geometry: {
          type: "Point",
          coordinates: [f.properties.lng, f.properties.lat],
        },
        properties: { code: f.properties.code },
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
      center: [186, -14],
      zoom: 2.7,
      pitch: 58,
      bearing: -10,
      maxPitch: 72,
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

      map.addSource("cols", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource("centers", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "cols",
        type: "fill-extrusion",
        source: "cols",
        paint: {
          "fill-extrusion-color": colorExpr(loD, hiD, pal),
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
          map.setPaintProperty("cols", "fill-extrusion-height", [
            "*",
            ["get", "height"],
            e,
          ]);
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
      map.setPaintProperty(
        "cols",
        "fill-extrusion-color",
        colorExpr(loD, hiD, pal),
      );
  }, [loaded, loD, hiD, pal]);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    const cs = map.getSource("cols");
    const ce = map.getSource("centers");
    if (cs) cs.setData(fc);
    if (ce) ce.setData(centers);
    if (map.getLayer("cols"))
      map.setPaintProperty("cols", "fill-extrusion-height", ["get", "height"]);
  }, [loaded, fc, centers]);

  if (!TOKEN) return <div className="omap omap--notoken">{noTokenMsg}</div>;

  return (
    <div className="omap">
      <div ref={containerRef} className="omap__map" />
      <div className={`omap__legend omap__legend--${ramp}`}>
        <span>{lowLabel}</span>
        <span className="omap__legend-bar" />
        <span>{highLabel}</span>
        {midLabel ? (
          <span className="omap__legend-mid">· {midLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
