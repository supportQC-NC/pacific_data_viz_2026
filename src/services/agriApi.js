// src/services/agriApi.js
// ============================================================
// Production agricole (DF_AGRICULTURAL_PRODUCTION, PDH — source "SPC2").
//
// CE QUI MARCHE (vérifié sur l'API PDH) :
//   • Hôte public = stats-sdmx-disseminate (nsi-stable est INTERNE).
//   • Les flux de la source SPC2 répondent avec une CLÉ DIMENSIONNELLE
//     (jamais "all", qui est bloqué) + le format SDMX :
//        ?dimensionAtObservation=AllDimensions&format=csvfilewithlabels
//     (et NON ?format=csv&labels=both, qui renvoyait 403).
//
// STRATÉGIE :
//   • Appel DIRECT à disseminate d'abord (pas de proxy nécessaire si le
//     format ci-dessus suffit).
//   • Si le navigateur est tout de même bloqué (403 d'origine), on retente
//     via le proxy de dev /pdh (voir src/setupProxy.js).
//   • On sonde la bonne longueur de clé sur une fenêtre courte, puis on
//     charge l'historique complet.
//
// 100 % données API. Rien n'est inventé.
// ============================================================

const ENV_BASE = process.env.REACT_APP_PDH_BASE;
const FLOW = "SPC,DF_AGRICULTURAL_PRODUCTION,1.0";

// Sources tentées dans l'ordre : direct, puis proxy de dev en secours.
const SOURCES = [
  { base: "https://stats-sdmx-disseminate.pacificdata.org/rest/data", flow: FLOW, tag: "direct" },
  { base: "/pdh/rest/data", flow: FLOW, tag: "proxy" },
];
if (ENV_BASE) SOURCES.unshift({ base: ENV_BASE, flow: FLOW, tag: "env" });

// Clés dimensionnelles candidates (jamais "all"). On essaie plusieurs
// longueurs : FREQ épinglée à A, et tout-joker, car l'ordre/# de dimensions
// varie. La 1re qui renvoie des lignes gagne.
const KEY_CANDIDATES = [
  "A...", "A....", "A.....", "A......", "A.......",
  "....", ".....", "......", ".......",
];
const PROBE_START = 2018;
const TIMEOUT_MS = 30000;

function buildUrl(src, key, start, end) {
  const qs = new URLSearchParams({
    dimensionAtObservation: "AllDimensions",
    format: "csvfilewithlabels",
  });
  if (start) qs.set("startPeriod", String(start));
  if (end) qs.set("endPeriod", String(end));
  return `${src.base}/${src.flow}/${key}?${qs.toString()}`;
}

// Langue des libellés (PRODUIT AGRICOLE, unité…) négociée via Accept-Language.
function headersFor(lang) {
  return {
    Accept: "application/vnd.sdmx.data+csv, text/csv",
    "Accept-Language": lang === "fr" ? "fr" : "en",
  };
}

function parse(text, { quiet = false } = {}) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], header: lines[0] || "" };
  const head = lines[0];
  const delim = head.split(";").length > head.split(",").length ? ";" : ",";
  const decimalComma = delim === ";";
  const clean = (s) => (s == null ? "" : s).replace(/^"|"$/g, "").trim();
  const header = head.split(delim).map((h) => clean(h).toUpperCase());

  const findIdx = (...names) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const findBy = (...subs) => {
    for (let i = 0; i < header.length; i += 1)
      if (subs.some((s) => header[i].includes(s))) return i;
    return -1;
  };

  const iGeo = findIdx("GEO_PICT", "REF_AREA", "AREA");
  const iTime = findIdx("TIME_PERIOD", "TIME");
  const iVal = findIdx("OBS_VALUE", "VALUE");
  const iCommodity =
    findIdx("AGRICULTURE_PRODUCTION_ITEM") >= 0
      ? findIdx("AGRICULTURE_PRODUCTION_ITEM")
      : findBy("COMMODITY", "COMMOD", "ITEM", "CROP", "PRODUIT", "INDICATOR");
  const iUnit = findIdx("UNIT_MEASURE") >= 0 ? findIdx("UNIT_MEASURE") : findBy("UNIT");

  if (!quiet) {
    // eslint-disable-next-line no-console
    console.info("[agriApi] colonnes:", header.join(" | "));
  }
  if (iVal < 0 || iTime < 0 || iCommodity < 0) return { rows: [], header: head };

  const num = (s) => parseFloat(decimalComma ? String(s).replace(/\./g, "").replace(",", ".") : s);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const c = lines[i].split(delim);
    const value = num(clean(c[iVal]));
    const year = parseInt(clean(c[iTime]), 10);
    if (Number.isNaN(value) || Number.isNaN(year)) continue;
    const labelNext = (idx) => (idx >= 0 && idx + 1 < c.length ? clean(c[idx + 1]) : "");
    const comCode = clean(c[iCommodity]);
    const com = { code: comCode, label: labelNext(iCommodity) || comCode };
    const geo = (clean(c[iGeo]) || "PAC").split(":")[0].trim();
    const geoName = labelNext(iGeo) || geo;
    const unitCode = iUnit >= 0 ? clean(c[iUnit]) : "";
    const unit = { code: unitCode, label: iUnit >= 0 ? labelNext(iUnit) || unitCode : "" };
    rows.push({ geo, geoName, year, value, com, unit });
  }
  return { rows, header: head };
}

