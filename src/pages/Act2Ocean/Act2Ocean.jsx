// src/pages/Act2Ocean/Act2Ocean.jsx
// ============================================================
// Acte 02 — L'océan se réchauffe. Anomalie de température de surface de la mer
// (SST, °C ; 0 = normale 1971–2000) — données PDH/SPC (DF_CLIMATE_CHANGE ·
// SST_ANOM). Un seul signal physique : la chaleur de l'océan.
//
// ── REFONTE (dashboard pilote) ─────────────────────────────────────────────
//
// LA QUESTION. « Qu'arrive-t-il à l'océan du Pacifique ? » n'était posée
// nulle part : la thèse ne vivait que sur l'écran d'intro, court-circuité en
// mode voyage. Elle est désormais dans le board, avec la clé de lecture qui
// conditionne toutes les vues (0 = la normale 1971–2000) — celle-ci était
// enterrée dans la modale ⓘ.
//
// LE POINT FOCAL. L'acte n'avait AUCUN graphe signature : six onglets de
// poids strictement égal. « La bascule » le devient. Ce n'est pas la vue la
// plus spectaculaire (la carte et la heatmap le sont davantage), c'est celle
// qui raconte le mieux la donnée : une série, un axe, une échelle 0–100 que
// personne n'a besoin d'apprendre, un seuil naturel à 50 %, et un changement
// de régime visible à l'œil nu. Elle traduit surtout une unité abstraite
// (+0,58 °C) en une unité que tout le monde comprend : combien d'entre nous.
//
// LA FUSION. « Classement » et « Évolution » étaient, à l'écran, le même
// graphique — 21 barres horizontales triées, mêmes teintes, même densité —
// l'un portant le niveau, l'autre l'écart. Un haltère 1970 → 2025 porte les
// deux, et dit plus que les deux réunis. Six onglets deviennent cinq.
//
// LA COULEUR. Une seule rampe pour tout l'acte : la DIVERGENTE validée
// (BLEU sous la normale · gris à la normale · AMBRE au-dessus). C'est la
// seule du design system dont les deux pôles ressortent sur les DEUX
// surfaces, et l'anomalie est exactement la grandeur pour laquelle elle a
// été construite. Les pôles sont passés de lavande ↔ rouge à bleu ↔ ambre
// après mesure : 25,1 de séparation au pire cas des trois déficiences de
// perception, contre 20,4 — et le rouge saturé, trop présent dès qu'il
// couvrait de grandes surfaces, a disparu de l'acte. La couleur d'identité territoriale est retirée : avec 21
// territoires elle basculait sur la sous-région, sans légende — et la
// sous-région n'explique qu'environ un tiers de la dispersion (écart médian
// entre sous-régions 0,2 °C, contre 0,65 °C entre territoires d'une même
// année). Le canal le plus fort du graphique servait une variable muette.
// Le FILTRE sous-région reste : il a une valeur d'usage réelle.
//
// L'INCERTITUDE. La source fournit une erreur type sur chacune des 1 176
// observations ; elle était jetée au parsing. Elle est désormais lue
// (cf. pdhApi) et affichée là où elle change une lecture.
//
// 100 % données API. Aucune valeur inventée.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import AnomalyBandChart from "../../components/charts/AnomalyBandChart";
import HeatmapChart from "../../components/charts/HeatmapChart";
import CoverageChart from "../../components/charts/CoverageChart";
import ShareAboveChart from "../../components/charts/ShareAboveChart";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import SeaWarm from "../../components/SeaWarm/SeaWarm";
import useThemeTokens from "../../hooks/UseThemeTokens";
import { valAt } from "../../components/charts/echartsBase";
import "./Act2Ocean.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = Object.entries(SUBREGIONS).reduce((acc, [r, codes]) => {
  codes.forEach((c) => (acc[c] = r));
  return acc;
}, {});
const REGION_KEYS = ["all", "melanesia", "polynesia", "micronesia"];

