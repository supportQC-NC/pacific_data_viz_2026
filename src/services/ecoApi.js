// src/services/ecoApi.js
// ============================================================
// Acte 09 — « L'économie exposée ». Deux jeux officiels du PDH,
// exploités à fond (total + ventilation par catégorie) :
//
//   • Tourisme  : DF_CLIMATE_CHANGE, A.TRSM_ARR.  (effectifs d'arrivées ; ONU Tourisme, CC-BY)
//                 → ventilé par niveau de visiteur : total / touristes / excursionnistes.
//   • Fiscalité : DF_ENV_TAXES, A..               (% du PIB ; FMI ↠ OCDE)
//                 → ventilé par type de taxe : énergie / transport / pollution / ressources (+ total).
//
// (DF_CLIMATE_CHANGE / POWER_GEN reste défini mais n'est plus exposé dans l'acte.)
//
// Principes :
//   – Nombres formatés FR (point = millier, virgule = décimale) → parseur locale-aware.
//   – On NE code PAS en dur les codes SDMX de catégorie (inconnus selon les
//     versions) : chaque catégorie est CLASSÉE par regex sur son libellé
//     (FR + EN), comme powerApi le fait pour renew/fossil. Robuste aux codes.
//   – Fiscalité : on ne garde que les observations en % du PIB. Le TOTAL est la
//     ligne « total » si présente, sinon la somme des types documentés.
//   – Chaque indicateur renvoie le TOTAL (compat. onglets existants) ET un
//     objet `breakdown.byCat` ventilé par catégorie (nouvel usage).
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
    cat: true, // dimension « niveau de visiteur » : total / touristes / excursionnistes
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
    cat: true, // dimension « type de taxe » → énergie / transport / pollution / ressources
    pctOnly: true, // on ne garde que le % du PIB
  },
};

// ---- Classification des catégories par libellé (robuste aux codes SDMX) ----
// Fiscalité environnementale : 4 types + total.
const TAX_CATS = [
  { id: "energy", re: /(energ|énerg)/i },
  { id: "transport", re: /(transport|véhic|vehic|carburant|fuel)/i },
  { id: "pollution", re: /(pollut|émiss|emiss|déchet|dechet|waste)/i },
  { id: "resource", re: /(ressource|resource|extract|minér|miner|water)/i },
];
// Tourisme : niveaux de visiteur.
const TRSM_CATS = [
  { id: "tourist", re: /(touriste|tourist|nuit|overnight|stay)/i },
  { id: "excursionist", re: /(excursion|journ|day[- ]?(trip|visit)|same[- ]?day)/i },
];

// Total / agrégat (toutes catégories confondues).
const TOTAL_RE = /^(_T|_Z|TOT|TOTAL|ALL|_O|ENV)$/i;
const TOTAL_LABEL_RE = /(total|tous|toutes|ensemble|all|overall|visiteurs?|visitors?|inbound)/i;
const PCT_RE = /(POURCENT|PERCENT|PIB|GDP|%)/i;

// classe une catégorie (code + libellé) → id normalisé ou "total" ou null
function classifyCat(kind, code, label) {
  const c = String(code || "");
  const l = String(label || "");
  if (TOTAL_RE.test(c)) return "total";
  const table = kind === "tax" ? TAX_CATS : TRSM_CATS;
  for (const cat of table) {
    if (cat.re.test(l) || cat.re.test(c)) return cat.id;
  }
  // Libellé d'agrégat (total/visiteurs/inbound…) non capté par un type précis.
  if (TOTAL_LABEL_RE.test(l)) return "total";
  return null;
}

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

// parseur UNIVERSEL : auto-détecte point/virgule, milliers vs décimale.
function num(s) {
  let c = String(s == null ? "" : s).replace(/[^0-9.,-]/g, "");
  if (!c || c === "-") return NaN;
  const neg = c[0] === "-";
  c = c.replace(/-/g, "");
  const hasComma = c.includes(",");
  const hasDot = c.includes(".");
  if (hasComma && hasDot) {
    const dec = c.lastIndexOf(",") > c.lastIndexOf(".") ? "," : ".";
    const thou = dec === "," ? "." : ",";
    c = c.split(thou).join("").replace(dec, ".");
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const parts = c.split(sep);
    if (parts.length > 2) c = parts.join(""); // séparateurs multiples = milliers
    else if (parts[1].length === 3) c = parts.join(""); // 3 chiffres = millier
    else c = `${parts[0]}.${parts[1]}`; // 1, 2 ou 4+ chiffres = décimale
  }
  const v = parseFloat(c);
  if (!Number.isFinite(v)) return NaN;
  return neg ? -v : v;
}

