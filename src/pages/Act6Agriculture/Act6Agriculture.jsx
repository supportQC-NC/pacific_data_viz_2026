// src/pages/Act6Agriculture/Act6Agriculture.jsx
// ============================================================
// Acte « La terre nourricière » — 5ᵉ étape du parcours (JOURNEY).
// Deux jeux officiels du Challenge :
//   • Rendements agricoles & élevage (FAOSTAT QCL, CC BY 4.0) — kg/ha et
//     kg/animal ; agrégats FAOSTAT supprimés (anti doubles comptages).
//     ⚠ Vue d'ensemble = MÉDIANE des rendements par culture (même poids
//     par culture) — choix de lecture ≠ rendement total FAO (pondéré par
//     les surfaces) : assumé et affiché dans « Les données ».
//   • Couverture des sols : indice CALCI (FMI, base 100 = 2015), via le
//     store (DF_CLIMATE_CHANGE · ALT_LAND_COVER) — un INDICE, pas une
//     surface ; certaines valeurs peuvent être estimées par le FMI.
// Aucune attribution causale au climat : les vues localisent et comparent.
//
// Vues « maîtrise de la donnée » (jury) :
//   • Les données : carte d'identité DOUBLE (formules FAO, règle
//     anti-agrégats, notre médiane assumée, CALCI = indice).
//   • Couverture  : matrice binaire territoires × années, suit le type
//     choisi (cultures/élevage) ; les vides montrés, jamais comblés.
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
import { fetchAgriProduction } from "../../services/agriApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import CropRanking from "../../components/CropRanking/CropRanking";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import ApexYearHeatmap from "../../components/charts/ApexYearHeatmap";
// Les visuels de la Home qui portent les jeux de cette escale. Chacun lit
// exactement le même jeu qu'une des trois mesures du sélecteur :
// PlantGrowth → cropYield, CattleThrive → livestockYield,
// ForestCover → landCover. Ils restent montés sur la page d'accueil ; on les
// ajoute ici, on ne les déplace pas.
import PlantGrowth from "../../components/PlantGrowth/PlantGrowth";
import CattleThrive from "../../components/CattleThrive/CattleThrive";
import ForestCover from "../../components/ForestCover/ForestCover";
import RankChart from "../../components/charts/RankChart";
import BarRace from "../../components/BarRace/BarRace";
import CropExplorer from "../../components/CropExplorer/CropExplorer";
import CoverageChart from "../../components/charts/CoverageChart";
import useThemeTokens from "../../hooks/UseThemeTokens";
import ChangeChart from "../../components/charts/ChangeChart";
import TrendChart from "../../components/charts/TrendChart";
import SlopeChart from "../../components/charts/SlopeChart";
import VizSwitch from "../../components/VizSwitch/VizSwitch";
import { useDispatch, useSelector } from "react-redux";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import "./Act6Agriculture.scss";

// Les trois jeux de l'escale, chacun avec sa source et son unité propre : un
// rendement et un indice d'occupation des sols ne se lisent pas contre la
// même référence, et ne se comparent pas entre eux.
const SOURCE_CROP_FR =
  "FAOSTAT, via le Pacific Data Hub — rendement en kilogrammes par hectare récolté. Un rendement bouge rarement pour une seule raison : climat, intrants, surface déclarée.";
const SOURCE_CROP_EN =
  "FAOSTAT, via the Pacific Data Hub - yield in kilograms per hectare harvested. Yields rarely move for a single reason: climate, inputs, declared area.";
const SOURCE_LIVE_FR =
  "FAOSTAT, via le Pacific Data Hub — rendement en kilogrammes par animal. Même prudence de lecture que pour les cultures.";
const SOURCE_LIVE_EN =
  "FAOSTAT, via the Pacific Data Hub - yield in kilograms per animal. Read with the same caution as crops.";
const SOURCE_LAND_FR =
  "Indice CALCI d'occupation des sols, via le Pacific Data Hub — base 100 en 2015. C'est un INDICE d'usage, pas une surface.";
const SOURCE_LAND_EN =
  "CALCI land-cover index, via the Pacific Data Hub - base 100 in 2015. It is a land-USE index, not an area.";

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

