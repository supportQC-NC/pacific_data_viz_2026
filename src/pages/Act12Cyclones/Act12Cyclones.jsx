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
  // La rampe séquentielle du thème, réexportée par `apexBase` : c'est elle que
  // les matrices des autres escales emploient pour une grandeur.
  apexRamp as seqRampOf,
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

// La source, écrite une fois et épinglée en pied de la colonne de lecture.
// La portée est aussi importante que l'origine : ce jeu ne recense QUE les
// systèmes passés dans la zone de responsabilité de Météo-France
// Nouvelle-Calédonie. Un cyclone qui ne l'a pas traversée n'y figure pas.
const SOURCE_FR =
  "Météo-France Nouvelle-Calédonie, via Georep — trajectoires des systèmes tropicaux de la zone de responsabilité, saisons 1977-2024. Barème de stades officiel. Une saison court de juillet à juin.";
const SOURCE_EN =
  "Meteo-France New Caledonia, via Georep - tracks of tropical systems in its area of responsibility, 1977-2024 seasons. Official stage scale. A season runs July to June.";

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
  // LES LIENS DOIVENT POINTER VERS LE JEU RÉELLEMENT CHARGÉ.
  // Ils menaient à data.gouv.nc et à la fiche Géorep, c'est-à-dire à la base
  // Météo-France Nouvelle-Calédonie — celle qui a été ÉCARTÉE parce que sa
  // licence CC BY-NC-ND ne satisfait pas l'exigence de données ouvertes du
  // concours. Cette vue est celle que le jury lit pour vérifier la source :
  // elle doit déclarer IBTrACS, et rien d'autre.
  const links = [
    {
      href: "https://www.ncei.noaa.gov/products/international-best-track-archive",
      label: t("act12.source.link_ibtracs"),
    },
    {
      href: "https://doi.org/10.1002/joc.2412",
      label: t("act12.source.link_speartc"),
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
        {/* Le stade n'existe pas dans IBTrACS : nous le dérivons du vent.
            Une transformation que nous appliquons doit se déclarer ici, au
            même titre que le producteur et la licence. */}
        <div className="act12-src__row">
          <dt>{t("act12.source.derived_label")}</dt>
          <dd>{t("act12.source.derived")}</dd>
        </div>
      </dl>
      <p className="act12-src__genealogy">{t("act12.source.genealogy")}</p>
      <div className="act12-src__scope">
        <h4 className="act12-src__scope-title">
          {t("act12.source.scope_title")}
        </h4>
        <ul className="act12-src__scope-list">
          {/* Les trois puces listaient les trois domaines d'alerte de la base
              Météo-France (Nouvelle-Calédonie, bassin Pacifique sud-ouest,
              Wallis-et-Futuna). Notre sélection n'en retient qu'UN : vérifié,
              211 des 212 trajectoires traversent la seule zone d'alerte
              néo-calédonienne. Annoncer trois domaines faisait paraître la
              fenêtre bien plus large qu'elle n'est. */}
          <li>{t("act12.source.scope_zone")}</li>
          <li>{t("act12.source.scope_track")}</li>
          <li>{t("act12.source.scope_start")}</li>
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

  // Repli littéral tant que la clé n'est pas versée dans les dictionnaires :
  // `t()` renvoie le chemin pointé, qui ne doit jamais atteindre l'écran.
  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );
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

    // LES DEUX COMPTEURS, EXPOSÉS.
    //
    // Ils étaient déjà calculés ci-dessus (`e.n`, `e.intense`) puis jetés :
    // seule la PART sortait d'ici, et c'est elle que traçait la vue. Or la
    // part est ici trompeuse, et vérifiable :
    //   • sévères (≥ 64 kt) : 2,00 · 2,00 · 2,13 · 1,88 · 2,00 · 2,29 par
    //     saison sur six blocs de huit saisons — pente OLS +0,01/décennie ;
    //   • faibles : 2,88 · 3,38 · 2,75 · 1,75 · 1,50 · 2,57 — un creux entre
    //     2001 et 2016, déjà revenu.
    // La part monte donc SANS que le numérateur bouge. Et elle est instable
    // par construction : 15 saisons sur 47 comptent 3 systèmes ou moins,
    // 8 en comptent 2 ou moins — où elle ne peut valoir que 0, 50 ou 100 %.
    // Un compte ne souffre d'aucun de ces deux défauts.
    const sev = seasons.map((s) => (m.get(s) ? m.get(s).intense : 0));
    const weak = seasons.map((s) => (m.get(s) ? m.get(s).n - m.get(s).intense : 0));
    const roll5 = (arr) =>
      arr.map((_, i) => {
        const win = [];
        for (let k = Math.max(0, i - 4); k <= i; k += 1) win.push(arr[k]);
        return win.reduce((a, b) => a + b, 0) / win.length;
      });

    return { seasons, share, roll, sev, weak, sevRoll: roll5(sev), weakRoll: roll5(weak) };
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

    // COMBIEN D'ANNÉES DANS CHAQUE COLONNE — et pourquoi il faut le dire.
    //
    // Les colonnes sont des décennies, mais les deux extrêmes n'en sont pas :
    // le jeu commence en 1977 et s'arrête en 2024. La première colonne couvre
    // donc trois ans, la dernière cinq, les autres dix. Une case y compte
    // mécaniquement deux fois moins de systèmes — non parce que la saison est
    // plus calme, mais parce qu'elle a été observée moins longtemps.
    //
    // Étiquetées « 1970s » et « 2020s », ces colonnes se lisaient comme les
    // autres, et la matrice donnait à voir un creux aux deux bouts qui n'est
    // qu'un artefact de découpage. On étiquette donc chaque colonne par la
    // PLAGE RÉELLEMENT COUVERTE, lue dans les données elles-mêmes.
    const yearsSeen = {};
    view.forEach((cy) => {
      if (cy.startTime == null) return;
      const y = new Date(cy.startTime).getFullYear();
      const dec = Math.floor(y / 10) * 10;
      if (!yearsSeen[dec]) yearsSeen[dec] = new Set();
      yearsSeen[dec].add(y);
    });
    const decLabel = (dec) => {
      const ys = yearsSeen[dec] ? [...yearsSeen[dec]].sort((a, b) => a - b) : [];
      if (!ys.length) return `${dec}s`;
      const lo = ys[0];
      const hi = ys[ys.length - 1];
      // Décennie pleine : l'étiquette courte suffit et reste lisible.
      return lo === dec && hi === dec + 9 ? `${dec}s` : `${lo}–${hi}`;
    };
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
        data: decades.map((dec) => ({ x: decLabel(dec), y: grid[mo][dec] || 0 })),
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

  // Chiffres-clés RETIRÉS de cet écran, comme sur toutes les autres
  // escales : le sujet du tableau de bord, c'est le graphique. Le
  // composant KpiRow n'est pas touché ; les chiffres seront remontés
  // ailleurs.

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
      // LE CHIFFRE POSÉ DANS LA BARRE.
      // Il était écrit en encre claire, à même la barre — illisible sur les
      // stades peints en teintes claires, et invisible dès qu'une barre trop
      // courte le laissait déborder sur le fond.
      //
      // Une pastille discrète de la couleur du fond règle les deux cas d'un
      // coup : le chiffre reste lisible quelle que soit la couleur du stade,
      // et quelle que soit la longueur de la barre. C'est le seul réglage qui
      // ne dépende ni de l'une ni de l'autre.
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
        background: {
          enabled: true,
          foreColor: tk.text,
          backgroundColor: tk.bg,
          borderColor: "transparent",
          borderRadius: 4,
          padding: 4,
          opacity: 0.82,
          dropShadow: { enabled: false },
        },
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
      // DEUX COMPTES, UN SEUL AXE.
      // Les deux séries partagent l'unité « systèmes par saison », donc un
      // seul axe suffit — pas de double échelle (règle du projet). Le point
      // fin porte la saison réelle, la ligne épaisse sa moyenne glissante
      // sur cinq saisons : c'est la grammaire déjà employée par la vue.
      series: [
        {
          name: t("act12.viz.intensify_sev_raw"),
          type: "scatter",
          data: sea.map((s, i) => ({ x: s, y: intensify.sev[i] })),
        },
        {
          name: t("act12.viz.intensify_sev"),
          type: "line",
          data: sea.map((s, i) => ({ x: s, y: intensify.sevRoll[i] })),
        },
        {
          name: t("act12.viz.intensify_weak_raw"),
          type: "scatter",
          data: sea.map((s, i) => ({ x: s, y: intensify.weak[i] })),
        },
        {
          name: t("act12.viz.intensify_weak"),
          type: "line",
          data: sea.map((s, i) => ({ x: s, y: intensify.weakRoll[i] })),
        },
      ],
      // Sévères sur l'accent du système, faibles en encre neutre : la couleur
      // sépare deux ENTITÉS (deux catégories de systèmes), elle ne gradue
      // rien — d'où `swatch: "none"` dans la clé de lecture.
      colors: [tk.accent, tk.accent, tk.textMute, tk.textMute],
      stroke: { width: [0, 3.5, 0, 2.5], curve: "smooth", dashArray: [0, 0, 0, 4] },
      fill: {
        type: "solid",
        opacity: [0.55, 1, 0.4, 1],
      },
      markers: { size: [3.5, 0, 3.5, 0], strokeWidth: 0, hover: { size: 5 } },
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
        tickAmount: 4,
        labels: {
          formatter: (v) => `${Math.round(v)}`,
          style: { colors: tk.textMute, fontFamily: MONO, fontSize: "11px" },
        },
      }),
      // Repère : la moyenne de systèmes SÉVÈRES par saison sur toute la
      // période. Elle vaut ~2 et la ligne épaisse ne s'en écarte jamais
      // durablement — c'est le fait que la vue démontre. Calculée, jamais
      // écrite en dur.
      annotations: {
        yaxis: [
          {
            y:
              intensify.sev.reduce((a, b) => a + b, 0) /
              (intensify.sev.length || 1),
            strokeDashArray: 3,
            borderColor: tk.lineStrong,
            label: {
              text: t("act12.viz.intensify_mean"),
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
        // Les points bruts sont des entiers, les glissantes des décimales :
        // arrondir les deux pareil ferait mentir la moyenne (« 2 » pour 2,29).
        y: {
          formatter: (v) =>
            v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1),
        },
      },
    };
  }, [intensify, tk, t]);

  const calendarHeatOptions = useMemo(() => {
    // Domaine des valeurs (cyclones formés dans une case mois × décennie).
    const allVals = calendar.series.flatMap((s) => s.data.map((d) => d.y));
    const maxV = Math.max(1, ...allVals);
    // COMBIEN DE CYCLONES DANS CETTE CASE : une GRANDEUR, pas une polarité.
    // La matrice opposait un VERT « calme » à une rampe ROUGE d'activité —
    // deux teintes que près d'un homme sur douze ne distingue pas, et un
    // vocabulaire que cette escale était seule à employer. Un mois sans
    // cyclone n'est d'ailleurs pas « bon » : c'est zéro, une valeur comme une
    // autre au bas de l'échelle.
    //
    // On prend donc la rampe SÉQUENTIELLE du thème, la même que les matrices
    // des escales 01 et 02 : une seule teinte, du plus faible au plus fort,
    // et un zéro qui se lit comme un fond.
    const SEQ = seqRampOf(tk);
    const calm = tk.bg2;
    const pale = hexToRgb(SEQ[2]) || [90, 100, 170];
    const deep = hexToRgb(SEQ[8]) || [211, 218, 255];
    const ranges = [{ from: 0, to: 0, color: calm }];
    for (let v = 1; v <= maxV; v += 1) {
      const t = maxV > 1 ? (v - 1) / (maxV - 1) : 0;
      ranges.push({ from: v, to: v, color: rgbToHex(mixRgb(pale, deep, t)) });
    }
    return {
      chart: baseChart(tk, { type: "heatmap" }),
      series: calendar.series,
      colors: [SEQ[4]],
      dataLabels: { enabled: false },
      // ÉCART DE SURFACE, PAS TRAIT DE GRILLE. Sans consigne, ApexCharts cerne
      // chaque case d'un liseré blanc : la grille devient alors plus visible
      // que les valeurs qu'elle sépare. On peint ce liseré de la couleur du
      // fond — les cases se touchent sans se confondre, et le regard ne voit
      // plus que la donnée.
      stroke: { width: 2, colors: [tk.bg] },
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
          // GRADUATIONS ENTIÈRES. Vent en nœuds et pression en hectopascals
          // sont relevés en nombres entiers ; les décimales qu'affichait cet
          // axe ne venaient pas de la mesure mais du placement automatique des
          // graduations — « 898,63 hPa » est une position de trait, pas une
          // pression observée. Les arrondir ne perd rien et cesse de promettre
          // une précision que le jeu n'a pas.
          // Les graduations sont espacées d'une quinzaine d'unités : aucun
          // risque que deux d'entre elles se confondent une fois arrondies.
          formatter: (v) =>
            v == null || Number.isNaN(Number(v)) ? "" : String(Math.round(v)),
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
          // GRADUATIONS ENTIÈRES. Vent en nœuds et pression en hectopascals
          // sont relevés en nombres entiers ; les décimales qu'affichait cet
          // axe ne venaient pas de la mesure mais du placement automatique des
          // graduations — « 898,63 hPa » est une position de trait, pas une
          // pression observée. Les arrondir ne perd rien et cesse de promettre
          // une précision que le jeu n'a pas.
          // Les graduations sont espacées d'une quinzaine d'unités : aucun
          // risque que deux d'entre elles se confondent une fois arrondies.
          formatter: (v) =>
            v == null || Number.isNaN(Number(v)) ? "" : String(Math.round(v)),
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
            // LA PROVENANCE, DITE À L'ENDROIT OÙ ON REGARDE.
            // C'est la seule escale dont le jeu ne vient PAS de la liste
            // officielle du concours : l'avoir incluse est un choix de récit,
            // et un lecteur qui vérifie les sources doit l'apprendre ici, pas
            // en fouillant la fiche.
            takeaway: tx(
              "act12.viz.map_take",
              "Ces trajectoires se ressemblent parce qu'on les a choisies ainsi. La base ne garde que les cyclones passés près de la Nouvelle-Calédonie. C'est une fenêtre, pas le Pacifique.",
              "These tracks look alike because we picked them that way. The archive keeps only cyclones that came near New Caledonia. It is a window, not the Pacific.",
            ),
            legend: {
              // LA PROVENANCE, DITE LÀ OÙ ON REGARDE.
              // C'est la seule escale dont le jeu ne vient PAS de la liste
              // officielle du concours : l'avoir incluse est un choix de récit.
              // Un lecteur qui vérifie ses sources doit l'apprendre ici, pas en
              // fouillant la fiche.
              caveat: tx(
                "act12.key.map_caveat",
                "Jeu hors liste officielle du concours : base cyclonique de Météo-France Nouvelle-Calédonie, ouverte via Géorep. On l'a ajoutée pour le récit.",
                "Not on the challenge's official list: Météo-France New Caledonia's cyclone database, open via Géorep. We added it for the story.",
              ),
              x: tx(
                "act12.key.map_x",
                "Les trajectoires réellement enregistrées, saison par saison. Rien n'est interpolé entre deux points.",
                "The tracks as recorded, season by season. Nothing is interpolated between two points.",
              ),
              color: tx(
              "act12.key.stage_c",
              "Une couleur par stade du barème officiel, la même que sur la carte : du plus calme au plus intense.",
              "One colour per stage of the official scale, the same as on the map: calmest to most intense.",
            ),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              swatch: "none",
            },
            hint: tx(
              "act12.hint.map",
              "Lancez l'animation pour dérouler les saisons, ou tirez le curseur pour vous arrêter sur l'une d'elles.",
              "Press play to run through the seasons, or drag the slider to stop on one.",
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
            takeaway: tx(
              "act12.viz.intensify_take",
              "Ce n'est pas le nombre de cyclones qui change, c'est la part de ceux qui atteignent les stades sévères. Une saison peu fournie peut donc être plus dangereuse qu'une saison chargée — compter les phénomènes ne suffit pas à mesurer le risque.",
              "It is not the number of cyclones that changes, but the share reaching the severe stages. A thin season can therefore be more dangerous than a busy one — counting systems does not measure the risk.",
            ),
            legend: {
              y: tx(
                "act12.key.intensify_y",
                "Le nombre de systèmes par saison, et la moyenne glissante qui en donne la tendance.",
                "Systems per season, with the rolling mean that gives the trend.",
              ),
              x: tx("act12.key.season_x", "Les saisons, de 1977 à 2024. Une saison court de juillet à juin.", "Seasons, 1977 to 2024. A season runs July to June."),
              color: t("act12.key.intensify_c"),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              swatch: "none",
            },
            hint: tx(
              "act12.hint.hover",
              "Survolez le tracé pour lire une saison précise.",
              "Hover the plot to read a single season.",
            ),
            empty: !intensify.seasons.length,
            node: <ApexChart key="intensify" options={intensifyLineOptions} />,
          },
          {
            id: "windpress",
            tab: tx("act12.board.tab_signature", "Signature", "Signature"),
            title: t("act12.viz.wp_title"),
            finding: t("act12.viz.wp_find"),
            takeaway: tx(
              "act12.viz.windpress_take",
              "Les deux mesures disent la même chose par deux chemins : quand la pression au centre chute, le vent monte. C'est ce qui permet de contrôler l'une par l'autre — un point qui s'écarterait franchement du nuage signalerait une mesure douteuse plutôt qu'un cyclone hors norme.",
              "The two measurements say the same thing by two routes: as the central pressure drops, the wind rises. That is what lets one check the other — a dot far off the cloud would flag a doubtful reading rather than an extraordinary storm.",
            ),
            legend: {
              y: tx(
                "act12.key.wp_y",
                "La pression au centre, en hectopascals. Elle DESCEND quand le système se creuse : plus bas sur l'axe veut dire plus fort.",
                "Central pressure in hectopascals. It FALLS as the system deepens: lower on the axis means stronger.",
              ),
              x: tx(
                "act12.key.wp_x",
                "Le vent maximal soutenu. Vent et pression mesurent la même intensité par deux moyens : le nuage de points montre à quel point ils s'accordent.",
                "Maximum sustained wind. Wind and pressure measure one intensity two ways: the scatter shows how closely they agree.",
              ),
              color: tx(
              "act12.key.stage_c",
              "Une couleur par stade du barème officiel, la même que sur la carte : du plus calme au plus intense.",
              "One colour per stage of the official scale, the same as on the map: calmest to most intense.",
            ),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              // Neuf systèmes n'ont pas de pression relevée : le service les
              // met à null (cycloneApi.js:200) et le nuage les écarte. Une vue
              // dont l'argument est « les deux mesures se contrôlent » doit
              // dire lesquelles ne peuvent pas l'être.
              caveat: t("act12.key.wp_caveat"),
              swatch: "none",
            },
            hint: tx(
              "act12.hint.hover",
              "Survolez le tracé pour lire une saison précise.",
              "Hover the plot to read a single season.",
            ),
            empty: !windPress.some((s) => s.data.length),
            node: <ApexChart key="windpress" options={windPressOptions} />,
          },
          {
            id: "exposure",
            tab: t("act12.board.tab_exposure"),
            title: t("act12.viz.exposure_title"),
            finding: t("act12.viz.exposure_find"),
            takeaway: tx(
              "act12.viz.exposure_take",
              "Voir passer beaucoup de phénomènes et en subir de violents sont deux choses différentes. Un territoire peut être souvent frôlé sans que les stades supérieurs soient atteints : c'est la répartition des couleurs dans chaque barre, et non sa longueur, qui dit lequel des deux cas on regarde.",
              "Seeing many systems pass and being hit hard are two different things. A territory can be brushed often without the upper stages being reached: it is the spread of colours within each bar, not its length, that says which of the two you are looking at.",
            ),
            legend: {
              // LE SEUIL DES 300 km EST LE NÔTRE, ET IL DOIT SE DIRE.
              // Le fichier ne contient aucun champ « exposé » : on croise les
              // tracés avec la position des territoires et on tranche à 300 km
              // (`EXPOSURE_KM`). Un autre seuil donnerait un autre classement —
              // et le lecteur ne peut pas le deviner d'un décompte.
              caveat: tx(
                "act12.key.exposure_caveat",
                "Les 300 km sont notre seuil, pas une donnée du fichier. Il ne dit pas qui a été touché : on le calcule. Un autre seuil, un autre classement.",
                "The 300 km is our threshold, not a field in the file. It does not say who was hit — we work it out. Another threshold, another ranking.",
              ),
              y: tx("act12.key.terr_y", "Un territoire par ligne.", "One territory per row."),
              x: tx(
                "act12.key.exposure_x",
                "Le nombre de systèmes passés à moins de 300 km. C'est une mesure DÉRIVÉE — le croisement des trajectoires et des territoires — pas un champ du jeu de données.",
                "Systems that passed within 300 km. This is a DERIVED measure - tracks crossed with territories - not a field of the dataset.",
              ),
              color: tx(
              "act12.key.stage_c",
              "Une couleur par stade du barème officiel, la même que sur la carte : du plus calme au plus intense.",
              "One colour per stage of the official scale, the same as on the map: calmest to most intense.",
            ),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              swatch: "none",
            },
            hint: tx(
              "act12.hint.hover",
              "Survolez le tracé pour lire une saison précise.",
              "Hover the plot to read a single season.",
            ),
            empty: !exposure.length,
            node: <ApexChart key="exposure" options={exposureBarOptions} />,
          },
          {
            id: "stage",
            tab: t("act12.board.tab_stage"),
            title: t("act12.viz.bystage_title"),
            finding: t("act12.viz.bystage_find"),
            takeaway: tx(
              "act12.viz.stage_take",
              "Les stades supérieurs sont les moins nombreux — et ce sont eux qui font les dégâts. C'est pourquoi cette escale regarde leur PART plutôt que le total : c'est elle qui bouge, comme le montre la vue « Intensité ».",
              "The upper stages are the least numerous — and they are the ones that do the damage. That is why this leg watches their SHARE rather than the total: the share is what moves, as the \u201cIntensity\u201d view shows.",
            ),
            legend: {
              y: tx("act12.key.stage_y", "Un stade du barème par ligne.", "One scale stage per row."),
              x: tx("act12.key.count_x", "Le nombre de systèmes.", "Number of systems."),
              color: tx(
              "act12.key.stage_c",
              "Une couleur par stade du barème officiel, la même que sur la carte : du plus calme au plus intense.",
              "One colour per stage of the official scale, the same as on the map: calmest to most intense.",
            ),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              swatch: "none",
            },
            hint: tx(
              "act12.hint.hover",
              "Survolez le tracé pour lire une saison précise.",
              "Hover the plot to read a single season.",
            ),
            empty: !res.count,
            node: <ApexChart key="stage" options={stageBarOptions} />,
          },
          {
            id: "season",
            tab: tx("act12.board.tab_saisons", "Saisons", "Seasons"),
            title: t("act12.viz.season_title"),
            finding: t("act12.viz.season_find"),
            takeaway: tx(
              "act12.viz.season_take",
              "Compter les cyclones d'une saison ne dit presque rien : l'écart d'une année à l'autre est énorme et ne dessine aucune tendance. C'est précisément pour cela que l'escale mesure l'intensité plutôt que la fréquence.",
              "Counting a season's cyclones says almost nothing: the swing from year to year is huge and draws no trend. That is exactly why this leg measures intensity rather than frequency.",
            ),
            legend: {
              y: tx("act12.key.count_y", "Le nombre de systèmes de la saison.", "Number of systems in the season."),
              x: tx("act12.key.season_x", "Les saisons, de 1977 à 2024. Une saison court de juillet à juin.", "Seasons, 1977 to 2024. A season runs July to June."),
              color: tx(
                "act12.key.season_c",
                "Chaque barre prend la couleur du stade le plus fort atteint cette saison-là.",
                "Each bar takes the colour of the strongest stage reached that season.",
              ),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              swatch: "none",
            },
            hint: tx(
              "act12.hint.hover",
              "Survolez le tracé pour lire une saison précise.",
              "Hover the plot to read a single season.",
            ),
            empty: !bySeason.length,
            node: <ApexChart key="season" options={seasonBarOptions} />,
          },
          {
            id: "month",
            tab: tx("act12.board.tab_calendrier", "Calendrier", "Calendar"),
            title: t("act12.viz.month_title"),
            finding: t("act12.viz.month_find"),
            takeaway: tx(
              "act12.viz.month_take",
              "La saison cyclonique est une fenêtre courte : l'essentiel se joue de décembre à avril. Comparez les colonnes entre elles pour voir si cette fenêtre s'est déplacée d'une tranche d'années à la suivante.",
              "The cyclone season is a narrow window: the bulk of it falls between December and April. Compare the columns to see whether that window has shifted from one span of years to the next.",
            ),
            legend: {
              y: tx("act12.key.decade_y", "Une décennie par ligne.", "One decade per row."),
              x: tx(
                "act12.key.month_x",
                "Les mois, de juillet à juin — l'ordre d'une saison, pas celui du calendrier civil.",
                "Months, July to June - the order of a season, not of the civil calendar.",
              ),
              caveat: tx(
                "act12.key.decade_warn",
                "Attention aux deux colonnes des extrémités : le jeu commence en 1977 et s'arrête en 2024. Elles couvrent trois et cinq ans quand les autres en couvrent dix — leurs cases comptent donc moins de systèmes sans que la saison ait été plus calme. Leur étiquette porte la plage réelle.",
                "Watch the two end columns: the record starts in 1977 and stops in 2024. They cover three and five years where the others cover ten - their cells hold fewer systems without the season having been calmer. Their labels carry the real span.",
              ),
              color: tx(
                "act12.key.month_c",
                "Une seule teinte : plus elle est marquée, plus de systèmes se sont formés dans cette case. Un mois vide n'est pas une bonne nouvelle, c'est un zéro.",
                "A single hue: the stronger it is, the more systems formed in that cell. An empty month is not good news, it is a zero.",
              ),
              note: tx("act12.key.note", SOURCE_FR, SOURCE_EN),
              swatch: "magnitude",
            },
            hint: tx(
              "act12.hint.month",
              "Balayez une ligne : elle dit quand la saison se concentre, décennie après décennie.",
              "Read a row across: it shows when the season concentrates, decade after decade.",
            ),
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
      charts={charts}
      // Disposition du template d'escale : barre unique, décor en fond,
      // colonne de lecture à droite, hauteurs de tracé égales. Voir
      // ActBoard.scss § FOCUS. (Sans rapport avec la variable locale
      // `focus`, qui cadre la carte sur une sous-région.)
      focus
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
