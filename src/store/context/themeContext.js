// src/store/context/themeContext.js
// ============================================================
// Contexte global de thème — DATAMOANA EST SOMBRE, ET SEULEMENT SOMBRE.
//
// Le produit ne propose plus de choix d'affichage. Le récit est composé
// pour la nuit : fonds profonds, rampes de couleur validées sur navy,
// photos et cartes calibrées dessus. Le thème clair existait, mais il
// n'avait jamais été réglé au même niveau — le laisser accessible
// revenait à exposer une version qu'on ne défend pas.
//
// Ce qui a été retiré ailleurs : le switch du header, et l'étape
// « Affichage » de VoyageSetup (il ne reste que la langue).
//
// Ce fichier GARDE l'API `useTheme()` (`theme`, `setTheme`, `toggleTheme`)
// pour ne rien casser chez les consommateurs : `theme` vaut toujours
// 'dark', et les deux fonctions ne font rien. Les jetons `[data-theme=
// "light"]` restent dans _variables.scss — inertes, mais prêts si le
// thème clair est un jour repris et validé.
// ============================================================

import React, { createContext, useContext, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'pdc-theme';
const THEME = 'dark';
const ThemeContext = createContext(null);

const noop = () => {};

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', THEME);
    // Un visiteur qui avait choisi « clair » avant ce changement gardait
    // sinon sa préférence en localStorage : on la remet d'aplomb.
    try {
      window.localStorage.setItem(STORAGE_KEY, THEME);
    } catch {
      // Navigation privée ou stockage bloqué : sans effet, le thème est
      // de toute façon appliqué sur <html>.
    }
  }, []);

  const value = useMemo(
    () => ({ theme: THEME, setTheme: noop, toggleTheme: noop }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>');
  return ctx;
}
