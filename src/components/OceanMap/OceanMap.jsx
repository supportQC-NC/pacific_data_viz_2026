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

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PICT_GEO from "../../data/pictGeo";
import { pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import mapLabels from "../../i18n/mapLabels";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./OceanMap.scss";

// Mapbox GL est charge via le CDN officiel dans public/index.html
// (build pre-compile par Mapbox, jamais minifie par Terser) -> evite le
// bug "ReferenceError: x is not defined" au "npm run build". Identique en
// dev et en prod : on lit l'instance globale window.mapboxgl.
const mapboxgl = window.mapboxgl;

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
// Rampes historiques : hexs en dur, ne suivent pas le theme. Conservees
// telles quelles — elles sont utilisees par plusieurs actes et les changer
// les repeindrait tous. Migration prevue acte par acte.
const RAMPS = {
  diverging: { cold: "#2c7fb8", neutral: "#e6edf3", hot: "#e8453c" },
  good: { cold: "#1f8f54", neutral: "#d6efe0", hot: "#1f8f54" },
  semantic: { cold: "#25e09a", neutral: "#00e6ff", hot: "#ff4d6d" },
};

// Rampe "polarity" : la rampe DIVERGENTE validee du design system, lue dans
// les tokens (--c-div-*) donc elle suit le theme. C'est la seule des rampes
// du produit dont les deux poles ressortent sur les DEUX surfaces (poles
// 6,40:1 / 6,10:1 sur navy, 6,75:1 / 7,03:1 sur blanc ; centre a 1,3:1, il
// doit lire "rien"). Reservee aux grandeurs a vraie polarite autour d'un
// zero qui a un sens — une anomalie, typiquement.
//
// Elle remplace le vert<->rouge de la rampe "semantic", ecarte apres mesure :
// DE 4,1 en deuteranopie (les deux poles sont la MEME couleur pour ~8 % des
// hommes) contre 22,7 pour lavande<->rouge.
// Rampe "magnitude" : la rampe SÉQUENTIELLE du design system, lue dans les
// tokens (--c-seq-*) donc sensible au thème. Pour les grandeurs ORIENTÉES
// sans zéro qui ait un sens : des émissions par habitant, une population,
// des arrivées. Le pas le plus détaché de la surface est la valeur la plus
// forte, dans les deux thèmes.
//
// Elle remplace l'usage détourné d'une rampe divergente centrée sur la
// MÉDIANE : être sous la médiane du Pacifique n'est pas une polarité, c'est
// un rang. Et cette médiane bouge avec le filtre et avec l'année — le même
// territoire changeait donc de couleur sans avoir bougé.
function magnitudeRamp() {
  return {
    cold: cssVarRaw("--c-seq-100", "#3b4593"),
    neutral: cssVarRaw("--c-seq-500", "#8790c9"),
    hot: cssVarRaw("--c-seq-900", "#d3daff"),
  };
}

function polarityRamp() {
  return {
    cold: cssVarRaw("--c-div-1", "#8494fa"),
    neutral: cssVarRaw("--c-div-5", "#2f3140"),
    hot: cssVarRaw("--c-div-9", "#f86970"),
  };
}
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
// Ne garde que les segments des territoires demandés. `null` ou liste vide
// = on rend la collection telle quelle, sans recopier inutilement.
function filterCoast(gj, areas) {
  if (!gj) return gj;
  if (!areas || !areas.length) return gj;
  const keep = new Set(areas);
  return { ...gj, features: gj.features.filter((f) => keep.has(f.properties.a)) };
}

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
  showLegend = true,
  // Code territoire sur lequel OUVRIR la couche littoral, en survol
  // rapproché plutôt qu'en cadrage large. `null` = cadrage habituel.
  droneOn = null,
  fitAreas = null,
  // Ouverture DIRECTE en plein écran, sans passer par l'état interne.
  // Une carte du monde tassée dans un panneau de dashboard n'est ni un
  // graphique ni une immersion : elle est trop petite pour qu'on s'y repère
  // et trop grande pour qu'on la compare. Les escales peuvent donc la
  // présenter comme ce qu'elle est — un plein écran qu'on ouvre.
  initialFull = false,
  // Prévient le parent quand on quitte le plein écran, pour qu'il puisse
  // démonter la carte au lieu de la laisser retomber dans un panneau.
  onExitFull = null,
  // Territoires effectivement couverts par la couche littoral, renvoyés au
  // parent une fois le fichier lu. Il n'y a pas d'autre endroit d'où le
  // savoir : la liste dépend du contenu du GeoJSON, pas d'une table.
  onCoastAreas = null,
  // Sous-ensemble de territoires à AFFICHER sur la couche littoral. `null`
  // (défaut) = tous. Le filtre de sous-région de l'escale pilotait toutes les
  // vues sauf celle-ci : la carte continuait de montrer les 812 segments du
  // Pacifique entier pendant qu'on avait demandé la Mélanésie.
  coastAreas = null,
}) {
  const { lang } = useLang();
  const ml = mapLabels[lang] || mapLabels.fr;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const rafRef = useRef(0);
  const fittedKeyRef = useRef("");
  // Compteur de RECADRAGE. Le cadrage caméra se calculait une seule fois, au
  // premier rendu — c'est-à-dire potentiellement avant que le conteneur ait
  // sa taille définitive (chargement différé du composant, panneau qui se
  // met en place). La caméra restait alors réglée pour une boîte minuscule
  // et l'on ouvrait sur un globe lointain et noir, sans une seule tuile
  // visible. Ce compteur permet de redemander un cadrage quand la taille
  // change réellement.
  const [fitTick, setFitTick] = useState(0);
  const coastPtsRef = useRef([]);
  // La collection complète, telle que reçue : re-filtrer ne doit pas
  // relancer la requête ni reconstruire les couches.
  const coastRawRef = useRef(null);
  // Centre de survol recalculé sur les segments du territoire (voir plus bas).
  const droneCenterRef = useRef(null);
  // Le PREMIER cadrage se pose d'un coup (`jumpTo`) : animer une traversée
  // depuis un globe lointain déclenche une vague de tuiles intermédiaires qui
  // fige le rendu. Les suivants, eux, sont des déplacements demandés par le
  // lecteur : ils s'animent, sinon la carte a l'air de se téléporter et l'on
  // perd le lien entre l'endroit d'avant et celui d'après.
  const droneFlownRef = useRef(false);
  const showCoastRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [full, setFull] = useState(initialFull);

  const min = range?.min ?? -1;
  const max = range?.max ?? 1;
  // `tk` n'est pas lu directement : il sert de DECLENCHEUR. Il change a chaque
  // bascule de theme, ce qui relit les tokens --c-div-* et, via les deps de
  // l'effet de peinture plus bas, repeint les colonnes.
  const tk = useThemeTokens();
  const pal = useMemo(
    () =>
      ramp === "polarity"
        ? polarityRamp()
        : ramp === "magnitude"
          ? magnitudeRamp()
          : RAMPS[ramp] || RAMPS.diverging,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ramp, tk],
  );

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

  // Cadrage caméra : si `fitAreas` est fourni (codes ou objets {area}), on
  // recentre sur ces territoires SANS les afficher (utile pour la vue trait de
  // côte, qui n'a pas de points). Sinon, on cadre sur les points affichés.
  const fitFeatures = useMemo(() => {
    if (fitAreas && fitAreas.length) {
      const fts = [];
      fitAreas.forEach((a) => {
        const code = typeof a === "string" ? a : a && a.area;
        const c = code ? PICT_GEO[code] : null;
        if (c) fts.push({ properties: { lng: c[0], lat: c[1] } });
      });
      if (fts.length) return fts;
    }
    return fc.features;
  }, [fitAreas, fc]);

  useEffect(() => {
    // GARDE — sans elle, cet effet s'executait meme quand le composant rend
    // le repli "token manquant" (retour anticipe plus bas) : `containerRef`
    // n'etait alors jamais attache et Mapbox levait
    // « Invalid type: 'container' must be a String or HTMLElement ».
    // L'ErrorBoundary parent affichait « Donnees indisponibles » — un message
    // FAUX, les donnees etant completes ; seule la carte manquait.
    if (!TOKEN || !mapboxgl || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;

    // OUVERTURE EN SURVOL RAPPROCHÉ (`droneOn`).
    // Vu du globe entier, un segment de littoral fait moins d'un pixel : on
    // aperçoit deux nappes de chaleur sans comprendre qu'il s'agit d'un
    // rivage. Sur cette vue, la carte NAÎT donc au ras du terrain, caméra
    // inclinée, au-dessus du territoire demandé.
    //
    // Le cadrage est posé à la création et non par une animation après coup :
    // une traversée de dix niveaux de zoom sur une projection sphérique,
    // caméra inclinée, avec deux nappes de chaleur de 2 405 points à
    // rasteriser à chaque image, bloquait le rendu.
    //
    // `PICT_GEO` est la table de centroïdes que la carte utilise déjà pour
    // poser ses colonnes : de la géographie de référence, pas une donnée.
    const DRONE = droneOn && PICT_GEO[droneOn] ? PICT_GEO[droneOn] : null;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      projection: "globe",
      center: DRONE || [200, -13],
      zoom: DRONE ? 6.6 : 2.0,
      pitch: DRONE ? 50 : 45,
      bearing: DRONE ? -18 : -8,
      maxPitch: 80,
      renderWorldCopies: true,
      antialias: true,
    });
    mapRef.current = map;

    // Navigation 3D : zoom +/- et boussole d'inclinaison (pour vraiment se
    // balader : pivoter, incliner, plonger sur les cotes et les villes).
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-left",
    );

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
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.5,
            12,
            6,
            20,
            10,
            30,
          ],
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

    // OUVERTURE EN SURVOL : on REPOSE la caméra à chaque recadrage demandé.
    //
    // La carte naît déjà cadrée sur le territoire, mais elle naît aussi dans
    // un conteneur qui n'a pas encore sa taille définitive : Mapbox calcule
    // alors sa projection pour une boîte de quelques pixels. Quand le panneau
    // prend sa hauteur, l'observateur de taille appelle `resize()` et demande
    // un recadrage — sans cette branche, le cadrage large étant désactivé en
    // mode survol, plus personne ne reposait la caméra et l'on se retrouvait
    // devant une sphère noire, trop près, sans une seule tuile servie.
    //
    // `jumpTo` et non `easeTo` : aucune traversée de zoom à animer, donc
    // aucune vague de tuiles intermédiaires à charger.
    if (droneOn && PICT_GEO[droneOn]) {
      const key = `drone:${droneOn}`;
      if (fittedKeyRef.current !== key) {
        const cam = {
          center: droneCenterRef.current || PICT_GEO[droneOn],
          zoom: droneCenterRef.current ? 7.2 : 6.6,
          pitch: droneCenterRef.current ? 52 : 50,
          bearing: -18,
        };
        if (droneFlownRef.current) map.flyTo({ ...cam, speed: 0.9 });
        else map.jumpTo(cam);
        droneFlownRef.current = true;
        fittedKeyRef.current = key;
      }
    }

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
    if (fitFeatures.length) {
      const lngs = fitFeatures.map((f) =>
        f.properties.lng < 0 ? f.properties.lng + 360 : f.properties.lng,
      );
      const lats = fitFeatures.map((f) => f.properties.lat);
      const key = fitFeatures
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

        // On CALCULE la caméra avant de l'appliquer, au lieu d'appeler
        // `fitBounds` puis de corriger.
        //
        // `fitBounds` applique sa caméra à la frame SUIVANTE : lire
        // `map.getZoom()` juste après renvoie encore la valeur précédente, et
        // toute correction posée dans la foulée se fait écraser une frame
        // plus tard. C'est ce qui rendait un plancher de zoom inopérant.
        //
        // `cameraForBounds` renvoie la même caméra sans rien appliquer : on
        // peut donc la borner, puis l'appliquer une seule fois.
        // Ouverture en survol : le cadrage large n'a pas lieu d'être,
        // il ramènerait aussitôt la caméra sur tout le Pacifique.
        const cam = droneOn
          ? null
          : map.cameraForBounds(bounds, {
              padding: 60,
              maxZoom: 4.2,
            });

        // PLANCHER DE ZOOM. `fitBounds` sait plafonner, pas planchéier. Le
        // Pacifique couvre près de 90° de longitude : le cadrage « qui fait
        // tout tenir » renvoie un zoom si bas que, sur une projection
        // sphérique, on regarde le globe de trop loin — aucune tuile
        // satellite n'est servie et les colonnes passent sous le pixel.
        const MIN_Z = 2.9;

        if (cam) {
          map.easeTo({
            center: cam.center,
            zoom: Math.max(cam.zoom ?? MIN_Z, MIN_Z),
            pitch: 45,
            bearing: -8,
            duration,
          });
        } else if (!droneOn) {
          map.fitBounds(bounds, {
            padding: 60,
            pitch: 45,
            bearing: -8,
            maxZoom: 4.2,
            duration,
          });
        }
        if (!droneOn) fittedKeyRef.current = key;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, fc, centers, fitFeatures, fitTick, droneOn]);

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
    const eroW = [
      "interpolate",
      ["linear"],
      ["max", ["*", -1, ["get", "r"]], 0],
      0,
      0,
      2,
      1,
    ];
    const accW = [
      "interpolate",
      ["linear"],
      ["max", ["get", "r"], 0],
      0,
      0,
      2,
      1,
    ];

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
      lines.push(
        `${dir || ""} \u00b7 ${r > 0 ? "+" : ""}${r.toFixed(2)} ${cw.unit || ""}`,
      );
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
        // Chaque segment reçoit SON territoire, calculé une fois. C'est ce
        // qui permet ensuite de filtrer par sous-région sans re-parcourir la
        // géographie à chaque changement de menu.
        gj.features.forEach((f) => {
          f.properties.a =
            nearestPict({
              lng: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
            }) || "";
        });
        coastRawRef.current = gj;
        const pts = gj.features.map((f) => ({
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          r: Number(f.properties.r),
          a: f.properties.a,
        }));
        coastPtsRef.current = pts;

        // RECALAGE DU SURVOL SUR LES SEGMENTS RÉELLEMENT MESURÉS.
        //
        // La carte naît cadrée sur le centroïde du territoire (`pictGeo`),
        // ce qui suffit à ouvrir au bon endroit du globe. Mais un centroïde
        // n'est pas là où la donnée se trouve : pour la Nouvelle-Calédonie,
        // les 170 segments suivis se concentrent au sud-est, à environ deux
        // degrés du centre géographique — assez, à cette altitude, pour que
        // la côte sorte du cadre et qu'on n'ait sous les yeux que de l'eau.
        //
        // On recale donc sur la moyenne des segments du territoire. `jumpTo`
        // et non `easeTo` : pas de traversée à animer, donc pas de vague de
        // tuiles intermédiaires — c'est ce qui figeait le rendu.
        if (typeof onCoastAreas === "function") {
          onCoastAreas(Array.from(new Set(pts.map((q) => q.a))).filter(Boolean));
        }

        if (droneOn) {
          const mine = pts.filter((q) => q.a === droneOn);
          if (mine.length) {
            // Moyenne en longitudes déroulées : le jeu traverse l'antiméridien.
            const wrap = (v) => (v < 0 ? v + 360 : v);
            const lw = mine.reduce((a, q) => a + wrap(q.lng), 0) / mine.length;
            const lat = mine.reduce((a, q) => a + q.lat, 0) / mine.length;
            droneCenterRef.current = [lw > 180 ? lw - 360 : lw, lat];
            const cam = {
              center: droneCenterRef.current,
              zoom: 7.2,
              pitch: 52,
              bearing: -18,
            };
            if (droneFlownRef.current) map.flyTo({ ...cam, speed: 0.9 });
            else map.jumpTo(cam);
            droneFlownRef.current = true;
            fittedKeyRef.current = `drone:${droneOn}`;
          }
        }

        const visible = filterCoast(gj, coastAreas);
        if (map.getSource("coast")) {
          map.getSource("coast").setData(visible);
          return;
        }
        map.addSource("coast", { type: "geojson", data: visible });
        const before = map.getLayer("cols") ? "cols" : undefined;

        map.addLayer(
          {
            id: "coast-ero-heat",
            type: "heatmap",
            source: "coast",
            // Invisible au-delà : inutile de la rasteriser. Sans cette
            // borne, le survol rapproché faisait geler le rendu.
            maxzoom: 5.5,
            paint: {
              "heatmap-weight": eroW,
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                0.6,
                6,
                1.2,
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                14,
                6,
                26,
              ],
              "heatmap-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                0.5,
                5,
                0,
              ],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(232,69,60,0)",
                0.3,
                "rgba(232,69,60,0.5)",
                1,
                "rgba(255,77,109,0.95)",
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
            // Invisible au-delà : inutile de la rasteriser. Sans cette
            // borne, le survol rapproché faisait geler le rendu.
            maxzoom: 5.5,
            paint: {
              "heatmap-weight": accW,
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                0.6,
                6,
                1.2,
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                14,
                6,
                26,
              ],
              "heatmap-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                0.45,
                5,
                0,
              ],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(44,127,184,0)",
                0.3,
                "rgba(44,127,184,0.5)",
                1,
                "rgba(0,230,255,0.95)",
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
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                ["interpolate", ["linear"], absR, 0, 2, 1, 4, 6, 9],
                6,
                ["interpolate", ["linear"], absR, 0, 3, 1, 6, 6, 13],
                11,
                ["interpolate", ["linear"], absR, 0, 6, 1, 12, 6, 24],
                16,
                ["interpolate", ["linear"], absR, 0, 11, 1, 20, 6, 38],
              ],
              "circle-color": [
                "interpolate",
                ["linear"],
                ["get", "r"],
                -2,
                "#b3122a",
                -0.6,
                "#e8453c",
                -0.2,
                "#f3a08a",
                0,
                "#aeb7bd",
                0.2,
                "#86c6e6",
                0.6,
                "#2c7fb8",
                2,
                "#0b4f9e",
              ],
              "circle-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                ["interpolate", ["linear"], absR, 0, 0.35, 0.4, 0.9],
                12,
                ["interpolate", ["linear"], absR, 0, 0.75, 0.4, 1],
              ],
              "circle-stroke-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                0.4,
                6,
                1.1,
                12,
                1.7,
                16,
                2.4,
              ],
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
        showCoastRef.current = null;
      } catch (e) {
        /* carte deja detruite */
      }
    };
  }, [loaded, coastlineUrl, lang, droneOn, onCoastAreas, coastAreas]);

  // Redimensionnement du conteneur : on remet la carte à la bonne taille PUIS
  // on redemande un cadrage. Sans le second, la caméra garde le réglage d'une
  // boîte qui n'existe plus.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let last = 0;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0] ? entries[0].contentRect.height : 0;
      // Seuil : on ignore les variations d'un pixel, on ne réagit qu'aux
      // vrais changements de gabarit.
      if (Math.abs(h - last) < 24) return;
      last = h;
      if (!mapRef.current) return;
      mapRef.current.resize();
      fittedKeyRef.current = "";
      setFitTick((n) => n + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const id = setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.resize();
      // RECADRAGE après le changement de taille. Le cadrage initial est
      // calculé pour la boîte du panneau ; en plein écran la boîte change du
      // tout au tout et la caméra reste réglée pour l'ancienne — on ouvrait
      // sur un globe minuscule et noir, vu de si loin qu'aucune tuile
      // satellite n'était visible. Vider la clé de cadrage force le recalcul
      // sur les dimensions réelles.
      fittedKeyRef.current = "";
      setLoaded((v) => v);
    }, 340);
    return () => clearTimeout(id);
  }, [full]);

  // `onExitFull` passe par une ref : le parent le redéfinit à chaque rendu
  // (c'est une closure sur son propre état), l'inclure dans les dépendances
  // rebrancherait l'écouteur clavier à chaque frappe.
  const exitRef = useRef(onExitFull);
  exitRef.current = onExitFull;

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setFull(false);
        if (exitRef.current) exitRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);


  // LE FILTRE DE SOUS-RÉGION S'APPLIQUE À LA COUCHE LITTORAL.
  // Il ne relance rien : la collection complète est en mémoire depuis le
  // premier chargement, on ne fait que servir un sous-ensemble à la source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource("coast");
    if (!src || !coastRawRef.current) return;
    src.setData(filterCoast(coastRawRef.current, coastAreas));
  }, [loaded, coastAreas]);

  if (!TOKEN) return <div className="omap omap--notoken">{noTokenMsg}</div>;

  const hasTimeline = years.length > 0 && typeof onTogglePlay === "function";
  const curYear = years.length ? years[yearIndex ?? 0] : "";

  return (
    <div className={`omap ${full ? "omap--full" : ""}`}>
      <div className="omap__stage">
        <div ref={containerRef} className="omap__map" />

        <button
          type="button"
          className="omap__expand"
          onClick={() => {
            setFull((f) => {
              if (f && exitRef.current) exitRef.current();
              return !f;
            });
          }}
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

      </div>

      {/* L'échelle de valeurs n'a de sens QUE si la carte peint des valeurs.
          La vue « trait de côte » monte le globe avec une liste de points
          vide : elle n'affiche aucune colonne, seulement la couche de
          littoral, et porte sa propre légende recul/avancée. La barre
          générique s'empilait au-dessus en annonçant une échelle qui ne
          correspondait à rien de visible à l'écran. */}
      {showLegend ? (
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
      ) : null}
    </div>
  );
}
