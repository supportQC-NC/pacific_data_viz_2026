// src/services/vivantApi.js
// ============================================================
// Acte 07 — « Le vivant ». Deux indicateurs réels du PDH, joints par
// GEO_PICT :
//   • Liste Rouge (extinction)  : DF_SDG_15, clé A.ER_RSK_LST......... (indice 0–1, 1993→)
//   • Gestion des pêches        : DF_CLIMATE_CHANGE, clé A.FISH_MNGT_MULT_BILAT_ARGMT. (unités, cumul)
//
// Même mécanique éprouvée que agriApi : hôte disseminate en direct,
// format=csvfilewithlabels&dimensionAtObservation=AllDimensions, clé
// dimensionnelle (jamais "all"), Accept-Language pour les libellés,
// proxy /pdh en secours. 100 % données API. Logs verbeux [vivantApi].
// ============================================================

const ENV_BASE = process.env.REACT_APP_PDH_BASE;

const BASES = [
  { base: "https://stats-sdmx-disseminate.pacificdata.org/rest/data", tag: "direct" },
  { base: "/pdh/rest/data", tag: "proxy" },
];
if (ENV_BASE) BASES.unshift({ base: ENV_BASE, tag: "env" });

const INDICATORS = {
  redList: {
    flow: "SPC,DF_SDG_15,3.0",
    prefix: "A.ER_RSK_LST",
    tailMin: 8,
    tailMax: 11,
    start: 1993,
  },
  fishMgmt: {
    flow: "SPC,DF_CLIMATE_CHANGE,1.0",
    prefix: "A.FISH_MNGT_MULT_BILAT_ARGMT",
    tailMin: 1,
    tailMax: 3,
    start: 1980,
  },
};

const PROBE_START = 2015;
const TIMEOUT_MS = 30000;

function keysFor(ind) {
  const out = [];
  for (let t = ind.tailMin; t <= ind.tailMax; t += 1) out.push(ind.prefix + ".".repeat(t));
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
  // décimale virgule ou point
  const norm = cleaned.indexOf(",") > -1 && cleaned.indexOf(".") === -1
    ? cleaned.replace(",", ".")
    : cleaned;
  return parseFloat(norm);
}

function parse(text, { quiet = false } = {}) {
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
  if (!quiet) {
    // eslint-disable-next-line no-console
    console.info("[vivantApi] colonnes:", header.join(" | "));
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
    rows.push({ geo, year, value });
  }
  return { rows, header: head, unit };
}

function group(rows, unit) {
  const byArea = {};
  const yearsSet = new Set();
  let min = Infinity;
  let max = -Infinity;
  rows.forEach(({ geo, year, value }) => {
    const m = (byArea[geo] = byArea[geo] || new Map());
    m.set(year, value); // dernière valeur par géo-année
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

async function fetchIndicator(name, ind, lang, signal) {
  const keys = keysFor(ind);
  // 1) sonde : 1er (base, clé) qui renvoie des lignes sur une fenêtre courte
  for (const src of BASES) {
    for (const key of keys) {
      try {
        const res = await fetch(buildUrl(src.base, ind.flow, key, PROBE_START), {
          signal,
          headers: headersFor(lang),
        });
        // eslint-disable-next-line no-console
        console.info(`[vivantApi] ${name} sonde`, src.tag, key, "→", res.status);
        if (!res.ok) continue;
        const text = await res.text();
        const probe = parse(text, { quiet: true });
        if (!probe.rows.length) continue;
        // 2) chargement complet depuis le début
        const full = await fetch(buildUrl(src.base, ind.flow, key, ind.start), {
          signal,
          headers: headersFor(lang),
        });
        if (!full.ok) continue;
        const parsed = parse(await full.text());
        if (!parsed.rows.length) continue;
        const grouped = group(parsed.rows, parsed.unit);
        // eslint-disable-next-line no-console
        console.info(
          `[vivantApi] ${name} OK —`, grouped.areas.length, "territoires ·",
          `${grouped.firstYear}–${grouped.lastYear} ·`, parsed.rows.length, "obs ·",
          "unité:", grouped.unit, "· via", src.tag, "clé", key,
        );
        return { status: "live", via: src.tag, key, ...grouped };
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[vivantApi] ${name} indisponible (aucune source/clé n'a répondu).`);
  return { status: "unavailable", byArea: {}, years: [], areas: [], unit: "", range: { min: 0, max: 0 } };
}

export async function fetchVivant({ lang, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const [redList, fishMgmt] = await Promise.all([
      fetchIndicator("redList", INDICATORS.redList, lang, ctrl.signal),
      fetchIndicator("fishMgmt", INDICATORS.fishMgmt, lang, ctrl.signal),
    ]);
    const live = redList.status === "live" || fishMgmt.status === "live";
    // eslint-disable-next-line no-console
    console.info("[vivantApi] terminé — redList:", redList.status, "· fishMgmt:", fishMgmt.status);
    return { source: live ? "live" : "unavailable", redList, fishMgmt };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[vivantApi] échec:", String(err));
    return { source: "unavailable", redList: null, fishMgmt: null, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}