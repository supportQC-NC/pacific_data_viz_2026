// src/pages/Act12Cyclones/Act12Cyclones.jsx
// ============================================================
// Acte 12 — « Cyclones ». Trajectoires historiques des phénomènes tropicaux
// (Météo-France / Gouv. Nouvelle-Calédonie, fichier GeoJSON statique).
// Format DASHBOARD (ActBoard), comme les autres actes :
//   • CARTE animée (CycloneMap) en SIGNATURE — accumulation des saisons +
//     dessin SÉQUENTIEL des cyclones (un par un, point par point), marqueurs
//     des territoires suivis, recadrage au filtre région.
//   • Graphe « répartition par stade » (barres, couleur = stade).
//   • Graphe « cyclones par saison » (colonnes, couleur = stade de pointe) —
//     porteur de la nuance : c'est l'INTENSITÉ qui augmente, pas la fréquence.
// FILTRE GLOBAL : région (Mélanésie / Polynésie / Micronésie / toutes) →
// recentre la carte et limite les marqueurs de territoires affichés.
// Données via fetchCyclones (fichier statique). i18n via t(). Couleurs --cy-*.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useLang } from "../../store/context/langContext";
import useThemeTokens from "../../hooks/UseThemeTokens";
import PICT_GEO from "../../data/pictGeo";
import { pictName } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import ApexChart from "../../components/ApexChart/ApexChart";
import { baseChart, baseGrid, baseXaxis, baseYaxis, baseTooltip, MONO } from "../../components/charts/apexBase";
import { fetchCyclones, STAGES } from "../../data/cycloneApi";
import "./Act12Cyclones.scss";

const CycloneMap = lazy(() => import("../../components/CycloneMap/CycloneMap"));

// Sous-régions du Pacifique (mêmes regroupements que les autres actes).
const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_KEYS = ["all", "melanesia", "polynesia", "micronesia"];

// Cadrage carte par région (recentrage au filtre). null = vue par défaut.
const REGION_FOCUS = {
  all: null,
  melanesia: { center: [166, -18], zoom: 3.9 },
  polynesia: { center: [-176, -18], zoom: 3.3 },
  micronesia: { center: [150, 8], zoom: 3.5 },
};

// Cadence de lecture auto — alignée sur le dessin séquentiel de CycloneMap :
// chaque saison se dessine ENTIÈREMENT avant de passer à la suivante.
const PER_CYCLONE_MS = 1300;
const DRAW_MIN = 1200;
const DRAW_MAX = 16000;
const SEASON_DWELL_MS = 1200;

// Couleurs de stade (--cy-*) en valeurs concrètes pour ApexCharts.
function readStageColors() {
  if (typeof window === "undefined") return {};
  const cs = getComputedStyle(document.documentElement);
  const get = (n, f) => cs.getPropertyValue(n).trim() || f;
  return {
    DTFA: get("--cy-dtfa", "#4ad9c0"),
    DTM: get("--cy-dtm", "#38bdf8"),
    DTFO: get("--cy-dtfo", "#fbbf24"),
    CT: get("--cy-ct", "#fb923c"),
    CTI: get("--cy-cti", "#f43f5e"),
    CTTI: get("--cy-ctti", "#ffffff"),
  };
}

