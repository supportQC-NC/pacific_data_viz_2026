// src/components/CycloneMap/CycloneMap.jsx
// ============================================================
// Acte 12 — Carte Mapbox SATELLITE (globe) des TRAJECTOIRES cycloniques.
// PRIORITÉ LISIBILITÉ : on voit CHAQUE LIGNE se tracer, pas un nuage de points.
//   • Historique (saisons passées) : trait FIN et TRÈS DISCRET (arrière-plan).
//   • Saison active : ligne ÉPAISSE + halo néon, dessinée SÉQUENTIELLEMENT
//     (un cyclone après l'autre), couleur qui CHANGE le long du tracé selon
//     l'intensité au fix près (si la couche points est chargée). Une TÊTE
//     lumineuse (comète) avance au bout de la ligne pendant le tracé.
//   • Points par fix : MASQUÉS en vue large, ils réapparaissent au zoom
//     (inspection + survol vent/pression/date). Plus de nuage de points.
//   • Marqueurs des territoires (PICT) ; recadrage au filtre région.
//   • prefers-reduced-motion → tracé instantané.
// Mapbox via window.mapboxgl (CDN). Couleurs via --cy-*/--c-* ; libellés via
// props (i18n parent). Aucune couleur/chaîne en dur.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CycloneMap.scss";

const mapboxgl = window.mapboxgl;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const HOME_VIEW = { center: [172, -18], zoom: 3.1, pitch: 35, bearing: -6 };

// Cadence RALENTIE : on doit suivre chaque ligne se tracer.
export const PER_CYCLONE_MS = 1300;
export const DRAW_MIN = 1200;
export const DRAW_MAX = 16000;
const SPEEDS = [0.5, 1, 2];

