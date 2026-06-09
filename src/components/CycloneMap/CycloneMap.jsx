// src/components/CycloneMap/CycloneMap.jsx
// ============================================================
// Acte 12 — Carte Mapbox SATELLITE en PROJECTION GLOBE des TRAJECTOIRES
// cycloniques. Pièce maîtresse visuelle :
//   • Chaque trajectoire est colorée par STADE (barème Météo-France NC,
//     6 niveaux), épaisseur ∝ intensité, halo flou (« tempête lumineuse »).
//   • ACCUMULATION : la timeline déroule les 47 saisons. Les saisons passées
//     restent en « cicatrices » faibles ; la saison active brille.
//   • DESSIN SÉQUENTIEL « UN PAR UN, POINT PAR POINT » : à l'activation d'une
//     saison, ses cyclones se tracent l'un APRÈS l'autre, chacun point par
//     point, avec des POINTS lumineux qui apparaissent sur chaque position.
//     `prefers-reduced-motion` → tracé instantané.
//   • MARQUEURS DES TERRITOIRES suivis dans les autres jeux de données (PICT :
//     Nouvelle-Calédonie, Fidji, Vanuatu, Guam… ) avec leur nom.
//   • RECADRAGE : un changement de `focus` (filtre région) recentre la carte.
//   • Survol d'une trajectoire → bulletin (nom · saison · stade · vent · pression).
//
// PILOTAGE PAR LE PARENT (comme OceanMap) : seasons / seasonIndex / playing /
// onTogglePlay / onScrub / focus / territories. Mapbox via window.mapboxgl
// (CDN). Aucune couleur/chaîne en dur : couleurs via variables CSS (--cy-* et
// --c-*), libellés via props `labels` / `stageLabels` (i18n parent).
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CycloneMap.scss";

const mapboxgl = window.mapboxgl;
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const HOME_VIEW = { center: [172, -18], zoom: 3.1, pitch: 35, bearing: -6 };

// Cadence du dessin séquentiel.
const PER_CYCLONE_MS = 520;
const DRAW_MIN = 600;
const DRAW_MAX = 9000;

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
    "match",
    ["get", "stage"],
    "DTFA", c.DTFA,
    "DTM", c.DTM,
    "DTFO", c.DTFO,
    "CT", c.CT,
    "CTI", c.CTI,
    "CTTI", c.CTTI,
    c.fallback,
  ];
}

const WIDTH_EXPR = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2, ["+", 0.5, ["*", 0.42, ["coalesce", ["get", "rank"], 0]]],
  6, ["+", 1.4, ["*", 1.05, ["coalesce", ["get", "rank"], 0]]],
];

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

