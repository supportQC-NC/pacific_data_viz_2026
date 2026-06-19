// src/services/pdhApi.js
// ============================================================
// Accès Pacific Data Hub (.Stat / SDMX). Appel live "best effort"
// (plafonné à 8 s). AUCUNE donnée synthétique : en cas d'échec ou de série
// vide, on renvoie un jeu vide (état "indisponible") — JAMAIS de chiffres
// fabriqués. Intégrité concours : seules des données réelles sont affichées.
// ============================================================

const BASE = process.env.REACT_APP_PDH_BASE || 'https://stats-sdmx-disseminate.pacificdata.org/rest/data';
const LIVE_TIMEOUT_MS = 8000;

export const DATASETS = {
  seaLevel:          { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.SEA_LVL.',     start: 1970 },
  sst:               { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.SST_ANOM.',    start: 1970 },
  emissions:         { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.GHG_EMI_CAPITA.', start: 1970 },
  cropYield:         { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.CROP_YIELD.',   start: 1961 },
  landCover:         { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.ALT_LAND_COVER.', start: 1992 },
  livestockYield:    { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.LVST_YIELD.',   start: 1961 },
  population:        { flow: 'SPC,DF_NMDI_POP,1.0',       key: 'A..NMDI0002._T._T._T..', start: 1970 },
  disastersAffected: { flow: 'SPC,DF_SDG_11,3.0',         key: 'A.VC_DSR_AFFCT.........', start: 2000 },
  disastersLoss:     { flow: 'SPC,DF_SDG_11,3.0',         key: 'A.VC_DSR_AALT...._T.....', start: 2000 },
  renewables:        { flow: 'SPC,DF_SDG,3.0',            key: 'A.EG_FEC_RNEW.._T._T._T._T._T._T._Z._T', start: 1990 },
  // --- Séries supplémentaires (mêmes schémas que ci-dessus) exposées sur la
  //     page « jeu de données » pour afficher les données brutes. ---
  rain:              { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.RAIN_ANOM.',  start: 1970 },
  tourism:           { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.TRSM_ARR.',   start: 1990 },
  electricity:       { flow: 'SPC,DF_CLIMATE_CHANGE,1.0', key: 'A.POWER_GEN.',  start: 1970 },
  water:             { flow: 'SPC,DF_SDG_06,3.0',         key: 'A.SH_H2O_SAFE...._T.....', start: 2000 },
  tuberculosis:      { flow: 'SPC,DF_SDG_03,3.0',         key: 'A.SH_TBS_INCD.........', start: 2000 },
  redList:           { flow: 'SPC,DF_SDG_15,3.0',         key: 'A.ER_RSK_LST.........', start: 1993 },
};

function buildUrl({ key, start }, flow) {
  const qs = new URLSearchParams({ format: 'csv' });
  if (start) qs.set('startPeriod', String(start));
  return `${BASE}/${flow}/${key}?${qs.toString()}`;
}

// Repli de version : certains dataflows SDMX ne sont pas disponibles dans la
// version codée en dur (ex. tuberculose DF_SDG_03,3.0 -> 404). On essaie
// d'abord le flux configuré, puis la version "latest", sans version (= latest),
// puis quelques versions courantes. N'est sollicité QUE si le 1er essai échoue.
function flowCandidates(flow) {
  const [agency, id] = flow.split(',');
  const base = `${agency},${id}`;
  const out = [flow];
  [
    base,
    `${base},latest`,
    `${base},1.0`,
    `${base},2.0`,
    `${base},3.0`,
    `${base},4.0`,
  ].forEach((f) => {
    if (!out.includes(f)) out.push(f);
  });
  return out;
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

export async function fetchDataset(id, { signal } = {}) {
  const def = DATASETS[id];
  if (!def) throw new Error(`Jeu inconnu : ${id}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  try {
    const candidates = flowCandidates(def.flow);
    let lastErr = null;
    for (const flow of candidates) {
      try {
        const res = await fetch(buildUrl(def, flow), {
          signal: ctrl.signal,
          headers: { Accept: 'text/csv' },
        });
        if (!res.ok) {
          lastErr = new Error(`PDH ${res.status} (${flow})`);
          continue;
        }
        const text = await res.text();
        const norm = normalize(parseSdmxCsv(text));
        if (!norm.areas.length) {
          lastErr = new Error(`PDH série vide (${flow})`);
          continue;
        }
        if (flow !== def.flow) {
          // eslint-disable-next-line no-console
          console.info(`[pdhApi] ${id} : repli de version -> ${flow}`);
        }
        // Données réelles uniquement (jamais de chiffres fabriqués).
        return { id, source: 'live', ...norm };
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        lastErr = e;
      }
    }
    throw lastErr || new Error(`PDH échec : ${id}`);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}