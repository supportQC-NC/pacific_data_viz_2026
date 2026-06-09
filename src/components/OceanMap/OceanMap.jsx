// src/components/OceanMap/OceanMap.jsx
// ============================================================
// Carte Mapbox SATELLITE en PROJECTION GLOBE — colonnes extrudees.
// Double encodage : HAUTEUR ∝ valeur, COULEUR = position vs mediane
// (rampe "semantic" vert -> cyan -> rouge centree sur `mid`). La VALEUR
// s'affiche sur chaque colonne. Globe + atmosphere + terrain + ciel +
// BATIMENTS 3D (on "monte" dans la ville : relief montagne + immeubles).
// Survol fiable a tout zoom (couche "hit" en pixels) + infobox enrichie
// (nom · valeur · derniere mesure). Controle de navigation (zoom + pitch).
// Bouton PLEIN ECRAN (toggle CSS + map.resize(), Echap pour fermer).
// CONTROLE PLAY + curseur d'annee sur la carte, pilote par le parent
// (props years/yearIndex/playing/onTogglePlay/onScrub) -> une seule
// timeline synchronisee avec le reste de l'acte. Le bloc n'apparait que
// si onTogglePlay est fourni (autres actes inchanges).
// Token : REACT_APP_MAPBOX_TOKEN.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PICT_GEO from "../../data/pictGeo";
import { pictName } from "../../i18n/pictNames";
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
    return [
      "interpolate",
      ["linear"],
      ["get", "cv"],
      lo,
      cold,
      mid,
      neutral,
      hi,
      hot,
    ];
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

