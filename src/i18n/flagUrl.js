// src/i18n/flagUrl.js
// ============================================================
// URL d'un drapeau via flagcdn (CDN libre, domaine public). Les codes PICT
// (GEO_PICT) utilisés dans Datamoana SONT déjà les codes ISO 3166 alpha-2
// (AS, FJ, PF, PW, WF…), donc aucune table de correspondance n'est nécessaire.
// Réutilisable partout : flagUrl("FJ") -> https://flagcdn.com/fj.svg
//   format : "svg" (défaut), "png", "webp"
//   size   : pour le PNG/WEBP, ex. "256x192" -> https://flagcdn.com/256x192/fj.png
// ============================================================

const CDN = "https://flagcdn.com";

export function flagUrl(code, { format = "svg", size = "" } = {}) {
  if (!code) return "";
  const c = String(code).toLowerCase();
  if (format === "svg") return `${CDN}/${c}.svg`;
  return size ? `${CDN}/${size}/${c}.${format}` : `${CDN}/${c}.${format}`;
}

export default flagUrl;