// src/services/cycloneApi.js
// ============================================================
// Acte 12 — « Cyclones ». Trajectoires historiques des phénomènes tropicaux
// (base de données cycloniques pour la Nouvelle-Calédonie de Météo-France,
// diffusée par la plateforme Géorep — Gouvernement de la Nouvelle-Calédonie).
//
// DEUX COUCHES (fichiers GeoJSON statiques téléchargés, AUCUN appel API live) :
//   1) TRAJECTOIRES (« Historique des trajectoires ») — OBLIGATOIRE.
//      1 feature = 1 cyclone, LineString/MultiLineString. Métadonnées :
//      num_ref, nom, saison, date_deb/fin, type_min/max, vmax_traj, pmin_traj…
//      → fournit la géométrie + le stade de POINTE (type_max).
//   2) POSITIONS / POINTS (« Historique des positions ») — OPTIONNEL.
//      1 feature = 1 FIX horodaté (Point) : date + vent + pression + type.
//      → débloque le « vrai replay » : l'intensité (couleur) CHANGE le long
//      de la trajectoire, points dimensionnés par le vent, survol au fix près.
//      Si ce fichier est absent, tout fonctionne en repli (stade de pointe).
//
// Place les fichiers dans public/data/cyclones/ :
//   Historique_des_trajectoires.geojson   (obligatoire)
//   Historique_des_positions.geojson      (optionnel ; noms alternatifs tentés)
// Overrides : REACT_APP_CYCLONE_FILE, REACT_APP_CYCLONE_POINTS_FILE.
//
// PRINCIPES : statut « live »/« unavailable » ; AUCUNE donnée inventée ;
// libellés via i18n (clés), aucune couleur ici. vmax en NŒUDS (cohérence
// interne, cf. note historique) + conversion km/h. Le stade vient du libellé
// officiel `type_*` (fait foi), jamais d'un seuil recalculé.
// ============================================================

const ENV_FILE =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_CYCLONE_FILE) || "";
const ENV_POINTS =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_CYCLONE_POINTS_FILE) || "";

const FILES = [
  ENV_FILE,
  "/data/cyclones/historique-des-trajectoires.geojson",
  "/data/cyclones/Historique_des_trajectoires.geojson",
  "/data/cyclones/nouvelle-caledonie-segments.geojson",
].filter(Boolean);

const POINT_FILES = [
  ENV_POINTS,
  "/data/cyclones/historique_des_positions.geojson",
  "/data/cyclones/historique-des-positions.geojson",
  "/data/cyclones/Historique_des_positions.geojson",
  "/data/cyclones/historique-des-points.geojson",
  "/data/cyclones/Historique_des_points.geojson",
  "/data/cyclones/nouvelle-caledonie-points.geojson",
].filter(Boolean);

const TIMEOUT_MS = 35000;
const KT_TO_KMH = 1.852;

// --- Barème officiel Météo-France Nouvelle-Calédonie ---------------------
export const STAGES = [
  { id: "DTFA", rank: 0, i18nKey: "act12.stage.dtfa", match: "depression tropicale faible" },
  { id: "DTM", rank: 1, i18nKey: "act12.stage.dtm", match: "depression tropicale moderee" },
  { id: "DTFO", rank: 2, i18nKey: "act12.stage.dtfo", match: "depression tropicale forte" },
  { id: "CT", rank: 3, i18nKey: "act12.stage.ct", match: "cyclone tropical" },
  { id: "CTI", rank: 4, i18nKey: "act12.stage.cti", match: "cyclone tropical intense" },
  { id: "CTTI", rank: 5, i18nKey: "act12.stage.ctti", match: "cyclone tropical tres intense" },
];
const STAGE_BY_ID = STAGES.reduce((m, s) => ((m[s.id] = s), m), {});