// Territoire PICT le plus proche d'un point (decalage antimeridien) -> sert
// a nommer un point de littoral par l'ile a laquelle il appartient.
function nearestPict(ll) {
  const wlng = ll.lng < 0 ? ll.lng + 360 : ll.lng;
  let best = null;
  let bd = Infinity;
  Object.entries(PICT_GEO).forEach(([code, [clng, clat]]) => {
    const w = clng < 0 ? clng + 360 : clng;
    const d = (w - wlng) * (w - wlng) + (clat - ll.lat) * (clat - ll.lat);
    if (d < bd) {
      bd = d;
      best = code;
    }
  });
  return best;
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
  coastlineUrl = null,
}) {
  const { lang } = useLang();
  const ml = mapLabels[lang] || mapLabels.fr;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const rafRef = useRef(0);
  const fittedKeyRef = useRef("");
  const coastPtsRef = useRef([]);
  const coastIdxRef = useRef(-1);
  const showCoastRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [full, setFull] = useState(false);
  const [coastNav, setCoastNav] = useState(null);

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
        properties: {
          code: f.properties.code,
          val: f.properties.value,
          name: f.properties.name,
          value: f.properties.value,
          year: f.properties.year,
        },
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
      maxPitch: 80,
      renderWorldCopies: true,
      antialias: true,
    });
    mapRef.current = map;

    // Navigation 3D : zoom +/- et boussole d'inclinaison (pour vraiment se
    // balader : pivoter, incliner, plonger sur les cotes et les villes).
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-left");

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
      map.setTerrain({ source: "dem", exaggeration: 1.5 });
      map.setLight({
        anchor: "viewport",
        color: "#ffffff",
        intensity: 0.45,
        position: [1.4, 210, 30],
      });

      // BATIMENTS 3D : extrusion des empreintes du style (source composite,
      // source-layer "building"). Apparaissent en zoomant (>= z13) -> on voit
      // les immeubles en volume sur le littoral. Inseres SOUS les colonnes de
      // donnees. Sans effet si le style n'expose pas la couche "building".
      if (!map.getLayer("3d-buildings") && map.getSource("composite")) {
        map.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#9fb2c4",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0,
              15.5,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0,
              15.5,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.85,
          },
        });
      }

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

      // Couche de survol INVISIBLE en pixels : cible de taille d'ecran
      // constante (et meme un peu plus large en zoomant) -> on survole
      // facilement le territoire a tout niveau de zoom.
      map.addLayer({
        id: "hit",
        type: "circle",
        source: "centers",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 12, 6, 20, 10, 30],
          "circle-color": "#000000",
          "circle-opacity": 0,
        },
      });

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "pm-popup",
      });
      popupRef.current = popup;

      const measuredLabel =
        ml.measured || (lang === "fr" ? "Dernière mesure" : "Last measurement");
      const popupHtml = (pr) => {
        const v = Number(pr.value).toLocaleString();
        const meta = pr.year ? `<br/>${measuredLabel} \u00b7 ${pr.year}` : "";
        return `<strong>${pr.name}</strong><br/>${v} ${unit}${meta}`;
      };
      map.on("mousemove", "hit", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(popupHtml(f.properties))
          .addTo(map);
      });
      map.on("mouseleave", "hit", () => {
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
        colorExpr(loD, hiD, pal, midD),
      );
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

    // Recadrage DYNAMIQUE : on recalcule une "clé de bornes" à partir des
    // territoires présents (leurs positions). Elle change quand les FILTRES
    // changent (sous-région, territoire…), mais PAS au scrub d'année (mêmes
    // territoires) → la caméra suit les filtres sans sauter à chaque année.
    if (fc.features.length) {
      const lngs = fc.features.map((f) =>
        f.properties.lng < 0 ? f.properties.lng + 360 : f.properties.lng,
      );
      const lats = fc.features.map((f) => f.properties.lat);
      const key = fc.features
        .map(
          (f) =>
            `${f.properties.lng.toFixed(2)},${f.properties.lat.toFixed(2)}`,
        )
        .sort()
        .join("|");
      if (key !== fittedKeyRef.current) {
        const bounds = [
          [Math.min(...lngs) - 4, Math.min(...lats) - 4],
          [Math.max(...lngs) + 4, Math.max(...lats) + 4],
        ];
        // 1er rendu : instantané ; changements de filtre ensuite : transition douce.
        const duration = fittedKeyRef.current ? 700 : 0;
        map.fitBounds(bounds, {
          padding: 60,
          pitch: 45,
          bearing: -8,
          maxZoom: 4.2,
          duration,
        });
        fittedKeyRef.current = key;
      }
    }
  }, [loaded, fc, centers]);

  // Couche optionnelle « trait de côte » (Digital Earth Pacific — Landsat
  // Coastlines, CC BY-NC 4.0). Lisibilité à deux niveaux :
  //   • DE LOIN : deux nappes de chaleur (recul = rouge, avancée = bleu) qui
  //     révèlent les zones chaudes de changement côtier.
  //   • EN ZOOMANT : points précis (taille ∝ intensité m/an, halo blanc) qui
  //     apparaissent en fondu ; survol = valeur exacte. Inséré SOUS les
  //     colonnes/labels. Inactif si coastlineUrl absent (autres actes intacts).
  useEffect(() => {
    if (!loaded || !mapRef.current || !coastlineUrl) return undefined;
    const map = mapRef.current;
    let cancelled = false;
    const cw = (mapLabels[lang] || mapLabels.fr).coast || {};

    // |r| = intensité ; poids signés pour chaque nappe (capés à 2 m/an).
    const absR = ["max", ["*", -1, ["get", "r"]], ["get", "r"]];
    const eroW = ["interpolate", ["linear"], ["max", ["*", -1, ["get", "r"]], 0], 0, 0, 2, 1];
    const accW = ["interpolate", ["linear"], ["max", ["get", "r"], 0], 0, 0, 2, 1];

    const cpop = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "pm-popup",
    });
    const coastHtml = (r, ll) => {
      const dir = r < -0.2 ? cw.ero : r > 0.2 ? cw.acc : cw.sta;
      const place = nearestPict(ll);
      const placeName = place ? pictName(place, lang) : "";
      const lines = [];
      if (placeName) lines.push(`<strong>${placeName}</strong>`);
      lines.push(`${dir || ""} \u00b7 ${r > 0 ? "+" : ""}${r.toFixed(2)} ${cw.unit || ""}`);
      return lines.join("<br/>");
    };
    const onMove = (e) => {
      map.getCanvas().style.cursor = "pointer";
      const r = Number(e.features[0].properties.r);
      cpop.setLngLat(e.lngLat).setHTML(coastHtml(r, e.lngLat)).addTo(map);
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      cpop.remove();
    };

    fetch(coastlineUrl)
      .then((r) => r.json())
      .then((gj) => {
        if (cancelled || !mapRef.current) return;
        const pts = gj.features.map((f) => ({
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          r: Number(f.properties.r),
        }));
        coastPtsRef.current = pts;
        coastIdxRef.current = -1;
        setCoastNav({ idx: -1, total: pts.length });
        showCoastRef.current = (i) => {
          const p = pts[i];
          if (!p) return;
          cpop
            .setLngLat([p.lng, p.lat])
            .setHTML(coastHtml(p.r, { lng: p.lng, lat: p.lat }))
            .addTo(map);
        };
        if (map.getSource("coast")) {
          map.getSource("coast").setData(gj);
          return;
        }
        map.addSource("coast", { type: "geojson", data: gj });
        const before = map.getLayer("cols") ? "cols" : undefined;

        map.addLayer(
          {
            id: "coast-ero-heat",
            type: "heatmap",
            source: "coast",
            paint: {
              "heatmap-weight": eroW,
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 1.2],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 14, 6, 26],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.5, 5, 0],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(232,69,60,0)", 0.3, "rgba(232,69,60,0.5)", 1, "rgba(255,77,109,0.95)",
              ],
            },
          },
          before,
        );
        map.addLayer(
          {
            id: "coast-acc-heat",
            type: "heatmap",
            source: "coast",
            paint: {
              "heatmap-weight": accW,
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 1.2],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 14, 6, 26],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.45, 5, 0],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(44,127,184,0)", 0.3, "rgba(44,127,184,0.5)", 1, "rgba(0,230,255,0.95)",
              ],
            },
          },
          before,
        );
        map.addLayer(
          {
            id: "coast",
            type: "circle",
            source: "coast",
            paint: {
              "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                2,  ["interpolate", ["linear"], absR, 0, 2, 1, 4, 6, 9],
                6,  ["interpolate", ["linear"], absR, 0, 3, 1, 6, 6, 13],
                11, ["interpolate", ["linear"], absR, 0, 6, 1, 12, 6, 24],
                16, ["interpolate", ["linear"], absR, 0, 11, 1, 20, 6, 38],
              ],
              "circle-color": [
                "interpolate", ["linear"], ["get", "r"],
                -2, "#b3122a", -0.6, "#e8453c", -0.2, "#f3a08a",
                0, "#aeb7bd",
                0.2, "#86c6e6", 0.6, "#2c7fb8", 2, "#0b4f9e",
              ],
              "circle-opacity": [
                "interpolate", ["linear"], ["zoom"],
                2,  ["interpolate", ["linear"], absR, 0, 0.35, 0.4, 0.9],
                12, ["interpolate", ["linear"], absR, 0, 0.75, 0.4, 1],
              ],
              "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 0.4, 6, 1.1, 12, 1.7, 16, 2.4],
              "circle-stroke-color": "rgba(255,255,255,0.9)",
            },
          },
          before,
        );

        map.on("mousemove", "coast", onMove);
        map.on("mouseleave", "coast", onLeave);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try {
        const m = mapRef.current;
        if (m) {
          m.off("mousemove", "coast", onMove);
          m.off("mouseleave", "coast", onLeave);
          ["coast", "coast-acc-heat", "coast-ero-heat"].forEach((id) => {
            if (m.getLayer(id)) m.removeLayer(id);
          });
          if (m.getSource("coast")) m.removeSource("coast");
        }
        cpop.remove();
        coastPtsRef.current = [];
        coastIdxRef.current = -1;
        showCoastRef.current = null;
        setCoastNav(null);
      } catch (e) {
        /* carte deja detruite */
      }
    };
  }, [loaded, coastlineUrl, lang]);

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

  // Navigation pas-a-pas le long du littoral : recentre sur le point
  // precedent/suivant en CONSERVANT le zoom courant, et ouvre sa bulle.
  // 1er appel : on part du point le plus proche du centre actuel.
  const goCoast = useCallback((dir) => {
    const map = mapRef.current;
    const pts = coastPtsRef.current;
    if (!map || !pts.length) return;
    let idx = coastIdxRef.current;
    if (idx < 0) {
      const c = map.getCenter();
      const wc = c.lng < 0 ? c.lng + 360 : c.lng;
      let bd = Infinity;
      let bi = 0;
      pts.forEach((p, i) => {
        const w = p.lng < 0 ? p.lng + 360 : p.lng;
        const d = (w - wc) * (w - wc) + (p.lat - c.lat) * (p.lat - c.lat);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      idx = bi;
    } else {
      idx = (idx + dir + pts.length) % pts.length;
    }
    coastIdxRef.current = idx;
    const p = pts[idx];
    map.flyTo({ center: [p.lng, p.lat], zoom: map.getZoom(), speed: 0.8 });
    if (showCoastRef.current) showCoastRef.current(idx);
    setCoastNav({ idx, total: pts.length });
  }, []);

  if (!TOKEN) return <div className="omap omap--notoken">{noTokenMsg}</div>;

  const hasTimeline = years.length > 0 && typeof onTogglePlay === "function";
  const curYear = years.length ? years[yearIndex ?? 0] : "";
  const coastPrevLabel =
    ml.coastPrev || (lang === "fr" ? "Point précédent" : "Previous point");
  const coastNextLabel =
    ml.coastNext || (lang === "fr" ? "Point suivant" : "Next point");
  const coastBrowseLabel =
    ml.coastBrowse || (lang === "fr" ? "Parcourir la côte" : "Browse coast");

  return (
    <div className={`omap ${full ? "omap--full" : ""}`}>
      <div className="omap__stage">
        <div ref={containerRef} className="omap__map" />

        <button
          type="button"
          className="omap__expand"
          onClick={() => setFull((f) => !f)}
          aria-label={full ? ml.close : ml.expand}
          title={full ? ml.close : ml.expand}
        >
          {full ? (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M9 4 H4 V9 M15 4 H20 V9 M9 20 H4 V15 M15 20 H20 V15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {hasTimeline && (
          <div className="omap__timeline">
            <button
              type="button"
              className="omap__play"
              onClick={onTogglePlay}
              aria-label={playing ? ml.pause : ml.play}
              title={playing ? ml.pause : ml.play}
            >
              {playing ? (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect
                    x="6"
                    y="5"
                    width="4"
                    height="14"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="14"
                    y="5"
                    width="4"
                    height="14"
                    rx="1"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
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

        {coastNav && (
          <div className="omap__coastnav">
            <button
              type="button"
              className="omap__coastbtn"
              onClick={() => goCoast(-1)}
              aria-label={coastPrevLabel}
              title={coastPrevLabel}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path d="M14 6 L8 12 L14 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="omap__coastlabel">
              {coastNav.idx < 0 ? coastBrowseLabel : `${coastNav.idx + 1} / ${coastNav.total}`}
            </span>
            <button
              type="button"
              className="omap__coastbtn"
              onClick={() => goCoast(1)}
              aria-label={coastNextLabel}
              title={coastNextLabel}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path d="M10 6 L16 12 L10 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className={`omap__legend omap__legend--${ramp}`}>
        <span>{lowLabel}</span>
        <span className="omap__legend-bar" />
        <span>{highLabel}</span>
        {midLabel ? (
          <span className="omap__legend-mid">
            {"\u00b7"} {midLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}