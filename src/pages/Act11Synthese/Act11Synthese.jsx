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
import { worldAvgFor } from "../../data/worldAvg";
import PICT_GEO from "../../data/pictGeo";
import Loader from "../../components/Loader/Loader";
import AtlasMap from "../../components/AtlasMap/AtlasMap";
import ParadoxScatterLive from "../../components/charts/PardoxScatterLive";
import VulnMatrix from "../../components/charts/VulnMatrix";
import ProfileRadar from "../../components/charts/ProfileRadar";
import TrendChart from "../../components/charts/TrendChart";
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
function normalizeMap(rawByArea) {
  const vals = Object.values(rawByArea).filter((v) => Number.isFinite(v));
  if (!vals.length) return {};
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const out = {};
  Object.entries(rawByArea).forEach(([a, v]) => {
    if (Number.isFinite(v))
      out[a] = hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
  });
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
                width: `${Math.max((r.value / max) * 100, 2)}%`,
                background: r.color,
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

  const composite = useMemo(() => {
    const acc = {};
    VULN.forEach((k) => {
      Object.entries(normByInd[k] || {}).forEach(([a, v]) => {
        if (!isPict(a)) return;
        (acc[a] = acc[a] || []).push(v);
      });
    });
    const out = {};
    Object.entries(acc).forEach(([a, arr]) => {
      if (arr.length) out[a] = arr.reduce((s, v) => s + v, 0) / arr.length;
    });
    return out;
  }, [normByInd]);

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

  const worldRef = useMemo(() => {
    const yr = data && data.emissions ? data.emissions.lastYear : null;
    return worldAvgFor(yr) ?? worldAvgFor(2023);
  }, [data]);
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

  const stats = useMemo(() => {
    const emi = latest.emissions || {};
    const pts = areas.filter((a) => Number.isFinite(emi[a]));
    if (pts.length < 3 || !Number.isFinite(worldRef)) return null;
    const ratio = pacMed > 0 ? worldRef / pacMed : null;
    const yMed = medianY;
    const below = pts.filter(
      (a) => emi[a] < worldRef && composite[a] > yMed,
    ).length;
    const most = areas.reduce(
      (m, a) => (!m || composite[a] > composite[m] ? a : m),
      null,
    );
    return {
      ratio,
      below,
      total: pts.length,
      mostCode: most,
      mostName: most ? pictName(most, lang) : "",
      mostScore: most ? Math.round(composite[most]) : 0,
    };
  }, [areas, latest, worldRef, pacMed, medianY, lang]);

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
    list.push({
      kind: "split",
      eyebrow: t("act11.story.resp_k"),
      title: t("act11.story.resp_title"),
      text: t("act11.story.resp_text"),
      stat: stats
        ? {
            value: Math.round(stats.ratio),
            suffix: "×",
            label: t("act11.stat_emi_label"),
            tone: "warm",
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
              label: t("act11.story.resp_world"),
              value: worldRef || 0,
              color: tk.negative,
            },
          ]}
        />
      ),
    });
    list.push({
      kind: "split",
      eyebrow: t("act11.story.ocean_k"),
      title: t("act11.story.ocean_title"),
      text: t("act11.story.ocean_text"),
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
      hint: t("act11.story.focus_hint"),
      visual: (
        <AtlasMap
          points={atlasPoints}
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
    list.push({
      kind: "split",
      eyebrow: t("act11.story.radar_k"),
      title: t("act11.story.radar_title"),
      text: t("act11.story.radar_text"),
      visual: (
        <ProfileRadar indicators={radarIndicators} series={radarSeries} />
      ),
    });
    list.push({
      kind: "split",
      eyebrow: t("act11.story.matrix_k"),
      title: t("act11.story.matrix_title"),
      text: t("act11.story.matrix_text"),
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
      eyebrow: t("act11.story.paradox_k"),
      title: t("act11.story.paradox_title"),
      text: t("act11.story.paradox_text"),
      hint: t("act11.story.focus_hint"),
      visual: (
        <ParadoxScatterLive
          groups={scatterGroups}
          medianX={medianX}
          medianY={medianY}
          worldRef={worldRef}
          selected={focus}
          onSelect={(c) => setFocus((s) => (s === c ? null : c))}
          xName={t("act11.scatter_x_unit")}
          yName={t("act11.scatter_y")}
          labels={{ world: t("act11.world_ref_label") }}
        />
      ),
    });
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
    worldRef,
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
                  value={Math.round(stats.ratio)}
                  suffix="×"
                  label={t("act11.stat_emi_label")}
                  tone="warm"
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