const median = (arr) => {
  if (!arr.length) return null;
  const v = [...arr].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Rendement MÉDIAN par territoire-année pour un type ("crop" = kg/ha).
function buildAggregate(data, kind = "crop") {
  if (!data || !data.commodities) return null;
  const codes = data.commodities
    .filter((c) => c.kind === kind)
    .map((c) => c.code);
  const bucket = {};
  codes.forEach((code) => {
    const d = data.byCommodity[code];
    if (!d) return;
    Object.entries(d.byArea).forEach(([geo, serie]) => {
      serie.forEach(({ year, value }) => {
        if (!Number.isFinite(value)) return;
        bucket[geo] = bucket[geo] || {};
        (bucket[geo][year] = bucket[geo][year] || []).push(value);
      });
    });
  });
  const byArea = {};
  const yearsSet = new Set();
  let min = Infinity;
  let max = -Infinity;
  Object.entries(bucket).forEach(([geo, years]) => {
    const serie = Object.entries(years)
      .map(([y, vals]) => {
        const value = median(vals);
        const year = Number(y);
        yearsSet.add(year);
        if (value < min) min = value;
        if (value > max) max = value;
        return { year, value };
      })
      .sort((a, b) => a.year - b.year);
    byArea[geo] = serie;
  });
  const years = [...yearsSet].sort((a, b) => a - b);
  return {
    byArea,
    years,
    areas: Object.keys(byArea),
    range: {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
    },
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

function allSeries(agg, lang) {
  if (!agg) return [];
  return agg.areas
    .filter((a) => isPict(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (agg.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }));
}
function pointsAt(agg, year, lang) {
  if (!agg) return [];
  return agg.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const p = (agg.byArea[a] || []).find((q) => q.year === year);
      return p && Number.isFinite(p.value)
        ? { area: a, name: pictName(a, lang), value: p.value, year }
        : null;
    })
    .filter(Boolean);
}

/* ---------- Filtres globaux ---------- */
function Select({ label, options, value, onChange }) {
  return (
    <div className="act1f act1f--select">
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__selwrap">
        <select
          className="act1f__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {options.map((o) => (
            <option key={String(o.v)} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="act1f__caret" aria-hidden="true">
          ▾
        </span>
      </div>
    </div>
  );
}

export default function Act6Agriculture() {
  const { t, lang } = useLang();

  // Repli littéral tant que la clé n'est pas versée dans les dictionnaires.
  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );
  const tk = useThemeTokens();
  const dispatch = useDispatch();
  const land = useSelector(selectDataset("landCover"));

  const [agri, setAgri] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [dataset, setDataset] = useState("crop"); // crop | livestock | soil
  const kind = dataset === "soil" ? "crop" : dataset; // les vues de production restent en crop/livestock
  const [raceProduct, setRaceProduct] = useState(null);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setAgri((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchAgriProduction({ signal: ctrl.signal, lang }).then((res) => {
      if (!alive) return;
      const ok = res.source === "live" && res.commodities.length;
      setAgri({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  useEffect(() => {
    dispatch(loadDataset("landCover"));
  }, [dispatch]);

  const agg = useMemo(
    () => (agri.data ? buildAggregate(agri.data, kind) : null),
    [agri.data, kind],
  );
  const years = useMemo(() => agg?.years || [], [agg]);

  // Le type (cultures/élevage) a ses propres années → on réinitialise le curseur.
  useEffect(() => {
    setYearIdx(null);
  }, [kind]);

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);
  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  const areaVisible = useCallback(
    (a) => region === "all" || REGION_OF[a] === region,
    [region],
  );

  const vSeries = useMemo(
    () =>
      allSeries(agg, lang).filter(
        (s) => areaVisible(s.area) && s.values.length,
      ),
    [agg, lang, areaVisible],
  );
  const points = useMemo(
    () =>
      (agg && currentYear != null
        ? pointsAt(agg, currentYear, lang)
        : []
      ).filter((p) => areaVisible(p.area)),
    [agg, currentYear, lang, areaVisible],
  );

  const firstYear = agg?.firstYear ?? null;
  const lastYear = agg?.lastYear ?? null;

  // Indice d'occupation des sols modifiant le climat (CALCI, base 2015 = 100),
  // chargé via le store (DF_CLIMATE_CHANGE · ALT_LAND_COVER), filtré par sous-région.
  const landReady = land.status === "succeeded" && !!land.data;
  const landYears = useMemo(
    () => (land.data ? land.data.years : []),
    [land.data],
  );
  const landSeries = useMemo(() => {
    const d = land.data;
    if (!d) return [];
    return d.areas
      .filter((a) => isPict(a) && areaVisible(a))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        values: (d.byArea[a] || [])
          .filter((q) => Number.isFinite(q.value))
          .sort((x, y) => x.year - y.year),
      }))
      .filter((sx) => sx.values.length);
  }, [land.data, lang, areaVisible]);
  // Évolution vs 2015 (= 100) : dernière valeur − 100, par territoire.
  const landChangeRows = useMemo(
    () =>
      landSeries
        .map((sx) => ({
          name: sx.name,
          delta: sx.values[sx.values.length - 1].value - 100,
        }))
        .filter((r) => Number.isFinite(r.delta)),
    [landSeries],
  );
  // Slope : première -> dernière année observée, par territoire.
  const landSlopeRows = useMemo(
    () =>
      landSeries
        .map((sx) => ({
          name: sx.name,
          left: sx.values[0].value,
          right: sx.values[sx.values.length - 1].value,
        }))
        .filter((r) => Number.isFinite(r.left) && Number.isFinite(r.right)),
    [landSeries],
  );
  const landSlopeMax = useMemo(() => {
    const v = landSlopeRows.flatMap((r) => [r.left, r.right]);
    return v.length ? Math.ceil(Math.max(...v) / 10) * 10 : 200;
  }, [landSlopeRows]);

  const cropRankRows = useMemo(() => {
    if (!agri.data || currentYear == null) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === kind)
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        const vals = d.areas
          .filter((a) => isPict(a) && areaVisible(a))
          .map((a) => (d.byArea[a] || []).find((p) => p.year === currentYear))
          .filter((p) => p && Number.isFinite(p.value))
          .map((p) => p.value);
        if (!vals.length) return null;
        return {
          code: c.code,
          label: c.label,
          value: median(vals),
          year: currentYear,
        };
      })
      .filter(Boolean);
  }, [agri.data, currentYear, areaVisible, kind]);

  const dumbbellRows = useMemo(() => {
    if (!agg || firstYear == null || lastYear == null) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area))
      .map((s) => {
        const pa = s.values.find((p) => p.year === firstYear);
        const pb = s.values.find((p) => p.year === lastYear);
        return pa &&
          pb &&
          Number.isFinite(pa.value) &&
          Number.isFinite(pb.value)
          ? { area: s.area, name: s.name, a: pa.value, b: pb.value }
          : null;
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible, firstYear, lastYear]);

  const regionalSeries = useMemo(() => {
    if (!agg) return [];
    const all = allSeries(agg, lang).filter((s) => areaVisible(s.area));
    const vals = years
      .map((y) => {
        const ptsY = all
          .map((s) => s.values.find((p) => p.year === y))
          .filter((p) => p && Number.isFinite(p.value))
          .map((p) => p.value);
        const m = median(ptsY);
        return m == null ? null : { year: y, value: m };
      })
      .filter(Boolean);
    return [{ area: "PAC", name: t("act6.regional_name"), values: vals }];
  }, [agg, years, lang, areaVisible, t]);

  const unit = kind === "crop" ? t("act6.unit") : t("act6.livestock_unit");

  // Stabilité = coefficient de variation (%) du rendement dans le temps,
  // par territoire. Faible CV = production régulière (résiliente).
  const volatilityRows = useMemo(() => {
    if (!agg) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area) && s.values.length >= 3)
      .map((s) => {
        const xs = s.values.map((p) => p.value);
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
        if (!mean) return null;
        const variance =
          xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
        const cv = (Math.sqrt(variance) / mean) * 100;
        return { name: s.name, value: Math.round(cv * 10) / 10 };
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible]);
  const volatilityMedian = useMemo(
    () => median(volatilityRows.map((r) => r.value)) ?? 0,
    [volatilityRows],
  );

  // --- Course animée : un produit choisi, ses territoires sur toute la période ---
  const raceProducts = useMemo(() => {
    if (!agri.data) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === kind)
      .filter((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return false;
        return (
          d.areas.filter(
            (a) =>
              isPict(a) &&
              (d.byArea[a] || []).some((p) => Number.isFinite(p.value)),
          ).length >= 2
        );
      });
  }, [agri.data, kind]);

  useEffect(() => {
    if (
      raceProducts.length &&
      (raceProduct == null || !raceProducts.some((c) => c.code === raceProduct))
    ) {
      setRaceProduct(raceProducts[0].code);
    }
  }, [raceProducts, raceProduct]);

  const raceData =
    raceProduct && agri.data ? agri.data.byCommodity[raceProduct] : null;
  const raceMeta = raceProducts.find((c) => c.code === raceProduct);
  const raceYears = useMemo(() => raceData?.years || [], [raceData]);
  const raceSeries = useMemo(() => {
    if (!raceData) return [];
    return raceData.areas
      .filter((a) => isPict(a) && areaVisible(a))
      .map((a) => {
        const s = (raceData.byArea[a] || [])
          .filter((p) => Number.isFinite(p.value))
          .sort((x, y) => x.year - y.year);
        let last = null;
        const values = raceYears.map((y) => {
          const ex = s.find((p) => p.year === y);
          if (ex) last = ex.value;
          return { year: y, value: last == null ? 0 : last };
        });
        return { area: a, name: pictName(a, lang), values };
      })
      .filter((r) => r.values.some((v) => v.value > 0));
  }, [raceData, raceYears, areaVisible, lang]);

  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const retry = useCallback(() => {
    setAgri({ status: "loading", data: null });
    setYearIdx(null);
    fetchAgriProduction({ lang }).then((res) => {
      const ok = res.source === "live" && res.commodities.length;
      setAgri({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
  }, [lang]);

  const status =
    agri.status === "ready"
      ? years.length
        ? "ready"
        : "empty"
      : agri.status === "loading"
        ? "loading"
        : "empty";

  // Trois JEUX DE DONNÉES traités à égalité, basculés par icônes.
  const datasetItems = [
    {
      id: "crop",
      label: t("act6.board.kind_crop"),
      icon: "crop",
      tone: "positive",
    },
    {
      id: "livestock",
      label: t("act6.board.kind_livestock"),
      icon: "livestock",
      tone: "warm",
    },
    {
      id: "soil",
      label: t("act6.dataset.soil"),
      icon: "soil",
      tone: "secondary",
    },
  ];
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));

  // Les deux sélecteurs de l'escale passent en menus déroulants. Les listes
  // d'items existantes ({ id, label, … }) sont réutilisées telles quelles :
  // on ne les redéfinit pas, on les adapte à la forme attendue.
  const asOptions = (items) =>
    (items || []).map((it) => ({ value: it.id, label: it.label }));

  // ---------- LES COMMANDES PASSENT AU GRAPHIQUE -----------------------
  // Les deux menus siégeaient dans la barre de l'escale, sous l'étiquette
  // « Données ». Ils y pesaient sur toute la largeur, poussaient les onglets
  // et laissaient croire à un réglage d'ensemble alors qu'ils ne servent pas
  // à toutes les vues de la même façon.
  //
  // Chaque graphique porte donc les siennes, dans sa colonne de lecture — là
  // où l'on voit ce qu'elles changent. L'en-tête n'a plus que la navigation.
  const boardControls = (
    <>
      <ChartFilter
        label={t("act6.board.dataset_label")}
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
    </>
  );

  // Carte d'identité DOUBLE (rendements FAOSTAT + indice CALCI) — 100 % i18n.
  const spotlightRows = [
    { k: t("act6.spotlight.r1k"), v: t("act6.spotlight.r1v") },
    { k: t("act6.spotlight.r2k"), v: t("act6.spotlight.r2v") },
    { k: t("act6.spotlight.r3k"), v: t("act6.spotlight.r3v") },
    { k: t("act6.spotlight.r4k"), v: t("act6.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act6.spotlight.n1"),
    t("act6.spotlight.n2"),
    t("act6.spotlight.n3"),
    t("act6.spotlight.n4"),
    t("act6.spotlight.n5"),
  ];

  // CE QUE PORTENT LES AXES change avec le jeu : des kilos par hectare, des
  // kilos par animal, ou un indice base 100. Une seule clé pour l'escale
  // entière mentirait sur deux jeux sur trois.
  const key =
    dataset === "soil"
      ? {
          y: tx(
            "act6.key.land_y",
            "Indice d'occupation des sols, base 100 en 2015. 100 = le niveau de 2015 pour ce territoire, pas un niveau commun.",
            "Land-cover index, base 100 in 2015. 100 = that territory's own 2015 level, not a shared level.",
          ),
          x: tx("act6.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act6.key.mag_c",
            "Une seule teinte : plus elle est marquée, plus la valeur est élevée. Aucun jugement de valeur, seulement une grandeur.",
            "A single hue: the stronger it is, the higher the value. No value judgement, only a magnitude.",
          ),
          note: tx("act6.key.land_note", SOURCE_LAND_FR, SOURCE_LAND_EN),
          swatch: "magnitude",
        }
      : dataset === "livestock"
        ? {
            y: tx(
              "act6.key.live_y",
              "Rendement en kilogrammes par animal. Ce n'est pas un nombre de bêtes.",
              "Yield in kilograms per animal. This is not a head count.",
            ),
            x: tx("act6.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
            color: tx(
              "act6.key.mag_c",
              "Une seule teinte : plus elle est marquée, plus la valeur est élevée. Aucun jugement de valeur, seulement une grandeur.",
              "A single hue: the stronger it is, the higher the value. No value judgement, only a magnitude.",
            ),
            note: tx("act6.key.live_note", SOURCE_LIVE_FR, SOURCE_LIVE_EN),
            swatch: "magnitude",
          }
        : {
            y: tx(
              "act6.key.crop_y",
              "Rendement en kilogrammes par hectare récolté. La surface déclarée entre dans le calcul autant que la récolte.",
              "Yield in kilograms per hectare harvested. Declared area enters the figure as much as the harvest does.",
            ),
            x: tx("act6.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
            color: tx(
              "act6.key.mag_c",
              "Une seule teinte : plus elle est marquée, plus la valeur est élevée. Aucun jugement de valeur, seulement une grandeur.",
              "A single hue: the stronger it is, the higher the value. No value judgement, only a magnitude.",
            ),
            note: tx("act6.key.crop_note", SOURCE_CROP_FR, SOURCE_CROP_EN),
            swatch: "magnitude",
          };

  // ---------- LES TROIS VISUELS DE L'ESCALE ----------------------------
  // Ils occupaient chacun leur onglet. Or la barre énumère les ÉTAPES du
  // raisonnement — tendance, matrice, carte — et trois dessins qui répondent
  // à la même question n'en font pas trois. Regroupés sous une seule entrée,
  // ils libèrent la barre, et le choix passe DANS le panneau.
  //
  // Chaque dessin garde son titre, sa phrase et sa clé de lecture : la
  // colonne de droite reste exacte, ce qu'une fusion aurait perdu.
  //
  // La bascule suit le SÉLECTEUR DE MESURE, comme toutes les autres vues :
  // les deux dessins de production ensemble, celui des sols seul. Face à un
  // seul choix, `VizSwitch` ne s'affiche pas — un sélecteur à une option est
  // un mensonge sur l'interface.
  const VIZ = {
    plant: {
              id: "plant",
              empty: false,
              tab: tx("act6.board.tab_pousse", "Pousse", "Growth"),
              title: tx(
                "act6.viz.plant_title",
                "Le rendement des cultures, territoire par territoire",
                "Crop yield, territory by territory",
              ),
              finding: tx(
                "act6.viz.plant_find",
                "Choisissez un territoire : la plante suit son rendement.",
                "Pick a territory: the plant follows its yield.",
              ),
              takeaway: tx(
                "act6.viz.plant_take",
                "Une plante plus haute ne dit pas une meilleure agriculture : elle dit plus de kilos par hectare déclaré. Le pourquoi n'est pas dans ce chiffre.",
                "A taller plant does not mean better farming: it means more kilos per declared hectare. The why is not in this number.",
              ),
              hint: tx(
                "act6.hint.plant",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act6.key.plant_c",
                  "La plante grandit avec le rendement du territoire choisi, et se rétracte quand il baisse.",
                  "The plant grows with the chosen territory's yield, and shrinks when it falls.",
                ),
                note: tx("act6.key.crop_note", SOURCE_CROP_FR, SOURCE_CROP_EN),
                // La plante encode par une HAUTEUR, pas par une teinte.
                swatch: "none",
              },
              node: <PlantGrowth embed />,
            },
    cattle: {
              id: "cattle",
              empty: false,
              tab: tx("act6.board.tab_betail", "Bétail", "Livestock"),
              title: tx(
                "act6.viz.cattle_title",
                "Le rendement de l'élevage, territoire par territoire",
                "Livestock yield, territory by territory",
              ),
              finding: tx(
                "act6.viz.cattle_find",
                "Choisissez un territoire : l'animal suit son rendement.",
                "Pick a territory: the animal follows its yield.",
              ),
              takeaway: tx(
                "act6.viz.cattle_take",
                "Des kilos par animal, pas un nombre d'animaux : un troupeau qui rétrécit peut très bien afficher un rendement qui monte.",
                "Kilos per animal, not a head count: a shrinking herd can perfectly well post a rising yield.",
              ),
              hint: tx(
                "act6.hint.cattle",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act6.key.cattle_c",
                  "L'animal s'étoffe avec le rendement du territoire choisi.",
                  "The animal fills out with the chosen territory's yield.",
                ),
                note: tx("act6.key.live_note", SOURCE_LIVE_FR, SOURCE_LIVE_EN),
                swatch: "none",
              },
              node: <CattleThrive embed />,
            },
    forest: {
              id: "forest",
              empty: false,
              tab: tx("act6.board.tab_sols", "Sols", "Land"),
              title: tx(
                "act6.viz.forest_title",
                "L'occupation des sols, territoire par territoire",
                "Land cover, territory by territory",
              ),
              finding: tx(
                "act6.viz.forest_find",
                "Choisissez un territoire : le couvert suit son indice d'occupation des sols.",
                "Pick a territory: the cover follows its land-cover index.",
              ),
              takeaway: tx(
                "act6.viz.forest_take",
                "Base 100 en 2015 : ce visuel montre un écart à cette année-là, pas une surface. Deux territoires au même niveau n'ont pas la même forêt.",
                "Base 100 in 2015: this shows a gap from that year, not an area. Two territories at the same level do not have the same forest.",
              ),
              hint: tx(
                "act6.hint.forest",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act6.key.forest_c",
                  "Le couvert se densifie quand l'indice dépasse sa base 2015, et s'éclaircit quand il passe dessous.",
                  "The cover thickens when the index rises above its 2015 base, and thins when it falls below.",
                ),
                note: tx("act6.key.land_note", SOURCE_LAND_FR, SOURCE_LAND_EN),
                swatch: "none",
              },
              node: <ForestCover embed />,
            },
  };

  // SUR LA VUE DU VISUEL, LA BASCULE EST LE SÉLECTEUR DE JEU.
  // Ses trois options — cultures, élevage, sols — sont exactement celles du
  // menu « Données ». Afficher les deux côte à côte aurait dit deux fois la
  // même chose, et laissé le lecteur se demander lequel commande. La bascule
  // pilote donc `dataset` directement, et le dessin suit.
  const VIZ_OF = { crop: "plant", livestock: "cattle", soil: "forest" };
  const vizItems = [
    { id: "crop", label: tx("act6.viz.sw_plant", "Cultures", "Crops") },
    { id: "livestock", label: tx("act6.viz.sw_cattle", "Élevage", "Livestock") },
    { id: "soil", label: tx("act6.viz.sw_forest", "Sols", "Land") },
  ];
  const activeViz = VIZ[VIZ_OF[dataset] || "plant"];

  const charts =
    status === "ready" && currentYear != null
      ? [
          {
            ...activeViz,
            id: "viz",
            // L'onglet porte le nom du dessin affiché — « Pousse », « Verre »,
            // « Foule »… — et change avec la bascule. La barre annonce ainsi ce
            // qu'on va voir, comme sur les escales 01 et 02, au lieu de la
            // catégorie à laquelle il appartient.
            node: (
              <div className="vizpane">
                <VizSwitch
                  items={vizItems}
                  value={dataset}
                  onChange={setDataset}
                  label={tx("act6.viz.sw_label", "Visuel", "Visual")}
                />
                <div className="vizpane__body">{activeViz.node}</div>
              </div>
            ),
          },
          // ---------- Les visuels interactifs, en ouverture ----------------
          // Trois dessins de la Home, un par jeu de données de l'escale, et
          // c'est exactement le même jeu qu'ils lisent — `cropYield`,
          // `livestockYield`, `landCover`. Ils se suivent en tête de
          // navigation : le sélecteur de mesure décide lesquels sont à
          // l'écran (les deux de production ensemble, celui des sols seul,
          // comme pour toutes les autres vues de cette escale).
          //
          // Ils ouvrent parce qu'un rendement en kg/ha ne se ressent pas :
          // le dessin lui donne une taille avant que les courbes ne le
          // mettent en série.
          {
            id: "small",
            signature: true,
            empty: vSeries.length === 0,
            tab: tx("act6.board.tab_multiples_1", "Multiples", "Multiples"),
            title: t("act6.trend_title"),
            finding: t("act6.board.small_find"),
            takeaway: t("act6.board.small_take"),
            controls: boardControls,
            legend: key,
            hint: tx(
              "act6.hint.multiples",
              "Toutes les vignettes partagent la même échelle : elles se comparent du regard.",
              "Every panel shares one scale: they compare at a glance.",
            ),
            node: (
              <div className="act6b__scroll">
                <SmallMultiples
                  series={vSeries}
                  years={years}
                  unit={unit}
                  currentYear={currentYear}
                  labels={{ last: t("act6.smallmult_last") }}
                />
              </div>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act6.board.tab_read"),
            title: t("act6.read_title"),
            finding: t("act6.board.read_find"),
            takeaway: t("act6.board.read_take"),
            controls: boardControls,
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act6.spotlight.ex_kicker"),
                  text: t("act6.spotlight.ex_text"),
                }}
                link={{
                  href: "https://www.fao.org/faostat/en/#data/QCL/metadata",
                  label: t("act6.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "regional",
            empty:
              !regionalSeries.length || regionalSeries[0].values.length < 2,
            tab: tx("act6.board.tab_tendance", "Tendance", "Trend"),
            title: t("act6.regional_title"),
            finding: t("act6.board.regional_find"),
            takeaway: t("act6.board.regional_take"),
            controls: boardControls,
            legend: key,
            hint: tx(
              "act6.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <div className="act6b__fit">
                <TrendLines
                  series={regionalSeries}
                  years={years}
                  currentYear={currentYear}
                  unit={unit}
                />
              </div>
            ),
          },
          {
            id: "crops",
            empty: cropRankRows.length === 0,
            tab:
              kind === "crop"
                ? tx("act6.board.tab_palmares", "Palmarès", "Ranking")
                : tx("act6.board.tab_palmares", "Palmarès", "Ranking"),
            title: `${kind === "crop" ? t("act6.crop_rank_title") : t("act6.animal_rank_title")} · ${currentYear}`,
            finding: t("act6.board.crops_find"),
            takeaway: t("act6.board.crops_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.item_y", "Une culture ou un élevage par ligne.", "One crop or livestock type per row."),
              x: key.y,
            },
            hint: tx(
              "act6.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <div className="act6b__scroll">
                <CropRanking rows={cropRankRows} unit={unit} max={12} />
              </div>
            ),
          },
          {
            id: "change",
            empty: dumbbellRows.length === 0,
            tab: t("act6.board.tab_change"),
            title: `${t("act6.compare_title")} · ${firstYear}–${lastYear}`,
            finding: t("act6.board.change_find"),
            takeaway: t("act6.board.change_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.y,
            },
            hint: tx(
              "act6.hint.change",
              "Comparez la longueur des barres : elle dit l'ampleur du changement, pas le niveau atteint.",
              "Compare bar lengths: they show how much changed, not the level reached.",
            ),
            node: (
              <div className="act6b__scroll">
                <DumbbellChart
                  rows={dumbbellRows}
                  yearA={firstYear}
                  yearB={lastYear}
                  unit={unit}
                  decimals={0}
                  labels={{
                    up: t("act6.compare_up"),
                    down: t("act6.compare_down"),
                  }}
                />
              </div>
            ),
          },
          {
            id: "stability",
            empty: volatilityRows.length === 0,
            tab: t("act6.board.tab_stability"),
            title: t("act6.board.stability_title"),
            finding: t("act6.board.stability_find"),
            takeaway: t("act6.board.stability_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act6.key.stab_x",
                "La dispersion des rendements d'une année à l'autre : plus la barre est large, plus la récolte est irrégulière.",
                "How yields scatter from year to year: the wider the bar, the more irregular the harvest.",
              ),
            },
            hint: tx(
              "act6.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <RankChart
                points={volatilityRows}
                unit="%"
                median={volatilityMedian}
                refLabel={t("act6.median_ref")}
                sort="desc"
                scale="lin"
              />
            ),
          },
          {
            id: "race",
            empty: raceSeries.length < 2,
            tab: t("act6.board.tab_race"),
            title: t("act6.board.race_title"),
            finding: t("act6.board.race_find"),
            takeaway: t("act6.board.race_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.y,
            },
            hint: tx(
              "act6.hint.race",
              "Lancez l'animation : les barres se réordonnent au fil des années.",
              "Press play: the bars reorder themselves year after year.",
            ),
            node: (
              <div className="act6b__race">
                <div className="act6b__racebar">
                  <Select
                    label={t("act6.board.race_pick")}
                    options={raceProducts.map((c) => ({
                      v: c.code,
                      label: c.label,
                    }))}
                    value={raceProduct ?? ""}
                    onChange={setRaceProduct}
                  />
                </div>
                <BarRace
                  series={raceSeries}
                  years={raceYears}
                  unit={raceMeta?.unit || unit}
                  decimals={0}
                  tk={tk}
                  labels={{
                    play: t("act1.race.play"),
                    pause: t("act1.race.pause"),
                    restart: t("act1.race.restart"),
                  }}
                  autoplay={false}
                  loop={false}
                  tick={1800}
                />
              </div>
            ),
          },
          {
            id: "heat",
            empty: vSeries.length === 0,
            tab: tx("act6.board.tab_matrice", "Matrice", "Matrix"),
            title: t("act6.heatmap_title"),
            finding: t("act6.board.heat_find"),
            takeaway: t("act6.board.heat_take"),
            controls: boardControls,
            legend: {
              y: tx("act6.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: key.x,
              color: key.color,
              note: key.note,
              swatch: key.swatch,
            },
            hint: tx(
              "act6.hint.heat",
              "Balayez une ligne de gauche à droite : une année isolée oscille, une bande continue s'installe.",
              "Read a row left to right: a lone year wobbles, an unbroken band has settled in.",
            ),
            node: (
              <div className="act6b__scroll">
                <ApexYearHeatmap
                  series={vSeries}
                  years={years}
                  unit={unit}
                  scale="sequential"
                  decimals={0}
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
            empty: points.length === 0,
            tab: tx("act6.board.tab_carte", "Carte", "Map"),
            title: `${t("act6.map_title")} · ${currentYear}`,
            finding: t("act6.board.map_find"),
            takeaway: t("act6.board.map_take"),
            controls: boardControls,
            legend: { color: key.color, note: key.note, swatch: key.swatch },
            hint: tx(
              "act6.hint.map",
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
                    data={points}
                    unit={unit}
                    // Rendements et indice d'occupation sont des GRANDEURS :
                    // pas de zéro chargé de sens, donc une seule teinte, du
                    // plus faible au plus élevé — la même que la pastille de
                    // la colonne et que la matrice.
                    ramp="magnitude"
                    mid={null}
                    range={agg ? agg.range : null}
                    logScale
                    lowLabel={t("act6.map_low")}
                    midLabel={t("act6.map_mid")}
                    highLabel={t("act6.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "explorer",
            bare: true,
            empty: !agri.data,
            tab: t("act6.board.tab_explorer"),
            title: t("act6.explorer_title"),
            finding: t("act6.board.explorer_find"),
            takeaway: t("act6.board.explorer_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.item_y", "Une culture ou un élevage par ligne.", "One crop or livestock type per row."),
              x: key.y,
            },
            hint: tx(
              "act6.hint.explorer",
              "Choisissez une culture ou un élevage : tout le tracé se recalcule sur lui.",
              "Pick a crop or a livestock type: the whole plot recomputes on it.",
            ),
            node: (
              <div className="act6b__scroll">
                <CropExplorer
                  data={agri.data}
                  kind={kind}
                  labels={{
                    pick:
                      kind === "crop"
                        ? t("act6.explorer_pick")
                        : t("act6.explorer_animal_pick"),
                  }}
                />
              </div>
            ),
          },
          {
            id: "land_change",
            empty: !landReady || landChangeRows.length === 0,
            tab: tx("act6.board.tab_land_evo", "Évolution", "Change"),
            title: t("act6.land.change_title"),
            finding: t("act6.board.land_change_find"),
            takeaway: t("act6.board.land_change_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act6.key.land_change_x",
                "L'écart d'indice entre la première et la dernière année disponibles.",
                "The index gap between the first and last available years.",
              ),
            },
            hint: tx(
              "act6.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <ChangeChart
                rows={landChangeRows}
                unit={t("act6.land.change_unit")}
                direction="all"
                polarity="down_good"
              />
            ),
          },
          {
            id: "land_lines",
            empty: !landReady || landSeries.length === 0,
            tab: tx("act6.board.tab_land_traj", "Trajectoire", "Path"),
            title: t("act6.land.lines_title"),
            finding: t("act6.board.land_lines_find"),
            takeaway: t("act6.board.land_lines_take"),
            controls: boardControls,
            legend: key,
            hint: tx(
              "act6.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <TrendChart
                series={landSeries}
                years={landYears}
                unit={t("act6.land.index_unit")}
                scale="lin"
              />
            ),
          },
          {
            id: "land_slope",
            empty: !landReady || landSlopeRows.length < 2,
            tab: tx("act6.board.tab_land_pente", "Pente", "Slope"),
            title: t("act6.land.slope_title"),
            finding: t("act6.board.land_slope_find"),
            takeaway: t("act6.board.land_slope_take"),
            controls: boardControls,
            legend: {
              ...key,
              y: tx("act6.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act6.key.land_slope_x",
                "La pente moyenne de l'indice, en points par an : le rythme, pas le niveau.",
                "The index's average slope, in points per year: the pace, not the level.",
              ),
            },
            hint: tx(
              "act6.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <SlopeChart
                rows={landSlopeRows}
                leftLabel={String(landYears[0] ?? "")}
                rightLabel={String(landYears[landYears.length - 1] ?? "")}
                unit={t("act6.land.index_unit")}
                min={0}
                max={landSlopeMax}
              />
            ),
          },
          {
            id: "coverage",
            empty: vSeries.length === 0,
            tab: t("act6.board.tab_coverage"),
            title: t("act6.coverage_title"),
            finding: t("act6.board.coverage_find"),
            takeaway: t("act6.board.coverage_take"),
            controls: boardControls,
            node: (
              <CoverageChart
                series={vSeries}
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

  // Le jeu choisi décide des VUES : Sol → ses 3 vues d'occupation ; Culture /
  // Élevage → toutes les vues de production.
  const SOIL_IDS = ["land_change", "land_lines", "land_slope"];
  // L'entrée des visuels reste à l'écran dans les deux familles : c'est la
  // bascule du panneau qui choisit le dessin, pas le carrousel.
  const visibleCharts = charts.filter((c) =>
    c.id === "viz"
      ? true
      : dataset === "soil"
        ? SOIL_IDS.includes(c.id)
        : !SOIL_IDS.includes(c.id),
  );

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act6.tag")}
      title={t("act6.title")}
      thesis={t("act6.thesis")}
      // L'en-tête ne porte plus de filtres : chaque graphique a les siens.
      filters={null}
      charts={visibleCharts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      progress={{ index: 5, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act6.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act6.board.switch_hint"),
        signature: t("act6.board.signature"),
        takeawayKicker: t("act6.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act6.board.start"),
        conclusion: t("act6.board.conclusion"),
        backIntro: t("act6.board.back_intro"),
        reviseData: t("act6.board.revise_data"),
      }}
      outro={{
        kicker: t("act6.outro.kicker"),
        title: t("act6.outro.title"),
        text: t("act6.outro.text"),
        primary: { to: "/vivant", label: t("act6.outro.next") },
        secondary: { to: "/", label: t("act6.outro.home") },
      }}
    />
  );
}
