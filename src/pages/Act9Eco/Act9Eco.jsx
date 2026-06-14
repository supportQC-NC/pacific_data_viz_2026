// src/pages/Act9Eco/Act9Eco.jsx
// ============================================================
// Acte 09 — L'économie : tourisme et fiscalité environnementale.
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (mesure + sous-région +
// territoire). Onglets variés : tendance (signature), petits multiples,
// course animée, évolution (haltères), chaleur, RADAR par décennie
// (profil régional) et carte 3D. Deck/guides/tableau retirés.
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
import { fetchEco } from "../../services/ecoApi";
import ActBoard from "../../components/ActBoard/ActBoard";
import DatasetSwitcher from "../../components/DatasetSwitcher/DatasetSwitcher";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import ApexChart from "../../components/ApexChart/ApexChart";
import { baseChart, baseGrid, MONO } from "../../components/charts/apexBase";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import RadarChart from "../../components/charts/RadarChart";
import BarRace from "../../components/BarRace/BarRace";
import StackedColsChart from "../../components/charts/StackedColsChart";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
import TreemapChart from "../../components/charts/TreemapChart";
import ParetoChart from "../../components/charts/ParetoChart";
import DonutChart from "../../components/charts/DonutChart";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act9Eco.scss";

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

const fmtVal = (v) =>
  !Number.isFinite(v)
    ? "—"
    : Math.abs(v) < 10
      ? String(Math.round(v * 100) / 100).replace(".", ",")
      : String(Math.round(v));

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
function buildRankMax(series) {
  return series
    .map((s) => {
      const vals = s.values
        .map((p) => p.value)
        .filter((n) => Number.isFinite(n));
      return {
        area: s.area,
        name: s.name,
        value: vals.length ? Math.max(...vals) : null,
      };
    })
    .filter((r) => Number.isFinite(r.value) && r.value > 0);
}
function buildDumbbell(series, yearA, yearB) {
  return series
    .map((s) => {
      const vals = (s.values || []).filter((p) => Number.isFinite(p.value));
      if (vals.length < 2) return null;
      const av = valueAt(vals, yearA);
      const bv = valueAt(vals, yearB);
      return {
        area: s.area,
        name: s.name,
        // Repli : si le territoire n'a pas de donnée dès yearA (séries qui
        // démarrent plus tard), on prend sa PREMIÈRE valeur connue ; idem
        // dernière. Ainsi aucun territoire avec ≥ 2 points n'est éliminé.
        a: Number.isFinite(av) ? av : vals[0].value,
        b: Number.isFinite(bv) ? bv : vals[vals.length - 1].value,
      };
    })
    .filter((r) => r && Number.isFinite(r.a) && Number.isFinite(r.b));
}

// Ventilation régionale par catégorie → séries empilées {name,color,data[]} alignées sur `years`.
// `breakdown.byCat` = { id: { byArea, years } }. On somme sur les territoires visibles.
function breakdownStack(breakdown, years, order, labels, colors, areaVisible) {
  if (!breakdown || !breakdown.byCat) return [];
  return (
    order
      .filter((id) => breakdown.byCat[id])
      .map((id) => {
        const cat = breakdown.byCat[id];
        const data = years.map((y) => {
          let sum = 0;
          let n = 0;
          (cat.areas || []).forEach((area) => {
            if (!areaVisible(area)) return;
            const v = valueAt(cat.byArea[area] || [], y);
            if (Number.isFinite(v) && v > 0) {
              sum += v;
              n += 1;
            }
          });
          // Moyenne des déclarants : reste à l'échelle réelle (% du PIB / arrivées),
          // et ne gonfle pas avec le nombre de pays visibles.
          return n > 0 ? sum / n : null;
        });
        return { id, name: labels[id] || id, color: colors[id], data };
      })
      // On garde toute catégorie présente dans le jeu (même rare), pour une
      // légende complète ; on retire seulement celles totalement vides.
      .filter((s) => s.data.some((v) => Number.isFinite(v)))
  );
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
// Moyenne par sous-région et par année → groupes pour le radar (par décennie).
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

export default function Act9Eco() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [metric, setMetric] = useState("tour");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchEco({ lang, signal: ctrl.signal }).then((res) => {
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
  const tour = data?.tourism;
  const tax = data?.envTax;

  const tourAll = useMemo(() => toSeries(tour, lang), [tour, lang]);
  const taxAll = useMemo(() => toSeries(tax, lang), [tax, lang]);

  const areaVisible = useCallback(
    (a) =>
      country !== "all"
        ? a === country
        : region === "all" || REGION_OF[a] === region,
    [region, country],
  );

  const tourS = useMemo(
    () => tourAll.filter((s) => areaVisible(s.area)),
    [tourAll, areaVisible],
  );
  const taxS = useMemo(
    () => taxAll.filter((s) => areaVisible(s.area)),
    [taxAll, areaVisible],
  );

  const span = (ind, fb0, fb1) => [
    ind?.firstYear ?? ind?.years?.[0] ?? fb0,
    ind?.lastYear ?? ind?.years?.[ind?.years?.length - 1] ?? fb1,
  ];
  const [tourA, tourB] = span(tour, 1995, 2024);
  const [taxA, taxB] = span(tax, 1995, 2021);

  const tourYears = useMemo(() => tour?.years || [], [tour]);
  const taxYears = useMemo(() => tax?.years || [], [tax]);

  // --- Ventilations (désagrégation) ---
  // Fiscalité : composition par type de taxe (énergie/transport/pollution/ressources).
  const taxCatOrder = ["energy", "transport", "pollution", "resource"];
  const taxCatLabels = {
    energy: t("act9.tax_cat_energy"),
    transport: t("act9.tax_cat_transport"),
    pollution: t("act9.tax_cat_pollution"),
    resource: t("act9.tax_cat_resource"),
  };
  const taxCatColors = {
    energy: tk.warm,
    transport: tk.accent,
    pollution: tk.negative,
    resource: tk.positive,
  };
  const taxStack = useMemo(
    () =>
      breakdownStack(
        tax?.breakdown,
        taxYears,
        taxCatOrder,
        taxCatLabels,
        taxCatColors,
        areaVisible,
      ),
    [tax, taxYears, taxCatLabels, taxCatColors, areaVisible],
  );

  // Tourisme : touristes (nuitées) vs excursionnistes (journée).
  const tourCatOrder = ["tourist", "excursionist"];
  const tourCatLabels = {
    tourist: t("act9.tour_cat_tourist"),
    excursionist: t("act9.tour_cat_excursionist"),
  };
  const tourCatColors = { tourist: tk.accent, excursionist: tk.warm };
  const tourStack = useMemo(
    () =>
      breakdownStack(
        tour?.breakdown,
        tourYears,
        tourCatOrder,
        tourCatLabels,
        tourCatColors,
        areaVisible,
      ),
    [tour, tourYears, tourCatLabels, tourCatColors, areaVisible],
  );

  // Tourisme — qui capte les visiteurs (treemap) à la dernière année connue de chaque territoire.
  const tourTree = useMemo(() => {
    const palette = [
      tk.accent,
      tk.warm,
      tk.positive,
      tk.negative,
      tk.accentDeep,
      tk.secondary,
    ];
    return tourS
      .map((s, i) => {
        const last = s.values[s.values.length - 1];
        return last
          ? {
              label: s.name,
              value: last.value,
              color: palette[i % palette.length],
            }
          : null;
      })
      .filter(Boolean)
      .sort((x, y) => y.value - x.value);
  }, [tourS, tk]);

  // Tourisme — concentration (pareto) sur la même base.
  const tourPareto = useMemo(
    () => tourTree.map((p) => ({ name: p.label, value: p.value })),
    [tourTree],
  );

  // Fiscalité — composition moyenne par type de taxe (donut) : moyenne sur les
  // déclarants visibles, toutes années confondues, de chaque type.
  const taxDonut = useMemo(() => {
    const order = ["energy", "transport", "pollution", "resource"];
    const labels = [];
    const values = [];
    const colors = [];
    order.forEach((id) => {
      const cat = tax?.breakdown?.byCat?.[id];
      if (!cat) return;
      let sum = 0;
      let n = 0;
      (cat.areas || []).forEach((area) => {
        if (!areaVisible(area)) return;
        (cat.byArea[area] || []).forEach((p) => {
          if (Number.isFinite(p.value) && p.value > 0) {
            sum += p.value;
            n += 1;
          }
        });
      });
      if (n > 0) {
        labels.push(taxCatLabels[id]);
        values.push(Math.round((sum / n) * 100) / 100);
        colors.push(taxCatColors[id]);
      }
    });
    return { labels, values, colors };
  }, [tax, taxCatLabels, taxCatColors, areaVisible]);

  const tourLine = useMemo(
    () => totalLine(tourS, tourYears, t("act9.tour_total_name")),
    [tourS, tourYears, t],
  );
  const taxLine = useMemo(
    () => medianLine(taxS, taxYears, t("act9.tax_median_name")),
    [taxS, taxYears, t],
  );

  const tourRank = useMemo(() => buildRank(tourS, tourB), [tourS, tourB]);
  const taxRank = useMemo(() => buildRankMax(taxS), [taxS]);

  const tourDumb = useMemo(
    () => buildDumbbell(tourS, tourA, tourB),
    [tourS, tourA, tourB],
  );
  const taxDumb = useMemo(
    () => buildDumbbell(taxS, taxA, taxB),
    [taxS, taxA, taxB],
  );

  const tourRace = useMemo(
    () => raceFrom(tourS, tourYears, lang),
    [tourS, tourYears, lang],
  );
  const taxRace = useMemo(
    () => raceFrom(taxS, taxYears, lang),
    [taxS, taxYears, lang],
  );

  // Profil radar par sous-région (toujours sur l'ensemble — vue régionale).
  const tourSub = useMemo(
    () => subAverages(tourAll, tourYears, t),
    [tourAll, tourYears, t],
  );
  const taxSub = useMemo(
    () => subAverages(taxAll, taxYears, t),
    [taxAll, taxYears, t],
  );

  const M = useMemo(() => {
    if (metric === "tour")
      return {
        series: tourS,
        line: tourLine,
        rank: tourRank,
        dumb: tourDumb,
        race: tourRace,
        sub: tourSub,
        years: tourYears,
        unit: t("act9.tour_unit"),
        A: tourA,
        B: tourB,
        titles: {
          trend: t("act9.regional_tour_title"),
          multiples: t("act9.tour_title"),
          heat: t("act9.tour_hm_title"),
          change: t("act9.tour_cmp_title"),
          rank: t("act9.tour_rank_title"),
          compo: t("act9.tour_compo_title"),
        },
        stack: tourStack,
        compoFind: t("act9.board.tour_compo_find"),
        compoTake: t("act9.board.tour_compo_take"),
      };
    return {
      series: taxS,
      line: taxLine,
      rank: taxRank,
      dumb: taxDumb,
      race: taxRace,
      sub: taxSub,
      years: taxYears,
      unit: t("act9.tax_unit"),
      A: taxA,
      B: taxB,
      titles: {
        trend: t("act9.regional_tax_title"),
        multiples: t("act9.tax_title"),
        heat: t("act9.tax_hm_title"),
        change: t("act9.tax_cmp_title"),
        rank: t("act9.tax_rank_title"),
        compo: t("act9.tax_compo_title"),
      },
      stack: taxStack,
      compoFind: t("act9.board.tax_compo_find"),
      compoTake: t("act9.board.tax_compo_take"),
    };
  }, [
    metric,
    tourS,
    tourLine,
    tourRank,
    tourDumb,
    tourRace,
    tourSub,
    tourYears,
    tourA,
    tourB,
    tourStack,
    taxStack,
    taxS,
    taxLine,
    taxRank,
    taxDumb,
    taxRace,
    taxSub,
    taxYears,
    taxA,
    taxB,
    t,
  ]);

  const mapRange = useMemo(() => {
    const xs = M.series
      .flatMap((s) => s.values.map((p) => p.value))
      .filter(Number.isFinite);
    return xs.length ? { min: 0, max: Math.max(...xs) } : { min: 0, max: 1 };
  }, [M.series]);

  // Carte de chaleur ApexCharts : territoires (lignes, triés par dernier
  // niveau) × années (colonnes). Labels lisibles (clair sur fond sombre).
  const heatOptions = useMemo(() => {
    const years = M.years;
    const rows = [...M.series].sort(
      (a, b) => (valueAt(b.values, M.B) || 0) - (valueAt(a.values, M.B) || 0),
    );
    const NODATA = -1; // sentinelle « pas de donnée » → case grise
    const series = rows
      .map((s) => ({
        name: s.name,
        data: years.map((y) => {
          const v = valueAt(s.values, y);
          return { x: String(y), y: v == null ? NODATA : v };
        }),
      }))
      .reverse(); // série 0 en bas → territoire le plus fréquenté en haut
    // Palette SOBRE (camaïeu chaud) par QUANTILES : paliers équilibrés malgré la
    // forte asymétrie (Fidji ≫ Niue). Sombre → clair = faible → forte affluence.
    // Le GRIS isole les années sans donnée (plus parlant qu'une case vide).
    const HEAT = ["#4a4640", "#6e5e4d", "#94774f", "#bd8a4e", "#d9a55a"];
    const GREY = "#39424d";
    const all = series
      .flatMap((s) => s.data.map((d) => d.y))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    const nodataLabel = t("act9.board.heat_nodata");
    const ranges = [{ from: -1.5, to: -0.5, color: GREY, name: nodataLabel }];
    if (all.length >= 5) {
      const q = (p) =>
        all[Math.min(all.length - 1, Math.floor(p * all.length))];
      const edges = [
        0,
        q(0.2),
        q(0.4),
        q(0.6),
        q(0.8),
        all[all.length - 1] + 1,
      ];
      for (let i = 1; i < edges.length; i += 1) {
        if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1e-6;
      }
      HEAT.forEach((c, i) => {
        const lo = edges[i];
        const hi = edges[i + 1];
        let name;
        if (i === 0) name = `< ${fmtVal(edges[1])}`;
        else if (i === HEAT.length - 1) name = `≥ ${fmtVal(lo)}`;
        else name = `${fmtVal(lo)} – ${fmtVal(hi)}`;
        ranges.push({ from: lo, to: hi, color: c, name });
      });
    } else if (all.length) {
      ranges.push({
        from: 0,
        to: all[all.length - 1] + 1,
        color: HEAT[2],
        name: M.unit,
      });
    }
    return {
      chart: baseChart(tk, { type: "heatmap" }),
      series,
      dataLabels: { enabled: false },
      plotOptions: {
        heatmap: { radius: 2, enableShades: false, colorScale: { ranges } },
      },
      stroke: { width: 1, colors: [tk.line] },
      legend: {
        show: true,
        position: "bottom",
        horizontalAlign: "center",
        fontFamily: MONO,
        fontSize: "10px",
        labels: { colors: tk.textMute },
        markers: { width: 11, height: 11, radius: 2 },
        itemMargin: { horizontal: 7, vertical: 3 },
      },
      grid: baseGrid(tk),
      xaxis: {
        type: "category",
        labels: {
          rotate: -45,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "9px" },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          show: true,
          maxWidth: 150,
          style: { colors: tk.text, fontFamily: MONO, fontSize: "11px" },
        },
      },
      tooltip: {
        y: {
          formatter: (v) =>
            v == null || v < 0 ? nodataLabel : `${fmtVal(v)} ${M.unit}`,
        },
      },
    };
  }, [M.series, M.years, M.B, M.unit, tk, t]);

  const kpiItems = useMemo(() => {
    if (!M.rank.length) return [];
    const sorted = [...M.rank].sort((a, b) => a.value - b.value);
    const high = sorted[sorted.length - 1];
    const low = sorted[0];
    const med = median(M.rank.map((r) => r.value));
    return [
      {
        key: "med",
        value: fmtVal(med),
        unit: M.unit,
        label: t("act9.board.kpi_med"),
        tone: "accent",
      },
      {
        key: "high",
        value: fmtVal(high.value),
        unit: high.name,
        label: t("act9.board.kpi_high"),
        tone: "positive",
      },
      {
        key: "low",
        value: fmtVal(low.value),
        unit: low.name,
        label: t("act9.board.kpi_low"),
        tone: "warm",
      },
    ];
  }, [M.rank, M.unit, t]);

  const cmpLabels = { up: t("act6.compare_up"), down: t("act6.compare_down") };

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchEco({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  // Deux JEUX DE DONNÉES traités à égalité, basculés par icônes.
  const metricItems = [
    {
      id: "tour",
      label: t("act9.board.metric_tour"),
      icon: "plane",
      tone: "accent",
    },
    {
      id: "tax",
      label: t("act9.board.metric_tax"),
      icon: "money",
      tone: "positive",
    },
  ];
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));

  // Une fois le jeu de données chargé, on reste « ready » : un filtre qui ne
  // renvoie aucune série n'affiche PLUS le loader plein écran (bug), mais
  // l'état « vide » propre à chaque onglet.
  const status =
    state.status === "ready"
      ? "ready"
      : state.status === "loading"
        ? "loading"
        : "empty";

  const filtersEl = (
    <>
      <DatasetSwitcher
        label={t("act9.board.metric_label")}
        items={metricItems}
        value={metric}
        onChange={setMetric}
        iconOnly
        hideSpark
      />
      <DatasetSwitcher
        label={t("act1.filter.title")}
        items={regionItems}
        value={region}
        onChange={(k) => {
          setRegion(k);
          setCountry("all");
        }}
        dense
        hideSpark
      />
    </>
  );

  // Carte d'identité DOUBLE (tourisme + fiscalité) — 100 % i18n / fiches officielles.
  const spotlightRows = [
    { k: t("act9.spotlight.r1k"), v: t("act9.spotlight.r1v") },
    { k: t("act9.spotlight.r2k"), v: t("act9.spotlight.r2v") },
    { k: t("act9.spotlight.r3k"), v: t("act9.spotlight.r3v") },
    { k: t("act9.spotlight.r4k"), v: t("act9.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act9.spotlight.n1"),
    t("act9.spotlight.n2"),
    t("act9.spotlight.n3"),
    t("act9.spotlight.n4"),
    t("act9.spotlight.n5"),
  ];

  const charts =
    status === "ready"
      ? [
          {
            id: "trend",
            signature: true,
            empty: !M.line.length,
            tab: t("act9.board.tab_trend"),
            title: M.titles.trend,
            finding: t("act9.board.trend_find"),
            takeaway: t("act9.board.trend_take"),
            node: (
              <div className="act9b__fit">
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
            id: "multiples",
            empty: M.series.length === 0,
            tab: t("act9.board.tab_multiples"),
            title: M.titles.multiples,
            finding: t("act9.board.multiples_find"),
            takeaway: t("act9.board.multiples_take"),
            node: (
              <div className="act9b__scroll">
                <SmallMultiples
                  series={M.series}
                  years={M.years}
                  unit={M.unit}
                  currentYear={M.B}
                  labels={{
                    last: t("act6.smallmult_last"),
                    close: t("act9.board.zoom_close"),
                  }}
                />
              </div>
            ),
          },
          {
            id: "compo",
            empty: !M.stack || M.stack.length === 0,
            tab: t("act9.board.tab_compo"),
            title: M.titles.compo,
            finding: M.compoFind,
            takeaway: M.compoTake,
            node: (
              <div className="act9b__fit">
                <StackedColsChart
                  series={M.stack}
                  years={M.years}
                  unit={M.unit}
                />
              </div>
            ),
          },
          metric === "tour" && {
            id: "tree",
            empty: tourTree.length === 0,
            tab: t("act9.board.tab_tree"),
            title: t("act9.tour_tree_title"),
            finding: t("act9.board.tree_find"),
            takeaway: t("act9.board.tree_take"),
            node: (
              <div className="act9b__fit">
                <TreemapChart points={tourTree} unit={t("act9.tour_unit")} />
              </div>
            ),
          },
          metric === "tour" && {
            id: "pareto",
            empty: tourPareto.length < 2,
            tab: t("act9.board.tab_pareto"),
            title: t("act9.tour_pareto_title"),
            finding: t("act9.board.pareto_find"),
            takeaway: t("act9.board.pareto_take"),
            node: (
              <div className="act9b__fit">
                <ParetoChart
                  rows={tourPareto}
                  unit={t("act9.tour_unit")}
                  cumulLabel={t("act9.board.pareto_cumul")}
                />
              </div>
            ),
          },
          metric === "tax" && {
            id: "donut",
            empty: taxDonut.values.length === 0,
            tab: t("act9.board.tab_donut"),
            title: t("act9.tax_donut_title"),
            finding: t("act9.board.donut_find"),
            takeaway: t("act9.board.donut_take"),
            node: (
              <div className="act9b__fit">
                <DonutChart
                  labels={taxDonut.labels}
                  series={taxDonut.values}
                  colors={taxDonut.colors}
                  unit={t("act9.tax_unit")}
                  centerLabel={t("act9.tax_donut_center")}
                />
              </div>
            ),
          },
          {
            id: "race",
            empty: M.race.length < 2,
            tab: t("act9.board.tab_race"),
            title: M.titles.rank,
            finding: t("act9.board.race_find"),
            takeaway: t("act9.board.race_take"),
            node: (
              <BarRace
                series={M.race}
                years={M.years}
                unit={M.unit}
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
            tab: t("act9.board.tab_change"),
            title: `${M.titles.change} · ${M.A}–${M.B}`,
            finding: t("act9.board.change_find"),
            takeaway: t("act9.board.change_take"),
            node: (
              <DumbbellChart
                rows={M.dumb}
                yearA={M.A}
                yearB={M.B}
                unit={M.unit}
                labels={cmpLabels}
              />
            ),
          },
          {
            id: "heat",
            empty: M.series.length === 0,
            tab: t("act9.board.tab_heat"),
            title: M.titles.heat,
            finding: t("act9.board.heat_find"),
            takeaway: t("act9.board.heat_take"),
            node: (
              <div className="act9b__fit">
                <ApexChart options={heatOptions} />
              </div>
            ),
          },
          {
            id: "radar",
            empty: M.sub.length < 2,
            tab: t("act9.board.tab_radar"),
            title: t("act9.board.radar_title"),
            finding: t("act9.board.radar_find"),
            takeaway: t("act9.board.radar_take"),
            node: (
              <div className="act9b__fit">
                <RadarChart subAvg={M.sub} years={M.years} />
              </div>
            ),
          },
          {
            id: "map",
            empty: M.rank.length === 0,
            tab: t("act9.board.tab_map"),
            title: `${t("act9.board.map_title")} · ${M.B}`,
            finding: t("act9.board.map_find"),
            takeaway: t("act9.board.map_take"),
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
                    ramp="good"
                    lowLabel={t("act6.heatmap_low")}
                    highLabel={t("act6.heatmap_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act9.board.tab_read"),
            title: t("act9.read_title"),
            finding: t("act9.board.read_find"),
            takeaway: t("act9.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act9.spotlight.ex_kicker"),
                  text: t("act9.spotlight.ex_text"),
                }}
                link={{
                  href: "https://stats.pacificdata.org",
                  label: t("act9.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "coverage",
            empty: M.series.length === 0,
            tab: t("act9.board.tab_coverage"),
            title: M.titles.multiples,
            finding: t("act9.board.coverage_find"),
            takeaway: t("act9.board.coverage_take"),
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
        ].filter(Boolean)
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("act9.tag")}
      title={t("act9.title")}
      thesis={t("act9.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      nav="carousel"
      progress={{ index: 11, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act9.unavailable"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act9.board.switch_hint"),
        signature: t("act9.board.signature"),
        takeawayKicker: t("act9.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act9.board.start"),
        conclusion: t("act9.board.conclusion"),
        backIntro: t("act9.board.back_intro"),
        reviseData: t("act9.board.revise_data"),
        viewGroup: t("act9.board.group_view"),
      }}
      outro={{
        kicker: t("act9.outro.kicker"),
        title: t("act9.outro.title"),
        text: t("act9.outro.text"),
        primary: { to: "/synthese", label: t("act9.outro.next") },
        secondary: { to: "/", label: t("act9.outro.home") },
      }}
    />
  );
}
