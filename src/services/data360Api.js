// src/services/data360Api.js
// ============================================================
// World Bank Data360 — base OWID_CB (Our World in Data), CC BY 4.0.
// Le mondial sert UNIQUEMENT a comparer ; on n'invente JAMAIS de donnees.
//
// 1) fetchCountryCO2Shares()  -> part de chaque pays dans le CO2 mondial (%),
//    indicateur OWID_CB_SHARE_GLOBAL_CO2. Sert a l'encart "part infime" et au
//    KPI mondial (somme Pacifique).
// 2) fetchWorldPerCapita()    -> emissions PAR HABITANT (t CO2/hab) des grands
//    emetteurs, indicateur OWID_CB_CO2_PER_CAPITA. Sert de COMPARAISON au
//    graphique par habitant (le Pacifique, lui, vient de NOS donnees PDH).
//
// Si l'appel echoue -> source:"unavailable" + rows:[] (UI : indisponible).
// CORS : passe par le proxy de dev `/wbdata360` (voir setupProxy.js).
// ============================================================

const BASE =
  process.env.REACT_APP_DATA360_BASE || "/wbdata360/data360/data";
const DATABASE_ID = "OWID_CB";
const SHARE_INDICATOR = "OWID_CB_SHARE_GLOBAL_CO2";
const PC_INDICATOR = "OWID_CB_CO2_PER_CAPITA";
const LIVE_TIMEOUT_MS = 9000;

// Territoires du Pacifique : code SPC 2 lettres -> ISO3.
export const PICT_ISO3 = {
  FJ: "FJI", PG: "PNG", SB: "SLB", VU: "VUT", NC: "NCL",
  PF: "PYF", WS: "WSM", TO: "TON", TV: "TUV", CK: "COK",
  NU: "NIU", WF: "WLF", TK: "TKL", AS: "ASM", PN: "PCN",
  FM: "FSM", GU: "GUM", MP: "MNP", MH: "MHL", NR: "NRU",
  PW: "PLW", KI: "KIR",
};
export const PACIFIC_ISO3 = new Set(Object.values(PICT_ISO3));

// Grands emetteurs (reconnaissables) affiches en comparaison.
export const BIG_EMITTERS = [
  "CHN", "USA", "IND", "RUS", "JPN", "DEU",
  "IRN", "SAU", "IDN", "KOR", "CAN", "BRA",
  "AUS", "NZL",
];

// Agregats / regions a exclure du classement par pays (part mondiale).
const AGG = new Set([
  "WLD", "EUU", "OED", "HIC", "MIC", "LIC", "LMC", "UMC", "LMY", "INX", "PRE",
  "AFE", "AFW", "ARB", "CSS", "EAP", "EAS", "ECA", "ECS", "EMU", "FCS", "HPC",
  "IBD", "IBT", "IDA", "IDB", "IDX", "LAC", "LCN", "LDC", "MEA", "MNA", "NAC",
  "PSS", "SAS", "SSA", "SSF", "SST", "TEA", "TEC", "TLA", "TMN", "TSA", "TSS",
]);

async function getRows(indicator, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => ctrl.abort());
  try {
    const qs = new URLSearchParams({
      DATABASE_ID,
      INDICATOR: indicator,
      isLatestData: "true",
      format: "json",
    });
    const res = await fetch(`${BASE}?${qs.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Data360 ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.value) ? json.value : [];
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCountryCO2Shares(opts = {}) {
  const raw = await getRows(SHARE_INDICATOR, opts.signal);
  if (!raw) return { source: "unavailable", year: null, rows: [] };
  let year = null;
  const rows = [];
  raw.forEach((r) => {
    const iso3 = r.REF_AREA;
    if (!iso3 || iso3.length !== 3 || AGG.has(iso3)) return;
    const share = parseFloat(r.OBS_VALUE);
    if (!Number.isFinite(share) || share < 0 || share >= 95) return;
    rows.push({ iso3, share });
    const y = parseInt(r.TIME_PERIOD, 10);
    if (Number.isFinite(y)) year = year == null ? y : Math.max(year, y);
  });
  if (!rows.length) return { source: "unavailable", year: null, rows: [] };
  rows.sort((a, b) => b.share - a.share);
  return { source: "live", year, rows };
}

export async function fetchWorldPerCapita(opts = {}) {
  const raw = await getRows(PC_INDICATOR, opts.signal);
  if (!raw) return { source: "unavailable", year: null, rows: [] };
  const big = new Set(BIG_EMITTERS);
  let year = null;
  const rows = [];
  raw.forEach((r) => {
    const iso3 = r.REF_AREA;
    if (!big.has(iso3)) return;
    const value = parseFloat(r.OBS_VALUE);
    if (!Number.isFinite(value) || value < 0) return;
    rows.push({ iso3, value });
    const y = parseInt(r.TIME_PERIOD, 10);
    if (Number.isFinite(y)) year = year == null ? y : Math.max(year, y);
  });
  if (!rows.length) return { source: "unavailable", year: null, rows: [] };
  rows.sort((a, b) => b.value - a.value);
  return { source: "live", year, rows };
}

// Somme des parts des territoires du Pacifique. null si aucune donnee reelle.
export function pacificShareFromRows(rows = []) {
  const pac = rows.filter((r) => PACIFIC_ISO3.has(r.iso3));
  if (!pac.length) return null;
  return pac.reduce((s, r) => s + (Number.isFinite(r.share) ? r.share : 0), 0);
}