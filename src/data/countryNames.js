// src/data/countryNames.js
const COUNTRY_NAMES = {
  CHN: { fr: "Chine", en: "China" },
  USA: { fr: "Etats-Unis", en: "United States" },
  IND: { fr: "Inde", en: "India" },
  RUS: { fr: "Russie", en: "Russia" },
  JPN: { fr: "Japon", en: "Japan" },
  IRN: { fr: "Iran", en: "Iran" },
  DEU: { fr: "Allemagne", en: "Germany" },
  IDN: { fr: "Indonesie", en: "Indonesia" },
  KOR: { fr: "Coree du Sud", en: "South Korea" },
  SAU: { fr: "Arabie saoudite", en: "Saudi Arabia" },
  CAN: { fr: "Canada", en: "Canada" },
  BRA: { fr: "Bresil", en: "Brazil" },
  ZAF: { fr: "Afrique du Sud", en: "South Africa" },
  MEX: { fr: "Mexique", en: "Mexico" },
  TUR: { fr: "Turquie", en: "Turkey" },
  GBR: { fr: "Royaume-Uni", en: "United Kingdom" },
  ITA: { fr: "Italie", en: "Italy" },
  FRA: { fr: "France", en: "France" },
  POL: { fr: "Pologne", en: "Poland" },
  AUS: { fr: "Australie", en: "Australia" },
  NZL: { fr: "Nouvelle-Zelande", en: "New Zealand" },
  VNM: { fr: "Vietnam", en: "Vietnam" },
  THA: { fr: "Thailande", en: "Thailand" },
  EGY: { fr: "Egypte", en: "Egypt" },
  MYS: { fr: "Malaisie", en: "Malaysia" },
  ESP: { fr: "Espagne", en: "Spain" },
};

export function countryName(iso3, lang) {
  const c = COUNTRY_NAMES[iso3];
  if (!c) return iso3;
  return c[lang] || c.fr;
}

export default COUNTRY_NAMES;