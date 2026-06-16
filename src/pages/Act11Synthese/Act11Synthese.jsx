// src/pages/Act11Synthese/Act11Synthese.jsx
// ============================================================
// ACTE 11 — LE RÉCIT FINAL (expérience immersive plein écran).
// Pas de dashboard ni de dropdown : une suite de SCÈNES (Précédent / Suivant,
// clavier ←/→, barre de progression) qui RECAPENT les 11 actes puis CROISENT
// les jeux de données jusqu'au verdict. ECharts + Mapbox + GSAP.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { gsap } from "gsap";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSynthese } from "../../services/syntheseApi";
import PICT_GEO from "../../data/pictGeo";
import COASTLINE_BY_TERRITORY from "../../data/coastlineByTerritory";
import Loader from "../../components/Loader/Loader";
import AtlasMap from "../../components/AtlasMap/AtlasMap";
import ParadoxScatterLive from "../../components/charts/PardoxScatterLive";
import VulnMatrix from "../../components/charts/VulnMatrix";
import ProfileRadar from "../../components/charts/ProfileRadar";
import TrendChart from "../../components/charts/TrendChart";
import StressSwarm from "../../components/charts/StressSwarm/StressSwarm";
import SlopeChart from "../../components/charts/SlopeChart";
import ArcParadox from "../../components/charts/ArcParadox/ArcParadox";
import RadialRank from "../../components/charts/RadialRank/RadialRank";
import StreamMix from "../../components/charts/StreamMix/StreamMix";
import Lollipop from "../../components/charts/Lollipop/Lollipop";
import ParallelPlot from "../../components/charts/ParallelPlot/ParallelPlot";
import Correlogram from "../../components/charts/Correlogram/Correlogram";
import BubblePlot from "../../components/charts/BubblePlot/BubblePlot";
import Treemap from "../../components/charts/Treemap/Treemap";
import VerdictPanel from "../../components/charts/VerdictPanel/VerdictPanel";
import SynthHero from "../../components/charts/SynthHero/SynthHero";
import ActsRecap from "../../components/charts/ActsRecap/ActsRecap";
import EmissionsRank from "../../components/charts/EmissionsRank/EmissionsRank";
import { fetchPowerMix } from "../../services/powerApi";
import { fetchAgriProduction } from "../../services/agriApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import "./Act11Synthese.scss";

const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = Object.entries(SUBREGIONS).reduce((acc, [r, codes]) => {
  codes.forEach((c) => (acc[c] = r));
  return acc;
}, {});
const VULN = ["seaLevel", "sst", "rain", "water", "tb", "rli"];
const ACTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function valueAt(values, year) {
  if (!values || !values.length) return null;
  let out = null;
  for (const p of values) {
    if (p.year === year) return p.value;
    if (p.year <= year) out = p.value;
  }
  return out;
}
function latestOf(ind) {
  if (!ind || ind.status !== "live") return {};
  const out = {};
  (ind.areas || []).forEach((a) => {
    const v = valueAt(ind.byArea[a], ind.lastYear);
    if (Number.isFinite(v)) out[a] = v;
  });
  return out;
}
function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function vulnContribution(value, dir) {
  if (!Number.isFinite(value)) return NaN;
  if (dir === "down") return -value;
  if (dir === "abs") return Math.abs(value);
  return value;
}
// Normalisation ROBUSTE par rang percentile (0-100) au sein du Pacifique.
// Contrairement au min-max, un seul territoire extreme n'ecrase pas l'echelle :
// chaque territoire est positionne par sa POSITION relative aux autres. Les ex
// aequo partagent le rang moyen.
function normalizeMap(rawByArea) {
  const entries = Object.entries(rawByArea).filter(([, v]) => Number.isFinite(v));
  const n = entries.length;
  if (!n) return {};
  if (n === 1) return { [entries[0][0]]: 50 };
  const sorted = [...entries].sort((x, y) => x[1] - y[1]);
  const out = {};
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1][1] === sorted[i][1]) j += 1;
    const rank = (i + j) / 2;
    const score = (rank / (sorted.length - 1)) * 100;
    for (let k = i; k <= j; k += 1) out[sorted[k][0]] = score;
    i = j + 1;
  }
  return out;
}
function medianLinesBySub(ind, t) {
  if (!ind || ind.status !== "live") return { series: [], years: [] };
  const years = ind.years || [];
  const series = Object.keys(SUBREGIONS)
    .map((reg) => {
      const members = (ind.areas || []).filter(
        (a) => isPict(a) && REGION_OF[a] === reg,
      );
      if (!members.length) return null;
      const values = years
        .map((y) => {
          const vs = members
            .map((a) => valueAt(ind.byArea[a], y))
            .filter((n) => Number.isFinite(n));
          const m = median(vs);
          return m == null
            ? null
            : { year: y, value: Math.round(m * 100) / 100 };
        })
        .filter(Boolean);
      return values.length ? { name: t(`act1.filter.${reg}`), values } : null;
    })
    .filter(Boolean);
  return { series, years };
}

