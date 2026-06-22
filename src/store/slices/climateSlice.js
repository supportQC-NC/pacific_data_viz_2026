// src/store/slices/climateSlice.js
// ============================================================
// État Redux des données climatiques (Pacific Data Hub).
// - Thunk générique : loadDataset('emissions' | 'seaLevel' | 'sst' ...).
// - Données indexées par CODE PAYS (GEO_PICT) → on peut CROISER plusieurs
//   indicateurs en utilisant le code comme clé de jointure (cf.
//   selectCrossSection / joinByArea).
// - AJOUT Datamoana 2.0 : selectRegionalMedian → la « Couche 2 » du moteur
//   Va'a (médiane régionale translucide), calculée DEPUIS la donnée (cf. Q3).
// ============================================================

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchDataset, DATASETS } from "../../services/pdhApi";
import { isPict } from "../../i18n/pictNames";

export const loadDataset = createAsyncThunk(
  "climate/loadDataset",
  async (id, { signal, rejectWithValue }) => {
    try {
      return await fetchDataset(id, { signal });
    } catch (err) {
      return rejectWithValue(err.message || "fetch error");
    }
  },
  {
    condition: (id, { getState }) => {
      const e = getState().climate.datasets[id];
      if (e && (e.status === "loading" || e.status === "succeeded")) return false;
      return true;
    },
  }
);

const initialDatasets = Object.keys(DATASETS).reduce((acc, id) => {
  acc[id] = { status: "idle", data: null, error: null };
  return acc;
}, {});

const climateSlice = createSlice({
  name: "climate",
  initialState: { datasets: initialDatasets },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadDataset.pending, (state, action) => {
        state.datasets[action.meta.arg] = { status: "loading", data: null, error: null };
      })
      .addCase(loadDataset.fulfilled, (state, action) => {
        state.datasets[action.meta.arg] = {
          status: "succeeded",
          data: action.payload,
          error: null,
        };
      })
      .addCase(loadDataset.rejected, (state, action) => {
        state.datasets[action.meta.arg] = {
          status: "failed",
          data: null,
          error: action.payload || "error",
        };
      });
  },
});

/* ----------------------------- Sélecteurs ----------------------------- */

export const selectDataset = (id) => (state) =>
  state.climate.datasets[id] || { status: "idle", data: null, error: null };

// Statut combiné de plusieurs indicateurs.
export const selectDatasetsStatus = (ids) => (state) => {
  const entries = ids.map((id) => state.climate.datasets[id]);
  return {
    loading: entries.some((e) => !e || e.status === "loading" || e.status === "idle"),
    failed: entries.some((e) => e && e.status === "failed"),
    ready: entries.every((e) => e && e.status === "succeeded"),
  };
};

// Valeur d'un indicateur pour une aire + une année (ou la dernière dispo).
function valueAt(entry, area, year) {
  if (!entry || entry.status !== "succeeded" || !entry.data) return null;
  const serie = entry.data.byArea[area];
  if (!serie || !serie.length) return null;
  if (year == null) return serie[serie.length - 1].value;
  const pt = serie.find((p) => p.year === year);
  return pt ? pt.value : null;
}

// Médiane d'un tableau de nombres (ignore les non-finis).
function median(nums) {
  const a = nums.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// JOINTURE PAR CODE PAYS : pour une liste d'indicateurs, renvoie une ligne
// par territoire avec la valeur de chaque indicateur — base des graphiques
// qui croisent (ex. émissions vs niveau de mer).
//   selectCrossSection(['emissions','seaLevel'], 2023)
//   → [{ area:'FJ', emissions: 3.0, seaLevel: 110 }, ...]
export const selectCrossSection =
  (ids, yearByDataset = {}) =>
  (state) => {
    const entries = Object.fromEntries(
      ids.map((id) => [id, state.climate.datasets[id]])
    );
    // Union des codes pays présents dans au moins un indicateur.
    const areas = new Set();
    ids.forEach((id) => {
      const e = entries[id];
      if (e && e.status === "succeeded" && e.data) {
        e.data.areas.forEach((a) => areas.add(a));
      }
    });
    return [...areas].map((area) => {
      const row = { area };
      ids.forEach((id) => {
        row[id] = valueAt(entries[id], area, yearByDataset[id] ?? null);
      });
      return row;
    });
  };

// MÉDIANE RÉGIONALE (Couche 2 du moteur Va'a). Médiane, sur les seuls
// territoires PICT, de la valeur d'un indicateur à une année donnée (ou la
// dernière disponible). Calculée DEPUIS la donnée → aucune valeur saisie à
// la main. Renvoie { value, n } ou null si la donnée est indisponible.
//   selectRegionalMedian('emissions', 2023)(state) → { value: 0.93, n: 19 }
export const selectRegionalMedian =
  (id, year = null) =>
  (state) => {
    const entry = state.climate.datasets[id];
    if (!entry || entry.status !== "succeeded" || !entry.data) return null;
    const vals = [];
    entry.data.areas.filter(isPict).forEach((area) => {
      const v = valueAt(entry, area, year);
      if (Number.isFinite(v)) vals.push(v);
    });
    const value = median(vals);
    return value == null ? null : { value, n: vals.length };
  };

export default climateSlice.reducer;