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

  redList: {
    fr: {
      provider: "IUCN & BirdLife International (2020) · indicateur ODD 15.5.1 · diffusion Pacific Data Hub (.Stat, source SPC2)",
      dataset: "Indice Liste Rouge — jeu officiel du Challenge",
      frequency: "Annuelle (1993 →)",
      updated: "",
      license: "À confirmer sur la fiche Pacific Data Hub (indicateur ODD 15.5.1)",
      method:
        "Indice de 0 à 1 résumant le risque d'extinction (catégories de la Liste Rouge de l'IUCN) de l'ensemble des mammifères, oiseaux, amphibiens, coraux et cycas. 1 = aucune extinction attendue ; une valeur plus basse = risque accru. Estimation établie à partir de données locales et nationales, désagrégée à l'échelle nationale et pondérée par la part de l'aire de répartition de chaque espèce dans le pays ou la région. Il s'agit d'une valeur ESTIMÉE et désagrégée, non d'une mesure directe terrain par terrain. De notre côté : reformatage uniquement.",
      example:
        "Papouasie-Nouvelle-Guinée : 0,92 en 1993 (proche de 1, risque estimé faible) ; 0,82 en 2024 (plus bas, risque estimé accru).",
      link: "https://stats.pacificdata.org",
    },
    en: {
      provider: "IUCN & BirdLife International (2020) · SDG indicator 15.5.1 · disseminated by the Pacific Data Hub (.Stat, SPC2 source)",
      dataset: "Red List Index — official Challenge dataset",
      frequency: "Annual (1993 →)",
      updated: "",
      license: "To be confirmed on the Pacific Data Hub record (SDG indicator 15.5.1)",
      method:
        "An index from 0 to 1 summarising the extinction risk (IUCN Red List categories) of all mammals, birds, amphibians, corals and cycads. 1 = no extinction expected; a lower value = higher risk. An estimate built from local and national data, disaggregated to the national scale and weighted by each species's range share in the country or region. It is an ESTIMATED, disaggregated value, not a direct field-by-field measurement. On our side: reformatting only.",
      example:
        "Papua New Guinea: 0.92 in 1993 (close to 1, low estimated risk); 0.82 in 2024 (lower, higher estimated risk).",
      link: "https://stats.pacificdata.org",
    },
  },

  fishMgmt: {
    fr: {
      provider: "FAO — base FAOLEX (législation des pêches), « Policies Dataset » · diffusion Pacific Data Hub (.Stat)",
      dataset: "Mesures de gestion des pêches en vigueur — jeu officiel du Challenge",
      frequency: "Annuelle (décompte cumulatif ; séries dès 1903 pour certains pays)",
      updated: "2025-09-03",
      license: "CC BY-NC-SA 3.0 IGO",
      method:
        "Décompte cumulatif : pour chaque mesure de gestion des pêches adoptée une année donnée, la valeur augmente de 1 cette année-là et toutes les années suivantes jusqu'à aujourd'hui — une mesure reste active tant qu'elle n'est pas explicitement abrogée. L'indicateur est donc cumulatif et croît de façon monotone par construction. L'année retenue est celle du « texte original », à défaut la « date de dernière modification » (estimation conservatrice : la mesure était en place au plus tard à cette date). Valeurs manquantes uniquement avant la première mesure enregistrée d'un pays ; la couverture varie fortement (43,1 % de valeurs manquantes au global). De notre côté : reformatage uniquement.",
      example:
        "Tuvalu : 3 mesures en vigueur en 1976 ; 43 mesures en 2022.",
      link: "https://www.fao.org/faolex/opendata/en/",
    },
    en: {
      provider: "FAO — FAOLEX database (fisheries legislation), “Policies Dataset” · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "Fisheries-management measures in force — official Challenge dataset",
      frequency: "Annual (cumulative count; series from 1903 for some countries)",
      updated: "2025-09-03",
      license: "CC BY-NC-SA 3.0 IGO",
      method:
        "Cumulative count: for each fisheries-management measure adopted in a given year, the value increases by 1 that year and every year after, up to today — a measure stays active until explicitly repealed. The indicator is therefore cumulative and monotonically increasing by construction. The year used is that of the “original text”, failing which the “last modification date” (a conservative estimate: the measure was in place no later than that date). Missing values only before a country's first recorded measure; coverage varies widely (43.1% missing globally). On our side: reformatting only.",
      example:
        "Tuvalu: 3 measures in force in 1976; 43 measures in 2022.",
      link: "https://www.fao.org/faolex/opendata/en/",
    },
  },

  water: {
    fr: {
      provider: "OMS & UNICEF — Programme commun de suivi (JMP) de l'approvisionnement en eau, de l'assainissement et de l'hygiène · indicateur ODD 6.1.1 · diffusion Pacific Data Hub (.Stat)",
      dataset: "Eau potable gérée en sécurité (SH_H2O_SAFE) — jeu officiel du Challenge",
      frequency: "Cycle biennal (estimations annuelles modélisées depuis 2000)",
      updated: "2024-09-27",
      license: "À confirmer sur la fiche Pacific Data Hub (indicateur ODD 6.1.1)",
      method:
        "Part de la population utilisant un service d'eau potable géré en sécurité : source améliorée (eau courante, forages, puits et sources protégés, eau de pluie, kiosques, eau livrée/conditionnée), accessible sur place, disponible au besoin et exempte de contamination fécale et chimique prioritaire. La valeur est ESTIMÉE : le JMP ajuste une régression linéaire à toutes les données disponibles depuis 2000 (recensements, enquêtes ménages, données administratives), y compris pour les années sans relevé. « Géré en sécurité » est pris comme le MINIMUM de trois ratios (accessibilité, disponibilité, qualité) appliqués à la part utilisant une source améliorée ; estimations nationales = moyenne pondérée urbain/rural avec les données de population de la Division de la population de l'ONU. De notre côté : reformatage uniquement.",
      example:
        "Papouasie-Nouvelle-Guinée : d'environ 32 % de la population (2000) à 50 % (2022) — l'accès progresse.",
      link: "https://washdata.org/",
    },
    en: {
      provider: "WHO & UNICEF — Joint Monitoring Programme (JMP) for Water Supply, Sanitation and Hygiene · SDG indicator 6.1.1 · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "Safely managed drinking water (SH_H2O_SAFE) — official Challenge dataset",
      frequency: "Biennial cycle (annual model-based estimates since 2000)",
      updated: "2024-09-27",
      license: "To be confirmed on the Pacific Data Hub record (SDG indicator 6.1.1)",
      method:
        "Share of population using a safely managed drinking water service: an improved source (piped water, boreholes, protected wells and springs, rainwater, kiosks, delivered/packaged water), accessible on premises, available when needed and free from priority faecal and chemical contamination. The value is ESTIMATED: the JMP fits a linear regression to all data available since 2000 (censuses, household surveys, administrative data), including for years without a reading. “Safely managed” is taken as the MINIMUM of three ratios (accessibility, availability, quality) applied to the share using an improved source; national estimates = urban/rural weighted average using UN Population Division data. On our side: reformatting only.",
      example:
        "Papua New Guinea: from about 32% of the population (2000) to 50% (2022) — access improving.",
      link: "https://washdata.org/",
    },
  },

  tb: {
    fr: {
      provider: "OMS — Programme mondial de lutte contre la tuberculose · indicateur ODD 3.3.2 · diffusion Pacific Data Hub (.Stat)",
      dataset: "Incidence de la tuberculose (SH_TBS_INCD) — jeu officiel du Challenge",
      frequency: "Annuelle (estimations depuis 2000)",
      updated: "2026-03-27",
      license: "À confirmer sur la fiche Pacific Data Hub (indicateur ODD 3.3.2)",
      method:
        "Nombre estimé de cas de tuberculose nouveaux et de rechutes (toutes formes, y compris chez les personnes vivant avec le VIH) survenant dans l'année, exprimé pour 100 000 habitants. Valeur ESTIMÉE : la mesure directe exigeant une surveillance de très haute qualité, l'OMS produit le plus souvent des estimations indirectes — notifications ajustées du sous-report et du sous-diagnostic, études d'inventaire avec capture-recapture, enquêtes de prévalence, ou modèles dynamiques (utilisés notamment pour les pays où les notifications ont fortement chuté après 2020, signe de perturbations liées au COVID-19). Des bornes d'incertitude accompagnent chaque estimation ; population de référence : Division de la population de l'ONU. De notre côté : reformatage uniquement.",
      example:
        "Vanuatu : de 110 cas pour 100 000 (2000) à 41 (2023) — l'incidence recule.",
      link: "https://www.who.int/teams/global-tuberculosis-programme/data",
    },
    en: {
      provider: "WHO — Global Tuberculosis Programme · SDG indicator 3.3.2 · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "Tuberculosis incidence (SH_TBS_INCD) — official Challenge dataset",
      frequency: "Annual (estimates since 2000)",
      updated: "2026-03-27",
      license: "To be confirmed on the Pacific Data Hub record (SDG indicator 3.3.2)",
      method:
        "Estimated number of new and relapse tuberculosis cases (all forms, including in people living with HIV) arising in the year, expressed per 100,000 population. An ESTIMATED value: direct measurement requiring very high-quality surveillance, WHO most often produces indirect estimates — notifications adjusted for under-reporting and under-diagnosis, inventory studies with capture-recapture, prevalence surveys, or dynamic models (used notably for countries where notifications dropped sharply after 2020, a sign of COVID-19 disruptions). Uncertainty bounds accompany each estimate; reference population: UN Population Division. On our side: reformatting only.",
      example:
        "Vanuatu: from 110 cases per 100,000 (2000) to 41 (2023) — incidence falling.",
      link: "https://www.who.int/teams/global-tuberculosis-programme/data",
    },
  },

  disastersAffected: {
    fr: {
      provider: "UNDRR — Bureau des Nations Unies pour la réduction des risques de catastrophe · Cadre de Sendai (indicateur B, ODD 11.5.1) · diffusion Pacific Data Hub (.Stat)",
      dataset: "Personnes affectées par les catastrophes (VC_DSR_AFFCT) — jeu officiel du Challenge",
      frequency: "Annuelle (déclaration continue, instantané annuel)",
      updated: "",
      license: "À confirmer sur la fiche Pacific Data Hub (indicateur ODD 11.5.1)",
      method:
        "Nombre de personnes affectées par les catastrophes, déclaré exclusivement par les points focaux nationaux du Cadre de Sendai via le système de suivi (Sendai Framework Monitor) et les bases nationales DesInventar-Sendai. Données de reporting officiel national uniquement. La couverture est inégale : les sources internationales ne recensent souvent que les événements dépassant un certain seuil d'impact, avec des méthodes non uniformes — d'où des séries hétérogènes et de nombreuses années sans donnée. De notre côté : reformatage uniquement, aucune imputation.",
      example:
        "Une case vide ne vaut pas zéro : elle signale qu'aucune valeur n'a été déclarée pour ce pays cette année-là.",
      link: "https://sendaimonitor.undrr.org/",
    },
    en: {
      provider: "UNDRR — United Nations Office for Disaster Risk Reduction · Sendai Framework (indicator B, SDG 11.5.1) · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "People affected by disasters (VC_DSR_AFFCT) — official Challenge dataset",
      frequency: "Annual (continuous reporting, annual snapshot)",
      updated: "",
      license: "To be confirmed on the Pacific Data Hub record (SDG indicator 11.5.1)",
      method:
        "Number of people affected by disasters, reported exclusively by national Sendai Framework focal points through the Sendai Framework Monitor and national DesInventar-Sendai databases. Official national reporting only. Coverage is uneven: international sources often record only events above an impact threshold, with non-uniform methods — hence heterogeneous series and many years without data. On our side: reformatting only, no imputation.",
      example:
        "An empty cell does not mean zero: it signals that no value was reported for that country in that year.",
      link: "https://sendaimonitor.undrr.org/",
    },
  },

  disastersLoss: {
    fr: {
      provider: "UNDRR — Bureau des Nations Unies pour la réduction des risques de catastrophe · Cadre de Sendai (cible C, ODD 11.5.2) · diffusion Pacific Data Hub (.Stat)",
      dataset: "Pertes économiques des catastrophes — perte annuelle moyenne (VC_DSR_AALT) — jeu officiel du Challenge",
      frequency: "Annuelle (déclaration continue, instantané annuel) · disponibilité 2005-2023",
      updated: "2024-12-20",
      license: "À confirmer sur la fiche Pacific Data Hub (indicateur ODD 11.5.2)",
      method:
        "Perte économique DIRECTE attribuée aux catastrophes : valeur monétaire de la destruction totale ou partielle des biens physiques de la zone affectée (logements, écoles, hôpitaux, bâtiments, transports, énergie, télécoms, cultures, bétail, patrimoine culturel…), quasi équivalente aux dommages physiques. Exclut les pertes indirectes (ralentissement économique ultérieur). En US$ courants. Déclaration officielle nationale uniquement (Sendai Framework Monitor + DesInventar-Sendai). L'indicateur cadre 11.5.2 rapporte cette perte au PIB ; la série utilisée ici est la perte annuelle moyenne en dollars. De notre côté : reformatage uniquement.",
      example:
        "Fidji : 141,4 M US$ de perte annuelle moyenne déclarée pour 2011 ; 374,1 M US$ pour 2014.",
      link: "https://www.preventionweb.net/files/54970_collectionoftechnicalguidancenoteso.pdf",
    },
    en: {
      provider: "UNDRR — United Nations Office for Disaster Risk Reduction · Sendai Framework (Target C, SDG 11.5.2) · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "Economic losses from disasters — average annual loss (VC_DSR_AALT) — official Challenge dataset",
      frequency: "Annual (continuous reporting, annual snapshot) · availability 2005-2023",
      updated: "2024-12-20",
      license: "To be confirmed on the Pacific Data Hub record (SDG indicator 11.5.2)",
      method:
        "DIRECT economic loss attributed to disasters: the monetary value of total or partial destruction of physical assets in the affected area (homes, schools, hospitals, buildings, transport, energy, telecoms, crops, livestock, cultural heritage…), nearly equivalent to physical damage. Excludes indirect losses (later economic slowdown). In current US$. Official national reporting only (Sendai Framework Monitor + DesInventar-Sendai). The framework indicator 11.5.2 relates this loss to GDP; the series used here is the average annual loss in dollars. On our side: reformatting only.",
      example:
        "Fiji: US$141.4M average annual loss reported for 2011; US$374.1M for 2014.",
      link: "https://www.preventionweb.net/files/54970_collectionoftechnicalguidancenoteso.pdf",
    },
  },

  renewables: {
    fr: {
      provider: "ONU — Division de statistique (Energy Balances, 2024) · indicateur ODD 7.2.1 · diffusion Pacific Data Hub (.Stat, flux DF_SDG)",
      dataset: "Part des renouvelables dans la consommation finale d'énergie (EG_FEC_RNEW) — jeu officiel du Challenge",
      frequency: "Annuelle (depuis 2000 pour le Pacifique)",
      updated: "",
      license: "À confirmer sur la fiche Pacific Data Hub (indicateur ODD 7.2.1)",
      method:
        "Part (%) de l'énergie renouvelable dans la consommation finale totale d'énergie. Valeur ESTIMÉE à partir des bilans énergétiques de la Division de statistique de l'ONU : c'est un RATIO (énergie renouvelable consommée / consommation finale totale), pas une quantité. Une part peut augmenter même si le volume fossile croît, dès lors que le renouvelable progresse plus vite. L'hydroélectricité, dominante dans plusieurs grands pays, dépend de la pluviométrie — la part peut donc osciller d'une année à l'autre sans changement de politique. De notre côté : reformatage uniquement.",
      example:
        "Fidji : 50,06 % en 2000, 26,67 % en 2022 — l'hydro, sensible à la pluie, fait osciller le ratio.",
      link: "https://stats.pacificdata.org",
    },
    en: {
      provider: "UN — Statistics Division (Energy Balances, 2024) · SDG indicator 7.2.1 · disseminated by the Pacific Data Hub (.Stat, DF_SDG flow)",
      dataset: "Renewables share in final energy consumption (EG_FEC_RNEW) — official Challenge dataset",
      frequency: "Annual (since 2000 for the Pacific)",
      updated: "",
      license: "To be confirmed on the Pacific Data Hub record (SDG indicator 7.2.1)",
      method:
        "Share (%) of renewable energy in total final energy consumption. An ESTIMATED value from the UN Statistics Division energy balances: it is a RATIO (renewable energy consumed / total final consumption), not a quantity. A share can rise even if fossil volume grows, as long as renewables grow faster. Hydropower, dominant in several large countries, depends on rainfall — the share can therefore swing year to year with no policy change. On our side: reformatting only.",
      example:
        "Fiji: 50.06% in 2000, 26.67% in 2022 — hydro, sensitive to rainfall, makes the ratio swing.",
      link: "https://stats.pacificdata.org",
    },
  },

  powerGen: {
    fr: {
      provider: "Communauté du Pacifique (SPC) · jeu « Production d'énergie » (DF_POWER_GEN) · déclaration nationale · diffusion Pacific Data Hub (.Stat)",
      dataset: "Production d'électricité par source — jeu officiel du Challenge",
      frequency: "Annuelle (2000–2023)",
      updated: "",
      license: "À confirmer sur la fiche Pacific Data Hub (jeu DF_POWER_GEN)",
      method:
        "Production d'électricité en gigawattheures (GWh), ventilée par source d'énergie (hydroélectricité, solaire photovoltaïque, éolien terrestre, géothermie, biocombustibles solides/liquides, biogaz, et fossile : pétrole, gaz naturel, charbon) et par statut de raccordement au réseau (connecté, hors-réseau, total). Données déclarées au niveau national. Nous retenons le raccordement « Total » pour éviter les doubles comptages, et classons chaque source en renouvelable ou fossile. De notre côté : reformatage uniquement.",
      example:
        "Le détail par source montre, en GWh, où le solaire et l'éolien gagnent du terrain — par exemple le bond du solaire en Nouvelle-Calédonie sur les dernières années.",
      link: "https://stats.pacificdata.org",
    },
    en: {
      provider: "Pacific Community (SPC) · “Power generation” dataset (DF_POWER_GEN) · national reporting · disseminated by the Pacific Data Hub (.Stat)",
      dataset: "Electricity production by source — official Challenge dataset",
      frequency: "Annual (2000–2023)",
      updated: "",
      license: "To be confirmed on the Pacific Data Hub record (DF_POWER_GEN dataset)",
      method:
        "Electricity production in gigawatt-hours (GWh), broken down by energy source (hydropower, solar PV, onshore wind, geothermal, solid/liquid biofuels, biogas, and fossil: oil, natural gas, coal) and by grid-connection status (on-grid, off-grid, total). Reported at the national level. We keep the “Total” connection to avoid double counting, and classify each source as renewable or fossil. On our side: reformatting only.",
      example:
        "The per-source detail shows, in GWh, where solar and wind gain ground — for example the surge of solar in New Caledonia in recent years.",
      link: "https://stats.pacificdata.org",
    },
  },

  tourism: {
    fr: {
      provider: "ONU Tourisme · base de statistiques du tourisme · diffusion Pacific Data Hub (DF_CLIMATE_CHANGE, TRSM_ARR)",
      dataset: "Arrivées touristiques — jeu officiel du Challenge",
      frequency: "Annuelle",
      updated: "2026-02-23",
      license: "CC-BY",
      method:
        "Effectifs absolus d'arrivées de visiteurs, filtrés sur les pays membres de la CPS et restreints à trois niveaux : total des arrivées, touristes, excursionnistes. Un touriste passe au moins une nuit dans un hébergement collectif ou privé du pays visité ; les visiteurs à la journée (excursionnistes) sont inclus dans le total. Définitions fondées sur les Recommandations internationales sur les statistiques du tourisme 2008 (ONU). NOTE du producteur (relayée telle quelle) : nouveau questionnaire unifié, système de traitement en phase de transition — certaines données peuvent ne pas encore refléter pleinement les standards visés, l'exhaustivité devant s'améliorer progressivement. De notre côté : reformatage uniquement (aucun lissage, aucune correction, aucun comblement).",
      example:
        "Polynésie française : 201 000 arrivées en 1997, 261 400 en 2022.",
      link: "https://www.untourism.int/tourism-statistics/tourism-statistics-database",
    },
    en: {
      provider: "UN Tourism · tourism statistics database · disseminated by the Pacific Data Hub (DF_CLIMATE_CHANGE, TRSM_ARR)",
      dataset: "Tourist arrivals — official Challenge dataset",
      frequency: "Annual",
      updated: "2026-02-23",
      license: "CC-BY",
      method:
        "Absolute counts of visitor arrivals, filtered to SPC member countries and restricted to three levels: total arrivals, tourists, same-day visitors. A tourist spends at least one night in collective or private accommodation in the country visited; same-day visitors are included in the total. Definitions based on the International Recommendations for Tourism Statistics 2008 (UN). Producer NOTE (relayed verbatim): new unified questionnaire, processing system in a transition phase — some data may not yet fully reflect the intended standards, with completeness expected to improve gradually. On our side: reformatting only (no smoothing, no correction, no filling).",
      example:
        "French Polynesia: 201,000 arrivals in 1997, 261,400 in 2022.",
      link: "https://www.untourism.int/tourism-statistics/tourism-statistics-database",
    },
  },

  envTax: {
    fr: {
      provider: "Fonds monétaire international (tableau de bord sur le changement climatique) ↠ OCDE · diffusion Pacific Data Hub (DF_ENV_TAXES, ENVTX)",
      dataset: "Fiscalité environnementale — jeu officiel du Challenge",
      frequency: "Annuelle",
      updated: "2025-10-08",
      license: "FMI — droits réservés (à confirmer pour réutilisation)",
      method:
        "Recettes des taxes environnementales en pourcentage du PIB. Le jeu brut contient des valeurs en monnaie nationale et en % du PIB : seules les observations en « Percent of GDP » sont conservées. Désagrégé par type de taxe — Énergie, Transport, Pollution, Ressources — plus un total des taxes environnementales. Les libellés de catégories sont simplifiés (préfixes redondants retirés, nomenclature standardisée). Le total n'est calculé que lorsque les quatre catégories sont documentées pour un couple pays-année. Couverture extrêmement limitée pour le Pacifique insulaire : 5 pays membres de la CPS déclarants, taux de données manquantes global de 43,8 %. De notre côté : reformatage uniquement.",
      example:
        "Fidji : taxes environnementales à 0,89 % du PIB en 2011, 0,4 % en 2020.",
      link: "https://data.imf.org/en/datasets/IMF.STA:ENVTX",
    },
    en: {
      provider: "International Monetary Fund (climate change dashboard) ↠ OECD · disseminated by the Pacific Data Hub (DF_ENV_TAXES, ENVTX)",
      dataset: "Environmental taxation — official Challenge dataset",
      frequency: "Annual",
      updated: "2025-10-08",
      license: "IMF — rights reserved (to confirm for reuse)",
      method:
        "Environmental tax revenue as a percentage of GDP. The raw dataset holds values in national currency and in % of GDP: only the « Percent of GDP » observations are kept. Disaggregated by tax type — Energy, Transport, Pollution, Resources — plus a total of environmental taxes. Category labels are simplified (redundant prefixes removed, nomenclature standardised). The total is computed only when all four categories are documented for a country-year. Extremely limited coverage for the island Pacific: 5 reporting SPC member countries, overall missing-data rate of 43.8%. On our side: reformatting only.",
      example:
        "Fiji: environmental taxes at 0.89% of GDP in 2011, 0.4% in 2020.",
      link: "https://data.imf.org/en/datasets/IMF.STA:ENVTX",
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