/* ---------- Barre comparative (DOM pur) ---------- */
/* ---------- Studio de pondérations (curseurs interactifs) ---------- */
function WeightStudio({ inds = [], weights = {}, onChange, onReset, labels = {} }) {
  return (
    <div className="wstudio">
      <ul className="wstudio__list">
        {inds.map((it) => {
          const w = Number.isFinite(weights[it.k]) ? weights[it.k] : 1;
          const pct = (w / 2) * 100;
          return (
            <li className="wstudio__row" key={it.k}>
              <span className="wstudio__name">{it.label}</span>
              <input
                className="wstudio__range"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={w}
                onChange={(e) => onChange(it.k, parseFloat(e.target.value))}
                style={{ "--w-pct": `${pct}%` }}
                aria-label={it.label}
              />
              <span className="wstudio__val">{w.toFixed(1)}×</span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="wstudio__reset" onClick={onReset}>
        {labels.reset}
      </button>
    </div>
  );
}

/* ---------- KPI animé (GSAP) ---------- */
function Kpi({ value, prefix = "", suffix = "", label, tone = "accent" }) {
  const ref = useRef(null);
  useEffect(() => {
    const num = Number(value);
    if (!ref.current) return undefined;
    if (!Number.isFinite(num)) {
      ref.current.textContent = `${prefix}${value}${suffix}`;
      return undefined;
    }
    const o = { v: 0 };
    const tw = gsap.to(o, {
      v: num,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current)
          ref.current.textContent = `${prefix}${Math.round(o.v)}${suffix}`;
      },
    });
    return () => tw.kill();
  }, [value, prefix, suffix]);
  return (
    <div className={`vkpi vkpi--${tone}`}>
      <span ref={ref} className="vkpi__val">
        {prefix}
        {value}
        {suffix}
      </span>
      <span className="vkpi__label">{label}</span>
    </div>
  );
}

// Corrélation de Pearson sur des vecteurs appariés (>= 3 points requis).
// Appliquée aux rangs percentiles, elle équivaut à une corrélation de rang
// (≈ Spearman) — robuste sur petit échantillon et données asymétriques.
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return NaN;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i];
    const y = ys[i];
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  const d = Math.sqrt(vx * vy);
  return d > 0 ? cov / d : NaN;
}

