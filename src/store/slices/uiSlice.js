// src/store/slices/uiSlice.js
// ============================================================
// État d'interface géré par Redux.
// (Le thème et la langue sont gérés par des Contextes, pas ici.)
// Pour l'instant : état du menu mobile. Les slices de données
// (appels API) viendront s'ajouter plus tard.
// ============================================================

import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    mobileMenuOpen: false,
  },
  reducers: {
    toggleMobileMenu(state) {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    closeMobileMenu(state) {
      state.mobileMenuOpen = false;
    },
  },
});

export const { toggleMobileMenu, closeMobileMenu } = uiSlice.actions;
export const selectMobileMenuOpen = (state) => state.ui.mobileMenuOpen;
export default uiSlice.reducer;