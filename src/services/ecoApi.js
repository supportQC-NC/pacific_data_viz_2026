// src/services/ecoApi.js
// ============================================================
// Acte 09 — « L'économie exposée ». Trois indicateurs réels du PDH :
//   • Tourisme    : DF_CLIMATE_CHANGE, A.TRSM_ARR.   (effectifs d'arrivées ; ONU Tourisme)
//   • Électricité : DF_CLIMATE_CHANGE, A.POWER_GEN.  (GWh ; FMI/IRENA)
//   • Fiscalité   : DF_ENV_TAXES,      A..           (% du PIB ; FMI/OCDE, désagrégé par type)
//
// Particularités :
//   – Nombres formatés FR (point = millier, virgule = décimale) → parseur locale-aware.
//   – Fiscalité : dimension « type de taxe ». On reconstruit le TOTAL %PIB par
//     géo-année (ligne « total » si présente, sinon somme des types), et on ne
//     garde que les observations en pourcentage du PIB.
// 100 % données API. Aucune valeur inventée. Zéro style inline.
// ============================================================

const DIRECT = "https://stats-sdmx-disseminate.pacificdata.org/rest/data";
const PROXY = "/pdh/rest/data";
const ENV_BASE = (typeof process !== "undefined" && process.env && process.env.REACT_APP_PDH_BASE) || "";

const BASES = [
  { base: DIRECT, tag: "direct" },
  { base: PROXY, tag: "proxy" },
];
if (ENV_BASE) BASES.unshift({ base: ENV_BASE, tag: "env" });

const FULL_START = 1990;
const PROBE_START = 2015;
const TIMEOUT_MS = 35000;

const INDICATORS = {
  tourism: {
    flow: "SPC,DF_CLIMATE_CHANGE,1.0",
    prefixes: ["A.TRSM_ARR"],
    tailMin: 1,
    tailMax: 3,
    kind: "count",
  },
  power: {
    flow: "SPC,DF_CLIMATE_CHANGE,1.0",
    prefixes: ["A.POWER_GEN"],
    tailMin: 1,
    tailMax: 3,
    kind: "level",
  },
  envTax: {
    flow: "SPC,DF_ENV_TAXES,1.0",
    prefixes: ["A"],
    tailMin: 2,
    tailMax: 3,
    kind: "percent",
    cat: true, // dimension « type de taxe » → on agrège en total
    pctOnly: true, // on ne garde que le % du PIB
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

// parseur locale-aware : FR → point = millier, virgule = décimale ; EN → virgule = millier, point = décimale
function makeNum(lang) {
  return function num(s) {
    let c = String(s == null ? "" : s).replace(/[^0-9.,-]/g, "");
    if (!c || c === "-") return NaN;
    if (lang === "fr") c = c.replace(/\./g, "").replace(/,/g, ".");
    else c = c.replace(/,/g, "");
    const v = parseFloat(c);
    return Number.isFinite(v) ? v : NaN;
  };
}

const TOTAL_RE = /^(_T|_Z|TOT|TOTAL|ALL|_O|ENV)$/i;
const PCT_RE = /(POURCENT|PERCENT|PIB|GDP|%)/i;

function parse(text, { lang = "fr", cat = false, pctOnly = false, quiet = false } = {}) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], header: lines[0] || "", unit: "" };
  const num = makeNum(lang);
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
  const idxLike = (re) => header.findIndex((h) => re.test(h));
  const iGeo = idx("GEO_PICT", "REF_AREA", "AREA");
  const iTime = idx("TIME_PERIOD", "TIME");
  const iVal = idx("OBS_VALUE", "VALUE");
  const iUnit = idx("UNIT_MEASURE", "UNIT");
  const iCat = cat ? idxLike(/(ENV_TAX|TAX|TYPE|TECH)/) : -1;
  if (!quiet) {
    // eslint-disable-next-line no-console
    console.info("[ecoApi] colonnes:", header.join(" | "));
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
    const uLabel = iUnit >= 0 ? `${clean(c[iUnit])} ${labelNext(c, iUnit)}` : "";
    if (pctOnly && uLabel && !PCT_RE.test(uLabel)) continue; // on jette tout ce qui n'est pas un %
    if (!unit && iUnit >= 0) unit = labelNext(c, iUnit) || clean(c[iUnit]);
    const catCode = iCat >= 0 ? (clean(c[iCat]) || "").split(":")[0].trim() : "";
    rows.push({ geo, year, value, cat: catCode });
  }
  return { rows, header: head, unit };
}

// une valeur par géo-année (dernière connue)
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

// total par géo-année : ligne « total » si présente, sinon somme des catégories (types de taxe)
function groupSum(rows, unit) {
  const acc = {};
  rows.forEach(({ geo, year, value, cat }) => {
    const g = (acc[geo] = acc[geo] || {});
    const cell = (g[year] = g[year] || { total: null, sum: 0 });
    if (TOTAL_RE.test(cat)) cell.total = value;
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
  const popts = { lang, cat: !!ind.cat, pctOnly: !!ind.pctOnly };
  for (const src of BASES) {
    for (const key of keys) {
      try {
        const res = await fetch(buildUrl(src.base, ind.flow, key, PROBE_START), {
          signal,
          headers: headersFor(lang),
        });
        // eslint-disable-next-line no-console
        console.info(`[ecoApi] ${name} sonde`, src.tag, key, "→", res.status);
        if (!res.ok) continue;
        const probe = parse(await res.text(), { ...popts, quiet: true });
        if (!probe.rows.length) continue;
        const full = await fetch(buildUrl(src.base, ind.flow, key, FULL_START), {
          signal,
          headers: headersFor(lang),
        });
        if (!full.ok) continue;
        const parsed = parse(await full.text(), popts);
        if (!parsed.rows.length) continue;
        const grouped = ind.cat ? groupSum(parsed.rows, parsed.unit) : group(parsed.rows, parsed.unit);
        // eslint-disable-next-line no-console
        console.info(
          `[ecoApi] ${name} OK —`,
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
  console.warn(`[ecoApi] ${name} indisponible (aucune source/clé n'a répondu).`);
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

export async function fetchEco({ lang, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const [tourism, power, envTax] = await Promise.all([
      fetchIndicator("tourism", INDICATORS.tourism, lang, ctrl.signal),
      fetchIndicator("power", INDICATORS.power, lang, ctrl.signal),
      fetchIndicator("envTax", INDICATORS.envTax, lang, ctrl.signal),
    ]);
    const live = tourism.status === "live" || power.status === "live" || envTax.status === "live";
    // eslint-disable-next-line no-console
    console.info(
      "[ecoApi] terminé — tourism:",
      tourism.status,
      "· power:",
      power.status,
      "· envTax:",
      envTax.status,
    );
    return { source: live ? "live" : "unavailable", tourism, power, envTax };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ecoApi] échec:", String(err));
    return { source: "unavailable", tourism: null, power: null, envTax: null, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}