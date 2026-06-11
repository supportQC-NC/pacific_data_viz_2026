// src/services/syntheseApi.js
// ============================================================
// Acte 11 — « La Synthèse ». Croise les jeux de données déjà utilisés,
// joints par GEO_PICT, pour confronter RESPONSABILITÉ et VULNÉRABILITÉ.
//
// Indicateurs (tous réels, codes déjà confirmés dans les actes précédents ;
// la Liste Rouge est sondée car le nombre de dimensions varie) :
//   • emissions : GES par habitant            (DF_CLIMATE_CHANGE, GHG_EMI_CAPITA) — responsabilité
//   • seaLevel  : niveau de la mer            (DF_CLIMATE_CHANGE, SEA_LVL)        — exposition (+)
//   • sst       : anomalie temp. de la mer    (DF_CLIMATE_CHANGE, SST_ANOM)       — exposition (+)
//   • rain      : anomalie des précipitations (DF_CLIMATE_CHANGE, RAIN_ANOM)      — exposition (|écart|)
//   • water     : eau potable sûre            (DF_SDG_06)                         — capacité (− : bas = pire)
//   • tb        : tuberculose /100 000        (DF_SDG_03)                         — santé (+)
//   • rli       : indice Liste Rouge          (DF_SDG_15, ER_RSK_LST)             — vivant (− : bas = pire)
//
// La normalisation et l'indice composite sont calculés dans la page (transparence).
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

const FULL_START = 1970;
const PROBE_START = 2005;
const TIMEOUT_MS = 45000;
// L'agri (cultures/bétail) est volumineux et optionnel : timeout court et
// isolé pour ne jamais retarder ni faire échouer la synthèse principale.
const AGRI_TIMEOUT_MS = 15000;

const CC = "SPC,DF_CLIMATE_CHANGE,1.0";

function ccKeys(code) {
  return [`A.${code}.`, `A.${code}..`, `A.${code}...`];
}

// rôle : "resp" (responsabilité, axe X) ou "vuln" (entre dans l'indice).
// good : sens favorable ; pour la vulnérabilité, dir = "up" (haut = pire) ou "down" (bas = pire) ou "abs".
const INDICATORS = {
  emissions: { flows: [CC], keys: ccKeys("GHG_EMI_CAPITA"), role: "resp" },
  seaLevel: { flows: [CC], keys: ccKeys("SEA_LVL"), role: "vuln", dir: "up" },
  sst: { flows: [CC], keys: ccKeys("SST_ANOM"), role: "vuln", dir: "up" },
  rain: { flows: [CC], keys: ccKeys("RAIN_ANOM"), role: "vuln", dir: "abs" },
  water: {
    flows: ["SPC,DF_SDG_06,3.0", "SPC,DF_SDG_06,1.0"],
    keys: ["A.SH_H2O_SAFE...._T.....", "A.SH_H2O_SAFE.........", "A.SH_H2O_SAFE........"],
    role: "vuln",
    dir: "down",
  },
  tb: {
    flows: ["SPC,DF_SDG_03,3.0", "SPC,DF_SDG_03,1.0"],
    keys: ["A.SH_TBS_INCD.........", "A.SH_TBS_INCD..........", "A.SH_TBS_INCD........"],
    role: "vuln",
    dir: "up",
  },
  rli: {
    flows: ["SPC,DF_SDG_15,3.0", "SPC,DF_SDG_15,1.0", "SPC,DF_SDG_15,2.0"],
    keys: ["A.ER_RSK_LST", "A.ER_RSK_LST.", "A.ER_RSK_LST..", "A.ER_RSK_LST.....", "A.ER_RSK_LST........", "A.ER_RSK_LST........."],
    role: "vuln",
    dir: "down",
  },
  // --- Indicateurs de CONTEXTE (récap des autres actes) ---
  // Ils ne nourrissent PAS l'indice de vulnérabilité : ce ne sont pas des
  // stress comparables, mais des éclairages (énergie, fiscalité, tourisme).
  // role:"context" => affichés dans des slides récap, jamais dans le composite.
  renew: {
    flows: ["SPC,DF_SDG,3.0", "SPC,DF_SDG,2.0", "SPC,DF_SDG,1.0"],
    keys: [
      "A.EG_FEC_RNEW.._T._T._T._T._T._T._Z._T",
      "A.EG_FEC_RNEW.._T._T._T._T._T._T._Z",
      "A.EG_FEC_RNEW..",
      "A.EG_FEC_RNEW.",
    ],
    role: "context",
    dir: "up",
  },
  envtax: {
    flows: ["SPC,DF_ENV_TAXES,1.0"],
    keys: ["A.", "A..", "A..."],
    role: "context",
    dir: "up",
  },
  tourism: {
    flows: ["SPC,DF_CLIMATE_CHANGE,1.0"],
    keys: ["A.TRSM_ARR.", "A.TRSM_ARR..", "A.TRSM_ARR..."],
    role: "context",
    dir: "up",
  },
  // Production d'électricité (GWh) — même flux DF_CLIMATE_CHANGE que le
  // tourisme (structure simple, déjà éprouvée). Source FMI/IRENA via PDH.
  power: {
    flows: ["SPC,DF_CLIMATE_CHANGE,1.0"],
    keys: ["A.POWER_GEN.", "A.POWER_GEN..", "A.POWER_GEN..."],
    role: "context",
    dir: "up",
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
    if (parts.length > 2) c = parts.join("");
    else if (parts[1].length === 3) c = parts.join("");
    else c = `${parts[0]}.${parts[1]}`;
  }
  const v = parseFloat(c);
  if (!Number.isFinite(v)) return NaN;
  return neg ? -v : v;
}

