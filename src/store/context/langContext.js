// src/store/context/langContext.js
// ============================================================
// Contexte de langue (fr / en). t('chemin.clé'), persistance localStorage.
// Datamoana 2.0 : extraStrings est une COUCHE D'OVERRIDE fusionnée dans fr/en
// (on peut AJOUTER des clés OU en CORRIGER une existante, sans éditer les gros
// JSON). Les clés non présentes dans extraStrings gardent la valeur des JSON.
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import fr from '../../i18n/fr.json';
import en from '../../i18n/en.json';
import EXTRA_STRINGS from '../../i18n/extraStrings';

// Fusion profonde : `extra` PRIME (override) sur `base`.
function mergeDeep(base, extra) {
  if (extra === undefined) return base;
  if (extra === null || typeof extra !== 'object' || Array.isArray(extra)) return extra;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return { ...extra };
  const out = { ...base };
  Object.keys(extra).forEach((k) => {
    out[k] = k in out ? mergeDeep(out[k], extra[k]) : extra[k];
  });
  return out;
}

const DICTS = {
  fr: mergeDeep(fr, EXTRA_STRINGS.fr || {}),
  en: mergeDeep(en, EXTRA_STRINGS.en || {}),
};

const STORAGE_KEY = 'pdc-lang';
const LangContext = createContext(null);

function getInitialLang() {
  if (typeof window === 'undefined') return 'fr';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  return (window.navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
}

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