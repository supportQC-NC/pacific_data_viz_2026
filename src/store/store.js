// src/store/store.js
// ============================================================
// Store Redux Toolkit : interface (ui) + données climatiques (climate).
// ============================================================

import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import climateReducer from './slices/climateSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    climate: climateReducer,
  },
});