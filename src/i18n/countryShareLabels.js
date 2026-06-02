// src/i18n/countryShareLabels.js
const countryShareLabels = {
  fr: {
    eyebrow: "Comparaison des emissions : Pacifique vs grands emetteurs",
    modePc: "Par habitant",
    modeShare: "Part mondiale",
    leadPc: "Emissions PAR HABITANT (t CO2e/hab). Pacifique (vert) = nos donnees (Pacific Data Hub) ; grands emetteurs (gris) = OWID, pour donner l'echelle.",
    leadShare: "PART dans le CO2 mondial (%). Source OWID pour tous : la part du total mondial se mesure sur les emissions TOTALES, que des donnees par habitant ne suffisent pas a reconstituer seules.",
    story: [
      "Les deux echelles ne racontent pas la meme histoire.",
      "Par habitant, Palaos et la Nouvelle-Caledonie arrivent en tete : une petite population combinee a une industrie tres energivore (fonderies de nickel en Nouvelle-Caledonie, electricite au diesel a Palaos) se traduit par beaucoup d'emissions par personne.",
      "En part mondiale, c'est le TOTAL qui compte (emissions par habitant x population). Avec environ 18 000 habitants, Palaos ne pese que 0,001 %, tandis que la Papouasie-Nouvelle-Guinee, forte de pres de 10 millions d'habitants, arrive premiere du Pacifique a 0,02 % malgre de faibles emissions par tete.",
      "Au final, aucun territoire du Pacifique ne depasse 0,02 % du CO2 mondial : c'est tout le paradoxe.",
    ],
    pacific: "Pacifique",
    rest: "Grands emetteurs (comparaison)",
    loading: "Chargement de la comparaison…",
    empty: "Donnees indisponibles.",
    source: "Par habitant — Pacifique : Pacific Data Hub ; grands emetteurs : OWID. Part mondiale : OWID. Population : ordres de grandeur Banque mondiale / UN. World Bank Data360 / Our World in Data (OWID_CB) — CC BY 4.0.",
  },
  en: {
    eyebrow: "Emissions comparison: Pacific vs major emitters",
    modePc: "Per capita",
    modeShare: "Global share",
    leadPc: "PER-CAPITA emissions (t CO2e/cap). Pacific (green) = our data (Pacific Data Hub); major emitters (grey) = OWID, for scale.",
    leadShare: "SHARE of global CO2 (%). OWID for everyone: a share of the global total is measured on TOTAL emissions, which per-capita data alone cannot reconstruct.",
    story: [
      "The two scales tell different stories.",
      "Per capita, Palau and New Caledonia come out on top: a small population combined with a very energy-intensive industry (nickel smelters in New Caledonia, diesel power in Palau) translates into high emissions per person.",
      "For the global share, the TOTAL is what matters (per-capita emissions x population). With about 18,000 inhabitants, Palau is only 0.001%, whereas Papua New Guinea, home to nearly 10 million people, tops the Pacific at 0.02% despite low per-head emissions.",
      "In the end, no Pacific territory exceeds 0.02% of global CO2 - that is the whole paradox.",
    ],
    pacific: "Pacific",
    rest: "Major emitters (comparison)",
    loading: "Loading comparison…",
    empty: "Data unavailable.",
    source: "Per capita — Pacific: Pacific Data Hub; major emitters: OWID. Global share: OWID. Population: World Bank / UN orders of magnitude. World Bank Data360 / Our World in Data (OWID_CB) — CC BY 4.0.",
  },
};

export default countryShareLabels;