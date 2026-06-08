// src/services/powerApi.js
// ============================================================
// Production d'électricité PAR SOURCE (désagrégé) — Pacific Data Hub.
// Flux SDMX : SPC,DF_POWER_GEN,1.0  (dimensions : source d'énergie ×
// statut de raccordement au réseau ; unité GWh). Source : IRENA, via le
// tableau de bord changement climatique du FMI (IMF.STA:RE).
//
// On ne garde que le raccordement « Total » (pour ne pas additionner
// réseau + hors-réseau + total), puis :
//   • les deux agrégats « (total) » → bandes FOSSILE / RENOUVELABLE ;
//   • les sources détaillées (hydro, solaire, éolien, géothermie, biomasse,
//     charbon, gaz, pétrole…) → vue détaillée.
// AUCUNE donnée fabriquée : en cas d'échec → { source: "unavailable" }.
// ============================================================

const FLOW = "SPC,DF_POWER_GEN,1.0";
const ENV_BASE = process.env.REACT_APP_PDH_BASE;
const SOURCES = [
  { base: "https://stats-sdmx-disseminate.pacificdata.org/rest/data", tag: "direct" },
  { base: "/pdh/rest/data", tag: "proxy" },
];
if (ENV_BASE) SOURCES.unshift({ base: ENV_BASE, tag: "env" });

// Clés possibles (FREQ=A + dimensions vides = toutes les valeurs).
const KEY_CANDIDATES = ["A...", "A....", "A.....", "A......", "A"];
const PROBE_START = 2020;
const FULL_START = 2000;
const TIMEOUT_MS = 30000;

function buildUrl(base, key, start) {
  const qs = new URLSearchParams({
    dimensionAtObservation: "AllDimensions",
    format: "csvfilewithlabels",
  });
  if (start) qs.set("startPeriod", String(start));
  return `${base}/${FLOW}/${key}?${qs.toString()}`;
}

function headersFor(lang) {
  return {
    Accept: "application/vnd.sdmx.data+csv, text/csv",
    "Accept-Language": lang === "fr" ? "fr" : "en",
  };
}

