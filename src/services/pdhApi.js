// src/services/pdhApi.js
// ============================================================
// Accès Pacific Data Hub (.Stat / SDMX). Appel live "best effort"
// (plafonné à 8 s) ; sinon jeu de DÉMONSTRATION embarqué.
// Jeux de secours : emissions, seaLevel (mm), sst (°C anomalie).
// Agriculture : cropYield + livestockYield (DF_CLIMATE_CHANGE) — agrégés,
//   même structure que les émissions ; pas de démo fabriquée (données
//   réelles uniquement, sinon série vide honnête).
// ============================================================

const BASE = process.env.REACT_APP_PDH_BASE || 'https://stats-sdmx-disseminate.pacificdata.org/rest/data';
const LIVE_TIMEOUT_MS = 8000;

export const DATASETS = {
  seaLevel:          { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.SEA_LVL.',     start: 1970 },
  sst:               { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.SST_ANOM.',    start: 1970 },
  emissions:         { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.GHG_EMI_CAPITA.', start: 1970 },
  cropYield:         { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.CROP_YIELD.',   start: 1961 },
  livestockYield:    { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.LVST_YIELD.',   start: 1961 },
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
const PICT = ['NC', 'GU', 'PW', 'MP', 'AS', 'NR', 'CK', 'PF', 'FJ', 'NU', 'MH', 'TO', 'FM', 'WS', 'WF', 'TV', 'PG', 'KI', 'VU', 'TK', 'SB', 'PN'];

// Émissions (t CO₂e/hab.)
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

// Niveau de la mer : variation cumulée (mm) depuis 1993, ~3,5–5,3 mm/an.
const SEALEVEL_YEARS = [1993, 1996, 1999, 2002, 2005, 2008, 2011, 2014, 2017, 2020, 2023];
function buildSeaLevelFallback() {
  const rows = [];
  PICT.forEach((geo) => {
    const rate = 3.5 + (geo.charCodeAt(0) % 4) * 0.6; // mm/an (3,5 → 5,3)
    SEALEVEL_YEARS.forEach((year) => {
      rows.push({ geo, year, value: +((year - 1993) * rate).toFixed(1) });
    });
  });
  return rows;
}

// Température de surface : anomalie (°C) vs base, ~0 → +0,9 °C (1985→2024).
const SST_YEARS = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];
function buildSstFallback() {
  const rows = [];
  PICT.forEach((geo) => {
    const jitter = (((geo.charCodeAt(0) + geo.charCodeAt(1)) % 7) - 3) * 0.03;
    SST_YEARS.forEach((year) => {
      const base = ((year - 1985) / (2024 - 1985)) * 0.9;
      rows.push({ geo, year, value: +Math.max(0, base + jitter).toFixed(2) });
    });
  });
  return rows;
}

// Population : TAUX de croissance annuel (%) par territoire 1990→2025.
// (L'indicateur live est un taux, pas un effectif.) Beaucoup ralentissent ;
// certaines îles passent en négatif (émigration).
const POPRATE_1990 = {
  PG: 2.9, FJ: 1.2, SB: 3.3, NC: 2.2, PF: 2.4, GU: 2.0, VU: 2.9, WS: 1.0,
  TO: 0.4, FM: 1.8, KI: 2.1, MH: 1.5, PW: 2.2, CK: 0.2, AS: 3.2, MP: 5.5,
  NR: 1.0, TV: 1.3, WF: 1.0, NU: -1.5, TK: 0.2, PN: -1.0,
};
const POPRATE_2025 = {
  PG: 1.8, FJ: 0.5, SB: 2.4, NC: 0.9, PF: 0.2, GU: 0.7, VU: 2.3, WS: 0.6,
  TO: -0.4, FM: 0.5, KI: 1.5, MH: -3.3, PW: -0.1, CK: -3.4, AS: -1.6, MP: -1.8,
  NR: 0.7, TV: -1.7, WF: -0.8, NU: 0.4, TK: 4.4, PN: 0,
};
function buildPopulationFallback() {
  const rows = [];
  Object.keys(POPRATE_1990).forEach((geo) => {
    const a = POPRATE_1990[geo];
    const b = POPRATE_2025[geo];
    for (let year = 1990; year <= 2025; year += 1) {
      const t = (year - 1990) / 35;
      const noise = (((geo.charCodeAt(0) + year) % 5) - 2) * 0.12;
      rows.push({ geo, year, value: +(a + (b - a) * t + noise).toFixed(2) });
    }
  });
  return rows;
}

// Catastrophes : données ÉVÉNEMENTIELLES (pics, pas séries continues).
// Quelques événements marquants réels, par territoire.
const DISASTER_EVENTS = [
  { geo: "FJ", year: 2012, affected: 14000, loss: 100000000 },
  { geo: "FJ", year: 2016, affected: 540000, loss: 1400000000 }, // Winston
  { geo: "FJ", year: 2020, affected: 75000, loss: 50000000 },
  { geo: "VU", year: 2015, affected: 188000, loss: 449000000 },  // Pam
  { geo: "VU", year: 2020, affected: 160000, loss: 600000000 },  // Harold
  { geo: "VU", year: 2023, affected: 250000, loss: 400000000 },
  { geo: "TO", year: 2018, affected: 80000, loss: 164000000 },   // Gita
  { geo: "TO", year: 2022, affected: 84000, loss: 90000000 },    // Hunga Tonga
  { geo: "SB", year: 2014, affected: 52000, loss: 108000000 },
  { geo: "PG", year: 2015, affected: 480000, loss: 12000000 },   // sécheresse
  { geo: "PG", year: 2018, affected: 544000, loss: 300000000 },  // séisme
  { geo: "WS", year: 2012, affected: 7500, loss: 200000000 },    // Evan
  { geo: "FM", year: 2015, affected: 30000, loss: 8500000 },
  { geo: "MH", year: 2013, affected: 6000, loss: 4900000 },
  { geo: "TV", year: 2015, affected: 4000, loss: 11000000 },
  { geo: "KI", year: 2015, affected: 25000, loss: 5000000 },
  { geo: "PF", year: 2010, affected: 5000, loss: 30000000 },     // Oli
  { geo: "AS", year: 2009, affected: 8000, loss: 150000000 },    // tsunami
  { geo: "CK", year: 2005, affected: 1000, loss: 7000000 },
  { geo: "GU", year: 2002, affected: 3000, loss: 50000000 },
  { geo: "NC", year: 2003, affected: 2000, loss: 5000000 },
];
function buildDisastersAffectedFallback() {
  return DISASTER_EVENTS.filter((e) => e.affected > 0).map((e) => ({ geo: e.geo, year: e.year, value: e.affected }));
}
function buildDisastersLossFallback() {
  return DISASTER_EVENTS.filter((e) => e.loss > 0).map((e) => ({ geo: e.geo, year: e.year, value: e.loss }));
}

// Renouvelables : part des renouvelables dans la conso finale d'énergie (%).
// Trajectoire montante (élan) ; quelques pionniers à très forte part (TK solaire).
const RENEW_2000 = {
  PG: 55, SB: 55, WS: 35, PF: 30, VU: 25, FJ: 18, NC: 13, TO: 5, CK: 5, PN: 5,
  TV: 2, KI: 2, NU: 2, FM: 1, MH: 1, GU: 1, AS: 1, MP: 1, PW: 1, WF: 1, NR: 0, TK: 0,
};
const RENEW_2021 = {
  TK: 93, SB: 40, CK: 40, PN: 40, WS: 40, VU: 35, PF: 32, FJ: 28, PG: 50, NC: 18,
  TV: 18, TO: 13, KI: 10, NU: 10, PW: 8, GU: 6, WF: 6, AS: 5, FM: 5, MH: 4, MP: 4, NR: 3,
};
function buildRenewablesFallback() {
  const rows = [];
  Object.keys(RENEW_2000).forEach((geo) => {
    const a = RENEW_2000[geo];
    const b = RENEW_2021[geo];
    for (let year = 2000; year <= 2021; year += 1) {
      const t = (year - 2000) / 21;
      const noise = (((geo.charCodeAt(0) + year) % 5) - 2) * 0.4;
      rows.push({ geo, year, value: +Math.max(0, Math.min(100, a + (b - a) * t + noise)).toFixed(1) });
    }
  });
  return rows;
}

const FALLBACKS = {
  emissions: buildEmissionsFallback,
  seaLevel: buildSeaLevelFallback,
  sst: buildSstFallback,
  population: buildPopulationFallback,
  disastersAffected: buildDisastersAffectedFallback,
  disastersLoss: buildDisastersLossFallback,
  renewables: buildRenewablesFallback,
  // cropYield / livestockYield : pas de démo fabriquée (rendements réels
  // uniquement). En cas d'échec live, série vide plutôt que données inventées.
};
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