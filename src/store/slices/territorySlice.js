// src/store/slices/territorySlice.js
// ============================================================
// État du TERRITOIRE ACTIF (moteur Va'a) + filtre macro/micro.
//   selected = null  → vue agrégée « tout le Pacifique » (défaut, cf. Q4)
//   selected = "FJ"  → un territoire précis (survol du Va'a au scroll, ou clic)
//   macro            → bascule macro (sous-région) / micro (national), PDF p.12
// Aucune donnée ici : juste l'intention de l'utilisateur. Les signatures
// lisent `selected` et se recalculent depuis la donnée PDH.
// ============================================================

import { createSlice } from "@reduxjs/toolkit";
import { REGION_KEYS } from "../../data/subregions";

const initialState = {
  selected: null, // code GEO_PICT, ou null (Pacifique agrégé)
  hovered: null, // survol transitoire (carte / liste), n'engage pas le récit
  macro: "all", // "all" | "melanesia" | "polynesia" | "micronesia"
};

const territorySlice = createSlice({
  name: "territory",
  initialState,
  reducers: {
    setTerritory(state, action) {
      state.selected = action.payload || null;
    },
    clearTerritory(state) {
      state.selected = null;
    },
    setHovered(state, action) {
      state.hovered = action.payload || null;
    },
    setMacro(state, action) {
      const k = action.payload;
      state.macro = k === "all" || REGION_KEYS.includes(k) ? k : "all";
    },
  },
});

export const { setTerritory, clearTerritory, setHovered, setMacro } =
  territorySlice.actions;

export const selectTerritory = (s) => s.territory.selected;
export const selectHovered = (s) => s.territory.hovered;
export const selectMacro = (s) => s.territory.macro;

export default territorySlice.reducer;