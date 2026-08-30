// src/pages/Act8Ciel/Act8Ciel.jsx
// ============================================================
// Acte « Lire le ciel » — 3ᵉ étape du parcours (JOURNEY), trois jeux
// officiels du Challenge servis par cielApi :
//   • Pluie        : GPCP v2.3 (NOAA, CC0) — mm, anomalie vs normale
//     1991–2020 (standard OMM) ; totaux annuels sommés du mensuel.
//   • Température  : NOAAGlobalTemp v6.0.0 (NOAA/NCEI, CC0) — °C à 2 m,
//     anomalie vs normale 1971–2000, moyenne spatiale par pays.
//   • Réseau météo : OMM/OSCAR (CC BY-SA 4.0) — stations opérationnelles
//     cumulées (statuts « Silent »/« Unknown » exclus par le producteur).
// Un sélecteur de MESURE pilote tout le board ; chaque mesure se lit
// contre SA PROPRE référence — jamais contre celle d'une autre.
//
// Vues « maîtrise de la donnée » (jury) :
//   • Les données : carte d'identité TRIPLE (sources, normales, licences,
//     définition du cumul OSCAR) + exemple officiel (Wallis-et-Futuna).
//   • Couverture  : matrice binaire territoires × années, ADAPTATIVE —
//     elle suit la mesure choisie ; les vides montrés, jamais comblés.
// ============================================================

import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchCiel } from "../../services/cielApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import figuresFromBundle from "../../components/KeyFigures/fromBundle";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ApexYearHeatmap from "../../components/charts/ApexYearHeatmap";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import BarRace from "../../components/BarRace/BarRace";
import CoverageChart from "../../components/charts/CoverageChart";
// Le visuel de la Home qui porte l'indicateur de cette escale. Il reste
// monté sur la page d'accueil : on l'ajoute ici, on ne le déplace pas.
import SkyRain from "../../components/SkyRain/SkyRain";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act8Ciel.scss";

// Sources, mot pour mot ce que sert cielApi. Elles sont écrites une fois et
// épinglées en pied de la colonne de lecture, mesure par mesure : chaque
// mesure a sa propre normale, et l'annoncer fait partie de la lecture.
const SOURCE_RAIN_FR =
  "GPCP v2.3 (NOAA), CC0 — cumuls annuels sommés depuis le mensuel. Normale 1991-2020 : la période de référence standard de l'OMM.";
const SOURCE_RAIN_EN =
  "GPCP v2.3 (NOAA), CC0 — annual totals summed from monthly data. 1991-2020 normal: the WMO standard reference period.";
const SOURCE_TEMP_FR =
  "NOAAGlobalTemp v6.0.0 (NOAA / NCEI), CC0 — moyenne spatiale par pays. Normale 1971-2000, propre à chaque territoire.";
const SOURCE_TEMP_EN =
  "NOAAGlobalTemp v6.0.0 (NOAA / NCEI), CC0 — country-level spatial mean. 1971-2000 normal, specific to each territory.";
const SOURCE_METEO_FR =
  "OMM / OSCAR, CC BY-SA 4.0 — stations opérationnelles en cumul ; les statuts « silencieuse » et « inconnue » sont exclus par le producteur.";
