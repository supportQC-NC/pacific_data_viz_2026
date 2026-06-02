// src/services/data360Api.js
// ============================================================
// World Bank Data360 — base OWID_CB (Our World in Data), CC BY 4.0.
// Part du Pacifique dans les emissions mondiales de CO2 (incl. usage des
// terres) : on somme l'indicateur de PART MONDIALE par pays
// (OWID_CB_SHARE_GLOBAL_CO2_INCLUDING_LUC) sur les territoires du Pacifique.
// Live best-effort (8 s) ; repli ~0,03 % (ordre de grandeur documente) si
// l'API echoue ou est bloquee (CORS).
// ============================================================

const BASE = "https://data360api.worldbank.org/data360/data";
const DATABASE_ID = "OWID_CB";
const INDICATOR = "OWID_CB_SHARE_GLOBAL_CO2_INCLUDING_LUC";
const LIVE_TIMEOUT_MS = 8000;

// Territoires du Pacifique : code SPC 2 lettres -> ISO3 (codes OWID/Data360).
export const PICT_ISO3 = {
  FJ: "FJI", PG: "PNG", SB: "SLB", VU: "VUT", NC: "NCL",
  PF: "PYF", WS: "WSM", TO: "TON", TV: "TUV", CK: "COK",
  NU: "NIU", WF: "WLF", TK: "TKL", AS: "ASM", PN: "PCN",
  FM: "FSM", GU: "GUM", MP: "MNP", MH: "MHL", NR: "NRU",
  PW: "PLW", KI: "KIR",
};
const ISO3_SET = new Set(Object.values(PICT_ISO3));
const FALLBACK_SHARE = 0.03;

export async function fetchPacificCO2Share({ signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => ctrl.abort());
  try {
    const qs = new URLSearchParams({
      DATABASE_ID,
      INDICATOR,
      isLatestData: "true",
      format: "json",
    });
    const res = await fetch(`${BASE}?${qs.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Data360 ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json?.value) ? json.value : [];
    let share = 0;
    let year = null;
    rows.forEach((r) => {
      if (!ISO3_SET.has(r.REF_AREA)) return;
      const v = parseFloat(r.OBS_VALUE);
      if (Number.isFinite(v)) share += v;
      const y = parseInt(r.TIME_PERIOD, 10);
      if (Number.isFinite(y)) year = year == null ? y : Math.max(year, y);
    });
    if (share > 0) return { source: "live", share, year };
    return { source: "fallback", share: FALLBACK_SHARE, year: null };
  } catch (e) {
    return { source: "fallback", share: FALLBACK_SHARE, year: null };
  } finally {
    clearTimeout(timer);
  }
}