function parse(text, { cat = false, pctOnly = false, quiet = false } = {}) {
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
  const idxLike = (re) => header.findIndex((h) => re.test(h));
  const iGeo = idx("GEO_PICT", "REF_AREA", "AREA");
  const iTime = idx("TIME_PERIOD", "TIME");
  const iVal = idx("OBS_VALUE", "VALUE");
  const iUnit = idx("UNIT_MEASURE", "UNIT");
  // Dimension catégorie : type de taxe OU niveau de visiteur OU indicateur tourisme.
  const iCat = cat ? idxLike(/(ENV_TAX|TAX|TYPE|TECH|INDICATOR|TRSM|VISITOR|TOURISM|MEASURE)/) : -1;
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
    const catLabel = iCat >= 0 ? labelNext(c, iCat) : "";
    rows.push({ geo, year, value, cat: catCode, catLabel });
  }
  return { rows, header: head, unit };
}

// ---------------------------------------------------------------------------
// Agrégateurs
// ---------------------------------------------------------------------------

// met en forme un dictionnaire géo → Map(année→valeur).
function shapeByArea(byAreaMap) {
  const byArea = {};
  const yearsSet = new Set();
  let min = Infinity;
  let max = -Infinity;
  Object.entries(byAreaMap).forEach(([geo, m]) => {
    byArea[geo] = [...m.entries()]
      .map(([year, value]) => {
        yearsSet.add(year);
        if (value < min) min = value;
        if (value > max) max = value;
        return { year, value };
      })
      .sort((a, b) => a.year - b.year);
  });
  const years = [...yearsSet].sort((a, b) => a - b);
  return {
    byArea,
    years,
    areas: Object.keys(byArea),
    range: { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max },
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

// total simple (jeu sans catégorie) : une valeur par géo-année.
function group(rows, unit) {
  const byAreaMap = {};
  rows.forEach(({ geo, year, value }) => {
    const m = (byAreaMap[geo] = byAreaMap[geo] || new Map());
    m.set(year, value);
  });
  return { ...shapeByArea(byAreaMap), unit: unit || "" };
}

// jeu AVEC catégorie : reconstruit le TOTAL par géo-année (ligne « total » si
// présente, sinon somme des catégories non-total) ET conserve la ventilation.
function groupCat(rows, unit, kind) {
  const acc = {}; // total : geo → year → { total, sum, seen }
  const byCatMap = {}; // ventilation : id → geo → Map(year→value)
  const catLabels = {}; // id → libellé lisible

  rows.forEach(({ geo, year, value, cat, catLabel }) => {
    const id = classifyCat(kind, cat, catLabel);

    // --- total ---
    const g = (acc[geo] = acc[geo] || {});
    const cell = (g[year] = g[year] || { total: null, sum: 0, seen: 0, raw: null });
    if (id === "total") cell.total = value;
    else if (id) {
      cell.sum += value;
      cell.seen += 1;
    } else {
      // Aucune catégorie reconnue (colonne catégorie absente, ou une seule
      // série non étiquetée) : on garde la valeur brute comme repli pour le total.
      cell.raw = cell.raw == null ? value : cell.raw + value;
    }

    // --- ventilation (on ignore le pseudo-total) ---
    if (id && id !== "total" && Number.isFinite(value) && value > 0) {
      if (!catLabels[id]) catLabels[id] = catLabel || cat || id;
      const cmap = (byCatMap[id] = byCatMap[id] || {});
      const m = (cmap[geo] = cmap[geo] || new Map());
      m.set(year, (m.get(year) || 0) + value);
    }
  });

  // total : valeur "total" si présente, sinon somme des catégories.
  // On NE retient PAS les zéros : dans un jeu très lacunaire (fiscalité), une
  // valeur 0,00 traduit le plus souvent une non-déclaration, pas un vrai zéro.
  const totalMap = {};
  Object.entries(acc).forEach(([geo, years]) => {
    const m = (totalMap[geo] = new Map());
    Object.entries(years).forEach(([y, cell]) => {
      const v =
        cell.total != null
          ? cell.total
          : cell.seen > 0
            ? cell.sum
            : cell.raw != null
              ? cell.raw
              : null;
      if (v != null && v > 0) m.set(parseInt(y, 10), v);
    });
  });

  const base = { ...shapeByArea(totalMap), unit: unit || "" };

  const byCat = {};
  Object.entries(byCatMap).forEach(([id, geoMap]) => {
    byCat[id] = { ...shapeByArea(geoMap), unit: unit || "", label: catLabels[id] || id };
  });

  base.breakdown = { byCat, cats: Object.keys(byCat), unit: unit || "", labels: catLabels };
  // eslint-disable-next-line no-console
  console.info(
    `[ecoApi] groupCat(${kind}) — total: ${base.areas.length} territoires · cats:`,
    Object.entries(catLabels).map(([id, l]) => `${id}="${l}"`).join(" · ") || "(aucune)",
  );
  return base;
}

async function fetchIndicator(name, ind, lang, signal) {
  const keys = keysFor(ind);
  const popts = { cat: !!ind.cat, pctOnly: !!ind.pctOnly };
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
        const kindCat = name === "envTax" ? "tax" : name === "tourism" ? "trsm" : null;
        const grouped = ind.cat
          ? groupCat(parsed.rows, parsed.unit, kindCat)
          : group(parsed.rows, parsed.unit);
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
          grouped.breakdown ? `· cat: ${grouped.breakdown.cats.join("/")}` : "",
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
    breakdown: { byCat: {}, cats: [], unit: "" },
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