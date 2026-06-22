// src/i18n/extraStrings.js
// ============================================================
// CHAÎNES i18n ADDITIONNELLES + OVERRIDES (Datamoana 2.0).
// Médiane = uniquement l'eau (Humain). Océan : °C vs normale 1971–2000 + m/an (médiane segments).
// ============================================================

const EXTRA_STRINGS = {
  fr: {
    header: { nav_recit: "Le Récit" },
    home: {
      tb: { value_caption: "Incidence locale" },
      sea: { value_caption: "Anomalie locale · vs normale 1971–2000" },
      coast: { rate_caption: "Taux annuel · médiane des segments" },
    },
    chapters: {
      humain: {
        title: "L'Humain en première ligne",
        lede:
          "Avant tout le reste, l'essentiel : boire une eau sûre, et ne pas mourir de la tuberculose. Deux mesures simples, très inégales d'une île à l'autre.",
        problem:
          "Problème — la santé de base reste très inégale selon les territoires. Réponse — pour l'eau potable, on situe chaque île face à la médiane du Pacifique ; pour la tuberculose, on lit l'incidence (cas pour 100 000 habitants) et son évolution.",
        message:
          "D'une île à l'autre, l'accès à l'eau et le poids de la tuberculose n'ont rien de comparable.",
      },
      ocean: {
        eyebrow: "Chapitre 2",
        title: "La température monte, les côtes bougent",
        lede:
          "La température grimpe et le trait de côte bouge. Île par île, on lit l'anomalie de température et le recul — ou l'avancée — des rivages.",
        problem:
          "Problème — le réchauffement est invisible, mais il redessine déjà les côtes. Réponse — pour chaque territoire, on lit l'anomalie de température (°C par rapport à la normale 1971–2000) et la variation du trait de côte (médiane en mètres par an, segments Landsat).",
        message:
          "D'une île à l'autre, la température grimpe — et les côtes n'encaissent pas toutes de la même façon.",
        map_title: "Le trait de côte, point par point",
        map_lede:
          "Zoomez : chaque point est un segment de littoral mesuré. En rouge il recule, en bleu il avance — survolez-les ou parcourez-les un à un.",
        map_source:
          "Source : Digital Earth Pacific (Landsat Coastlines, CC BY-NC 4.0) · Pacific Data Hub",
      },
    },
    vaa: {
      problem_tag: "Le problème & la réponse",
      scroll_hint: "Faites défiler pour naviguer le Pacifique",
      coda_title: "Aller plus loin",
      unavailable: "Donnée indisponible pour ce territoire",
      error: "Affichage indisponible",
      trend: { up: "En hausse", down: "En baisse", flat: "Stable" },
      humain: {
        water: "Accès à l'eau potable",
        tb: "Tuberculose — incidence",
        question: "Île par île : l'eau coule-t-elle, la tuberculose recule-t-elle ?",
      },
      ocean: {
        sea: "Anomalie de température",
        coast: "Trait de côte",
        question: "Île par île : de combien la température grimpe-t-elle, et la côte tient-elle ?",
      },
    },
  },
  en: {
    header: { nav_recit: "The Story" },
    home: {
      tb: { value_caption: "Local incidence" },
      sea: { value_caption: "Local anomaly · vs 1971–2000 normal" },
      coast: { rate_caption: "Annual rate · median of segments" },
    },
    chapters: {
      humain: {
        title: "Humans on the front line",
        lede:
          "Before anything else, the essentials: safe water to drink, and not dying of tuberculosis. Two simple measures — and very unequal from one island to the next.",
        problem:
          "Problem — basic health stays deeply unequal across territories. Response — for drinking water, we place each island against the Pacific median; for tuberculosis, we read the incidence (cases per 100,000) and how it is changing.",
        message:
          "From one island to the next, water access and the burden of tuberculosis are nothing alike.",
      },
      ocean: {
        eyebrow: "Chapter 2",
        title: "Temperatures rise, coasts shift",
        lede:
          "Temperatures are climbing and the coastline is shifting. Island by island, we read the temperature anomaly and the retreat — or advance — of the shores.",
        problem:
          "Problem — the warming is invisible, yet it is already redrawing the coasts. Response — for each territory, we read the temperature anomaly (°C against the 1971–2000 normal) and the change in the coastline (median metres per year, Landsat segments).",
        message:
          "From one island to the next, temperatures climb — and the coasts don't all take it the same way.",
        map_title: "The coastline, point by point",
        map_lede:
          "Zoom in: each point is a measured shoreline segment. Red is retreating, blue is advancing — hover or step through them one by one.",
        map_source:
          "Source: Digital Earth Pacific (Landsat Coastlines, CC BY-NC 4.0) · Pacific Data Hub",
      },
    },
    vaa: {
      problem_tag: "Problem & response",
      scroll_hint: "Scroll to sail the Pacific",
      coda_title: "Go further",
      unavailable: "No data for this territory",
      error: "Display unavailable",
      trend: { up: "Rising", down: "Falling", flat: "Stable" },
      humain: {
        water: "Access to safe drinking water",
        tb: "Tuberculosis — incidence",
        question: "Island by island: is the water flowing, is tuberculosis receding?",
      },
      ocean: {
        sea: "Temperature anomaly",
        coast: "Coastline",
        question: "Island by island: how much are temperatures rising, and is the coast holding?",
      },
    },
  },
};

export default EXTRA_STRINGS;