const norm = (s) =>
  (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const RENEW_RE = /hydro|solaire|solar|eolien|wind|geotherm|biocombustible|biofuel|biogaz|biogas|renouvelable|renewable|marine|tidal|houlomotrice|wave/;

// Classe un libellé de source : agrégat fossile/renouvelable, ou source détaillée.
function classify(srcLabel) {
  const n = norm(srcLabel);
  const isTotal = n.includes("(total)") || /\btotal\b/.test(n);
  if (isTotal) {
    return { agg: n.includes("non") ? "fossil" : "renew" };
  }
  return { detail: true, kind: RENEW_RE.test(n) ? "renew" : "fossil" };
}

function parse(text, { quiet = false } = {}) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
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
  const findBy = (skip, ...subs) => {
    for (let i = 0; i < header.length; i += 1) {
      if (i === skip) continue;
      if (subs.some((s) => header[i].includes(s))) return i;
    }
    return -1;
  };

  const iGeo = findIdx("GEO_PICT", "REF_AREA", "AREA");
  const iTime = findIdx("TIME_PERIOD", "TIME");
  const iVal = findIdx("OBS_VALUE", "VALUE");
  // Raccordement réseau : on le détecte EN PREMIER pour pouvoir l'exclure
  // de la détection de la dimension « source ».
  let iGrid = findIdx("GRID_CONNECTION", "GRID_CONNECTIVITY", "GRID_STATUS", "GRID");
  if (iGrid < 0) iGrid = findBy(-1, "GRID", "CONNECT", "RESEAU", "NETWORK", "ONGRID", "OFFGRID");
  // Source d'énergie / technologie (en évitant la colonne réseau).
  let iSrc = findIdx("COMMODITY", "ENERGY_PRODUCT", "RE_TECHNOLOGY", "TECHNOLOGY", "ENERGY_SOURCE", "PRODUCT");
  if (iSrc < 0) iSrc = findBy(iGrid, "COMMODITY", "TECHNOLOG", "ENERGY", "PRODUCT", "SOURCE", "FUEL", "GENERATION");

  if (!quiet) {
    // eslint-disable-next-line no-console
    console.info("[powerApi] colonnes:", header.join(" | "), "| iSrc", iSrc, "iGrid", iGrid);
  }
  if (iVal < 0 || iTime < 0 || iSrc < 0 || iGrid < 0 || iGeo < 0) return null;

  const num = (s) => parseFloat(decimalComma ? String(s).replace(/\./g, "").replace(",", ".") : s);
  const labelNext = (c, idx) => (idx >= 0 && idx + 1 < c.length ? clean(c[idx + 1]) : "");

  const byArea = {};
  const yearsSet = new Set();
  const detailMeta = {}; // label -> kind
  let kept = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const c = lines[i].split(delim);
    const value = num(clean(c[iVal]));
    const year = parseInt(clean(c[iTime]), 10);
    if (Number.isNaN(value) || Number.isNaN(year)) continue;

    const gridLabel = labelNext(c, iGrid) || clean(c[iGrid]);
    if (!norm(gridLabel).includes("total")) continue; // raccordement = Total uniquement

    const geo = (clean(c[iGeo]) || "PAC").split(":")[0].trim();
    const srcLabel = labelNext(c, iSrc) || clean(c[iSrc]);
    if (!srcLabel) continue;

    const cls = classify(srcLabel);
    const a = (byArea[geo] = byArea[geo] || { fossil: {}, renew: {}, detail: {} });

    if (cls.agg === "fossil") a.fossil[year] = (a.fossil[year] || 0) + value;
    else if (cls.agg === "renew") a.renew[year] = (a.renew[year] || 0) + value;
    else if (cls.detail) {
      const d = (a.detail[srcLabel] = a.detail[srcLabel] || {});
      d[year] = (d[year] || 0) + value;
      detailMeta[srcLabel] = cls.kind;
    }
    yearsSet.add(year);
    kept += 1;
  }

  if (!kept) return null;

  const years = [...yearsSet].sort((x, y) => x - y);

  // Ordre des sources détaillées : fossile d'abord (bas de pile), puis
  // renouvelable (haut), chaque sous-groupe par volume total décroissant.
  const totalOf = (label) =>
    Object.values(byArea).reduce(
      (s, a) => s + Object.values(a.detail[label] || {}).reduce((x, v) => x + v, 0),
      0,
    );
  const detailSources = Object.keys(detailMeta)
    .map((label) => ({ label, kind: detailMeta[label], total: totalOf(label) }))
    .sort((p, q) => {
      if (p.kind !== q.kind) return p.kind === "fossil" ? -1 : 1; // fossile avant renouvelable
      return q.total - p.total;
    })
    .map(({ label, kind }) => ({ label, kind }));

  return { years, byArea, detailSources };
}

export async function fetchPowerMix({ lang = "fr", signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  const headers = headersFor(lang);

  try {
    for (const src of SOURCES) {
      for (const key of KEY_CANDIDATES) {
        try {
          const probe = await fetch(buildUrl(src.base, key, PROBE_START), { signal: ctrl.signal, headers });
          // eslint-disable-next-line no-console
          console.info("[powerApi] sonde", src.tag, key, "→", probe.status);
          if (!probe.ok) continue;
          const ptext = await probe.text();
          if (!parse(ptext, { quiet: true })) continue;

          const full = await fetch(buildUrl(src.base, key, FULL_START), { signal: ctrl.signal, headers });
          if (!full.ok) continue;
          const parsed = parse(await full.text());
          if (!parsed) continue;
          // eslint-disable-next-line no-console
          console.info("[powerApi] OK →", src.tag, "| clé", key, "| sources", parsed.detailSources.length, "| années", parsed.years.length);
          return { source: "live", ...parsed };
        } catch (e) {
          if (ctrl.signal.aborted) throw e;
          /* essai suivant */
        }
      }
    }
    return { source: "unavailable", years: [], byArea: {}, detailSources: [] };
  } catch (err) {
    return { source: "unavailable", years: [], byArea: {}, detailSources: [], error: String(err) };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}