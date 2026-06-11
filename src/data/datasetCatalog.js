// src/data/datasetCatalog.js
// ============================================================
// CATALOGUE CENTRAL DES JEUX DE DONNÉES — source de vérité unique,
// réutilisable dans toute l'app (page À propos, panneaux « source »…).
// Chaque entrée :
//   id        : clé courte (sert aussi pour l'icône côté UI)
//   labelFr/En: nom du domaine
//   descFr/En : explication courte (<= 100 caractères)
//   official  : OPTIONNEL. `false` = jeu ADDITIONNEL hors liste officielle
//               du concours (carte affichée avec une teinte distincte +
//               badge). Absent ou `true` = jeu officiel du Challenge.
//   sources[] : 1 à 2 sources. La PREMIÈRE est l'origine amont ; la seconde
//               est le LIEN OFFICIEL EXACT du Pacific Data Hub (visualisation
//               .Stat du flux réellement consommé par l'app).
//
// Les liens Pacific Data Hub pointent vers la VISUALISATION OFFICIELLE EXACTE
// de chaque indicateur (fichier DATASET_OFFICIEL_ET_LIEN du Pacific Dataviz
// Challenge 2026). Chaque URL correspond au flux SDMX (DF_*, dq=…) réellement
// consommé par les services de l'app (pdhApi, cielApi, ecoApi, agriApi,
// powerApi, santeApi, vivantApi, syntheseApi, data360Api).
// ============================================================

export const PDH = "https://pacificdata.org";
export const PDH_STAT = "https://stats.pacificdata.org";

// Libellé partagé pour le lien officiel .Stat (origine de diffusion concours).
const PDH_OFFICIAL = "Pacific Data Hub .Stat · jeu officiel du Challenge";

