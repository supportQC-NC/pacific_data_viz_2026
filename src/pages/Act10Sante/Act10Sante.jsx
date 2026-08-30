// src/pages/Act10Sante/Act10Sante.jsx
// ============================================================
// Acte 10 — La santé : accès à l'eau potable & tuberculose.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (mesure + sous-région +
// territoire). Onglets variés : tendance (signature), petits multiples,
// course animée, évolution (haltères), chaleur, radar (profil régional)
// et carte 3D. Guides/cartes dépliables retirés.
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
import { fetchSante } from "../../services/santeApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import figuresFromBundle from "../../components/KeyFigures/fromBundle";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ApexYearHeatmap from "../../components/charts/ApexYearHeatmap";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import RadarChart from "../../components/charts/RadarChart";
import BarRace from "../../components/BarRace/BarRace";
// Les visuels de la Home qui portent les deux jeux de cette escale :
// WaterGlass lit `water`, TbBacilli lit `tuberculosis` — exactement les jeux
// du sélecteur. Ils restent montés sur la page d'accueil ; on les ajoute ici,
// on ne les déplace pas.
import WaterGlass from "../../components/WaterGlass/WaterGlass";
import TbBacilli from "../../components/TbBacilli/TbBacilli";
import VizSwitch from "../../components/VizSwitch/VizSwitch";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act10Sante.scss";

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
function subAverages(all, years, t) {
  return Object.keys(SUBREGIONS)
    .map((reg) => {
      const members = all.filter((s) => REGION_OF[s.area] === reg);
      if (!members.length) return null;
      const values = years
        .map((y) => {
          const vs = members
            .map((s) => valueAt(s.values, y))
            .filter((n) => Number.isFinite(n));
          return vs.length
            ? { year: y, value: vs.reduce((a, b) => a + b, 0) / vs.length }
            : null;
        })
        .filter(Boolean);
      return values.length ? { name: t(`act1.filter.${reg}`), values } : null;
    })
    .filter(Boolean);
}

// Deux indicateurs de santé de POLARITÉS OPPOSÉES : une part qui progresse
// est une bonne nouvelle, une incidence qui progresse est une mauvaise. C'est
// la raison d'être de la mention explicite dans chaque clé de lecture — la
// couleur seule ne peut pas porter cette différence.
const SOURCE_WATER_FR =
  "Part de la population utilisant un service d'eau potable géré en toute sécurité, indicateur ODD 6.1.1, via le Pacific Data Hub. En pourcentage : HAUT = mieux.";
const SOURCE_WATER_EN =
  "Share of the population using safely managed drinking water, SDG indicator 6.1.1, via the Pacific Data Hub. Percent: HIGH = better.";
const SOURCE_TB_FR =
  "Incidence de la tuberculose, indicateur ODD 3.3.2, via le Pacific Data Hub — cas pour 100 000 habitants et par an. HAUT = pire.";
const SOURCE_TB_EN =
  "Tuberculosis incidence, SDG indicator 3.3.2, via the Pacific Data Hub - cases per 100,000 people per year. HIGH = worse.";