function parse(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], unit: "" };
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
  if (iVal < 0 || iTime < 0 || iGeo < 0) return { rows: [], unit: "" };
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
  return { rows, unit };
}

function group(rows, unit) {
  const byArea = {};
  const yearsSet = new Set();
  rows.forEach(({ geo, year, value }) => {
    const m = (byArea[geo] = byArea[geo] || new Map());
    m.set(year, value);
    yearsSet.add(year);
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
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

async function fetchIndicator(name, ind, lang, signal) {
  const flows = ind.flows || [ind.flow];
  for (const src of BASES) {
    for (const flow of flows) {
      for (const key of ind.keys) {
        try {
          const res = await fetch(buildUrl(src.base, flow, key, PROBE_START), {
            signal,
            headers: headersFor(lang),
          });
          if (!res.ok) continue;
          const probe = parse(await res.text());
          if (!probe.rows.length) continue;
          const full = await fetch(buildUrl(src.base, flow, key, FULL_START), {
            signal,
            headers: headersFor(lang),
          });
          if (!full.ok) continue;
          const parsed = parse(await full.text());
          if (!parsed.rows.length) continue;
          const grouped = group(parsed.rows, parsed.unit);
          // eslint-disable-next-line no-console
          console.info(
            `[syntheseApi] ${name} OK —`,
            grouped.areas.length,
            "territoires ·",
            `${grouped.firstYear}–${grouped.lastYear} · via`,
            src.tag,
            flow,
            key,
          );
          return { status: "live", role: ind.role, dir: ind.dir || null, ...grouped };
        } catch (e) {
          if (e && e.name === "AbortError") throw e;
        }
      }
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[syntheseApi] ${name} indisponible.`);
  return { status: "unavailable", role: ind.role, dir: ind.dir || null, byArea: {}, years: [], areas: [], unit: "" };
}

// ============================================================
// AGRICULTURE — rendement médian par territoire (cultures / bétail).
// Flux DF_AGRICULTURAL_PRODUCTION (multi-produits). On agrège en MÉDIANE
// des rendements par territoire, à la dernière année, en séparant les
// cultures (kg/ha) du bétail (kg/animal) via l'unité. Renvoie deux
// pseudo-indicateurs au même format que les autres (status/areas/byArea).
// ============================================================
const AGRI_FLOW = "SPC,DF_AGRICULTURAL_PRODUCTION,1.0";
const AGRI_KEYS = ["A...", "A....", "A.....", "A......", "A......."];
const CROP_UNIT_RE = /hectare|kg\/ha|\bha\b/i;
const ANIMAL_UNIT_RE = /animal|head|carcass|t[eê]te|abattu/i;

// Médiane d'une liste de nombres (les valeurs non finies sont déjà filtrées).
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function emptyAgri() {
  return { status: "unavailable", role: "context", dir: "up", byArea: {}, years: [], areas: [], unit: "" };
}

// Construit un pseudo-indicateur { byArea, areas, lastYear } à partir d'une
// table area -> année -> [valeurs de rendement] : on prend la MÉDIANE.
function agriIndicator(perArea, unit) {
  const byArea = {};
  let lastYear = null;
  Object.entries(perArea).forEach(([area, byYear]) => {
    const series = Object.entries(byYear)
      .map(([y, arr]) => ({ year: Number(y), value: median(arr.filter(Number.isFinite)) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.year - b.year);
    if (series.length) {
      byArea[area] = series;
      const y = series[series.length - 1].year;
      if (lastYear == null || y > lastYear) lastYear = y;
    }
  });
  const areas = Object.keys(byArea);
  return areas.length
    ? { status: "live", role: "context", dir: "up", byArea, areas, years: [], unit, lastYear }
    : emptyAgri();
}

async function fetchAgri(lang, signal) {
  // parseur agri : colonnes GEO_PICT / TIME / OBS_VALUE / UNIT_MEASURE.
  const parseAgri = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const head = lines[0];
    const delim = head.split(";").length > head.split(",").length ? ";" : ",";
    const clean = (s) => (s == null ? "" : s).replace(/^"|"$/g, "").trim();
    const H = head.split(delim).map((h) => clean(h).toUpperCase());
    const ix = (...n) => {
      for (const k of n) {
        const i = H.indexOf(k);
        if (i >= 0) return i;
      }
      return -1;
    };
    const iGeo = ix("GEO_PICT", "REF_AREA", "AREA");
    const iTime = ix("TIME_PERIOD", "TIME");
    const iVal = ix("OBS_VALUE", "VALUE");
    const iUnit = ix("UNIT_MEASURE", "UNIT");
    if (iGeo < 0 || iTime < 0 || iVal < 0) return [];
    const out = [];
    for (let i = 1; i < lines.length; i += 1) {
      const c = lines[i].split(delim);
      const value = num(clean(c[iVal]));
      const year = parseInt(clean(c[iTime]), 10);
      if (!Number.isFinite(value) || Number.isNaN(year)) continue;
      const geo = (clean(c[iGeo]) || "").split(":")[0].trim();
      if (!geo) continue;
      const uCode = iUnit >= 0 ? clean(c[iUnit]) : "";
      const uLabel = iUnit >= 0 && iUnit + 1 < c.length ? clean(c[iUnit + 1]) : "";
      out.push({ geo, year, value, unit: `${uLabel} ${uCode}` });
    }
    return out;
  };

  for (const base of BASES) {
    for (const key of AGRI_KEYS) {
      try {
        const url = `${base.base}/${AGRI_FLOW}/${key}?${new URLSearchParams({
          dimensionAtObservation: "AllDimensions",
          format: "csvfilewithlabels",
          startPeriod: "2000",
        })}`;
        const res = await fetch(url, { signal, headers: headersFor(lang) });
        if (!res.ok) continue;
        const rows = parseAgri(await res.text());
        if (!rows.length) continue;
        // Sépare cultures / bétail par l'unité, agrège en médiane par territoire.
        const crops = {};
        const stock = {};
        rows.forEach(({ geo, year, value, unit }) => {
          if (!(value > 0)) return;
          const isAnimal = ANIMAL_UNIT_RE.test(unit);
          const isCrop = CROP_UNIT_RE.test(unit);
          const bucket = isAnimal ? stock : isCrop ? crops : null;
          if (!bucket) return;
          ((bucket[geo] = bucket[geo] || {})[year] =
            (bucket[geo][year] || [])).push(value);
        });
        const cropsInd = agriIndicator(crops, "kg/ha");
        const stockInd = agriIndicator(stock, "kg/animal");
        if (cropsInd.status === "live" || stockInd.status === "live") {
          // eslint-disable-next-line no-console
          console.info(
            "[syntheseApi] agri OK —",
            `cultures:${cropsInd.areas.length}`,
            `bétail:${stockInd.areas.length} · via`,
            base.tag,
            key,
          );
          return { crops: cropsInd, livestock: stockInd };
        }
      } catch (e) {
        // Abort (timeout agri ou annulation globale) : on abandonne l'agri
        // proprement, sans propager — la synthèse continue sans cultures/bétail.
        if (e && e.name === "AbortError") {
          return { crops: emptyAgri(), livestock: emptyAgri() };
        }
      }
    }
  }
  // eslint-disable-next-line no-console
  console.warn("[syntheseApi] agri indisponible.");
  return { crops: emptyAgri(), livestock: emptyAgri() };
}

export async function fetchSynthese({ lang, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const names = Object.keys(INDICATORS);
    // Indicateurs principaux (incluant renew/envtax/tourism/power) : robustes.
    const results = await Promise.all(
      names.map((n) => fetchIndicator(n, INDICATORS[n], lang, ctrl.signal)),
    );
    const out = {};
    names.forEach((n, i) => {
      out[n] = results[i];
    });

    // AGRI ISOLÉ : le flux agricole est volumineux. On lui donne son PROPRE
    // AbortController + timeout court, et on l'enveloppe dans un try/catch :
    // son échec ou son délai ne doit JAMAIS faire échouer la synthèse.
    let agri = { crops: emptyAgri(), livestock: emptyAgri() };
    try {
      const agriCtrl = new AbortController();
      const agriTimer = setTimeout(() => agriCtrl.abort(), AGRI_TIMEOUT_MS);
      // si la synthèse globale est annulée, on annule aussi l'agri
      const relay = () => agriCtrl.abort();
      ctrl.signal.addEventListener("abort", relay);
      try {
        agri = await fetchAgri(lang, agriCtrl.signal);
      } finally {
        clearTimeout(agriTimer);
        ctrl.signal.removeEventListener("abort", relay);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[syntheseApi] agri ignoré (échec/délai):", String(e));
      agri = { crops: emptyAgri(), livestock: emptyAgri() };
    }
    out.crops = agri.crops;
    out.livestock = agri.livestock;

    const live = names.some((n) => out[n].status === "live");
    // eslint-disable-next-line no-console
    console.info(
      "[syntheseApi] terminé —",
      [...names.map((n) => `${n}:${out[n].status}`),
        `crops:${out.crops.status}`,
        `livestock:${out.livestock.status}`].join(" · "),
    );
    return { source: live ? "live" : "unavailable", ...out };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[syntheseApi] échec:", String(err));
    return { source: "unavailable", error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}