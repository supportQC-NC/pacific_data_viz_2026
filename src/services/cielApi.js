// src/services/cielApi.js
// ============================================================
// Acte 08 — « Le ciel se dérègle ». Trois indicateurs réels du PDH :
//   • Précipitations   : DF_CLIMATE_CHANGE, A.RAIN_ANOM.       (mm, anomalie vs 1991–2020 ; −sec / +humide)
//   • Température terre : DF_CLIMATE_CHANGE, A.<CODE>_ANOM.     (°C, anomalie vs 1971–2000 ; code sondé)
//   • Réseau météo      : DF_METEO_MONITOR_NET, A..             (nb de stations opérationnelles, cumul ; OMM/OSCAR)
//
// Le code exact de la température (terre) n'étant pas fourni, on SONDE plusieurs
// candidats `*_ANOM` au runtime : le 1er qui renvoie des données gagne, sinon
// l'indicateur est « indisponible » — aucune donnée n'est jamais inventée.
// Pour le réseau météo (dimension « type de station »), on reconstruit le TOTAL :
// si une ligne « total » existe on la prend, sinon on somme les types par géo-année.
//
// Format : csvfilewithlabels + AllDimensions ; libellés via Accept-Language.
// ============================================================

const DIRECT = "https://stats-sdmx-disseminate.pacificdata.org/rest/data";
const PROXY = "/pdh/rest/data";
const ENV_BASE = (typeof process !== "undefined" && process.env && process.env.REACT_APP_PDH_BASE) || "";

const BASES = [
  { base: DIRECT, tag: "direct" },
  { base: PROXY, tag: "proxy" },
];
if (ENV_BASE) BASES.unshift({ base: ENV_BASE, tag: "env" });

const FULL_START = 1850; // on remonte très tôt (la température démarre en 1850) ; l'API ne renvoie que les années présentes
const PROBE_START = 2015;
const TIMEOUT_MS = 35000;

const INDICATORS = {
  rain: {
    flow: "SPC,DF_CLIMATE_CHANGE,1.0",
    prefixes: ["A.RAIN_ANOM"],
    tailMin: 1,
    tailMax: 3,
    kind: "anomaly",
  },
  landTemp: {
    flow: "SPC,DF_CLIMATE_CHANGE,1.0",
    // code inconnu → on tente plusieurs variantes plausibles, dans l'ordre
    prefixes: [
      "A.SURF_TEMP_ANOM",
      "A.SURFACE_TEMP_ANOM",
      "A.LAND_TEMP_ANOM",
      "A.TEMP_ANOM",
      "A.TAS_ANOM",
      "A.AIR_TEMP_ANOM",
      "A.ST_ANOM",
      "A.LST_ANOM",
    ],
    tailMin: 1,
    tailMax: 3,
    kind: "anomaly",
  },
  meteo: {
    flow: "SPC,DF_METEO_MONITOR_NET,1.0",
    prefixes: ["A"],
    tailMin: 2,
    tailMax: 2,
    kind: "count",
    station: true,
  },
};

function keysFor(ind) {
  const out = [];
  for (const p of ind.prefixes) {
    for (let t = ind.tailMin; t <= ind.tailMax; t += 1) out.push(p + ".".repeat(t));
  }
  return out;
}

function buildUrl(base, flow, key, start) {
  const qs = new URLSearchParams({
    dimensionAtObservation: "AllDimensions",
    format: "csvfilewithlabels",
  });
  if (start) qs.set("startPeriod", String(start));
  return `${base}/${flow}/${key}?${qs.toString()}`;
}

function headersFor(lang) {
  return {
    Accept: "application/vnd.sdmx.data+csv, text/csv",
    "Accept-Language": lang === "fr" ? "fr" : "en",
  };
}

function num(s) {
  const cleaned = String(s == null ? "" : s).replace(/[^0-9.,-]/g, "");
  if (!cleaned) return NaN;
  const norm =
    cleaned.indexOf(",") > -1 && cleaned.indexOf(".") === -1 ? cleaned.replace(",", ".") : cleaned;
  return parseFloat(norm);
}

const TOTAL_RE = /^(_T|_Z|TOT|TOTAL|ALL|_O)$/i;

function parse(text, { station = false, quiet = false } = {}) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], header: lines[0] || "", unit: "" };
  const head = lines[0];
  const delim = head.split(";").length > head.split(",").length ? ";" : ",";
  const clean = (s) => (s == null ? "" : s).replace(/^"|"$/g, "").trim();
  const header = head.split(delim).map((h) => clean(h).toUpperCase());
  const idx = (...names) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iGeo = idx("GEO_PICT", "REF_AREA", "AREA");
  const iTime = idx("TIME_PERIOD", "TIME");
  const iVal = idx("OBS_VALUE", "VALUE");
  const iUnit = idx("UNIT_MEASURE", "UNIT");
  const iStype = station
    ? idx("WEATHER_STATION_TYPE", "STATION_TYPE", "WMO_STATION_TYPE", "TYPE_STATION", "STATION", "TYPE")
    : -1;
  if (!quiet) {
    // eslint-disable-next-line no-console
    console.info("[cielApi] colonnes:", header.join(" | "));
  }
  if (iVal < 0 || iTime < 0 || iGeo < 0) return { rows: [], header: head, unit: "" };
  const labelNext = (c, i) => (i >= 0 && i + 1 < c.length ? clean(c[i + 1]) : "");

  const rows = [];
  let unit = "";
  for (let i = 1; i < lines.length; i += 1) {
    const c = lines[i].split(delim);
    const value = num(clean(c[iVal]));
    const year = parseInt(clean(c[iTime]), 10);
    if (Number.isNaN(value) || Number.isNaN(year)) continue;
    const geo = (clean(c[iGeo]) || "").split(":")[0].trim();
    if (!geo) continue;
    if (!unit && iUnit >= 0) unit = labelNext(c, iUnit) || clean(c[iUnit]);
    const stype = iStype >= 0 ? (clean(c[iStype]) || "").split(":")[0].trim() : "";
    rows.push({ geo, year, value, stype });
  }
  return { rows, header: head, unit };
}