export default function Act11Synthese() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [idx, setIdx] = useState(0);
  const [focus, setFocus] = useState(null);
  const [powerMix, setPowerMix] = useState({ status: "idle", data: null });
  const [agriProd, setAgriProd] = useState({ status: "idle", data: null });
  // Pondérations interactives : un poids 0..2 par indicateur de vulnérabilité.
  // 1 = poids normal ; 0 = on retire l'indicateur ; 2 = on le double.
  const [weights, setWeights] = useState(() =>
    VULN.reduce((o, k) => ({ ...o, [k]: 1 }), {}),
  );
  const setWeight = useCallback(
    (k, v) => setWeights((w) => ({ ...w, [k]: v })),
    [],
  );
  const resetWeights = useCallback(
    () => setWeights(VULN.reduce((o, k) => ({ ...o, [k]: 1 }), {})),
    [],
  );

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState((prev) => (prev.data ? prev : { status: "loading", data: null }));
    fetchSynthese({ lang, signal: ctrl.signal }).then((res) => {
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

  // Mix électrique par source — service dédié (powerApi), isolé : son échec
  // n'affecte jamais la synthèse principale.
  useEffect(() => {
    const ctrl = new AbortController();
    setPowerMix({ status: "loading", data: null });
    fetchPowerMix({ lang, signal: ctrl.signal })
      .then((res) =>
        setPowerMix({
          status: res.source === "live" ? "ready" : "empty",
          data: res,
        }),
      )
      .catch(() => setPowerMix({ status: "empty", data: null }));
    return () => ctrl.abort();
  }, [lang]);

  // Production agricole détaillée par produit — service dédié (agriApi),
  // isolé : son échec n'affecte jamais la synthèse principale.
  useEffect(() => {
    const ctrl = new AbortController();
    setAgriProd({ status: "loading", data: null });
    fetchAgriProduction({ start: 2015, lang, signal: ctrl.signal })
      .then((res) =>
        setAgriProd({
          status: res.source === "live" ? "ready" : "empty",
          data: res,
        }),
      )
      .catch(() => setAgriProd({ status: "empty", data: null }));
    return () => ctrl.abort();
  }, [lang]);

  const data = state.data;
  const latest = useMemo(() => {
    if (!data) return {};
    const out = {};
    ["emissions", ...VULN].forEach((k) => (out[k] = latestOf(data[k])));
    return out;
  }, [data]);

  const normByInd = useMemo(() => {
    if (!data) return {};
    const out = {};
    VULN.forEach((k) => {
      const ind = data[k];
      if (!ind || ind.status !== "live") {
        out[k] = {};
        return;
      }
      const raw = {};
      Object.entries(latest[k] || {}).forEach(([a, v]) => {
        const c = vulnContribution(v, ind.dir);
        if (Number.isFinite(c)) raw[a] = c;
      });
      out[k] = normalizeMap(raw);
    });
    return out;
  }, [data, latest]);

  // Couverture minimale : un territoire n'est noté que s'il dispose d'au moins
  // MIN_COVER indicateurs de vulnérabilité — sinon on compare 3 indicateurs à 6.
  const MIN_COVER = 2;
  const composite = useMemo(() => {
    const acc = {}; // area -> { wsum, wtot, count }
    VULN.forEach((k) => {
      const w = Number.isFinite(weights[k]) ? weights[k] : 1;
      if (w <= 0) return; // indicateur désactivé par l'utilisateur
      Object.entries(normByInd[k] || {}).forEach(([a, v]) => {
        if (!isPict(a) || !Number.isFinite(v)) return;
        const cell = (acc[a] = acc[a] || { wsum: 0, wtot: 0, count: 0 });
        cell.wsum += v * w;
        cell.wtot += w;
        cell.count += 1;
      });
    });
    const out = {};
    Object.entries(acc).forEach(([a, c]) => {
      if (c.count >= MIN_COVER && c.wtot > 0) out[a] = c.wsum / c.wtot;
    });
    return out;
  }, [normByInd, weights]);

  const activeVuln = useMemo(
    () => VULN.filter((k) => data && data[k] && data[k].status === "live"),
    [data],
  );
  const indLabels = useMemo(
    () => activeVuln.map((k) => t(`act11.ind_${k}`)),
    [activeVuln, t],
  );
  const areas = useMemo(
    () => Object.keys(composite).filter((a) => isPict(a)),
    [composite],
  );

  const pacMed = useMemo(() => {
    const emi = latest.emissions || {};
    return median(areas.map((a) => emi[a]).filter(Number.isFinite)) ?? 0;
  }, [areas, latest]);

  const seaTrend = useMemo(
    () => medianLinesBySub(data?.seaLevel, t),
    [data, t],
  );

  const scatterGroups = useMemo(() => {
    const emi = latest.emissions || {};
    const pal = {
      melanesia: tk.accent,
      polynesia: tk.warm,
      micronesia: tk.positive,
      other: tk.secondary,
    };
    return Object.keys(SUBREGIONS)
      .map((reg) => ({
        name: t(`act1.filter.${reg}`),
        color: pal[reg],
        points: areas
          .filter((a) => REGION_OF[a] === reg && Number.isFinite(emi[a]))
          .map((a) => ({
            x: Number(emi[a].toFixed(2)),
            y: Math.round(composite[a]),
            name: pictName(a, lang),
            code: a,
          })),
      }))
      .filter((g) => g.points.length);
  }, [areas, latest, composite, lang, t, tk]);
  const medianX = useMemo(() => {
    const emi = latest.emissions || {};
    return median(areas.map((a) => emi[a]).filter(Number.isFinite)) ?? 0;
  }, [areas, latest]);
  const medianY = useMemo(
    () => median(areas.map((a) => composite[a])) ?? 50,
    [areas, composite],
  );

  const matrixRows = useMemo(
    () =>
      [...areas]
        .sort((a, b) => composite[b] - composite[a])
        .map((a) => ({
          code: a,
          name: pictName(a, lang),
          values: activeVuln.map((k) => (normByInd[k] || {})[a] ?? NaN),
        })),
    [areas, composite, lang, activeVuln, normByInd],
  );

  const radarIndicators = useMemo(
    () => activeVuln.map((k) => ({ name: t(`act11.ind_${k}`), max: 100 })),
    [activeVuln, t],
  );
  const radarSeries = useMemo(
    () =>
      Object.keys(SUBREGIONS)
        .map((reg) => {
          const members = areas.filter((a) => REGION_OF[a] === reg);
          if (!members.length) return null;
          const values = activeVuln.map((k) => {
            const vs = members
              .map((a) => (normByInd[k] || {})[a])
              .filter(Number.isFinite);
            return vs.length
              ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length)
              : 0;
          });
          return { name: t(`act1.filter.${reg}`), values };
        })
        .filter(Boolean),
    [areas, activeVuln, normByInd, t],
  );

  const atlasPoints = useMemo(
    () =>
      areas
        .filter((a) => PICT_GEO[a])
        .map((a) => ({
          code: a,
          name: pictName(a, lang),
          lng: PICT_GEO[a][0],
          lat: PICT_GEO[a][1],
          value: composite[a] ?? 0,
          vuln: composite[a] ?? 0,
        })),
    [areas, lang, composite],
  );

  // --- Bouquet final : 3 vues de synthèse ---
  // 1) Essaim : tous les territoires sur l'axe de vulnérabilité composite.
  // 2) Top des plus exposés (indice composite), barres radiales.
  const topExposed = useMemo(
    () =>
      areas
        .map((a) => ({
          code: a,
          area: a,
          name: pictName(a, lang),
          value: Math.round(composite[a] ?? 0),
        }))
        .filter((r) => Number.isFinite(r.value))
        .sort((x, y) => y.value - x.value)
        .slice(0, 8),
    [areas, composite, lang],
  );

  // 3) Le renversement : rang d'émissions (responsabilité) -> rang de vulnérabilité.
  // On normalise les émissions en rang (0-100) pour comparer deux échelles
  // différentes sur le même axe, et on relie chaque territoire d'un trait.
  const slopeRows = useMemo(() => {
    const emi = latest.emissions || {};
    const emiPts = areas.filter((a) => Number.isFinite(emi[a]));
    if (emiPts.length < 3) return [];
    const emiRank = normalizeMap(
      emiPts.reduce((o, a) => ({ ...o, [a]: emi[a] }), {}),
    );
    return emiPts
      .filter((a) => Number.isFinite(composite[a]))
      .map((a) => ({
        name: pictName(a, lang),
        left: Math.round(emiRank[a] ?? 0),
        right: Math.round(composite[a] ?? 0),
      }))
      .sort((x, y) => y.right - x.right)
      .slice(0, 12);
  }, [areas, latest, composite, lang]);

  // Récap des autres actes (énergie / fiscalité / tourisme) — indicateurs de
  // contexte chargés par syntheseApi (role:"context"). On retient le premier
  // réellement disponible. CHAQUE candidat porte ses propres clés i18n
  // (eyebrow / titre / texte / unité), de sorte que le titre et le texte
  // décrivent toujours l'indicateur RÉELLEMENT affiché — fini les chiffres
  // sans explication sous un titre incohérent.
  const contextRecap = useMemo(() => {
    const candidates = [
      {
        key: "renew",
        unitKey: "act11.ctx_unit_pct",
        eyebrowKey: "act11.story.ctx_renew_k",
        titleKey: "act11.story.ctx_renew_t",
        textKey: "act11.story.ctx_renew_x",
        methodKey: "act11.story.ctx_renew_m",
        better: "high",
      },
      {
        key: "envtax",
        unitKey: "act11.ctx_unit_gdp",
        eyebrowKey: "act11.story.ctx_envtax_k",
        titleKey: "act11.story.ctx_envtax_t",
        textKey: "act11.story.ctx_envtax_x",
        methodKey: "act11.story.ctx_envtax_m",
        better: "high",
      },
      {
        key: "tourism",
        unitKey: "act11.ctx_unit_arr",
        eyebrowKey: "act11.story.ctx_tour_k",
        titleKey: "act11.story.ctx_tour_t",
        textKey: "act11.story.ctx_tour_x",
        methodKey: "act11.story.ctx_tour_m",
        better: "high",
      },
    ];
    for (const c of candidates) {
      const ind = data && data[c.key];
      if (!ind || ind.status !== "live") continue;
      const last = latestOf(ind);
      const rows = Object.entries(last)
        .filter(([area, v]) => isPict(area) && Number.isFinite(v) && v > 0)
        .map(([area, v]) => ({
          area,
          name: pictName(area, lang),
          value: Math.round(v * 10) / 10,
        }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 12);
      if (rows.length >= 3) return { ...c, rows };
    }
    return null;
  }, [data, lang]);

  // Construit un classement (top 12) à partir d'un indicateur de contexte
  // chargé par syntheseApi : dernière valeur connue par territoire.
  const ctxRows = useCallback(
    (key) => {
      const ind = data && data[key];
      if (!ind || ind.status !== "live") return [];
      const last = latestOf(ind);
      return Object.entries(last)
        .filter(([area, v]) => isPict(area) && Number.isFinite(v) && v > 0)
        .map(([area, v]) => ({
          area,
          name: pictName(area, lang),
          value: Math.round(v * 10) / 10,
        }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 12);
    },
    [data, lang],
  );

  // Les quatre éclairages « synthèse » : cultures, bétail, fiscalité, élec.
  const cropsRows = useMemo(() => ctxRows("crops"), [ctxRows]);
  const livestockRows = useMemo(() => ctxRows("livestock"), [ctxRows]);
  const envtaxRows = useMemo(() => ctxRows("envtax"), [ctxRows]);
  const powerRows = useMemo(() => ctxRows("power"), [ctxRows]);


  // Rang d'émissions (0-100) sur l'ensemble des territoires notés — sert à
  // l'arc du paradoxe (responsabilité) et au renversement.
  const emiRank = useMemo(() => {
    const emi = latest.emissions || {};
    const pts = areas.filter((a) => Number.isFinite(emi[a]));
    return normalizeMap(pts.reduce((o, a) => ({ ...o, [a]: emi[a] }), {}));
  }, [areas, latest]);

  // L'arc du paradoxe : responsabilité (rang d'émissions) → vulnérabilité.
  const arcRows = useMemo(
    () =>
      areas
        .filter(
          (a) => Number.isFinite(emiRank[a]) && Number.isFinite(composite[a]),
        )
        .map((a) => ({
          code: a,
          name: pictName(a, lang),
          resp: Math.round(emiRank[a]),
          vuln: Math.round(composite[a]),
        })),
    [areas, emiRank, composite, lang],
  );

  // Croisement « effort vs empreinte » : émissions (X) × renouvelable (Y, %).
  const renewGroups = useMemo(() => {
    const emi = latest.emissions || {};
    const ren = latestOf(data && data.renew);
    const pal = {
      melanesia: tk.accent,
      polynesia: tk.warm,
      micronesia: tk.positive,
      other: tk.secondary,
    };
    return Object.keys(SUBREGIONS)
      .map((reg) => ({
        name: t(`act1.filter.${reg}`),
        color: pal[reg],
        points: areas
          .filter(
            (a) =>
              REGION_OF[a] === reg &&
              Number.isFinite(emi[a]) &&
              Number.isFinite(ren[a]),
          )
          .map((a) => ({
            x: Number(emi[a].toFixed(2)),
            y: Math.round(ren[a]),
            name: pictName(a, lang),
            code: a,
          })),
      }))
      .filter((g) => g.points.length);
  }, [areas, latest, data, lang, t, tk]);

  // Anneau de production : on affiche davantage de territoires que les autres
  // classements (jusqu'à 16), triés par volume décroissant.
  const powerRadialRows = useMemo(() => {
    const ind = data && data.power;
    if (!ind || ind.status !== "live") return [];
    const last = latestOf(ind);
    return Object.entries(last)
      .filter(([area, v]) => isPict(area) && Number.isFinite(v) && v > 0)
      .map(([area, v]) => ({
        code: area,
        area,
        name: pictName(area, lang),
        value: Math.round(v * 10) / 10,
      }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 16);
  }, [data, lang]);

  // Mix électrique du Pacifique dans le temps : aire empilée par source
  // (fossile en bas, renouvelable en haut), agrégée sur tous les territoires.
  const powerMixYears = useMemo(
    () => (powerMix.data && powerMix.data.years) || [],
    [powerMix],
  );
  const powerMixSeries = useMemo(() => {
    const d = powerMix.data;
    if (!d || d.source !== "live" || !d.detailSources || !d.detailSources.length)
      return [];
    const years = d.years || [];
    const colorFor = (kind, i, n) => {
      const hue = kind === "fossil" ? 18 : 162;
      const sat = kind === "fossil" ? 78 : 52;
      const light = 44 + (n > 1 ? (i / (n - 1)) * 24 : 0);
      return `hsl(${hue} ${sat}% ${light}%)`;
    };
    const build = (srcs, kind) =>
      srcs.map((s, i) => ({
        name: s.label,
        color: colorFor(kind, i, srcs.length),
        data: years.map((y) =>
          Object.values(d.byArea).reduce(
            (sum, a) =>
              sum + ((a.detail[s.label] && a.detail[s.label][y]) || 0),
            0,
          ),
        ),
      }));
    const fossils = d.detailSources.filter((s) => s.kind === "fossil");
    const renews = d.detailSources.filter((s) => s.kind === "renew");
    return [...build(fossils, "fossil"), ...build(renews, "renew")];
  }, [powerMix]);

  // Matrice de corrélation des stress : pour chaque paire d'indicateurs, on
  // corrèle les rangs percentiles sur les territoires où LES DEUX existent.
  const corr = useMemo(() => {
    const keys = activeVuln;
    if (keys.length < 3) return null;
    const labels = keys.map((k) => t(`act11.ind_${k}`));
    const vecs = keys.map((k) => normByInd[k] || {});
    const K = keys.length;
    const mat = [];
    const counts = [];
    for (let i = 0; i < K; i += 1) {
      mat[i] = [];
      counts[i] = [];
      for (let j = 0; j < K; j += 1) {
        if (i === j) {
          mat[i][j] = 1;
          counts[i][j] = null;
          continue;
        }
        const xs = [];
        const ys = [];
        Object.keys(vecs[i]).forEach((a) => {
          if (
            isPict(a) &&
            Number.isFinite(vecs[i][a]) &&
            Number.isFinite(vecs[j][a])
          ) {
            xs.push(vecs[i][a]);
            ys.push(vecs[j][a]);
          }
        });
        mat[i][j] = pearson(xs, ys);
        counts[i][j] = xs.length;
      }
    }
    return { labels, mat, counts };
  }, [activeVuln, normByInd, t]);

  // Ampleur du littoral par territoire (proxy : nb de segments de côte suivis).
  const coastOf = useMemo(() => {
    const m = {};
    COASTLINE_BY_TERRITORY.forEach((d) => {
      m[d.area] = d.n;
    });
    return m;
  }, []);

  // Bulles du paradoxe : X = émissions, Y = vulnérabilité, taille = littoral.
  const bubbleGroups = useMemo(() => {
    const emi = latest.emissions || {};
    const pal = {
      melanesia: tk.accent,
      polynesia: tk.warm,
      micronesia: tk.positive,
      other: tk.secondary,
    };
    return Object.keys(SUBREGIONS)
      .map((reg) => ({
        name: t(`act1.filter.${reg}`),
        color: pal[reg],
        points: areas
          .filter(
            (a) =>
              REGION_OF[a] === reg &&
              Number.isFinite(emi[a]) &&
              Number.isFinite(composite[a]) &&
              Number.isFinite(coastOf[a]),
          )
          .map((a) => ({
            x: Number(emi[a].toFixed(2)),
            y: Math.round(composite[a]),
            r: coastOf[a],
            name: pictName(a, lang),
            code: a,
          })),
      }))
      .filter((g) => g.points.length);
  }, [areas, latest, composite, coastOf, lang, t, tk]);

  // Portefeuille agricole : une entrée par produit. Taille = ubiquité (nb de
  // territoires qui le cultivent, mesure SANS unité, donc additionnable) ;
  // intensité = rendement médian normalisé par rang DANS sa catégorie (on ne
  // compare jamais des kg/ha à des kg/animal). Honnête par construction.
  const agriItems = useMemo(() => {
    const d = agriProd.data;
    if (!d || d.source !== "live" || !d.commodities) return [];
    const med = (arr) => {
      const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
      if (!a.length) return NaN;
      const m = Math.floor(a.length / 2);
      return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
    };
    const raw = d.commodities
      .map((c) => {
        const cd = d.byCommodity[c.code];
        if (!cd || !cd.areas) return null;
        const picts = cd.areas.filter((a) => isPict(a));
        const latestVals = picts
          .map((a) => {
            const sArr = cd.byArea[a];
            return sArr && sArr.length ? sArr[sArr.length - 1].value : NaN;
          })
          .filter(Number.isFinite);
        return {
          code: c.code,
          label: c.label,
          kind: c.kind,
          unit: c.unit,
          value: picts.length,
          yield: med(latestVals),
        };
      })
      .filter((it) => it && it.value > 0);
    // intensité = rang du rendement au sein de la même catégorie
    ["crop", "livestock"].forEach((k) => {
      const grp = raw
        .filter((it) => it.kind === k && Number.isFinite(it.yield))
        .sort((a, b) => a.yield - b.yield);
      const n = grp.length;
      grp.forEach((it, idx) => {
        it.intensity = n > 1 ? idx / (n - 1) : 0.6;
      });
    });
    raw.forEach((it) => {
      if (!Number.isFinite(it.intensity)) it.intensity = 0.5;
    });
    return raw.sort((a, b) => b.value - a.value).slice(0, 28);
  }, [agriProd]);

  // Classement des émissions/hab. par territoire (distribution réelle).
  const emiRankRows = useMemo(() => {
    const emi = latest.emissions || {};
    return areas
      .filter((a) => isPict(a) && Number.isFinite(emi[a]))
      .map((a) => ({ code: a, name: pictName(a, lang), value: emi[a] }));
  }, [areas, latest, lang]);

  const stats = useMemo(() => {
    const emi = latest.emissions || {};
    const pts = areas.filter((a) => Number.isFinite(emi[a]));
    if (pts.length < 3) return null;
    const yMed = medianY;
    const below = pts.filter(
      (a) => emi[a] < pacMed && composite[a] > yMed,
    ).length;
    const most = areas.reduce(
      (m, a) => (!m || composite[a] > composite[m] ? a : m),
      null,
    );
    const top = pts.reduce((m, a) => (!m || emi[a] > emi[m] ? a : m), null);
    return {
      pacMed: Math.round(pacMed * 10) / 10,
      topEmi: top ? Math.round(emi[top] * 10) / 10 : 0,
      topName: top ? pictName(top, lang) : "",
      below,
      total: pts.length,
      mostCode: most,
      mostName: most ? pictName(most, lang) : "",
      mostScore: most ? Math.round(composite[most]) : 0,
    };
  }, [areas, latest, pacMed, medianY, composite, lang]);

  const focusLine = useMemo(() => {
    if (!focus) return null;
    const sv = activeVuln
      .map((k) => ({ k, v: (normByInd[k] || {})[focus] ?? 0 }))
      .sort((a, b) => b.v - a.v)[0];
    return `${pictName(focus, lang)} — ${t("act11.story.focus_score")} ${Math.round(composite[focus] ?? 0)}/100${sv ? ` · ${t("act11.story.focus_driver")} ${t(`act11.ind_${sv.k}`)}` : ""}`;
  }, [focus, activeVuln, normByInd, composite, lang, t]);

  /* ---------- définition des scènes ---------- */
  const scenes = useMemo(() => {
    if (state.status !== "ready") return [];
    const list = [];

    // ── Ouverture ────────────────────────────────────────────────
    list.push({
      kind: "hero",
      eyebrow: t("act11.tag"),
      title: t("act11.title"),
      text: t("act11.thesis"),
    });
    list.push({
      kind: "recap",
      eyebrow: t("act11.story.voyage_k"),
      title: t("act11.story.voyage_title"),
      text: t("act11.story.voyage_text"),
    });

    // ── Mouvement 1 · LA CAUSE ───────────────────────────────────
    list.push({
      kind: "split",
      eyebrow: t("act11.mv.cause"),
      title: t("act11.story.resp_title"),
      text: t("act11.story.resp_text"),
      method: t("act11.story.resp_m"),
      stat: stats
        ? {
            value: stats.pacMed,
            suffix: ` ${t("act11.story.resp_unit")}`,
            label: t("act11.stat_emi_label"),
            tone: "positive",
          }
        : null,
      visual: (
        <EmissionsRank
          rows={emiRankRows}
          median={pacMed}
          unit={t("act11.scatter_x_unit")}
          medianLabel={t("act11.story.resp_pac")}
        />
      ),
    });

    // ── Mouvement 2 · LA CONSÉQUENCE ─────────────────────────────
    list.push({
      kind: "split",
      eyebrow: t("act11.mv.conseq"),
      title: t("act11.story.ocean_title"),
      text: t("act11.story.ocean_text"),
      method: t("act11.story.ocean_m"),
      visual: (
        <TrendChart
          series={seaTrend.series}
          years={seaTrend.years}
          unit={t("act11.story.sea_unit")}
          scale="lin"
        />
      ),
    });
    list.push({
      kind: "split",
      eyebrow: t("act11.story.atlas_k"),
      title: t("act11.story.atlas_title"),
      text: t("act11.story.atlas_text"),
      method: t("act11.story.atlas_m"),
      hint: t("act11.story.focus_hint"),
      visual: (
        <AtlasMap
          points={atlasPoints}
          satellite3d
          range={{ min: 0, max: 100 }}
          ramp={[tk.positive, tk.warm, tk.negative]}
          selected={focus}
          onSelect={(c) => setFocus((s) => (s === c ? null : c))}
          legendTitle={t("act11.studio.layer_composite")}
          lowLabel={t("act6.heatmap_low")}
          highLabel={t("act6.heatmap_high")}
          noTokenMsg={t("act1.map_no_token")}
        />
      ),
    });

    // ── Mouvement 3 · L'INJUSTICE ────────────────────────────────
    if (arcRows.length >= 3) {
      list.push({
        kind: "split",
        eyebrow: t("act11.mv.injustice"),
        title: t("act11.story.arc_title"),
        text: t("act11.story.arc_text"),
        method: t("act11.story.arc_m"),
        visual: (
          <ArcParadox
            rows={arcRows}
            respLabel={t("act11.arc.resp")}
            vulnLabel={t("act11.arc.vuln")}
            lowLabel={t("act11.arc.low")}
            highLabel={t("act11.arc.high")}
            upLabel={t("act11.arc.up")}
            downLabel={t("act11.arc.down")}
            gapLabel={t("act11.arc.gap")}
            hintLabel={t("act11.arc.hint")}
          />
        ),
      });
    }
    list.push({
      kind: "split",
      eyebrow: t("act11.story.paradox_k"),
      title: t("act11.story.paradox_title"),
      text: t("act11.story.paradox_text"),
      method: t("act11.story.paradox_m"),
      hint: t("act11.story.focus_hint"),
      visual: (
        <ParadoxScatterLive
          groups={scatterGroups}
          medianX={medianX}
          medianY={medianY}
          selected={focus}
          onSelect={(c) => setFocus((s) => (s === c ? null : c))}
          xName={t("act11.scatter_x_unit")}
          yName={t("act11.scatter_y")}
        />
      ),
    });
    if (bubbleGroups.length) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.bubble_k"),
        title: t("act11.story.bubble_title"),
        text: t("act11.story.bubble_text"),
        method: t("act11.story.bubble_m"),
        visual: (
          <BubblePlot
            groups={bubbleGroups}
            medianX={medianX}
            medianY={medianY}
            xName={t("act11.scatter_x_unit")}
            yName={t("act11.scatter_y")}
            sizeName={t("act11.bubble.size")}
            hintLabel={t("act11.bubble.hint")}
          />
        ),
      });
    }
    list.push({
      kind: "split",
      eyebrow: t("act11.story.reversal_k"),
      title: t("act11.story.reversal_title"),
      text: t("act11.story.reversal_text"),
      method: t("act11.story.reversal_m"),
      visual: (
        <SlopeChart
          rows={slopeRows}
          leftLabel={t("act11.story.reversal_left")}
          rightLabel={t("act11.story.reversal_right")}
          unit={t("act11.index_unit")}
          min={0}
          max={100}
        />
      ),
    });
    list.push({
      kind: "split",
      eyebrow: t("act11.story.radar_k"),
      title: t("act11.story.radar_title"),
      text: t("act11.story.radar_text"),
      method: t("act11.story.radar_m"),
      visual: (
        <ProfileRadar indicators={radarIndicators} series={radarSeries} />
      ),
    });
    if (matrixRows.length >= 3 && indLabels.length >= 3) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.parallel_k"),
        title: t("act11.story.parallel_title"),
        text: t("act11.story.parallel_text"),
        method: t("act11.story.parallel_m"),
        hint: t("act11.story.focus_hint"),
        visual: (
          <ParallelPlot
            rows={matrixRows}
            axes={indLabels}
            hiLabel={t("act11.parallel.hi")}
            loLabel={t("act11.parallel.lo")}
            hintLabel={t("act11.parallel.hint")}
          />
        ),
      });
    }
    list.push({
      kind: "split",
      eyebrow: t("act11.story.matrix_k"),
      title: t("act11.story.matrix_title"),
      text: t("act11.story.matrix_text"),
      method: t("act11.story.matrix_m"),
      hint: t("act11.story.focus_hint"),
      visual: (
        <VulnMatrix
          rows={matrixRows}
          inds={indLabels}
          selected={focus}
          onSelect={(c) => setFocus((s) => (s === c ? null : c))}
          unit={t("act11.index_unit")}
        />
      ),
    });
    if (corr) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.corr_k"),
        title: t("act11.story.corr_title"),
        text: t("act11.story.corr_text"),
        method: t("act11.story.corr_m"),
        visual: (
          <Correlogram
            labels={corr.labels}
            matrix={corr.mat}
            counts={corr.counts}
            posLabel={t("act11.corr.pos")}
            negLabel={t("act11.corr.neg")}
            hintLabel={t("act11.corr.hint")}
          />
        ),
      });
    }
    list.push({
      kind: "split",
      eyebrow: t("act11.story.swarm_k"),
      title: t("act11.story.swarm_title"),
      text: t("act11.story.swarm_text"),
      method: t("act11.story.swarm_m"),
      hint: t("act11.story.focus_hint"),
      visual: (
        <StressSwarm
          rows={matrixRows}
          axes={indLabels}
          searchLabel={t("act11.swarm.search")}
          hintLabel={t("act11.swarm.hint")}
        />
      ),
    });
    list.push({
      kind: "split",
      eyebrow: t("act11.story.top_k"),
      title: t("act11.story.top_title"),
      text: t("act11.story.top_text"),
      method: t("act11.story.top_m"),
      visual: (
        <Lollipop
          rows={topExposed}
          unit={t("act11.index_unit")}
          betterWhen="low"
          axisMax={100}
        />
      ),
    });

    // ── Mouvement 4 · LA RÉPONSE ─────────────────────────────────
    if (renewGroups.length) {
      list.push({
        kind: "split",
        eyebrow: t("act11.mv.reponse"),
        title: t("act11.story.renew2_title"),
        text: t("act11.story.renew2_text"),
        method: t("act11.story.renew2_m"),
        visual: (
          <ParadoxScatterLive
            groups={renewGroups}
            medianX={medianX}
            medianY={50}
            worldRef={null}
            xName={t("act11.scatter_x_unit")}
            yName={t("act11.story.renew2_y")}
          />
        ),
      });
    }
    if (powerMixSeries.length) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.mix_k"),
        title: t("act11.story.mix_t"),
        text: t("act11.story.mix_x"),
        method: t("act11.story.mix_m"),
        visual: (
          <StreamMix
            series={powerMixSeries}
            years={powerMixYears}
            unit={t("act11.ctx_unit_gwh")}
            hintLabel={t("act11.story.mix_hint")}
            shareLabel={t("act11.story.mix_share")}
          />
        ),
      });
    }
    if (contextRecap) {
      list.push({
        kind: "split",
        eyebrow: t(contextRecap.eyebrowKey),
        title: t(contextRecap.titleKey),
        text: t(contextRecap.textKey),
        method: t(contextRecap.methodKey),
        visual: (
          <Lollipop
            rows={contextRecap.rows}
            unit={t(contextRecap.unitKey)}
            betterWhen={contextRecap.better}
          />
        ),
      });
    }
    if (agriItems.length >= 4) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.agri_k"),
        title: t("act11.story.agri_t"),
        text: t("act11.story.agri_x"),
        method: t("act11.story.agri_m"),
        visual: (
          <Treemap
            items={agriItems}
            cropLabel={t("act11.agri.crop")}
            stockLabel={t("act11.agri.stock")}
            sizeLabel={t("act11.agri.size")}
            yieldLabel={t("act11.agri.yield")}
            hintLabel={t("act11.agri.hint")}
          />
        ),
      });
    }
    if (cropsRows.length >= 3) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.crops_k"),
        title: t("act11.story.crops_t"),
        text: t("act11.story.crops_x"),
        method: t("act11.story.crops_m"),
        visual: (
          <Lollipop rows={cropsRows} unit={t("act11.ctx_unit_kgha")} betterWhen="high" />
        ),
      });
    }
    if (livestockRows.length >= 3) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.stock_k"),
        title: t("act11.story.stock_t"),
        text: t("act11.story.stock_x"),
        method: t("act11.story.stock_m"),
        visual: (
          <Lollipop rows={livestockRows} unit={t("act11.ctx_unit_kganim")} betterWhen="high" />
        ),
      });
    }
    if (envtaxRows.length >= 3) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.envtax2_k"),
        title: t("act11.story.envtax2_t"),
        text: t("act11.story.envtax2_x"),
        method: t("act11.story.envtax2_m"),
        visual: (
          <Lollipop rows={envtaxRows} unit={t("act11.ctx_unit_gdp")} betterWhen="high" />
        ),
      });
    }
    if (powerRows.length >= 3) {
      list.push({
        kind: "split",
        eyebrow: t("act11.story.power_k"),
        title: t("act11.story.power_t"),
        text: t("act11.story.power_x"),
        method: t("act11.story.power_m"),
        visual: (
          <RadialRank
            rows={powerRadialRows}
            unit={t("act11.ctx_unit_gwh")}
            centerLabel={t("act11.story.power_center")}
            hintLabel={t("act11.radial.hint")}
          />
        ),
      });
    }
    list.push({
      kind: "split",
      eyebrow: t("act11.story.studio_k"),
      title: t("act11.story.studio_title"),
      text: t("act11.story.studio_text"),
      method: t("act11.story.studio_m"),
      hint: t("act11.story.studio_hint"),
      visual: (
        <WeightStudio
          inds={activeVuln.map((k) => ({ k, label: t(`act11.ind_${k}`) }))}
          weights={weights}
          onChange={setWeight}
          onReset={resetWeights}
          labels={{ reset: t("act11.story.studio_reset") }}
        />
      ),
    });

    // ── Verdict ──────────────────────────────────────────────────
    list.push({
      kind: "verdict",
      eyebrow: t("act11.outro.kicker"),
      title: t("act11.outro.title"),
      text: t("act11.outro.text"),
    });
    return list;
  }, [
    state.status,
    t,
    stats,
    pacMed,
    emiRankRows,
    tk,
    seaTrend,
    atlasPoints,
    focus,
    radarIndicators,
    radarSeries,
    matrixRows,
    indLabels,
    scatterGroups,
    medianX,
    medianY,
    activeVuln,
    weights,
    setWeight,
    resetWeights,
    slopeRows,
    topExposed,
    contextRecap,
    cropsRows,
    livestockRows,
    envtaxRows,
    powerRows,
    arcRows,
    renewGroups,
    powerRadialRows,
    powerMixSeries,
    powerMixYears,
    corr,
    bubbleGroups,
    agriItems,
  ]);

  const total = scenes.length;
  const go = useCallback(
    (d) => setIdx((i) => Math.min(Math.max(i + d, 0), Math.max(total - 1, 0))),
    [total],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // transition d'entrée de scène
  const animRef = useRef(null);
  useEffect(() => {
    if (state.status !== "ready" || !animRef.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.from(".scene__anim", {
        y: 26,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: "power2.out",
      });
    }, animRef);
    return () => ctx.revert();
  }, [idx, state.status]);

  const retry = useCallback(() => {
    setState({ status: "loading", data: null });
    fetchSynthese({ lang }).then((res) =>
      setState({
        status: res.source === "live" ? "ready" : "empty",
        data: res,
      }),
    );
  }, [lang]);

  if (state.status === "loading")
    return <Loader fullscreen label={t("scene.loading")} />;
  if (state.status === "empty")
    return (
      <main className="story story--state">
        <p className="story__err">{t("act11.unavailable")}</p>
        <button type="button" className="story__retry" onClick={retry}>
          {t("act1.retry")}
        </button>
      </main>
    );

  const sc = scenes[idx] || scenes[0];

  return (
    <main className="story">
      {/* progression */}
      <div className="story__progress" aria-hidden="true">
        {scenes.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`story__seg ${i === idx ? "is-active" : ""} ${i < idx ? "is-done" : ""}`}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>

      <section className={`scene scene--${sc.kind}`} ref={animRef} key={idx}>
        {sc.kind === "hero" && (
          <SynthHero
            eyebrow={sc.eyebrow}
            title={sc.title}
            text={sc.text}
            ctaLabel={t("act11.story.start")}
            onStart={() => go(1)}
          />
        )}

        {sc.kind === "recap" && (
          <ActsRecap
            eyebrow={sc.eyebrow}
            title={sc.title}
            text={sc.text}
            items={[
              ...ACTS.map((n) => ({
                num: String(n).padStart(2, "0"),
                name: t(`act11.story.recap_a${n}`),
              })),
              { num: "11", name: t("act11.story.recap_a11"), current: true },
            ]}
          />
        )}

        {sc.kind === "split" && (
          <div className="scene__split">
            <div className="scene__narr">
              <p className="scene__eyebrow scene__anim">{sc.eyebrow}</p>
              <h2 className="scene__title scene__anim">{sc.title}</h2>
              <p className="scene__text scene__anim">{sc.text}</p>
              {sc.stat ? (
                <div className="scene__stat scene__anim">
                  <Kpi
                    value={sc.stat.value}
                    prefix={sc.stat.prefix || ""}
                    suffix={sc.stat.suffix || ""}
                    label={sc.stat.label}
                    tone={sc.stat.tone}
                  />
                </div>
              ) : null}
              {sc.hint ? (
                <p className="scene__hint scene__anim">
                  {focusLine || sc.hint}
                </p>
              ) : null}
              {sc.method ? (
                <p className="scene__method scene__anim">{sc.method}</p>
              ) : null}
            </div>
            <div className="scene__visual scene__anim">{sc.visual}</div>
          </div>
        )}

        {sc.kind === "verdict" && (
          <VerdictPanel
            eyebrow={sc.eyebrow}
            title={sc.title}
            text={sc.text}
            stats={
              stats
                ? [
                    {
                      value: stats.pacMed,
                      suffix: ` ${t("act11.story.resp_unit")}`,
                      label: t("act11.stat_emi_label"),
                      tone: "positive",
                    },
                    {
                      value: stats.mostScore,
                      suffix: "/100",
                      label: `${t("act11.stat_vuln_label")} · ${stats.mostName}`,
                      tone: "negative",
                    },
                    {
                      value: stats.below,
                      label: `${t("act11.stat_inj_label")} (${t("act11.studio.on")} ${stats.total})`,
                      tone: "accent",
                    },
                    {
                      value: activeVuln.length + 1,
                      label: t("act11.studio.kpi_ds"),
                      tone: "positive",
                    },
                  ]
                : []
            }
            limitsKicker={t("act11.story.limits_k")}
            limits={[
              t("act11.story.limits_1"),
              t("act11.story.limits_2"),
              t("act11.story.limits_3"),
              t("act11.story.limits_4"),
            ]}
            primary={{ to: "/", label: t("act11.outro.next") }}
            secondary={{ to: "/emissions", label: t("act11.outro.home") }}
          />
        )}
      </section>

      {/* navigation */}
      <nav className="story__nav">
        <button
          type="button"
          className="story__navbtn"
          onClick={() => go(-1)}
          disabled={idx === 0}
        >
          <span aria-hidden="true">‹</span> {t("act11.story.prev")}
        </button>
        <span className="story__count">
          {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="story__navbtn story__navbtn--next"
          onClick={() => go(1)}
          disabled={idx === total - 1}
        >
          {t("act11.story.next")} <span aria-hidden="true">›</span>
        </button>
      </nav>
    </main>
  );
}