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

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useLang } from "../../store/context/langContext";
import useThemeTokens from "../../hooks/UseThemeTokens";
import PICT_GEO from "../../data/pictGeo";
import { pictName } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import ApexChart from "../../components/ApexChart/ApexChart";
import {
  baseChart,
  baseGrid,
  baseXaxis,
  baseYaxis,
  baseTooltip,
  MONO,
} from "../../components/charts/apexBase";
import { fetchCyclones, STAGES } from "../../services/cycloneApi";
import "./Act12Cyclones.scss";

const CycloneMap = lazy(() => import("../../components/CycloneMap/CycloneMap"));

// Sous-régions du Pacifique (mêmes regroupements que les autres actes).
const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};

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

// Exposition : un territoire est « exposé » à un cyclone si la trajectoire
// passe à moins de EXPOSURE_KM d'un de ses points. Métrique DÉRIVÉE (croisement
// tracés × territoires), pas un champ du dataset.
const R_EARTH_KM = 6371;
const EXPOSURE_KM = 300;
function normLng(l) {
  return ((((l + 180) % 360) + 360) % 360) - 180;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR;
  const dLon = (lon2 - lon1) * toR;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* ---------- Helpers couleur (heatmap calendrier) ----------
   Teintes/ombres calculées depuis les tokens (aucune couleur de marque en
   dur ; seuls le blanc/noir servent à éclaircir/assombrir). ---------- */
function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  return `#${rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
function mixRgb(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

/* ---------- Panneau « Source & portée » (onglet provenance) ---------- */
function ProvenancePanel({ t }) {
  const links = [
    { href: "https://data.gouv.nc/", label: t("act12.source.link_datagouv") },
    {
      href: "https://georep-dtsi-sgt.opendata.arcgis.com/maps/63e27e6671324498838e4944035a3cc0/about",
      label: t("act12.source.link_georep"),
    },
  ];
  return (
    <div className="act12-src">
      <p className="act12-src__disclaimer">{t("act12.source.disclaimer")}</p>
      <dl className="act12-src__list">
        <div className="act12-src__row">
          <dt>{t("act12.source.provider_label")}</dt>
          <dd>{t("act12.source.provider")}</dd>
        </div>
        <div className="act12-src__row">
          <dt>{t("act12.source.license_label")}</dt>
          <dd>{t("act12.source.license")}</dd>
        </div>
      </dl>
      <p className="act12-src__genealogy">{t("act12.source.genealogy")}</p>
      <div className="act12-src__scope">
        <h4 className="act12-src__scope-title">
          {t("act12.source.scope_title")}
        </h4>
        <ul className="act12-src__scope-list">
          <li>{t("act12.source.scope_nc")}</li>
          <li>{t("act12.source.scope_swp")}</li>
          <li>{t("act12.source.scope_wf")}</li>
        </ul>
        <p className="act12-src__note">{t("act12.source.scope_note")}</p>
      </div>
      <div className="act12-src__links">
        <span className="act12-src__links-lbl">
          {t("act12.source.links_label")}
        </span>
        {links.map((l) => (
          <a
            className="act12-src__link"
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {l.label}
          </a>
        ))}
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

  const region = "all";
  const [seasonIdx, setSeasonIdx] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intensity = "all"; // filtres retirés de l'UI → on montre tout

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

  // Vue filtrée : « toutes » ou « intenses » (cyclone tropical et plus, rang ≥ 3).
  // Alimente carte + graphes d'exploration. L'intensification (tendance long
  // terme) reste calculée sur l'ENSEMBLE des données.
  const view = useMemo(
    () =>
      intensity === "intense"
        ? cyclones.filter((c) => (c.stageRank ?? -1) >= 3)
        : cyclones,
    [cyclones, intensity],
  );

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
    const codes =
      region === "all" ? Object.keys(PICT_GEO) : SUBREGIONS[region] || [];
    return codes
      .filter((c) => PICT_GEO[c])
      .map((c) => ({
        code: c,
        name: pictName(c, lang),
        lng: PICT_GEO[c][0],
        lat: PICT_GEO[c][1],
      }));
  }, [region, lang]);

  const focus = REGION_FOCUS[region] || null;

  // Timeline : par défaut, PREMIÈRE saison (le récit démarre au début de
  // l'archive ; on déroule ensuite l'accumulation au fil de la lecture).
  useEffect(() => {
    if (seasons.length && seasonIdx === null) setSeasonIdx(0);
  }, [seasons, seasonIdx]);

  // Nombre de cyclones de la saison courante (pour caler la durée de lecture).
  const activeCount = useMemo(() => {
    if (seasonIdx == null || !seasons.length) return 0;
    const s = seasons[seasonIdx];
    return view.filter((c) => c.season === s).length;
  }, [view, seasons, seasonIdx]);

  // Lecture automatique : on attend que la saison soit ENTIÈREMENT dessinée
  // (durée ∝ nombre de cyclones) + un temps de pause, puis on avance.
  useEffect(() => {
    if (!playing || !seasons.length || seasonIdx == null) return undefined;
    const base = Math.min(
      DRAW_MAX,
      Math.max(DRAW_MIN, activeCount * PER_CYCLONE_MS),
    );
    const dur = base / (speed > 0 ? speed : 1) + SEASON_DWELL_MS;
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
  }, [playing, seasonIdx, seasons, activeCount, speed]);

  const togglePlay = useCallback(() => {
    setSeasonIdx((i) => (i === seasons.length - 1 ? 0 : i));
    setPlaying((p) => !p);
  }, [seasons.length]);
  const scrub = useCallback((i) => {
    setPlaying(false);
    setSeasonIdx(i);
  }, []);

  // ---- Agrégats (sur la vue filtrée) ----
  const bySeason = useMemo(() => {
    const m = new Map();
    view.forEach((cy) => {
      const e = m.get(cy.season) || {
        count: 0,
        peakRank: -1,
        peakStage: "DTFA",
      };
      e.count += 1;
      if ((cy.stageRank ?? -1) > e.peakRank) {
        e.peakRank = cy.stageRank ?? -1;
        e.peakStage = cy.stage || "DTFA";
      }
      m.set(cy.season, e);
    });
    return seasons.map((s) => ({
      season: s,
      ...(m.get(s) || { count: 0, peakRank: -1, peakStage: "DTFA" }),
    }));
  }, [view, seasons]);

  const busiest = useMemo(
    () =>
      bySeason.reduce(
        (best, r) => (r.count > (best?.count ?? -1) ? r : best),
        null,
      ),
    [bySeason],
  );

  const mostIntense = useMemo(() => {
    if (!view.length) return null;
    return [...view].sort(
      (a, b) =>
        (b.stageRank ?? -1) - (a.stageRank ?? -1) ||
        (b.maxWind ?? 0) - (a.maxWind ?? 0),
    )[0];
  }, [view]);

  const maxWind = useMemo(
    () =>
      view.reduce(
        (mx, cy) => (cy.maxWind != null && cy.maxWind > mx ? cy.maxWind : mx),
        0,
      ),
    [view],
  );

  // ---- Intensification (TENDANCE long terme — toujours sur TOUTES les données) ----
  // Part de cyclones atteignant le stade « cyclone tropical » ou plus (rang ≥ 3),
  // par saison, + moyenne glissante sur 5 saisons pour lisser le bruit.
  const intensify = useMemo(() => {
    const m = new Map();
    cyclones.forEach((cy) => {
      const e = m.get(cy.season) || { n: 0, intense: 0 };
      e.n += 1;
      if ((cy.stageRank ?? -1) >= 3) e.intense += 1;
      m.set(cy.season, e);
    });
    const share = seasons.map((s) => {
      const e = m.get(s);
      return e && e.n ? Math.round((100 * e.intense) / e.n) : null;
    });
    const roll = share.map((_, i) => {
      const win = [];
      for (let k = Math.max(0, i - 4); k <= i; k += 1)
        if (share[k] != null) win.push(share[k]);
      return win.length
        ? Math.round(win.reduce((a, b) => a + b, 0) / win.length)
        : null;
    });
    return { seasons, share, roll };
  }, [cyclones, seasons]);

  // ---- Calendrier d'activité : genèse par MOIS × DÉCENNIE (heatmap) ----
  const calendar = useMemo(() => {
    const order = [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5]; // saison australe : juil. → juin
    const grid = {};
    order.forEach((mo) => {
      grid[mo] = {};
    });
    const decSet = new Set();
    view.forEach((cy) => {
      if (cy.startTime == null) return;
      const d = new Date(cy.startTime);
      const mo = d.getMonth();
      const dec = Math.floor(d.getFullYear() / 10) * 10;
      if (mo < 0 || mo > 11) return;
      decSet.add(dec);
      grid[mo][dec] = (grid[mo][dec] || 0) + 1;
    });
    const decades = [...decSet].sort((a, b) => a - b);
    const monthLabels = order.map((mo) => {
      try {
        return new Date(2001, mo, 1).toLocaleDateString(
          lang === "fr" ? "fr-FR" : "en-US",
          { month: "short" },
        );
      } catch (e) {
        return String(mo + 1);
      }
    });
    // Une série par mois (lignes), inversée pour que juillet apparaisse en haut.
    const series = order
      .map((mo, i) => ({
        name: monthLabels[i],
        data: decades.map((dec) => ({ x: `${dec}s`, y: grid[mo][dec] || 0 })),
      }))
      .reverse();
    return { series, hasData: decades.length > 0 };
  }, [view, lang]);

  // ---- Relation vent × pression (signature physique), un point = un cyclone ----
  const windPress = useMemo(() => {
    const byStage = {};
    stages.forEach((s) => {
      byStage[s.id] = [];
    });
    view.forEach((cy) => {
      if (cy.maxWind == null || cy.minPressureHpa == null) return;
      const sid = cy.stage || "DTFA";
      (byStage[sid] = byStage[sid] || []).push({
        x: cy.minPressureHpa,
        y: cy.maxWind,
        name: cy.name || cy.id,
      });
    });
    return stages.map((s) => ({
      name: stageLabels[s.id],
      data: byStage[s.id] || [],
    }));
  }, [view, stages, stageLabels]);

  // Exposition par territoire (croisement tracés × points PICT). Calcul lourd
  // isolé (dépend des cyclones seulement) ; le nommage suit la langue.
  const exposureRaw = useMemo(() => {
    if (status !== "ready" || !view.length) return [];
    const codes = Object.keys(PICT_GEO);
    const counts = {};
    codes.forEach((c) => {
      counts[c] = {};
    });
    view.forEach((cy) => {
      const pts = cy.path || [];
      if (pts.length < 2) return;
      const stage = cy.stage || "DTFA";
      codes.forEach((code) => {
        const tlng = PICT_GEO[code][0];
        const tlat = PICT_GEO[code][1];
        let near = false;
        for (let k = 0; k < pts.length; k += 1) {
          if (
            haversineKm(tlat, tlng, pts[k][1], normLng(pts[k][0])) <=
            EXPOSURE_KM
          ) {
            near = true;
            break;
          }
        }
        if (near) counts[code][stage] = (counts[code][stage] || 0) + 1;
      });
    });
    return codes
      .map((code) => {
        const byStage = counts[code];
        const total = Object.values(byStage).reduce((a, b) => a + b, 0);
        return { code, byStage, total };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [status, view]);

  const exposure = useMemo(
    () =>
      exposureRaw
        .slice(0, 10)
        .map((r) => ({ ...r, name: pictName(r.code, lang) || r.code })),
    [exposureRaw, lang],
  );

  // ---- KPI ----
  const kpiItems = useMemo(() => {
    if (status !== "ready") return [];

    // Équivalent grand public de la vitesse du vent : les nœuds parlent peu.
    // On ajoute la conversion en note de la carte vent — km/h en FR, mph en EN.
    // 1 nœud = 1,852 km/h = 1,15078 mph.
    const windNote = maxWind
      ? lang === "en"
        ? `≈ ${Math.round(maxWind * 1.15078)} mph`
        : `≈ ${Math.round(maxWind * 1.852)} km/h`
      : null;

    return [
      {
        key: "total",
        value: view.length,
        unit: t("act12.kpi.cyclones_unit"),
        label: `${t("act12.kpi.total")}`,
        // label: `${t("act12.kpi.total")} · ${res.firstSeason} → ${res.lastSeason}`,
        tone: "accent",
      },
      {
        key: "intense",
        value: mostIntense ? mostIntense.name : "—",
        unit: mostIntense ? stageLabels[mostIntense.stage] : "",
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
        note: windNote, // ← ex. « ≈ 278 km/h »
        tone: "warm",
      },
    ];
  }, [status, res, view, mostIntense, busiest, maxWind, stageLabels, t, lang]);

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
      searchPlaceholder: t("act12.map.search_placeholder"),
      searchClear: t("act12.map.search_clear"),
    }),
    [t],
  );

  // ---- Options graphes ----
  const stageBarOptions = useMemo(() => {
    const ordered = [...stages];
    const cats = ordered.map((s) => stageLabels[s.id]);
    const vals = ordered.map(
      (s) => view.filter((c) => c.stage === s.id).length,
    );
    const colors = ordered.map((s) => stageColors[s.id] || tk.accent);
    const maxV = Math.max(1, ...vals);
    return {
      chart: baseChart(tk, { type: "bar" }),
      series: [{ name: t("act12.viz.bystage_series"), data: vals }],
      colors,
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          borderRadius: 4,
          barHeight: "66%",
        },
      },
      // Effectif en bout de barre, SUR LE FOND (pas de boîte blanche illisible).
      dataLabels: {
        enabled: true,
        textAnchor: "start",
        offsetX: 10,
        style: {
          fontFamily: MONO,
          fontSize: "13px",
          fontWeight: 700,
          colors: [tk.text],
        },
        background: { enabled: false },
        formatter: (v) => `${v}`,
      },
      legend: { show: false },
      grid: baseGrid(tk, { xaxis: { lines: { show: false } } }),
      // Axe catégoriel EXPLICITE (anti-fuite) ; l'axe des effectifs est masqué,
      // les barres + l'étiquette en bout suffisent à le lire.
      xaxis: baseXaxis(tk, {
        type: "category",
        categories: cats,
        max: maxV + Math.max(2, Math.ceil(maxV * 0.16)),
        title: { text: "" },
        labels: { show: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      }),
      // Noms de stades à gauche (assez de largeur pour les libellés longs).
      yaxis: baseYaxis(tk, {
        labels: {
          show: true,
          maxWidth: 230,
          style: { colors: tk.textSoft, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      tooltip: baseTooltip(),
    };
  }, [stages, stageLabels, view, stageColors, tk, t]);

  const seasonBarOptions = useMemo(() => {
    const counts = bySeason.map((r) => r.count);
    // Moyenne mobile centrée sur 5 saisons → la tendance de fond à travers le
    // bruit (la fréquence ne grimpe pas nettement : c'est le message de l'acte).
    const half = 2;
    const rolling = counts.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = i - half; k <= i + half; k += 1) {
        if (k >= 0 && k < counts.length) {
          sum += counts[k];
          n += 1;
        }
      }
      return n ? Math.round((sum / n) * 10) / 10 : null;
    });
    const barData = bySeason.map((r) => ({
      x: r.season,
      y: r.count,
      fillColor: stageColors[r.peakStage] || tk.accent,
    }));
    const avgData = bySeason.map((r, i) => ({ x: r.season, y: rolling[i] }));

    return {
      chart: baseChart(tk, {
        type: "line",
        // Halo sombre sous la ligne de tendance (série 1) → reste lisible même
        // par-dessus les barres claires/blanches (saisons à pointe CTTI).
        dropShadow: {
          enabled: true,
          enabledOnSeries: [1],
          top: 0,
          left: 0,
          blur: 3,
          color: tk.bg,
          opacity: 0.7,
        },
      }),
      series: [
        { name: t("act12.viz.season_series"), type: "column", data: barData },
        { name: t("act12.viz.season_avg"), type: "line", data: avgData },
      ],
      colors: [tk.accent, tk.text],
      stroke: { width: [0, 3.5], curve: "smooth" },
      fill: { opacity: [1, 1] },
      markers: { size: 0 },
      plotOptions: { bar: { borderRadius: 2, columnWidth: "72%" } },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textSoft },
        markers: { width: 9, height: 9, radius: 2 },
        itemMargin: { horizontal: 10, vertical: 2 },
      },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        tickAmount: Math.min(12, Math.max(2, bySeason.length - 1)),
        labels: {
          rotate: -45,
          rotateAlways: false,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" },
        },
      }),
      yaxis: baseYaxis(tk, {
        min: 0,
        forceNiceScale: true,
        labels: {
          formatter: (v) => `${Math.round(v)}`,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = bySeason[dataPointIndex];
          if (!r) return "";
          const peak = stageLabels[r.peakStage] || "";
          const avg = rolling[dataPointIndex];
          return (
            `<div class="cmap-pop"><span class="cmap-pop__name">${r.season}</span>` +
            `<span class="cmap-pop__row">${r.count} ${t("act12.viz.season_series")}</span>` +
            (peak ? `<span class="cmap-pop__row">${peak}</span>` : "") +
            (avg != null
              ? `<span class="cmap-pop__row">${t("act12.viz.season_avg")} : ${avg}</span>`
              : "") +
            `</div>`
          );
        },
      }),
    };
  }, [bySeason, stageColors, stageLabels, tk, t]);

  const exposureBarOptions = useMemo(() => {
    const cats = exposure.map((r) => r.name);
    const series = stages.map((s) => ({
      name: stageLabels[s.id],
      data: exposure.map((r) => r.byStage[s.id] || 0),
    }));
    const colors = stages.map((s) => stageColors[s.id] || tk.accent);
    return {
      chart: baseChart(tk, { type: "bar", stacked: true }),
      series,
      colors,
      plotOptions: {
        bar: { horizontal: true, borderRadius: 2, barHeight: "70%" },
      },
      dataLabels: { enabled: false },
      stroke: { width: 1, colors: [tk.bg] },
      legend: {
        show: true,
        position: "bottom",
        fontFamily: MONO,
        fontSize: "10px",
        labels: { colors: tk.textMute },
        markers: { width: 9, height: 9, radius: 2 },
        itemMargin: { horizontal: 5, vertical: 2 },
      },
      grid: baseGrid(tk),
      // Barres horizontales : les `categories` passées à l'axe X servent de
      // libellés de l'axe vertical (noms de territoires). On NE force PAS
      // `type: "category"` ici — sur un empilé horizontal, cet override
      // désynchronise la résolution d'axe d'ApexCharts et faisait planter le
      // tooltip partagé par défaut (« reading '0' »). Modèle : MirrorBars.
      xaxis: baseXaxis(tk, {
        categories: cats,
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      yaxis: baseYaxis(tk, {
        labels: {
          show: true,
          maxWidth: 170,
          style: { colors: tk.text, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      // Tooltip partagé CUSTOM (comme MirrorBars) : on n'utilise pas le rendu
      // partagé natif d'ApexCharts, qui plante sur un empilé horizontal.
      tooltip: baseTooltip({
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex }) => {
          const r = exposure[dataPointIndex];
          if (!r) return "";
          const rows = stages
            .map((s) => {
              const v = r.byStage[s.id] || 0;
              if (!v) return "";
              const c = stageColors[s.id] || tk.accent;
              return `<div class="apexchart__tt-row"><span style="color:${c}">●</span> ${stageLabels[s.id]}: <strong>${v}</strong></div>`;
            })
            .join("");
          return `<div class="apexchart__tt">
            <div class="apexchart__tt-title">${r.name}</div>
            ${rows}
            <div class="apexchart__tt-row">Total: <strong>${r.total}</strong></div>
          </div>`;
        },
      }),
    };
  }, [exposure, stages, stageLabels, stageColors, tk]);

  const intensifyLineOptions = useMemo(() => {
    const sea = intensify.seasons;
    return {
      chart: baseChart(tk, { type: "line" }),
      series: [
        {
          name: t("act12.viz.intensify_raw"),
          type: "scatter",
          data: sea.map((s, i) => ({ x: s, y: intensify.share[i] })),
        },
        {
          name: t("act12.viz.intensify_trend"),
          type: "area",
          data: sea.map((s, i) => ({ x: s, y: intensify.roll[i] })),
        },
      ],
      colors: [tk.textMute, tk.warm],
      stroke: { width: [0, 3.5], curve: "smooth" },
      fill: {
        type: ["solid", "gradient"],
        opacity: [0.5, 0.25],
        gradient: {
          shadeIntensity: 0.5,
          opacityFrom: 0.34,
          opacityTo: 0.02,
          stops: [0, 100],
        },
      },
      markers: { size: [3.5, 0], strokeWidth: 0, hover: { size: 5 } },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
        fontFamily: MONO,
        fontSize: "11px",
        labels: { colors: tk.textMute },
        markers: { width: 9, height: 9, radius: 2 },
      },
      grid: baseGrid(tk),
      xaxis: baseXaxis(tk, {
        type: "category",
        tickAmount: Math.min(10, Math.max(2, sea.length - 1)),
        labels: {
          rotate: -45,
          rotateAlways: false,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" },
        },
      }),
      yaxis: baseYaxis(tk, {
        min: 0,
        max: 100,
        tickAmount: 5,
        labels: {
          formatter: (v) => `${Math.round(v)} %`,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      // Repère « 50 % » : seuil où la majorité des cyclones atteignent CT+.
      annotations: {
        yaxis: [
          {
            y: 50,
            strokeDashArray: 3,
            borderColor: tk.lineStrong,
            label: {
              text: "50 %",
              position: "left",
              borderWidth: 0,
              style: {
                background: "transparent",
                color: tk.textMute,
                fontFamily: MONO,
                fontSize: "10px",
              },
            },
          },
        ],
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (v) => (v == null ? "—" : `${Math.round(v)} %`) },
      },
    };
  }, [intensify, tk, t]);

  const calendarHeatOptions = useMemo(() => {
    // Domaine des valeurs (cyclones formés dans une case mois × décennie).
    const allVals = calendar.series.flatMap((s) => s.data.map((d) => d.y));
    const maxV = Math.max(1, ...allVals);
    // 0 = vert SOMBRE/calme (hors-saison) — s'efface dans le fond.
    const calm = rgbToHex(
      mixRgb(
        hexToRgb(tk.positive) || [37, 224, 154],
        hexToRgb(tk.bg) || [2, 9, 18],
        0.74,
      ),
    );
    // Activité : rampe MONOCHROME ROUGE (sans orange). 1 cyclone = rouge pâle,
    // de plus en plus saturé/profond à mesure que la saison est active.
    const neg = hexToRgb(tk.negative) || [255, 77, 109];
    const pale = mixRgb(neg, [255, 255, 255], 0.52); // rouge pâle (peu de cyclones)
    const deep = mixRgb(neg, [0, 0, 0], 0.3); // rouge profond (saison très active)
    const ranges = [{ from: 0, to: 0, color: calm }];
    for (let v = 1; v <= maxV; v += 1) {
      const t = maxV > 1 ? (v - 1) / (maxV - 1) : 0;
      ranges.push({ from: v, to: v, color: rgbToHex(mixRgb(pale, deep, t)) });
    }
    return {
      chart: baseChart(tk, { type: "heatmap" }),
      series: calendar.series,
      colors: [tk.positive],
      dataLabels: { enabled: false },
      plotOptions: {
        heatmap: {
          radius: 2,
          enableShades: false, // on contrôle entièrement les couleurs via ranges
          colorScale: { ranges },
        },
      },
      legend: { show: false },
      grid: baseGrid(tk),
      xaxis: {
        type: "category",
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "10px" },
        },
      },
      tooltip: {
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const s = w.config.series[seriesIndex];
          if (!s) return "";
          const cell = s.data && s.data[dataPointIndex];
          const month = s.name || "";
          const decade = cell ? cell.x : "";
          const val = cell ? cell.y : 0;
          return (
            `<div class="cmap-pop"><span class="cmap-pop__name">${month} · ${decade}</span>` +
            `<span class="cmap-pop__row">${val} ${t("act12.viz.season_series")}</span></div>`
          );
        },
      },
    };
  }, [calendar, tk, t]);

  const windPressOptions = useMemo(() => {
    // Droite de régression linéaire vent = a + b·pression, ajustée sur TOUS les
    // points → matérialise la relation physique (pression basse ⇒ vent fort).
    const wpSeries = windPress.map((s) => ({ ...s, type: "scatter" }));
    const pts = windPress.flatMap((s) => s.data);
    let trend = [];
    if (pts.length >= 2) {
      const n = pts.length;
      const sx = pts.reduce((a, p) => a + p.x, 0);
      const sy = pts.reduce((a, p) => a + p.y, 0);
      const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
      const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
      const denom = n * sxx - sx * sx;
      if (denom !== 0) {
        const b = (n * sxy - sx * sy) / denom;
        const a = (sy - b * sx) / n;
        const xs = pts.map((p) => p.x);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        trend = [
          { x: xMin, y: a + b * xMin },
          { x: xMax, y: a + b * xMax },
        ];
      }
    }
    const hasTrend = trend.length > 0;
    const series = hasTrend
      ? [
          ...wpSeries,
          { name: t("act12.viz.wp_relation"), type: "line", data: trend },
        ]
      : wpSeries;
    const stageCols = stages.map((s) => stageColors[s.id] || tk.accent);
    const colors = hasTrend ? [...stageCols, tk.text] : stageCols;
    // Réglages PAR SÉRIE : marqueurs pour les stades (points), trait pour la
    // seule droite de tendance (pas de marqueurs dessus).
    const mkSize = hasTrend ? [...stages.map(() => 6), 0] : stages.map(() => 6);
    const stWidth = hasTrend
      ? [...stages.map(() => 0), 2.5]
      : stages.map(() => 0);
    const stDash = hasTrend ? [...stages.map(() => 0), 6] : 0;
    return {
      chart: baseChart(tk, { type: "line" }),
      series,
      colors,
      stroke: { width: stWidth, dashArray: stDash, curve: "straight" },
      markers: { size: mkSize, strokeWidth: 0, hover: { size: 8 } },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "bottom",
        fontFamily: MONO,
        fontSize: "10px",
        labels: { colors: tk.textMute },
        markers: { width: 9, height: 9, radius: 2 },
        itemMargin: { horizontal: 5, vertical: 2 },
      },
      grid: baseGrid(tk),
      xaxis: {
        type: "numeric",
        title: {
          text: t("act12.viz.wp_x"),
          style: {
            color: tk.textMute,
            fontFamily: MONO,
            fontSize: "11px",
            fontWeight: 400,
          },
        },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
        axisBorder: { show: true, color: tk.line },
        axisTicks: { show: true, color: tk.line },
        tooltip: { enabled: false },
      },
      yaxis: {
        title: {
          text: t("act12.viz.wp_y"),
          style: {
            color: tk.textMute,
            fontFamily: MONO,
            fontSize: "11px",
            fontWeight: 400,
          },
        },
        labels: {
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
      },
      tooltip: {
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const d =
            w.config.series[seriesIndex] &&
            w.config.series[seriesIndex].data[dataPointIndex];
          // Pas d'info-bulle sur la droite de tendance (points sans nom).
          if (!d || d.name == null) return "";
          return (
            `<div class="cmap-pop"><span class="cmap-pop__name">${d.name}</span>` +
            `<span class="cmap-pop__row">${Math.round(d.y)} ${t("act12.map.kt")}</span>` +
            `<span class="cmap-pop__row">${Math.round(d.x)} ${t("act12.map.hpa")}</span></div>`
          );
        },
      },
    };
  }, [windPress, stages, stageColors, tk, t]);

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
                  <CycloneMap
                    cyclones={view}
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
                    speed={speed}
                    onSpeedChange={setSpeed}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "intensify",
            tab: t("act12.board.tab_intensify"),
            title: t("act12.viz.intensify_title"),
            finding: t("act12.viz.intensify_find"),
            empty: !intensify.seasons.length,
            node: <ApexChart key="intensify" options={intensifyLineOptions} />,
          },
          {
            id: "windpress",
            tab: t("act12.board.tab_windpress"),
            title: t("act12.viz.wp_title"),
            finding: t("act12.viz.wp_find"),
            empty: !windPress.some((s) => s.data.length),
            node: <ApexChart key="windpress" options={windPressOptions} />,
          },
          {
            id: "exposure",
            tab: t("act12.board.tab_exposure"),
            title: t("act12.viz.exposure_title"),
            finding: t("act12.viz.exposure_find"),
            empty: !exposure.length,
            node: <ApexChart key="exposure" options={exposureBarOptions} />,
          },
          {
            id: "stage",
            tab: t("act12.board.tab_stage"),
            title: t("act12.viz.bystage_title"),
            finding: t("act12.viz.bystage_find"),
            empty: !res.count,
            node: <ApexChart key="stage" options={stageBarOptions} />,
          },
          {
            id: "season",
            tab: t("act12.board.tab_season"),
            title: t("act12.viz.season_title"),
            finding: t("act12.viz.season_find"),
            empty: !bySeason.length,
            node: <ApexChart key="season" options={seasonBarOptions} />,
          },
          {
            id: "month",
            tab: t("act12.board.tab_month"),
            title: t("act12.viz.month_title"),
            finding: t("act12.viz.month_find"),
            empty: !calendar.hasData,
            node: <ApexChart key="month" options={calendarHeatOptions} />,
          },
          {
            id: "source",
            tab: t("act12.board.tab_source"),
            title: t("act12.source.title"),
            finding: t("act12.source.scope_note"),
            node: <ProvenancePanel t={t} />,
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
      charts={charts}
      nav="carousel"
      initialTab="map"
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
        viewGroup: t("act12.board.group_view"),
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