function lineFeaturesFor(cy, sOrder, segments) {
  return segments
    .filter((line) => line && line.length >= 2)
    .map((line) => ({
      type: "Feature",
      properties: segProps(cy, sOrder),
      geometry: { type: "LineString", coordinates: line },
    }));
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
  territories = [], // [{ code, name, lng, lat }]
  focus = null, // { center:[lng,lat], zoom } | null → vue par défaut
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const rafRef = useRef(0);
  const colorsRef = useRef(resolveStageColors());
  const labelsRef = useRef(labels);
  const stageLabelsRef = useRef(stageLabels);
  const [loaded, setLoaded] = useState(false);
  const [full, setFull] = useState(false);

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
      features.push(...lineFeaturesFor(cy, sOrder, cy.segments || []));
    });
    return { type: "FeatureCollection", features };
  }, [cyclones, orderOf]);

  const currentOrder = seasonIndex == null ? seasons.length - 1 : seasonIndex;
  const allMode = seasonIndex == null;

  const activeCyclones = useMemo(() => {
    if (allMode) return [];
    const season = seasons[currentOrder];
    // déjà triés chronologiquement (cycloneApi trie par date de début)
    return cyclones.filter((cy) => cy.season === season);
  }, [allMode, cyclones, seasons, currentOrder]);

  const headline = useMemo(() => {
    if (!activeCyclones.length) return null;
    return [...activeCyclones].sort(
      (a, b) => (b.stageRank ?? -1) - (a.stageRank ?? -1) || (b.maxWind ?? 0) - (a.maxWind ?? 0),
    )[0];
  }, [activeCyclones]);

  // Territoires (PICT) → FeatureCollection de points.
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

  // ---- Application des couleurs (thème-aware) ----
  const applyColors = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("tracks-line")) return;
    const c = resolveStageColors();
    colorsRef.current = c;
    const expr = stageColorExpr(c);
    map.setPaintProperty("tracks-line", "line-color", expr);
    map.setPaintProperty("tracks-glow", "line-color", expr);
    map.setPaintProperty("active-line", "line-color", expr);
    map.setPaintProperty("active-glow", "line-color", expr);
    if (map.getLayer("active-pts")) map.setPaintProperty("active-pts", "circle-color", expr);

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
      map.setTerrain({ source: "dem", exaggeration: 1.2 });

      const c = resolveStageColors();
      colorsRef.current = c;
      const colorExpr = stageColorExpr(c);
      const m = resolveMisc();

      map.addSource("pict", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("tracks", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("active", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("active-pts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Points des territoires suivis (sous les tracés).
      map.addLayer({
        id: "pict-dot",
        type: "circle",
        source: "pict",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.4, 6, 5],
          "circle-color": m.accent,
          "circle-stroke-color": m.bg,
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });

      // Halo + trait (historique).
      map.addLayer({
        id: "tracks-glow",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": ["*", WIDTH_EXPR, 2.6], "line-blur": 6, "line-opacity": 0.18 },
      });
      map.addLayer({
        id: "tracks-line",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": WIDTH_EXPR, "line-opacity": 0.5 },
      });

      // Halo + trait (saison active, dessin séquentiel).
      map.addLayer({
        id: "active-glow",
        type: "line",
        source: "active",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": ["*", WIDTH_EXPR, 3.4], "line-blur": 8, "line-opacity": 0.5 },
      });
      map.addLayer({
        id: "active-line",
        type: "line",
        source: "active",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colorExpr, "line-width": ["*", WIDTH_EXPR, 1.5], "line-opacity": 0.98 },
      });

      // Points « position par position » de la saison active.
      map.addLayer({
        id: "active-pts",
        type: "circle",
        source: "active-pts",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 6, 3.4],
          "circle-color": colorExpr,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.6,
          "circle-opacity": 0.95,
        },
      });

      // Libellés des territoires (au-dessus).
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
        paint: {
          "text-color": m.textSoft,
          "text-halo-color": m.bg,
          "text-halo-width": 1.4,
        },
      });

      // Couche de survol invisible (au-dessus, capte le hover des tracés).
      map.addLayer({
        id: "tracks-hit",
        type: "line",
        source: "tracks",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-width": 14, "line-opacity": 0.001 },
      });

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "cmap-popup",
        offset: 12,
      });
      popupRef.current = popup;

      const onMove = (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        const p = f.properties || {};
        const L = labelsRef.current || {};
        const SL = stageLabelsRef.current || {};
        const stg = SL[p.stage] || p.stage || "";
        const wind =
          p.vmax != null && p.vmax !== "" && p.vmax !== "null"
            ? `${Math.round(Number(p.vmax))} ${L.kt || ""}${
                p.vmaxKmh != null && p.vmaxKmh !== "" ? ` · ${p.vmaxKmh} ${L.kmh || ""}` : ""
              }`
            : "—";
        const pres =
          p.pmin != null && p.pmin !== "" && p.pmin !== "null"
            ? `${Math.round(Number(p.pmin))} ${L.hpa || ""}`
            : "—";
        const html =
          `<div class="cmap-pop">` +
          `<span class="cmap-pop__name">${p.name || ""}</span>` +
          `<span class="cmap-pop__season">${p.season || ""}</span>` +
          `<span class="cmap-pop__stage" data-stage="${p.stage}">${stg}</span>` +
          `<span class="cmap-pop__row"><em>${L.wind || ""}</em> ${wind}</span>` +
          `<span class="cmap-pop__row"><em>${L.pressure || ""}</em> ${pres}</span>` +
          `</div>`;
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      };
      const onLeave = () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      };
      map.on("mousemove", "tracks-hit", onMove);
      map.on("mouseleave", "tracks-hit", onLeave);
      map.on("mousemove", "active-line", onMove);
      map.on("mouseleave", "active-line", onLeave);

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

  // ---- Thème → re-résolution des couleurs ----
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const obs = new MutationObserver(() => applyColors());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [applyColors]);

  // ---- Source historique ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getSource("tracks")) return;
    map.getSource("tracks").setData(allFC);
  }, [allFC, loaded]);

  // ---- Marqueurs des territoires ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getSource("pict")) return;
    map.getSource("pict").setData(pictFC);
  }, [pictFC, loaded]);

  // ---- Recadrage sur changement de focus (filtre région) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (focus && Array.isArray(focus.center)) {
      map.flyTo({
        center: focus.center,
        zoom: focus.zoom ?? HOME_VIEW.zoom,
        pitch: HOME_VIEW.pitch,
        speed: 0.8,
        essential: true,
      });
    } else {
      map.flyTo({ ...HOME_VIEW, speed: 0.8, essential: true });
    }
  }, [focus, loaded]);

  // ---- Filtre & opacité « historique » selon la saison ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getLayer("tracks-line")) return;
    if (allMode) {
      map.setFilter("tracks-line", null);
      map.setFilter("tracks-glow", null);
      map.setFilter("tracks-hit", null);
      map.setPaintProperty("tracks-line", "line-opacity", 0.55);
      map.setPaintProperty("tracks-glow", "line-opacity", 0.2);
      return;
    }
    const fHist = ["<", ["get", "sOrder"], currentOrder];
    const fSeen = ["<=", ["get", "sOrder"], currentOrder];
    map.setFilter("tracks-line", fHist);
    map.setFilter("tracks-glow", fHist);
    map.setFilter("tracks-hit", fSeen);
    const opa = ["interpolate", ["linear"], ["-", currentOrder, ["get", "sOrder"]], 0, 0.85, 3, 0.4, 10, 0.16];
    map.setPaintProperty("tracks-line", "line-opacity", opa);
    map.setPaintProperty("tracks-glow", "line-opacity", ["*", opa, 0.4]);
  }, [allMode, currentOrder, loaded]);

  // ---- Dessin SÉQUENTIEL « un par un, point par point » ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !map.getSource("active")) return undefined;
    const srcLine = map.getSource("active");
    const srcPts = map.getSource("active-pts");

    if (allMode || !activeCyclones.length) {
      srcLine.setData({ type: "FeatureCollection", features: [] });
      if (srcPts) srcPts.setData({ type: "FeatureCollection", features: [] });
      return undefined;
    }

    const N = activeCyclones.length;
    const buildAt = (globalProgress) => {
      const lineFeatures = [];
      const ptFeatures = [];
      activeCyclones.forEach((cy, i) => {
        // Chaque cyclone occupe une tranche [i/N, (i+1)/N] du temps total →
        // ils se dessinent l'un après l'autre.
        const local = clamp01(globalProgress * N - i);
        if (local <= 0) return;
        const sOrder = orderOf.has(cy.season) ? orderOf.get(cy.season) : currentOrder;
        const segs = sliceSegments(cy.segments || [], local);
        lineFeatures.push(...lineFeaturesFor(cy, sOrder, segs));
        segs.forEach((line) =>
          line.forEach(([lng, lat]) => {
            ptFeatures.push({
              type: "Feature",
              properties: { stage: cy.stage || "DTFA" },
              geometry: { type: "Point", coordinates: [lng, lat] },
            });
          }),
        );
      });
      srcLine.setData({ type: "FeatureCollection", features: lineFeatures });
      if (srcPts) srcPts.setData({ type: "FeatureCollection", features: ptFeatures });
    };

    if (reduceMotion) {
      buildAt(1);
      return undefined;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const dur = Math.min(DRAW_MAX, Math.max(DRAW_MIN, N * PER_CYCLONE_MS));
    const start = performance.now();
    const tick = (now) => {
      const p = clamp01((now - start) / dur);
      buildAt(p); // progression linéaire → cadence régulière, un cyclone à la fois
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [allMode, activeCyclones, currentOrder, orderOf, loaded, reduceMotion]);

  // ---- Plein écran : resize ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const id = setTimeout(() => map.resize(), 260);
    const onKey = (e) => {
      if (e.key === "Escape") setFull(false);
    };
    if (full) window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  if (!TOKEN) return <div className="cmap cmap--notoken">{noTokenMsg}</div>;

  const hasTimeline = seasons.length > 0 && typeof onTogglePlay === "function";
  const curSeason = allMode ? labels.allSeasons || "" : seasons[currentOrder] || "";

  return (
    <div className={`cmap ${full ? "cmap--full" : ""}`}>
      <div className="cmap__stage">
        <div ref={containerRef} className="cmap__map" />

        <div className="cmap__readout" aria-hidden={!hasTimeline}>
          <span className="cmap__season">{curSeason}</span>
          {!allMode && (
            <span className="cmap__count">
              {activeCyclones.length} {labels.cyclones || ""}
            </span>
          )}
          {headline && (
            <span className="cmap__headline">
              <em className="cmap__headline-dot" data-stage={headline.stage} aria-hidden="true" />
              <span className="cmap__headline-name">{headline.name}</span>
              <span className="cmap__headline-stage">{stageLabels[headline.stage] || ""}</span>
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