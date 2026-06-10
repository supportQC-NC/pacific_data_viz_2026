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

  rain: {
    fr: {
      provider: "NOAA — Global Precipitation Climatology Project (GPCP) v2.3, Monthly CDR · diffusion Pacific Data Hub (.Stat), SPC",
      dataset: "Anomalies des précipitations — jeu officiel du Challenge",
      frequency: "Annuelle (totaux sommés du mensuel)",
      updated: "2026-02-03",
      license: "Creative Commons CC0",
      method:
        "Précipitations mensuelles GPCP v2.3 (grille 2,5° × 2,5°, NetCDF) téléchargées depuis les serveurs NOAA. Géométries des pays traversant la ligne de changement de date converties en longitude 0–360° (terra::geom()). Valeurs mensuelles sommées en totaux annuels par pays ; la moyenne de la période de référence 1991–2020 (standard OMM en vigueur) est calculée pour chaque pays, et l'anomalie = total annuel − moyenne de référence, en mm. L'erreur standard des précipitations mensuelles au sein de chaque année sert de métrique d'incertitude. Les cellules sont désagrégées spatialement pour mieux épouser les côtes, en supposant l'homogénéité au sein des cellules d'origine. De notre côté : reformatage uniquement.",
      example:
        "Wallis-et-Futuna : −20,5 en 1998 (année plus sèche que la référence 1991–2020) ; +15 en 2017 (plus humide).",
      link: "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly",
    },
    en: {
      provider: "NOAA — Global Precipitation Climatology Project (GPCP) v2.3, Monthly CDR · disseminated by the Pacific Data Hub (.Stat), SPC",
      dataset: "Rainfall anomalies — official Challenge dataset",
      frequency: "Annual (totals summed from monthly)",
      updated: "2026-02-03",
      license: "Creative Commons CC0",
      method:
        "GPCP v2.3 monthly precipitation (2.5° × 2.5° grid, NetCDF) downloaded from NOAA servers. Country geometries crossing the date line converted to 0–360° longitude (terra::geom()). Monthly values summed to annual totals per country; the 1991–2020 reference-period mean (current WMO standard) is computed for each country, and the anomaly = annual total − reference mean, in mm. The standard error of monthly precipitation within each year serves as the uncertainty metric. Cells are spatially disaggregated to better fit coastlines, assuming homogeneity within original cells. On our side: reformatting only.",
      example:
        "Wallis and Futuna: −20.5 in 1998 (a drier year than the 1991–2020 reference); +15 in 2017 (wetter).",
      link: "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly",
    },
  },

  landTemp: {
    fr: {
      provider: "NOAA / NCEI — NOAAGlobalTemp v6.0.0 · diffusion Pacific Data Hub (.Stat), SPC",
      dataset: "Anomalies des températures de surface (terrestre, 2 m) — jeu officiel du Challenge",
      frequency: "Annuelle (agrégée du mensuel)",
      updated: "2026-01-12",
      license: "Creative Commons CC0",
      method:
        "Anomalies relatives à la normale climatologique 1971–2000 (NOAAGlobalTemp v6.0.0, résolution native 5° × 5°). L'indicateur mesure la température de surface terrestre à 2 m au-dessus du sol. Géométries converties en longitude 0–360° (convention NetCDF, ligne de changement de date) ; raster grossier désagrégé spatialement pour s'aligner aux frontières des pays et aux côtes — sans augmenter la résolution intrinsèque (homogénéité thermique supposée dans chaque cellule d'origine). Seules les cellules terrestres intersectant les polygones de pays sont conservées. Anomalies mensuelles extraites en moyennes spatiales par pays puis agrégées en moyennes annuelles ; l'erreur type est la métrique d'incertitude. Les périodes anciennes (XIXᵉ siècle) reposent sur une reconstruction statistique à incertitude plus élevée. De notre côté : reformatage uniquement.",
      example:
        "Tokelau : −0,94 °C en 1890 (surface plus fraîche que la normale 1971–2000) ; +0,83 °C en 2024 (plus chaude que la normale).",
      link: "https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp",
    },
    en: {
      provider: "NOAA / NCEI — NOAAGlobalTemp v6.0.0 · disseminated by the Pacific Data Hub (.Stat), SPC",
      dataset: "Surface temperature anomalies (land, 2 m) — official Challenge dataset",
      frequency: "Annual (aggregated from monthly)",
      updated: "2026-01-12",
      license: "Creative Commons CC0",
      method:
        "Anomalies relative to the 1971–2000 climatological normal (NOAAGlobalTemp v6.0.0, native 5° × 5° resolution). The indicator measures land surface temperature at 2 m above the surface. Geometries converted to 0–360° longitude (NetCDF convention, date line); the coarse raster is spatially disaggregated to align with country borders and coastlines — without increasing intrinsic resolution (thermal homogeneity assumed within original cells). Only land cells intersecting country polygons are kept. Monthly anomalies extracted as per-country spatial means then aggregated to annual means; a standard error is the uncertainty metric. Early periods (19th century) rest on statistical reconstruction with higher uncertainty. On our side: reformatting only.",
      example:
        "Tokelau: −0.94 °C in 1890 (land surface cooler than the 1971–2000 normal); +0.83 °C in 2024 (warmer than the normal).",
      link: "https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp",
    },
  },

  meteo: {
    fr: {
      provider: "OMM — base de données OSCAR · diffusion Pacific Data Hub (.Stat), SPC",
      dataset: "Réseau de surveillance météorologique — jeu officiel du Challenge",
      frequency: "Annuelle (cumul des stations opérationnelles)",
      updated: "2025-09-09",
      license: "CC BY-SA 4.0",
      method:
        "Seules les stations classées opérationnelles sont conservées ; les statuts « Silent » et « Unknown » sont exclus. Les années d'opération sont extraites des dates d'établissement et de fermeture ; lorsque la fermeture est manquante et la station évaluée opérationnelle, l'année courante sert de date de fin. Pour chaque station, l'indicateur augmente de 1 par année entre l'établissement et la fermeture (ou le présent). Calculé en décompte total et désagrégé par type de station, pour différencier les capacités de surveillance. Le filtrage conservateur peut sous-estimer le nombre total de stations mais assure la robustesse des données. De notre côté : reformatage uniquement.",
      example:
        "Samoa : 1 station météorologique en 1889 ; 4 stations en 2025.",
      link: "https://oscar.wmo.int/surface/#/",
    },
    en: {
      provider: "WMO — OSCAR database · disseminated by the Pacific Data Hub (.Stat), SPC",
      dataset: "Weather monitoring network — official Challenge dataset",
      frequency: "Annual (cumulative operational stations)",
      updated: "2025-09-09",
      license: "CC BY-SA 4.0",
      method:
        "Only stations classed as operational are kept; “Silent” and “Unknown” reporting statuses are excluded. Years of operation are extracted from establishment and closure dates; when closure is missing and the station is assessed operational, the current year serves as the end date. For each station, the indicator increases by 1 for each year between establishment and closure (or the present). Computed as a total count and disaggregated by station type, to differentiate monitoring capacities. The conservative filtering may understate the total number of stations but ensures data robustness. On our side: reformatting only.",
      example:
        "Samoa: 1 weather station in 1889; 4 stations in 2025.",
      link: "https://oscar.wmo.int/surface/#/",
    },
  },

  agriProduction: {
    fr: {
      provider: "FAO — FAOSTAT, domaine « Cultures et produits de l'élevage » (QCL) · diffusion Pacific Data Hub (.Stat), SPC",
      dataset: "Production et rendements agricoles — jeu officiel du Challenge",
      frequency: "Annuelle (séries depuis 1961)",
      updated: "2026-01-12",
      license: "CC BY 4.0",
      method:
        "Les codes d'articles agrégés sont supprimés avant l'analyse afin d'éviter les doubles comptages, car FAOSTAT inclut à la fois les cultures composantes et leurs totaux agrégés (par exemple « Céréales primaires » ou « Fruits primaires »). Conformément à la méthodologie de la FAO, le rendement total des cultures = somme de la production de l'ensemble des cultures ÷ superficie totale récoltée, en kg/ha ; le rendement total de l'élevage = somme de la production des produits d'élevage retenus ÷ nombre total d'animaux producteurs, en kg/animal. Dans l'application, la vue d'ensemble par territoire affiche la MÉDIANE des rendements par culture (même poids pour chaque culture) — un choix de lecture qui diffère du rendement total FAO pondéré par les surfaces, assumé et documenté ; les vues par culture montrent la donnée telle quelle. De notre côté : reformatage uniquement, aucun lissage ni comblement.",
      example:
        "Tonga : 6 114 kg/ha en 2002 → 7 325 kg/ha en 2022 (rendements en hausse sur la période). Kiribati, élevage : 1 460 kg/animal en 1962 → 2 508 kg/animal en 2024.",
      link: "https://www.fao.org/faostat/en/#data/QCL/metadata",
    },
    en: {
      provider: "FAO — FAOSTAT, “Crops and livestock products” domain (QCL) · disseminated by the Pacific Data Hub (.Stat), SPC",
      dataset: "Agricultural production and yields — official Challenge dataset",
      frequency: "Annual (series since 1961)",
      updated: "2026-01-12",
      license: "CC BY 4.0",
      method:
        "Aggregate item codes are removed before analysis to avoid double counting, since FAOSTAT includes both component crops and their aggregate totals (e.g. “Cereals, primary” or “Fruit, primary”). Following FAO methodology, total crop yield = sum of production of all crops ÷ total harvested area, in kg/ha; total livestock yield = sum of production of retained livestock products ÷ total producing animals, in kg/animal. In the app, the per-territory overview shows the MEDIAN of per-crop yields (equal weight per crop) — a reading choice that differs from FAO's area-weighted total yield, owned and documented; per-crop views show the data as is. On our side: reformatting only, no smoothing or filling.",
      example:
        "Tonga: 6,114 kg/ha in 2002 → 7,325 kg/ha in 2022 (yields rising over the period). Kiribati, livestock: 1,460 kg/animal in 1962 → 2,508 kg/animal in 2024.",
      link: "https://www.fao.org/faostat/en/#data/QCL/metadata",
    },
  },

  landCover: {
    fr: {
      provider: "FMI — portail Climate Data, à partir des données de couverture terrestre de la FAO · diffusion Pacific Data Hub (.Stat), SPC",
      dataset: "Indice de couverture des sols modifiant le climat (CALCI) — jeu officiel du Challenge",
      frequency: "Annuelle (séries depuis 1992)",
      updated: "2026-01-11",
      license: "Non précisée sur la fiche consultée — à confirmer auprès du Pacific Data Hub / FMI",
      method:
        "Le jeu brut contient plusieurs catégories de couverture terrestre ; seul l'indicateur agrégé « Climate Altering Land Cover Index » est conservé (les classifications individuelles sont exclues), puis les données sont passées du format large (années en colonnes) au format long (observations pays-année). L'indice utilise 2015 comme année de référence : il vaut 100 pour tous les pays en 2015 et se lit comme un écart à cette référence — pas comme une superficie. Tous les calculs sont effectués par le FMI ; certaines valeurs peuvent être estimées par le FMI. De notre côté : reformatage uniquement.",
      example:
        "Tonga : 91,88 en 2006 — la superficie concernée représentait 91,88 % de celle observée en 2015 (année de référence) ; 100 en 2022 — superficie identique à celle de 2015.",
      link: "https://climatedata.imf.org/pages/climate-and-weather#cc4",
    },
    en: {
      provider: "IMF — Climate Data portal, from FAO land-cover data · disseminated by the Pacific Data Hub (.Stat), SPC",
      dataset: "Climate Altering Land Cover Index (CALCI) — official Challenge dataset",
      frequency: "Annual (series since 1992)",
      updated: "2026-01-11",
      license: "Not stated on the consulted record — to be confirmed with the Pacific Data Hub / IMF",
      method:
        "The raw dataset holds several land-cover categories; only the aggregate “Climate Altering Land Cover Index” is kept (individual classifications excluded), and the data is reshaped from wide (years as columns) to long (country-year observations). The index uses 2015 as its reference year: it equals 100 for every country in 2015 and reads as a gap to that reference — not as an area. All computations are made by the IMF; some values may be IMF-estimated. On our side: reformatting only.",
      example:
        "Tonga: 91.88 in 2006 — the area concerned was 91.88% of that observed in 2015 (reference year); 100 in 2022 — identical to the 2015 area.",
      link: "https://climatedata.imf.org/pages/climate-and-weather#cc4",
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
      provider: "NOAA / NCEI — IBTrACS v04r01 (International Best Track Archive for Climate Stewardship), archive cyclonique officielle de l'OMM (World Data Center for Meteorology)",
      dataset: "Trajectoires et positions des phénomènes tropicaux — zone d'alerte de la Nouvelle-Calédonie (jeu additionnel ouvert)",
      frequency: "Par phénomène (fixes tri-horaires à 6 h) · saisons 1977/1978 → aujourd'hui",
      updated: "",
      license: "Domaine public — données du gouvernement des États-Unis, sans restriction d'usage (conforme à la définition des données ouvertes de l'art. 2 du règlement)",
      method:
        "Archive mondiale IBTrACS, qui intègre pour le Pacifique Sud la base SPEArTC (Diamond, Lorrey, Knapp & Levinson, 2012, Int. J. Climatol. 32 : 2240–2250, DOI 10.1002/joc.2412) — la même généalogie que la base cyclonique de Météo-France Nouvelle-Calédonie. Notre périmètre reprend exactement celui de l'acte d'origine : phénomènes dont au moins un fix traverse la zone d'alerte [25°S ; 13°S] × [158°E ; 172°E] (trajectoire complète conservée), saisons ≥ 1977/1978 — seuil justifié par le satellite Himawari-1 (lancé le 14/07/1977), première couverture spatiale tri-horaire du Pacifique sud-ouest. Vent : WMO_WIND uniquement (vent moyen 10 min du RSMC responsable) ; valeur absente → absente, jamais estimée. Pression : WMO_PRES. Seuls les tracés « main » sont conservés (branches « spur » exclues). Transformation assumée par nous : IBTrACS ne fournit pas de libellés de stade — ils sont dérivés du vent 10 min selon le barème officiel de la zone (< 34 kt dépression tropicale faible · 34–47 modérée · 48–63 forte · 64–89 cyclone tropical · 90–115 intense · ≥ 116 très intense). Ce reclassement est la seule différence de méthode avec la base Météo-France NC (CC BY-NC-ND), écartée pour conformité à l'exigence de données ouvertes du concours.",
      example:
        "Un phénomène dont le vent maximal observé atteint 120 nœuds (≈ 222 km/h) est classé « Cyclone tropical très intense » ; un fix à 70 nœuds le long de la même trajectoire est, lui, au stade « Cyclone tropical » à cet instant.",
      link: "https://www.ncei.noaa.gov/products/international-best-track-archive",
    },
    en: {
      provider: "NOAA / NCEI — IBTrACS v04r01 (International Best Track Archive for Climate Stewardship), the WMO official tropical-cyclone archive (World Data Center for Meteorology)",
      dataset: "Tracks and positions of tropical systems — New Caledonia alert zone (open additional dataset)",
      frequency: "Per system (3-to-6-hourly fixes) · seasons 1977/1978 → present",
      updated: "",
      license: "Public domain — U.S. Government data, no usage restriction (meets the open-data definition of art. 2 of the contest rules)",
      method:
        "The global IBTrACS archive, which for the South Pacific integrates the SPEArTC database (Diamond, Lorrey, Knapp & Levinson, 2012, Int. J. Climatol. 32: 2240–2250, DOI 10.1002/joc.2412) — the same lineage as Météo-France New Caledonia's cyclone database. Our scope reproduces the original act exactly: systems with at least one fix crossing the alert zone [25°S; 13°S] × [158°E; 172°E] (full track kept), seasons ≥ 1977/1978 — a threshold justified by the Himawari-1 satellite (launched 14 July 1977), the first three-hourly space coverage of the southwest Pacific. Wind: WMO_WIND only (10-min mean wind from the responsible RSMC); missing value → missing, never estimated. Pressure: WMO_PRES. Only “main” tracks are kept (“spur” branches excluded). A transformation we own: IBTrACS provides no stage labels — they are derived from the 10-min wind using the official scale in force in the area (< 34 kt weak tropical depression · 34–47 moderate · 48–63 severe · 64–89 tropical cyclone · 90–115 intense · ≥ 116 very intense). This reclassification is the only methodological difference from the Météo-France NC base (CC BY-NC-ND), set aside to comply with the contest's open-data requirement.",
      example:
        "A system whose maximum observed wind reaches 120 knots (≈ 222 km/h) is classed “Very intense tropical cyclone”; a 70-knot fix along the same track is, at that moment, at the “Tropical cyclone” stage.",
      link: "https://www.ncei.noaa.gov/products/international-best-track-archive",
    },
  },
};

export function getDatasetSource(id, lang = "fr") {
  const entry = SOURCES[id];
  if (!entry) return null;
  return entry[lang] || entry.fr || null;
}

export default SOURCES;