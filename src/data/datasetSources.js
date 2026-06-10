// src/data/datasetSources.js
// ============================================================
// Métadonnées de provenance par jeu de données (FR / EN), pour le
// panneau « Source & méthode » du guide de lecture. Contenu éditorial
// (pas d'UI). Champs optionnels : un champ vide n'est pas affiché.
// ============================================================

const SOURCES = {
  emissions: {
    fr: {
      provider: "Banque mondiale — via Pacific Data Hub (.Stat)",
      dataset:
        "Émissions de gaz à effet de serre par habitant — indicateur EN.GHG.ALL.PC.CE.AR5",
      frequency: "Annuelle",
      updated: "2025-10-06",
      license: "CC BY 4.0",
      method:
        "Valeurs annuelles par habitant déjà calculées par la Banque mondiale : l'indicateur ne nécessite aucun calcul supplémentaire au-delà du reformatage. Les années sans donnée pour aucun territoire sont exclues de la structure du jeu. Périmètre : seul le CO₂ est mesuré (pas les six gaz de Kyoto), standardisé en équivalent CO₂ via les potentiels de réchauffement global (PRG) du 5ᵉ rapport d'évaluation du GIEC (AR5). Précision estimée pour la combustion fossile et les procédés industriels : ~10 % au niveau mondial, 4–35 % au niveau national — on lit les tendances et les ordres de grandeur, pas la deuxième décimale.",
      example:
        "En 1970, la Papouasie-Nouvelle-Guinée affichait 0,7767 t CO₂e par habitant ; en 2023, 0,9279 t — soit environ 0,93 tonne d'équivalent CO₂ par personne.",
      link: "https://data.worldbank.org/indicator/EN.GHG.ALL.PC.CE.AR5",
    },
    en: {
      provider: "World Bank — via Pacific Data Hub (.Stat)",
      dataset:
        "Greenhouse gas emissions per capita — indicator EN.GHG.ALL.PC.CE.AR5",
      frequency: "Annual",
      updated: "2025-10-06",
      license: "CC BY 4.0",
      method:
        "Annual per-capita values already computed by the World Bank: the indicator requires no calculation beyond reformatting. Years with no data for any territory are excluded from the dataset's structure. Scope: only CO₂ is measured (not the six Kyoto gases), standardised to CO₂-equivalent using the IPCC 5th Assessment Report (AR5) global-warming potentials. Estimated precision for fossil-fuel combustion and industrial processes: ~10% globally, 4–35% nationally — we read trends and orders of magnitude, not the second decimal.",
      example:
        "In 1970, Papua New Guinea recorded 0.7767 t CO₂e per capita; by 2023, 0.9279 t — roughly 0.93 tonne of CO₂-equivalent per person.",
      link: "https://data.worldbank.org/indicator/EN.GHG.ALL.PC.CE.AR5",
    },
  },

  population: {
    fr: {
      provider: "CPS — Division statistique pour le développement · diffusion Pacific Data Hub (.Stat)",
      dataset: "Croissance démographique — jeu officiel du Challenge",
      frequency: "Annuelle (recensements tous les 5 à 10 ans, complétés par modèles et projections)",
      updated: "",
      license: "",
      method:
        "Taux de croissance démographique total : rythme auquel une population augmente (ou diminue) durant une année, accroissement naturel et solde migratoire compris. Formule : [naissances − décès + solde migratoire] / population totale × 100, en %, tous âges confondus. Sources privilégiées : recensements (deux collectes) ; entre deux recensements, les valeurs annuelles s'appuient sur des modèles et projections démographiques — une précision à garder en tête en lisant les variations fines. Sert notamment de base au calcul du temps de doublement de la population et aux plans nationaux de développement.",
      example: "Un taux de 0 % = population stable ; −1 % = un territoire qui perd 1 % de ses habitants dans l'année, émigration comprise.",
      link: "https://stats.pacificdata.org",
    },
    en: {
      provider: "SPC — Statistics for Development Division · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "Population growth — official Challenge dataset",
      frequency: "Annual (censuses every 5 to 10 years, completed by models and projections)",
      updated: "",
      license: "",
      method:
        "Total population growth rate: the pace at which a population grows (or declines) over a year, natural increase and net migration included. Formula: [births − deaths + net migration] / total population × 100, in %, all ages. Preferred sources: censuses (two collections); between censuses, annual values rest on demographic models and projections — worth keeping in mind when reading fine variations. Serves notably as the basis for population doubling-time calculations and national development plans.",
      example: "A rate of 0% = stable population; −1% = a territory losing 1% of its inhabitants within the year, emigration included.",
      link: "https://stats.pacificdata.org",
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
      provider: "NOAA / NCEI — NOAAGlobalTemp v6.0.0 · diffusion Pacific Data Hub (.Stat), SPC",
      dataset:
        "Anomalies de la température de surface de la mer (moyenne par ZEE) — jeu officiel du Challenge",
      frequency: "Annuelle (agrégée du mensuel)",
      updated: "2026-01-12",
      license: "Creative Commons CC0",
      method:
        "Anomalies relatives à la normale climatologique 1971–2000 (NOAAGlobalTemp v6.0.0, résolution native 5° × 5°). Les géométries ZEE et terres sont converties en longitude 0–360° (convention NetCDF pour les régions traversant la ligne de changement de date) ; le raster grossier est désagrégé spatialement (clonage des valeurs vers une grille plus fine) pour mieux s'aligner aux ZEE et aux côtes — sans augmenter la résolution intrinsèque : l'homogénéité thermique est supposée dans chaque cellule d'origine. Terres masquées (rastérisation conservatrice, pouvant exclure certaines zones littorales aux côtes complexes), cellules océaniques restreintes aux ZEE. Anomalies mensuelles extraites en moyennes spatiales par ZEE puis agrégées en moyennes annuelles ; l'erreur type est calculée comme métrique d'incertitude. Les périodes anciennes (XIXᵉ siècle) reposent sur une reconstruction statistique à incertitude plus élevée. De notre côté : reformatage uniquement — aucun lissage, aucune correction, aucun comblement.",
      example:
        "ZEE de Palau : −0,35 °C en 1991 (surface plus fraîche que la normale 1971–2000) ; +0,92 °C en 2025 (plus chaude que la normale).",
      link: "https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp",
    },
    en: {
      provider: "NOAA / NCEI — NOAAGlobalTemp v6.0.0 · disseminated by the Pacific Data Hub (.Stat), SPC",
      dataset:
        "Sea-surface temperature anomalies (EEZ spatial mean) — official Challenge dataset",
      frequency: "Annual (aggregated from monthly)",
      updated: "2026-01-12",
      license: "Creative Commons CC0",
      method:
        "Anomalies relative to the 1971–2000 climatological normal (NOAAGlobalTemp v6.0.0, native 5° × 5° resolution). EEZ and land geometries are converted to 0–360° longitude (NetCDF convention for regions crossing the date line); the coarse raster is spatially disaggregated (cell values cloned to a finer grid) to better align with EEZ boundaries and coastlines — without increasing intrinsic resolution: thermal homogeneity is assumed within each original cell. Land is masked (conservative rasterisation, which may exclude some littoral zones around complex coasts), and ocean cells are restricted to EEZ limits. Monthly anomalies are extracted as EEZ spatial means then aggregated to annual means; a standard error is computed as the uncertainty metric. Early periods (19th century) rely on statistical reconstruction with higher uncertainty. On our side: reformatting only — no smoothing, no correction, no filling.",
      example:
        "Palau EEZ: −0.35 °C in 1991 (surface cooler than the 1971–2000 normal); +0.92 °C in 2025 (warmer than the normal).",
      link: "https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp",
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

  cyclones: {
    fr: {
      provider: "Météo-France · Gouvernement de la Nouvelle-Calédonie (plateforme Géorep)",
      dataset:
        "Base de données cycloniques pour la Nouvelle-Calédonie — couche « Historique des trajectoires » (depuis 1840 ; phénomènes documentés ici 1977/78 → 2023/24)",
      frequency: "Par saison cyclonique (jeu figé)",
      updated: "2026-05-04",
      license: "CC BY-NC-ND 4.0",
      method:
        "FICHIER STATIQUE TÉLÉCHARGÉ (GeoJSON), intégré tel quel — aucun appel API en direct. Chaque trajectoire est une ligne (LineString ou MultiLineString lorsqu'elle franchit l'antiméridien ; les segments sont conservés séparés). Le stade affiché vient du libellé officiel `type_max` (dépression tropicale faible/modérée/forte → cyclone tropical/intense/très intense), et non d'un seuil recalculé. Vent max `vmax_traj` en nœuds (déduit de la cohérence interne) ; pression min `pmin_traj` en hPa. Limite : ce fichier ne contient pas le vent/la pression position par position — l'animation trace la trajectoire et séquence les cyclones par date de début. Source d'origine : base SPEArTC (Diamond et al., 2012).",
      example:
        "Saison 1977/1978, cyclone TOM : du 5 au 17 novembre 1977, stade max « dépression tropicale modérée », vent max 44,7 nœuds, pression min 990 hPa.",
      link: "https://georep-dtsi-sgt.opendata.arcgis.com/maps/63e27e6671324498838e4944035a3cc0/about",
    },
    en: {
      provider: "Météo-France · Government of New Caledonia (Géorep platform)",
      dataset:
        "Tropical-cyclone database for New Caledonia — “Track history” layer (since 1840; events documented here 1977/78 → 2023/24)",
      frequency: "Per cyclone season (static dataset)",
      updated: "2026-05-04",
      license: "CC BY-NC-ND 4.0",
      method:
        "STATIC DOWNLOADED FILE (GeoJSON), used as-is — no live API call. Each track is a line (LineString, or MultiLineString when it crosses the antimeridian; segments are kept separate). The stage shown comes from the official `type_max` label (weak/moderate/severe tropical depression → tropical cyclone/intense/very intense), not from a recomputed threshold. Max wind `vmax_traj` in knots (inferred from internal consistency); min pressure `pmin_traj` in hPa. Limit: this file has no per-position wind/pressure — the animation draws the track and sequences cyclones by start date. Original source: SPEArTC archive (Diamond et al., 2012).",
      example:
        "Season 1977/1978, cyclone TOM: 5–17 November 1977, peak stage “moderate tropical depression”, max wind 44.7 knots, min pressure 990 hPa.",
      link: "https://georep-dtsi-sgt.opendata.arcgis.com/maps/63e27e6671324498838e4944035a3cc0/about",
    },
  },
};

export function getDatasetSource(id, lang = "fr") {
  const entry = SOURCES[id];
  if (!entry) return null;
  return entry[lang] || entry.fr || null;
}

export default SOURCES;