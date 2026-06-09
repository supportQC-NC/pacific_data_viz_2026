// src/data/datasetCatalog.js
// ============================================================
// CATALOGUE CENTRAL DES JEUX DE DONNÉES — source de vérité unique,
// réutilisable dans toute l'app (page À propos, panneaux « source »…).
// Chaque entrée :
//   id        : clé courte (sert aussi pour l'icône côté UI)
//   labelFr/En: nom du domaine
//   descFr/En : explication courte (<= 100 caractères)
//   sources[] : 1 à 2 sources. La PREMIÈRE est obligatoire (origine) ;
//               la seconde (accès Pacific Data Hub) est optionnelle.
// ============================================================

export const PDH = "https://pacificdata.org";
export const PDH_STAT = "https://stats.pacificdata.org";

const DATASET_CATALOG = [
  {
    id: "emissions",
    labelFr: "Émissions de GES",
    labelEn: "GHG emissions",
    descFr: "Gaz à effet de serre émis par habitant, par territoire.",
    descEn: "Greenhouse gases emitted per capita, by territory.",
    sources: [
      { label: "Banque mondiale · World Bank", url: "https://data.worldbank.org" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "seaLevel",
    labelFr: "Niveau de la mer",
    labelEn: "Sea level",
    descFr: "Anomalie du niveau de la mer mesurée par satellite, par ZEE.",
    descEn: "Satellite-measured sea-level anomaly, per EEZ.",
    sources: [
      { label: "Copernicus C3S", url: "https://cds.climate.copernicus.eu/datasets/satellite-sea-level-global" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "coastline",
    labelFr: "Trait de côte",
    labelEn: "Coastline",
    descFr: "Recul et avancée annuels du littoral, dérivés du satellite Landsat.",
    descEn: "Annual coastline retreat and growth, derived from Landsat satellite.",
    sources: [
      { label: "Digital Earth Pacific · SPC-GEM (CC BY-NC)", url: "https://stac-browser.digitalearthpacific.org/collections/dep_ls_coastlines" },
    ],
  },
  {
    id: "sst",
    labelFr: "Température de la mer",
    labelEn: "Sea temperature",
    descFr: "Anomalie de la température de surface de la mer.",
    descEn: "Sea-surface temperature anomaly.",
    sources: [
      { label: "Copernicus C3S", url: "https://cds.climate.copernicus.eu" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "rain",
    labelFr: "Précipitations",
    labelEn: "Rainfall",
    descFr: "Anomalie des précipitations vs normale 1991–2020.",
    descEn: "Rainfall anomaly vs the 1991–2020 normal.",
    sources: [
      { label: "SPC · Climate Change", url: PDH_STAT },
    ],
  },
  {
    id: "agriculture",
    labelFr: "Production agricole",
    labelEn: "Agricultural output",
    descFr: "Rendements des cultures et de l'élevage, par produit.",
    descEn: "Crop and livestock yields, by product.",
    sources: [
      { label: "SPC · Agricultural Production", url: PDH_STAT },
      { label: "FAO · FAOSTAT", url: "https://www.fao.org/faostat" },
    ],
  },
  {
    id: "landcover",
    labelFr: "Occupation des sols",
    labelEn: "Land cover",
    descFr: "Indice de couverture des sols modifiant le climat (CALCI), base 2015 = 100.",
    descEn: "Climate-altering land cover index (CALCI), 2015 = 100.",
    sources: [
      { label: "FMI · IMF Climate (CALCI, d'après FAO)", url: "https://climatedata.imf.org/pages/climate-and-weather#cc4" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "powermix",
    labelFr: "Mix électrique par source",
    labelEn: "Electricity mix by source",
    descFr: "Production d'électricité désagrégée par source (fossile, hydro, solaire, éolien, géothermie, biomasse), en GWh.",
    descEn: "Electricity generation disaggregated by source (fossil, hydro, solar, wind, geothermal, biomass), in GWh.",
    sources: [
      { label: "IRENA · via FMI (IMF.STA:RE)", url: "https://data.imf.org/en/datasets/IMF.STA:RE" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "biodiversity",
    labelFr: "Biodiversité — Liste Rouge",
    labelEn: "Biodiversity — Red List",
    descFr: "Indice Liste Rouge : risque d'extinction des espèces.",
    descEn: "Red List Index: species extinction risk.",
    sources: [
      { label: "UICN · IUCN Red List", url: "https://www.iucnredlist.org" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "water",
    labelFr: "Eau potable",
    labelEn: "Drinking water",
    descFr: "Part de la population ayant une eau potable gérée en sécurité.",
    descEn: "Share of population with safely managed drinking water.",
    sources: [
      { label: "OMS / UNICEF · JMP", url: "https://washdata.org" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "health",
    labelFr: "Santé — tuberculose",
    labelEn: "Health — tuberculosis",
    descFr: "Incidence de la tuberculose pour 100 000 habitants.",
    descEn: "Tuberculosis incidence per 100,000 people.",
    sources: [
      { label: "Organisation mondiale de la santé (OMS)", url: "https://www.who.int/data" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "disasters",
    labelFr: "Catastrophes & population",
    labelEn: "Disasters & population",
    descFr: "Personnes affectées, pertes économiques, démographie.",
    descEn: "People affected, economic losses, demographics.",
    sources: [
      { label: "UNSD · SDG Indicators", url: "https://unstats.un.org/sdgs/dataportal" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "tourism",
    labelFr: "Tourisme",
    labelEn: "Tourism",
    descFr: "Arrivées de touristes par territoire et par an.",
    descEn: "Tourist arrivals by territory and year.",
    sources: [
      { label: "ONU Tourisme · UN Tourism", url: "https://www.unwto.org" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "energy",
    labelFr: "Énergie & électricité",
    labelEn: "Energy & electricity",
    descFr: "Production d'électricité et part des renouvelables.",
    descEn: "Electricity generation and renewables share.",
    sources: [
      { label: "IRENA · FMI", url: "https://www.irena.org" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "envtaxes",
    labelFr: "Fiscalité environnementale",
    labelEn: "Environmental taxes",
    descFr: "Recettes des taxes environnementales, en % du PIB.",
    descEn: "Environmental tax revenue, as % of GDP.",
    sources: [
      { label: "OCDE · FMI", url: "https://www.oecd.org" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "meteo",
    labelFr: "Réseau météorologique",
    labelEn: "Weather network",
    descFr: "Stations de surveillance météo opérationnelles.",
    descEn: "Operational weather-monitoring stations.",
    sources: [
      { label: "OMM · OSCAR / WMO", url: "https://oscar.wmo.int" },
      { label: "Pacific Data Hub .Stat", url: PDH_STAT },
    ],
  },
  {
    id: "cyclones",
    labelFr: "Cyclones tropicaux",
    labelEn: "Tropical cyclones",
    // NB : jeu de données figé, intégré comme FICHIER GeoJSON statique téléchargé
    // (pas d'appel API en direct). Couche « Historique des trajectoires ».
    descFr: "Trajectoires historiques des cyclones (1977–2024) — fichier GeoJSON statique téléchargé depuis Géorep.",
    descEn: "Historical cyclone tracks (1977–2024) — static GeoJSON file downloaded from Géorep.",
    sources: [
      {
        label: "Météo-France · Gouv. Nouvelle-Calédonie (Géorep)",
        url: "https://georep-dtsi-sgt.opendata.arcgis.com/maps/63e27e6671324498838e4944035a3cc0/about",
      },
      {
        label: "Géorep · Téléchargement GeoJSON (CC BY-NC-ND 4.0)",
        url: "https://georep-dtsi-sgt.opendata.arcgis.com/datasets/dtsi-sgt::base-de-donn%C3%A9es-cycloniques-pour-la-nouvelle-cal%C3%A9donie-de-m%C3%A9t%C3%A9o-france/explore?layer=1",
      },
    ],
  },
];

export function datasetById(id) {
  return DATASET_CATALOG.find((d) => d.id === id) || null;
}

export default DATASET_CATALOG;