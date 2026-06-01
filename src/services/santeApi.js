// src/services/santeApi.js
// ============================================================
// Acte 10 — « Le corps et l'eau ». Deux indicateurs réels du PDH :
//   • Eau potable : DF_SDG_06, A.SH_H2O_SAFE...._T.....  (% population ; OMS/UNICEF JMP)
//   • Tuberculose : DF_SDG_03, A.SH_TBS_INCD.........    (cas / 100 000 hab. ; OMS)
//
// Sens de lecture (géré côté page) :
//   – Eau : plus c'est HAUT, mieux c'est (vers 100 %).
//   – Tuberculose : plus c'est BAS, mieux c'est (le recul = progrès).
//
// Clés SDMX multidimensionnelles laissées EXACTES (le _T de l'eau = total
// lieu de résidence ; sans lui on récupérerait urbain/rural séparément).
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
  water: {
    flow: "SPC,DF_SDG_06,3.0",
    keys: ["A.SH_H2O_SAFE...._T.....", "A.SH_H2O_SAFE.........", "A.SH_H2O_SAFE........"],
    kind: "percent",
    good: "up", // plus c'est haut, mieux c'est
  },
  tb: {
    flow: "SPC,DF_SDG_03,3.0",
    keys: ["A.SH_TBS_INCD.........", "A.SH_TBS_INCD..........", "A.SH_TBS_INCD........"],
    kind: "rate",
    good: "down", // plus c'est bas, mieux c'est
  },
};

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

// parseur locale-aware : FR → point = millier, virgule = décimale ; EN → l'inverse
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

function parse(text, { lang = "fr", quiet = false } = {}) {
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
  const iGeo = idx("GEO_PICT", "REF_AREA", "AREA");
  const iTime = idx("TIME_PERIOD", "TIME");
  const iVal = idx("OBS_VALUE", "VALUE");
  const iUnit = idx("UNIT_MEASURE", "UNIT");
  if (!quiet) {
    // eslint-disable-next-line no-console
    console.info("[santeApi] colonnes:", header.join(" | "));
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

async function fetchIndicator(name, ind, lang, signal) {
  for (const src of BASES) {
    for (const key of ind.keys) {
      try {
        const res = await fetch(buildUrl(src.base, ind.flow, key, PROBE_START), {
          signal,
          headers: headersFor(lang),
        });
        // eslint-disable-next-line no-console
        console.info(`[santeApi] ${name} sonde`, src.tag, key, "→", res.status);
        if (!res.ok) continue;
        const probe = parse(await res.text(), { lang, quiet: true });
        if (!probe.rows.length) continue;
        const full = await fetch(buildUrl(src.base, ind.flow, key, FULL_START), {
          signal,
          headers: headersFor(lang),
        });
        if (!full.ok) continue;
        const parsed = parse(await full.text(), { lang });
        if (!parsed.rows.length) continue;
        const grouped = group(parsed.rows, parsed.unit);
        // eslint-disable-next-line no-console
        console.info(
          `[santeApi] ${name} OK —`,
          grouped.areas.length,
          "territoires ·",
          `${grouped.firstYear}–${grouped.lastYear} ·`,
          parsed.rows.length,
          "obs · unité:",
          grouped.unit,
          "· via",
          src.tag,
          "clé",
          key,
        );
        return { status: "live", via: src.tag, key, kind: ind.kind, good: ind.good, ...grouped };
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
      }
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[santeApi] ${name} indisponible (aucune source/clé n'a répondu).`);
  return {
    status: "unavailable",
    kind: ind.kind,
    good: ind.good,
    byArea: {},
    years: [],
    areas: [],
    unit: "",
    range: { min: 0, max: 0 },
  };
}

export async function fetchSante({ lang, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const [water, tb] = await Promise.all([
      fetchIndicator("water", INDICATORS.water, lang, ctrl.signal),
      fetchIndicator("tb", INDICATORS.tb, lang, ctrl.signal),
    ]);
    const live = water.status === "live" || tb.status === "live";
    // eslint-disable-next-line no-console
    console.info("[santeApi] terminé — water:", water.status, "· tb:", tb.status);
    return { source: live ? "live" : "unavailable", water, tb };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[santeApi] échec:", String(err));
    return { source: "unavailable", water: null, tb: null, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}