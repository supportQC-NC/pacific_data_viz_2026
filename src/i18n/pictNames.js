// src/i18n/pictNames.js
// ============================================================
// Noms complets des pays/territoires du Pacifique par code GEO_PICT (SPC).
// Sert à afficher les noms entiers (pas les acronymes) au survol.
// Filtrer sur ces clés permet aussi d'exclure les agrégats régionaux.
// ============================================================

const PICT_NAMES = {
  AS: { fr: 'Samoa américaines',            en: 'American Samoa' },
  CK: { fr: 'Îles Cook',                    en: 'Cook Islands' },
  FJ: { fr: 'Fidji',                        en: 'Fiji' },
  PF: { fr: 'Polynésie française',          en: 'French Polynesia' },
  GU: { fr: 'Guam',                         en: 'Guam' },
  KI: { fr: 'Kiribati',                     en: 'Kiribati' },
  MH: { fr: 'Îles Marshall',                en: 'Marshall Islands' },
  FM: { fr: 'États fédérés de Micronésie',  en: 'Micronesia (FSM)' },
  NR: { fr: 'Nauru',                        en: 'Nauru' },
  NC: { fr: 'Nouvelle-Calédonie',           en: 'New Caledonia' },
  NU: { fr: 'Niue',                         en: 'Niue' },
  MP: { fr: 'Îles Mariannes du Nord',       en: 'Northern Mariana Islands' },
  PW: { fr: 'Palaos',                       en: 'Palau' },
  PG: { fr: 'Papouasie-Nouvelle-Guinée',    en: 'Papua New Guinea' },
  PN: { fr: 'Pitcairn',                     en: 'Pitcairn' },
  WS: { fr: 'Samoa',                        en: 'Samoa' },
  SB: { fr: 'Îles Salomon',                 en: 'Solomon Islands' },
  TK: { fr: 'Tokelau',                      en: 'Tokelau' },
  TO: { fr: 'Tonga',                        en: 'Tonga' },
  TV: { fr: 'Tuvalu',                       en: 'Tuvalu' },
  VU: { fr: 'Vanuatu',                      en: 'Vanuatu' },
  WF: { fr: 'Wallis-et-Futuna',             en: 'Wallis and Futuna' },
};

export function pictName(code, lang = 'fr') {
  const entry = PICT_NAMES[code];
  return entry ? entry[lang] || entry.fr : code;
}

export function isPict(code) {
  return Object.prototype.hasOwnProperty.call(PICT_NAMES, code);
}

export default PICT_NAMES;