export default function Act10Sante() {
  const { t, lang } = useLang();

  // Repli littéral tant que la clé n'est pas versée dans les dictionnaires.
  // Quel dessin est à l'écran, quand l'escale en porte plusieurs.
  const [viz, setViz] = useState("glass");

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
  const [metric, setMetric] = useState("water");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSante({ lang, signal: ctrl.signal }).then((res) => {
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
  const water = data?.water;
  const tb = data?.tb;

  const waterAll = useMemo(() => toSeries(water, lang), [water, lang]);
  const tbAll = useMemo(() => toSeries(tb, lang), [tb, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const waterS = useMemo(
    () => waterAll.filter((s) => areaVisible(s.area)),
    [waterAll, areaVisible],
  );
  const tbS = useMemo(
    () => tbAll.filter((s) => areaVisible(s.area)),
    [tbAll, areaVisible],
  );

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [waterA, waterB] = span(water, 2000, 2022);
  const [tbA, tbB] = span(tb, 2000, 2023);

  const waterYears = useMemo(() => water?.years || [], [water]);
  const tbYears = useMemo(() => tb?.years || [], [tb]);

  const waterLine = useMemo(
    () => medianLine(waterS, waterYears, t("act10.water_med_name")),
    [waterS, waterYears, t],
  );
  const tbLine = useMemo(
    () => medianLine(tbS, tbYears, t("act10.tb_med_name")),
    [tbS, tbYears, t],
  );

  const waterRank = useMemo(() => buildRank(waterS, waterB), [waterS, waterB]);
  const tbRank = useMemo(() => buildRank(tbS, tbB), [tbS, tbB]);

  const waterDumb = useMemo(
    () => buildDumbbell(waterS, waterA, waterB),
    [waterS, waterA, waterB],
  );
  const tbDumb = useMemo(() => buildDumbbell(tbS, tbA, tbB), [tbS, tbA, tbB]);

  const waterRace = useMemo(
    () => raceFrom(waterS, waterYears, lang),
    [waterS, waterYears, lang],
  );
  const tbRace = useMemo(
    () => raceFrom(tbS, tbYears, lang),
    [tbS, tbYears, lang],
  );

  const waterSub = useMemo(
    () => subAverages(waterAll, waterYears, t),
    [waterAll, waterYears, t],
  );
  const tbSub = useMemo(
    () => subAverages(tbAll, tbYears, t),
    [tbAll, tbYears, t],
  );

  const isWater = metric === "water";
  const metricDecimals = isWater ? 1 : 0;
  const M = isWater
    ? {
        series: waterS,
        line: waterLine,
        rank: waterRank,
        dumb: waterDumb,
        race: waterRace,
        sub: waterSub,
        years: waterYears,
        unit: t("act10.water_unit"),
        A: waterA,
        B: waterB,
        ramp: "good",
        highTone: "positive",
        lowTone: "warm",
        cmp: { up: t("act10.water_cmp_up"), down: t("act10.water_cmp_down") },
        titles: {
          trend: t("act10.regional_water_title"),
          multiples: t("act10.water_title"),
          heat: t("act10.water_hm_title"),
          change: t("act10.water_cmp_title"),
          rank: t("act10.water_rank_title"),
        },
      }
    : {
        series: tbS,
        line: tbLine,
        rank: tbRank,
        dumb: tbDumb,
        race: tbRace,
        sub: tbSub,
        years: tbYears,
        unit: t("act10.tb_unit"),
        A: tbA,
        B: tbB,
        ramp: undefined,
        highTone: "warm",
        lowTone: "positive",
        cmp: { up: t("act10.tb_cmp_up"), down: t("act10.tb_cmp_down") },
        titles: {
          trend: t("act10.regional_tb_title"),
          multiples: t("act10.tb_title"),
          heat: t("act10.tb_hm_title"),
          change: t("act10.tb_cmp_title"),
          rank: t("act10.tb_rank_title"),
        },
      };

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    return xs.length ? { min: 0, max: Math.max(...xs) } : { min: 0, max: 1 };
  }, [M.series]);

  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchSante({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  // Deux JEUX DE DONNÉES traités à égalité, basculés par icônes.
  const metricItems = [
    {
      id: "water",
      label: t("act10.board.metric_water"),
      icon: "rain",
      tone: "accent",
    },
    {
      id: "tb",
      label: t("act10.board.metric_tb"),
      icon: "pulse",
      tone: "warm",
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
        label={t("act10.board.metric_label")}
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

  // Carte d'identité DOUBLE (eau + tuberculose) — 100 % i18n / métadonnées ONU.
  const spotlightRows = [
    { k: t("act10.spotlight.r1k"), v: t("act10.spotlight.r1v") },
    { k: t("act10.spotlight.r2k"), v: t("act10.spotlight.r2v") },
    { k: t("act10.spotlight.r3k"), v: t("act10.spotlight.r3v") },
    { k: t("act10.spotlight.r4k"), v: t("act10.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act10.spotlight.n1"),
    t("act10.spotlight.n2"),
    t("act10.spotlight.n3"),
    t("act10.spotlight.n4"),
    t("act10.spotlight.n5"),
  ];

  // Les deux indicateurs de l'escale ne se lisent pas dans le même sens.
  // Aucune rampe ne peut dire « bon » ou « mauvais » toute seule : on l'écrit.
  const key = isWater
    ? {
        y: tx(
          "act10.key.water_y",
          "Part de la population desservie par un service d'eau potable géré en toute sécurité, en pourcentage. Ici, plus haut vaut mieux.",
          "Share of the population served by safely managed drinking water, in percent. Here, higher is better.",
        ),
        x: tx("act10.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act10.key.water_c",
          "Une seule teinte, du plus faible au plus élevé. C'est le BAS de l'échelle qui alerte : une part élevée est une bonne nouvelle.",
          "A single hue, lowest to highest. It is the BOTTOM of the scale that warns: a high share is good news.",
        ),
        note: tx("act10.key.water_note", SOURCE_WATER_FR, SOURCE_WATER_EN),
        swatch: "magnitude",
      }
    : {
        y: tx(
          "act10.key.tb_y",
          "Incidence de la tuberculose, en cas pour 100 000 habitants et par an. Ici, plus haut vaut pire.",
          "Tuberculosis incidence, cases per 100,000 people per year. Here, higher is worse.",
        ),
        x: tx("act10.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act10.key.tb_c",
          "Une seule teinte, du plus faible au plus élevé. C'est le HAUT de l'échelle qui alerte.",
          "A single hue, lowest to highest. It is the TOP of the scale that warns.",
        ),
        note: tx("act10.key.tb_note", SOURCE_TB_FR, SOURCE_TB_EN),
        swatch: "magnitude",
      };

  // ---------- LES VISUELS DE L'ESCALE ----------------------------
  // Ils occupaient chacun leur onglet dans la barre. Or celle-ci
  // énumère les ÉTAPES du raisonnement — tendance, matrice, carte —,
  // et deux dessins qui répondent à la même question n'en font pas
  // deux. Regroupés sous une seule entrée, ils libèrent la barre et
  // le choix passe DANS le panneau, à côté de ce qu'il change.
  //
  // Chaque dessin garde son titre, sa phrase et sa clé de lecture :
  // la colonne de droite reste exacte, ce qu'une fusion aurait perdu.
  const VIZ = {
    glass: {
              id: "glass",
              empty: false,
              tab: tx("act10.board.tab_verre", "Verre", "Glass"),
              title: tx(
                "act10.viz.glass_title",
                "L'accès à l'eau potable, territoire par territoire",
                "Access to safe water, territory by territory",
              ),
              finding: tx(
                "act10.viz.glass_find",
                "Choisissez un territoire : le verre se remplit à la mesure de sa population desservie.",
                "Pick a territory: the glass fills to match its served population.",
              ),
              takeaway: tx(
                "act10.viz.glass_take",
                "Le verre se remplit à la part de la population desservie — pas à la quantité d'eau disponible. Un territoire bien arrosé peut avoir un verre au tiers plein.",
                "The glass fills to the share of population served - not to how much water exists. A rain-soaked territory can have a one-third-full glass.",
              ),
              hint: tx(
                "act10.hint.glass",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act10.key.glass_c",
                  "Le niveau d'eau suit la part de la population desservie par un service géré en toute sécurité.",
                  "The water level follows the share of the population served by a safely managed service.",
                ),
                note: tx("act10.key.water_note", SOURCE_WATER_FR, SOURCE_WATER_EN),
                // Le dessin encode par un REMPLISSAGE, pas par une teinte.
                swatch: "none",
              },
              controls: boardControls,
              node: <WaterGlass embed />,
            },
    bacilli: {
              id: "bacilli",
              empty: false,
              tab: tx("act10.board.tab_bacille", "Bacille", "Bacilli"),
              title: tx(
                "act10.viz.tb_title",
                "L'incidence de la tuberculose, territoire par territoire",
                "Tuberculosis incidence, territory by territory",
              ),
              finding: tx(
                "act10.viz.tb_find",
                "Choisissez un territoire : la colonie suit son incidence.",
                "Pick a territory: the colony follows its incidence.",
              ),
              takeaway: tx(
                "act10.viz.tb_take",
                "Une incidence rapportée à 100 000 habitants : sur un territoire de quelques milliers de personnes, une poignée de cas suffit à faire un chiffre élevé.",
                "An incidence per 100,000 people: on a territory of a few thousand, a handful of cases is enough to make the figure high.",
              ),
              hint: tx(
                "act10.hint.tb",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act10.key.tb_viz_c",
                  "La colonie s'épaissit avec l'incidence du territoire choisi.",
                  "The colony thickens with the chosen territory's incidence.",
                ),
                note: tx("act10.key.tb_note", SOURCE_TB_FR, SOURCE_TB_EN),
                swatch: "none",
              },
              controls: boardControls,
              node: <TbBacilli embed />,
            },
  };

  const vizItems = [
    { id: "glass", label: tx("act10.viz.sw_glass", "Eau", "Water") },
    { id: "bacilli", label: tx("act10.viz.sw_bacilli", "Tuberculose", "TB") },
  ];
  const activeViz = VIZ[viz] || VIZ.glass;

  // ---------- LES CHIFFRES À EMPORTER ----------
  // Trois nombres tirés du bundle de la mesure courante : ils changent avec le
  // sélecteur, comme le reste de l'escale. Le lecteur qui ne lit rien d'autre
  // repart au moins avec un ordre de grandeur et la période sur laquelle il
  // vaut. Voir components/KeyFigures/fromBundle.js.
  const figures = useMemo(
    () =>
      figuresFromBundle(M, {
        median: tx("act10.fig.median", "Médiane du Pacifique", "Pacific median"),
        edge: tx("act10.fig.edge", "La valeur extrême", "The extreme value"),
        span: tx("act10.fig.span", "Période couverte", "Period covered"),
        years: tx("act10.fig.years", "années", "years"),
      }),
    [M, tx],
  );

  const charts =
    status === "ready"
      ? [
          {
            ...activeViz,
            id: "viz",
            // L'onglet porte le nom du dessin affiché — « Pousse », « Verre »,
            // « Foule »… — et change avec la bascule. La barre annonce ainsi ce
            // qu'on va voir, comme sur les escales 01 et 02, au lieu de la
            // catégorie à laquelle il appartient.
            finding: tx(
              "act10.viz.embed_find",
              "Un dessin plutôt qu'un graphique : la grandeur se lit dans sa forme — sa hauteur, sa densité, son remplissage. Le sélecteur sous l'image change de territoire.",
              "A drawing rather than a chart: the quantity is read from its shape — height, density, fill. The selector below the image switches territory.",
            ),
            takeaway: tx(
              "act10.viz.embed_take",
              "Un chiffre isolé ne dit rien tant qu'on ne l'a pas comparé. Le dessin donne une échelle intuitive ; les vues suivantes donnent les valeurs exactes.",
              "A lone figure says nothing until you compare it. The drawing gives an intuitive scale; the next views give the exact values.",
            ),
            hint: tx(
              "act10.viz.embed_hint",
              "Changez de territoire sous l'image, et de dessin avec la bascule au-dessus.",
              "Switch territory below the image, and drawing with the toggle above.",
            ),
            legend: {
              // Aucune échelle de couleur : ces dessins encodent par la forme.
              // La pastille reste un cadre vide, ce qui est la seule chose
              // honnête à montrer quand la couleur ne mesure rien.
              swatch: "none",
              color: tx(
                "act10.viz.embed_c",
                "La couleur ne mesure rien ici : c'est la forme du dessin qui porte la valeur.",
                "Colour measures nothing here: the drawing's shape carries the value.",
              ),
              note: key.note,
            },
            node: (
              <div className="vizpane">
                <VizSwitch
                  items={vizItems}
                  value={viz}
                  onChange={setViz}
                  label={tx("act10.viz.sw_label", "Visuel", "Visual")}
                />
                <div className="vizpane__body">{activeViz.node}</div>
              </div>
            ),
          },
          // ---------- Les visuels interactifs, en ouverture ----------------
          // Deux dessins de la Home, un par indicateur, lisant exactement les
          // mêmes jeux que le sélecteur : le verre pour l'eau potable, le
          // bacille pour la tuberculose. Ils restent montés sur la page
          // d'accueil ; on les ajoute ici, on ne les déplace pas.
          //
          // Ils ouvrent parce qu'un pourcentage et une incidence pour 100 000
          // sont deux abstractions : le dessin leur donne une taille avant
          // que les courbes ne les mettent en série.
          {
            id: "trend",
            signature: true,
            empty: !M.line.length,
            tab: t("act10.board.tab_trend"),
            title: M.titles.trend,
            finding: t("act10.board.trend_find"),
            takeaway: t("act10.board.trend_take"),
            legend: { ...key, swatch: "none" },
            hint: tx(
              "act10.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            controls: boardControls,
            node: (
              <div className="act10b__fit">
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
            tab: t("act10.board.tab_read"),
            title: t("act10.read_title"),
            finding: t("act10.board.read_find"),
            takeaway: t("act10.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act10.spotlight.ex_kicker"),
                  text: t("act10.spotlight.ex_text"),
                }}
                link={{
                  href: "https://washdata.org/",
                  label: t("act10.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "multiples",
            empty: M.series.length === 0,
            tab: tx("act10.board.tab_multiples_1", "Multiples", "Multiples"),
            title: M.titles.multiples,
            finding: t("act10.board.multiples_find"),
            takeaway: t("act10.board.multiples_take"),
            legend: { ...key, swatch: "none" },
            hint: tx(
              "act10.hint.multiples",
              "Toutes les vignettes partagent la même échelle : elles se comparent du regard.",
              "Every panel shares one scale: they compare at a glance.",
            ),
            controls: boardControls,
            node: (
              <div className="act10b__scroll">
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
            tab: t("act10.board.tab_race"),
            title: M.titles.rank,
            finding: t("act10.board.race_find"),
            takeaway: t("act10.board.race_take"),
            legend: { ...key, y: tx("act10.key.terr_y", "Un territoire par ligne.", "One territory per row."), x: key.y },
              swatch: "none",
            hint: tx(
              "act10.hint.race",
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
            tab: tx("act10.board.tab_evolution", "Évolution", "Change"),
            title: `${M.titles.change} · ${M.A}–${M.B}`,
            finding: t("act10.board.change_find"),
            takeaway: t("act10.board.change_take"),
            legend: {
              swatch: "none",
              ...key,
              y: tx("act10.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.y,
              color: tx(
                "act10.key.dumb_c",
                "Le point clair marque la première année, le point foncé la dernière : la barre entre les deux est le chemin parcouru.",
                "The light dot marks the first year, the dark dot the last: the bar between them is the distance travelled.",
              ),
            },
            hint: tx(
              "act10.hint.change",
              "Comparez la longueur des barres : elle dit l'ampleur du changement, pas le niveau atteint.",
              "Compare bar lengths: they show how much changed, not the level reached.",
            ),
            controls: boardControls,
            node: (
              <div className="act10b__scroll">
                <DumbbellChart
                  rows={M.dumb}
                  yearA={M.A}
                  yearB={M.B}
                  unit={M.unit}
                  decimals={metricDecimals}
                  labels={M.cmp}
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
            tab: tx("act10.board.tab_matrice", "Matrice", "Matrix"),
            title: M.titles.heat,
            finding: t("act10.board.heat_find"),
            takeaway: t("act10.board.heat_take"),
            legend: {
              y: tx("act10.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.x,
              color: key.color,
              note: key.note,
              swatch: key.swatch,
            },
            hint: tx(
              "act10.hint.heat",
              "Balayez une ligne de gauche à droite : une année isolée oscille, une bande continue s'installe.",
              "Read a row left to right: a lone year wobbles, an unbroken band has settled in.",
            ),
            controls: boardControls,
            node: (
              <div className="act10b__scroll">
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
            id: "radar",
            empty: M.sub.length < 2,
            tab: tx("act10.board.tab_profil", "Profil", "Profile"),
            title: t("act10.board.radar_title"),
            finding: t("act10.board.radar_find"),
            takeaway: t("act10.board.radar_take"),
            legend: {
              swatch: "none",
              ...key,
              y: tx(
                "act10.key.radar_y",
                "Chaque branche est une sous-région ; la distance au centre porte la valeur.",
                "Each spoke is a sub-region; distance from the centre carries the value.",
              ),
              x: tx("act10.key.radar_x", "Les sous-régions, tout autour.", "The sub-regions, all around."),
            },
            hint: tx(
              "act10.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            controls: boardControls,
            node: (
              <div className="act10b__fit">
                <RadarChart subAvg={M.sub} years={M.years} />
              </div>
            ),
          },
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: tx("act10.board.tab_carte", "Carte", "Map"),
            title: `${t("act10.board.map_title")} · ${M.B}`,
            finding: t("act10.board.map_find"),
            takeaway: t("act10.board.map_take"),
            legend: { color: key.color, note: key.note, swatch: key.swatch },
            hint: tx(
              "act10.hint.map",
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
                    // Les deux indicateurs sont des GRANDEURS : une part
                    // et une incidence, sans zéro chargé de sens. La rampe
                    // « good », qui n'appartient à aucun des trois encodages
                    // du système, prétendait dire par la couleur ce que la
                    // clé de lecture dit maintenant par écrit — et le disait
                    // à l'envers dès qu'on basculait sur la tuberculose.
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
            tab: t("act10.board.tab_coverage"),
            title: t("act10.coverage_title"),
            finding: t("act10.board.coverage_find"),
            takeaway: t("act10.board.coverage_take"),
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
      eyebrow={t("act10.tag")}
      // UNE SEULE SOURCE POUR LE TITRE DE L'ESCALE.
      // Cette page lisait `act10.title`, pendant que les flèches
      // « escale précédente / suivante » des voisines annoncent, elles,
      // `home.acts.a10_title`. Deux clés pour un seul titre : le voisin
      // pouvait annoncer autre chose que ce qu'on trouvait en arrivant.
      title={t("home.acts.a10_title")}
      figures={figures}
      thesis={t("act10.thesis")}
      // L'en-tête ne porte plus de filtres : chaque graphique a les siens.
      filters={null}
      charts={charts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      progress={{ index: 8, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act10.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act10.board.switch_hint"),
        signature: t("act10.board.signature"),
        takeawayKicker: t("act10.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act10.board.start"),
        conclusion: t("act10.board.conclusion"),
        backIntro: t("act10.board.back_intro"),
        reviseData: t("act10.board.revise_data"),
      }}
      outro={{
        kicker: t("act10.outro.kicker"),
        title: t("act10.outro.title"),
        text: t("act10.outro.text"),
        primary: { to: "/impact", label: t("act10.outro.next") },
        secondary: { to: "/", label: t("act10.outro.home") },
      }}
    />
  );
}
