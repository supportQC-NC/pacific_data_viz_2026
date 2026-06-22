// src/store/store.js
// ============================================================
// Store Redux Toolkit :
//   ui        → état d'interface (menu mobile)
//   climate   → données climatiques (Pacific Data Hub)
//   territory → territoire actif du moteur Va'a + filtre macro/micro
// ============================================================

import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import climateReducer from './slices/climateSlice';
import territoryReducer from './slices/territorySlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    climate: climateReducer,
    territory: territoryReducer,
  },
});