// Seuil « l'installation » : part au-dessus de laquelle on considère que
// l'anomalie ne relève plus de l'oscillation mais d'un régime durable. Il
// n'est pas choisi par confort — il sert uniquement à DATER, dans la donnée,
// la dernière année à partir de laquelle la part ne redescend plus jamais.
const SETTLED_SHARE = 75;

export default function Act2Ocean() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  // Repli i18n : une clé absente ne doit pas afficher son propre chemin.
  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );

  const sst = useSelector(selectDataset("sst"));

  // Filtre GLOBAL (un seul jeu pour tout l'acte).
  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const ready = sst.status === "succeeded";
  const failed = sst.status === "failed";

  const allSeries = useMemo(() => {
    if (!ready || !sst.data) return [];
    return sst.data.areas
      .filter((a) => isPict(a))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        values: (sst.data.byArea[a] || [])
          .filter((p) => Number.isFinite(p.value))
          .sort((x, y) => x.year - y.year),
      }))
      .filter((s) => s.values.length);
  }, [ready, sst.data, lang]);

  const years = useMemo(() => sst.data?.years || [], [sst.data]);
  const empty = ready && years.length === 0;
  const firstYear = years[0] ?? null;
  const lastYear = years[years.length - 1] ?? null;

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);

  useEffect(() => {
    if (!playing || !years.length) return undefined;
    const id = setInterval(() => {
      setYearIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= years.length) {
          setPlaying(false);
          return years.length - 1;
        }
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const inRegion = useCallback(
    (area) => region === "all" || REGION_OF[area] === region,
    [region],
  );
  const regionSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area)),
    [allSeries, inRegion],
  );

  const pointsFor = useCallback(
    (year) =>
      regionSeries
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, year) }))
        .filter((p) => Number.isFinite(p.value)),
    [regionSeries],
  );

  // Part des territoires au-dessus de leur normale, année par année. Sert au
  // graphe signature ET à dater la bascule affichée en annotation.
  const shareByYear = useMemo(() => {
    return years.map((y) => {
      const vs = regionSeries
        .map((s) => valAt(s, y))
        .filter((v) => Number.isFinite(v));
      if (!vs.length) return { year: y, pct: null, above: 0, total: 0 };
      const above = vs.filter((v) => v > 0).length;
      return {
        year: y,
        pct: Math.round((above / vs.length) * 100),
        above,
        total: vs.length,
      };
    });
  }, [years, regionSeries]);

  // Dernière année À PARTIR DE LAQUELLE la part ne redescend plus jamais sous
  // le seuil. Lue dans la donnée, jamais écrite en dur.
  const settledYear = useMemo(() => {
    const rows = shareByYear.filter((r) => r.pct != null);
    for (let i = 0; i < rows.length; i += 1) {
      if (rows.slice(i).every((r) => r.pct >= SETTLED_SHARE)) return rows[i].year;
    }
    return null;
  }, [shareByYear]);

  const firstShare = useMemo(
    () => shareByYear.find((r) => r.pct != null) || null,
    [shareByYear],
  );
  // Annotations posées SUR la courbe : la valeur n'est plus accessible au
  // seul survol. Trois repères, pas davantage — au-delà, elles se marchent
  // dessus et deviennent du bruit.
  const shareMarks = useMemo(() => {
    const out = [];
    if (firstShare) {
      out.push({
        year: firstShare.year,
        text: `${firstShare.above}/${firstShare.total}`,
        below: firstShare.pct < 25,
      });
    }
    if (settledYear && firstShare && settledYear !== firstShare.year) {
      out.push({
        year: settledYear,
        // Repère de RÉGIME : une verticale, pas une étiquette posée sur la
        // courbe (elle passait devant la donnée).
        rule: true,
        text: tx(
          "act2.viz.share_mark_settled",
          `${settledYear} — plus jamais sous ${SETTLED_SHARE} %`,
          `${settledYear} — never below ${SETTLED_SHARE}% again`,
        ),
      });
    }
    return out;
  }, [firstShare, settledYear, tx]);

  // Haltère 1970 → 2025 : fusion du classement et de l'évolution.
  const pathRows = useMemo(
    () =>
      regionSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          a: s.values[0].value,
          b: s.values[s.values.length - 1].value,
        })),
    [regionSeries],
  );

  // ---------- Chiffres-clés ------------------------------------------------
  // RETIRÉS DE CET ÉCRAN sur demande : le sujet du dashboard, c'est le
  // graphique, et la rangée de chiffres lui prenait de la hauteur. Le
  // composant `KpiRow` n'est pas touché (il gagne au passage ses tons
  // manquants et un mode « héros ») : les chiffres seront remontés ailleurs.
  // La réponse à la question de l'acte reste lisible — c'est la courbe
  // signature elle-même, qui finit à 100 %.

  const mapPoints = useMemo(
    () => pointsFor(currentYear).map((p) => ({ ...p, year: currentYear })),
    [pointsFor, currentYear],
  );
  // Domaine SYMÉTRIQUE autour de zéro : sur une carte d'anomalie, le pas
  // neutre doit tomber sur la normale, pas au milieu des valeurs observées.
  const mapRange = useMemo(() => {
    if (!mapPoints.length) return { min: -1, max: 1 };
    const vals = mapPoints.map((p) => p.value);
    const bound = Math.max(Math.abs(Math.min(...vals)), Math.abs(Math.max(...vals))) || 1;
    return { min: -bound, max: bound };
  }, [mapPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => dispatch(loadDataset("sst")), [dispatch]);

  // Menu déroulant plutôt que quatre cartes-boutons : dans une barre
  // d'outils, quatre pastilles occupaient toute la largeur restante et
  // écrasaient les onglets. Un select natif dit la même chose en un mot,
  // reste utilisable au doigt, et se replie tout seul sur mobile.
  // `ChartFilter` existe déjà dans le projet — rien de nouveau à créer.
  // Les intitulés doivent se comprendre SANS libellé de champ : « Tous » ne
  // veut rien dire hors contexte, « Toutes les sous-régions » si.
  const regionOptions = REGION_KEYS.map((k) => ({
    value: k,
    label:
      k === "all"
        ? tx("act2.filter.all_regions", "Toutes les sous-régions", "All sub-regions")
        : t(`act1.filter.${k}`),
  }));

  const status = failed
    ? "error"
    : !ready
      ? "loading"
      : empty
        ? "empty"
        : "ready";

  const noSeries = regionSeries.length === 0;
  const noPts = currentYear != null && pointsFor(currentYear).length === 0;
  const noPath = pathRows.length === 0;

  // ---------- LES COMMANDES PASSENT AU GRAPHIQUE -----------------------
  // Elles siégeaient dans la barre de l'escale, où elles pesaient sur toute
  // la largeur, poussaient les onglets et laissaient croire à un réglage
  // d'ensemble. Chaque graphique porte désormais les siennes, dans sa colonne
  // de lecture — là où l'on voit ce qu'elles changent. L'en-tête n'a plus que
  // la navigation.
  //
  // La vue du visuel en est exemptée : le dessin a son propre sélecteur de
  // territoire et ignore ces filtres.
  const boardControls = (
    <ChartFilter
      label={t("act1.filter.title")}
      hideLabel
      value={region}
      onChange={setRegion}
      options={regionOptions}
    />
  );

  // Carte d'identité du jeu officiel (contenu 100 % i18n / métadonnées).
  const spotlightRows = [
    { k: t("act2.spotlight.r_src_k"), v: t("act2.spotlight.r_src_v") },
    { k: t("act2.spotlight.r_meas_k"), v: t("act2.spotlight.r_meas_v") },
    { k: t("act2.spotlight.r_unit_k"), v: t("act2.spotlight.r_unit_v") },
    { k: t("act2.spotlight.r_lic_k"), v: t("act2.spotlight.r_lic_v") },
  ];
  const spotlightNotes = [
    t("act2.spotlight.n1"),
    t("act2.spotlight.n2"),
    t("act2.spotlight.n3"),
    t("act2.spotlight.n4"),
  ];

  const unit = t("act2.sst_unit");

  // Provenance, écrite une fois et rappelée sous chaque clé de lecture :
  // le lecteur ne devrait jamais avoir à chercher d'où sort un chiffre.
  const SOURCE_FR =
    "NOAA / NCEI, via le Pacific Data Hub. La normale est la moyenne 1971-2000, calculée île par île.";
  const SOURCE_EN =
    "NOAA / NCEI, via the Pacific Data Hub. The normal is each island's own 1971-2000 average.";

  const charts =
    status === "ready" && currentYear != null
      ? [
          // ---------- Le visuel interactif, en ouverture -------------------
          // `SeaWarm` — le thermomètre planté dans la houle, repris de la
          // Home. C'est du SVG, entièrement interactif (sélecteur d'île,
          // mercure animé), et c'est le SEUL visuel de la Home qui porte
          // l'indicateur de cette escale : l'anomalie de température de
          // surface. Les autres (niveau de la mer, trait de côte, pluie)
          // appartiennent aux escales 07 et 03 — on ne les force pas ici.
          //
          // Il reste monté sur la Home et sur /chapitre/ocean : on l'ajoute,
          // on ne le déplace pas.
          {
            id: "sea",
            empty: noPts,
            tab: tx("act2.board.tab_thermo", "Thermomètre", "Thermometer"),
            title: tx("act2.viz.sea_title", "L'écart, île par île", "The gap, island by island"),
            finding: tx(
              "act2.viz.sea_find",
              "Le mercure monte au-dessus de la normale, descend en dessous. Choisissez une île.",
              "The mercury rises above the normal and falls below it. Pick an island.",
            ),
            takeaway: tx(
              "act2.viz.sea_take",
              "Un chiffre reste abstrait tant qu'on ne l'a pas vu bouger. Ici l'écart n'est plus une valeur dans un tableau : c'est une hauteur.",
              "A number stays abstract until you watch it move. Here the gap is no longer a value in a table: it is a height.",
            ),
            hint: tx(
              "act2.hint.sea",
              "Changez d'île avec le sélecteur sous le thermomètre.",
              "Switch islands with the selector below the thermometer.",
            ),
            legend: {
              // DEUX ENCODAGES, DEUX SEUILS — il faut dire les deux, sinon le
              // lecteur croit que la couleur redit la hauteur.
              y: tx(
                "act2.key.sea_y",
                "La hauteur du mercure, c'est l'écart de l'île à SA normale 1971-2000. Le trait plein marque la médiane des vingt-et-un territoires.",
                "The mercury height is the island's gap from ITS own 1971-2000 normal. The solid line marks the median of the twenty-one territories.",
              ),
              color: tx(
                "act2.key.sea_c2",
                "La teinte bascule au passage de cette médiane : ambre au-dessus, bleu en dessous. Elle situe l'île parmi ses voisines, pas contre sa propre normale — que tout le Pacifique dépasse désormais.",
                "The hue flips as it crosses that median: amber above, blue below. It places the island among its neighbours, not against its own normal - which the whole Pacific now exceeds.",
              ),
              note: tx("act2.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: <SeaWarm embed />,
          },

          // ---------- ★ SIGNATURE ------------------------------------------
          // Une série, un axe, une échelle bornée 0–100, un seuil naturel.
          // C'est la vue qui répond littéralement à la question de l'acte.
          {
            id: "share",
            signature: true,
            empty: noSeries,
            tab: tx("act2.board.tab_part", "Proportion", "Share"),
            // Vocabulaire aligné sur la question de l'acte (« îles ») : les
            // titres parlaient de « territoires », la question d'« îles ».
            title: tx(
              "act2.viz.share_title_short",
              "Proportion d'îles au-dessus de leur normale",
              "Share of islands above their normal",
            ),
            finding: tx(
              "act2.viz.share_find_short",
              "Chaque année, la part des îles dont l'océan dépasse sa normale.",
              "Each year, the share of islands whose ocean sits above its normal.",
            ),
            legend: {
              y: tx(
                "act2.key.share_y",
                "Combien d'îles dépassent leur normale, en %",
                "Share of islands above their normal, in %",
              ),
              x: tx(
                "act2.key.share_x",
                "Une année par point — cinquante-six en tout",
                "One point per year, 1970 to 2025",
              ),
              note: tx("act2.key.source", SOURCE_FR, SOURCE_EN),
            },
            takeaway: t("act2.board.share_take"),
            hint: tx(
              "act2.hint.share",
              "Survolez la courbe : chaque point donne l'année et le nombre d'îles concernées.",
              "Hover the line: each point gives the year and how many islands are involved.",
            ),
            controls: boardControls,
            node: (
              <ShareAboveChart
                series={regionSeries}
                years={years}
                name={tx(
                  "act2.viz.share_series",
                  "part au-dessus de la normale",
                  "share above the normal",
                )}
                refLabel={tx("act2.viz.share_ref", "la moitié", "half of them")}
                marks={shareMarks}
                countLabel={tx("act2.viz.share_count", "territoires", "territories")}
              />
            ),
          },

          // ---------- Le signal physique, en °C ----------------------------
          {
            id: "band",
            empty: noSeries,
            tab: tx("act2.board.tab_ecart", "Écart", "Gap"),
            title: t("act2.viz.band_title"),
            // La chaîne d'origine annonçait l'anomalie « moyenne » ; on trace
            // la MÉDIANE (cohérence avec les KPI, et robustesse aux valeurs
            // extrêmes). Le texte doit dire ce que le graphique fait.
            finding: tx(
              "act2.viz.band_find_median",
              "L'écart médian à la normale, et la distance qui sépare l'île la plus fraîche de la plus chaude.",
              "The median gap to the normal, and the distance between the coolest island and the warmest.",
            ),
            legend: {
              y: tx(
                "act2.key.band_y",
                "L'écart à la normale, en degrés",
                "Gap to the normal, in degrees",
              ),
              x: tx(
                "act2.key.band_x",
                "Une année par point — cinquante-six en tout",
                "One point per year, 1970 to 2025",
              ),
              color: tx(
                "act2.key.band_c",
                "Fond bleu sous la normale, ambre au-dessus. La ligne suit la médiane, la bande va de la plus fraîche à la plus chaude.",
                "Blue below the normal, amber above. The line follows the median, the band runs from coolest to warmest.",
              ),
              note: tx("act2.key.source", SOURCE_FR, SOURCE_EN),
            },
            takeaway: t("act2.board.band_take"),
            hint: tx(
              "act2.hint.band",
              "Cliquez « médiane » ou « dispersion » pour masquer une couche et isoler l'autre.",
              "Click \u00ab median \u00bb or \u00ab spread \u00bb to hide one layer and isolate the other.",
            ),
            controls: boardControls,
            node: (
              <AnomalyBandChart
                series={regionSeries}
                years={years}
                unit={unit}
                // Ces libellés existaient en i18n mais n'étaient pas passés :
                // la légende sortait en français en dur, même en anglais.
                labels={{
                  dispersion: t("act2.band_label"),
                  mean: tx("act2.median_label", "médiane", "median"),
                  ref: t("act2.baseline"),
                  uncertainty: tx("act2.uncertainty", "erreur type", "standard error"),
                }}
                centralTendency="median"
                zones
                uncertainty
              />
            ),
          },

          // ---------- Chaque territoire, chaque année ----------------------
          {
            id: "heat",
            empty: noSeries,
            tab: tx("act2.board.tab_matrice", "Matrice", "Matrix"),
            // « Une décennie d'anomalies » annonçait dix ans pour une série
            // qui en couvre cinquante-six.
            title: tx(
              "act2.viz.heat_title_span",
              "Chaque île, chaque année",
              "Every island, every year",
            ),
            finding: tx(
              "act2.viz.heat_find_polarity",
              "Toute la série d'un seul regard. Le basculement du bleu vers l'ambre se lit au milieu des années 1990.",
              "The whole series at a glance. The shift from blue to amber lands in the mid-1990s.",
            ),
            legend: {
              y: tx(
                "act2.key.heat_y",
                "Une ligne par île, la plus chaude en haut",
                "One row per island, warmest at the top, coolest at the bottom",
              ),
              x: tx(
                "act2.key.heat_x",
                "Une colonne par année, 1970 à gauche, 2025 à droite",
                "One column per year, 1970 to 2025",
              ),
              color: tx(
                "act2.key.heat_c",
                "Bleu, l'eau est restée sous sa normale cette année-là. Ambre, elle l'a dépassée.",
                "Blue: that year the water stayed below its normal. Amber: it went above.",
              ),
              note: tx("act2.key.source", SOURCE_FR, SOURCE_EN),
            },
            takeaway: t("act2.board.heat_take"),
            // La légende de valeurs est `calculable` : ses deux poignées se
            // font glisser pour n'afficher qu'une plage. C'est l'interaction
            // la plus puissante de l'escale — on isole les années au-dessus
            // de +0,5 °C et la bascule saute aux yeux — et absolument
            // personne ne la découvre sans qu'on la nomme.
            hint: tx(
              "act2.hint.heat",
              "Faites glisser les deux poignées de l'échelle, à droite : la matrice ne garde que la plage choisie. Isolez les années au-dessus de +0,5 °C, la bascule des années 1990 saute aux yeux. Survolez une case pour la valeur exacte.",
              "Drag the two handles on the scale to the right: the matrix keeps only the range you pick. Isolate the years above +0.5 °C and the 1990s shift jumps out. Hover a cell for the exact value.",
            ),
            controls: boardControls,
            node: (
              <HeatmapChart
                series={regionSeries}
                years={years}
                unit={unit}
                // Le mode « rank » découpait en quantiles : le milieu de
                // l'échelle était la médiane observée, pas la normale. Sur un
                // indicateur d'anomalie, le signe est la seule chose qui
                // compte — d'où le mode absolu et la rampe divergente,
                // centrée sur zéro.
                mode="abs"
                kind="polarity"
                order="last"
                labels={{
                  low: t("act2.heatmap_below"),
                  high: t("act2.heatmap_above"),
                }}
              />
            ),
          },

          // ---------- Fusion « classement » + « évolution » ----------------
          {
            id: "path",
            empty: noPath,
            tab: tx("act2.board.tab_evolution", "Évolution", "Change"),
            // Une seule phrase, qui dit ce qu'on regarde. Le titre et la
            // phrase de résumé faisaient doublon : « Le chemin parcouru
            // depuis 1970 » ne disait rien que la phrase suivante ne redise.
            // Le détail des couleurs vit dans la clé de lecture, à droite.
            title: tx(
              "act2.viz.path_title",
              `Le réchauffement de chaque île, de ${firstYear} à aujourd'hui`,
              `How much each island warmed, from ${firstYear} to today`,
            ),
            finding: null,
            takeaway: tx(
              "act2.viz.path_take",
              "Le départ compte autant que l'arrivée. Une île partie de très bas peut avoir beaucoup bougé sans être la plus chaude aujourd'hui.",
              "The start matters as much as the finish. An island that began far below can have travelled a long way without being the warmest today.",
            ),
            hint: tx(
              "act2.hint.path",
              "Survolez un trait pour comparer les deux années chiffre à chiffre.",
              "Hover a line to compare both years side by side.",
            ),
            legend: {
              y: tx(
                "act2.key.path_y",
                "Une ligne par île, la plus chaude en haut",
                "One row per island, warmest at the top",
              ),
              x: tx(
                "act2.key.path_x",
                "L'écart à la normale, en degrés",
                "Gap to the normal, in degrees",
              ),
              color: tx(
                "act2.key.path_c",
                `Gris : ${firstYear}. Ambre : ${lastYear}.`,
                `Grey: ${firstYear}. Amber: ${lastYear}.`,
              ),
              note: tx("act2.key.source", SOURCE_FR, SOURCE_EN),
            },
            controls: boardControls,
            node: (
              <DumbbellChart
                rows={pathRows}
                yearA={firstYear}
                yearB={lastYear}
                unit={unit}
                decimals={1}
                // 30 px par ligne réclamaient 726 px pour 21 territoires,
                // donc un défilement imbriqué dans le panneau.
                // `fill` : occuper toute la hauteur du panneau, comme les
                // autres vues de l'escale. Sans lui, 21 lignes × 22 px
                // laissaient 189 px de vide sous le graphique et la zone de
                // tracé sautait d'un onglet à l'autre.
                fill
                // Fin : l'haltère doit se lire comme un TRAJET entre deux
                // points, pas comme une barre pleine.
                barHeight="46%"
                sort="desc"
                startColor={tk.textMute}
                // Pas adouci de la rampe : 21 barres en pôle vif saturaient
                // l'écran. Les grands aplats prennent div-8, les petites
                // marques gardent div-9 (cf. ShareAboveChart).
                endColor={tk.div8}
                refX={0}
                refLabel={t("act2.ref")}
                labels={{
                  up: `${lastYear}`,
                  down: `${firstYear}`,
                }}
              />
            ),
          },

          // ---------- La carte, en fin de parcours -------------------------
          // Une carte du globe tassée dans un panneau n'est ni un graphique
          // ni une immersion : trop petite pour s'y repérer, trop grande
          // pour comparer. Cette vue n'est donc PAS un panneau, c'est une
          // PORTE : un clic, et le globe occupe l'écran. Échap ramène ici.
          {
            id: "map",
            empty: noPts,
            tab: tx("act2.board.tab_carte", "Carte", "Map"),
            title: tx("act2.viz.map_title2", "La géographie de l'écart", "The geography of the gap"),
            finding: tx(
              "act2.viz.map_find2",
              "Chaque île porte une colonne : sa hauteur suit l'écart à la normale, sa couleur en donne le sens.",
              "Each island carries a column: its height follows the gap to the normal, its colour gives the direction.",
            ),
            takeaway: t("act2.board.map_take"),
            hint: tx(
              "act2.hint.map",
              "Faites tourner le globe, zoomez, survolez une colonne. Le lecteur d'années est en bas, et le bouton en haut à droite passe en plein écran.",
              "Spin the globe, zoom in, hover a column. The year scrubber sits at the bottom, and the top-right button goes full screen.",
            ),
            legend: {
              color: tx(
                "act2.key.map_c",
                "Bleu sous la normale, ambre au-dessus. Plus la colonne est haute, plus l'écart est grand.",
                "Blue: below the normal. Amber: above. Column height follows the gap.",
              ),
              note: tx("act2.key.source", SOURCE_FR, SOURCE_EN),
            },
            controls: boardControls,
            node: (
              // La carte vit dans le flux, comme les autres vues : elle
              // réagit au filtre de sous-région et au curseur d'années, donc
              // elle doit rester manipulable sans changement de contexte.
              // Son bouton plein écran natif reste disponible pour qui veut
              // s'y plonger.
              <ErrorBoundary
                fallback={
                  <div className="board__state board__state--err">
                    {tx(
                      "act2.map_unavailable",
                      "Carte indisponible — les données, elles, sont complètes.",
                      "Map unavailable — the data itself is complete.",
                    )}
                  </div>
                }
              >
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={mapPoints}
                    unit={unit}
                    range={mapRange}
                    ramp="polarity"
                    mid={0}
                    lowLabel={t("act2.map_low")}
                    midLabel={t("act2.ref")}
                    highLabel={t("act2.map_high")}
                    noTokenMsg={tx(
                      "act2.map_no_token",
                      "Carte indisponible : clé Mapbox absente. Les données de l'escale, elles, sont complètes.",
                      "Map unavailable: no Mapbox key. The escale's data itself is complete.",
                    )}
                    years={years}
                    yearIndex={yearIdx}
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onScrub={scrubYear}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },

          // ---------- ⓘ Données & méthode -----------------------------------
          {
            id: "read",
            empty: false,
            tab: t("act2.board.tab_read"),
            title: t("act2.viz.read_title"),
            finding: t("act2.board.read_find"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act2.spotlight.ex_kicker"),
                  text: t("act2.spotlight.ex_text"),
                }}
                link={{
                  href: "https://www.ncei.noaa.gov/products/land-based-station/noaa-global-temp",
                  label: t("act2.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "coverage",
            empty: noSeries,
            tab: t("act2.board.tab_coverage"),
            title: t("act2.viz.coverage_title"),
            // Le verdict en toutes lettres : la matrice le montre, encore
            // faut-il l'écrire. 1 176 cases identiques transmettent un seul
            // bit d'information — « rien ne manque ».
            finding: (() => {
              const expected = regionSeries.length * years.length;
              const present = regionSeries.reduce(
                (n, s) => n + s.values.filter((p) => Number.isFinite(p.value)).length,
                0,
              );
              return expected
                ? tx(
                    "act2.viz.coverage_verdict",
                    `${present} valeurs présentes sur ${expected} attendues — les vides, s'il y en avait, seraient montrés tels quels, jamais comblés.`,
                    `${present} values present out of ${expected} expected — any gaps would be shown as they are, never filled in.`,
                  )
                : t("act2.board.coverage_find");
            })(),
            node: (
              <CoverageChart
                series={regionSeries}
                years={years}
                labels={{
                  present: t("act1.coverage.present"),
                  absent: t("act1.coverage.absent"),
                }}
              />
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a2_tag")}
      title={t("home.acts.a2_title")}
      // La question de l'acte. Elle n'apparaît plus DANS le dashboard : elle
      // est portée par la traversée en pirogue qui y mène. Elle reste posée
      // ici parce que l'étape 0 (hors voyage guidé) l'affiche encore, et
      // parce qu'elle doit rester au même endroit que le reste du texte de
      // l'acte. Elle se compte, et la courbe signature y répond.
      thesis={tx(
        "act2.question",
        "Combien d'îles dépassent déjà leur normale ?",
        "How many islands are already above normal?",
      )}
      // Disposition « focus » : la question et les chiffres partagent une
      // bande, onglets et filtres une ligne, et tout le reste va au
      // graphique. Mesuré avant : 460 px de donnée sur 959.
      focus
      // Ni sur-titre (« La question de cet acte ») ni sous-titre explicatif :
      // la question se suffit, et chaque ligne en plus est de la hauteur en
      // moins pour le graphique. La clé de lecture reste accessible là où
      // elle sert vraiment — le repère « référence 0 » sur les graphiques,
      // la légende « sous / au-dessus de la normale », et la fiche ⓘ.

      // L'en-tête ne porte plus de filtres : chaque graphique a les siens.
      filters={null}
      charts={charts}
      // On arrive sur le VISUEL INTERACTIF : c'est la porte d'entrée la plus
      // manipulable de l'escale. Sans cela, ActBoard choisirait le graphe
      // signature comme vue d'arrivée.
      initialTab="sea"
      nav="carousel"
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act2.board.switch_hint"),
        signature: t("act2.board.signature"),
        takeawayKicker: t("act2.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act2.board.start"),
        conclusion: t("act2.board.conclusion"),
        backIntro: t("act2.board.back_intro"),
        reviseData: t("act2.board.revise_data"),
      }}
      outro={{
        kicker: t("act2.outro.kicker"),
        title: t("act2.outro.title"),
        text: t("act2.outro.text"),
        primary: { to: "/ciel", label: t("act2.outro.next") },
        secondary: { to: "/", label: t("act2.outro.home") },
      }}
    />
  );
}