function normalizeText(s) {
  return String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function stageFromType(text) {
  const norm = normalizeText(text);
  if (!norm) return null;
  const exact = STAGES.find((s) => s.match === norm);
  if (exact) return exact;
  const byLen = [...STAGES].sort((a, b) => b.match.length - a.match.length);
  return byLen.find((s) => norm.includes(s.match)) || null;
}

// --- Parsing valeurs -----------------------------------------------------
function finiteNum(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toMillis(v) {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e11 ? v : v * 1000;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

function geometryToSegments(geometry) {
  if (!geometry) return [];
  const { type, coordinates } = geometry;
  if (type === "LineString") return coordinates && coordinates.length ? [coordinates] : [];
  if (type === "MultiLineString") return (coordinates || []).filter((s) => s && s.length);
  return [];
}
// Déroule les longitudes d'une polyligne pour qu'elle reste CONTINUE à travers
// l'antiméridien (évite les tracés qui font le tour du globe). Les copies de
// monde de Mapbox replacent ensuite correctement les longitudes > ±180.
function unwrapLine(line) {
  if (!line.length) return line;
  const res = [[line[0][0], line[0][1]]];
  let prev = line[0][0];
  for (let i = 1; i < line.length; i += 1) {
    let lng = line[i][0];
    const lat = line[i][1];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    res.push([lng, lat]);
    prev = lng;
  }
  return res;
}

function cleanSegments(segs) {
  const out = [];
  for (const seg of segs) {
    const line = [];
    for (const c of seg) {
      const lng = finiteNum(c[0]);
      const lat = finiteNum(c[1]);
      if (lng == null || lat == null) continue;
      line.push([lng, lat]);
    }
    if (line.length >= 2) out.push(unwrapLine(line));
  }
  return out;
}

// --- Chargement d'un fichier GeoJSON statique (avec garde anti-HTML) -----
async function loadGeoJsonFrom(files, kind, signal) {
  for (const url of files) {
    try {
      const res = await fetch(url, { signal, headers: { Accept: "application/geo+json, application/json" } });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.info(`[cycloneApi] (${kind})`, url, "→ HTTP", res.status);
        continue;
      }
      const text = await res.text();
      const head = text.trimStart().charAt(0);
      if (head !== "{" && head !== "[") {
        // eslint-disable-next-line no-console
        console.warn(`[cycloneApi] (${kind})`, url, "→ réponse non-JSON (index.html de repli ?).");
        continue;
      }
      const gj = JSON.parse(text);
      const feats = (gj && gj.features) || [];
      if (feats.length) {
        // eslint-disable-next-line no-console
        console.info(`[cycloneApi] (${kind}) fichier OK —`, url, "·", feats.length, "features");
        return { features: feats, via: url };
      }
      // eslint-disable-next-line no-console
      console.info(`[cycloneApi] (${kind})`, url, "→ 0 feature");
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      // eslint-disable-next-line no-console
      console.info(`[cycloneApi] (${kind})`, url, "→ erreur", String(e));
    }
  }
  return { features: [], via: null };
}

// --- Trajectoires → cyclones ---------------------------------------------
function buildCyclones(features) {
  const cyclones = [];
  features.forEach((f, i) => {
    const segments = cleanSegments(geometryToSegments(f.geometry));
    if (!segments.length) return;
    const p = f.properties || {};
    const stage = stageFromType(p.type_max);
    const maxWind = finiteNum(p.vmax_traj);
    const pmin = finiteNum(p.pmin_traj);
    const path = segments.flat();
    cyclones.push({
      id: p.num_ref != null ? String(p.num_ref) : `row_${i}`,
      numRef: p.num_ref != null ? String(p.num_ref) : null,
      name: p.nom ? String(p.nom).trim() : null,
      season: p.saison ? String(p.saison).trim() : null,
      yearStart: finiteNum(p.annee_deb),
      yearEnd: finiteNum(p.annee_fin),
      posSeason: finiteNum(p.pos_saison),
      dateStart: p.date_deb || null,
      dateEnd: p.date_fin || null,
      startTime: toMillis(p.date_deb),
      endTime: toMillis(p.date_fin),
      typeMin: p.type_min || null,
      typeMax: p.type_max || null,
      stage: stage ? stage.id : null,
      stageRank: stage ? stage.rank : null,
      maxWind,
      windUnit: "kt",
      maxWindKmh: maxWind != null ? Math.round(maxWind * KT_TO_KMH) : null,
      minPressureHpa: pmin != null && pmin > 0 ? pmin : null,
      lengthM: finiteNum(p.Shape__Length),
      segments,
      path,
      pointCount: path.length,
      fixes: null,
      hasFixes: false,
    });
  });
  return cyclones;
}

// --- Sondage de champs (couche points) -----------------------------------
const PT_FIELDS = {
  joinRef: ["num_ref", "numref", "id_pheno", "num_pheno", "num", "ref"],
  name: ["nom", "name"],
  season: ["saison", "season"],
  datetime: ["date", "date_heure", "datetime", "date_utc", "date_tu", "horodate", "timestamp", "dt", "dateheure", "date_obs"],
  wind: ["vent_max", "vent_moy", "vmax", "vent", "wind", "vitesse_vent", "vmax_pos"],
  pressure: ["pression_min", "pression", "pmin", "pres_mer", "mslp", "pressure", "press", "pression_pos"],
  stageText: ["type", "stade", "categorie", "classe", "type_pheno", "intensite", "classification", "type_pos"],
  order: ["pos_traj", "pos", "ordre", "seq", "num_pos", "point_id", "ordre_pos"],
};
function detectFields(features, spec) {
  const props = features.find((f) => f && f.properties)?.properties || {};
  const upper = {};
  Object.keys(props).forEach((k) => {
    upper[k.toUpperCase()] = k;
  });
  const resolve = (cands) => {
    for (const c of cands) {
      const u = c.toUpperCase();
      if (upper[u]) return upper[u];
    }
    for (const c of cands) {
      const u = c.toUpperCase();
      const hit = Object.keys(upper).find((k) => k.includes(u));
      if (hit) return upper[hit];
    }
    return null;
  };
  const out = {};
  Object.entries(spec).forEach(([k, cands]) => {
    out[k] = resolve(cands);
  });
  return out;
}

function guessWindUnit(values) {
  let max = 0;
  values.forEach((v) => {
    if (v != null && v > max) max = v;
  });
  // > 200 → presque sûrement des km/h ; sinon des nœuds.
  return max > 200 ? "kmh" : "kt";
}

// --- Fusion des positions (fixes) dans les cyclones ----------------------
function mergePoints(cyclones, pointFeatures) {
  if (!pointFeatures.length) return { hasFixes: false, fields: null };
  const fields = detectFields(pointFeatures, PT_FIELDS);
  // eslint-disable-next-line no-console
  console.info("[cycloneApi] (points) champs détectés:", fields);

  // Index des cyclones par num_ref puis par nom+saison (repli).
  const byRef = new Map();
  const byNameSeason = new Map();
  cyclones.forEach((cy) => {
    if (cy.numRef) byRef.set(cy.numRef, cy);
    if (cy.name && cy.season) byNameSeason.set(`${cy.name}__${cy.season}`, cy);
  });

  // Estimation de l'unité de vent sur un échantillon.
  const windHint = guessWindUnit(
    fields.wind ? pointFeatures.slice(0, 4000).map((f) => finiteNum(f.properties?.[fields.wind])) : [],
  );

  const groups = new Map(); // cyclone.id → fixes[]
  pointFeatures.forEach((f) => {
    const p = f.properties || {};
    const g = f.geometry;
    let lng = null;
    let lat = null;
    if (g && g.type === "Point" && Array.isArray(g.coordinates)) {
      lng = finiteNum(g.coordinates[0]);
      lat = finiteNum(g.coordinates[1]);
    }
    if (lng == null || lat == null) {
      // Repli : certaines positions n'ont pas de géométrie mais portent
      // latitude/longitude dans les propriétés.
      lng = finiteNum(p.longitude);
      lat = finiteNum(p.latitude);
    }
    if (lng == null || lat == null) return;

    let cy = null;
    if (fields.joinRef && p[fields.joinRef] != null) cy = byRef.get(String(p[fields.joinRef]));
    if (!cy && fields.name && fields.season) {
      cy = byNameSeason.get(`${String(p[fields.name]).trim()}__${String(p[fields.season]).trim()}`);
    }
    if (!cy) return;

    const rawWind = fields.wind ? finiteNum(p[fields.wind]) : null;
    const windKt = rawWind == null ? null : windHint === "kmh" ? rawWind / KT_TO_KMH : rawWind;
    const pressure = fields.pressure ? finiteNum(p[fields.pressure]) : null;
    const t = fields.datetime ? toMillis(p[fields.datetime]) : null;
    const order = fields.order ? finiteNum(p[fields.order]) : null;
    const st = fields.stageText ? stageFromType(p[fields.stageText]) : null;

    const arr = groups.get(cy.id) || [];
    arr.push({
      lng,
      lat,
      t,
      order,
      wind: windKt == null ? null : Math.round(windKt),
      windKmh: windKt == null ? null : Math.round(windKt * KT_TO_KMH),
      pressure: pressure != null && pressure > 0 ? pressure : null,
      stage: st ? st.id : null,
      stageRank: st ? st.rank : null,
    });
    groups.set(cy.id, arr);
  });

  let withFixes = 0;
  cyclones.forEach((cy) => {
    const arr = groups.get(cy.id);
    if (!arr || arr.length < 2) return;
    // Tri : par date si dispo, sinon par champ d'ordre, sinon ordre d'insertion.
    const sorted = arr.every((p) => p.t != null)
      ? [...arr].sort((a, b) => a.t - b.t)
      : arr.every((p) => p.order != null)
        ? [...arr].sort((a, b) => a.order - b.order)
        : arr;
    // Stade par fix : libellé officiel si présent, sinon stade de pointe du
    // cyclone (on n'invente AUCUN seuil vent→stade).
    const peak = cy.stage || "DTFA";
    sorted.forEach((p) => {
      if (!p.stage) {
        p.stage = peak;
        p.stageRank = STAGE_BY_ID[peak] ? STAGE_BY_ID[peak].rank : 0;
      }
    });
    // Déroulement antiméridien : longitudes continues le long de la trajectoire.
    let prevLng = sorted[0].lng;
    for (let i = 1; i < sorted.length; i += 1) {
      let lng = sorted[i].lng;
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
      sorted[i].lng = lng;
      prevLng = lng;
    }
    cy.fixes = sorted;
    cy.hasFixes = true;
    withFixes += 1;
  });

  // eslint-disable-next-line no-console
  console.info(`[cycloneApi] (points) fixes rattachés à ${withFixes}/${cyclones.length} cyclones · unité vent: ${windHint}`);
  return { hasFixes: withFixes > 0, fields };
}

// --- Agrégats globaux ----------------------------------------------------
function summarize(cyclones) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  let wMin = Infinity, wMax = -Infinity, pMin = Infinity, pMax = -Infinity;
  const byStage = {};
  const seasonsSet = new Set();
  cyclones.forEach((cy) => {
    cy.path.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    });
    if (cy.maxWind != null) {
      if (cy.maxWind < wMin) wMin = cy.maxWind;
      if (cy.maxWind > wMax) wMax = cy.maxWind;
    }
    if (cy.minPressureHpa != null) {
      if (cy.minPressureHpa < pMin) pMin = cy.minPressureHpa;
      if (cy.minPressureHpa > pMax) pMax = cy.minPressureHpa;
    }
    if (cy.stage) byStage[cy.stage] = (byStage[cy.stage] || 0) + 1;
    if (cy.season) seasonsSet.add(cy.season);
  });
  const seasons = [...seasonsSet].sort();
  return {
    seasons,
    count: cyclones.length,
    byStage,
    bbox: minLng === Infinity ? null : [minLng, minLat, maxLng, maxLat],
    windRange: wMin === Infinity ? null : { min: wMin, max: wMax, unit: "kt" },
    pressureRange: pMin === Infinity ? null : { min: pMin, max: pMax, unit: "hPa" },
    firstSeason: seasons[0] || null,
    lastSeason: seasons[seasons.length - 1] || null,
  };
}