function group(rows) {
  const byCommodity = {};
  rows.forEach(({ geo, year, value, com, unit }) => {
    const key = com.code || com.label;
    if (!byCommodity[key]) {
      const u = `${unit.label} ${unit.code}`.toLowerCase();
      const kind = /hectare|\bha\b|kg\/ha/.test(u)
        ? "crop"
        : /animal|head|t[eê]te|carcass|\ban\b/.test(u)
          ? "livestock"
          : "crop";
      byCommodity[key] = {
        code: key, label: com.label || key, unit: unit.label || unit.code || "",
        kind, byArea: {}, _years: new Set(), min: Infinity, max: -Infinity,
      };
    }
    const d = byCommodity[key];
    (d.byArea[geo] = d.byArea[geo] || []).push({ year, value });
    d._years.add(year);
    if (value < d.min) d.min = value;
    if (value > d.max) d.max = value;
  });

  Object.values(byCommodity).forEach((d) => {
    Object.keys(d.byArea).forEach((geo) => {
      const m = new Map();
      d.byArea[geo].forEach((p) => m.set(p.year, p.value));
      d.byArea[geo] = [...m.entries()].map(([year, value]) => ({ year, value })).sort((a, b) => a.year - b.year);
    });
    const ys = [...d._years].sort((a, b) => a - b);
    d.years = ys;
    d.areas = Object.keys(d.byArea);
    d.firstYear = ys[0] ?? null;
    d.lastYear = ys[ys.length - 1] ?? null;
    d.range = { min: d.min === Infinity ? 0 : d.min, max: d.max === -Infinity ? 0 : d.max };
    delete d._years; delete d.min; delete d.max;
  });

  const commodities = Object.values(byCommodity)
    .map((d) => ({ code: d.code, label: d.label, unit: d.unit, kind: d.kind }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { commodities, byCommodity };
}

// Sonde : 1er couple (source, clé) qui renvoie des lignes (fenêtre courte).
async function probe(signal, lang) {
  for (const src of SOURCES) {
    for (const key of KEY_CANDIDATES) {
      try {
        const res = await fetch(buildUrl(src, key, PROBE_START), {
          signal,
          headers: headersFor(lang),
        });
        // eslint-disable-next-line no-console
        console.info("[agriApi] sonde", src.tag, key, "→", res.status);
        if (!res.ok) continue;
        const text = await res.text();
        const { rows } = parse(text, { quiet: true });
        if (rows.length) {
          // eslint-disable-next-line no-console
          console.info("[agriApi] OK sonde →", src.tag, "| clé", key);
          return { src, key };
        }
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
      }
    }
  }
  return null;
}

export async function fetchAgriProduction({ start = 1990, signal, lang } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const found = await probe(ctrl.signal, lang);
    if (!found) {
      // eslint-disable-next-line no-console
      console.warn("[agriApi] aucune source n'a répondu (voir sondes ci-dessus).");
      return { source: "unavailable", commodities: [], byCommodity: {} };
    }
    const { src, key } = found;
    const url = buildUrl(src, key, start);
    // eslint-disable-next-line no-console
    console.info("[agriApi] chargement complet:", src.tag, url);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: headersFor(lang),
    });
    if (!res.ok) throw new Error(`PDH ${res.status}`);
    const text = await res.text();
    const { rows, header } = parse(text);
    if (!rows.length) {
      // eslint-disable-next-line no-console
      console.warn("[agriApi] 0 ligne. En-tête:", header);
      return { source: "unavailable", commodities: [], byCommodity: {} };
    }
    const grouped = group(rows);
    // eslint-disable-next-line no-console
    console.info(
      "[agriApi] OK —", grouped.commodities.length, "produits ·",
      grouped.commodities.filter((c) => c.kind === "crop").length, "cultures ·",
      rows.length, "obs · via", src.tag, "clé", key,
    );
    return { source: "live", via: src.tag, key, ...grouped };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[agriApi] échec:", String(err));
    return { source: "unavailable", commodities: [], byCommodity: {}, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}