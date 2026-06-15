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
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchSynthese } from "../../services/syntheseApi";
import PICT_GEO from "../../data/pictGeo";
import Loader from "../../components/Loader/Loader";
import AtlasMap from "../../components/AtlasMap/AtlasMap";
import ParadoxScatterLive from "../../components/charts/PardoxScatterLive";
import VulnMatrix from "../../components/charts/VulnMatrix";
import ProfileRadar from "../../components/charts/ProfileRadar";
import TrendChart from "../../components/charts/TrendChart";
import BeeswarmChart from "../../components/BeeswarmChart/BeeswarmChart";
import SlopeChart from "../../components/charts/SlopeChart";
import RankBars from "../../components/RankBars/RankBars";
import ArcParadox from "../../components/charts/ArcParadox/ArcParadox";
import RadialRank from "../../components/charts/RadialRank/RadialRank";
import StreamMix from "../../components/charts/StreamMix/StreamMix";
import { fetchPowerMix } from "../../services/powerApi";
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
function VersusBar({ rows = [], unit = "" }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <div className="vbar">
      {rows.map((r) => (
        <div key={r.label} className="vbar__row">
          <span className="vbar__label">{r.label}</span>
          <div className="vbar__track">
            <span
              className="vbar__fill"
              style={{
                "--vbar-w": `${Math.max((r.value / max) * 100, 2)}%`,
                "--vbar-bg": r.color,
              }}
            />
          </div>
          <span className="vbar__val">
            {r.value.toFixed(2)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

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

export default function Act11Synthese() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [state, setState] = useState({ status: "loading", data: null });
  const [idx, setIdx] = useState(0);
  const [focus, setFocus] = useState(null);
  const [powerMix, setPowerMix] = useState({ status: "idle", data: null });
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
  const beeData = useMemo(
    () =>
      areas
        .map((a) => ({
          area: a,
          code: a,
          name: pictName(a, lang),
          value: composite[a],
        }))
        .filter((d) => Number.isFinite(d.value)),
    [areas, composite, lang],
  );

  // 2) Top des plus exposés (indice composite), barres radiales.
  const topExposed = useMemo(
    () =>
      areas
        .map((a) => ({ name: pictName(a, lang), value: Math.round(composite[a] ?? 0) }))
        .filter((r) => Number.isFinite(r.value))
        .sort((x, y) => y.value - x.value),
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
        <VersusBar
          unit={t("act11.scatter_x_unit")}
          rows={[
            {
              label: t("act11.story.resp_pac"),
              value: pacMed,
              color: tk.positive,
            },
            {
              label: stats ? stats.topName : "",
              value: stats ? stats.topEmi : 0,
              color: tk.warm,
            },
          ]}
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
    list.push({
      kind: "split",
      eyebrow: t("act11.story.swarm_k"),
      title: t("act11.story.swarm_title"),
      text: t("act11.story.swarm_text"),
      method: t("act11.story.swarm_m"),
      hint: t("act11.story.focus_hint"),
      visual: (
        <BeeswarmChart
          data={beeData}
          unit={t("act11.index_unit")}
          worldAvg={null}
          defaultLog={false}
          scaleLabels={{
            log: t("act11.story.swarm_log"),
            lin: t("act11.story.swarm_lin"),
          }}
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
        <RankBars data={topExposed} unit={t("act11.index_unit")} betterWhen="low" />
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
          <RankBars
            data={contextRecap.rows}
            unit={t(contextRecap.unitKey)}
            betterWhen={contextRecap.better}
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
          <RankBars data={cropsRows} unit={t("act11.ctx_unit_kgha")} betterWhen="high" />
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
          <RankBars data={livestockRows} unit={t("act11.ctx_unit_kganim")} betterWhen="high" />
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
          <RankBars data={envtaxRows} unit={t("act11.ctx_unit_gdp")} betterWhen="high" />
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
    beeData,
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
          <div className="scene__hero">
            <p className="scene__eyebrow scene__anim">{sc.eyebrow}</p>
            <h1 className="scene__hero-title scene__anim">{sc.title}</h1>
            <p className="scene__hero-text scene__anim">{sc.text}</p>
            <button
              type="button"
              className="scene__start scene__anim"
              onClick={() => go(1)}
            >
              {t("act11.story.start")}
            </button>
          </div>
        )}

        {sc.kind === "recap" && (
          <div className="scene__recap">
            <header className="scene__recap-head scene__anim">
              <p className="scene__eyebrow">{sc.eyebrow}</p>
              <h2 className="scene__title">{sc.title}</h2>
              <p className="scene__text">{sc.text}</p>
            </header>
            <ol className="scene__acts">
              {ACTS.map((n) => (
                <li key={n} className="scene__act scene__anim">
                  <span className="scene__act-num">
                    {String(n).padStart(2, "0")}
                  </span>
                  <span className="scene__act-name">
                    {t(`act11.story.recap_a${n}`)}
                  </span>
                </li>
              ))}
              <li className="scene__act scene__act--final scene__anim">
                <span className="scene__act-num">11</span>
                <span className="scene__act-name">
                  {t("act11.story.recap_a11")}
                </span>
              </li>
            </ol>
          </div>
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
          <div className="scene__verdict">
            <p className="scene__eyebrow scene__anim">{sc.eyebrow}</p>
            <h2 className="scene__verdict-title scene__anim">{sc.title}</h2>
            <p className="scene__hero-text scene__anim">{sc.text}</p>
            {stats ? (
              <div className="scene__kpis scene__anim">
                <Kpi
                  value={stats.pacMed}
                  suffix={` ${t("act11.story.resp_unit")}`}
                  label={t("act11.stat_emi_label")}
                  tone="positive"
                />
                <Kpi
                  value={stats.mostScore}
                  suffix="/100"
                  label={`${t("act11.stat_vuln_label")} · ${stats.mostName}`}
                  tone="negative"
                />
                <Kpi
                  value={stats.below}
                  label={`${t("act11.stat_inj_label")} (${t("act11.studio.on")} ${stats.total})`}
                  tone="accent"
                />
                <Kpi
                  value={activeVuln.length + 1}
                  label={t("act11.studio.kpi_ds")}
                  tone="positive"
                />
              </div>
            ) : null}
            <div className="scene__limits scene__anim">
              <p className="scene__limits-kicker">{t("act11.story.limits_k")}</p>
              <ul className="scene__limits-list">
                <li>{t("act11.story.limits_1")}</li>
                <li>{t("act11.story.limits_2")}</li>
                <li>{t("act11.story.limits_3")}</li>
                <li>{t("act11.story.limits_4")}</li>
              </ul>
            </div>
            <div className="scene__links scene__anim">
              <Link to="/" className="scene__cta scene__cta--primary">
                {t("act11.outro.next")}
              </Link>
              <Link to="/emissions" className="scene__cta">
                {t("act11.outro.home")}
              </Link>
            </div>
          </div>
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