// anomalies : une valeur par géo-année (dernière connue)
function group(rows, unit) {
  const byArea = {};
  const yearsSet = new Set();
  let min = Infinity;
  let max = -Infinity;
  rows.forEach(({ geo, year, value }) => {
    const m = (byArea[geo] = byArea[geo] || new Map());
    m.set(year, value);
    yearsSet.add(year);
    if (value < min) min = value;
    if (value > max) max = value;
  });
  Object.keys(byArea).forEach((geo) => {
    byArea[geo] = [...byArea[geo].entries()]
      .map(([year, value]) => ({ year, value }))
      .sort((a, b) => a.year - b.year);
  });
  const years = [...yearsSet].sort((a, b) => a - b);
  return {
    byArea,
    years,
    areas: Object.keys(byArea),
    unit: unit || "",
    range: { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max },
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

// réseau météo : TOTAL par géo-année = ligne « total » si présente, sinon somme des types
function groupStation(rows, unit) {
  const acc = {};
  rows.forEach(({ geo, year, value, stype }) => {
    const g = (acc[geo] = acc[geo] || {});
    const cell = (g[year] = g[year] || { total: null, sum: 0 });
    if (TOTAL_RE.test(stype)) cell.total = value;
    else cell.sum += value;
  });
  const byArea = {};
  const yearsSet = new Set();
  let min = Infinity;
  let max = -Infinity;
  Object.entries(acc).forEach(([geo, years]) => {
    byArea[geo] = Object.entries(years)
      .map(([y, cell]) => {
        const v = cell.total != null ? cell.total : cell.sum;
        const year = parseInt(y, 10);
        yearsSet.add(year);
        if (v < min) min = v;
        if (v > max) max = v;
        return { year, value: v };
      })
      .sort((a, b) => a.year - b.year);
  });
  const years = [...yearsSet].sort((a, b) => a - b);
  return {
    byArea,
    years,
    areas: Object.keys(byArea),
    unit: unit || "",
    range: { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max },
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

async function fetchIndicator(name, ind, lang, signal) {
  const keys = keysFor(ind);
  const station = !!ind.station;
  for (const src of BASES) {
    for (const key of keys) {
      try {
        const res = await fetch(buildUrl(src.base, ind.flow, key, PROBE_START), {
          signal,
          headers: headersFor(lang),
        });
        // eslint-disable-next-line no-console
        console.info(`[cielApi] ${name} sonde`, src.tag, key, "→", res.status);
        if (!res.ok) continue;
        const probe = parse(await res.text(), { station, quiet: true });
        if (!probe.rows.length) continue;
        const full = await fetch(buildUrl(src.base, ind.flow, key, FULL_START), {
          signal,
          headers: headersFor(lang),
        });
        if (!full.ok) continue;
        const parsed = parse(await full.text(), { station });
        if (!parsed.rows.length) continue;
        const grouped = station ? groupStation(parsed.rows, parsed.unit) : group(parsed.rows, parsed.unit);
        // eslint-disable-next-line no-console
        console.info(
          `[cielApi] ${name} OK —`,
          grouped.areas.length,
          "territoires ·",
          `${grouped.firstYear}–${grouped.lastYear} ·`,
          parsed.rows.length,
          "obs ·",
          "unité:",
          grouped.unit,
          "· via",
          src.tag,
          "clé",
          key,
        );
        return { status: "live", via: src.tag, key, kind: ind.kind, ...grouped };
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[cielApi] ${name} indisponible (aucune source/clé n'a répondu).`);
  return {
    status: "unavailable",
    kind: ind.kind,
    byArea: {},
    years: [],
    areas: [],
    unit: "",
    range: { min: 0, max: 0 },
  };
}

export async function fetchCiel({ lang, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const [rain, landTemp, meteo] = await Promise.all([
      fetchIndicator("rain", INDICATORS.rain, lang, ctrl.signal),
      fetchIndicator("landTemp", INDICATORS.landTemp, lang, ctrl.signal),
      fetchIndicator("meteo", INDICATORS.meteo, lang, ctrl.signal),
    ]);
    const live = rain.status === "live" || landTemp.status === "live" || meteo.status === "live";
    // eslint-disable-next-line no-console
    console.info(
      "[cielApi] terminé — rain:",
      rain.status,
      "· landTemp:",
      landTemp.status,
      landTemp.status === "live" ? `(clé ${landTemp.key})` : "",
      "· meteo:",
      meteo.status,
    );
    return { source: live ? "live" : "unavailable", rain, landTemp, meteo };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[cielApi] échec:", String(err));
    return { source: "unavailable", rain: null, landTemp: null, meteo: null, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}