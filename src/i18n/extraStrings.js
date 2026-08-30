// src/i18n/extraStrings.js
// ============================================================
// CHAÎNES i18n ADDITIONNELLES + OVERRIDES (Datamoana 2.0).
// Médiane = uniquement l'eau (Humain). Océan : °C vs normale 1971–2000 + m/an (médiane segments).
// ============================================================

const EXTRA_STRINGS = {
  fr: {
    act10: {
      tag: "Escale 08",
    },
    act9: {
      tag: "Escale 11",
    },
    act7: {
      tag: "Escale 06 — Le vivant",
    },
    act6: {
      tag: "Escale 05 — L'assiette",
    },
    about: {
      data: {
        lead:
          "Toutes les données de Datamoana proviennent de sources publiques et ouvertes, agrégées par le Pacific Data Hub .Stat de la Communauté du Pacifique (SPC). Elles correspondent à la liste officielle du concours : chaque escale affiche sa source, son unité et sa méthode.",
      },
      challenge: {
        body:
          "Datamoana est ma contribution au Pacific Dataviz Challenge 2026, dont le thème est le changement climatique dans le Pacifique. Douze escales, 23 jeux de données officiels croisés, une seule histoire.",
      },
    },
    header: { nav_recit: "Le Récit" },
    act5: {
      board: {
        // La carte est sur la rampe SÉQUENTIELLE lavande depuis la refonte ;
        // la phrase promettait encore du vert. Et « plus vertueux » portait un
        // jugement que la donnée ne porte pas : une part renouvelable élevée
        // se lit, la vertu se discute.
        map_find:
          "La part d'énergie renouvelable de chaque territoire pour l'année choisie, posée sur le globe. Plus la colonne est haute et claire, plus cette part est élevée.",
      },
    },
    act3: {
      board: {
        // La carte satellite passait par la rampe « semantic » (vert → cyan →
        // rouge), écartée pour cause de daltonisme ; elle est maintenant sur
        // la divergente validée bleu ↔ ambre. La phrase nommait « rouge » et
        // « bleu » : le bleu était déjà faux avant, le rouge l'est devenu.
        coast_find:
          "Chaque point est un segment de littoral suivi par satellite (Landsat, 1999–2023). En rouge les segments qui reculent, en bleu ceux qui avancent — exprimé en mètres par an.",
        coastbal_find:
          "Pour chaque territoire, la part de littoral qui recule (en ambre, à gauche) face à la part qui avance (en bleu, à droite), agrégée sur tous ses segments suivis.",
      },
    },
    // ------------------------------------------------------------------
    // ESCALE 01 — LES TEXTES DE LA COLONNE DE LECTURE, RÉÉCRITS.
    //
    // Ils étaient écrits pour quelqu'un qui sait déjà lire un graphique :
    // « écart-type rapporté à la moyenne », « base 100 », « échelle
    // logarithmique », « l'effet dénominateur » — chacun de ces termes est le
    // POINT de sa vue, et aucun n'était expliqué. L'unité elle-même se
    // traduisait par « en tonnes », ce qui escamotait le « e » d'équivalent :
    // c'est pourtant lui qui explique qu'un territoire monte à 86.
    //
    // Recette appliquée aux neuf vues :
    //   1. « Ce que vous regardez » nomme la MARQUE (une barre, un point, une
    //      case) avant de nommer l'axe qui la porte ;
    //   2. l'unité est donnée en mots, jamais en sigle seul ;
    //   3. aucun terme technique n'apparaît sans sa traduction dans la même
    //      phrase ;
    //   4. « Ce qu'il faut retenir » dit pourquoi c'est intéressant, pas ce
    //      qui est tracé.
    // ------------------------------------------------------------------
    act1: {
      viz: {
        plume_title: "L'empreinte, territoire par territoire",
        plume_find:
          "Un panache de fumée par territoire. Plus il est dense et haut, plus ce territoire émet de gaz à effet de serre par habitant. Choisissez-en un dans le menu sous le dessin.",
        plume_take:
          "Un chiffre par habitant ne dit rien tout seul. Mis côte à côte, deux panaches se comparent sans qu'on ait à lire un seul nombre.",

        race_title: "La course des territoires",
        rank_title: "Qui émet combien, année par année",
        trend_title: "Trajectoires dans le temps",

        // « Niveau face à l'évolution » nommait deux axes, pas une question.
        scatter_title: "Où en est chacun, et dans quel sens il va",

        // Le titre d'origine — « L'effet dénominateur, démontré par la
        // volatilité » — employait deux termes techniques pour annoncer une
        // idée simple, sur la vue la plus difficile de l'escale.
        denom_title: "Pourquoi les chiffres des petits territoires sautent",

        heat_title: "Vue d'ensemble : territoires × années",
        map_title: "Cartographie des émissions",

        change_take2:
          "En bleu, ceux qui ont allégé leur empreinte depuis leur première année ; en ambre, ceux qui l'ont alourdie. La plupart restent collés à la ligne des 100 : cinquante ans de développement, à empreinte presque constante.",
      },

      board: {
        race_find:
          "Le classement rejoué en accéléré, une image par année, de la première donnée à la dernière. Chaque barre est un territoire ; elle s'allonge quand il émet plus, et les barres se doublent quand l'ordre change.",
        race_take:
          "Regardez l'ordre plutôt que les longueurs : en cinquante ans, il ne change presque pas. Le Pacifique émet peu depuis toujours.",

        rank_find:
          "Un point par territoire, pour la seule année posée sur le curseur : sa position sur l'axe est ce qu'il émet par personne cette année-là. Le pointillé marque la médiane — la moitié des territoires est à sa gauche.",
        rank_take:
          "Deux territoires se détachent tout à droite. Ce chiffre est un rapport : une population minuscule au dénominateur, ou une industrie lourde au numérateur, suffit à le faire monter — sans que la région autour ait changé. Tout le reste du Pacifique se resserre dans la moitié gauche.",

        trend_find:
          "Une courbe par territoire, une année par point, de la première donnée à la dernière. La hauteur de la courbe, c'est ce que le territoire émet par habitant cette année-là. Le menu au-dessus du graphique permet de n'en garder qu'une.",
        trend_take:
          "Aucune envolée collective : la plupart des courbes restent basses et à peu près horizontales. Autrement dit, le développement du Pacifique ne s'est pas payé en carbone par habitant.",

        change_title: "Le mouvement, territoire par territoire",
        change_find:
          "Les mêmes courbes, toutes ramenées à 100 pour leur première année. On ne compare plus des niveaux — ils vont de un à quatre-vingts et écrasent tout — mais des mouvements : à 120, le territoire a pris 20 % ; à 80, il en a perdu 20.",

        scatter_find:
          "Un point par territoire. Sa position de gauche à droite, c'est ce qu'il émet aujourd'hui par habitant ; sa position de bas en haut, de combien cela a changé depuis sa première année. En bas à gauche se rassemblent ceux qui émettent peu et baissent encore.",
        scatter_take:
          "Le quadrant bas-gauche est le plus peuplé : émettre peu, et continuer à baisser. C'est un point de départ favorable pour l'escale consacrée à l'élan renouvelable.",

        denom_find:
          "Un point par territoire. De gauche à droite, son niveau habituel sur la période ; de bas en haut, à quel point sa courbe saute d'une année à l'autre — 0 % pour une série parfaitement régulière, 100 % pour une série qui varie autant que sa moyenne.",
        denom_take:
          "Une émission « par habitant » est une division : par dix mille personnes plutôt que dix millions, un seul navire fait bondir le résultat. Les pics des petits territoires disent la taille de leur population, pas un dérapage.",

        heat_find:
          "Une ligne par territoire, une colonne par année, une case par valeur. La couleur de la case donne la position du territoire cette année-là : claire quand il est parmi les plus sobres, sombre quand il est parmi les plus émetteurs.",
        heat_take:
          "Les lignes gardent la même teinte de gauche à droite : sur un demi-siècle, presque aucun territoire ne change de camp. C'est la stabilité que cette vue donne à voir.",

        map_find:
          "Une colonne plantée sur chaque territoire. Plus elle est haute et claire, plus ce territoire émet par habitant l'année choisie. Le globe tourne à la souris, et le lecteur d'années se trouve en bas.",
        map_take:
          "Les colonnes les plus hautes se dressent sur les plus petits territoires. Là encore, c'est la division par une population minuscule qui fait le pic — pas une région qui dérape.",
      },

      key: {
        race_y: "Un territoire par barre.",
        race_x:
          "Tonnes de gaz à effet de serre, par personne et par an.",

        rank_y:
          "Un territoire par point.",
        rank_x:
          "Tonnes de gaz à effet de serre, par personne et par an. Échelle logarithmique : chaque graduation vaut dix fois la précédente.",
        rank_c:
          "Une couleur par territoire, la même que dans les autres vues.",

        trend_y:
          "Tonnes de gaz à effet de serre, par personne et par an.",
        trend_x: "Le temps, une année par point.",

        change_y:
          "Base 100 : 100 = le niveau de départ, 150 = une fois et demie plus, 50 = deux fois moins.",
        change_x: "Le temps, une année par point.",
        change_c:
          "Bleu, l'empreinte a baissé depuis la première année. Ambre, elle a augmenté.",

        scatter_y:
          "Évolution depuis la première année, en %.",
        scatter_x:
          "Niveau actuel par habitant. Échelle logarithmique : ×10 par graduation.",
        scatter_c: "Une teinte par sous-région : Mélanésie, Polynésie, Micronésie.",

        denom_y:
          "Nervosité de la série, en %.",
        denom_x:
          "Niveau habituel sur la période, en tonnes par personne et par an.",
        denom_c: "Une teinte par sous-région : Mélanésie, Polynésie, Micronésie.",

        heat_c:
          "Du clair au sombre : du plus sobre au plus émetteur.",

        map_c:
          "Colonne haute et claire : émet plus par habitant. Échelle logarithmique : ×10 par graduation.",

        plume_c:
          "La densité du panache suit les émissions par habitant du territoire choisi.",
      },
    },
    // ⚠️ UN SEUL objet `act11` par langue (même règle que `home`).
    act11: {
      // « Acte 11 » était doublement faux : le mot, et le numéro — a11 est la
      // DOUZIÈME escale du voyage.
      tag: "Escale 12 — Synthèse",
      thesis:
        "Onze escales pour une même idée, et une note d'espoir : les territoires du Pacifique émettent très peu de CO₂ par habitant, encaissent beaucoup — mais gardent des marges de manœuvre réelles. Cette dernière escale rassemble les preuves en une lecture claire, relative au Pacifique, que vous pouvez parcourir scène après scène.",
      story: {
        voyage_title: "Douze escales, une seule histoire",
        voyage_text:
          "Avant le verdict, retraçons le chemin parcouru — chaque escale, une pièce du puzzle climatique du Pacifique.",
        resp_k: "Escale 01 · La responsabilité",
        ocean_k: "Escale 02 · L'océan",
      },
      story: {
        // La matrice passe du vert↔rouge à la divergente validée : la phrase
        // qui disait « le rouge s'accumule » nommait une couleur qui n'est
        // plus à l'écran.
        matrix_text:
          "Territoires en lignes, stress en colonnes. Les cases chaudes s'accumulent : ce n'est pas un risque isolé, c'est leur addition.",
      },
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
      acts_intro: "Douze escales pour comprendre. Une région déjà en mouvement.",
      acts_lead:
        "Chaque escale part d'un chiffre vérifiable et le suit jusqu'au bout : la réalité qu'il décrit, et la réponse que le Pacifique lui oppose déjà.",
      act_explore: "Explorer l'escale",
      // La phrase d'accueil : la première chose qu'on lit du produit.
      thesis:
        "Un voyage en douze escales à travers le climat du Pacifique : pas une fatalité qu'on subit, mais une région qui mesure, s'adapte et prend les devants — avec, pour seule source, ses propres données.",
      stat4_num: "12 escales",
      intro: {
        body1:
          "Pensée comme un voyage en plusieurs escales, la plateforme mobilise un maximum de données ouvertes et officielles sur le Pacifique.",
        p2_text:
          "Douze escales pour relier les chiffres aux réalités vécues sur le terrain.",
      },
      modes: {
        browse_title: "Par escale",
        browse_text:
          "Explorez librement : choisissez l'escale qui vous parle et plongez directement dedans.",
        browse_action: "Voir les escales",
        guided_text:
          "« Découvrir » vous emmène à travers les douze escales, dans l'ordre du récit.",
      },
      teaser: {
        cta: "Explorer les escales",
        lead:
          "Du plus grand au plus isolé, chaque territoire du Pacifique fait face au changement climatique. Entrez dans le récit, escale par escale.",
      },
      closing_cta: {
        text:
          "Douze escales, des données réelles, une région en première ligne. À vous de choisir comment la lire.",
        browse: "Parcourir les escales",
      },
      acts: {
        a1_text:
          "Cinquante ans de données, une constante : l'empreinte carbone par habitant du Pacifique reste légère et tenue dans la durée. Cette escale la mesure territoire par territoire — le socle du récit.",
        a2_text:
          "L'anomalie de température de surface de la mer, territoire par territoire : l'écart à la normale, année après année. Savoir lire l'océan, c'est pouvoir anticiper — pour le vivant, le ciel et les saisons cycloniques des escales suivantes.",
        a1_tag: "Escale 01",
        a2_tag: "Escale 02",
        a8_tag: "Escale 03",
        a12_tag: "Escale 04",
        a6_tag: "Escale 05",
        a7_tag: "Escale 06",
        a3_tag: "Escale 07",
        a10_tag: "Escale 08",
        a4_tag: "Escale 09",
        a5_tag: "Escale 10",
        a9_tag: "Escale 11",
        a11_tag: "Escale 12 — Synthèse",
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
      no_table:
        "Tableau brut bientôt disponible — ce jeu se consulte aujourd'hui directement dans les escales.",
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
      act: "Escale",
      reveal: "Découvrir l'escale",
      nav_aria: "Navigation entre les escales",
      deck_done: "Fin de l'escale",
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
      tag: "Escale 03",
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
      cta_acts: "Explorer les 11 escales détaillées",
      voyage_exit: "Quitter le voyage",
      voyage_next: "Escale suivante",
      voyage_enter: "Entrer dans l’escale",
      voyage_aria: "Navigation du voyage",
      voyage_progress: "Progression du voyage",
      voyage_leg: "Escale",
    },
  },
  en: {
    act10: {
      tag: "Leg 08",
    },
    act9: {
      tag: "Leg 11",
    },
    act7: {
      tag: "Leg 06 — The living world",
    },
    act6: {
      tag: "Leg 05 — The plate",
    },
    about: {
      data: {
        lead:
          "All of Datamoana's data comes from open, public sources, aggregated by the Pacific Community's (SPC) Pacific Data Hub .Stat. It matches the challenge's official list: each leg shows its source, unit and method.",
      },
      challenge: {
        body:
          "Datamoana is my entry to the 2026 Pacific Dataviz Challenge, whose theme is climate change in the Pacific. Twelve legs, 23 official datasets crossed, one story.",
      },
    },
    header: { nav_recit: "The Story" },
    dataset: {
      no_table:
        "Raw table coming soon — this dataset is currently explored directly inside the legs.",
      export_title: "Export",
      export_pdf: "PDF report",
      export_excel: "Excel workbook",
    },
    board: { conclude: "Read the conclusion" },
    flow: {
      act: "Leg",
      reveal: "Discover the leg",
      nav_aria: "Navigation between legs",
      deck_done: "End of the leg",
      exit_voyage: "Leave the voyage",
      // « escale » était resté en français dans la version anglaise.
      prev: "Previous leg",
      next: "Next leg",
    },
    recit: {
      cta_acts: "Explore the 11 detailed legs",
      voyage_exit: "Leave the voyage",
      voyage_next: "Next leg",
      voyage_enter: "Enter the leg",
      voyage_aria: "Voyage navigation",
      voyage_progress: "Voyage progress",
      voyage_leg: "Leg",
    },
    act3: {
      board: {
        coast_find:
          "Each dot is a satellite-tracked coastline segment (Landsat, 1999–2023). Red for segments retreating, blue for those advancing — in metres per year.",
        coastbal_find:
          "For each territory, the share of coastline retreating (amber, left) against the share advancing (blue, right), aggregated across all its tracked segments.",
      },
    },
    act5: {
      board: {
        map_find:
          "Each territory's renewable share for the chosen year, set on the globe. The taller and lighter the column, the higher that share.",
      },
    },
    act1: {
      viz: {
        plume_title: "The footprint, territory by territory",
        plume_find:
          "One smoke plume per territory. The denser and taller it is, the more that territory emits in greenhouse gases per inhabitant. Pick one in the menu below the drawing.",
        plume_take:
          "A per-person figure says nothing on its own. Side by side, two plumes compare without reading a single number.",

        race_title: "The territories' race",
        rank_title: "Who emits how much, year by year",
        trend_title: "Paths through time",
        scatter_title: "Where each one stands, and which way it is heading",
        denom_title: "Why the figures of small territories jump about",
        heat_title: "The whole picture: territories × years",
        map_title: "Mapping the emissions",

        change_take2:
          "In blue, the territories that lightened their footprint since their first year; in amber, those that increased it. Most curves stay glued to the 100 line: fifty years of development at an almost constant footprint.",
      },

      board: {
        race_find:
          "The ranking replayed at speed, one frame per year, from the first data point to the last. Each bar is a territory; it grows as that territory emits more, and bars overtake one another when the order changes.",
        race_take:
          "Watch the order rather than the lengths: in fifty years it barely changes. The Pacific has always emitted little.",

        rank_find:
          "One dot per territory, for the single year set on the slider: its position on the axis is what it emits per person that year. The dashed line marks the median — half the territories sit to its left.",
        rank_take:
          "Two territories stand apart on the far right. The figure is a ratio: a tiny population in the denominator, or heavy industry in the numerator, is enough to push it up — with nothing changing in the region around it. All the rest of the Pacific bunches into the left half.",

        trend_find:
          "One curve per territory, one point per year, from the first data point to the last. The height of the curve is what the territory emits per inhabitant that year. The menu above the chart keeps just one.",
        trend_take:
          "No collective surge: most curves stay low and roughly flat. In other words, the Pacific's development was not paid for in carbon per person.",

        change_title: "The movement, territory by territory",
        change_find:
          "The same curves, but all reset to 100 at their first year. We no longer compare levels — they run from one to eighty and crush everything — but movements: at 120 a territory has gained 20 %, at 80 it has lost 20.",

        scatter_find:
          "One dot per territory. Its left-to-right position is what it emits today per inhabitant; its bottom-to-top position, how much that has changed since its first year. The lower left gathers those that emit little and are still going down.",
        scatter_take:
          "The lower-left quadrant is the most crowded: emitting little, and still falling. A favourable starting point for the leg on renewable momentum.",

        denom_find:
          "One dot per territory. Left to right, its usual level over the whole period. Bottom to top, how much its curve jumps from one year to the next: 0 % for a perfectly steady series, 100 % for one that varies as much as its own average.",
        denom_take:
          "An emission \u201cper inhabitant\u201d is a division: by ten thousand people rather than ten million, a single ship sends the result soaring. Small territories\u2019 spikes speak of population size, not of a region going off the rails.",

        heat_find:
          "One row per territory, one column per year, one cell per value. A cell's colour gives that territory's standing that year: light when it is among the lowest emitters, dark when it is among the highest.",
        heat_take:
          "Rows keep the same shade from left to right: over half a century, almost no territory changes camp. Stability is what this view shows.",

        map_find:
          "One column planted on each territory. The taller and lighter it is, the more that territory emits per inhabitant in the chosen year. Drag to spin the globe; the year scrubber sits at the bottom.",
        map_take:
          "The tallest columns rise over the smallest territories. Here again it is the division by a tiny population that makes the spike — not a region going off the rails.",
      },

      key: {
        race_y: "One territory per bar.",
        race_x: "Tonnes of greenhouse gases, per person per year.",

        rank_y:
          "One territory per dot.",
        rank_x: "Tonnes of greenhouse gases, per person per year. Logarithmic scale: each gradation is ten times the previous one.",
        rank_c:
          "One colour per territory, the same as in the other views.",

        trend_y: "Tonnes of greenhouse gases, per person per year.",
        trend_x: "Time, one point per year.",

        change_y:
          "Base 100: 100 = the starting level, 150 = one and a half times as much, 50 = half.",
        change_x: "Time, one point per year.",
        change_c:
          "Blue, the footprint went down since the first year. Amber, it went up.",

        scatter_y:
          "Change since the first year, in %.",
        scatter_x:
          "Current level per inhabitant. Logarithmic scale: ×10 per gradation.",
        scatter_c: "One hue per sub-region: Melanesia, Polynesia, Micronesia.",

        denom_y:
          "How jumpy the series is, in %.",
        denom_x:
          "Usual level over the whole period, in tonnes per person per year.",
        denom_c: "One hue per sub-region: Melanesia, Polynesia, Micronesia.",

        heat_c:
          "Light to dark: from lowest to highest emitter.",

        map_c:
          "Tall, light column: emits more per inhabitant. Logarithmic scale: ×10 per gradation.",

        plume_c:
          "The plume's density follows the chosen territory's emissions per person.",
      },
    },
    act11: {
      tag: "Leg 12 — Synthesis",
      thesis:
        "Eleven legs for one idea, with a note of hope: Pacific territories emit very little CO\u2082 per capita and absorb a great deal \u2014 yet keep real room to act. This final leg gathers the evidence into one clear reading, relative to the Pacific, that you can walk through scene by scene.",
      story: {
        voyage_title: "Twelve legs, one story",
        voyage_text:
          "Before the verdict, let us retrace the road travelled \u2014 each leg, one piece of the Pacific's climate puzzle.",
        resp_k: "Leg 01 · Responsibility",
        ocean_k: "Leg 02 · The ocean",
      },
      story: {
        matrix_text:
          "Territories in rows, stresses in columns. The warm cells pile up: it is not one isolated risk, it is their sum.",
      },
      thesis:
        "Eleven acts for one idea, with a note of hope: Pacific territories emit very little CO₂ per capita and absorb a great deal — yet keep real room to act. This final act gathers the evidence into one clear reading, relative to the Pacific, that you can walk through scene by scene.",
      outro: {
        text: "None of this is set in stone. This index invents no data: it gathers official measurements, puts them on one scale and weighs every dimension alike. It doesn't rule — it shows where to act first, and opens the conversation rather than closing it.",
      },
    },
    home: {
      acts_intro: "Twelve legs to understand. A region already on the move.",
      acts_lead:
        "Every leg starts from one verifiable figure and follows it through: the reality it describes, and the answer the Pacific is already giving it.",
      act_explore: "Explore the leg",
      thesis:
        "A voyage in twelve legs through the climate of the Pacific: not a fate to be endured, but a region that measures, adapts and takes the lead \u2014 with its own data as the only source.",
      stat4_num: "12 legs",
      intro: {
        body1:
          "Built as a voyage in several legs, the platform draws on as much open, official Pacific data as it can.",
        p2_text:
          "Twelve legs to connect the figures with realities lived on the ground.",
      },
      modes: {
        browse_title: "By leg",
        browse_text:
          "Browse freely: pick the leg that speaks to you and dive straight in.",
        browse_action: "See the legs",
        guided_text:
          "\u201cDiscover\u201d takes you through the twelve legs, in the order of the story.",
      },
      teaser: {
        cta: "Explore the legs",
        lead:
          "From the largest to the most remote, every Pacific territory faces climate change. Step into the story, leg by leg.",
      },
      closing_cta: {
        text:
          "Twelve legs, real data, a region on the front line. It is up to you how to read it.",
        browse: "Browse the legs",
      },
      // Idem côté anglais : un seul objet `home`, sinon écrasement silencieux.
      acts: {
        a1_text:
          "Fifty years of data, one constant: the Pacific's per-capita carbon footprint stays light, and stays light over time. This leg measures it territory by territory \u2014 the bedrock of the story.",
        a2_text:
          "Sea-surface temperature anomaly, territory by territory: the gap to the normal, year after year. Knowing how to read the ocean means being able to anticipate \u2014 for the living world, the sky and the cyclone seasons of the legs ahead.",
        a1_tag: "Leg 01",
        a2_tag: "Leg 02",
        a8_tag: "Leg 03",
        a12_tag: "Leg 04",
        a6_tag: "Leg 05",
        a7_tag: "Leg 06",
        a3_tag: "Leg 07",
        a10_tag: "Leg 08",
        a4_tag: "Leg 09",
        a5_tag: "Leg 10",
        a9_tag: "Leg 11",
        a11_tag: "Leg 12 — Synthesis",
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
      tag: "Leg 03",
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