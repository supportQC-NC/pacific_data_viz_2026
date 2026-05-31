// src/store/context/langContext.js
// ============================================================
// Contexte global de langue (fr / en).
// - Persiste le choix (localStorage)
// - Expose t('chemin.clé') pour récupérer une chaîne traduite
// - Aucune chaîne en dur dans les composants : tout passe par t()
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import fr from '../../i18n/fr.json';
import en from '../../i18n/en.json';

const DICTS = { fr, en };
const STORAGE_KEY = 'pdc-lang';
const LangContext = createContext(null);

function getInitialLang() {
  if (typeof window === 'undefined') return 'fr';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  return (window.navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
}

// Récupère une valeur imbriquée via un chemin "a.b.c"
function resolve(dict, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), dict);
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'fr' ? 'en' : 'fr'));
  }, []);

  const t = useCallback(
    (path) => {
      const value = resolve(DICTS[lang], path);
      return value == null ? path : value;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, toggleLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang doit être utilisé dans <LangProvider>');
  return ctx;
}