// --- Point d'entrée public ----------------------------------------------
export async function fetchCyclones({ signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const segs = await loadGeoJsonFrom(FILES, "trajectoires", ctrl.signal);
    if (!segs.features.length) {
      // eslint-disable-next-line no-console
      console.warn(
        "[cycloneApi] Aucun GeoJSON de trajectoires exploitable. Place " +
          "public/data/cyclones/Historique_des_trajectoires.geojson puis REDÉMARRE `npm start`.",
      );
      return emptyResult();
    }
    const cyclones = buildCyclones(segs.features);
    cyclones.sort((a, b) => {
      const ta = a.startTime ?? Infinity;
      const tb = b.startTime ?? Infinity;
      if (ta !== tb) return ta - tb;
      return (a.posSeason ?? 0) - (b.posSeason ?? 0);
    });

    // Couche points OPTIONNELLE.
    const pts = await loadGeoJsonFrom(POINT_FILES, "points", ctrl.signal);
    let hasFixes = false;
    if (pts.features.length) {
      const merged = mergePoints(cyclones, pts.features);
      hasFixes = merged.hasFixes;
    } else {
      // eslint-disable-next-line no-console
      console.info("[cycloneApi] (points) couche absente → repli stade de pointe (replay au fix désactivé).");
    }

    const sum = summarize(cyclones);
    // eslint-disable-next-line no-console
    console.info(
      "[cycloneApi] terminé —",
      sum.count,
      "cyclones ·",
      sum.seasons.length,
      "saisons (",
      sum.firstSeason,
      "→",
      sum.lastSeason,
      ") · fixes:",
      hasFixes ? "oui" : "non",
    );
    return { source: "live", via: segs.via, pointsVia: pts.via, stages: STAGES, hasFixes, cyclones, ...sum };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[cycloneApi] échec:", String(err));
    return { ...emptyResult(), error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

function emptyResult() {
  return {
    source: "unavailable",
    via: null,
    pointsVia: null,
    stages: STAGES,
    hasFixes: false,
    cyclones: [],
    seasons: [],
    count: 0,
    byStage: {},
    bbox: null,
    windRange: null,
    pressureRange: null,
    firstSeason: null,
    lastSeason: null,
  };
}