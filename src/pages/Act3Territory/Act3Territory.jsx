// src/pages/Act3Territory/Act3Territory.jsx
// ============================================================
// Acte « Territoire » — la mer rencontre les hommes.
// Croise DEUX jeux officiels (anomalie du niveau de la mer par ZEE,
// réf. 1993–2012 · taux de croissance démographique) complétés par un
// agrégat statique du trait de côte (Digital Earth Pacific, CC BY-NC).
// Règle éditoriale de l'acte : croiser pour LOCALISER, jamais pour conclure.
//
// Vues « maîtrise de la donnée » (jury) :
//   • Les données : carte d'identité DOUBLE (mer + population) + note
//     trait de côte — sources, références, formule du taux, années
//     incomplètes signalées, recensements 5–10 ans + modèles entre deux.
//   • Couverture  : matrice binaire territoires × années du niveau de la
//     mer — les vides montrés, jamais comblés.
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
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import AnomalyBandChart from "../../components/charts/AnomalyBandChart";
import MirrorBars from "../../components/charts/MirrorBars";
import ChangeChart from "../../components/charts/ChangeChart";
import DumbbellChart from "../../components/charts/DumbbellChart";
import CoastBalanceChart from "../../components/charts/CoastBalanceChart";
import COASTLINE_BY_TERRITORY from "../../data/coastlineByTerritory";
import BubbleChart from "../../components/charts/BubbleChart";
import SlopeChart from "../../components/charts/SlopeChart";
import CoastSpreadChart from "../../components/charts/CoastSpreadChart";
import CoverageChart from "../../components/charts/CoverageChart";
import useThemeTokens from "../../hooks/UseThemeTokens";
import { fmt } from "../../components/charts/echartsBase";
// Les visuels de la Home qui portent les deux jeux de cette escale :
// StiltHouse lit `seaLevel`, PopGrowth lit `population` — exactement les jeux
// du sélecteur. Ils restent montés sur la page d'accueil ; on les ajoute ici,
// on ne les déplace pas.
//
// `CoastlineShift`, le troisième visuel de cette escale sur la Home, n'est PAS
// repris : le trait de côte est explicitement laissé en l'état.
import StiltHouse from "../../components/StiltHouse/StiltHouse";
import PopGrowth from "../../components/PopGrowth/PopGrowth";
import "./Act3Territory.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

// Couche « trait de côte » (Digital Earth Pacific — Landsat Coastlines, CC BY-NC).
// GeoJSON dégraissé servi depuis public/data/.
const COAST_URL = `${process.env.PUBLIC_URL || ""}/data/coastline-hotspots.geojson`;

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

// Rattachement de chaque vue à un jeu — "sea" (mer), "population", ou "both"
// (vues croisées qui restent visibles dans les deux). Modifiable librement.
// Deux jeux de natures différentes : une anomalie signée autour d'une
// référence, et un taux de croissance. Chacun sa source, chacun sa lecture.
const SOURCE_SEA_FR =
  "Anomalie du niveau de la mer, via le Pacific Data Hub — en mètres, par rapport à la référence 1993-2012. Le zéro est cette référence, pas le niveau absolu de l'océan.";
const SOURCE_SEA_EN =
  "Sea-level anomaly, via the Pacific Data Hub - in metres, against the 1993-2012 reference. Zero is that reference, not the ocean's absolute level.";
const SOURCE_POP_FR =
  "Taux de croissance de la population, via le Pacific Data Hub — en pourcentage par an. Un taux, pas un effectif : un petit territoire peut afficher un fort taux pour peu d'habitants.";
const SOURCE_POP_EN =
  "Population growth rate, via the Pacific Data Hub - percent per year. A rate, not a head count: a small territory can post a high rate on few people.";

const DATASET_OF = {
  stilt: "sea",
  popviz: "population",
  band: "sea",
  slope: "sea",
  profile: "sea",
  map: "sea",
  coast: "sea",
  coastmap: "sea",
  spread: "sea",
  growth: "population",
  path: "population",
  read: "both",
  coastbal: "both",
  bubble: "both",
  coverage: "both",
};

function allSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (d.byArea[a] || [])
        .filter((p) => Number.isFinite(p.value))
        .sort((x, y) => x.year - y.year),
    }))
    .filter((s) => s.values.length);
}
function pointsAt(d, year, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const p = (d.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value)
        ? { area: a, name: pictName(a, lang), value: p.value, year }
        : null;
    })
    .filter(Boolean);
}
function latestValue(series) {
  return series.values.length
    ? series.values[series.values.length - 1].value
    : null;
}
function firstValue(series) {
  return series.values.length ? series.values[0].value : null;
}
// Rang relatif 0–100 (percentile) à partir d'un dico { area: valeur }.
// Évite l'écrasement quand les valeurs sont peu dispersées (cas du niveau de
// la mer) : on lit la POSITION relative, pas la valeur brute.
function rankIndex(byArea) {
  const entries = Object.entries(byArea).filter(([, v]) => Number.isFinite(v));
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const n = sorted.length;
  const out = {};
  sorted.forEach(([area], i) => {
    out[area] = n > 1 ? Math.round((i / (n - 1)) * 100) : 50;
  });
  return out;
}

/* ---------- Filtres globaux ---------- */
function YearSlider({ label, years, index, onChange }) {
  if (!years.length) return null;
  return (
    <div className="act1f act1f--year">
      <span className="act1f__lbl">
        {label} <strong>{years[index] ?? ""}</strong>
      </span>
      <input
        className="act1f__range"
        type="range"
        min={0}
        max={years.length - 1}
        value={index ?? years.length - 1}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export default function Act3Territory() {
  const { t, lang } = useLang();

  // Repli littéral tant que la clé n'est pas versée dans les dictionnaires.
  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );
  const dispatch = useDispatch();
  const tk = useThemeTokens();

  const sea = useSelector(selectDataset("seaLevel"));
  const pop = useSelector(selectDataset("population"));

  const [region, setRegion] = useState("all");
  const [dataset, setDataset] = useState("sea"); // sea | population
  const [yearIdx, setYearIdx] = useState(null); // index sur les années de la MER
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const ready = sea.status === "succeeded" && pop.status === "succeeded";
  const failed = sea.status === "failed" || pop.status === "failed";

  const seaYears = useMemo(() => (sea.data ? sea.data.years : []), [sea.data]);
  const firstSeaYear = seaYears[0] ?? null;
  const lastSeaYear = seaYears[seaYears.length - 1] ?? null;
  const empty = ready && seaYears.length === 0;

  useEffect(() => {
    if (seaYears.length && yearIdx === null) setYearIdx(seaYears.length - 1);
  }, [seaYears, yearIdx]);

  useEffect(() => {
    if (!playing || !seaYears.length) return undefined;
    const id = setInterval(() => {
      setYearIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= seaYears.length) {
          setPlaying(false);
          return seaYears.length - 1;
        }
        return next;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, seaYears]);

  const currentSeaYear =
    seaYears.length && yearIdx != null ? seaYears[yearIdx] : null;

  const inRegion = useCallback(
    (area) => region === "all" || REGION_OF[area] === region,
    [region],
  );

  // Séries par territoire (mer & population), filtrées par sous-région.
  const seaSeries = useMemo(
    () => allSeries(sea.data, lang, inRegion),
    [sea.data, lang, inRegion],
  );
  const popSeries = useMemo(
    () => allSeries(pop.data, lang, inRegion),
    [pop.data, lang, inRegion],
  );

  // Points « niveau de la mer » à l'année courante (carte + KPIs).
  const seaPoints = useMemo(
    () =>
      sea.data && currentSeaYear != null
        ? pointsAt(sea.data, currentSeaYear, lang, inRegion)
        : [],
    [sea.data, currentSeaYear, lang, inRegion],
  );

  // Dernières valeurs par territoire.
  const seaLatestByArea = useMemo(() => {
    const m = {};
    seaSeries.forEach((s) => {
      const v = latestValue(s);
      if (Number.isFinite(v)) m[s.area] = v;
    });
    return m;
  }, [seaSeries]);
  const popLatestByArea = useMemo(() => {
    const m = {};
    popSeries.forEach((s) => {
      const v = latestValue(s);
      if (Number.isFinite(v)) m[s.area] = v;
    });
    return m;
  }, [popSeries]);

  // PROFIL D'EXPOSITION (barres miroir) : rang relatif mer (gauche) vs rang
  // relatif de pression démographique (droite), territoire par territoire.
  const profileRows = useMemo(() => {
    const seaRank = rankIndex(seaLatestByArea);
    const popRank = rankIndex(popLatestByArea);
    const names = {};
    seaSeries.forEach((s) => (names[s.area] = s.name));
    popSeries.forEach((s) => (names[s.area] = s.name));
    return Object.keys(names)
      .filter((a) => Number.isFinite(seaRank[a]) && Number.isFinite(popRank[a]))
      .map((a) => ({
        name: names[a],
        area: a,
        left: seaRank[a],
        right: popRank[a],
      }))
      .sort((x, y) => x.left + x.right - (y.left + y.right)); // plus exposé en haut (Apex empile du bas)
  }, [seaLatestByArea, popLatestByArea, seaSeries, popSeries]);

  // PEUPLEMENT (barres divergentes) : taux de croissance le plus récent, par
  // territoire — qui gagne encore des habitants, qui en perd.
  const growthRows = useMemo(
    () =>
      popSeries
        .map((s) => ({ name: s.name, delta: latestValue(s) }))
        .filter((r) => Number.isFinite(r.delta)),
    [popSeries],
  );

  // TRAJECTOIRE (haltère) : taux de croissance 1re année → dernière, par territoire.
  const pathRows = useMemo(
    () =>
      popSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => ({
          name: s.name,
          start: firstValue(s),
          end: latestValue(s),
        }))
        .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end)),
    [popSeries],
  );

  // Bilan côtier par territoire (agrégat statique Digital Earth Pacific),
  // filtré par sous-région. ero/acc en % ; bal = acc - ero ; med en m/an.
  const coastRows = useMemo(
    () =>
      COASTLINE_BY_TERRITORY.filter((d) => inRegion(d.area)).map((d) => ({
        ...d,
        name: pictName(d.area, lang),
      })),
    [lang, inRegion],
  );
  // Carte « érosion par territoire » : valeur = % de littoral en recul.
  const coastEroPoints = useMemo(
    () => coastRows.map((d) => ({ area: d.area, name: d.name, value: d.ero })),
    [coastRows],
  );
  const eroRange = useMemo(() => {
    const vals = coastEroPoints.map((p) => p.value);
    return { min: 0, max: vals.length ? Math.max(...vals) : 100 };
  }, [coastEroPoints]);

  // Croisement pression humaine x recul cotier (bulles, par sous-region).
  const bubbleGroups = useMemo(() => {
    const colorByRegion = {
      melanesia: tk.accent,
      polynesia: tk.warm,
      micronesia: tk.positive,
    };
    const acc = {};
    coastRows.forEach((d) => {
      const g = popLatestByArea[d.area];
      if (!Number.isFinite(g)) return;
      const reg = REGION_OF[d.area] || "all";
      (acc[reg] = acc[reg] || []).push({
        x: g,
        y: d.ero,
        z: d.n,
        name: d.name,
      });
    });
    return Object.entries(acc).map(([reg, points]) => ({
      name: t(`act1.filter.${reg}`),
      color: colorByRegion[reg] || tk.accent,
      points,
    }));
  }, [coastRows, popLatestByArea, tk, t]);

  // Montee de la mer : premiere -> derniere annee (mm) par territoire.
  const slopeRows = useMemo(
    () =>
      seaSeries
        .map((s) => ({
          name: s.name,
          left: firstValue(s) * 1000,
          right: latestValue(s) * 1000,
        }))
        .filter((r) => Number.isFinite(r.left) && Number.isFinite(r.right)),
    [seaSeries],
  );
  const slopeRange = useMemo(() => {
    const v = slopeRows.flatMap((r) => [r.left, r.right]);
    if (!v.length) return { min: 0, max: 100 };
    return { min: Math.floor(Math.min(...v)), max: Math.ceil(Math.max(...v)) };
  }, [slopeRows]);

  // Dispersion des vitesses par territoire (boite a moustaches).
  const spreadRows = useMemo(
    () =>
      coastRows
        .filter((d) => Array.isArray(d.box))
        .map((d) => ({ name: d.name, box: d.box, n: d.n })),
    [coastRows],
  );

  const seaUnit = t("act3.sea_unit");
  const popUnit = t("act3.unit");

  // Chiffres-chocs : 3 sur la mer (exposition) + 1 sur le peuplement.
  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const mapRange = useMemo(() => {
    if (!seaPoints.length) return { min: -0.2, max: 0.2 };
    const vals = seaPoints.map((p) => p.value);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [seaPoints]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === seaYears.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [seaYears.length]);
  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);
  const retry = useCallback(() => {
    dispatch(loadDataset("seaLevel"));
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const datasetItems = [
    { id: "sea", label: t("act3.dataset.sea"), icon: "waves", tone: "accent" },
    {
      id: "population",
      label: t("act3.dataset.pop"),
      icon: "people",
      tone: "warm",
    },
  ];
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));
  const status = failed
    ? "error"
    : !ready
      ? "loading"
      : empty
        ? "empty"
        : "ready";

  const noSeaSeries = seaSeries.length === 0;
  const noSeaPts = currentSeaYear != null && seaPoints.length === 0;
  const noProfile = profileRows.length === 0;
  const noGrowth = growthRows.length === 0;
  const noPath = pathRows.length < 1;

  // Les deux sélecteurs de l'escale passent en menus déroulants. Les listes
  // d'items existantes ({ id, label, … }) sont réutilisées telles quelles :
  // on ne les redéfinit pas, on les adapte à la forme attendue.
  const asOptions = (items) =>
    (items || []).map((it) => ({ value: it.id, label: it.label }));

  const filtersEl = (
    <>
      <ChartFilter
        label={t("act3.board.dataset_label")}
        value={dataset}
        onChange={setDataset}
        options={asOptions(datasetItems)}
      />
      <ChartFilter
        label={t("act1.filter.title")}
        hideLabel
        value={region}
        onChange={setRegion}
        options={asOptions(regionItems)}
      />
      <YearSlider
        label={t("act1.f.year")}
        years={seaYears}
        index={yearIdx}
        onChange={(i) => {
          setPlaying(false);
          setYearIdx(i);
        }}
      />
    </>
  );

  // Carte d'identité DOUBLE (mer + population) — contenu 100 % i18n / fiches officielles.
  const spotlightRows = [
    { k: t("act3.spotlight.r_sea_src_k"), v: t("act3.spotlight.r_sea_src_v") },
    { k: t("act3.spotlight.r_sea_ref_k"), v: t("act3.spotlight.r_sea_ref_v") },
    { k: t("act3.spotlight.r_pop_src_k"), v: t("act3.spotlight.r_pop_src_v") },
    { k: t("act3.spotlight.r_pop_def_k"), v: t("act3.spotlight.r_pop_def_v") },
  ];
  const spotlightNotes = [
    t("act3.spotlight.n1"),
    t("act3.spotlight.n2"),
    t("act3.spotlight.n3"),
    t("act3.spotlight.n4"),
    t("act3.spotlight.n5"),
  ];

  // Ce que portent les axes et la couleur change avec le jeu : une anomalie
  // signée d'un côté, un taux de l'autre. Le premier a un zéro chargé de sens
  // — la référence 1993-2012 — donc une rampe à deux pôles ; le second n'en a
  // pas, donc une seule teinte.
  const key =
    dataset === "population"
      ? {
          y: tx(
            "act3.key.pop_y",
            "Taux de croissance de la population, en pourcentage par an. C'est un rythme, pas un nombre d'habitants.",
            "Population growth rate, percent per year. A pace, not a head count.",
          ),
          x: tx("act3.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act3.key.mag_c",
            "Une seule teinte : plus elle est marquée, plus la valeur est élevée.",
            "A single hue: the stronger it is, the higher the value.",
          ),
          note: tx("act3.key.pop_note", SOURCE_POP_FR, SOURCE_POP_EN),
          swatch: "magnitude",
        }
      : {
          y: tx(
            "act3.key.sea_y",
            "Anomalie du niveau de la mer, en mètres par rapport à la référence 1993-2012. Zéro = ce niveau de référence.",
            "Sea-level anomaly, in metres against the 1993-2012 reference. Zero = that reference level.",
          ),
          x: tx("act3.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act3.key.sea_c",
            "Bleu : au-dessous de la référence. Ambre : au-dessus. Le gris central, c'est la référence elle-même.",
            "Blue: below the reference. Amber: above. The grey centre is the reference itself.",
          ),
          note: tx("act3.key.sea_note", SOURCE_SEA_FR, SOURCE_SEA_EN),
          swatch: "polarity",
        };

  const charts =
    status === "ready" && currentSeaYear != null
      ? [
          // ---------- Les visuels interactifs, en ouverture ----------------
          // Deux dessins de la Home, un par jeu, lisant exactement le même
          // jeu que le sélecteur : la maison sur pilotis pour le niveau de la
          // mer, la silhouette pour la population. Le sélecteur décide lequel
          // est à l'écran, comme pour toutes les autres vues de l'escale.
          //
          // Ils ouvrent parce qu'une anomalie en mètres et un taux en pourcent
          // sont deux abstractions : le dessin leur donne une échelle avant
          // que les courbes ne les mettent en série.
          {
            id: "stilt",
            empty: false,
            tab: tx("act3.board.tab_pilotis", "Pilotis", "Stilts"),
            title: tx(
              "act3.viz.stilt_title",
              "La montée des eaux, territoire par territoire",
              "Rising seas, territory by territory",
            ),
            finding: tx(
              "act3.viz.stilt_find",
              "Choisissez un territoire : l'eau monte le long des pilotis à la mesure de son anomalie.",
              "Pick a territory: the water climbs the stilts to match its anomaly.",
            ),
            takeaway: tx(
              "act3.viz.stilt_take",
              "Quelques centimètres sur un graphique ne se ressentent pas. Contre un pilotis, si — et c'est la même donnée.",
              "A few centimetres on a chart cannot be felt. Against a stilt they can - and it is the same data.",
            ),
            hint: tx(
              "act3.hint.stilt",
              "Changez de territoire avec le sélecteur sous le visuel.",
              "Switch territory with the selector below the visual.",
            ),
            legend: {
              color: tx(
                "act3.key.stilt_c",
                "La hauteur d'eau suit le niveau d'exposition du territoire choisi, dérivé de son anomalie du niveau de la mer.",
                "The water height follows the chosen territory's exposure level, derived from its sea-level anomaly.",
              ),
              note: tx("act3.key.sea_note", SOURCE_SEA_FR, SOURCE_SEA_EN),
              // Le dessin encode par une HAUTEUR d'eau, pas par une teinte.
              swatch: "none",
            },
            node: <StiltHouse embed />,
          },
          {
            id: "popviz",
            empty: false,
            tab: tx("act3.board.tab_peuplement", "Peuplement", "People"),
            title: tx(
              "act3.viz.pop_title",
              "La croissance de la population, territoire par territoire",
              "Population growth, territory by territory",
            ),
            finding: tx(
              "act3.viz.pop_find",
              "Choisissez un territoire : la silhouette suit son taux de croissance.",
              "Pick a territory: the figure follows its growth rate.",
            ),
            takeaway: tx(
              "act3.viz.pop_take",
              "Un taux élevé sur un petit territoire, c'est peu de personnes ; un taux faible sur un grand, c'est beaucoup. Le pourcentage ne dit pas le nombre.",
              "A high rate on a small territory means few people; a low rate on a large one means many. The percentage does not tell you the count.",
            ),
            hint: tx(
              "act3.hint.pop",
              "Changez de territoire avec le sélecteur sous le visuel.",
              "Switch territory with the selector below the visual.",
            ),
            legend: {
              color: tx(
                "act3.key.pop_viz_c",
                "La silhouette grandit avec le taux de croissance du territoire choisi.",
                "The figure grows with the chosen territory's growth rate.",
              ),
              note: tx("act3.key.pop_note", SOURCE_POP_FR, SOURCE_POP_EN),
              swatch: "none",
            },
            node: <PopGrowth embed />,
          },
          {
            id: "band",
            signature: true,
            empty: noSeaSeries,
            tab: tx("act3.board.tab_montee", "Montée", "Rise"),
            title: t("act3.viz.band_title"),
            finding: t("act3.board.band_find"),
            takeaway: t("act3.board.band_take"),
            legend: key,
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <AnomalyBandChart
                series={seaSeries}
                years={seaYears}
                unit={seaUnit}
              />
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act3.board.tab_read"),
            title: t("act3.viz.read_title"),
            finding: t("act3.board.read_find"),
            takeaway: t("act3.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act3.spotlight.ex_kicker"),
                  text: t("act3.spotlight.ex_text"),
                }}
                link={{
                  href: "https://cds.climate.copernicus.eu/datasets/satellite-sea-level-global?tab=overview",
                  label: t("act3.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "slope",
            empty: slopeRows.length < 2,
            tab: tx("act3.board.tab_rythme", "Rythme", "Pace"),
            title: t("act3.viz.slope_title"),
            finding: t("act3.board.slope_find"),
            takeaway: t("act3.board.slope_take"),
            legend: {
              ...key,
              y: tx("act3.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act3.key.slope_x",
                "La pente de l'anomalie, en millimètres par an : le rythme de la montée, pas le niveau atteint.",
                "The anomaly's slope, in millimetres per year: the pace of the rise, not the level reached.",
              ),
            },
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <SlopeChart
                rows={slopeRows}
                leftLabel={String(firstSeaYear ?? "")}
                rightLabel={String(lastSeaYear ?? "")}
                unit={t("act3.coast.slope_unit")}
                min={slopeRange.min}
                max={slopeRange.max}
              />
            ),
          },
          {
            id: "profile",
            empty: noProfile,
            tab: tx("act3.board.tab_exposition", "Exposition", "Exposure"),
            title: t("act3.viz.profile_title"),
            finding: t("act3.board.profile_find"),
            takeaway: t("act3.board.profile_take"),
            legend: {
              ...key,
              y: tx("act3.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.y,
            },
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <MirrorBars
                rows={profileRows}
                leftLabel={t("act3.viz.profile_left")}
                rightLabel={t("act3.viz.profile_right")}
                unit={t("act3.viz.profile_unit")}
                format={(v) => fmt(v, 0)}
              />
            ),
          },
          {
            id: "growth",
            empty: noGrowth,
            tab: tx("act3.board.tab_croissance", "Croissance", "Growth"),
            title: t("act3.viz.pop_title"),
            finding: t("act3.board.pop_find"),
            takeaway: t("act3.board.pop_take"),
            legend: key,
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <ChangeChart
                rows={growthRows}
                unit={popUnit}
                direction="all"
                polarity="up_good"
              />
            ),
          },
          {
            id: "map",
            empty: noSeaPts,
            tab: tx("act3.board.tab_carte", "Carte", "Map"),
            title: `${t("act3.viz.map_title")} · ${currentSeaYear}`,
            finding: t("act3.board.map_find"),
            takeaway: t("act3.board.map_take"),
            legend: { color: key.color, note: key.note, swatch: key.swatch },
            hint: tx(
              "act3.hint.map",
              "Faites tourner le globe et survolez un territoire pour lire sa valeur.",
              "Spin the globe and hover a territory to read its value.",
            ),
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
                    data={seaPoints}
                    unit={seaUnit}
                    range={mapRange}
                    // L'anomalie a un ZÉRO CHARGÉ DE SENS — la référence
                    // 1993-2012 — donc une rampe à deux pôles autour de lui.
                    // La rampe « semantic » qu'elle employait est un
                    // vert ↔ rouge, que la doctrine du projet écarte : les
                    // deux pôles y sont la même couleur pour environ 8 % des
                    // hommes, alors que ce sont justement les extrêmes qui
                    // portent le propos.
                    ramp="polarity"
                    mid={0}
                    lowLabel={t("act3.map_low")}
                    midLabel={t("act3.map_mid")}
                    highLabel={t("act3.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                    years={seaYears}
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
            id: "coast",
            empty: false,
            tab: t("act3.board.tab_coast"),
            title: t("act3.viz.coast_title"),
            finding: t("act3.board.coast_find"),
            takeaway: t("act3.board.coast_take"),
            node: (
              <div className="act6coast">
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
                      data={[]}
                      fitAreas={coastRows}
                      unit={seaUnit}
                      range={mapRange}
                      ramp="semantic"
                      mid={0}
                      lowLabel={t("act3.map_low")}
                      midLabel={t("act3.map_mid")}
                      highLabel={t("act3.map_high")}
                      noTokenMsg={t("act1.map_no_token")}
                      coastlineUrl={COAST_URL}
                    />
                  </Suspense>
                </ErrorBoundary>
                <div className="act6coast__legend">
                  <div className="act6coast__scale">
                    <span className="act6coast__end">
                      {t("act3.coast.legend_erosion")}
                    </span>
                    <span className="act6coast__bar" aria-hidden="true" />
                    <span className="act6coast__end">
                      {t("act3.coast.legend_accretion")}
                    </span>
                  </div>
                  <span className="act6coast__attr">
                    {t("act3.coast.attr")}
                  </span>
                </div>
              </div>
            ),
          },
          {
            id: "coastbal",
            empty: coastRows.length === 0,
            tab: tx("act3.board.tab_bilan", "Bilan", "Balance"),
            title: t("act3.viz.coastbal_title"),
            finding: t("act3.board.coastbal_find"),
            takeaway: t("act3.board.coastbal_take"),
            legend: {
              y: tx("act3.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act3.key.coastbal_x",
                "Le bilan du trait de côte : ce qui s'est retiré d'un côté, ce qui s'est accumulé de l'autre.",
                "The coastline balance: what receded on one side, what accreted on the other.",
              ),
              color: tx(
                "act3.key.coastbal_c",
                "Deux pôles autour de zéro : le retrait d'un côté, l'accumulation de l'autre. Zéro = un trait stable.",
                "Two poles around zero: retreat on one side, accretion on the other. Zero = a stable coastline.",
              ),
              note: tx("act3.key.sea_note", SOURCE_SEA_FR, SOURCE_SEA_EN),
              swatch: "polarity",
            },
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <CoastBalanceChart
                rows={coastRows}
                retreatLabel={t("act3.coast.legend_erosion_short")}
                advanceLabel={t("act3.coast.legend_accretion_short")}
                unit="%"
              />
            ),
          },
          {
            id: "coastmap",
            empty: coastEroPoints.length === 0,
            tab: t("act3.board.tab_coastmap"),
            title: t("act3.viz.coastmap_title"),
            finding: t("act3.board.coastmap_find"),
            takeaway: t("act3.board.coastmap_take"),
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
                    data={coastEroPoints}
                    unit={t("act3.coast.ero_unit")}
                    range={eroRange}
                    ramp="diverging"
                    lowLabel={t("act3.coastmap_low")}
                    midLabel={t("act3.coastmap_mid")}
                    highLabel={t("act3.coastmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "spread",
            empty: spreadRows.length === 0,
            tab: tx("act3.board.tab_dispersion", "Dispersion", "Spread"),
            title: t("act3.viz.spread_title"),
            finding: t("act3.board.spread_find"),
            takeaway: t("act3.board.spread_take"),
            legend: {
              ...key,
              y: tx("act3.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act3.key.spread_x",
                "La dispersion des valeurs d'une année à l'autre : plus la barre est large, plus le signal est irrégulier.",
                "How values scatter from year to year: the wider the bar, the noisier the signal.",
              ),
            },
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <CoastSpreadChart
                rows={spreadRows}
                unit={t("act3.coast.rate_unit")}
              />
            ),
          },
          {
            id: "bubble",
            empty: bubbleGroups.every((g) => !g.points.length),
            tab: tx("act3.board.tab_pression", "Pression", "Pressure"),
            title: t("act3.viz.bubble_title"),
            finding: t("act3.board.bubble_find"),
            takeaway: t("act3.board.bubble_take"),
            legend: {
              y: tx(
                "act3.key.bubble_y",
                "La croissance de la population, en pourcentage par an.",
                "Population growth, percent per year.",
              ),
              x: tx(
                "act3.key.bubble_x",
                "L'anomalie du niveau de la mer, en mètres.",
                "Sea-level anomaly, in metres.",
              ),
              color: tx(
                "act3.key.bubble_c",
                "Croiser les deux LOCALISE les endroits où l'adaptation presse. Cela ne démontre aucune cause : ce sont deux mesures indépendantes posées sur le même territoire.",
                "Crossing the two LOCATES where adaptation is urgent. It proves no cause: these are two independent measures laid over the same territory.",
              ),
              note: tx("act3.key.sea_note", SOURCE_SEA_FR, SOURCE_SEA_EN),
              swatch: "none",
            },
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <BubbleChart
                groups={bubbleGroups}
                xName={t("act3.viz.bubble_x")}
                yName={t("act3.viz.bubble_y")}
                zName={t("act3.viz.bubble_z")}
                xUnit="%"
              />
            ),
          },
          {
            id: "path",
            empty: noPath,
            tab: tx("act3.board.tab_trajectoire", "Trajectoire", "Path"),
            title: t("act3.viz.path_title"),
            finding: t("act3.board.path_find"),
            takeaway: t("act3.board.path_take"),
            legend: key,
            hint: tx(
              "act3.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <DumbbellChart
                rows={pathRows}
                unit={popUnit}
                startLabel={t("act3.path_start")}
                endLabel={t("act3.path_end")}
              />
            ),
          },
          {
            id: "coverage",
            empty: noSeaSeries,
            tab: t("act3.board.tab_coverage"),
            title: t("act3.viz.coverage_title"),
            finding: t("act3.board.coverage_find"),
            takeaway: t("act3.board.coverage_take"),
            node: (
              <CoverageChart
                series={seaSeries}
                years={seaYears}
                labels={{
                  present: t("act1.coverage.present"),
                  absent: t("act1.coverage.absent"),
                }}
              />
            ),
          },
        ]
      : [];

  // Le jeu choisi décide des VUES : "both" reste visible dans les deux.
  const visibleCharts = charts.filter((c) => {
    const d = DATASET_OF[c.id] || "both";
    return d === "both" || d === dataset;
  });

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a3_tag")}
      title={t("home.acts.a3_title")}
      thesis={t("act3.thesis")}
      filters={filtersEl}
      charts={visibleCharts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      initialTab="coast"
      progress={{ index: 7, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act3.board.switch_hint"),
        signature: t("act3.board.signature"),
        takeawayKicker: t("act3.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act3.board.start"),
        conclusion: t("act3.board.conclusion"),
        backIntro: t("act3.board.back_intro"),
        reviseData: t("act3.board.revise_data"),
      }}
      outro={{
        kicker: t("act3.outro.kicker"),
        title: t("act3.outro.title"),
        text: t("act3.outro.text"),
        primary: { to: "/sante", label: t("act3.outro.next") },
        secondary: { to: "/", label: t("act3.outro.home") },
      }}
    />
  );
}
