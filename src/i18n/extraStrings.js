// src/i18n/extraStrings.js
// ============================================================
// CHAÎNES i18n ADDITIONNELLES + OVERRIDES (Datamoana 2.0).
// Médiane = uniquement l'eau (Humain). Océan : °C vs normale 1971–2000 + m/an (médiane segments).
// ============================================================

const EXTRA_STRINGS = {
  fr: {
    header: { nav_recit: "Le Récit" },
    // ⚠️ UN SEUL objet `act11` par langue (même règle que `home`).
    act11: {
      // La thèse promettait une lecture « que vous pouvez explorer ET
      // PONDÉRER vous-même ». Le studio de pondération est retiré de la
      // synthèse : la promesse ne tient plus, et une promesse non tenue en
      // ouverture d'un dernier acte est pire qu'une promesse plus modeste.
      thesis:
        "Onze actes pour une même idée, et une note d'espoir : les territoires du Pacifique émettent très peu de CO₂ par habitant, encaissent beaucoup — mais gardent des marges de manœuvre réelles. Ce dernier acte rassemble les preuves en une lecture claire, relative au Pacifique, que vous pouvez parcourir scène après scène.",
      outro: {
        // La sortie promettait elle aussi de vous « laisser ajuster ce qui
        // compte le plus ». Ce que l'indice fait vraiment, désormais, c'est
        // peser chaque dimension pareil — et le dire.
        text: "Rien de tout cela n'est joué d'avance. Cet indice n'invente aucune donnée : il rassemble des mesures officielles, les met sur une même échelle et pèse chaque dimension pareil. Il ne tranche pas — il montre où agir en premier, et ouvre la conversation plutôt que de la clore.",
      },
    },
    home: {
      acts: {
        // ------------------------------------------------------------------
        // CHAQUE TITRE D'ESCALE EST UNE QUESTION.
        //
        // Les douze titres nommaient un sujet — « Un océan qui change »,
        // « Lire le ciel », « Cyclones ». Un sujet annoncé ne promet rien : le
        // lecteur arrive sur un tableau de bord sans savoir ce qu'il vient y
        // chercher, et ne sait pas davantage, en repartant, s'il l'a trouvé.
        //
        // Une question, elle, fixe le contrat. Elle dit ce que les données
        // savent répondre, et le tableau devient la réponse plutôt qu'une
        // collection de graphiques. C'est aussi la seule formulation qui
        // interdit d'annoncer plus que ce qu'on mesure.
        //
        // Règle appliquée aux douze : la question ne porte QUE sur ce que les
        // indicateurs de l'escale peuvent trancher. Rien sur les causes quand
        // on n'a que des corrélations ; rien sur l'avenir quand on n'a que des
        // séries passées. « La mer monte-t-elle là où l'on vit ? » se répond
        // avec l'anomalie du niveau marin croisée à la croissance de la
        // population — les deux jeux de l'escale, pas un de plus.
        //
        // La `thesis` reste dessous : la question ouvre, elle dit avec quoi on
        // y répond. Deux niveaux, pas deux titres concurrents.
        // ------------------------------------------------------------------

        // 01 · Émissions — CO₂ par habitant sur une cinquantaine d'années.
        //
        // « Qui pèse vraiment sur le climat ? » désignait un coupable, et
        // ouvrait donc les douze escales sur une accusation — alors que la
        // conclusion de celle-ci est l'inverse.
        //
        // La question posée est celle de la RÉGION, pas du classement : sa
        // réponse — très peu — est le socle sur lequel tiennent les onze
        // escales suivantes, puisque tout le récit part de là. Le classement
        // territoire par territoire reste dans les vues ; il répond au
        // « combien chacun », pas au « que pèse l'ensemble ».
        a1_title: "Que pèse le Pacifique dans le climat ?",

        // 02 · Océan — écart à la normale 1971–2000, territoire par territoire.
        a2_title: "De combien l'océan s'est-il réchauffé ?",

        // 03 · Ciel — pluies et températures face à leurs normales respectives.
        a8_title: "Le climat s'écarte-t-il de ses normales ?",

        // 04 · Cyclones — 212 phénomènes depuis 1977 : un décompte ET des
        // intensités. La question porte sur les deux, car l'archive permet de
        // distinguer « plus souvent » de « plus fort ».
        a12_title: "Plus de cyclones, ou des cyclones plus forts ?",

        // 05 · Agriculture — rendements (kg/ha, kg/animal) et couverture des sols.
        a6_title: "Nos terres produisent-elles plus, ou moins ?",

        // 06 · Vivant — Indice Liste Rouge (ce qu'on perd) en regard des
        // mesures de gestion des pêches (ce qu'on protège).
        a7_title: "Protège-t-on plus vite qu'on ne perd ?",

        // 07 · Territoire — anomalie du niveau de la mer croisée à la
        // croissance de la population.
        a3_title: "La mer monte-t-elle là où l'on vit ?",

        // 08 · Santé — eau potable gérée en sécurité et incidence de la
        // tuberculose, deux polarités inverses.
        a10_title: "L'eau potable protège-t-elle la santé ?",

        // 09 · Impact — personnes affectées et pertes économiques directes.
        a4_title: "Qui encaisse le choc des catastrophes ?",

        // 10 · Momentum — part renouvelable et production par source.
        a5_title: "Jusqu'où va l'électricité renouvelable ?",

        // 11 · Économie — arrivées de visiteurs et fiscalité environnementale.
        a9_title: "L'économie paie-t-elle son empreinte ?",

        // 12 · Synthèse — la thèse des onze escales : peu d'émissions, beaucoup
        // d'encaisse, mais des marges réelles.
        a11_title: "Quelles marges de manœuvre reste-t-il ?",
      },
      // ⚠️ UN SEUL objet `home` par langue. Une deuxième clé du même nom dans
      // le même littéral écrase silencieusement la première (le dernier gagne
      // en JS) — c'est ce qui avait fait disparaître ces trois légendes.
      begin: "Découvrir", // remplace « Commencer l'expérience »

      // LE SEUIL DU VOYAGE — deux réglages avant la première scène.
      // Voir components/VoyageSetup pour le pourquoi.
      setup: {
        kicker: "Avant de partir",
        title: "Deux réglages pour le voyage",
        sub: "Ils s'appliquent tout de suite : ce que vous voyez derrière ce panneau est ce que vous obtiendrez.",
        lang: "Langue",
        display: "Affichage",
        recommended: "recommandé",
        dark: "Sombre",
        // La recommandation dit POURQUOI. « Meilleure expérience » sans
        // raison se lit comme un argument de vente ; ici la raison est
        // vérifiable à l'écran, derrière le panneau.
        dark_note:
          "Le récit est dessiné pour l'obscurité : ciel étoilé, cartes de nuit, trajectoires lumineuses.",
        light: "Clair",
        light_note:
          "Entièrement pris en charge — chaque graphique a ses couleurs propres pour ce mode.",
        start: "Commencer le voyage",
        cancel: "Pas encore",
        later:
          "Vous pourrez changer de langue et d'affichage à tout moment, depuis l'en-tête.",
      },
      sources: "Les sources",
      tb: { value_caption: "Incidence locale" },
      sea: {
        value_caption: "Anomalie locale · vs normale 1971–2000",
        // Étiquette du repère tracé SUR le thermomètre. Distincte de
        // `median_label`, qui est la phrase de la légende sous le dessin :
        // sur le tube il n'y a la place que d'un mot.
        median_tag: "médiane",
        // En-tête de la liste des territoires à égalité, au survol des
        // pastilles « le plus chaud » / « le plus froid ».
        ties_head: "{n} territoires à égalité",
      },
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
      terre: {
        eyebrow: "Chapitre 3 · nourrir",
        title: "Vivre de la terre",
        lede:
          "Sur ces îles, se nourrir tient à peu : ce que donnent les cultures, ce que rend l'élevage. On le regarde, territoire par territoire.",
        problem:
          "Problème — petites et isolées, ces îles importent cher et produisent peu ; un rendement qui faiblit pèse vite sur l'assiette. Réponse — pour chaque territoire, on lit le rendement des cultures et celui de l'élevage.",
        message:
          "D'une île à l'autre, ce que la terre nourrit n'a rien de comparable.",
      },
      terre2: {
        eyebrow: "Chapitre 3 · le vivant",
        title: "Et le vivant, autour",
        lede:
          "Produire est une chose ; préserver le milieu qui le permet en est une autre. On regarde la couverture des terres et la pression sur les espèces.",
        message:
          "Ce que la terre abrite recule parfois là où on l'attend le moins.",
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
      terre: {
        crop: "Agriculture — rendement des cultures",
        forest: "Couverture des terres",
        cattle: "Élevage — rendement",
        bio: "Biodiversité — espèces",
        q1: "Île par île : que produit la terre pour nourrir ?",
        q2: "Île par île : que reste-t-il du vivant qui l'entoure ?",
      },
    },
    // Barre d'export de la page jeu de données (/data/:id).
    dataset: {
      export_title: "Exporter",
      export_pdf: "Rapport PDF",
      export_excel: "Classeur Excel",
    },
    // Passage du board vers la conclusion de l'acte (3e temps).
    board: { conclude: "Lire la conclusion" },
    // Sortie du voyage guidé, et les deux boutons d'extrémité de la barre
    // d'escale. Ils disaient « Précédent » et « Acte suivant » : deux
    // formulations différentes pour deux boutons symétriques, et le mot
    // « acte » alors que l'interface parle d'escales partout ailleurs.
    flow: {
      exit_voyage: "Quitter le voyage",
      prev: "Escale précédente",
      next: "Escale suivante",
    },
    // Barre de voyage du Récit (chaque acte = une escale).
    // La phrase de la vue « calendrier » décrivait un vert-rouge qui n'existe
    // plus : la matrice compte des cyclones, une grandeur, et emploie
    // désormais la rampe à une seule teinte des autres escales. Une légende
    // qui nomme des couleurs absentes est pire qu'une absence de légende.
    // La rampe divergente du projet est BLEU ↔ AMBRE depuis qu'elle a été
    // mesurée : le vert-rouge d'origine était illisible pour près d'un homme
    // sur douze, et le lavande-rouge qui l'a remplacé a été adouci en ambre.
    // Ces phrases nommaient encore le rouge. Une légende qui désigne une
    // couleur absente de l'écran est pire qu'une absence de légende.
    // Les deux boutons d'extrémité de la barre d'escale. Ils disaient
    // « Précédent » et « Acte suivant » — deux formulations différentes pour
    // deux boutons symétriques, et le mot « acte » alors que l'interface parle
    // d'escales partout ailleurs.
    act8: {
      board: {
        heat_find:
          "Territoires × années : l'intensité dit l'écart à la normale — bleu en dessous, ambre au-dessus.",
        heat_take:
          "La matrice distingue d'un coup d'œil ce qui oscille de ce qui s'installe — bleu sous la normale, ambre au-dessus.",
      },
      map_sub: "Anomalie par territoire — bleu sous la référence, ambre au-dessus",
    },
    act12: {
      viz: {
        month_find:
          "Genèse des cyclones par mois (saison australe, juillet → juin, en lignes) et par tranche d'années (en colonnes). Plus une case est marquée, plus de cyclones s'y sont formés. Le cœur de saison se concentre de décembre à avril.",
      },
    },
    recit: {
      voyage_exit: "Quitter le voyage",
      voyage_next: "Escale suivante",
      voyage_enter: "Entrer dans l’escale",
      voyage_aria: "Navigation du voyage",
      voyage_progress: "Progression du voyage",
      voyage_leg: "Escale",
    },
  },
  en: {
    header: { nav_recit: "The Story" },
    dataset: {
      export_title: "Export",
      export_pdf: "PDF report",
      export_excel: "Excel workbook",
    },
    board: { conclude: "Read the conclusion" },
    flow: {
      exit_voyage: "Leave the voyage",
      prev: "Previous escale",
      next: "Next escale",
    },
    recit: {
      voyage_exit: "Leave the voyage",
      voyage_next: "Next leg",
      voyage_enter: "Enter the leg",
      voyage_aria: "Voyage navigation",
      voyage_progress: "Voyage progress",
      voyage_leg: "Leg",
    },
    act11: {
      thesis:
        "Eleven acts for one idea, with a note of hope: Pacific territories emit very little CO₂ per capita and absorb a great deal — yet keep real room to act. This final act gathers the evidence into one clear reading, relative to the Pacific, that you can walk through scene by scene.",
      outro: {
        text: "None of this is set in stone. This index invents no data: it gathers official measurements, puts them on one scale and weighs every dimension alike. It doesn't rule — it shows where to act first, and opens the conversation rather than closing it.",
      },
    },
    home: {
      // Idem côté anglais : un seul objet `home`, sinon écrasement silencieux.
      acts: {
        // Same rule as the French block: every leg's title is a QUESTION the
        // leg's own indicators can settle — nothing about causes where we only
        // have correlations, nothing about the future where we only have past
        // series. The `thesis` below says what we answer it with.
        a1_title: "How much does the Pacific weigh on the climate?",
        a2_title: "How much has this ocean warmed?",
        a8_title: "Is the climate drifting from its normals?",
        a12_title: "More cyclones, or stronger ones?",
        a6_title: "Is our land yielding more, or less?",
        a7_title: "Do we protect faster than we lose?",
        a3_title: "Is the sea rising where people live?",
        a10_title: "Does safe water protect health?",
        a4_title: "Who absorbs the shock of disasters?",
        a5_title: "How far has renewable power come?",
        a9_title: "Does the economy pay for its footprint?",
        a11_title: "What room to manoeuvre is left?",
      },
      begin: "Discover",
      setup: {
        kicker: "Before you set out",
        title: "Two settings for the voyage",
        sub: "They apply at once: what you see behind this panel is what you will get.",
        lang: "Language",
        display: "Display",
        recommended: "recommended",
        dark: "Dark",
        dark_note:
          "The story is drawn for darkness: starfield, night maps, luminous tracks.",
        light: "Light",
        light_note:
          "Fully supported — every chart has its own colours for this mode.",
        start: "Begin the voyage",
        cancel: "Not yet",
        later: "You can change language and display at any time, from the header.",
      },
      sources: "The sources",
      tb: { value_caption: "Local incidence" },
      sea: {
        value_caption: "Local anomaly · vs 1971–2000 normal",
        median_tag: "median",
        ties_head: "{n} territories tied",
      },
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
      terre: {
        eyebrow: "Chapter 3 · feeding",
        title: "Living off the land",
        lede:
          "On these islands, feeding people hangs on little: what the crops give, what the livestock returns. We look at it, territory by territory.",
        problem:
          "Problem — small and isolated, these islands import at high cost and produce little; a weakening yield quickly weighs on the plate. Response — for each territory, we read crop yield and livestock yield.",
        message:
          "From one island to the next, what the land feeds is nothing alike.",
      },
      terre2: {
        eyebrow: "Chapter 3 · the living world",
        title: "And the life around it",
        lede:
          "Producing is one thing; protecting the environment that allows it is another. We look at land cover and pressure on species.",
        message:
          "What the land shelters sometimes recedes where you'd least expect it.",
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
      terre: {
        crop: "Agriculture — crop yield",
        forest: "Land cover",
        cattle: "Livestock — yield",
        bio: "Biodiversity — species",
        q1: "Island by island: what does the land produce to feed people?",
        q2: "Island by island: what's left of the life around it?",
      },
    },
    act8: {
      board: {
        heat_find:
          "Territories × years: intensity carries the gap from the normal — blue below, amber above.",
        heat_take:
          "The matrix tells at a glance what oscillates from what settles in — blue below the normal, amber above.",
      },
      map_sub: "Anomaly per territory — blue below reference, amber above",
    },
    act12: {
      viz: {
        month_find:
          "Cyclone genesis by month (austral season, July → June, rows) and by span of years (columns). The stronger a cell, the more cyclones formed then. The season peaks from December to April.",
      },
    },
  },
};

export default EXTRA_STRINGS;