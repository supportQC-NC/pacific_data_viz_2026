// src/data/datasetSources.js
// ============================================================
// Métadonnées de provenance par jeu de données (FR / EN), pour le
// panneau « Source & méthode » du guide de lecture. Contenu éditorial
// (pas d'UI). Champs optionnels : un champ vide n'est pas affiché.
// ============================================================

const SOURCES = {
  emissions: {
    fr: {
      provider: "Banque mondiale",
      dataset: "Émissions de gaz à effet de serre par habitant",
      frequency: "Annuelle",
      updated: "2025-10-06",
      license: "CC BY 4.0",
      method:
        "Valeurs par habitant déjà calculées par la Banque mondiale (simple reformatage). Limite : seul le CO₂ est mesuré (pas les six gaz de Kyoto), standardisé en équivalent CO₂ via les facteurs de réchauffement global du 5ᵉ rapport du GIEC (AR5). Précision estimée ~10 % au niveau mondial, 4–35 % au niveau national.",
      example:
        "En 1970, la Papouasie-Nouvelle-Guinée émettait 0,78 t CO₂e/hab. ; en 2023, environ 0,93 t.",
      link: "",
    },
    en: {
      provider: "World Bank",
      dataset: "Greenhouse gas emissions per capita",
      frequency: "Annual",
      updated: "2025-10-06",
      license: "CC BY 4.0",
      method:
        "Per-capita values already computed by the World Bank (reformatting only). Limit: only CO₂ is measured (not the six Kyoto gases), standardised to CO₂-equivalent using the IPCC AR5 global-warming potentials. Estimated accuracy ~10% globally, 4–35% nationally.",
      example:
        "In 1970 Papua New Guinea emitted 0.78 t CO₂e/capita; by 2023, about 0.93 t.",
      link: "",
    },
  },

  seaLevel: {
    fr: {
      provider: "Service Copernicus sur le changement climatique (C3S)",
      dataset:
        "Niveau de la mer maillé, observations satellitaires (océan mondial)",
      frequency: "Annuelle (agrégée du mensuel)",
      updated: "2026-07-04",
      license: "CC BY",
      method:
        "Anomalie du niveau de la mer (SLA) extraite de fichiers NetCDF (DUACS DT2024) et moyennée dans chaque zone économique exclusive (ZEE). Écart à la référence long terme 1993–2012, en mètres. Les années comptant moins de 12 mois sont signalées incomplètes ; les tendances régionales peuvent s'écarter nettement de la moyenne mondiale.",
      example:
        "Mariannes du Nord : −0,02 m en 1993 (2 cm sous la référence), +0,06 m en 2013 (6 cm au-dessus).",
      link: "https://cds.climate.copernicus.eu/datasets/satellite-sea-level-global?tab=overview",
    },
    en: {
      provider: "Copernicus Climate Change Service (C3S)",
      dataset: "Satellite-observed gridded sea level (global ocean)",
      frequency: "Annual (aggregated from monthly)",
      updated: "2026-07-04",
      license: "CC BY",
      method:
        "Sea-level anomaly (SLA) extracted from NetCDF files (DUACS DT2024) and spatially averaged within each Exclusive Economic Zone (EEZ). Deviation from the 1993–2012 long-term reference, in metres. Years with fewer than 12 months are flagged incomplete; regional trends can differ substantially from the global mean.",
      example:
        "Northern Mariana Islands: −0.02 m in 1993 (2 cm below reference), +0.06 m in 2013 (6 cm above).",
      link: "https://cds.climate.copernicus.eu/datasets/satellite-sea-level-global?tab=overview",
    },
  },

  sst: {
    fr: {
      provider: "",
      dataset: "Anomalie de température de surface de la mer",
      frequency: "Annuelle",
      updated: "",
      license: "",
      method:
        "Écart de la température de surface de la mer par rapport à une période de référence (°C). 0 = la normale ; au-dessus = plus chaud que d'habitude.",
      example: "",
      link: "",
    },
    en: {
      provider: "",
      dataset: "Sea-surface temperature anomaly",
      frequency: "Annual",
      updated: "",
      license: "",
      method:
        "Deviation of sea-surface temperature from a reference period (°C). 0 = normal; above = warmer than usual.",
      example: "",
      link: "",
    },
  },

  disastersAffected: {
    fr: {
      provider: "Division de statistique des Nations unies (UNSD)",
      dataset:
        "Base d'indicateurs ODD — personnes directement affectées par les catastrophes (VC_DSR_AFFCT, cibles 1.5.1 & 11.5.1)",
      frequency: "Annuelle / événementielle",
      updated: "2024-01-19",
      license: "",
      method:
        "Nombre de personnes directement affectées par les catastrophes. Données par événement (pics), non continues. Métadonnées ODD 1.5.1 / 11.5.1.",
      example: "",
      link: "https://unstats.un.org/sdgs/dataportal",
    },
    en: {
      provider: "United Nations Statistics Division (UNSD)",
      dataset:
        "SDG Indicators Database — persons directly affected by disasters (VC_DSR_AFFCT, targets 1.5.1 & 11.5.1)",
      frequency: "Annual / event-based",
      updated: "2024-01-19",
      license: "",
      method:
        "Number of people directly affected by disasters. Event-based (spikes), not continuous. SDG metadata 1.5.1 / 11.5.1.",
      example: "",
      link: "https://unstats.un.org/sdgs/dataportal",
    },
  },
};

export function getDatasetSource(id, lang = "fr") {
  const entry = SOURCES[id];
  if (!entry) return null;
  return entry[lang] || entry.fr || null;
}

export default SOURCES;