// src/components/AtlasMap/AtlasMap.jsx
// ============================================================
// L'ATLAS — carte Mapbox interactive du finale.
//  • bulles : rayon = vulnérabilité, couleur = couche active (layer) ;
//  • clic sur un territoire → onSelect(code) ;
//  • sélection externe → vol + anneau de mise en avant ;
//  • recadrage dynamique au changement de filtre (clé de bornes) ;
//  • légende dégradée + libellés des plus gros points.
// Token : REACT_APP_MAPBOX_TOKEN.
// points : [{ code, name, lng, lat, value, vuln }]
// ============================================================
import React, { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./AtlasMap.scss";

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

export default function AtlasMap({
  points = [],
  range = { min: 0, max: 100 },
  ramp = ["#25e09a", "#ff6b4a", "#ff4d6d"],
  selected = null,
  onSelect,
  legendTitle = "",
  lowLabel = "",
  highLabel = "",
  noTokenMsg = "",
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const fitKeyRef = useRef("");
  const selRef = useRef(onSelect);
  selRef.current = onSelect;

  const fc = useMemo(
    () => ({
      type: "FeatureCollection",
      features: points
        .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat))
        .map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: {
            code: p.code,
            name: p.name,
            c: Number(p.value) || 0,
            vuln: Number(p.vuln) || 0,
          },
        })),
    }),
    [points],
  );

  const mid = (range.min + range.max) / 2;

  // init une seule fois
  useEffect(() => {
    if (!TOKEN || !elRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const root = typeof document !== "undefined" ? document.body : null;
    const isDark = !!(root && root.getAttribute("data-theme") === "dark");
    const styleUrl = isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";
    const ink = isDark ? "#e8eef5" : "#1c2530";
    const paper = isDark ? "#0b1118" : "#ffffff";
    const map = new mapboxgl.Map({
      container: elRef.current,
      style: styleUrl,
      center: [188, -8],
      zoom: 1.7,
      attributionControl: false,
      projection: "mercator",
    });
    mapRef.current = map;
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("load", () => {
      map.addSource("pts", { type: "geojson", data: fc });

      map.addLayer({
        id: "halo",
        type: "circle",
        source: "pts",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "vuln"],
            0,
            14,
            100,
            46,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "c"],
            range.min,
            ramp[0],
            mid,
            ramp[1],
            range.max,
            ramp[2],
          ],
          "circle-opacity": 0.14,
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: "dot",
        type: "circle",
        source: "pts",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "vuln"],
            0,
            6,
            100,
            26,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "c"],
            range.min,
            ramp[0],
            mid,
            ramp[1],
            range.max,
            ramp[2],
          ],
          "circle-stroke-color": paper,
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "sel",
        type: "circle",
        source: "pts",
        filter: ["==", ["get", "code"], selected || "__none__"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "vuln"],
            0,
            11,
            100,
            32,
          ],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": ink,
          "circle-stroke-width": 2.4,
        },
      });
      map.addLayer({
        id: "lab",
        type: "symbol",
        source: "pts",
        filter: [">", ["get", "vuln"], 60],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": ink,
          "text-halo-color": paper,
          "text-halo-width": 1.4,
        },
      });

      map.on("click", "dot", (e) => {
        const f = e.features && e.features[0];
        if (
          f &&
          f.properties &&
          f.properties.code &&
          typeof selRef.current === "function"
        )
          selRef.current(f.properties.code);
      });
      map.on("mouseenter", "dot", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "dot", () => {
        map.getCanvas().style.cursor = "";
      });

      loadedRef.current = true;
      fitToData(map, fc, fitKeyRef);
    });

    return () => {
      loadedRef.current = false;
      if (map) map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // données / couche → maj source + recadrage si l'ensemble change
  useEffect(() => {
    const map = mapRef.current;
    if (!loadedRef.current || !map) return;
    const src = map.getSource("pts");
    if (src) src.setData(fc);
    if (map.getLayer("dot")) {
      const color = [
        "interpolate",
        ["linear"],
        ["get", "c"],
        range.min,
        ramp[0],
        mid,
        ramp[1],
        range.max,
        ramp[2],
      ];
      map.setPaintProperty("dot", "circle-color", color);
      map.setPaintProperty("halo", "circle-color", color);
    }
    fitToData(map, fc, fitKeyRef);
  }, [fc, range.min, range.max, ramp, mid]);

  // sélection externe → filtre de l'anneau + vol vers le point
  useEffect(() => {
    const map = mapRef.current;
    if (!loadedRef.current || !map) return;
    if (map.getLayer("sel"))
      map.setFilter("sel", ["==", ["get", "code"], selected || "__none__"]);
    if (selected) {
      const f = fc.features.find((x) => x.properties.code === selected);
      if (f)
        map.flyTo({
          center: f.geometry.coordinates,
          zoom: Math.max(map.getZoom(), 3.4),
          duration: 900,
        });
    }
  }, [selected, fc]);

  if (!TOKEN) return <div className="atlas atlas--notoken">{noTokenMsg}</div>;

  return (
    <div className="atlas">
      <div ref={elRef} className="atlas__canvas" />
      <div className="atlas__legend">
        <span className="atlas__legend-title">{legendTitle}</span>
        <span className="atlas__legend-lo">{lowLabel}</span>
        <i
          className="atlas__legend-bar"
          style={{
            background: `linear-gradient(90deg, ${ramp[0]}, ${ramp[1]}, ${ramp[2]})`,
          }}
        />
        <span className="atlas__legend-hi">{highLabel}</span>
      </div>
    </div>
  );
}

function fitToData(map, fc, fitKeyRef) {
  if (!fc.features.length) return;
  const lngs = fc.features.map((f) =>
    f.geometry.coordinates[0] < 0
      ? f.geometry.coordinates[0] + 360
      : f.geometry.coordinates[0],
  );
  const lats = fc.features.map((f) => f.geometry.coordinates[1]);
  const key = fc.features
    .map((f) => f.properties.code)
    .sort()
    .join("|");
  if (key === fitKeyRef.current) return;
  const bounds = [
    [Math.min(...lngs) - 6, Math.min(...lats) - 6],
    [Math.max(...lngs) + 6, Math.max(...lats) + 6],
  ];
  try {
    map.fitBounds(bounds, {
      padding: 70,
      maxZoom: 4,
      duration: fitKeyRef.current ? 700 : 0,
    });
  } catch (err) {
    /* noop */
  }
  fitKeyRef.current = key;
}
