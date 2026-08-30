// src/pages/Act7Vivant/Act7Vivant.jsx
// ============================================================
// Acte 07 — Le vivant : Indice Liste Rouge (biodiversité) & pêche durable.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (mesure + sous-région +
// territoire), tendance régionale en SIGNATURE. Ajouts storytelling :
// course animée (BarRace) + carte 3D (géographie). 6 onglets.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchVivant } from "../../services/vivantApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import figuresFromBundle from "../../components/KeyFigures/fromBundle";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import ApexYearHeatmap from "../../components/charts/ApexYearHeatmap";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import BarRace from "../../components/BarRace/BarRace";
// Le visuel de la Home qui porte l'indicateur de cette escale. Il reste
// monté sur la page d'accueil : on l'ajoute ici, on ne le déplace pas.
import BiodiversityReef from "../../components/BiodiversityReef/BiodiversityReef";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act7Vivant.scss";

// Les deux indicateurs de l'escale sont de NATURES différentes — le premier
// estime, le second dénombre — et chacun se lit contre sa propre référence.
// La source est donc écrite par indicateur, jamais mutualisée.
const SOURCE_RL_FR =
  "Indice Liste Rouge de l'UICN, indicateur ODD 15.5.1, via le Pacific Data Hub. C'est une ESTIMATION agrégée sur les groupes évalués, pas un décompte d'espèces.";
const SOURCE_RL_EN =
  "IUCN Red List Index, SDG indicator 15.5.1, via the Pacific Data Hub. It is an aggregate ESTIMATE over assessed groups, not a species count.";
const SOURCE_FISH_FR =
  "FAOLEX / FAO, via le Pacific Data Hub — décompte CUMULATIF des mesures de gestion des pêches en vigueur. Un total qui monte dit une activité réglementaire, pas un état du stock.";
const SOURCE_FISH_EN =
  "FAOLEX / FAO, via the Pacific Data Hub - CUMULATIVE count of fisheries-management measures in force. A rising total shows regulatory activity, not stock health.";

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


