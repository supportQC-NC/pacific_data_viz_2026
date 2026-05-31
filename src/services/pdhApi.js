// src/services/pdhApi.js
// ============================================================
// Accès Pacific Data Hub (.Stat / SDMX). Appel live "best effort"
// (plafonné à 8 s) ; sinon jeu de DÉMONSTRATION embarqué.
// startPeriod abaissé à 1970 → on récupère toutes les années
// disponibles (et pas seulement à partir de 1990).
// ============================================================

const BASE = process.env.REACT_APP_PDH_BASE || 'https://stats-sdmx-disseminate.pacificdata.org/rest/data';
const LIVE_TIMEOUT_MS = 8000;

export const DATASETS = {
  seaLevel:          { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.SEA_LVL.',     start: 1970 },
  sst:               { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.SST_ANOM.',    start: 1970 },
  emissions:         { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.GHG_EMI_CAPITA.', start: 1970 },
  population:        { flow: 'SPC,DF_NMDI_POP,1.0',       key: 'A..NMDI0002._T._T._T..', start: 1970 },
  disastersAffected: { flow: 'SPC,DF_SDG_11,3.0',         key: 'A.VC_DSR_AFFCT.........', start: 2000 },
  disastersLoss:     { flow: 'SPC,DF_SDG_11,3.0',         key: 'A.VC_DSR_AALT...._T.....', start: 2000 },
  renewables:        { flow: 'SPC,DF_SDG,3.0',            key: 'A.EG_FEC_RNEW.._T._T._T._T._T._T._Z._T', start: 1990 },
};

function buildUrl({ flow, key, start }) {
  const qs = new URLSearchParams({ format: 'csv' });
  if (start) qs.set('startPeriod', String(start));
  return `${BASE}/${flow}/${key}?${qs.toString()}`;
}

function parseSdmxCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0];
  const delim = head.split(';').length > head.split(',').length ? ';' : ',';
  const decimalComma = delim === ';';
  const clean = (s) => s.replace(/^"|"$/g, '').trim();
  const header = head.split(delim).map((h) => clean(h).toUpperCase());
  const find = (...names) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iGeo = find('GEO_PICT', 'REF_AREA', 'AREA');
  const iTime = find('TIME_PERIOD', 'TIME');
  const iVal = find('OBS_VALUE', 'VALUE');
  if (iVal < 0 || iTime < 0) return [];
  const num = (s) => parseFloat(decimalComma ? String(s).replace(',', '.') : s);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const c = lines[i].split(delim).map(clean);
    const value = num(c[iVal]);
    const year = parseInt(c[iTime], 10);
    if (Number.isNaN(value) || Number.isNaN(year)) continue;
    rows.push({ geo: iGeo >= 0 ? (c[iGeo] || 'PAC') : 'PAC', year, value });
  }
  return rows;
}

function normalize(rows) {
  const byArea = {};
  const years = new Set();
  let min = Infinity;
  let max = -Infinity;
  rows.forEach(({ geo, year, value }) => {
    (byArea[geo] = byArea[geo] || []).push({ year, value });
    years.add(year);
    if (value < min) min = value;
    if (value > max) max = value;
  });
  Object.values(byArea).forEach((s) => s.sort((a, b) => a.year - b.year));
  const sortedYears = [...years].sort((a, b) => a - b);
  return {
    years: sortedYears,
    byArea,
    areas: Object.keys(byArea),
    range: { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max },
    firstYear: sortedYears[0] ?? null,
    lastYear: sortedYears[sortedYears.length - 1] ?? null,
  };
}

// ---- Données de DÉMONSTRATION ----
const EMISSIONS_BASE = {
  NC: 23.4, GU: 15.8, PW: 13.1, MP: 6.8, AS: 6.2, NR: 4.3,
  CK: 3.9, PF: 3.6, FJ: 2.6, NU: 2.1, MH: 2.0, TO: 1.7,
  FM: 1.4, WS: 1.3, WF: 1.2, TV: 0.9, PG: 0.9, KI: 0.6,
  VU: 0.55, TK: 0.4, SB: 0.38, PN: 0.3,
};
const EMISSIONS_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];

function buildEmissionsFallback() {
  const rows = [];
  const last = EMISSIONS_YEARS.length - 1;
  EMISSIONS_YEARS.forEach((year, i) => {
    const t = last === 0 ? 1 : i / last;
    const drift = 0.82 + 0.34 * t;
    Object.entries(EMISSIONS_BASE).forEach(([geo, base]) => {
      rows.push({ geo, year, value: +(base * drift).toFixed(2) });
    });
  });
  return rows;
}

const SEALEVEL_YEARS = [1993, 2000, 2007, 2014, 2021];
function buildSeaLevelFallback() {
  const rows = [];
  const codes = Object.keys(EMISSIONS_BASE);
  SEALEVEL_YEARS.forEach((year) => {
    const rise = (year - 1993) * 4.1;
    codes.forEach((geo) => rows.push({ geo, year, value: +(rise + (geo.charCodeAt(0) % 5)).toFixed(1) }));
  });
  return rows;
}

const FALLBACKS = { emissions: buildEmissionsFallback, seaLevel: buildSeaLevelFallback };
function fallbackResult(id) {
  const build = FALLBACKS[id];
  if (!build) return null;
  return { id, source: 'fallback', ...normalize(build()) };
}

export async function fetchDataset(id, { signal } = {}) {
  const def = DATASETS[id];
  if (!def) throw new Error(`Jeu inconnu : ${id}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(buildUrl(def), { signal: ctrl.signal, headers: { Accept: 'text/csv' } });
    if (!res.ok) throw new Error(`PDH ${res.status}`);
    const text = await res.text();
    const live = { id, source: 'live', ...normalize(parseSdmxCsv(text)) };
    if (live.years.length > 0) return live;
    return fallbackResult(id) || live;
  } catch (err) {
    const fb = fallbackResult(id);
    if (fb) return fb;
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}