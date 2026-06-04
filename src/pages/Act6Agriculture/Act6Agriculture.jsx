// src/pages/Act6Agriculture/Act6Agriculture.jsx
// ============================================================
// Acte 06 — L'assiette. « La terre nourricière sous pression. »
// UNE seule source réelle : le jeu DÉSAGRÉGÉ (agriApi). À partir de lui :
//   • Sous-acte 1 : AGRÉGÉ calculé par nous = rendement MÉDIAN par
//     territoire, toutes cultures confondues (kg/ha) → couverture complète,
//     pas de série corrompue. (On n'utilise plus l'indicateur SPC
//     A.CROP_YIELD. qui était limité à 4 territoires et bruité.)
//   • Explorateur par culture (icônes) sur la même donnée (pas de 2e appel).
// 100 % données API — l'agrégat est une médiane de valeurs réelles, rien
// n'est inventé.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchAgriProduction } from "../../services/agriApi";
import useThemeTokens from "../../hooks/UseThemeTokens";
import VizPanel from "../../components/charts/VizPanel";
import BoxplotChart from "../../components/charts/BoxplotChart";
import ScatterChart from "../../components/charts/ScatterChart";
import TreemapChart from "../../components/charts/TreemapChart";
import CropHeatmap from "../../components/charts/CropHeatmap";
import RadarProfileChart from "../../components/charts/RadarProfileChart";
import SmallMultiples from "../../components/SmallMultiples/SmallMultiples";
import CropRanking from "../../components/CropRanking/CropRanking";
import DumbbellChart from "../../components/DumbbellChart/DumbbellChart";
import TrendLines from "../../components/TrendLines/TrendLines";
import RankBars from "../../components/RankBars/RankBars";
import EmissionsHeatmap from "../../components/EmissionsHeatmap/EmissionsHeatmap";
import ChangeBars from "../../components/ChangeBars/ChangeBars";
import DataTable from "../../components/DataTable/DataTable";
import CropExplorer from "../../components/CropExplorer/CropExplorer";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import "./Act6Agriculture.scss";

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

// Agrégat calculé : rendement MÉDIAN par territoire-année pour un type donné
// ("crop" = cultures kg/ha, "livestock" = bétail kg/animal).
function buildAggregate(data, kind = "crop") {
  if (!data || !data.commodities) return null;
  const codes = data.commodities.filter((c) => c.kind === kind).map((c) => c.code);
  const bucket = {}; // geo -> year -> [values]
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
    range: { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max },
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

function Pills({ label, options, value, onChange }) {
  return (
    <div className="act1f" role="group" aria-label={label}>
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__pills">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            className={`act1f__pill ${value === o.v ? "is-active" : ""}`}
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
          >
            {o.label}
          </button>
        ))}
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