/* ---------- Contrôle de filtre (global à l'acte) ---------- */
function Select({ label, options, value, onChange }) {
  return (
    <div className="act1f act1f--select">
      {label ? <span className="act1f__lbl">{label}</span> : null}
      <div className="act1f__selwrap">
        <select className="act1f__select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
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

export default function Act12Cyclones() {
  const { t, lang } = useLang();
  const tk = useThemeTokens();

  const [res, setRes] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error
  const [reload, setReload] = useState(0);

  const [region, setRegion] = useState("all");
  const [seasonIdx, setSeasonIdx] = useState(null);
  const [playing, setPlaying] = useState(false);

  // ---- Chargement (fichier statique) ----
  useEffect(() => {
    const ctrl = new AbortController();
    setStatus("loading");
    fetchCyclones({ signal: ctrl.signal })
      .then((r) => {
        setRes(r);
        if (r.source !== "live") setStatus("error");
        else if (!r.count) setStatus("empty");
        else setStatus("ready");
      })
      .catch(() => setStatus("error"));
    return () => ctrl.abort();
  }, [reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  const cyclones = useMemo(() => res?.cyclones || [], [res]);
  const seasons = useMemo(() => res?.seasons || [], [res]);
  const stages = res?.stages || STAGES;

  const stageLabels = useMemo(() => {
    const out = {};
    stages.forEach((s) => {
      out[s.id] = t(s.i18nKey);
    });
    return out;
  }, [stages, t]);

  // `tk` n'est pas lu directement (couleurs via getComputedStyle) mais sert de
  // DÉCLENCHEUR au basculement de thème. Dépendance volontaire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stageColors = useMemo(() => readStageColors(), [tk]);

  // Marqueurs des territoires suivis (filtrés par région).
  const territories = useMemo(() => {
    const codes = region === "all" ? Object.keys(PICT_GEO) : SUBREGIONS[region] || [];
    return codes
      .filter((c) => PICT_GEO[c])
      .map((c) => ({ code: c, name: pictName(c, lang), lng: PICT_GEO[c][0], lat: PICT_GEO[c][1] }));
  }, [region, lang]);

  const focus = REGION_FOCUS[region] || null;

  // Timeline : par défaut, dernière saison (toute l'accumulation visible).
  useEffect(() => {
    if (seasons.length && seasonIdx === null) setSeasonIdx(seasons.length - 1);
  }, [seasons, seasonIdx]);

  // Nombre de cyclones de la saison courante (pour caler la durée de lecture).
  const activeCount = useMemo(() => {
    if (seasonIdx == null || !seasons.length) return 0;
    const s = seasons[seasonIdx];
    return cyclones.filter((c) => c.season === s).length;
  }, [cyclones, seasons, seasonIdx]);

  // Lecture automatique : on attend que la saison soit ENTIÈREMENT dessinée
  // (durée ∝ nombre de cyclones) + un temps de pause, puis on avance.
  useEffect(() => {
    if (!playing || !seasons.length || seasonIdx == null) return undefined;
    const dur = Math.min(DRAW_MAX, Math.max(DRAW_MIN, activeCount * PER_CYCLONE_MS)) + SEASON_DWELL_MS;
    const id = setTimeout(() => {
      setSeasonIdx((i) => {
        const next = (i ?? 0) + 1;
        if (next >= seasons.length) {
          setPlaying(false);
          return i;
        }
        return next;
      });
    }, dur);
    return () => clearTimeout(id);
  }, [playing, seasonIdx, seasons, activeCount]);

  const togglePlay = useCallback(() => {
    setSeasonIdx((i) => (i === seasons.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [seasons.length]);
  const scrub = useCallback((i) => {
    setPlaying(false);
    setSeasonIdx(i);
  }, []);

  // ---- Agrégats ----
  const bySeason = useMemo(() => {
    const m = new Map();
    cyclones.forEach((cy) => {
      const e = m.get(cy.season) || { count: 0, peakRank: -1, peakStage: "DTFA" };
      e.count += 1;
      if ((cy.stageRank ?? -1) > e.peakRank) {
        e.peakRank = cy.stageRank ?? -1;
        e.peakStage = cy.stage || "DTFA";
      }
      m.set(cy.season, e);
    });
    return seasons.map((s) => ({ season: s, ...(m.get(s) || { count: 0, peakRank: -1, peakStage: "DTFA" }) }));
  }, [cyclones, seasons]);

  const busiest = useMemo(
    () => bySeason.reduce((best, r) => (r.count > (best?.count ?? -1) ? r : best), null),
    [bySeason],
  );

  const mostIntense = useMemo(() => {
    if (!cyclones.length) return null;
    return [...cyclones].sort(
      (a, b) => (b.stageRank ?? -1) - (a.stageRank ?? -1) || (b.maxWind ?? 0) - (a.maxWind ?? 0),
    )[0];
  }, [cyclones]);

  const maxWind = useMemo(
    () => cyclones.reduce((mx, cy) => (cy.maxWind != null && cy.maxWind > mx ? cy.maxWind : mx), 0),
    [cyclones],
  );

  // ---- KPI ----
  const kpiItems = useMemo(() => {
    if (status !== "ready") return [];
    return [
      {
        key: "total",
        value: res.count,
        unit: t("act12.kpi.cyclones_unit"),
        label: `${t("act12.kpi.total")} · ${res.firstSeason} → ${res.lastSeason}`,
        tone: "accent",
      },
      {
        key: "intense",
        value: mostIntense ? mostIntense.name : "—",
        unit: mostIntense ? stageLabels[mostIntense.peakStage] : "",
        label: t("act12.kpi.intense"),
        tone: "warm",
      },
      {
        key: "busy",
        value: busiest ? busiest.count : "—",
        unit: busiest ? busiest.season : "",
        label: t("act12.kpi.busy"),
        tone: "neutral",
      },
      {
        key: "wind",
        value: maxWind ? `${Math.round(maxWind)}` : "—",
        unit: t("act12.map.kt"),
        label: t("act12.kpi.wind"),
        tone: "warm",
      },
    ];
  }, [status, res, mostIntense, busiest, maxWind, stageLabels, t]);

  // ---- Libellés carte (i18n) ----
  const mapLabels = useMemo(
    () => ({
      play: t("act12.map.play"),
      pause: t("act12.map.pause"),
      expand: t("act12.map.expand"),
      close: t("act12.map.close"),
      allSeasons: t("act12.map.all_seasons"),
      cyclones: t("act12.map.cyclones"),
      wind: t("act12.map.wind"),
      pressure: t("act12.map.pressure"),
      season: t("act12.map.season"),
      kt: t("act12.map.kt"),
      kmh: t("act12.map.kmh"),
      hpa: t("act12.map.hpa"),
    }),
    [t],
  );

  // ---- Options graphes ----
  const stageBarOptions = useMemo(() => {
    const ordered = [...stages];
    const cats = ordered.map((s) => stageLabels[s.id]);
    const vals = ordered.map((s) => res?.byStage?.[s.id] || 0);
    const colors = ordered.map((s) => stageColors[s.id] || tk.accent);
    return {
      chart: baseChart(tk, { type: "bar" }),
      series: [{ name: t("act12.viz.bystage_series"), data: vals }],
      colors,
      plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 3, barHeight: "62%" } },
      dataLabels: { enabled: true, style: { fontFamily: MONO, fontSize: "11px", colors: [tk.text] }, offsetX: 14 },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, { categories: cats }),
      yaxis: baseYaxis(tk),
      tooltip: baseTooltip(),
    };
  }, [stages, stageLabels, res, stageColors, tk, t]);

  const seasonBarOptions = useMemo(() => {
    const cats = bySeason.map((r) => r.season);
    const vals = bySeason.map((r) => r.count);
    const colors = bySeason.map((r) => stageColors[r.peakStage] || tk.accent);
    return {
      chart: baseChart(tk, { type: "bar" }),
      series: [{ name: t("act12.viz.season_series"), data: vals }],
      colors,
      plotOptions: { bar: { distributed: true, borderRadius: 2, columnWidth: "72%" } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        categories: cats,
        tickAmount: Math.min(12, Math.max(2, cats.length - 1)),
        labels: { rotate: -45, rotateAlways: false, style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" } },
      }),
      yaxis: baseYaxis(tk),
      tooltip: baseTooltip(),
    };
  }, [bySeason, stageColors, tk, t]);

  const regionOpts = REGION_KEYS.map((k) => ({ v: k, label: t(`act1.filter.${k}`) }));
  const filtersEl = (
    <Select label={t("act1.filter.title")} options={regionOpts} value={region} onChange={setRegion} />
  );

  // ---- Charts ActBoard ----
  const charts =
    status === "ready"
      ? [
          {
            id: "map",
            signature: true,
            tab: t("act12.board.tab_map"),
            title: t("act12.viz.map_title"),
            finding: t("act12.viz.map_find"),
            node: (
              <ErrorBoundary fallback={<div className="board__state board__state--err">{t("scene.error")}</div>}>
                <Suspense fallback={<Loader compact label={t("scene.loading")} />}>
                  <CycloneMap
                    cyclones={cyclones}
                    seasons={seasons}
                    seasonIndex={seasonIdx}
                    playing={playing}
                    onTogglePlay={togglePlay}
                    onScrub={scrub}
                    stages={stages}
                    stageLabels={stageLabels}
                    labels={mapLabels}
                    noTokenMsg={t("act1.map_no_token")}
                    territories={territories}
                    focus={focus}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "stage",
            tab: t("act12.board.tab_stage"),
            title: t("act12.viz.bystage_title"),
            finding: t("act12.viz.bystage_find"),
            empty: !res.count,
            node: <ApexChart options={stageBarOptions} />,
          },
          {
            id: "season",
            tab: t("act12.board.tab_season"),
            title: t("act12.viz.season_title"),
            finding: t("act12.viz.season_find"),
            empty: !bySeason.length,
            node: <ApexChart options={seasonBarOptions} />,
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a12_tag")}
      title={t("home.acts.a12_title")}
      thesis={t("act12.thesis")}
      kpis={kpiItems}
      kpiTitle={t("act1.stats.title")}
      filters={filtersEl}
      charts={charts}
      progress={{ index: 4, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("act12.no_data"),
        retry: t("act1.retry"),
        switchHint: t("act12.board.switch_hint"),
        signature: t("act12.board.signature"),
        takeawayKicker: t("act12.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act12.board.start"),
        conclusion: t("act12.board.conclusion"),
        backIntro: t("act12.board.back_intro"),
        reviseData: t("act12.board.revise_data"),
      }}
      outro={{
        kicker: t("act12.outro.kicker"),
        title: t("act12.outro.title"),
        text: t("act12.outro.text"),
        primary: { to: "/agriculture", label: t("act12.outro.next") },
        secondary: { to: "/", label: t("act12.outro.home") },
      }}
    />
  );
}