const DATASET_CATALOG = [
  {
    id: "emissions",
    labelFr: "Émissions de GES",
    labelEn: "GHG emissions",
    descFr: "Gaz à effet de serre émis par habitant, par territoire.",
    descEn: "Greenhouse gases emitted per capita, by territory.",
    // App : pdhApi (DF_CLIMATE_CHANGE · GHG_EMI_CAPITA) + data360Api (World Bank, comparaison mondiale).
    sources: [
      { label: "Banque mondiale · World Bank (Data360)", url: "https://data.worldbank.org/indicator/EN.GHG.ALL.PC.CE.AR5" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.GHG_EMI_CAPITA.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "seaLevel",
    labelFr: "Niveau de la mer",
    labelEn: "Sea level",
    descFr: "Anomalie du niveau de la mer mesurée par satellite, par ZEE.",
    descEn: "Satellite-measured sea-level anomaly, per EEZ.",
    // App : pdhApi (DF_CLIMATE_CHANGE · SEA_LVL), syntheseApi.
    sources: [
      { label: "Copernicus C3S", url: "https://cds.climate.copernicus.eu/datasets/satellite-sea-level-global" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.SEA_LVL.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "coastline",
    labelFr: "Trait de côte",
    labelEn: "Coastline",
    descFr: "Recul et avancée annuels du littoral, dérivés du satellite Landsat.",
    descEn: "Annual coastline retreat and growth, derived from Landsat satellite.",
    // App : Act3Territory (coastlineByTerritory). Jeu officiel « Trait de côte » du Challenge.
    sources: [
      { label: "Digital Earth Pacific · SPC-GEM (CC BY-NC)", url: "https://stac-browser.digitalearthpacific.org/collections/dep_ls_coastlines" },
      {
        label: PDH_OFFICIAL,
        url: "https://pacificdata.org/data/dataset/landsat-coastlines",
      },
    ],
  },
  {
    id: "sst",
    labelFr: "Température de la mer",
    labelEn: "Sea temperature",
    descFr: "Anomalie de la température de surface de la mer.",
    descEn: "Sea-surface temperature anomaly.",
    // App : pdhApi (DF_CLIMATE_CHANGE · SST_ANOM), cielApi, syntheseApi.
    sources: [
      { label: "NOAA / NCEI · NOAAGlobalTemp", url: "https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.SST_ANOM.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "rain",
    labelFr: "Précipitations",
    labelEn: "Rainfall",
    descFr: "Anomalie des précipitations vs normale 1991–2020.",
    descEn: "Rainfall anomaly vs the 1991–2020 normal.",
    // App : cielApi (DF_CLIMATE_CHANGE · RAIN_ANOM).
    sources: [
      { label: "NOAA · GPCP v2.3", url: "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.RAIN_ANOM.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "agriculture",
    labelFr: "Production agricole",
    labelEn: "Agricultural output",
    descFr: "Rendements des cultures et de l'élevage, par produit.",
    descEn: "Crop and livestock yields, by product.",
    // App : agriApi (DF_AGRICULTURAL_PRODUCTION, désagrégé).
    sources: [
      { label: "FAO · FAOSTAT", url: "https://www.fao.org/faostat" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_AGRICULTURAL_PRODUCTION&df[ag]=SPC&df[vs]=1.0&av=true&dq=A...&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "landcover",
    labelFr: "Occupation des sols",
    labelEn: "Land cover",
    descFr: "Indice de couverture des sols modifiant le climat (CALCI), base 2015 = 100.",
    descEn: "Climate-altering land cover index (CALCI), 2015 = 100.",
    // App : pdhApi (DF_CLIMATE_CHANGE · ALT_LAND_COVER).
    sources: [
      { label: "FMI · IMF Climate (CALCI, d'après FAO)", url: "https://climatedata.imf.org/pages/climate-and-weather#cc4" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.ALT_LAND_COVER.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "powermix",
    labelFr: "Mix électrique par source",
    labelEn: "Electricity mix by source",
    descFr: "Production d'électricité désagrégée par source (fossile, hydro, solaire, éolien, géothermie, biomasse), en GWh.",
    descEn: "Electricity generation disaggregated by source (fossil, hydro, solar, wind, geothermal, biomass), in GWh.",
    // App : powerApi (DF_POWER_GEN, désagrégé par source).
    sources: [
      { label: "IRENA · via FMI (IMF.STA:RE)", url: "https://data.imf.org/en/datasets/IMF.STA:RE" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_POWER_GEN&df[ag]=SPC&df[vs]=1.0&av=true&dq=A...&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "energy",
    labelFr: "Énergie & électricité",
    labelEn: "Energy & electricity",
    descFr: "Part des renouvelables dans la consommation finale d'énergie.",
    descEn: "Renewables share in final energy consumption.",
    // App : pdhApi (DF_SDG · EG_FEC_RNEW, ODD 7.2.1).
    sources: [
      { label: "ONU · Division de statistique (Energy Balances)", url: "https://unstats.un.org/unsd/energystats" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?pg=0&bp=true&snb=18&df[ds]=ds%3ASPC2&df[id]=DF_SDG&df[ag]=SPC&df[vs]=3.0&dq=A.EG_FEC_RNEW.._T._T._T._T._T._T._Z._T&pd=,&to[TIME_PERIOD]=false&lc=fr",
      },
    ],
  },
  {
    id: "envtaxes",
    labelFr: "Fiscalité environnementale",
    labelEn: "Environmental taxes",
    descFr: "Recettes des taxes environnementales, en % du PIB.",
    descEn: "Environmental tax revenue, as % of GDP.",
    // App : ecoApi (DF_ENV_TAXES, désagrégé).
    sources: [
      { label: "FMI ↠ OCDE", url: "https://climatedata.imf.org" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_ENV_TAXES&df[ag]=SPC&df[vs]=1.0&av=true&dq=A..&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "tourism",
    labelFr: "Tourisme",
    labelEn: "Tourism",
    descFr: "Arrivées de touristes par territoire et par an.",
    descEn: "Tourist arrivals by territory and year.",
    // App : ecoApi (DF_CLIMATE_CHANGE · TRSM_ARR).
    sources: [
      { label: "ONU Tourisme · UN Tourism", url: "https://www.unwto.org" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.TRSM_ARR.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "biodiversity",
    labelFr: "Biodiversité — Liste Rouge",
    labelEn: "Biodiversity — Red List",
    descFr: "Indice Liste Rouge : risque d'extinction des espèces.",
    descEn: "Red List Index: species extinction risk.",
    // App : vivantApi + pdhApi (DF_SDG_15 · ER_RSK_LST), syntheseApi.
    sources: [
      { label: "UICN · IUCN Red List", url: "https://www.iucnredlist.org" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=ds%3ASPC2&df[id]=DF_SDG_15&df[ag]=SPC&df[vs]=3.0&dq=A.ER_RSK_LST.........&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "fisheries",
    labelFr: "Gestion des pêches",
    labelEn: "Fisheries management",
    descFr: "Mesures et arrangements (multi/bilatéraux) de gestion des pêches en place.",
    descEn: "Fisheries management measures and multi/bilateral arrangements in place.",
    // App : vivantApi (DF_CLIMATE_CHANGE · FISH_MNGT_MULT_BILAT_ARGMT) — Act7 « Le vivant ».
    sources: [
      { label: "FAO · FAOLEX (Policies Dataset)", url: "https://www.fao.org/faolex" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_CLIMATE_CHANGE&df[ag]=SPC&df[vs]=1.0&av=true&dq=A.FISH_MNGT_MULT_BILAT_ARGMT.&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "water",
    labelFr: "Eau potable",
    labelEn: "Drinking water",
    descFr: "Part de la population ayant une eau potable gérée en sécurité.",
    descEn: "Share of population with safely managed drinking water.",
    // App : santeApi (DF_SDG_06 · SH_H2O_SAFE), syntheseApi.
    sources: [
      { label: "OMS / UNICEF · JMP", url: "https://washdata.org" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=ds%3ASPC2&df[id]=DF_SDG_06&df[ag]=SPC&df[vs]=3.0&dq=A.SH_H2O_SAFE...._T.....&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "health",
    labelFr: "Santé — tuberculose",
    labelEn: "Health — tuberculosis",
    descFr: "Incidence de la tuberculose pour 100 000 habitants.",
    descEn: "Tuberculosis incidence per 100,000 people.",
    // App : santeApi (DF_SDG_03 · SH_TBS_INCD), syntheseApi.
    sources: [
      { label: "Organisation mondiale de la santé (OMS)", url: "https://www.who.int/data" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=ds%3ASPC2&df[id]=DF_SDG_03&df[ag]=SPC&df[vs]=3.0&dq=A.SH_TBS_INCD.........&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "disasters",
    labelFr: "Catastrophes & population",
    labelEn: "Disasters & population",
    descFr: "Personnes affectées, pertes économiques, démographie.",
    descEn: "People affected, economic losses, demographics.",
    // App : pdhApi (DF_SDG_11 · VC_DSR_AFFCT personnes affectées · VC_DSR_AALT pertes).
    sources: [
      { label: "UNDRR / UNSD · Cadre de Sendai · ODD", url: "https://unstats.un.org/sdgs/dataportal" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=ds%3ASPC2&df[id]=DF_SDG_11&df[ag]=SPC&df[vs]=3.0&dq=A.VC_DSR_AFFCT.........&pd=,&to[TIME_PERIOD]=false&lb=bt&pg=0",
      },
    ],
  },
  {
    id: "population",
    labelFr: "Croissance démographique",
    labelEn: "Population growth",
    descFr: "Taux de croissance annuel de la population, par territoire.",
    descEn: "Annual population growth rate, by territory.",
    // App : pdhApi (DF_NMDI_POP · NMDI0002) — indicateurs minimaux de développement (NMDI).
    sources: [
      { label: "CPS · Division statistique pour le développement (SDD)", url: "https://sdd.spc.int" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?pg=0&snb=11&df[ds]=ds%3ASPC2&df[id]=DF_NMDI_POP&df[ag]=SPC&df[vs]=1.0&dq=A..NMDI0002._T._T._T..&pd=,&to[TIME_PERIOD]=false&lc=fr",
      },
    ],
  },
  {
    id: "meteo",
    labelFr: "Réseau météorologique",
    labelEn: "Weather network",
    descFr: "Stations de surveillance météo opérationnelles.",
    descEn: "Operational weather-monitoring stations.",
    // App : cielApi (DF_METEO_MONITOR_NET, désagrégé).
    sources: [
      { label: "OMM · OSCAR / WMO", url: "https://oscar.wmo.int" },
      {
        label: PDH_OFFICIAL,
        url: "https://stats.pacificdata.org/vis?lc=fr&df[ds]=SPC2&df[id]=DF_METEO_MONITOR_NET&df[ag]=SPC&df[vs]=1.0&av=true&dq=A..&pd=,&to[TIME_PERIOD]=false&pg=0",
      },
    ],
  },
  {
    id: "cyclones",
    labelFr: "Cyclones tropicaux",
    labelEn: "Tropical cyclones",
    // JEU ADDITIONNEL — NE figure PAS dans la liste officielle SPC .Stat du concours.
    // Carte affichée avec une teinte distincte + badge (cf. About.jsx / About.scss).
    // Intégré comme FICHIERS GeoJSON statiques téléchargés (pas d'appel API live) :
    //   • « Historique des trajectoires » (obligatoire) — 1 feature = 1 cyclone
    //   • « Historique des positions »    (optionnel)    — 1 feature = 1 fix horodaté
    official: false,
    descFr: "Trajectoires et positions historiques des cyclones (1977–2024) — fichiers GeoJSON téléchargés depuis Géorep (couches « Historique des trajectoires » et « Historique des positions »).",
    descEn: "Historical cyclone tracks and positions (1977–2024) — GeoJSON files downloaded from Géorep (“Track history” and “Position history” layers).",
    sources: [
      {
        label: "Météo-France · Gouv. Nouvelle-Calédonie (Géorep)",
        url: "https://georep-dtsi-sgt.opendata.arcgis.com/maps/dtsi-sgt::base-de-donn%C3%A9es-cycloniques-pour-la-nouvelle-cal%C3%A9donie-de-m%C3%A9t%C3%A9o-france/about",
      },
      {
        label: "Trajectoires & positions — GeoJSON (CC BY-NC-ND 4.0)",
        url: "https://georep-dtsi-sgt.opendata.arcgis.com/datasets/dtsi-sgt::base-de-donn%C3%A9es-cycloniques-pour-la-nouvelle-cal%C3%A9donie-de-m%C3%A9t%C3%A9o-france/explore",
      },
    ],
  },
];

export function datasetById(id) {
  return DATASET_CATALOG.find((d) => d.id === id) || null;
}

export default DATASET_CATALOG;