const SOURCE_METEO_EN =
  "WMO / OSCAR, CC BY-SA 4.0 — operational stations, cumulative; « silent » and « unknown » statuses are excluded by the publisher.";

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
function exactAt(values, year) {
  if (!values || !values.length) return null;
  const hit = values.find((p) => p.year === year);
  return hit ? hit.value : null;
}
function mean(nums) {
  const a = nums.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
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
function anomalyBand(series, years) {
  return years
    .map((y) => {
      const vals = series
        .map((s) => exactAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      if (!vals.length) return null;
      return {
        year: y,
        mean: mean(vals),
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    })
    .filter(Boolean);
}
function totalLine(series, years, name) {
  const vals = years
    .map((y) => {
      const got = series
        .map((s) => valueAt(s.values, y))
        .filter((n) => Number.isFinite(n));
      return got.length
        ? { year: y, value: got.reduce((a, b) => a + b, 0) }
        : null;
    })
    .filter(Boolean);
  return vals.length ? [{ area: "REG", name, values: vals }] : [];
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

export default function Act8Ciel() {
  const { t, lang } = useLang();

  // Traduction avec repli littéral : `t()` renvoie le chemin quand la clé
  // manque. Les chaînes nouvelles vivent ici en attendant d'être versées
  // dans extraStrings — le tableau de bord ne doit jamais afficher un
  // chemin pointé.
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
  const [metric, setMetric] = useState("rain");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchCiel({ lang, signal: ctrl.signal }).then((res) => {
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
  const rain = data?.rain;
  const temp = data?.landTemp;
  const meteo = data?.meteo;

  const rainAll = useMemo(() => toSeries(rain, lang), [rain, lang]);
  const tempAll = useMemo(() => toSeries(temp, lang), [temp, lang]);
  const meteoAll = useMemo(() => toSeries(meteo, lang), [meteo, lang]);

  const countryOptions = useMemo(() => {
    const set = new Set([
      ...rainAll.map((s) => s.area),
      ...tempAll.map((s) => s.area),
      ...meteoAll.map((s) => s.area),
    ]);
    return [...set]
      .map((a) => ({ area: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name, lang));
  }, [rainAll, tempAll, meteoAll, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const rainS = useMemo(
    () => rainAll.filter((s) => areaVisible(s.area)),
    [rainAll, areaVisible],
  );
  const tempS = useMemo(
    () => tempAll.filter((s) => areaVisible(s.area)),
    [tempAll, areaVisible],
  );
  const meteoS = useMemo(
    () => meteoAll.filter((s) => areaVisible(s.area)),
    [meteoAll, areaVisible],
  );

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [rainA, rainB] = span(rain, 1979, 2025);
  const [tempA, tempB] = span(temp, 1850, 2025);
  const [meteoA, meteoB] = span(meteo, 1889, 2026);

  const rainYears = useMemo(() => rain?.years || [], [rain]);
  const tempYears = useMemo(() => temp?.years || [], [temp]);
  const meteoYears = useMemo(() => meteo?.years || [], [meteo]);

  const rainBand = useMemo(
    () => anomalyBand(rainS, rainYears),
    [rainS, rainYears],
  );
  const tempBand = useMemo(
    () => anomalyBand(tempS, tempYears),
    [tempS, tempYears],
  );
  const meteoLine = useMemo(
    () => totalLine(meteoS, meteoYears, t("act8.meteo_total_name")),
    [meteoS, meteoYears, t],
  );
  const meteoRace = useMemo(
    () => raceFrom(meteoS, meteoYears, lang),
    [meteoS, meteoYears, lang],
  );

  const rainRank = useMemo(() => buildRank(rainS, rainB), [rainS, rainB]);
  const tempRank = useMemo(() => buildRank(tempS, tempB), [tempS, tempB]);
  const meteoRank = useMemo(() => buildRank(meteoS, meteoB), [meteoS, meteoB]);

  const rainDumb = useMemo(
    () => buildDumbbell(rainS, rainA, rainB),
    [rainS, rainA, rainB],
  );
  const tempDumb = useMemo(
    () => buildDumbbell(tempS, tempA, tempB),
    [tempS, tempA, tempB],
  );
  const meteoDumb = useMemo(
    () => buildDumbbell(meteoS, meteoA, meteoB),
    [meteoS, meteoA, meteoB],
  );

  // Définition de la mesure active.
  const M = useMemo(() => {
    if (metric === "rain")
      return {
        kind: "anom",
        series: rainS,
        band: rainBand,
        rank: rainRank,
        dumb: rainDumb,
        years: rainYears,
        unit: t("act8.rain_unit"),
        A: rainA,
        B: rainB,
        tone: "accent",
        baseline: t("act8.rain_baseline"),
        below: t("act8.rain_hm_below"),
        above: t("act8.rain_hm_above"),
        key: {
          y: tx(
            "act8.key.rain_y",
            "Écart de cumul de pluie par rapport à la normale 1991-2020, en millimètres. Zéro = une année ordinaire.",
            "Rainfall gap against the 1991-2020 normal, in millimetres. Zero = an ordinary year.",
          ),
          x: tx("act8.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act8.key.anom_c",
            "Bleu : au-dessous de la normale. Ambre : au-dessus. Le gris central, c'est la normale elle-même.",
            "Blue: below the normal. Amber: above. The grey centre is the normal itself.",
          ),
          note: tx("act8.key.rain_note", SOURCE_RAIN_FR, SOURCE_RAIN_EN),
        },
        titles: {
          trend: t("act8.regional_rain_title"),
          multiples: t("act8.rain_title"),
          heat: t("act8.rain_hm_title"),
          change: t("act8.rain_cmp_title"),
        },
      };
    if (metric === "temp")
      return {
        kind: "anom",
        series: tempS,
        band: tempBand,
        rank: tempRank,
        dumb: tempDumb,
        years: tempYears,
        unit: t("act8.temp_unit"),
        A: tempA,
        B: tempB,
        tone: "warm",
        baseline: t("act8.temp_baseline"),
        below: t("act8.temp_hm_below"),
        above: t("act8.temp_hm_above"),
        key: {
          y: tx(
            "act8.key.temp_y",
            "Écart de température de l'air à 2 m par rapport à la normale 1971-2000, en degrés. Zéro = une année ordinaire.",
            "Air-temperature gap at 2 m against the 1971-2000 normal, in degrees. Zero = an ordinary year.",
          ),
          x: tx("act8.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act8.key.anom_c",
            "Bleu : au-dessous de la normale. Ambre : au-dessus. Le gris central, c'est la normale elle-même.",
            "Blue: below the normal. Amber: above. The grey centre is the normal itself.",
          ),
          note: tx("act8.key.temp_note", SOURCE_TEMP_FR, SOURCE_TEMP_EN),
        },
        titles: {
          trend: t("act8.regional_temp_title"),
          multiples: t("act8.temp_title"),
          heat: t("act8.temp_hm_title"),
          change: t("act8.temp_cmp_title"),
        },
      };
    return {
      kind: "count",
      series: meteoS,
      line: meteoLine,
      race: meteoRace,
      rank: meteoRank,
      dumb: meteoDumb,
      years: meteoYears,
      unit: t("act8.meteo_unit"),
      A: meteoA,
      B: meteoB,
      key: {
        y: tx(
          "act8.key.meteo_y",
          "Nombre de stations météo en service, en cumul. Ce n'est pas un écart : zéro veut dire aucune station.",
          "Number of weather stations in service, cumulative. This is not a gap: zero means no station.",
        ),
        x: tx("act8.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act8.key.count_c",
          "Une seule teinte : plus elle est marquée, plus le réseau est dense. Aucun jugement de valeur, seulement une grandeur.",
          "A single hue: the stronger it is, the denser the network. No value judgement, only a magnitude.",
        ),
        note: tx("act8.key.meteo_note", SOURCE_METEO_FR, SOURCE_METEO_EN),
        // Un nombre de stations n'a pas de zéro chargé de sens : c'est une
        // grandeur, pas une polarité. La pastille de la colonne et la
        // rampe de la carte suivent cette déclaration.
        swatch: "magnitude",
      },
      titles: {
        trend: t("act8.regional_meteo_title"),
        multiples: t("act8.meteo_title"),
        heat: t("act8.meteo_hm_title"),
        change: t("act8.meteo_cmp_title"),
        rank: t("act8.meteo_rank_title"),
      },
    };
  }, [
    tx,
    metric,
    rainS,
    rainBand,
    rainRank,
    rainDumb,
    rainYears,
    rainA,
    rainB,
    tempS,
    tempBand,
    tempRank,
    tempDumb,
    tempYears,
    tempA,
    tempB,
    meteoS,
    meteoLine,
    meteoRace,
    meteoRank,
    meteoDumb,
    meteoYears,
    meteoA,
    meteoB,
    t,
  ]);

  // Décimales par mesure : mm en entiers, °C à 2 décimales, stations en entiers.
  const metricDecimals = metric === "temp" ? 2 : 0;

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    if (!xs.length) return { min: 0, max: 1 };
    if (M.kind === "anom") {
      const m = Math.max(...xs.map((v) => Math.abs(v)));
      return { min: -m, max: m };
    }
    return { min: 0, max: Math.max(...xs) };
  }, [M.series, M.kind]);

  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchCiel({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  // Jeux de données pour le sélecteur en cartes (icône + unité + sparkline).
  // Spark : moyenne régionale annuelle (anomalies) ou total réseau par an.
  const measureItems = [
    {
      id: "rain",
      label: t("act8.board.metric_rain"),
      unit: t("act8.rain_unit"),
      icon: "rain",
      tone: "accent",
      spark: rainBand.map((d) => d.mean),
    },
    {
      id: "temp",
      label: t("act8.board.metric_temp"),
      unit: t("act8.temp_unit"),
      icon: "temp",
      tone: "warm",
      spark: tempBand.map((d) => d.mean),
    },
    {
      id: "meteo",
      label: t("act8.board.metric_meteo"),
      unit: t("act8.meteo_unit"),
      icon: "network",
      tone: "positive",
      spark: meteoLine[0] ? meteoLine[0].values.map((v) => v.value) : [],
    },
  ];
  // Régions en cartes : sparkline = agrégat régional de la mesure active
  // (moyenne des anomalies, ou total réseau par an) → la couleur suit le jeu.
  const metricAll =
    metric === "rain" ? rainAll : metric === "temp" ? tempAll : meteoAll;
  const regionSpark = (subset) =>
    M.kind === "count"
      ? ((totalLine(subset, M.years, "")[0] || {}).values || []).map(
          (v) => v.value,
        )
      : anomalyBand(subset, M.years).map((d) => d.mean);
  const regionItems = REGION_KEYS.map((k) => {
    const subset =
      k === "all"
        ? metricAll
        : metricAll.filter((s) => REGION_OF[s.area] === k);
    return {
      id: k,
      label: t(`act1.filter.${k}`),
      unit: String(subset.length),
      icon: k === "all" ? "globe" : "map",
      tone: M.tone || "positive",
      spark: regionSpark(subset),
    };
  });

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
  // La vue du visuel en est exemptée : le dessin a son propre sélecteur de
  // territoire et ignore ces filtres.
  const boardControls = (
    <>
      <ChartFilter
        label={t("act8.board.group_measure")}
        hideLabel
        value={metric}
        onChange={setMetric}
        options={asOptions(measureItems)}
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

  // Carte d'identité TRIPLE (pluie + température + réseau) — 100 % i18n / fiches officielles.
  const spotlightRows = [
    { k: t("act8.spotlight.r1k"), v: t("act8.spotlight.r1v") },
    { k: t("act8.spotlight.r2k"), v: t("act8.spotlight.r2v") },
    { k: t("act8.spotlight.r3k"), v: t("act8.spotlight.r3v") },
    { k: t("act8.spotlight.r4k"), v: t("act8.spotlight.r4v") },
    { k: t("act8.spotlight.r5k"), v: t("act8.spotlight.r5v") },
    { k: t("act8.spotlight.r6k"), v: t("act8.spotlight.r6v") },
  ];
  const spotlightNotes = [
    t("act8.spotlight.n1"),
    t("act8.spotlight.n2"),
    t("act8.spotlight.n3"),
    t("act8.spotlight.n4"),
    t("act8.spotlight.n5"),
  ];

  const readChart = {
    id: "read",
    empty: false,
    tab: t("act8.board.tab_read"),
    title: t("act8.read_title"),
    finding: t("act8.board.read_find"),
    takeaway: t("act8.board.read_take"),
    node: (
      <DataSpotlight
        rows={spotlightRows}
        notes={spotlightNotes}
        example={{
          kicker: t("act8.spotlight.ex_kicker"),
          text: t("act8.spotlight.ex_text"),
        }}
        link={{
          href: "https://www.ncei.noaa.gov/products/climate-data-records/precipitation-gpcp-monthly",
          label: t("act8.spotlight.link_label"),
        }}
      />
    ),
  };

  const coverageChart = {
    id: "coverage",
    empty: M.series.length === 0,
    tab: t("act8.board.tab_coverage"),
    title: t("act8.coverage_title"),
    finding: t("act8.board.coverage_find"),
    takeaway: t("act8.board.coverage_take"),
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
  };

  // Onglet « tendance » : bande d'anomalie (pluie/temp) ou total réseau (météo).
  const trendChart =
    M.kind === "anom"
      ? {
          id: "trend",
          signature: true,
          empty: !M.band.length,
          tab: t("act8.board.tab_trend"),
          title: M.titles.trend,
          finding: t("act8.board.trend_find"),
          takeaway: t("act8.board.trend_take"),
          legend: M.key,
          hint: tx(
            "act8.hint.trend",
            "Survolez la courbe pour lire une année précise, et changez de mesure en haut de l'écran.",
            "Hover the line to read a single year, and switch measure at the top of the screen.",
          ),
          controls: boardControls,
          node: (
            <div className="act8b__fit">
              <AnomalyTrend
                data={M.band}
                currentYear={M.B}
                unit={M.unit}
                tone={M.tone}
                baselineLabel={M.baseline}
                meanLabel={t("act8.mean_label")}
              />
            </div>
          ),
        }
      : {
          id: "trend",
          signature: true,
          empty: !M.line.length,
          tab: t("act8.board.tab_trend"),
          title: M.titles.trend,
          finding: t("act8.board.trend_find"),
          takeaway: t("act8.board.trend_take"),
          legend: M.key,
          hint: tx(
            "act8.hint.trend_count",
            "Survolez une courbe pour suivre un territoire année par année.",
            "Hover a line to follow one territory year by year.",
          ),
          controls: boardControls,
          node: (
            <div className="act8b__fit">
              <TrendLines
                series={M.line}
                years={M.years}
                currentYear={M.B}
                unit={M.unit}
              />
            </div>
          ),
        };

  // Onglet variable : haltères (anomalies) ou course animée (météo).
  const changeChart =
    M.kind === "anom"
      ? {
          id: "change",
          empty: M.dumb.length === 0,
          tab: tx("act8.board.tab_evolution", "Évolution", "Change"),
          title: `${M.titles.change} · ${M.A}–${M.B}`,
          finding: t("act8.board.change_find"),
          takeaway: t("act8.board.change_take"),
          legend: {
            ...M.key,
            y: tx("act8.key.terr_y", "Un territoire par ligne.", "One territory per row."),
            x: M.key.y,
            color: tx(
              "act8.key.dumb_c",
              "Le point clair marque la première année, le point foncé la dernière : la barre entre les deux est le chemin parcouru.",
              "The light dot marks the first year, the dark dot the last: the bar between them is the distance travelled.",
            ),
          },
          hint: tx(
            "act8.hint.change",
            "Comparez la longueur des barres : elle dit l'ampleur du changement, pas le niveau atteint.",
            "Compare bar lengths: they show how much changed, not the level reached.",
          ),
          controls: boardControls,
          node: (
            <div className="act8b__scroll">
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
        }
      : {
          id: "race",
          empty: M.race.length < 2,
          tab: t("act8.board.tab_race"),
          title: M.titles.rank,
          finding: t("act8.board.race_find"),
          takeaway: t("act8.board.race_take"),
          legend: {
            ...M.key,
            y: tx("act8.key.terr_y", "Un territoire par ligne.", "One territory per row."),
            x: M.key.y,
          },
          hint: tx(
            "act8.hint.race",
            "Lancez l'animation : les barres se réordonnent au fil des années.",
            "Press play: the bars reorder themselves year after year.",
          ),
          controls: boardControls,
          node: (
            <BarRace
              series={M.race}
              years={M.years}
              unit={M.unit}
              decimals={0}
              tk={tk}
              labels={{
                play: t("act1.race.play"),
                pause: t("act1.race.pause"),
                restart: t("act1.race.restart"),
              }}
            />
          ),
        };

  // ---------- LES CHIFFRES À EMPORTER ----------
  // Trois nombres tirés du bundle de la mesure courante : ils changent avec le
  // sélecteur, comme le reste de l'escale. Le lecteur qui ne lit rien d'autre
  // repart au moins avec un ordre de grandeur et la période sur laquelle il
  // vaut. Voir components/KeyFigures/fromBundle.js.
  const figures = useMemo(
    () =>
      figuresFromBundle(M, {
        median: tx("act8.fig.median", "Médiane du Pacifique", "Pacific median"),
        edge: tx("act8.fig.edge", "La valeur extrême", "The extreme value"),
        span: tx("act8.fig.span", "Période couverte", "Period covered"),
        years: tx("act8.fig.years", "années", "years"),
      }),
    [M, tx],
  );

  const charts =
    status === "ready"
      ? [
          // ---------- Le visuel interactif, en ouverture -------------------
          // `SkyRain` — l'averse de la Home, en SVG et entièrement
          // interactive (sélecteur de territoire, gouttes, sol qui se
          // craquelle). C'est le seul visuel de la Home qui porte
          // l'indicateur de cette escale : l'écart de pluie. Il reste monté
          // sur la page d'accueil ; on l'ajoute ici, on ne le déplace pas.
          //
          // Il ouvre l'escale parce qu'un écart en millimètres ne veut rien
          // dire tant qu'on ne l'a pas vu tomber : le visuel donne la mesure
          // d'abord, les courbes la mettent en série ensuite.
          {
            id: "sky",
            empty: false,
            tab: tx("act8.board.tab_averse", "Averse", "Downpour"),
            title: tx(
              "act8.viz.sky_title",
              "Une année de pluie, territoire par territoire",
              "One year of rain, territory by territory",
            ),
            finding: tx(
              "act8.viz.sky_find",
              "Choisissez un territoire : l'averse suit son écart à la normale.",
              "Pick a territory: the downpour follows its gap from the normal.",
            ),
            takeaway: tx(
              "act8.viz.sky_take",
              "Un écart de pluie ne se ressent pas en millimètres. Ici il se voit : moins d'eau, un sol qui se fend ; plus d'eau, une averse qui s'épaissit.",
              "A rainfall gap is not felt in millimetres. Here you can see it: less water and the ground cracks; more water and the downpour thickens.",
            ),
            hint: tx(
              "act8.hint.sky",
              "Changez de territoire avec le sélecteur sous le visuel.",
              "Switch territory with the selector below the visual.",
            ),
            legend: {
              color: tx(
                "act8.key.sky_c",
                "L'averse s'épaissit quand l'année dépasse sa normale de pluie, et se clairsème quand elle passe dessous.",
                "The downpour thickens when the year is above its rainfall normal, and thins when it falls below.",
              ),
              note: tx("act8.key.rain_note", SOURCE_RAIN_FR, SOURCE_RAIN_EN),
              // Le dessin encode par une DENSITÉ de gouttes, pas par une
              // teinte : pas d'échelle de couleur à annoncer.
              swatch: "none",
            },
            node: <SkyRain embed />,
          },
          trendChart,
          readChart,
          {
            id: "multiples",
            empty: M.series.length === 0,
            tab: tx("act8.board.tab_multiples_1", "Multiples", "Multiples"),
            title: M.titles.multiples,
            finding: t("act8.board.multiples_find"),
            takeaway: t("act8.board.multiples_take"),
            legend: M.key,
            hint: tx(
              "act8.hint.multiples",
              "Chaque vignette a la même échelle : on peut les comparer entre elles du regard.",
              "Every panel shares one scale: you can compare them at a glance.",
            ),
            controls: boardControls,
            node: (
              <div className="act8b__scroll">
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
            id: "heat",
            empty: M.series.length === 0,
            tab: tx("act8.board.tab_matrice", "Matrice", "Matrix"),
            title: M.titles.heat,
            finding: t("act8.board.heat_find"),
            takeaway: t("act8.board.heat_take"),
            legend: {
              y: tx("act8.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: M.key.x,
              color: M.key.color,
              note: M.key.note,
              swatch: M.key.swatch,
            },
            hint: tx(
              "act8.hint.heat",
              "Balayez une ligne de gauche à droite : une année isolée oscille, une bande continue s'installe.",
              "Read a row left to right: a lone year wobbles, an unbroken band has settled in.",
            ),
            controls: boardControls,
            node: (
              <div className="act8b__scroll">
                <ApexYearHeatmap
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  scale={M.kind === "anom" ? "diverging" : "sequential"}
                  decimals={metricDecimals}
                  labels={{
                    below: M.below,
                    above: M.above,
                    mid: t("act8.board.map_mid"),
                    low: t("act6.heatmap_low"),
                    high: t("act6.heatmap_high"),
                  }}
                />
              </div>
            ),
          },
          changeChart,
          // La carte ferme la navigation, comme sur les escales 01 et 02 :
          // elle situe, elle ne démontre pas. (`coverageChart`, qui la suit
          // dans ce tableau, est renvoyé dans la fiche ⓘ par ActBoard.)
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: tx("act8.board.tab_carte", "Carte", "Map"),
            title: `${t("act8.board.map_title")} · ${M.B}`,
            finding: t("act8.board.map_find"),
            takeaway: t("act8.board.map_take"),
            legend: {
              color: M.key.color,
              note: M.key.note,
              swatch: M.key.swatch,
            },
            hint: tx(
              "act8.hint.map",
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
                    // La rampe suit la NATURE de la mesure, pas la page :
                    // divergente autour de la normale pour un écart de pluie
                    // ou de température, séquentielle pour un comptage de
                    // stations. Auparavant la carte peignait un dégradé à
                    // deux pôles sur un simple décompte — deux pôles pour
                    // une grandeur qui n'en a qu'un.
                    ramp={M.kind === "anom" ? "polarity" : "magnitude"}
                    mid={M.kind === "anom" ? 0 : null}
                    range={mapRange}
                    lowLabel={t("act6.heatmap_low")}
                    midLabel={
                      M.kind === "anom" ? t("act8.board.map_mid") : undefined
                    }
                    highLabel={t("act6.heatmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          coverageChart,
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act8.tag")}
      // UNE SEULE SOURCE POUR LE TITRE DE L'ESCALE.
      // Cette page lisait `act8.title`, pendant que les flèches
      // « escale précédente / suivante » des voisines annoncent, elles,
      // `home.acts.a8_title`. Deux clés pour un seul titre : le voisin
      // pouvait annoncer autre chose que ce qu'on trouvait en arrivant.
      title={t("home.acts.a8_title")}
      figures={figures}
      thesis={t("act8.thesis")}
      // L'en-tête ne porte plus de filtres : chaque graphique a les siens.
      filters={null}
      charts={charts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      initialTab="sky"
      progress={{ index: 3, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act8.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act8.board.switch_hint"),
        signature: t("act8.board.signature"),
        takeawayKicker: t("act8.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act8.board.start"),
        conclusion: t("act8.board.conclusion"),
        backIntro: t("act8.board.back_intro"),
        reviseData: t("act8.board.revise_data"),
      }}
      outro={{
        kicker: t("act8.outro.kicker"),
        title: t("act8.outro.title"),
        text: t("act8.outro.text"),
        primary: { to: "/cyclones", label: t("act8.outro.next") },
        secondary: { to: "/", label: t("act8.outro.home") },
      }}
    />
  );
}