function cssVarRaw(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function resolveStageColors() {
  return {
    DTFA: cssVarRaw("--cy-dtfa", "#4ad9c0"),
    DTM: cssVarRaw("--cy-dtm", "#38bdf8"),
    DTFO: cssVarRaw("--cy-dtfo", "#fbbf24"),
    CT: cssVarRaw("--cy-ct", "#fb923c"),
    CTI: cssVarRaw("--cy-cti", "#f43f5e"),
    CTTI: cssVarRaw("--cy-ctti", "#ffffff"),
    fallback: cssVarRaw("--cy-dtfa", "#4ad9c0"),
  };
}
function resolveMisc() {
  return {
    accent: cssVarRaw("--c-accent", "#00e6ff"),
    text: cssVarRaw("--c-text", "#e8f4f8"),
    textSoft: cssVarRaw("--c-text-soft", "#9fc0cf"),
    bg: cssVarRaw("--c-bg", "#020912"),
  };
}
function stageColorExpr(c) {
  return [
    "match", ["get", "stage"],
    "DTFA", c.DTFA, "DTM", c.DTM, "DTFO", c.DTFO, "CT", c.CT, "CTI", c.CTI, "CTTI", c.CTTI,
    c.fallback,
  ];
}

// IMPORTANT : une interpolation sur le ZOOM doit être au PREMIER NIVEAU de
// l'expression (Mapbox rejette ["*", interpolate(zoom), k] → la propriété est
// ignorée et la ligne ne s'affiche pas). On intègre donc le facteur d'épaisseur
// DANS les paliers. Le terme `rank` (data-driven) reste autorisé en sortie.
const ACTIVE_LINE_W = [
  "interpolate", ["linear"], ["zoom"],
  2, ["+", 1.8, ["*", 0.8, ["coalesce", ["get", "rank"], 0]]],
  6, ["+", 4.2, ["*", 1.8, ["coalesce", ["get", "rank"], 0]]],
];
const ACTIVE_GLOW_W = [
  "interpolate", ["linear"], ["zoom"],
  2, ["+", 6, ["*", 2, ["coalesce", ["get", "rank"], 0]]],
  6, ["+", 13, ["*", 4, ["coalesce", ["get", "rank"], 0]]],
];
const HIST_LINE_W = ["interpolate", ["linear"], ["zoom"], 2, 0.5, 6, 1.4];
const HIST_GLOW_W = ["interpolate", ["linear"], ["zoom"], 2, 1.2, 6, 3];

// Points (fixes) : petits, et SURTOUT invisibles en vue large (anti-nuage).
const PT_RADIUS = [
  "interpolate", ["linear"], ["zoom"],
  3, ["interpolate", ["linear"], ["coalesce", ["get", "wind"], 0], 0, 1.4, 60, 2.2, 130, 3.2],
  6, ["interpolate", ["linear"], ["coalesce", ["get", "wind"], 0], 0, 2.6, 60, 4.2, 130, 6.5],
];
const PT_OPACITY = ["interpolate", ["linear"], ["zoom"], 4, 0, 5, 0.35, 6, 0.85];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function fmtDate(t) {
  if (t == null) return "";
  try {
    return new Date(Number(t)).toLocaleDateString();
  } catch (e) {
    return "";
  }
}
function segProps(cy, sOrder) {
  return {
    id: cy.id,
    name: cy.name || "",
    season: cy.season || "",
    sOrder,
    stage: cy.stage || "DTFA",
    rank: cy.stageRank == null ? 0 : cy.stageRank,
    vmax: cy.maxWind == null ? null : cy.maxWind,
    vmaxKmh: cy.maxWindKmh == null ? null : cy.maxWindKmh,
    pmin: cy.minPressureHpa == null ? null : cy.minPressureHpa,
  };
}
function sliceSegments(segments, progress) {
  if (progress >= 1) return segments;
  const total = segments.reduce((n, s) => n + s.length, 0);
  let take = Math.max(2, Math.round(total * progress));
  const out = [];
  for (const seg of segments) {
    if (take <= 0) break;
    if (seg.length <= take) {
      out.push(seg);
      take -= seg.length;
    } else {
      out.push(seg.slice(0, Math.max(2, take)));
      take = 0;
    }
  }
  return out;
}
function lastCoordOf(segments) {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const s = segments[i];
    if (s && s.length) return s[s.length - 1];
  }
  return null;
}
// Toutes les coordonnées [lng, lat] d'un cyclone (pour recadrer dessus en
// mode isolé). On lit d'abord les segments, sinon les fixes.
function collectCoords(cy) {
  if (!cy) return [];
  const out = [];
  if (Array.isArray(cy.segments)) {
    cy.segments.forEach((line) => {
      if (Array.isArray(line)) line.forEach((pt) => out.push([pt[0], pt[1]]));
    });
  }
  if (!out.length && Array.isArray(cy.fixes)) {
    cy.fixes.forEach((f) => {
      if (Number.isFinite(f.lng) && Number.isFinite(f.lat)) out.push([f.lng, f.lat]);
    });
  }
  return out;
}
// Trace COMPLÈTE d'un cyclone, colorée par INTENSITÉ au fix près (même logique
// que le dessin animé, mais figé) → on conserve le dégradé faible→intense
// que la légende décrit. Renvoie { lines, points }.
function fullCycloneFeatures(cy) {
  const lines = [];
  const points = [];
  if (!cy) return { lines, points };
  if (cy.hasFixes && Array.isArray(cy.fixes) && cy.fixes.length > 1) {
    const fs = cy.fixes;
    for (let j = 0; j < fs.length - 1; j += 1) {
      const a = fs[j];
      const b = fs[j + 1];
      const useB = (b.stageRank ?? -1) >= (a.stageRank ?? -1);
      lines.push({
        type: "Feature",
        properties: {
          name: cy.name || "",
          season: cy.season || "",
          stage: (useB ? b.stage : a.stage) || cy.stage || "DTFA",
          rank: Math.max(a.stageRank ?? 0, b.stageRank ?? 0),
        },
        geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      });
    }
    fs.forEach((fx) => {
      points.push({
        type: "Feature",
        properties: {
          name: cy.name || "",
          season: cy.season || "",
          stage: fx.stage || cy.stage || "DTFA",
          rank: fx.stageRank ?? cy.stageRank ?? 0,
          wind: fx.wind == null ? null : fx.wind,
          windKmh: fx.windKmh == null ? null : fx.windKmh,
          pressure: fx.pressure == null ? null : fx.pressure,
          t: fx.t == null ? null : fx.t,
        },
        geometry: { type: "Point", coordinates: [fx.lng, fx.lat] },
      });
    });
  } else {
    // Pas de fixes détaillés → on colore par le stade global du cyclone.
    (cy.segments || []).forEach((line) => {
      if (line && line.length >= 2) {
        lines.push({
          type: "Feature",
          properties: { name: cy.name || "", season: cy.season || "", stage: cy.stage || "DTFA", rank: cy.stageRank ?? 0 },
          geometry: { type: "LineString", coordinates: line },
        });
      }
      (line || []).forEach(([lng, lat]) => {
        points.push({
          type: "Feature",
          properties: { name: cy.name || "", season: cy.season || "", stage: cy.stage || "DTFA", wind: null },
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
      });
    });
  }
  return { lines, points };
}
function wholeLineFeatures(cy, sOrder, segments) {
  return segments
    .filter((line) => line && line.length >= 2)
    .map((line) => ({
      type: "Feature",
      properties: segProps(cy, sOrder),
      geometry: { type: "LineString", coordinates: line },
    }));
}

export default function CycloneMap({
  cyclones = [],
  seasons = [],
  seasonIndex = null,
  playing = false,
  onTogglePlay = null,
  onScrub = null,
  stages = [],
  stageLabels = {},
  labels = {},
  noTokenMsg = "",
  territories = [],
  focus = null,
  speed = 1,
  onSpeedChange = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const rafRef = useRef(0);
  const colorsRef = useRef(resolveStageColors());
  const labelsRef = useRef(labels);
  const stageLabelsRef = useRef(stageLabels);
  const drawIdxRef = useRef(-1);
  const [loaded, setLoaded] = useState(false);
  const [full, setFull] = useState(false);
  const [drawingId, setDrawingId] = useState(null);
  // Recherche / mode isolé (un seul cyclone affiché, toutes saisons confondues).
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    labelsRef.current = labels;
    stageLabelsRef.current = stageLabels;
  }, [labels, stageLabels]);

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const orderOf = useMemo(() => {
    const m = new Map();
    seasons.forEach((s, i) => m.set(s, i));
    return m;
  }, [seasons]);

  const allFC = useMemo(() => {
    const features = [];
    cyclones.forEach((cy) => {
      const sOrder = orderOf.has(cy.season) ? orderOf.get(cy.season) : 0;
      features.push(...wholeLineFeatures(cy, sOrder, cy.segments || []));
    });
    return { type: "FeatureCollection", features };
  }, [cyclones, orderOf]);

  const currentOrder = seasonIndex == null ? seasons.length - 1 : seasonIndex;
  const allMode = seasonIndex == null;

  const activeCyclones = useMemo(() => {
    if (allMode) return [];
    const season = seasons[currentOrder];
    return cyclones.filter((cy) => cy.season === season);
  }, [allMode, cyclones, seasons, currentOrder]);

  const headline = useMemo(() => {
    if (!activeCyclones.length) return null;
    return [...activeCyclones].sort(
      (a, b) => (b.stageRank ?? -1) - (a.stageRank ?? -1) || (b.maxWind ?? 0) - (a.maxWind ?? 0),
    )[0];
  }, [activeCyclones]);

  // Index de recherche : TOUS les cyclones, toutes saisons (indépendant du
  // scrubber). Tri saison décroissante puis nom.
  const searchIndex = useMemo(
    () =>
      [...cyclones]
        .filter((cy) => (cy.name || "").trim())
        .map((cy) => ({ id: cy.id, name: cy.name, season: cy.season || "" }))
        .sort((a, b) =>
          a.season < b.season ? 1 : a.season > b.season ? -1 : a.name.localeCompare(b.name),
        ),
    [cyclones],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchOpen || !q) return [];
    return searchIndex.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [searchIndex, query, searchOpen]);

  const selected = useMemo(
    () => (selectedId != null ? cyclones.find((c) => c.id === selectedId) || null : null),
    [selectedId, cyclones],
  );

  const pictFC = useMemo(
    () => ({
      type: "FeatureCollection",
      features: (territories || [])
        .filter((t) => Number.isFinite(t.lng) && Number.isFinite(t.lat))
        .map((t) => ({
          type: "Feature",
          properties: { code: t.code, name: t.name || t.code },
          geometry: { type: "Point", coordinates: [t.lng, t.lat] },
        })),
    }),
    [territories],
  );

  const applyColors = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("tracks-line")) return;
    const c = resolveStageColors();
    colorsRef.current = c;
    const expr = stageColorExpr(c);
    ["tracks-line", "tracks-glow", "active-line", "active-glow"].forEach((id) => {
      if (map.getLayer(id)) map.setPaintProperty(id, "line-color", expr);
    });
    ["active-pts", "active-head"].forEach((id) => {
      if (map.getLayer(id)) map.setPaintProperty(id, "circle-color", expr);
    });
    const m = resolveMisc();
    if (map.getLayer("pict-dot")) {
      map.setPaintProperty("pict-dot", "circle-color", m.accent);
      map.setPaintProperty("pict-dot", "circle-stroke-color", m.bg);
    }
    if (map.getLayer("pict-label")) {
      map.setPaintProperty("pict-label", "text-color", m.textSoft);
      map.setPaintProperty("pict-label", "text-halo-color", m.bg);
    }
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
  }, []);

  // ---- Init Mapbox (une seule fois) ----
  useEffect(() => {
    if (!TOKEN || mapRef.current || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      projection: "globe",
      center: HOME_VIEW.center,
      zoom: HOME_VIEW.zoom,
      pitch: HOME_VIEW.pitch,
      bearing: HOME_VIEW.bearing,
      maxPitch: 80,
      renderWorldCopies: true,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-left");

    map.on("load", () => {
      map.addLayer({
        id: "sky",
        type: "sky",
        paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0.0, 90.0], "sky-atmosphere-sun-intensity": 6 },
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
        map.addSource("dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
      }
      map.setTerrain({ source: "dem", exaggeration: 1.2 });

      const c = resolveStageColors();
      colorsRef.current = c;
      const colorExpr = stageColorExpr(c);
      const m = resolveMisc();

      map.addSource("pict", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("tracks", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("active", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("active-pts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("active-head", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      map.addLayer({
        id: "pict-dot",
        type: "circle",
        source: "pict",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.2, 6, 4.5],
          "circle-color": m.accent,
          "circle-stroke-color": m.bg,
          "circle-stroke-width": 1,
          "circle-opacity": 0.85,
        },
      });

      // Historique : FIN et DISCRET (arrière-plan). Glow quasi nul (anti-bouillie).
      map.addLayer({
        id: "tracks-glow",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": HIST_GLOW_W, "line-blur": 4, "line-opacity": 0.06 },
      });
      map.addLayer({
        id: "tracks-line",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": HIST_LINE_W, "line-opacity": 0.28 },
      });

      // Saison active : la STAR. Halo néon large + trait épais.
      map.addLayer({
        id: "active-glow",
        type: "line",
        source: "active",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": ACTIVE_GLOW_W, "line-blur": 10, "line-opacity": 0.5 },
      });
      map.addLayer({
        id: "active-line",
        type: "line",
        source: "active",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": ACTIVE_LINE_W, "line-opacity": 1 },
      });

      map.addLayer({
        id: "pict-label",
        type: "symbol",
        source: "pict",
        minzoom: 2.2,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 2.5, 10, 6, 13],
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-optional": true,
        },
        paint: { "text-color": m.textSoft, "text-halo-color": m.bg, "text-halo-width": 1.4 },
      });

      // Survol historique (invisible) — saisons strictement antérieures.
      map.addLayer({
        id: "tracks-hit",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-width": 14, "line-opacity": 0.001 },
      });

      // Points par fix : MASQUÉS en vue large (opacité = 0 sous z5), révélés au zoom.
      map.addLayer({
        id: "active-pts",
        type: "circle",
        source: "active-pts",
        paint: {
          "circle-radius": PT_RADIUS,
          "circle-color": colorExpr,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.5,
          "circle-opacity": PT_OPACITY,
          "circle-stroke-opacity": PT_OPACITY,
        },
      });

      // TÊTE lumineuse (comète) au bout de la ligne en cours de tracé.
      map.addLayer({
        id: "active-head",
        type: "circle",
        source: "active-head",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 6, 6.5],
          "circle-color": colorExpr,
          "circle-blur": 0.7,
          "circle-opacity": 0.95,
        },
      });

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "cmap-popup", offset: 12 });
      popupRef.current = popup;

      const fmtWind = (L, w, wk) =>
        w != null && w !== "" && w !== "null"
          ? `${Math.round(Number(w))} ${L.kt || ""}${wk != null && wk !== "" && wk !== "null" ? ` · ${Math.round(Number(wk))} ${L.kmh || ""}` : ""}`
          : "—";
      const fmtPres = (L, p) => (p != null && p !== "" && p !== "null" ? `${Math.round(Number(p))} ${L.hpa || ""}` : "—");

      const onMoveTrack = (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const p = f.properties || {};
        const L = labelsRef.current || {};
        const SL = stageLabelsRef.current || {};
        const html =
          `<div class="cmap-pop">` +
          `<span class="cmap-pop__name">${p.name || ""}</span>` +
          `<span class="cmap-pop__season">${p.season || ""}</span>` +
          `<span class="cmap-pop__stage" data-stage="${p.stage}">${SL[p.stage] || p.stage || ""}</span>` +
          `<span class="cmap-pop__row"><em>${L.wind || ""}</em> ${fmtWind(L, p.vmax, p.vmaxKmh)}</span>` +
          `<span class="cmap-pop__row"><em>${L.pressure || ""}</em> ${fmtPres(L, p.pmin)}</span>` +
          `</div>`;
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      };
      const onMovePt = (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const p = f.properties || {};
        const L = labelsRef.current || {};
        const SL = stageLabelsRef.current || {};
        const d = fmtDate(p.t);
        const html =
          `<div class="cmap-pop">` +
          `<span class="cmap-pop__name">${p.name || ""}</span>` +
          `<span class="cmap-pop__season">${p.season || ""}${d ? ` · ${d}` : ""}</span>` +
          `<span class="cmap-pop__stage" data-stage="${p.stage}">${SL[p.stage] || p.stage || ""}</span>` +
          `<span class="cmap-pop__row"><em>${L.wind || ""}</em> ${fmtWind(L, p.wind, p.windKmh)}</span>` +
          `<span class="cmap-pop__row"><em>${L.pressure || ""}</em> ${fmtPres(L, p.pressure)}</span>` +
          `</div>`;
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      };
      const onLeave = () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      };
      map.on("mousemove", "active-pts", onMovePt);
      map.on("mouseleave", "active-pts", onLeave);
      map.on("mousemove", "active-line", onMoveTrack);
      map.on("mouseleave", "active-line", onLeave);
      map.on("mousemove", "tracks-hit", onMoveTrack);
      map.on("mouseleave", "tracks-hit", onLeave);

      setLoaded(true);
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const obs = new MutationObserver(() => applyColors());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [applyColors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getSource("tracks")) return;
    map.getSource("tracks").setData(allFC);
  }, [allFC, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getSource("pict")) return;
    map.getSource("pict").setData(pictFC);
  }, [pictFC, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (focus && Array.isArray(focus.center)) {
      map.flyTo({ center: focus.center, zoom: focus.zoom ?? HOME_VIEW.zoom, pitch: HOME_VIEW.pitch, speed: 0.8, essential: true });
    } else {
      map.flyTo({ ...HOME_VIEW, speed: 0.8, essential: true });
    }
  }, [focus, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getLayer("tracks-line")) return;
    if (selectedId != null) return; // mode isolé géré par l'effet dédié
    if (allMode) {
      ["tracks-line", "tracks-glow", "tracks-hit"].forEach((id) => map.setFilter(id, null));
      map.setPaintProperty("tracks-line", "line-opacity", 0.34);
      map.setPaintProperty("tracks-glow", "line-opacity", 0.05);
      return;
    }
    const fHist = ["<", ["get", "sOrder"], currentOrder];
    map.setFilter("tracks-line", fHist);
    map.setFilter("tracks-glow", fHist);
    map.setFilter("tracks-hit", fHist);
    // Historique TRÈS estompé (cicatrices), pour ne pas masquer la saison active.
    const opa = ["interpolate", ["linear"], ["-", currentOrder, ["get", "sOrder"]], 0, 0.3, 3, 0.14, 10, 0.06];
    map.setPaintProperty("tracks-line", "line-opacity", opa);
    map.setPaintProperty("tracks-glow", "line-opacity", ["*", opa, 0.18]);
  }, [allMode, currentOrder, loaded, selectedId]);

  // ---- Dessin SÉQUENTIEL (au fix près si dispo) + tête comète ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getSource("active")) return undefined;
    const srcLine = map.getSource("active");
    const srcPts = map.getSource("active-pts");
    const srcHead = map.getSource("active-head");
    const setHead = (features) => srcHead && srcHead.setData({ type: "FeatureCollection", features });

    if (selectedId != null) {
      // Mode isolé : la trace est dessinée dans la couche active par l'effet
      // dédié (couleur par intensité). On NE vide PAS active ici, sinon une
      // avance de saison effacerait la trace isolée — on coupe juste la tête.
      setHead([]);
      drawIdxRef.current = -1;
      setDrawingId(null);
      return undefined;
    }

    if (allMode || !activeCyclones.length) {
      srcLine.setData({ type: "FeatureCollection", features: [] });
      if (srcPts) srcPts.setData({ type: "FeatureCollection", features: [] });
      setHead([]);
      drawIdxRef.current = -1;
      setDrawingId(null);
      return undefined;
    }

    const N = activeCyclones.length;
    const buildAt = (globalProgress) => {
      const lineFeatures = [];
      const ptFeatures = [];
      const headFeatures = [];
      activeCyclones.forEach((cy, i) => {
        const local = clamp01(globalProgress * N - i);
        if (local <= 0) return;
        const drawing = local < 1; // ce cyclone est-il en cours de tracé ?
        const sOrder = orderOf.has(cy.season) ? orderOf.get(cy.season) : currentOrder;

        if (cy.hasFixes && cy.fixes && cy.fixes.length > 1) {
          const k = Math.max(2, Math.round(local * cy.fixes.length));
          const fs = cy.fixes.slice(0, k);
          for (let j = 0; j < fs.length - 1; j += 1) {
            const a = fs[j];
            const b = fs[j + 1];
            const useB = (b.stageRank ?? -1) >= (a.stageRank ?? -1);
            lineFeatures.push({
              type: "Feature",
              properties: {
                name: cy.name || "",
                season: cy.season || "",
                stage: (useB ? b.stage : a.stage) || cy.stage || "DTFA",
                rank: Math.max(a.stageRank ?? 0, b.stageRank ?? 0),
              },
              geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
            });
          }
          fs.forEach((fx) => {
            ptFeatures.push({
              type: "Feature",
              properties: {
                name: cy.name || "",
                season: cy.season || "",
                stage: fx.stage || cy.stage || "DTFA",
                rank: fx.stageRank ?? cy.stageRank ?? 0,
                wind: fx.wind == null ? null : fx.wind,
                windKmh: fx.windKmh == null ? null : fx.windKmh,
                pressure: fx.pressure == null ? null : fx.pressure,
                t: fx.t == null ? null : fx.t,
              },
              geometry: { type: "Point", coordinates: [fx.lng, fx.lat] },
            });
          });
          if (drawing) {
            const head = fs[fs.length - 1];
            headFeatures.push({
              type: "Feature",
              properties: { stage: head.stage || cy.stage || "DTFA" },
              geometry: { type: "Point", coordinates: [head.lng, head.lat] },
            });
          }
        } else {
          const segs = sliceSegments(cy.segments || [], local);
          lineFeatures.push(...wholeLineFeatures(cy, sOrder, segs));
          segs.forEach((line) =>
            line.forEach(([lng, lat]) => {
              ptFeatures.push({
                type: "Feature",
                properties: { name: cy.name || "", season: cy.season || "", stage: cy.stage || "DTFA", wind: null },
                geometry: { type: "Point", coordinates: [lng, lat] },
              });
            }),
          );
          if (drawing) {
            const head = lastCoordOf(segs);
            if (head) {
              headFeatures.push({
                type: "Feature",
                properties: { stage: cy.stage || "DTFA" },
                geometry: { type: "Point", coordinates: [head[0], head[1]] },
              });
            }
          }
        }
      });
      srcLine.setData({ type: "FeatureCollection", features: lineFeatures });
      if (srcPts) srcPts.setData({ type: "FeatureCollection", features: ptFeatures });
      setHead(headFeatures);
    };

    if (reduceMotion) {
      buildAt(1);
      setHead([]);
      drawIdxRef.current = -1;
      setDrawingId(null);
      return undefined;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const base = Math.min(DRAW_MAX, Math.max(DRAW_MIN, N * PER_CYCLONE_MS));
    const dur = base / (speed > 0 ? speed : 1);
    const start = performance.now();
    // On affiche le 1er cyclone immédiatement ; le tick fera défiler les suivants.
    drawIdxRef.current = 0;
    setDrawingId(activeCyclones[0] ? activeCyclones[0].id : null);
    const tick = (now) => {
      const p = clamp01((now - start) / dur);
      buildAt(p);
      if (p < 1) {
        const idx = Math.min(N - 1, Math.floor(p * N));
        if (idx !== drawIdxRef.current) {
          drawIdxRef.current = idx;
          setDrawingId(activeCyclones[idx] ? activeCyclones[idx].id : null);
        }
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setHead([]); // tracé terminé → on retire la tête
        drawIdxRef.current = -1;
        setDrawingId(null); // retour au cyclone le plus intense de la saison
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [allMode, activeCyclones, currentOrder, orderOf, loaded, reduceMotion, speed, selectedId]);

  // ---- Mode isolé : n'afficher QUE le cyclone recherché (toutes saisons) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getLayer("tracks-line")) return;
    if (selectedId == null) return; // mode normal géré par les effets ci-dessus
    const cy = cyclones.find((c) => c.id === selectedId);
    if (!cy) return;
    // 1) Masquer l'historique mono-couleur ; ne garder que la zone de survol
    //    sur la trace isolée.
    map.setFilter("tracks-hit", ["==", ["get", "id"], selectedId]);
    map.setPaintProperty("tracks-line", "line-opacity", 0);
    map.setPaintProperty("tracks-glow", "line-opacity", 0);
    // 2) Dessiner la trace COLORÉE PAR INTENSITÉ dans la couche active.
    const { lines, points } = fullCycloneFeatures(cy);
    const srcLine = map.getSource("active");
    const srcPts = map.getSource("active-pts");
    const srcHead = map.getSource("active-head");
    if (srcLine) srcLine.setData({ type: "FeatureCollection", features: lines });
    if (srcPts) srcPts.setData({ type: "FeatureCollection", features: points });
    if (srcHead) srcHead.setData({ type: "FeatureCollection", features: [] });
    // 3) Recadrer sur la trajectoire.
    const coords = collectCoords(cy);
    if (coords.length && mapboxgl && mapboxgl.LngLatBounds) {
      const b = new mapboxgl.LngLatBounds(coords[0], coords[0]);
      coords.forEach((c) => b.extend(c));
      map.fitBounds(b, {
        padding: { top: 96, right: 90, bottom: 130, left: 90 },
        maxZoom: 6,
        duration: 900,
        pitch: 0,
        bearing: 0,
        essential: true,
      });
    }
  }, [selectedId, loaded, cyclones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const id = setTimeout(() => {
      map.resize();
      // En entrant en plein écran (hors mode isolé), on recadre sur la région
      // pour un globe bien centré — sinon la caméra fenêtrée donne un cadrage
      // de travers.
      if (full && selectedId == null) {
        const center = focus && Array.isArray(focus.center) ? focus.center : HOME_VIEW.center;
        const zoom = focus && focus.zoom ? focus.zoom : HOME_VIEW.zoom;
        map.easeTo({ center, zoom, pitch: HOME_VIEW.pitch, bearing: HOME_VIEW.bearing, duration: 700, essential: true });
      }
    }, 260);
    const onKey = (e) => {
      if (e.key === "Escape") setFull(false);
    };
    if (full) window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [full, focus, selectedId]);

  // Fermeture de la liste d'autocomplétion au clic à l'extérieur.
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  if (!TOKEN) return <div className="cmap cmap--notoken">{noTokenMsg}</div>;

  const hasTimeline = seasons.length > 0 && typeof onTogglePlay === "function";
  const curSeason = selected
    ? selected.season || ""
    : allMode
      ? labels.allSeasons || ""
      : seasons[currentOrder] || "";
  const display =
    selected ||
    (drawingId != null ? activeCyclones.find((c) => c.id === drawingId) : null) ||
    headline;
  const cycleSpeed = () => {
    if (!onSpeedChange) return;
    const i = SPEEDS.indexOf(speed);
    onSpeedChange(SPEEDS[(i + 1) % SPEEDS.length] || 1);
  };

  const selectCyclone = (s) => {
    setSelectedId(s.id);
    setQuery(s.name);
    setSearchOpen(false);
  };
  const clearSelection = () => {
    setSelectedId(null);
    setQuery("");
    setSearchOpen(false);
    const map = mapRef.current;
    if (!map) return;
    if (focus && Array.isArray(focus.center)) {
      map.flyTo({ center: focus.center, zoom: focus.zoom ?? HOME_VIEW.zoom, pitch: HOME_VIEW.pitch, speed: 0.8, essential: true });
    } else {
      map.flyTo({ ...HOME_VIEW, speed: 0.8, essential: true });
    }
  };

  return (
    <div className={`cmap ${full ? "cmap--full" : ""}`}>
      <div className="cmap__stage">
        <div ref={containerRef} className="cmap__map" />

        <div className="cmap__search" ref={searchRef}>
          <span className="cmap__search-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="15" height="15" focusable="false">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M16.5 16.5 L21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="cmap__search-input"
            type="text"
            value={query}
            placeholder={labels.searchPlaceholder || ""}
            aria-label={labels.searchPlaceholder || ""}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
              if (selectedId != null) setSelectedId(null);
            }}
            onFocus={() => setSearchOpen(true)}
          />
          {selectedId != null && (
            <button
              type="button"
              className="cmap__search-clear"
              onClick={clearSelection}
              aria-label={labels.searchClear || ""}
              title={labels.searchClear || ""}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {suggestions.length > 0 && (
            <ul className="cmap__search-list" role="listbox">
              {suggestions.map((s) => (
                <li key={s.id} role="option" aria-selected={s.id === selectedId}>
                  <button type="button" className="cmap__search-opt" onClick={() => selectCyclone(s)}>
                    <span className="cmap__search-opt-name">{s.name}</span>
                    <span className="cmap__search-opt-season">{s.season}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!allMode && curSeason ? (
          <span className="cmap__bigseason" aria-hidden="true">
            {curSeason}
          </span>
        ) : null}

        <div className="cmap__readout" aria-hidden={!hasTimeline}>
          <span className="cmap__season">{curSeason}</span>
          {!allMode && !selected && (
            <span className="cmap__count">
              {activeCyclones.length} {labels.cyclones || ""}
            </span>
          )}
          {display && (
            <span className="cmap__headline">
              <em className="cmap__headline-dot" data-stage={display.stage} aria-hidden="true" />
              <span className="cmap__headline-name">{display.name}</span>
              <span className="cmap__headline-stage">{stageLabels[display.stage] || ""}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="cmap__expand"
          onClick={() => setFull((f) => !f)}
          aria-label={full ? labels.close : labels.expand}
          title={full ? labels.close : labels.expand}
        >
          {full ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path d="M9 4 H4 V9 M15 4 H20 V9 M9 20 H4 V15 M15 20 H20 V15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className="cmap__expand-label">{full ? labels.close : labels.expand}</span>
        </button>

        {hasTimeline && (
          <div className="cmap__timeline">
            <button
              type="button"
              className="cmap__play"
              onClick={onTogglePlay}
              aria-label={playing ? labels.pause : labels.play}
              title={playing ? labels.pause : labels.play}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                  <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <input
              type="range"
              className="cmap__scrub"
              min={0}
              max={Math.max(0, seasons.length - 1)}
              value={currentOrder < 0 ? 0 : currentOrder}
              onChange={(e) => onScrub && onScrub(Number(e.target.value))}
              aria-label={labels.season}
            />
            <span className="cmap__scrub-val">{seasons[currentOrder] || ""}</span>
            {onSpeedChange ? (
              <button
                type="button"
                className="cmap__speed"
                onClick={cycleSpeed}
                title={`${speed}\u00d7`}
                aria-label={`${speed}\u00d7`}
              >
                {speed}
                {"\u00d7"}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="cmap__legend">
        {stages.map((s) => (
          <span className="cmap__legend-item" key={s.id}>
            <em className="cmap__legend-swatch" data-stage={s.id} aria-hidden="true" />
            {stageLabels[s.id] || ""}
          </span>
        ))}
      </div>
    </div>
  );
}