function valueAt(values, year) {
  if (!values || !values.length) return null;
  let out = null;
  for (const p of values) {
    if (p.year === year) return p.value;
    if (p.year <= year) out = p.value;
  }
  return out;
}
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function toSeries(ind, lang) {
  if (!ind || ind.status !== "live") return [];
  return (ind.areas || [])
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (ind.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }))
    .filter((s) => s.values.length);
}
function buildRank(series, year) {
  return series
    .map((s) => ({
      area: s.area,
      name: s.name,
      value: valueAt(s.values, year),
    }))
    .filter((r) => Number.isFinite(r.value));
}
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => ({
      area: s.area,
      name: s.name,
      a: valueAt(s.values, yearA),
      b: valueAt(s.values, yearB),
    }))
    .filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b));
}
function medianLine(series, years, name) {
  const vals = years
    .map((y) => {
      const v = series
        .map((s) => valueAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      const m = median(v);
      return m == null ? null : { year: y, value: m };
    })
    .filter(Boolean);
  return vals.length ? [{ area: "MED", name, values: vals }] : [];
}
// Course : report en avant de la dernière valeur connue (animation fluide).
function raceFrom(series, years, lang) {
  return series
    .map((s) => {
      const sorted = [...s.values].sort((a, b) => a.year - b.year);
      let last = null;
      const values = years.map((y) => {
        const ex = sorted.find((p) => p.year === y);
        if (ex) last = ex.value;
        return { year: y, value: last == null ? 0 : last };
      });
      return { area: s.area, name: pictName(s.area, lang), values };
    })
    .filter((r) => r.values.some((v) => v.value > 0));
}

export default function Act7Vivant() {
  const { t, lang } = useLang();

  // Repli littéral quand la clé n'est pas encore versée dans les dictionnaires
  // (`t()` renvoie le chemin pointé, qui ne doit jamais atteindre l'écran).
  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [metric, setMetric] = useState("redlist");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchVivant({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const data = state.data;
  const rl = data?.redList;
  const fish = data?.fishMgmt;

  const rlAll = useMemo(() => toSeries(rl, lang), [rl, lang]);
  const fishAll = useMemo(() => toSeries(fish, lang), [fish, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const rlSeries = useMemo(
    () => rlAll.filter((s) => areaVisible(s.area)),
    [rlAll, areaVisible],
  );
  const fishSeries = useMemo(
    () => fishAll.filter((s) => areaVisible(s.area)),
    [fishAll, areaVisible],
  );

  const regionLabel =
    country !== "all" ? pictName(country, lang) : t(`act1.filter.${region}`);
  const medName = `${regionLabel} · ${t("act7.median_name")}`;

  const rlA = rl?.firstYear ?? rl?.years?.[0] ?? 1993;
  const rlB = rl?.lastYear ?? rl?.years?.[rl?.years?.length - 1] ?? 2024;
  const fishA = fish?.firstYear ?? fish?.years?.[0] ?? 1980;
  const fishB =
    fish?.lastYear ?? fish?.years?.[fish?.years?.length - 1] ?? 2024;

  const rlYears = useMemo(() => rl?.years || [], [rl]);
  const fishYears = useMemo(() => fish?.years || [], [fish]);

  const rlRank = useMemo(() => buildRank(rlSeries, rlB), [rlSeries, rlB]);
  const rlDumb = useMemo(
    () => buildDumbbell(rlSeries, rlA, rlB),
    [rlSeries, rlA, rlB],
  );
  const rlMed = useMemo(() => median(rlRank.map((r) => r.value)), [rlRank]);
  const rlLine = useMemo(
    () => medianLine(rlSeries, rlYears, medName),
    [rlSeries, rlYears, medName],
  );
  const rlRace = useMemo(
    () => raceFrom(rlSeries, rlYears, lang),
    [rlSeries, rlYears, lang],
  );

  const fishRank = useMemo(
    () => buildRank(fishSeries, fishB),
    [fishSeries, fishB],
  );
  const fishDumb = useMemo(
    () => buildDumbbell(fishSeries, fishA, fishB),
    [fishSeries, fishA, fishB],
  );
  const fishMed = useMemo(
    () => median(fishRank.map((r) => r.value)),
    [fishRank],
  );
  const fishLine = useMemo(
    () => medianLine(fishSeries, fishYears, medName),
    [fishSeries, fishYears, medName],
  );
  const fishRace = useMemo(
    () => raceFrom(fishSeries, fishYears, lang),
    [fishSeries, fishYears, lang],
  );

  const isRl = metric === "redlist";
  const metricDecimals = isRl ? 2 : 0;
  const M = useMemo(
    () =>
      isRl
        ? {
            series: rlSeries,
            line: rlLine,
            dumb: rlDumb,
            rank: rlRank,
            race: rlRace,
            med: rlMed,
            years: rlYears,
            unit: t("act7.redlist_unit"),
            A: rlA,
            B: rlB,
          }
        : {
            series: fishSeries,
            line: fishLine,
            dumb: fishDumb,
            rank: fishRank,
            race: fishRace,
            med: fishMed,
            years: fishYears,
            unit: t("act7.fish_unit"),
            A: fishA,
            B: fishB,
          },
    [
      isRl, t,
      rlSeries, rlLine, rlDumb, rlRank, rlRace, rlMed, rlYears, rlA, rlB,
      fishSeries, fishLine, fishDumb, fishRank, fishRace, fishMed, fishYears, fishA, fishB,
    ],
  );

  // Ce que portent les axes et la couleur CHANGE avec l'indicateur : une
  // estimation bornée 0-1 d'un côté, un cumul de textes réglementaires de
  // l'autre. Une clé écrite pour l'escale entière mentirait sur l'un des deux.
  const key = isRl
    ? {
        y: tx(
          "act7.key.rl_y",
          "Indice Liste Rouge, de 0 à 1. 1 signifie qu'aucune espèce évaluée n'est menacée ; plus l'indice descend, plus le risque d'extinction est élevé.",
          "Red List Index, from 0 to 1. 1 means no assessed species is threatened; the lower it goes, the higher the extinction risk.",
        ),
        x: tx("act7.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act7.key.rl_c",
          "Une seule teinte, du plus faible au plus élevé. Ici c'est le BAS de l'échelle qui alerte : un indice élevé est une bonne nouvelle.",
          "A single hue, lowest to highest. Here it is the BOTTOM of the scale that warns: a high index is good news.",
        ),
        note: tx("act7.key.rl_note", SOURCE_RL_FR, SOURCE_RL_EN),
        swatch: "magnitude",
      }
    : {
        y: tx(
          "act7.key.fish_y",
          "Nombre de mesures de gestion des pêches en vigueur, en cumul. La courbe ne peut que monter ou rester plate : rien ne se retranche.",
          "Number of fisheries-management measures in force, cumulative. The line can only rise or stay flat: nothing is ever subtracted.",
        ),
        x: tx("act7.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act7.key.fish_c",
          "Une seule teinte : plus elle est marquée, plus le territoire a adopté de mesures. C'est une grandeur, sans jugement de valeur.",
          "A single hue: the stronger it is, the more measures the territory has adopted. A magnitude, with no value judgement.",
        ),
        note: tx("act7.key.fish_note", SOURCE_FISH_FR, SOURCE_FISH_EN),
        swatch: "magnitude",
      };

  const titles = isRl
    ? {
        trend: t("act7.regional_rl_title"),
        multiples: t("act7.redlist_title"),
        heat: t("act7.rl_heatmap_title"),
        change: t("act7.rl_compare_title"),
      }
    : {
        trend: t("act7.regional_fish_title"),
        multiples: t("act7.fish_title"),
        heat: t("act7.fish_heatmap_title"),
        change: t("act7.fish_compare_title"),
      };

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    return xs.length
      ? { min: Math.min(...xs), max: Math.max(...xs) }
      : { min: 0, max: 1 };
  }, [M.series]);

  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchVivant({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  // Deux JEUX DE DONNÉES traités à égalité, basculés par icônes.
  const metricItems = [
    {
      id: "redlist",
      label: t("act7.board.metric_rl"),
      icon: "leaf",
      tone: "positive",
    },
    {
      id: "fish",
      label: t("act7.board.metric_fish"),
      icon: "fish",
      tone: "accent",
    },
  ];
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));

  const status =
    state.status === "ready"
      ? M.series.length
        ? "ready"
        : "empty"
      : state.status === "loading"
        ? "loading"
        : "empty";

  // Les deux sélecteurs de l'escale passent en menus déroulants. Les listes
  // d'items existantes ({ id, label, … }) sont réutilisées telles quelles :
  // on ne les redéfinit pas, on les adapte à la forme attendue.
  const asOptions = (items) =>
    (items || []).map((it) => ({ value: it.id, label: it.label }));

  // ---------- LES COMMANDES PASSENT AU GRAPHIQUE -----------------------
  // Elles siégeaient dans la barre de l'escale, où elles pesaient sur toute
  // la largeur, poussaient les onglets et laissaient croire à un réglage
  // d'ensemble. Chaque graphique porte désormais les siennes, dans sa colonne
  // de lecture — là où l'on voit ce qu'elles changent. L'en-tête n'a plus que
  // la navigation.
  //
  // La vue des visuels en est exemptée : les dessins ont leur propre
  // sélecteur de territoire et ignorent ces filtres.
  const boardControls = (
    <>
      <ChartFilter
        label={t("act7.board.metric_label")}
        hideLabel
        value={metric}
        onChange={setMetric}
        options={asOptions(metricItems)}
      />
      <ChartFilter
        label={t("act1.filter.title")}
        hideLabel
        value={region}
        onChange={(k) => {
        setRegion(k);
        setCountry("all");
      }}
        options={asOptions(regionItems)}
      />
    </>
  );

  // Carte d'identité DOUBLE (Liste Rouge + pêches) — 100 % i18n / fiches officielles.
  const spotlightRows = [
    { k: t("act7.spotlight.r1k"), v: t("act7.spotlight.r1v") },
    { k: t("act7.spotlight.r2k"), v: t("act7.spotlight.r2v") },
    { k: t("act7.spotlight.r3k"), v: t("act7.spotlight.r3v") },
    { k: t("act7.spotlight.r4k"), v: t("act7.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act7.spotlight.n1"),
    t("act7.spotlight.n2"),
    t("act7.spotlight.n3"),
    t("act7.spotlight.n4"),
    t("act7.spotlight.n5"),
  ];

  // ---------- LES CHIFFRES À EMPORTER ----------
  // Trois nombres tirés du bundle de la mesure courante : ils changent avec le
  // sélecteur, comme le reste de l'escale. Le lecteur qui ne lit rien d'autre
  // repart au moins avec un ordre de grandeur et la période sur laquelle il
  // vaut. Voir components/KeyFigures/fromBundle.js.
  const figures = useMemo(
    () =>
      figuresFromBundle(M, {
        median: tx("act7.fig.median", "Médiane du Pacifique", "Pacific median"),
        edge: tx("act7.fig.edge", "La valeur extrême", "The extreme value"),
        span: tx("act7.fig.span", "Période couverte", "Period covered"),
        years: tx("act7.fig.years", "années", "years"),
      }),
    [M, tx],
  );

  const charts =
    status === "ready"
      ? [
          // ---------- Le visuel interactif, en ouverture -------------------
          // `BiodiversityReef` — le récif de la Home, en SVG et interactif
          // (sélecteur de territoire, coraux qui blanchissent). C'est le seul
          // visuel de la Home qui porte l'indicateur de cette escale. Il reste
          // monté sur la page d'accueil ; on l'ajoute ici, on ne le déplace pas.
          //
          // Il ouvre l'escale parce qu'un indice entre 0 et 1 ne dit rien à
          // qui ne l'a jamais manipulé : le récif lui donne une forme avant
          // que les courbes ne le mettent en série.
          {
            id: "reef",
            empty: false,
            tab: tx("act7.board.tab_recif", "Récif", "Reef"),
            title: tx(
              "act7.viz.reef_title",
              "Le vivant, territoire par territoire",
              "Life, territory by territory",
            ),
            finding: tx(
              "act7.viz.reef_find",
              "Choisissez un territoire : le récif suit son indice Liste Rouge.",
              "Pick a territory: the reef follows its Red List Index.",
            ),
            takeaway: tx(
              "act7.viz.reef_take",
              "L'indice Liste Rouge est une estimation, pas un décompte d'espèces. Le récif ne prétend pas montrer un lieu réel : il donne une échelle à un nombre qui n'en a pas d'évidente.",
              "The Red List Index is an estimate, not a species count. The reef does not claim to show a real place: it gives a scale to a number that has no obvious one.",
            ),
            hint: tx(
              "act7.hint.reef",
              "Changez de territoire avec le sélecteur sous le visuel.",
              "Switch territory with the selector below the visual.",
            ),
            legend: {
              color: tx(
                "act7.key.reef_c",
                "Le récif se garnit quand l'indice approche de 1 — aucune espèce évaluée menacée — et se vide quand il descend.",
                "The reef fills out as the index nears 1 - no assessed species threatened - and empties as it falls.",
              ),
              note: tx("act7.key.rl_note", SOURCE_RL_FR, SOURCE_RL_EN),
              // Le récif encode par un REMPLISSAGE, pas par une teinte.
              swatch: "none",
            },
            controls: boardControls,
            node: <BiodiversityReef embed />,
          },
          {
            id: "trend",
            signature: true,
            empty: !M.line.length,
            tab: t("act7.board.tab_trend"),
            title: titles.trend,
            finding: t("act7.board.trend_find"),
            takeaway: t("act7.board.trend_take"),
            legend: { ...key, swatch: "none" },
            hint: tx(
              "act7.hint.trend",
              "Survolez une courbe pour suivre un territoire année par année.",
              "Hover a line to follow one territory year by year.",
            ),
            controls: boardControls,
            node: (
              <div className="act7b__fit">
                <TrendLines
                  series={M.line}
                  years={M.years}
                  currentYear={M.B}
                  unit={M.unit}
                />
              </div>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act7.board.tab_read"),
            title: t("act7.read_title"),
            finding: t("act7.board.read_find"),
            takeaway: t("act7.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act7.spotlight.ex_kicker"),
                  text: t("act7.spotlight.ex_text"),
                }}
                link={{
                  href: "https://stats.pacificdata.org/vis?df[ds]=ds:SPC2&df[id]=DF_SDG_15&df[ag]=SPC&df[vs]=3.0&dq=A.ER_RSK_LST.........",
                  label: t("act7.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "multiples",
            empty: M.series.length === 0,
            tab: tx("act7.board.tab_multiples_1", "Multiples", "Multiples"),
            title: titles.multiples,
            finding: t("act7.board.multiples_find"),
            takeaway: t("act7.board.multiples_take"),
            legend: { ...key, swatch: "none" },
            hint: tx(
              "act7.hint.multiples",
              "Toutes les vignettes partagent la même échelle : elles se comparent du regard.",
              "Every panel shares one scale: they compare at a glance.",
            ),
            controls: boardControls,
            node: (
              <div className="act7b__scroll">
                <SmallMultiples
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  currentYear={M.B}
                  labels={{ last: t("act6.smallmult_last") }}
                />
              </div>
            ),
          },
          {
            id: "race",
            empty: M.race.length < 2,
            tab: t("act7.board.tab_race"),
            title: t("act7.board.race_title"),
            finding: t("act7.board.race_find"),
            takeaway: t("act7.board.race_take"),
            legend: {
              swatch: "none",
              ...key,
              y: tx("act7.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.y,
            },
            hint: tx(
              "act7.hint.race",
              "Lancez l'animation : les barres se réordonnent au fil des années.",
              "Press play: the bars reorder themselves year after year.",
            ),
            controls: boardControls,
            node: (
              <BarRace
                series={M.race}
                years={M.years}
                unit={M.unit}
                decimals={metricDecimals}
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
            id: "change",
            empty: M.dumb.length === 0,
            tab: tx("act7.board.tab_evolution", "Évolution", "Change"),
            title: `${titles.change} · ${M.A}–${M.B}`,
            finding: t("act7.board.change_find"),
            takeaway: t("act7.board.change_take"),
            legend: {
              swatch: "none",
              ...key,
              y: tx("act7.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.y,
              color: tx(
                "act7.key.dumb_c",
                "Le point clair marque la première année, le point foncé la dernière : la barre entre les deux est le chemin parcouru.",
                "The light dot marks the first year, the dark dot the last: the bar between them is the distance travelled.",
              ),
            },
            hint: tx(
              "act7.hint.change",
              "Comparez la longueur des barres : elle dit l'ampleur du changement, pas le niveau atteint.",
              "Compare bar lengths: they show how much changed, not the level reached.",
            ),
            controls: boardControls,
            node: (
              <div className="act7b__scroll">
                <DumbbellChart
                  rows={M.dumb}
                  yearA={M.A}
                  yearB={M.B}
                  unit={M.unit}
                  decimals={metricDecimals}
                  labels={cmpLabels}
                  // Occupe la hauteur du panneau : sans cela, la hauteur est
                  // calculée sur le nombre de lignes et laisse le bas vide.
                  fill
                />
              </div>
            ),
          },
          {
            id: "heat",
            empty: M.series.length === 0,
            tab: tx("act7.board.tab_matrice", "Matrice", "Matrix"),
            title: titles.heat,
            finding: t("act7.board.heat_find"),
            takeaway: t("act7.board.heat_take"),
            legend: {
              y: tx("act7.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.x,
              color: key.color,
              note: key.note,
              swatch: key.swatch,
            },
            hint: tx(
              "act7.hint.heat",
              "Balayez une ligne de gauche à droite : une année isolée oscille, une bande continue s'installe.",
              "Read a row left to right: a lone year wobbles, an unbroken band has settled in.",
            ),
            controls: boardControls,
            node: (
              <div className="act7b__scroll">
                <ApexYearHeatmap
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  scale="sequential"
                  decimals={metricDecimals}
                  labels={{
                    low: t("act6.heatmap_low"),
                    high: t("act6.heatmap_high"),
                  }}
                />
              </div>
            ),
          },
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: tx("act7.board.tab_carte", "Carte", "Map"),
            title: `${t("act7.board.map_title")} · ${M.B}`,
            finding: t("act7.board.map_find"),
            takeaway: t("act7.board.map_take"),
            legend: { color: key.color, note: key.note, swatch: key.swatch },
            hint: tx(
              "act7.hint.map",
              "Faites tourner le globe et survolez un territoire pour lire sa valeur.",
              "Spin the globe and hover a territory to read its value.",
            ),
            controls: boardControls,
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
                    data={M.rank}
                    unit={M.unit}
                    range={mapRange}
                    // Les deux indicateurs de l'escale sont des GRANDEURS :
                    // un indice borné 0-1 et un cumul de mesures. Ni l'un ni
                    // l'autre n'a de zéro chargé de sens, donc pas de rampe à
                    // deux pôles. La rampe « good » ne fait partie d'aucun
                    // des trois encodages du système.
                    ramp="magnitude"
                    mid={null}
                    lowLabel={t("act6.heatmap_low")}
                    highLabel={t("act6.heatmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "coverage",
            empty: M.series.length === 0,
            tab: t("act7.board.tab_coverage"),
            title: t("act7.coverage_title"),
            finding: t("act7.board.coverage_find"),
            takeaway: t("act7.board.coverage_take"),
            node: (
              <CoverageChart
                series={M.series}
                years={M.years}
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
      eyebrow={t("act7.tag")}
      // UNE SEULE SOURCE POUR LE TITRE DE L'ESCALE.
      // Cette page lisait `act7.title`, pendant que les flèches
      // « escale précédente / suivante » des voisines annoncent, elles,
      // `home.acts.a7_title`. Deux clés pour un seul titre : le voisin
      // pouvait annoncer autre chose que ce qu'on trouvait en arrivant.
      title={t("home.acts.a7_title")}
      figures={figures}
      thesis={t("act7.thesis")}
      // L'en-tête ne porte plus de filtres : chaque graphique a les siens.
      filters={null}
      charts={charts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      progress={{ index: 6, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act7.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act7.board.switch_hint"),
        signature: t("act7.board.signature"),
        takeawayKicker: t("act7.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act7.board.start"),
        conclusion: t("act7.board.conclusion"),
        backIntro: t("act7.board.back_intro"),
        reviseData: t("act7.board.revise_data"),
      }}
      outro={{
        kicker: t("act7.outro.kicker"),
        title: t("act7.outro.title"),
        text: t("act7.outro.text"),
        primary: { to: "/territory", label: t("act7.outro.next") },
        secondary: { to: "/", label: t("act7.outro.home") },
      }}
    />
  );
}
