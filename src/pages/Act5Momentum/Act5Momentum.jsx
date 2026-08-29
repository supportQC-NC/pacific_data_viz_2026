// src/pages/Act5Momentum/Act5Momentum.jsx
// ============================================================
// Acte 05 — L'élan : part des énergies renouvelables par territoire (SPC).
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (sous-région + année),
// la bande de tendance régionale en SIGNATURE. Tableau retiré ; classement
// ANIMÉ (BarRace) + trajectoires ajoutés. 5 graphes.
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
import AnomalyTrend from "../../components/AnomalyTrend/AnomalyTrend";
import EvolutionPanel from "../../components/EvolutionPanel/EvolutionPanel";
import BarRace from "../../components/BarRace/BarRace";
import TrendChart from "../../components/charts/TrendChart";
import PowerMixChart from "../../components/charts/PowerMixChart";
import MixCompositionChart from "../../components/charts/MixCompositionChart";
import TreemapChart from "../../components/charts/TreemapChart";
import DonutChart from "../../components/charts/DonutChart";
import SourceLeaderChart from "../../components/charts/SourceLeaderChart";
import StackedColsChart from "../../components/charts/StackedColsChart";
import FunnelChart from "../../components/charts/FunnelChart";
import ShareAreaChart from "../../components/charts/ShareAreaChart";
import { fetchPowerMix } from "../../services/powerApi";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
// Les visuels de la Home qui portent les deux familles de vues de cette
// escale : EnergyCell lit `renewables`, PowerMix lit le mix électrique —
// exactement les deux jeux du sélecteur. Ils restent montés sur la page
// d'accueil ; on les ajoute ici, on ne les déplace pas.
import EnergyCell from "../../components/EnergyCell/EnergyCell";
import PowerMix from "../../components/PowerMix/PowerMix";
import VizSwitch from "../../components/VizSwitch/VizSwitch";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act5Momentum.scss";

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

// Couleur sémantique par source d'énergie (tokens du thème) : chaque source
// reçoit une teinte distincte — notamment hydro (bleu) ≠ biogaz (vert).
function energyColor(label, tk) {
  const n = (label || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/charbon|coal|tourbe|peat/.test(n)) return tk.textMute;
  if (/biogaz|biogas|bio|biomass|biocombustible|biofuel/.test(n))
    return tk.positive;
  if (/petrole|oil|gaz|gas/.test(n)) return tk.warm;
  if (/hydro/.test(n)) return tk.accentDeep;
  if (/solaire|solar/.test(n)) return tk.warmSoft;
  if (/eolien|wind/.test(n)) return tk.accent;
  if (/geotherm/.test(n)) return tk.negative;
  return tk.secondary || tk.accent;
}