function Selecter({ label, value, options, onChange }) {
  return (
    <label className="act1f act1f--select">
      <span className="act1f__lbl">{label}</span>
      <select
        className="act1f__select"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={String(o.v)} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Act6Agriculture() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();
  const [agri, setAgri] = useState({ status: "loading", data: null });
  const [region, setRegion] = useState("all");
  const [yearIdx, setYearIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [rankScope, setRankScope] = useState("all");
  const [cmpA, setCmpA] = useState(null);
  const [cmpB, setCmpB] = useState(null);
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const activeRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    // On garde les données affichées pendant le rechargement (changement de
    // langue) pour éviter un flash de chargement.
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

  const agg = useMemo(() => (agri.data ? buildAggregate(agri.data) : null), [agri.data]);

  const years = useMemo(() => agg?.years || [], [agg]);
  useEffect(() => {
    if (years.length && yearIdx === null) setYearIdx(years.length - 1);
  }, [years, yearIdx]);
  const currentYear = years.length && yearIdx != null ? years[yearIdx] : null;

  useEffect(() => {
    if (years.length && cmpA == null) setCmpA(years[0]);
    if (years.length && cmpB == null) setCmpB(years[years.length - 1]);
  }, [years, cmpA, cmpB]);

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

  const areaVisible = useCallback(
    (a) => region === "all" || REGION_OF[a] === region,
    [region],
  );

  const vSeries = useMemo(
    () => allSeries(agg, lang).filter((s) => areaVisible(s.area) && s.values.length),
    [agg, lang, areaVisible],
  );
  const points = useMemo(
    () =>
      (agg && currentYear != null ? pointsAt(agg, currentYear, lang) : []).filter((p) =>
        areaVisible(p.area),
      ),
    [agg, currentYear, lang, areaVisible],
  );
  const refMedian = useMemo(() => median(points.map((p) => p.value)) ?? 0, [points]);

  const changeRows = useMemo(
    () =>
      vSeries
        .filter((s) => s.values.length >= 2)
        .map((s) => {
          const f = s.values[0];
          const l = s.values[s.values.length - 1];
          return { area: s.area, name: s.name, delta: l.value - f.value, first: f.value, last: l.value };
        }),
    [vSeries],
  );

  const rankCountries = useMemo(() => {
    if (!agri.data) return [];
    const set = new Set();
    (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .forEach((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return;
        d.areas.filter(isPict).forEach((a) => {
          if ((d.byArea[a] || []).some((p) => Number.isFinite(p.value))) set.add(a);
        });
      });
    return [...set]
      .map((a) => ({ code: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [agri.data, lang]);

  const cropRankRows = useMemo(() => {
    if (!agri.data || currentYear == null) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        let vals;
        if (rankScope === "all") {
          vals = d.areas
            .filter((a) => isPict(a) && areaVisible(a))
            .map((a) => (d.byArea[a] || []).find((p) => p.year === currentYear))
            .filter((p) => p && Number.isFinite(p.value))
            .map((p) => p.value);
        } else {
          const p = (d.byArea[rankScope] || []).find((q) => q.year === currentYear);
          vals = p && Number.isFinite(p.value) ? [p.value] : [];
        }
        if (!vals.length) return null;
        return { code: c.code, label: c.label, value: median(vals), year: currentYear };
      })
      .filter(Boolean);
  }, [agri.data, currentYear, areaVisible, rankScope]);

  const dumbbellRows = useMemo(() => {
    if (!agg || cmpA == null || cmpB == null) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area))
      .map((s) => {
        const pa = s.values.find((p) => p.year === cmpA);
        const pb = s.values.find((p) => p.year === cmpB);
        return pa && pb && Number.isFinite(pa.value) && Number.isFinite(pb.value)
          ? { area: s.area, name: s.name, a: pa.value, b: pb.value }
          : null;
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible, cmpA, cmpB]);

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

  const diversityRows = useMemo(() => {
    if (!agri.data || !agg) return [];
    const counts = {};
    (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .forEach((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return;
        d.areas.filter(isPict).forEach((a) => {
          if ((d.byArea[a] || []).some((p) => Number.isFinite(p.value)))
            counts[a] = (counts[a] || 0) + 1;
        });
      });
    return Object.entries(counts)
      .map(([area, value]) => ({ area, name: pictName(area, lang), value, year: agg.lastYear }))
      .filter((r) => areaVisible(r.area));
  }, [agri.data, agg, lang, areaVisible]);
  const diversityMedian = useMemo(
    () => median(diversityRows.map((r) => r.value)) ?? 0,
    [diversityRows],
  );

  const volatilityRows = useMemo(() => {
    if (!agg) return [];
    return allSeries(agg, lang)
      .filter((s) => areaVisible(s.area) && s.values.length >= 3)
      .map((s) => {
        const xs = s.values.map((p) => p.value);
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
        if (!mean) return null;
        const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
        const cv = (Math.sqrt(variance) / mean) * 100;
        return { area: s.area, name: s.name, value: Math.round(cv * 10) / 10, year: agg.lastYear };
      })
      .filter(Boolean);
  }, [agg, lang, areaVisible]);
  const volatilityMedian = useMemo(
    () => median(volatilityRows.map((r) => r.value)) ?? 0,
    [volatilityRows],
  );

  // ---------- Données des panneaux ApexCharts ajoutés ----------
  const REGION_COLOR = useMemo(
    () => ({ melanesia: tk.accent, polynesia: tk.warm, micronesia: tk.positive }),
    [tk],
  );
  const REGIONS3 = ["melanesia", "polynesia", "micronesia"];

  // Scatter : diversité (nb de cultures) × rendement médian, par sous-région.
  const scatterGroups = useMemo(() => {
    if (!diversityRows.length || !points.length) return [];
    const divBy = {};
    diversityRows.forEach((r) => {
      divBy[r.area] = r.value;
    });
    const yieldBy = {};
    points.forEach((p) => {
      yieldBy[p.area] = p.value;
    });
    return REGIONS3.map((r) => {
      const pts = Object.keys(yieldBy)
        .filter((a) => REGION_OF[a] === r && divBy[a] != null)
        .map((a) => ({ x: divBy[a], y: yieldBy[a], name: pictName(a, lang) }));
      return { name: t(`act1.filter.${r}`), color: REGION_COLOR[r], points: pts };
    }).filter((g) => g.points.length);
  }, [diversityRows, points, lang, t, REGION_COLOR]);
  const scatterMedianX = useMemo(
    () => median(scatterGroups.flatMap((g) => g.points.map((p) => p.x))) ?? 0,
    [scatterGroups],
  );

  // Treemap : rendement médian par culture (territoires visibles, année courante).
  const cropMedians = useMemo(() => {
    if (!agri.data || currentYear == null) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        const vals = d.areas
          .filter((a) => isPict(a) && areaVisible(a))
          .map((a) => (d.byArea[a] || []).find((p) => p.year === currentYear))
          .filter((p) => p && Number.isFinite(p.value))
          .map((p) => p.value);
        if (!vals.length) return null;
        return { name: c.label, value: median(vals) };
      })
      .filter(Boolean);
  }, [agri.data, currentYear, areaVisible]);

  // Heatmap culture × territoire (année courante), normalisée par culture.
  const cropHeatRows = useMemo(() => {
    if (!agri.data || currentYear == null) return [];
    const areas = points.map((p) => p.area); // territoires visibles avec donnée
    if (!areas.length) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === "crop")
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        const raws = areas.map((a) => {
          const p = (d.byArea[a] || []).find((q) => q.year === currentYear);
          return p && Number.isFinite(p.value) ? p.value : null;
        });
        const present = raws.filter((v) => v != null);
        if (present.length < 3) return null; // ligne trop creuse
        const mx = Math.max(...present);
        const cells = areas.map((a, i) => ({
          x: pictName(a, lang),
          y: raws[i] == null ? null : Math.round((raws[i] / (mx || 1)) * 100),
          raw: raws[i],
        }));
        return { name: c.label, cells, coverage: present.length };
      })
      .filter(Boolean)
      .sort((a, b) => b.coverage - a.coverage)
      .slice(0, 12);
  }, [agri.data, currentYear, points, lang]);

  // Radar régional : profil multi-cultures par sous-région (normalisé par culture).
  const cropRadar = useMemo(() => {
    if (!agri.data || currentYear == null) return { categories: [], series: [] };
    const crops = (agri.data.commodities || []).filter((c) => c.kind === "crop");
    const regionMedian = (code, region) => {
      const d = agri.data.byCommodity[code];
      if (!d) return null;
      const vals = d.areas
        .filter((a) => isPict(a) && REGION_OF[a] === region && areaVisible(a))
        .map((a) => (d.byArea[a] || []).find((p) => p.year === currentYear))
        .filter((p) => p && Number.isFinite(p.value))
        .map((p) => p.value);
      return vals.length ? median(vals) : null;
    };
    // Cultures les mieux couvertes (présentes dans le plus de régions).
    const scored = crops
      .map((c) => {
        const byReg = {};
        let cover = 0;
        REGIONS3.forEach((r) => {
          const m = regionMedian(c.code, r);
          if (m != null) {
            byReg[r] = m;
            cover += 1;
          }
        });
        return { c, byReg, cover };
      })
      .filter((s) => s.cover >= 2)
      .sort((a, b) => b.cover - a.cover)
      .slice(0, 7);
    if (scored.length < 3) return { categories: [], series: [] };
    const categories = scored.map((s) => s.c.label);
    const series = REGIONS3.map((r) => ({
      name: t(`act1.filter.${r}`),
      data: scored.map((s) => {
        const mx = Math.max(...Object.values(s.byReg));
        const v = s.byReg[r];
        return v == null ? 0 : Math.round((v / (mx || 1)) * 100);
      }),
    })).filter((s) => s.data.some((v) => v > 0));
    return { categories, series };
  }, [agri.data, currentYear, areaVisible, t]);

  const lsAgg = useMemo(
    () => (agri.data ? buildAggregate(agri.data, "livestock") : null),
    [agri.data],
  );
  const lsUnit = t("act6.livestock_unit");
  const lsSeries = useMemo(
    () => allSeries(lsAgg, lang).filter((s) => areaVisible(s.area) && s.values.length),
    [lsAgg, lang, areaVisible],
  );
  const lsRankRows = useMemo(() => {
    if (!agri.data || !lsAgg || lsAgg.lastYear == null) return [];
    return (agri.data.commodities || [])
      .filter((c) => c.kind === "livestock")
      .map((c) => {
        const d = agri.data.byCommodity[c.code];
        if (!d) return null;
        const vals = d.areas
          .filter((a) => isPict(a) && areaVisible(a))
          .map((a) => (d.byArea[a] || []).find((p) => p.year === lsAgg.lastYear))
          .filter((p) => p && Number.isFinite(p.value))
          .map((p) => p.value);
        if (!vals.length) return null;
        return { code: c.code, label: c.label, value: median(vals), year: lsAgg.lastYear };
      })
      .filter(Boolean);
  }, [agri.data, lsAgg, areaVisible]);

  const unit = t("act6.unit");
  const fmtKg = useCallback(
    (v) => Math.round(Number(v) || 0).toLocaleString(lang === "en" ? "en-US" : "fr-FR"),
    [lang],
  );
  const tableLabels = useMemo(
    () => ({
      col_rank: t("export.col_rank"),
      col_code: t("export.col_code"),
      col_name: t("export.col_name"),
      col_value: `${t("act6.value_label")} (${unit})`,
      col_vs_world: t("act6.vs_median"),
    }),
    [t, unit],
  );

  const retry = useCallback(() => {
    setAgri({ status: "loading", data: null });
    setYearIdx(null);
    fetchAgriProduction({ lang }).then((res) => {
      const ok = res.source === "live" && res.commodities.length;
      setAgri({ status: ok ? "ready" : "empty", data: ok ? res : null });
    });
  }, [lang]);

  const togglePlay = useCallback(() => {
    setYearIdx((i) => (i === years.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [years.length]);

  const scrubYear = useCallback((i) => {
    setPlaying(false);
    setYearIdx(i);
  }, []);

  const goTo = useCallback((i) => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll(".act1slide"));
    if (!nodes.length) return;
    const idx = Math.max(0, Math.min(nodes.length - 1, i));
    const top = nodes[idx].getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (agri.status !== "ready") return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const compute = () => {
      const nodes = Array.from(root.querySelectorAll(".act1slide"));
      setSlideCount(nodes.length);
      const mid = window.innerHeight * 0.4;
      let idx = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        const r = nodes[i].getBoundingClientRect();
        if (r.top <= mid) idx = i;
        else break;
      }
      setActive(idx);
      activeRef.current = idx;
    };
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [agri.status, region, currentYear, lang]);

  useEffect(() => {
    if (agri.status !== "ready") return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(activeRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agri.status, goTo]);

  // --- Fragments de filtres réutilisables ---
  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const scopeOpts = [{ v: "all", label: t("act6.crop_rank_scope_all") }].concat(
    rankCountries.map((c) => ({ v: c.code, label: c.name })),
  );
  const yearOpts = years.map((y) => ({ v: String(y), label: String(y) }));

  const regionPills = (
    <Pills label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
  );
  const regionAndYear = (
    <>
      {regionPills}
      <YearSlider label={t("act1.f.year")} years={years} index={yearIdx} onChange={scrubYear} />
    </>
  );

  return (
    <main className="act1 act6" ref={rootRef}>
      <div className="container">
        <header className="act1__head act1slide act1slide--intro">
          <p className="eyebrow">{t("act6.tag")}</p>
          <h1 className="act1__title">{t("act6.title")}</h1>
          <p className="act1__lead">{t("act6.lead")}</p>
        </header>

        {agri.status === "loading" && <Loader fullscreen label={t("scene.loading")} />}
        {agri.status === "empty" && (
          <div className="act1__state act1__state--err">
            <span>{t("act6.unavailable")}</span>
            <button className="act1__retry" onClick={retry}>
              {t("act1.retry")}
            </button>
          </div>
        )}

        {agri.status === "ready" && currentYear != null && (
          <>
            {/* ---------- Sous-acte 1 : la terre ---------- */}
            <section className="act1slide act1text">
              <div className="act1text__inner">
                <h2 className="act1text__title">{t("act6.sub1_title")}</h2>
                <p className="act1text__lead">{t("act6.sub1_sub")}</p>
                <span className="act1text__hint" aria-hidden="true">↓</span>
              </div>
            </section>

            <VizPanel title={t("act6.trend_title")} subtitle={t("act6.trend_sub")} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <SmallMultiples series={vSeries} years={years} unit={unit} currentYear={currentYear} labels={{ last: t("act6.smallmult_last") }} />
            </VizPanel>

            <VizPanel title={t("act6.heatmap_title")} subtitle={t("act6.heatmap_sub")} filtersLabel={t("act1.f.toggle")} filters={regionPills}>
              <EmissionsHeatmap
                series={vSeries}
                years={years}
                unit={unit}
                scale="sequential"
                labels={{
                  low: t("act6.heatmap_low"),
                  high: t("act6.heatmap_high"),
                  empty: t("act1.change.empty"),
                  mode_row: t("act6.heatmap_mode_row"),
                  mode_abs: t("act6.heatmap_mode_abs"),
                }}
              />
            </VizPanel>

            <VizPanel title={t("act6.change_title")} subtitle={t("act6.change_sub")} filtersLabel={t("act1.f.toggle")} filters={regionPills}>
              <ChangeBars rows={changeRows} unit={unit} labels={{ up: t("act6.change_up"), down: t("act6.change_down"), empty: t("act1.change.empty") }} />
            </VizPanel>

            <VizPanel
              title={t("act6.crop_rank_title")}
              subtitle={`${t("act6.crop_rank_sub")} · ${currentYear}`}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  {regionAndYear}
                  <Selecter label={t("act6.crop_rank_scope")} value={rankScope} options={scopeOpts} onChange={setRankScope} />
                </>
              }
            >
              <CropRanking rows={cropRankRows} unit={unit} max={12} />
            </VizPanel>

            <VizPanel
              title={t("act6.compare_title")}
              subtitle={t("act6.compare_sub")}
              filtersLabel={t("act1.f.toggle")}
              filters={
                <>
                  {regionPills}
                  <Selecter label={t("act6.compare_from")} value={String(cmpA ?? "")} options={yearOpts} onChange={(v) => setCmpA(Number(v))} />
                  <Selecter label={t("act6.compare_to")} value={String(cmpB ?? "")} options={yearOpts} onChange={(v) => setCmpB(Number(v))} />
                </>
              }
            >
              <DumbbellChart rows={dumbbellRows} yearA={cmpA} yearB={cmpB} unit={unit} labels={{ up: t("act6.compare_up"), down: t("act6.compare_down") }} />
            </VizPanel>

            <VizPanel title={t("act6.regional_title")} subtitle={t("act6.regional_sub")} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <TrendLines series={regionalSeries} years={years} currentYear={currentYear} unit={unit} />
            </VizPanel>

            <VizPanel title={t("act6.diversity_title")} subtitle={t("act6.diversity_sub")} filtersLabel={t("act1.f.toggle")} filters={regionPills}>
              <RankBars data={diversityRows} unit={t("act6.diversity_unit")} worldAvg={diversityMedian} refLabel={t("act6.median_ref")} />
            </VizPanel>

            <VizPanel title={t("act6.volatility_title")} subtitle={t("act6.volatility_sub")} filtersLabel={t("act1.f.toggle")} filters={regionPills}>
              <RankBars data={volatilityRows} unit="%" worldAvg={volatilityMedian} refLabel={t("act6.median_ref")} />
            </VizPanel>

            <VizPanel title={t("act6.box_title")} subtitle={t("act6.box_sub")} filtersLabel={t("act1.f.toggle")} filters={regionPills}>
              <BoxplotChart series={vSeries} years={years} unit={unit} scale="log" />
            </VizPanel>

            <VizPanel title={t("act6.scatter_title")} subtitle={`${t("act6.scatter_sub")}`} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <ScatterChart groups={scatterGroups} unit={unit} medianX={scatterMedianX} xName={t("act6.scatter_x")} yName={unit} />
            </VizPanel>

            <VizPanel title={t("act6.cropmap_title")} subtitle={`${t("act6.cropmap_sub")} · ${currentYear}`} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <CropHeatmap rows={cropHeatRows} unit={unit} format={fmtKg} />
            </VizPanel>

            <VizPanel title={t("act6.croptree_title")} subtitle={`${t("act6.croptree_sub")} · ${currentYear}`} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <TreemapChart rows={cropMedians} unit={unit} format={fmtKg} />
            </VizPanel>

            {cropRadar.categories.length >= 3 && (
              <VizPanel title={t("act6.radar_title")} subtitle={t("act6.radar_sub")} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
                <RadarProfileChart categories={cropRadar.categories} series={cropRadar.series} unit="%" max={100} />
              </VizPanel>
            )}

            <VizPanel title={t("act6.map_title")} subtitle={`${t("act6.map_sub")} · ${currentYear}`} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <ErrorBoundary fallback={<div className="act1__state act1__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <OceanMap
                    data={points}
                    unit={unit}
                    range={agg ? agg.range : null}
                    logScale
                    lowLabel={t("act6.map_low")}
                    midLabel={t("act6.map_mid")}
                    highLabel={t("act6.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                    years={years}
                    yearIndex={yearIdx}
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onScrub={scrubYear}
                  />
                </Suspense>
              </ErrorBoundary>
            </VizPanel>

            <VizPanel title={t("act6.table_title")} subtitle={`${t("act6.table_sub")} · ${currentYear}`} filtersLabel={t("act1.f.toggle")} filters={regionAndYear}>
              <DataTable rows={points} labels={tableLabels} unit={unit} refValue={refMedian} />
            </VizPanel>

            {/* ---------- Explorateur par culture (hauteur naturelle) ---------- */}
            <section className="act1slide act6explore">
              <div className="act6explore__head">
                <h2 className="act6explore__title">{t("act6.explorer_title")}</h2>
                <p className="act6explore__lead">{t("act6.explorer_lead")}</p>
              </div>
              <div className="act6explore__body">
                <CropExplorer data={agri.data} />
              </div>
            </section>

            {/* ---------- Sous-acte 2 : le bétail ---------- */}
            {lsSeries.length > 0 && (
              <>
                <section className="act1slide act1text">
                  <div className="act1text__inner">
                    <h2 className="act1text__title">{t("act6.sub2_title")}</h2>
                    <p className="act1text__lead">{t("act6.sub2_sub")}</p>
                    <span className="act1text__hint" aria-hidden="true">↓</span>
                  </div>
                </section>

                <VizPanel title={t("act6.ls_trend_title")} subtitle={t("act6.trend_sub")}>
                  <SmallMultiples series={lsSeries} years={lsAgg.years} unit={lsUnit} currentYear={lsAgg.lastYear} labels={{ last: t("act6.smallmult_last") }} />
                </VizPanel>

                <VizPanel title={t("act6.ls_heatmap_title")} subtitle={t("act6.heatmap_sub")}>
                  <EmissionsHeatmap
                    series={lsSeries}
                    years={lsAgg.years}
                    unit={lsUnit}
                    scale="sequential"
                    labels={{
                      low: t("act6.heatmap_low"),
                      high: t("act6.heatmap_high"),
                      empty: t("act1.change.empty"),
                      mode_row: t("act6.heatmap_mode_row"),
                      mode_abs: t("act6.heatmap_mode_abs"),
                    }}
                  />
                </VizPanel>

                <VizPanel title={t("act6.animal_rank_title")} subtitle={`${t("act6.animal_rank_sub")} · ${lsAgg.lastYear}`}>
                  <CropRanking rows={lsRankRows} unit={lsUnit} max={10} />
                </VizPanel>

                <section className="act1slide act6explore">
                  <div className="act6explore__head">
                    <h2 className="act6explore__title">{t("act6.explorer_animal_title")}</h2>
                    <p className="act6explore__lead">{t("act6.explorer_animal_lead")}</p>
                  </div>
                  <div className="act6explore__body">
                    <CropExplorer data={agri.data} kind="livestock" labels={{ pick: t("act6.explorer_animal_pick") }} />
                  </div>
                </section>
              </>
            )}

            {/* ---------- Avertissement ---------- */}
            <section className="act1slide act1text">
              <div className="act1text__inner">
                <h2 className="act1text__title">{t("act6.caveat_title")}</h2>
                <p className="act1text__story">{t("act6.caveat_body")}</p>
              </div>
            </section>

            <section className="act1slide act1outro">
              <div className="act1outro__inner">
                <p className="eyebrow">{t("act6.outro.kicker")}</p>
                <h2 className="act1outro__title">{t("act6.outro.title")}</h2>
                <p className="act1outro__text">{t("act6.outro.text")}</p>
                <div className="act1outro__actions">
                  <Link to="/vivant" className="act1outro__btn act1outro__btn--primary">
                    {t("act6.outro.next")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to="/" className="act1outro__btn">
                    {t("act6.outro.home")}
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}

        <Link to="/" className="act1__back">
          ← {t("act1.back")}
        </Link>
      </div>

      {agri.status === "ready" && slideCount > 0 && (
        <div className="act1nav" role="group" aria-label={t("act1.nav.next")}>
          <button type="button" className="act1nav__btn" onClick={() => goTo(active - 1)} disabled={active <= 0} aria-label={t("act1.nav.prev")}>
            ↑
          </button>
          <span className="act1nav__count">
            {active + 1}/{slideCount}
          </span>
          <button type="button" className="act1nav__btn" onClick={() => goTo(active + 1)} disabled={active >= slideCount - 1} aria-label={t("act1.nav.next")}>
            ↓
          </button>
        </div>
      )}
    </main>
  );
}