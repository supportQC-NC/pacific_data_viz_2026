// src/pages/Act1Emissions/Act1Emissions.jsx
// ============================================================
// Acte 01 — Les émissions du Pacifique (Pacific Data Hub / SPC).
// Format DASHBOARD (composant partagé ActBoard) : un seul écran, un hero
// (thèse + chiffres-chocs), des filtres GLOBAUX (sous-région + année +
// échelle) et un graphe à la fois via onglets, dont « Classement » en
// SIGNATURE. Une ligne « à retenir » explicite sous chaque graphe.
// 100 % PDH. Aucune option ECharts ici.
//
// Vues « maîtrise de la donnée » (jury) :
//   • La donnée   : carte d'identité du jeu officiel (source, code
//     indicateur EN.GHG.ALL.PC.CE.AR5, licence CC BY 4.0, méthode,
//     précision 4–35 % national) + « lire une valeur » (exemple officiel PNG).
//   • Dénominateur : niveau médian (X) × volatilité de la série (Y =
//     écart-type / moyenne, %) — la nervosité d'un ratio par habitant
//     comme signature des petites populations. Calcul transparent,
//     entièrement dérivé de la série officielle.
//   • Couverture  : matrice binaire territoires × années (donnée
//     présente / absente) — les vides montrés, jamais comblés.
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
import useThemeTokens from "../../hooks/UseThemeTokens";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import BarRace from "../../components/BarRace/BarRace";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import FunnelChart from "../../components/charts/FunnelChart";
import RiverChart from "../../components/charts/RiverChart";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import SmokePlume from "../../components/SmokePlume/SmokePlume";
import HeatmapChart from "../../components/charts/HeatmapChart";
import CoverageChart from "../../components/charts/CoverageChart";
import ScatterChart from "../../components/charts/ScatterChart";
import EvolutionLines from "../../components/charts/EvolutionLines";
import { territoryColors } from "../../components/charts/seriesColor";
import {
  median,
  valAt,
  paletteOf,
  scatterPaletteOf,
} from "../../components/charts/echartsBase";
import "./Act1Emissions.scss";

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