function pct(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi
    ? sorted[lo]
    : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function meanSeries(d, inR) {
  if (!d) return [];
  return d.years
    .map((year) => {
      const vals = [];
      d.areas.forEach((a) => {
        if (!isPict(a) || !inR(a)) return;
        const p = (d.byArea[a] || []).find((q) => q.year === year);
        if (p && Number.isFinite(p.value)) vals.push(p.value);
      });
      if (!vals.length) return null;
      const s = [...vals].sort((x, y) => x - y);
      const mean = vals.reduce((acc, v) => acc + v, 0) / vals.length;
      return { year, mean, min: pct(s, 0.1), max: pct(s, 0.9) };
    })
    .filter(Boolean);
}
function allSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (d.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }));
}
// Pour la course : on remplit chaque année avec la dernière valeur connue
// (report en avant) pour une animation fluide malgré les trous.
function raceSeries(d, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const s = (d.byArea[a] || [])
        .filter((p) => Number.isFinite(p.value))
        .sort((x, y) => x.year - y.year);
      let last = null;
      const values = d.years.map((y) => {
        const exact = s.find((p) => p.year === y);
        if (exact) last = exact.value;
        return { year: y, value: last == null ? 0 : last };
      });
      return { area: a, name: pictName(a, lang), values };
    })
    .filter((r) => r.values.some((v) => v.value > 0));
}
function pointsAt(d, year, lang, inR) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a) && inR(a))
    .map((a) => {
      const s = d.byArea[a] || [];
      let chosen = null;
      for (let i = 0; i < s.length; i += 1) {
        if (s[i].year <= year && Number.isFinite(s[i].value)) chosen = s[i];
      }
      return chosen
        ? {
            area: a,
            code: a,
            name: pictName(a, lang),
            value: chosen.value,
            year: chosen.year,
          }
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

// Deux jeux qui parlent d'électricité mais ne mesurent pas la même chose :
// une PART dans la consommation finale d'un côté, une COMPOSITION de la
// production de l'autre. On ne les additionne jamais.
const SOURCE_RENEW_FR =
  "Part des énergies renouvelables dans la consommation finale d'énergie, indicateur ODD 7.2.1, via le Pacific Data Hub. En pourcentage de l'énergie consommée, tous usages confondus.";
const SOURCE_RENEW_EN =
  "Renewable share of final energy consumption, SDG indicator 7.2.1, via the Pacific Data Hub. Percent of energy consumed, all uses together.";
const SOURCE_MIX_FR =
  "Mix de production électrique, via le Pacific Data Hub — répartition par filière. C'est la composition de l'électricité produite, pas de l'énergie consommée.";
const SOURCE_MIX_EN =
  "Electricity generation mix, via the Pacific Data Hub - breakdown by source. This is the composition of electricity produced, not of energy consumed.";

export default function Act5Momentum() {
  const { t, lang } = useLang();

  // Repli littéral tant que la clé n'est pas versée dans les dictionnaires.
  // Quel dessin est à l'écran, quand l'escale en porte plusieurs.

  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );
  const dispatch = useDispatch();
  const tk = useThemeTokens();
  const renew = useSelector(selectDataset("renewables"));

  const [region, setRegion] = useState("all");
  const [dataset, setDataset] = useState("renew");

  const [viz, setViz] = useState("cell");
  // LE DESSIN SUIT LE JEU CHOISI, par défaut seulement.
  // Les deux visuels restent accessibles dans les deux familles — le camembert
  // du mix est trop parlant pour dépendre d'un filtre — mais ouvrir sur la
  // pile alors qu'on vient de demander le mix électrique fait contredire la
  // barre par le panneau. Le lecteur garde la main : un clic sur la bascule
  // écrase ce choix jusqu'au prochain changement de jeu.
  useEffect(() => {
    setViz(dataset === "mix" ? "mix_viz" : "cell");
  }, [dataset]);
  const [yearIdx, setYearIdx] = useState(null);
  const [mix, setMix] = useState({ status: "loading", data: null });

  useEffect(() => {
    dispatch(loadDataset("renewables"));
  }, [dispatch]);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setMix((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchPowerMix({ lang, signal: ctrl.signal }).then((res) => {
      if (!alive) return;
      const ok = res.source === "live" && res.years.length > 0;
      setMix({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const ready = renew.status === "succeeded";
  const failed = renew.status === "failed";
  const data = renew.data;
  const years = useMemo(() => (data ? data.years : []), [data]);

  // Année la mieux couverte (évite d'ouvrir sur une année creuse).
  const bestIdx = useMemo(() => {
    if (!data) return 0;
    let best = 0;
    let bestCov = -1;
    data.years.forEach((y, i) => {
      let cov = 0;
      data.areas.forEach((a) => {
        if (!isPict(a)) return;
        const p = (data.byArea[a] || []).find((q) => q.year === y);
        if (p && Number.isFinite(p.value)) cov += 1;
      });
      if (cov >= bestCov) {
        bestCov = cov;
        best = i;
      }
    });
    return best;
  }, [data]);

  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(bestIdx);
  }, [years, yearIdx, bestIdx]);

  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;
  const inRegion = useCallback(
    (area) => region === "all" || REGION_OF[area] === region,
    [region],
  );

  const trend = useMemo(() => meanSeries(data, inRegion), [data, inRegion]);
  const series = useMemo(
    () => allSeries(data, lang, inRegion),
    [data, lang, inRegion],
  );
  const race = useMemo(
    () => raceSeries(data, lang, inRegion),
    [data, lang, inRegion],
  );
  const points = useMemo(
    () =>
      data && currentYear != null
        ? pointsAt(data, currentYear, lang, inRegion)
        : [],
    [data, currentYear, lang, inRegion],
  );
  const overallMax = useMemo(
    () => (data ? Math.max(1, data.range.max) : 100),
    [data],
  );

  // ---- Mix électrique par source (powerApi, en parallèle des renouvelables) ----
  const mixReady = mix.status === "ready" && !!mix.data;
  const mixYears = useMemo(() => (mix.data ? mix.data.years : []), [mix.data]);
  const sumByYear = useCallback(
    (pick) => {
      const d = mix.data;
      if (!d) return [];
      return mixYears.map((y) => {
        let acc = 0;
        Object.keys(d.byArea).forEach((geo) => {
          if (!isPict(geo) || !inRegion(geo)) return;
          acc += pick(d.byArea[geo], y);
        });
        return acc;
      });
    },
    [mix.data, mixYears, inRegion],
  );
  const mixBandSeries = useMemo(() => {
    if (!mix.data) return [];
    return [
      {
        name: t("act5.mix.fossil"),
        color: tk.warm,
        data: sumByYear((a, y) => a.fossil[y] || 0),
      },
      {
        name: t("act5.mix.renew"),
        color: tk.positive,
        data: sumByYear((a, y) => a.renew[y] || 0),
      },
    ];
  }, [mix.data, sumByYear, t, tk]);
  const mixDetailSeries = useMemo(() => {
    const d = mix.data;
    if (!d) return [];
    return d.detailSources.map((sx) => ({
      name: sx.label,
      color: energyColor(sx.label, tk),
      data: sumByYear((a, y) => (a.detail[sx.label] || {})[y] || 0),
    }));
  }, [mix.data, sumByYear, tk]);

  // Année du mix alignée sur le curseur (mix : 2000→2023, sinon dernière connue).
  const mixYear = useMemo(() => {
    if (!mixYears.length) return null;
    if (currentYear == null) return mixYears[mixYears.length - 1];
    const le = mixYears.filter((y) => y <= currentYear);
    return le.length ? le[le.length - 1] : mixYears[0];
  }, [mixYears, currentYear]);
  const shareAt = (a, y) => {
    const f = a.fossil[y] || 0;
    const r = a.renew[y] || 0;
    return f + r > 0 ? r / (f + r) : null;
  };
  // Ordre des territoires FIGÉ sur la dernière année (part renouvelable
  // croissante) → réutilisé sur chaque frame pour un morph fluide.
  // Années ayant une ventilation par source non nulle (tout le Pacifique).
  // Utilisé par les 100 % empilés pour éviter les colonnes à total 0 (NaN).
  const detailYears = useMemo(() => {
    const d = mix.data;
    if (!d) return [];
    return mixYears.filter((yr) => {
      let tot = 0;
      Object.keys(d.byArea).forEach((g) => {
        if (!isPict(g)) return;
        const det = d.byArea[g].detail || {};
        Object.keys(det).forEach((lab) => {
          tot += (det[lab] || {})[yr] || 0;
        });
      });
      return tot > 0;
    });
  }, [mix.data, mixYears]);
  const compoOrder = useMemo(() => {
    const d = mix.data;
    if (!d || !mixYears.length) return [];
    const last = mixYears[mixYears.length - 1];
    return Object.keys(d.byArea)
      .filter(
        (g) =>
          isPict(g) &&
          inRegion(g) &&
          mixYears.some(
            (y) =>
              (d.byArea[g].fossil[y] || 0) + (d.byArea[g].renew[y] || 0) > 0,
          ),
      )
      .sort(
        (g1, g2) =>
          (shareAt(d.byArea[g1], last) || 0) -
          (shareAt(d.byArea[g2], last) || 0),
      );
  }, [mix.data, mixYears, inRegion]);
  // Année animée de la composition (play/pause propre, indépendant du curseur).
  const [compoIdx, setCompoIdx] = useState(0);
  const [compoPlaying, setCompoPlaying] = useState(false);
  useEffect(() => {
    setCompoIdx(detailYears.length ? detailYears.length - 1 : 0);
    setCompoPlaying(false);
  }, [detailYears.length, region]);
  useEffect(() => {
    if (!compoPlaying || detailYears.length < 2) return undefined;
    const id = setInterval(
      () => setCompoIdx((i) => (i + 1) % detailYears.length),
      1100,
    );
    return () => clearInterval(id);
  }, [compoPlaying, detailYears.length]);
  const compoYear = detailYears.length
    ? detailYears[Math.min(compoIdx, detailYears.length - 1)]
    : null;
  // Composition par territoire (barres empilées 100 % par source), animée.
  const mixCompo = useMemo(() => {
    const d = mix.data;
    if (!d || compoYear == null) return { categories: [], series: [] };
    const terr = compoOrder.filter((g) => {
      const det = d.byArea[g].detail || {};
      let tot = 0;
      Object.keys(det).forEach((lab) => {
        tot += (det[lab] || {})[compoYear] || 0;
      });
      return tot > 0;
    });
    const series = d.detailSources.map((sx) => ({
      name: sx.label,
      color: energyColor(sx.label, tk),
      data: terr.map(
        (g) =>
          Math.round(
            ((d.byArea[g].detail[sx.label] || {})[compoYear] || 0) * 10,
          ) / 10,
      ),
    }));
    return { categories: terr.map((g) => pictName(g, lang)), series };
  }, [mix.data, compoYear, compoOrder, lang, tk]);
  // Treemap : d'où vient l'électricité (part de chaque source, région agrégée).
  const mixTree = useMemo(() => {
    const d = mix.data;
    if (!d || mixYear == null) return [];
    const totals = {};
    Object.keys(d.byArea)
      .filter((g) => isPict(g) && inRegion(g))
      .forEach((g) => {
        const det = d.byArea[g].detail || {};
        Object.keys(det).forEach((lab) => {
          totals[lab] = (totals[lab] || 0) + ((det[lab] || {})[mixYear] || 0);
        });
      });
    return Object.keys(totals)
      .filter((lab) => totals[lab] > 0)
      .map((lab) => ({
        label: lab,
        value: Math.round(totals[lab] * 10) / 10,
        color: energyColor(lab, tk),
      }))
      .sort((a, b) => b.value - a.value);
  }, [mix.data, mixYear, inRegion, tk]);
  // ---- Donut autonome : mix d'UNE sélection (filtres propres) ----
  const [dRegion, setDRegion] = useState("all");
  const [dTerr, setDTerr] = useState("all");
  const [dYear, setDYear] = useState(null);
  useEffect(() => {
    if (mixYears.length)
      setDYear((y) => (y == null ? mixYears[mixYears.length - 1] : y));
  }, [mixYears.length]);
  useEffect(() => {
    setDTerr("all");
  }, [dRegion]);
  const dTerrOpts = useMemo(() => {
    const base = [{ v: "all", label: t("act1.filter.all") }];
    const d = mix.data;
    if (!d) return base;
    const terrs = Object.keys(d.byArea)
      .filter(
        (g) =>
          isPict(g) &&
          (dRegion === "all" || REGION_OF[g] === dRegion) &&
          mixYears.some(
            (y) =>
              (d.byArea[g].fossil[y] || 0) + (d.byArea[g].renew[y] || 0) > 0,
          ),
      )
      .map((g) => ({ v: g, label: pictName(g, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return base.concat(terrs);
  }, [mix.data, dRegion, mixYears, lang, t]);
  const dYearOpts = useMemo(
    () => mixYears.map((y) => ({ v: String(y), label: String(y) })),
    [mixYears],
  );
  const donut = useMemo(() => {
    const d = mix.data;
    if (!d || dYear == null)
      return { labels: [], series: [], colors: [], renewShare: null };
    const kindOf = {};
    (d.detailSources || []).forEach((sx) => {
      kindOf[sx.label] = sx.kind;
    });
    const totals = {};
    Object.keys(d.byArea)
      .filter(
        (g) =>
          isPict(g) &&
          (dRegion === "all" || REGION_OF[g] === dRegion) &&
          (dTerr === "all" || g === dTerr),
      )
      .forEach((g) => {
        const det = d.byArea[g].detail || {};
        Object.keys(det).forEach((lab) => {
          totals[lab] = (totals[lab] || 0) + ((det[lab] || {})[dYear] || 0);
        });
      });
    const entries = Object.keys(totals)
      .filter((lab) => totals[lab] > 0)
      .map((lab) => ({
        lab,
        val: totals[lab],
        color: energyColor(lab, tk),
        kind: kindOf[lab],
      }))
      .sort((a, b) => b.val - a.val);
    const total = entries.reduce((acc, e) => acc + e.val, 0);
    const renew = entries
      .filter((e) => e.kind === "renew")
      .reduce((acc, e) => acc + e.val, 0);
    return {
      labels: entries.map((e) => e.lab),
      series: entries.map((e) => Math.round(e.val * 10) / 10),
      colors: entries.map((e) => e.color),
      renewShare: total > 0 ? Math.round((renew / total) * 1000) / 10 : null,
    };
  }, [mix.data, dRegion, dTerr, dYear, tk]);
  const donutScope =
    dTerr === "all"
      ? t(`act1.filter.${dRegion}`)
      : (dTerrOpts.find((o) => o.v === dTerr) || {}).label || "";
  // Par source : volume total + premier territoire consommateur (mixYear).
  const mixSourceLeader = useMemo(() => {
    const d = mix.data;
    if (!d || mixYear == null) return [];
    const bySource = {};
    Object.keys(d.byArea)
      .filter((g) => isPict(g) && inRegion(g))
      .forEach((g) => {
        const det = d.byArea[g].detail || {};
        Object.keys(det).forEach((lab) => {
          const v = (det[lab] || {})[mixYear] || 0;
          if (v <= 0) return;
          if (!bySource[lab])
            bySource[lab] = { total: 0, top: null, topVal: 0 };
          bySource[lab].total += v;
          if (v > bySource[lab].topVal) {
            bySource[lab].topVal = v;
            bySource[lab].top = g;
          }
        });
      });
    return Object.keys(bySource)
      .map((lab) => {
        const e = bySource[lab];
        return {
          label: lab,
          total: Math.round(e.total * 10) / 10,
          color: energyColor(lab, tk),
          topName: e.top ? pictName(e.top, lang) : "",
          topShare: e.total > 0 ? Math.round((e.topVal / e.total) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [mix.data, mixYear, inRegion, lang, tk]);
  // Funnel : énergie totale du Pacifique ENTIER par source (ignore le filtre
  // sous-région), triée décroissant.
  const mixFunnel = useMemo(() => {
    const d = mix.data;
    if (!d || mixYear == null) return [];
    const totals = {};
    Object.keys(d.byArea)
      .filter((g) => isPict(g))
      .forEach((g) => {
        const det = d.byArea[g].detail || {};
        Object.keys(det).forEach((lab) => {
          totals[lab] = (totals[lab] || 0) + ((det[lab] || {})[mixYear] || 0);
        });
      });
    return Object.keys(totals)
      .filter((lab) => totals[lab] > 0)
      .map((lab) => ({
        label: lab,
        value: Math.round(totals[lab] * 10) / 10,
        color: energyColor(lab, tk),
      }))
      .sort((a, b) => b.value - a.value);
  }, [mix.data, mixYear, tk]);
  // Évolution des parts (100 % empilé) pour TOUT le Pacifique. On NE GARDE que
  // les années ayant une ventilation détaillée non nulle : sinon le total d'une
  // colonne 100 % vaut 0 → hauteur NaN → "parser Error" dans ApexCharts.
  const mixShareEvo = useMemo(() => {
    const d = mix.data;
    if (!d) return { years: [], series: [] };
    const years = detailYears;
    const series = d.detailSources.map((sx) => ({
      name: sx.label,
      color: energyColor(sx.label, tk),
      data: years.map((yr) => {
        let sum = 0;
        Object.keys(d.byArea).forEach((g) => {
          if (isPict(g)) sum += (d.byArea[g].detail[sx.label] || {})[yr] || 0;
        });
        return Math.round(sum * 10) / 10;
      }),
    }));
    return { years, series };
  }, [mix.data, detailYears, tk]);

  const unit = t("act5.unit");
  const evoLabels = useMemo(
    () => ({
      improved: t("act5.evo_down"),
      worsened: t("act5.evo_up"),
      since: t("act1.evo.since"),
      no_data: t("act1.evo.no_data"),
    }),
    [t],
  );

  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const retry = useCallback(
    () => dispatch(loadDataset("renewables")),
    [dispatch],
  );

  const regionOpts = REGION_KEYS.map((k) => ({
    v: k,
    label: t(`act1.filter.${k}`),
  }));
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));
  // Deux familles de vues basculées par icônes : part renouvelable vs mix électrique.
  const datasetItems = [
    {
      id: "renew",
      label: t("act5.dataset.renew"),
      icon: "leaf",
      tone: "positive",
    },
    { id: "mix", label: t("act5.dataset.mix"), icon: "bolt", tone: "warm" },
  ];
  const status = failed
    ? "error"
    : !ready
      ? "loading"
      : years.length === 0
        ? "empty"
        : "ready";

  // Les deux sélecteurs de l'escale passent en menus déroulants. Les listes
  // d'items existantes ({ id, label, … }) sont réutilisées telles quelles :
  // on ne les redéfinit pas, on les adapte à la forme attendue.
  const asOptions = (items) =>
    (items || []).map((it) => ({ value: it.id, label: it.label }));

  const filtersEl = (
    <>
      <ChartFilter
        label={t("act5.board.dataset_label")}
        hideLabel
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
      {/* LE CURSEUR D'ANNÉE N'EST PAS TOUJOURS UN FILTRE GLOBAL.
          Sur la famille « mix électrique », il recalcule la bande, le détail,
          la composition, le pavage et l'anneau : il pilote bien tout le
          tableau, sa place est ici.
          Sur la famille « part renouvelable », il ne touche QUE les colonnes
          du globe — la tendance, les trajectoires et le classement portent
          sur toute la période. Il descend alors dans la colonne de lecture de
          la carte, avec la vue qu'il change. */}
      {dataset === "mix" ? (
        <YearSlider
        label={t("act1.f.year")}
        years={years}
        index={yearIdx}
        onChange={(i) => setYearIdx(i)}
        />
      ) : null}
    </>
  );

  // Carte d'identité DOUBLE (part renouvelable + production par source) — 100 % i18n / fiches officielles.
  const spotlightRows = [
    { k: t("act5.spotlight.r1k"), v: t("act5.spotlight.r1v") },
    { k: t("act5.spotlight.r2k"), v: t("act5.spotlight.r2v") },
    { k: t("act5.spotlight.r3k"), v: t("act5.spotlight.r3v") },
    { k: t("act5.spotlight.r4k"), v: t("act5.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act5.spotlight.n1"),
    t("act5.spotlight.n2"),
    t("act5.spotlight.n3"),
    t("act5.spotlight.n4"),
    t("act5.spotlight.n5"),
  ];

  // Les deux familles de vues ne portent pas la même quantité : un
  // pourcentage de consommation finale, ou une part de production par
  // filière. Une clé unique pour l'escale mentirait sur l'une des deux.
  const key =
    dataset === "mix"
      ? {
          y: tx(
            "act5.key.mix_y",
            "Part de chaque filière dans l'électricité produite, en pourcentage. Les parts d'un territoire font 100 % entre elles.",
            "Each source's share of electricity produced, in percent. A territory's shares add up to 100%.",
          ),
          x: tx("act5.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act5.key.mix_c",
            "Une couleur par filière, stable d'une vue à l'autre : la teinte suit la source d'énergie, jamais son rang.",
            "One colour per source, stable across views: the hue follows the energy source, never its rank.",
          ),
          note: tx("act5.key.mix_note", SOURCE_MIX_FR, SOURCE_MIX_EN),
          swatch: "none",
        }
      : {
          y: tx(
            "act5.key.renew_y",
            "Part des énergies renouvelables dans la consommation finale d'énergie, en pourcentage. Toute l'énergie consommée entre dans le dénominateur, pas seulement l'électricité.",
            "Renewable share of final energy consumption, in percent. All consumed energy is in the denominator, not only electricity.",
          ),
          x: tx("act5.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
          color: tx(
            "act5.key.renew_c",
            "Une seule teinte, du plus faible au plus élevé. Ici c'est le BAS de l'échelle qui alerte.",
            "A single hue, lowest to highest. Here it is the BOTTOM of the scale that warns.",
          ),
          note: tx("act5.key.renew_note", SOURCE_RENEW_FR, SOURCE_RENEW_EN),
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
    cell: {
              id: "cell",
              empty: false,
              tab: tx("act5.board.tab_pile", "Pile", "Cell"),
              title: tx(
                "act5.viz.cell_title",
                "La part renouvelable, territoire par territoire",
                "The renewable share, territory by territory",
              ),
              finding: tx(
                "act5.viz.cell_find",
                "Choisissez un territoire : la charge suit sa part d'énergies renouvelables.",
                "Pick a territory: the charge follows its renewable share.",
              ),
              takeaway: tx(
                "act5.viz.cell_take",
                "La part porte sur toute l'énergie consommée, pas seulement l'électricité : le transport et la cuisson pèsent dans le dénominateur autant que la prise de courant.",
                "The share covers all energy consumed, not just electricity: transport and cooking weigh in the denominator as much as the wall socket does.",
              ),
              hint: tx(
                "act5.hint.cell",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act5.key.cell_c",
                  "La charge monte avec la part renouvelable du territoire choisi.",
                  "The charge rises with the chosen territory's renewable share.",
                ),
                note: tx("act5.key.renew_note", SOURCE_RENEW_FR, SOURCE_RENEW_EN),
                // Le dessin encode par un NIVEAU de charge, pas par une teinte.
                swatch: "none",
              },
              node: <EnergyCell embed />,
            },
    mix_viz: {
              id: "mix_viz",
              empty: false,
              tab: tx("act5.board.tab_mix_viz", "Mix", "Mix"),
              title: tx(
                "act5.viz.mix_title",
                "Le mix électrique, territoire par territoire",
                "The electricity mix, territory by territory",
              ),
              finding: tx(
                "act5.viz.mix_find",
                "Choisissez un territoire : la répartition suit ses filières de production.",
                "Pick a territory: the breakdown follows its generation sources.",
              ),
              takeaway: tx(
                "act5.viz.mix_take",
                "Ce sont des parts de l'électricité PRODUITE. Un territoire peut afficher un mix très renouvelable et rester massivement dépendant du pétrole pour ses transports.",
                "These are shares of electricity PRODUCED. A territory can post a very renewable mix and still depend massively on oil for transport.",
              ),
              hint: tx(
                "act5.hint.mix",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act5.key.mix_viz_c",
                  "Une couleur par filière, stable d'un territoire à l'autre : la teinte suit la source d'énergie, jamais sa part.",
                  "One colour per source, stable across territories: the hue follows the energy source, never its share.",
                ),
                note: tx("act5.key.mix_note", SOURCE_MIX_FR, SOURCE_MIX_EN),
                swatch: "none",
              },
              node: <PowerMix embed />,
            },
  };

  const vizItems = [
    { id: "cell", label: tx("act5.viz.sw_cell", "Part", "Share") },
    { id: "mix_viz", label: tx("act5.viz.sw_mix_viz", "Mix", "Mix") },
  ];
  const activeViz = VIZ[viz] || VIZ.cell;

  // Commande d'année de la carte, quand elle ne pilote qu'elle (voir le
  // commentaire dans `filtersEl`).
  const mapYearControl =
    dataset === "mix" ? null : (
      <YearSlider
        label={t("act1.f.year")}
        years={years}
        index={yearIdx}
        onChange={(i) => setYearIdx(i)}
      />
    );

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
                  value={viz}
                  onChange={setViz}
                  label={tx("act5.viz.sw_label", "Visuel", "Visual")}
                />
                <div className="vizpane__body">{activeViz.node}</div>
              </div>
            ),
          },
          // ---------- Les visuels interactifs, en ouverture ----------------
          // Deux dessins de la Home, un par famille de vues : la pile pour la
          // part renouvelable, le camembert vivant pour le mix électrique. Le
          // sélecteur décide lequel est à l'écran — `mix_` d'un côté, tout le
          // reste de l'autre, exactement la règle déjà en place pour les vues.
          // Ils restent montés sur la page d'accueil ; on les ajoute ici, on
          // ne les déplace pas.
          {
            id: "trend",
            signature: true,
            empty: trend.length < 2,
            tab: t("act5.board.tab_trend"),
            title: t("act5.ren_title"),
            finding: t("act5.board.trend_find"),
            takeaway: t("act5.board.trend_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <div className="act5b__scroll">
                <AnomalyTrend
                  data={trend}
                  currentYear={currentYear}
                  unit={unit}
                  tone="green"
                  baselineLabel={t("act5.baseline")}
                  meanLabel={t("act5.mean_label")}
                />
              </div>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act5.board.tab_read"),
            title: t("act5.read_title"),
            finding: t("act5.board.read_find"),
            takeaway: t("act5.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act5.spotlight.ex_kicker"),
                  text: t("act5.spotlight.ex_text"),
                }}
                link={{
                  href: "https://stats.pacificdata.org",
                  label: t("act5.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "lines",
            empty: series.length === 0,
            tab: tx("act5.board.tab_trajectoires", "Trajectoires", "Paths"),
            title: t("act5.board.lines_title"),
            finding: t("act5.board.lines_find"),
            takeaway: t("act5.board.lines_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <TrendChart
                series={series}
                years={years}
                unit={unit}
                scale="lin"
              />
            ),
          },
          {
            id: "rank",
            empty: race.length === 0,
            tab: tx("act5.board.tab_classement", "Classement", "Ranking"),
            title: t("act5.board.rank_title"),
            finding: t("act5.board.rank_find"),
            takeaway: t("act5.board.rank_take"),
            legend: { ...key, y: tx("act5.key.terr_y", "Un territoire par ligne.", "One territory per row."), x: key.y },
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <BarRace
                series={race}
                years={years}
                unit={unit}
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
            id: "map",
            empty: points.length === 0,
            tab: tx("act5.board.tab_carte", "Carte", "Map"),
            title: `${t("act5.map_title")} · ${currentYear}`,
            finding: t("act5.board.map_find"),
            takeaway: t("act5.board.map_take"),
            legend: { color: key.color, note: key.note, swatch: key.swatch },
            controls: mapYearControl,
            hint: tx(
              "act5.hint.map",
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
                    range={{ min: 0, max: overallMax }}
                    // Une PART en pourcentage : une grandeur bornée, sans
                    // zéro chargé de sens. La rampe « good » ne fait partie
                    // d'aucun des trois encodages du système.
                    ramp="magnitude"
                    mid={null}
                    lowLabel={t("act5.map_low")}
                    highLabel={t("act5.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "evo",
            empty: series.length === 0,
            tab: tx("act5.board.tab_evolution", "Évolution", "Change"),
            title: t("act5.evo_title"),
            finding: t("act5.board.evo_find"),
            takeaway: t("act5.board.evo_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <div className="act5b__scroll">
                <EvolutionPanel
                  series={series}
                  labels={evoLabels}
                  unit={unit}
                  mode="absolute"
                  topN={8}
                />
              </div>
            ),
          },
          {
            id: "mix_band",
            empty:
              !mixReady ||
              mixBandSeries.every((sx) => sx.data.every((v) => !v)),
            tab: tx("act5.board.tab_mix_bande", "Bande", "Band"),
            title: t("act5.mix.band_title"),
            finding: t("act5.board.mix_band_find"),
            takeaway: t("act5.board.mix_band_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <PowerMixChart
                series={mixBandSeries}
                years={mixYears}
                unit={t("act5.mix.unit")}
              />
            ),
          },
          {
            id: "mix_detail",
            empty: !mixReady || mixDetailSeries.length === 0,
            tab: tx("act5.board.tab_mix_detail_1", "Détail", "Detail"),
            title: t("act5.mix.detail_title"),
            finding: t("act5.board.mix_detail_find"),
            takeaway: t("act5.board.mix_detail_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <StackedColsChart
                series={mixDetailSeries}
                years={mixYears}
                unit={t("act5.mix.unit")}
              />
            ),
          },
          {
            id: "mix_compo",
            empty: !mixReady || mixCompo.categories.length === 0,
            tab: tx("act5.board.tab_mix_compo_1", "Composition", "Mix"),
            title: `${t("act5.mix.compo_title")} · ${compoYear ?? ""}`,
            finding: t("act5.board.mix_compo_find"),
            takeaway: t("act5.board.mix_compo_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <div>
                <div className="barrace__top">
                  <button
                    type="button"
                    className="barrace__play"
                    onClick={() => setCompoPlaying((v) => !v)}
                  >
                    {compoPlaying ? t("act1.race.pause") : t("act1.race.play")}
                  </button>
                  <button
                    type="button"
                    className="barrace__restart"
                    onClick={() => {
                      setCompoPlaying(false);
                      setCompoIdx(0);
                    }}
                    aria-label={t("act1.race.restart")}
                    title={t("act1.race.restart")}
                  >
                    {"\u21BA"}
                  </button>
                  <span className="barrace__yr">{compoYear}</span>
                </div>
                <MixCompositionChart
                  series={mixCompo.series}
                  categories={mixCompo.categories}
                  unit={t("act5.mix.unit")}
                />
              </div>
            ),
          },
          {
            id: "mix_tree",
            empty: !mixReady || mixTree.length === 0,
            tab: tx("act5.board.tab_mix_pave", "Pavage", "Treemap"),
            title: `${t("act5.mix.tree_title")} · ${mixYear ?? ""}`,
            finding: t("act5.board.mix_tree_find"),
            takeaway: t("act5.board.mix_tree_take"),
            legend: {
              y: tx(
                "act5.key.part_y",
                "La surface de chaque pavé porte la part de la filière.",
                "Each tile's area carries that source's share.",
              ),
              color: key.color,
              note: key.note,
              swatch: key.swatch,
            },
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: <TreemapChart points={mixTree} unit={t("act5.mix.unit")} />,
          },
          {
            id: "mix_donut",
            empty: !mixReady,
            tab: tx("act5.board.tab_mix_anneau", "Anneau", "Donut"),
            title: `${t("act5.mix.donut_title")} · ${donutScope} · ${dYear ?? ""}`,
            finding: t("act5.board.mix_donut_find"),
            takeaway: t("act5.board.mix_donut_take"),
            legend: {
              y: tx(
                "act5.key.part_y",
                "La surface de chaque pavé porte la part de la filière.",
                "Each tile's area carries that source's share.",
              ),
              color: key.color,
              note: key.note,
              swatch: key.swatch,
            },
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <div>
                <div className="act1viz__filters">
                  <Select
                    label={t("act1.filter.title")}
                    options={regionOpts}
                    value={dRegion}
                    onChange={setDRegion}
                  />
                  <Select
                    label={t("act5.mix.donut_terr")}
                    options={dTerrOpts}
                    value={dTerr}
                    onChange={setDTerr}
                  />
                  <Select
                    label={t("act1.f.year")}
                    options={dYearOpts}
                    value={String(dYear ?? "")}
                    onChange={(v) => setDYear(Number(v))}
                  />
                </div>
                {donut.series.length ? (
                  <DonutChart
                    key={`${dRegion}-${dTerr}-${dYear}`}
                    labels={donut.labels}
                    series={donut.series}
                    colors={donut.colors}
                    unit={t("act5.mix.unit")}
                    centerLabel={t("act5.mix.donut_center")}
                    centerValue={
                      donut.renewShare != null ? `${donut.renewShare} %` : "—"
                    }
                  />
                ) : (
                  <p className="act5__nodata">{t("act1.empty")}</p>
                )}
              </div>
            ),
          },
          {
            id: "mix_leader",
            empty: !mixReady || mixSourceLeader.length === 0,
            tab: tx("act5.board.tab_mix_tete", "Tête", "Leaders"),
            title: `${t("act5.mix.leader_title")} · ${mixYear ?? ""}`,
            finding: t("act5.board.mix_leader_find"),
            takeaway: t("act5.board.mix_leader_take"),
            legend: { ...key, y: tx("act5.key.terr_y", "Un territoire par ligne.", "One territory per row."), x: key.y },
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <SourceLeaderChart
                points={mixSourceLeader}
                unit={t("act5.mix.unit")}
              />
            ),
          },
          {
            id: "mix_funnel",
            empty: !mixReady || mixFunnel.length === 0,
            tab: tx("act5.board.tab_mix_entonnoir", "Entonnoir", "Funnel"),
            title: `${t("act5.mix.funnel_title")} · ${mixYear ?? ""}`,
            finding: t("act5.board.mix_funnel_find"),
            takeaway: t("act5.board.mix_funnel_take"),
            legend: { ...key, y: tx("act5.key.terr_y", "Un territoire par ligne.", "One territory per row."), x: key.y },
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: <FunnelChart points={mixFunnel} unit={t("act5.mix.unit")} />,
          },
          {
            id: "mix_share_evo",
            empty: !mixReady || mixShareEvo.years.length === 0,
            tab: tx("act5.board.tab_mix_parts", "Parts", "Shares"),
            title: t("act5.mix.share_evo_title"),
            finding: t("act5.board.mix_share_evo_find"),
            takeaway: t("act5.board.mix_share_evo_take"),
            legend: key,
            hint: tx(
              "act5.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            node: (
              <ShareAreaChart
                series={mixShareEvo.series}
                years={mixShareEvo.years}
                unit={t("act5.mix.unit")}
              />
            ),
          },
          {
            id: "coverage",
            empty: series.length === 0,
            tab: t("act5.board.tab_coverage"),
            title: t("act5.coverage_title"),
            finding: t("act5.board.coverage_find"),
            takeaway: t("act5.board.coverage_take"),
            node: (
              <CoverageChart
                series={series}
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

  // Filtrage du carrousel par famille de vues (part renouvelable / mix
  // électrique) — À DEUX EXCEPTIONS PRÈS : les deux visuels d'ouverture.
  //
  // Ils restent à l'écran quelle que soit la famille choisie, comme sur les
  // escales « santé » et « impact » où les deux dessins se suivent en tête de
  // navigation. Le camembert du mix électrique, en particulier, se pilotait
  // sinon depuis un menu qu'il fallait deviner : il est trop parlant pour
  // dépendre d'un filtre. Chacun garde sa propre sélection de territoire —
  // c'est son interaction, on n'y touche pas.
  // L'entrée des visuels reste à l'écran quelle que soit la famille : les deux
  // dessins y sont réunis, et c'est la bascule du panneau qui choisit lequel.
  // (Les identifiants `cell` et `mix_viz` ne sont plus des vues : ils vivent
  // maintenant dans la table VIZ.)
  const VIZ_IDS = ["viz"];
  const visibleCharts = charts.filter((c) =>
    VIZ_IDS.includes(c.id)
      ? true
      : dataset === "mix"
        ? c.id.startsWith("mix_")
        : !c.id.startsWith("mix_"),
  );

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a5_tag")}
      title={t("home.acts.a5_title")}
      thesis={t("act5.thesis")}
      filters={filtersEl}
      charts={visibleCharts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      progress={{ index: 10, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act5.board.switch_hint"),
        signature: t("act5.board.signature"),
        takeawayKicker: t("act5.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act5.board.start"),
        conclusion: t("act5.board.conclusion"),
        backIntro: t("act5.board.back_intro"),
        reviseData: t("act5.board.revise_data"),
      }}
      outro={{
        kicker: t("act5.outro.kicker"),
        title: t("act5.outro.title"),
        text: t("act5.outro.text"),
        primary: { to: "/economie", label: t("act5.outro.next") },
        secondary: { to: "/", label: t("act5.outro.home") },
      }}
    />
  );
}