/* ---------- Contrôles de filtre (globaux à l'acte) ---------- */
export default function Act1Emissions() {
  const { t, lang } = useLang();
  const tf = (key, fr, en) => {
    const v = t(key);
    return v && v !== key ? v : lang === "en" ? en : fr;
  };
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  const emissions = useSelector(selectDataset("emissions"));

  // Filtres GLOBAUX (un seul jeu pour tout l'acte).
  const [region, setRegion] = useState("all");
  const [trendCountry, setTrendCountry] = useState("all"); // filtre propre à la vue Tendance
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("emissions"));
  }, [dispatch]);

  const ready = emissions.status === "succeeded";
  const failed = emissions.status === "failed";
  const years = ready && emissions.data ? emissions.data.years : [];
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
    }, 1100);
    return () => clearInterval(id);
  }, [playing, years]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const allSeries = useMemo(() => {
    if (!ready || !emissions.data) return [];
    return Object.entries(emissions.data.byArea)
      .filter(([area]) => isPict(area))
      .map(([area, series]) => ({
        area,
        name: pictName(area, lang),
        values: series
          .filter((p) => Number.isFinite(p.value) && p.value > 0)
          .sort((a, b) => a.year - b.year),
      }))
      .filter((s) => s.values.length);
  }, [ready, emissions.data, lang]);

  const inRegion = useCallback(
    (area) => region === "all" || REGION_OF[area] === region,
    [region],
  );

  const pointsFor = useCallback(
    (year) =>
      allSeries
        .filter((s) => inRegion(s.area))
        .map((s) => ({ area: s.area, name: s.name, value: valAt(s, year) }))
        .filter((p) => Number.isFinite(p.value) && p.value > 0),
    [allSeries, inRegion],
  );

  // Repli i18n : une clé absente ne doit pas afficher son propre chemin.
  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );

  // `medianAll` a disparu avec le centrage de la carte sur la médiane :
  // la rampe est désormais séquentielle, elle n'a pas de point de pivot.


  // Couleur d'identité par territoire, PARTAGÉE par toutes les vues de l'acte
  // (évolution, classement, tendance). Indexée sur l'ordre CANONIQUE des
  // sous-régions, pas sur la liste filtrée : changer le filtre ne repeint donc
  // plus les territoires survivants. Voir charts/seriesColor.js.
  const CANONICAL = useMemo(
    () => [...SUBREGIONS.melanesia, ...SUBREGIONS.polynesia, ...SUBREGIONS.micronesia],
    [],
  );
  const colorByArea = useMemo(() => {
    const codes = allSeries.filter((s) => inRegion(s.area)).map((s) => s.area);
    return territoryColors(codes, tk, {
      canonical: region === "all" ? CANONICAL : SUBREGIONS[region] || CANONICAL,
      regionOf: REGION_OF,
      regionOrder: Object.keys(SUBREGIONS),
    }).byCode;
  }, [allSeries, inRegion, region, tk, CANONICAL]);

  // Même carte, indexée par NOM de série : EvolutionLines travaille par nom.
  // COULEUR PAR DIRECTION, pour la vue signature (base 100).
  //
  // Deux raisons de ne pas colorer par territoire ici :
  //
  //  1. Il y a jusqu'à 21 séries. Le plafond validé est de 8 teintes, jamais
  //     recyclées — au-delà, deux territoires reçoivent la même couleur ou
  //     des couleurs indiscernables. La légende affichait dix-sept pastilles.
  //  2. Ce graphique ne demande PAS « qui est qui », il demande « qui a
  //     allégé et qui a alourdi ». La couleur doit répondre à la question
  //     posée, pas à une autre.
  //
  // Ramenée à une base 100, la comparaison a un zéro qui a du sens : 100,
  // c'est le niveau de départ. C'est donc une vraie polarité, et elle prend
  // les deux pôles de la rampe divergente validée — les mêmes que l'escale
  // 02 emploie pour « au-dessus / au-dessous de la normale ».
  const colorByDirection = useMemo(() => {
    const m = {};
    allSeries.forEach((s) => {
      const vals = s.values.filter((v) => Number.isFinite(v.value));
      if (vals.length < 2) return;
      const first = vals[0].value;
      const last = vals[vals.length - 1].value;
      if (!Number.isFinite(first) || first === 0) return;
      // div-1 : l'empreinte a baissé · div-9 : elle a augmenté.
      m[s.name] = last < first ? tk.div1 : tk.div9;
    });
    return m;
  }, [allSeries, tk]);

  // Classement en FUNNEL : du plus gros émetteur au plus petit. Chaque
  // territoire garde la MÊME couleur que dans la vue Évolution.
  const rankFunnel = useMemo(
    () =>
      [...pointsFor(currentYear)]
        .sort((a, b) => b.value - a.value)
        .map((p) => ({
          label: p.name,
          value: p.value,
          color: colorByArea[p.area] || tk.textMute,
        })),
    [pointsFor, currentYear, colorByArea, tk],
  );

  // Vue Tendance : aire empilée par territoire. Options du filtre pays
  // (limitées à la sous-région courante) et séries effectivement tracées.
  const trendCountryOpts = useMemo(
    () =>
      allSeries
        .filter((s) => inRegion(s.area))
        .map((s) => ({ value: s.area, label: s.name })),
    [allSeries, inRegion],
  );
  const trendSeries = useMemo(() => {
    const base = allSeries.filter((s) => inRegion(s.area));
    if (trendCountry === "all") return base;
    const one = base.filter((s) => s.area === trendCountry);
    return one.length ? one : base;
  }, [allSeries, inRegion, trendCountry]);

  const subNames = useMemo(
    () => ({
      melanesia: t("act1.filter.melanesia"),
      polynesia: t("act1.filter.polynesia"),
      micronesia: t("act1.filter.micronesia"),
    }),
    [t],
  );

  const regionSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area)),
    [allSeries, inRegion],
  );

  // Nuage niveau × évolution (groupé par sous-région).
  const scatterGroups = useMemo(() => {
    // Un nuage de points est une forme TOUTES-PAIRES (chaque groupe côtoie
    // tous les autres) : plafond à 3 séries validées. Les 3 sous-régions
    // tombent juste. Même source que `volGroups` plus bas — sans quoi les deux
    // nuages du MÊME acte donnaient des couleurs différentes aux mêmes
    // sous-régions (avant : cyan/corail/violet codés en dur, hors charte et
    // insensibles au thème).
    const palette = scatterPaletteOf(tk);
    const inReg = allSeries.filter((s) => inRegion(s.area));
    return Object.keys(SUBREGIONS)
      .map((reg, i) => ({
        name: subNames[reg],
        color: palette[i] || tk.textMute,
        points: inReg
          .filter((s) => REGION_OF[s.area] === reg)
          .map((s) => {
            const last = valAt(s, lastYear);
            const first = valAt(s, firstYear);
            if (!Number.isFinite(last) || !Number.isFinite(first) || first <= 0)
              return null;
            return {
              name: s.name,
              x: Number(last.toFixed(2)),
              y: Number((((last - first) / first) * 100).toFixed(1)),
            };
          })
          .filter(Boolean),
      }))
      .filter((g) => g.points.length);
  }, [allSeries, lastYear, firstYear, subNames, inRegion, tk]);

  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  // « L'effet dénominateur, démontré » : niveau médian de la série (X) face
  // à sa volatilité (Y = écart-type / moyenne, en %). Entièrement dérivé de
  // la série officielle — calcul transparent, aucune donnée externe.
  const volGroups = useMemo(() => {
    const palette = paletteOf(tk);
    const inReg = allSeries.filter((s) => inRegion(s.area));
    return Object.keys(SUBREGIONS)
      .map((reg, i) => ({
        name: subNames[reg],
        color: palette[i],
        points: inReg
          .filter((s) => REGION_OF[s.area] === reg && s.values.length >= 5)
          .map((s) => {
            const vals = s.values.map((p) => p.value);
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            if (!Number.isFinite(mean) || mean <= 0) return null;
            const sd = Math.sqrt(
              vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length,
            );
            const lvl = median(vals);
            if (!Number.isFinite(sd) || !Number.isFinite(lvl)) return null;
            return {
              name: s.name,
              x: Number(lvl.toFixed(2)),
              y: Number(((sd / mean) * 100).toFixed(1)),
            };
          })
          .filter(Boolean),
      }))
      .filter((g) => g.points.length);
  }, [allSeries, subNames, inRegion, tk]);

  const volMedianX = useMemo(
    () => median(volGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [volGroups],
  );

  // Évolution nette depuis le début des données (dernière − première valeur).
  // delta < 0 = baisse (s'améliore) ; delta > 0 = hausse (empire).
  // Chiffres-chocs (PDH).
  // Chiffres-clés RETIRÉS de cet écran, comme sur l'escale 02 : le sujet du
  // dashboard, c'est le graphique. Le composant KpiRow n'est pas touché ; les
  // chiffres seront remontés ailleurs.

  const mapPoints = useMemo(
    () => pointsFor(currentYear).map((p) => ({ ...p, year: currentYear })),
    [pointsFor, currentYear],
  );
  const mapRange = useMemo(() => {
    if (!mapPoints.length) return { min: 0, max: 1 };
    const vals = mapPoints.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [mapPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(
    () => dispatch(loadDataset("emissions")),
    [dispatch],
  );

  // Menu déroulant plutôt que des cartes-boutons : dans la barre d'escale,
  // quatre pastilles écrasaient les onglets. Les intitulés se comprennent
  // sans libellé de champ. Même composant et même réglage que l'escale 02.
  const regionOptions = REGION_KEYS.map((k) => ({
    value: k,
    label:
      k === "all"
        ? tx("act1.filter.all_regions", "Toutes les sous-régions", "All sub-regions")
        : t(`act1.filter.${k}`),
  }));

  const status = failed
    ? "error"
    : !ready
      ? "loading"
      : empty
        ? "empty"
        : "ready";

  // Présence de données pour la région/année courante (évite l'axe vide 0–1).
  const noPts = currentYear != null && pointsFor(currentYear).length === 0;
  const noSeries = regionSeries.length === 0;
  const noScatter = scatterGroups.length === 0;
  const noVol = volGroups.length === 0;

  const filtersEl = (
    <ChartFilter
      label={t("act1.filter.title")}
      hideLabel
      value={region}
      onChange={setRegion}
      options={regionOptions}
    />
  );

  // Provenance, écrite une fois et rappelée sous chaque clé de lecture :
  // le lecteur ne devrait jamais avoir à chercher d'où sort un chiffre.
  const SOURCE_FR =
    "Pacific Data Hub (.Stat) — SPC. Gaz à effet de serre par habitant, en tonnes équivalent CO2.";
  const SOURCE_EN =
    "Pacific Data Hub (.Stat) — SPC. Greenhouse gases per person, in tonnes of CO2 equivalent.";

  // Carte d'identité du jeu officiel (contenu 100 % i18n / métadonnées).
  const spotlightRows = [
    { k: t("act1.spotlight.r_src_k"), v: t("act1.spotlight.r_src_v") },
    { k: t("act1.spotlight.r_code_k"), v: t("act1.spotlight.r_code_v") },
    { k: t("act1.spotlight.r_unit_k"), v: t("act1.spotlight.r_unit_v") },
    { k: t("act1.spotlight.r_lic_k"), v: t("act1.spotlight.r_lic_v") },
  ];
  const spotlightNotes = [
    t("act1.spotlight.n1"),
    t("act1.spotlight.n2"),
    t("act1.spotlight.n3"),
    t("act1.spotlight.n4"),
  ];

  const charts =
    status === "ready" && currentYear != null
      ? [
          // ---------- Le visuel interactif, en ouverture -------------------
          // `SmokePlume` — le panache repris de la Home. C'est du SVG,
          // interactif (sélecteur de territoire, panache animé), et c'est le
          // seul visuel de la Home qui porte l'indicateur de cette escale :
          // les émissions par habitant. Il reste monté sur la Home : on
          // l'ajoute, on ne le déplace pas.
          {
            id: "plume",
            empty: noPts,
            tab: tx("act1.board.tab_panache", "Panache", "Plume"),
            title: tx("act1.viz.plume_title", "L'empreinte, territoire par territoire", "The footprint, territory by territory"),
            finding: tx(
              "act1.viz.plume_find",
              "Le panache grossit avec les émissions par habitant. Choisissez un territoire.",
              "The plume grows with emissions per person. Pick a territory.",
            ),
            takeaway: tx(
              "act1.viz.plume_take",
              "Un chiffre par habitant reste abstrait tant qu'on ne l'a pas vu à côté d'un autre. Ici l'empreinte se compare d'un coup d'œil.",
              "A per-person figure stays abstract until you see it next to another. Here the footprint compares at a glance.",
            ),
            hint: tx(
              "act1.hint.plume",
              "Changez de territoire avec le sélecteur sous le panache.",
              "Switch territory with the selector below the plume.",
            ),
            legend: {
              color: tx(
                "act1.key.plume_c",
                "La densité du panache suit les émissions par habitant du territoire choisi.",
                "The plume's density follows the chosen territory's emissions per person.",
              ),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: <SmokePlume embed />,
          },

          {
            id: "race",
            empty: noSeries,
            tab: tx("act1.board.tab_course", "Course", "Race"),
            title: t("act1.viz.race_title"),
            finding: t("act1.board.race_find"),
            takeaway: t("act1.board.race_take"),
            hint: tx(
              "act1.hint.race",
              "Lancez la course et regardez l'ordre : il change à peine en cinquante ans.",
              "Start the race and watch the order: it barely moves in fifty years.",
            ),
            legend: {
              y: tx("act1.key.race_y", "Un territoire par barre, le plus émetteur en haut", "One territory per bar, biggest emitter on top"),
              x: tx("act1.key.race_x", "Émissions par habitant, en tonnes", "Emissions per person, in tonnes"),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: (
              <BarRace
                series={regionSeries}
                years={years}
                unit={t("act1.unit")}
                tk={tk}
                labels={{
                  play: t("act1.race.play"),
                  pause: t("act1.race.pause"),
                  restart: t("act1.race.restart"),
                }}
              />
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act1.board.tab_read"),
            title: t("act1.viz.read_title"),
            finding: t("act1.board.read_find"),
            takeaway: t("act1.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act1.spotlight.ex_kicker"),
                  text: t("act1.spotlight.ex_text"),
                }}
                link={{
                  href: "https://data.worldbank.org/indicator/EN.GHG.ALL.PC.CE.AR5",
                  label: t("act1.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "rank",
            empty: noPts,
            tab: tx("act1.board.tab_classement", "Classement", "Ranking"),
            title: t("act1.viz.rank_title"),
            finding: t("act1.board.rank_find"),
            takeaway: t("act1.board.rank_take"),
            hint: tx(
              "act1.hint.rank",
              "Survolez une barre pour la valeur exacte. Changez de sous-région dans la barre du haut.",
              "Hover a bar for the exact value. Switch sub-region in the top bar.",
            ),
            legend: {
              y: tx("act1.key.rank_y", "Un territoire par barre, du plus émetteur au plus sobre", "One territory per bar, from biggest emitter to lowest"),
              x: tx("act1.key.rank_x", "Émissions par habitant, en tonnes", "Emissions per person, in tonnes"),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: <FunnelChart points={rankFunnel} unit={t("act1.unit")} />,
          },
          {
            id: "trend",
            empty: noSeries,
            tab: tx("act1.board.tab_traj", "Trajectoires", "Paths"),
            title: t("act1.viz.trend_title"),
            finding: t("act1.board.trend_find"),
            takeaway: t("act1.board.trend_take"),
            hint: tx(
              "act1.hint.trend",
              "Choisissez un territoire dans le menu au-dessus du graphique pour isoler sa trajectoire.",
              "Pick a territory in the menu above the chart to isolate its path.",
            ),
            legend: {
              y: tx("act1.key.trend_y", "Émissions par habitant, en tonnes", "Emissions per person, in tonnes"),
              x: tx("act1.key.trend_x", "Une année par point", "One point per year"),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: (
              <div className="chartview">
                <ChartFilter
                  label={tf(
                    "act1.trend.country_label",
                    "Territoire",
                    "Territory",
                  )}
                  value={trendCountry}
                  onChange={setTrendCountry}
                  options={[
                    {
                      value: "all",
                      label: tf(
                        "act1.trend.country_all",
                        "Tous les territoires",
                        "All territories",
                      ),
                    },
                    ...trendCountryOpts,
                  ]}
                />
                <div className="chartview__chart">
                  <RiverChart
                    subAvg={trendSeries}
                    years={years}
                    compactLegend
                    // PAS d'empilement : on ne peut pas additionner des
                    // tonnes PAR HABITANT. Empilées, les 21 séries donnaient
                    // un axe montant à plusieurs dizaines de tonnes pour une
                    // région dont la médiane est inférieure à 1 — un total
                    // qui n'existe nulle part.
                    stack={false}
                  />
                </div>
              </div>
            ),
          },
          {
            id: "change",
            empty: noSeries,
            // SIGNATURE. C'est la vue qui porte le paradoxe de l'escale :
            // ramenées à une base commune, cinquante ans de trajectoires
            // restent plates. Le développement du Pacifique ne s'est pas payé
            // en carbone par habitant — et cela ne se voit que sur une base
            // 100, pas sur des valeurs brutes qui vont du simple au décuple.
            signature: true,
            tab: tx("act1.board.tab_evolution", "Évolution", "Change"),
            title: t("act1.board.change_title"),
            finding: t("act1.board.change_find"),
            // La chaîne d'origine annonçait « en vert / en rouge » alors que
            // la couleur suivait le territoire : le texte décrivait un
            // encodage qui n'existait pas. Il décrit maintenant celui qui
            // existe — et la paire vert/rouge, indiscernable pour près d'un
            // homme sur douze, ne revient pas par la porte du texte.
            takeaway: tx(
              "act1.viz.change_take2",
              "En bleu, les territoires qui ont allégé leur empreinte depuis leur première année ; en ambre, ceux qui l'ont alourdie. La plupart des courbes restent collées à 100 : cinquante ans de développement, à empreinte constante.",
              "In blue, the territories that lightened their footprint since their first year; in amber, those that increased it. Most curves stay glued to 100: fifty years of development at a constant footprint.",
            ),
            hint: tx(
              "act1.hint.change",
              "Cliquez un territoire dans la légende pour le masquer, et isolez ceux qui bougent vraiment.",
              "Click a territory in the legend to hide it, and isolate the ones that actually move.",
            ),
            legend: {
              y: tx("act1.key.change_y", "Base 100 à la première année : 100 = même niveau qu'au départ", "Base 100 at the first year: 100 = same level as the start"),
              x: tx("act1.key.change_x", "Une année par point", "One point per year"),
              color: tx(
                "act1.key.change_c",
                "Bleu, l'empreinte a baissé depuis la première année. Ambre, elle a augmenté.",
                "Blue, the footprint went down since the first year. Amber, it went up.",
              ),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: (
              <EvolutionLines
                series={regionSeries}
                years={years}
                unit={t("act1.unit")}
                mode="index"
                colorBy={colorByDirection}
                labels={{ base: tf("act1.evo.base", "base 100", "base 100") }}
              />
            ),
          },
          {
            id: "scatter",
            empty: noScatter,
            tab: tx("act1.board.tab_croisement", "Croisement", "Crossing"),
            title: t("act1.viz.scatter_title"),
            finding: t("act1.board.scatter_find"),
            takeaway: t("act1.board.scatter_take"),
            hint: tx(
              "act1.hint.scatter",
              "Survolez un point pour le nommer. Le quadrant bas-gauche réunit les sobres qui baissent encore.",
              "Hover a dot to name it. The lower-left quadrant holds the low emitters still going down.",
            ),
            legend: {
              y: tx("act1.key.scatter_y", "Évolution depuis la première année", "Change since the first year"),
              x: tx("act1.key.scatter_x", "Niveau actuel par habitant, échelle logarithmique", "Current level per person, logarithmic scale"),
              color: tx("act1.key.scatter_c", "Une teinte par sous-région : Mélanésie, Polynésie, Micronésie.", "One hue per sub-region: Melanesia, Polynesia, Micronesia."),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: (
              <ScatterChart
                groups={scatterGroups}
                unit={t("act1.unit")}
                medianX={scatterMedianX}
                logX
              />
            ),
          },
          {
            id: "denom",
            empty: noVol,
            tab: tx("act1.board.tab_volatilite", "Volatilité", "Volatility"),
            title: t("act1.viz.denom_title"),
            finding: t("act1.board.denom_find"),
            takeaway: t("act1.board.denom_take"),
            hint: tx(
              "act1.hint.denom",
              "Survolez un point : les plus nerveux sont presque toujours les moins peuplés.",
              "Hover a dot: the jumpiest are almost always the least populated.",
            ),
            legend: {
              y: tx("act1.key.denom_y", "Nervosité de la série : écart entre ses années extrêmes", "How jumpy the series is: gap between its extreme years"),
              x: tx("act1.key.denom_x", "Niveau médian sur toute la période", "Median level over the whole period"),
              color: tx("act1.key.denom_c", "Une teinte par sous-région : Mélanésie, Polynésie, Micronésie.", "One hue per sub-region: Melanesia, Polynesia, Micronesia."),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: (
              <ScatterChart
                groups={volGroups}
                unit={t("act1.unit")}
                medianX={volMedianX}
                xName={`${t("act1.denom.x")} (${t("act1.unit")})`}
                yName={t("act1.denom.y")}
              />
            ),
          },
          {
            id: "heat",
            empty: noSeries,
            tab: tx("act1.board.tab_matrice", "Matrice", "Matrix"),
            title: t("act1.viz.heat_title"),
            finding: t("act1.board.heat_find"),
            takeaway: t("act1.board.heat_take"),
            node: (
              <HeatmapChart
                series={regionSeries}
                years={years}
                // Lignes triées par la dernière année : une matrice dont
                // l'ordre ne vient de rien ne peut pas faire apparaître de
                // groupes.
                order="last"
                unit={t("act1.unit")}
                mode="rank"
                /* Pas de `ramp` locale : on laisse HeatmapChart appliquer la
                   rampe ORDINALE validée (une seule teinte, clair → sombre).
                   L'ancienne rampe codée en dur ici encodait la magnitude par
                   la TEINTE (vert → sable → terracotta), donc illisible en
                   niveaux de gris et pour un daltonien. */
                labels={{
                  low: t("act1.heatmap.low"),
                  high: t("act1.heatmap.high"),
                }}
              />
            ),
          },
          {
            id: "map",
            empty: noPts,
            tab: tx("act1.board.tab_carte", "Carte", "Map"),
            title: t("act1.viz.map_title"),
            finding: t("act1.board.map_find"),
            takeaway: t("act1.board.map_take"),
            hint: tx(
              "act1.hint.map",
              "Faites tourner le globe, zoomez, survolez une colonne. Le lecteur d'années est en bas, et le bouton en haut à droite passe en plein écran.",
              "Spin the globe, zoom in, hover a column. The year scrubber sits at the bottom, and the top-right button goes full screen.",
            ),
            legend: {
              color: tx("act1.key.map_c", "Plus la colonne est haute et claire, plus le territoire émet par habitant. Échelle logarithmique : les écarts vont du simple au décuple.", "The taller and lighter the column, the more the territory emits per person. Logarithmic scale: the gaps run from one to tenfold."),
              note: tx("act1.key.source", SOURCE_FR, SOURCE_EN),
            },
            node: (
              <ErrorBoundary
                fallback={
                  <div className="board__state board__state--err">
                    {t("scene.error")}
                  </div>
                }
              >
                <Suspense
                  fallback={<Loader compact label={t("scene.loading")} />}
                >
                  <OceanMap
                    data={mapPoints}
                    unit={t("act1.unit")}
                    range={mapRange}
                    logScale
                    // Rampe SÉQUENTIELLE, pas divergente. Les émissions par
                    // habitant sont une grandeur orientée sans zéro qui ait
                    // un sens : être sous la médiane du Pacifique n'est pas
                    // une polarité, c'est un rang — et cette médiane bouge
                    // avec le filtre et avec l'année, si bien que le même
                    // territoire changeait de couleur sans avoir bougé.
                    ramp="magnitude"
                    mid={null}
                    lowLabel={t("act1.map_low")}
                    midLabel={t("act1.ref_median")}
                    highLabel={t("act1.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
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
          {
            id: "coverage",
            empty: noSeries,
            tab: t("act1.board.tab_coverage"),
            title: t("act1.viz.coverage_title"),
            finding: t("act1.board.coverage_find"),
            takeaway: t("act1.board.coverage_take"),
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
      eyebrow={t("home.acts.a1_tag")}
      title={t("home.acts.a1_title")}
      // La question de l'escale n'apparaît plus DANS le dashboard : elle est
      // portée par la traversée en pirogue qui y mène. Elle reste posée ici
      // parce que l'étape 0 (hors voyage guidé) l'affiche encore.
      thesis={t("act1.thesis")}
      // Chiffres-clés retirés de cet écran, comme sur l'escale 02 : le sujet
      // du dashboard, c'est le graphique. Le composant KpiRow reste intact,
      // ils seront remontés ailleurs.
      filters={filtersEl}
      charts={charts}
      // Disposition du template : barre unique, colonne de lecture, décor de
      // l'escale, hauteurs égales. Voir ActBoard.scss § FOCUS.
      focus
      nav="carousel"
      // On arrive sur le visuel interactif, comme sur l'escale 02.
      initialTab="plume"
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act1.board.switch_hint"),
        signature: t("act1.board.signature"),
        takeawayKicker: t("act1.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act1.board.start"),
        conclusion: t("act1.board.conclusion"),
        backIntro: t("act1.board.back_intro"),
        reviseData: t("act1.board.revise_data"),
        // Pas de libellé « Vue » : dans la barre d'escale fusionnée, les
        // onglets numérotés se comprennent seuls et ce mot leur volait une
        // ligne. L'escale 02 n'en passe pas non plus.
      }}
      outro={{
        kicker: t("act1.outro.kicker"),
        title: t("act1.outro.title"),
        text: t("act1.outro.text"),
        primary: { to: "/ocean", label: t("act1.outro.next") },
        secondary: { to: "/", label: t("act1.outro.home") },
      }}
    />
  );
}
