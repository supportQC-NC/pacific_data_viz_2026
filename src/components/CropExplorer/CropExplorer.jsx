// src/components/CropExplorer/CropExplorer.jsx
// ============================================================
// Explorateur par culture / animal — DEUX VOLETS.
//
//   • à GAUCHE, le CATALOGUE : tous les produits du type, classés par
//     rendement, cherchables, chacun avec sa courbe miniature et le nombre de
//     territoires qui le produisent ;
//   • à DROITE, le produit retenu, lu de DEUX FAÇONS : sa trajectoire
//     territoire par territoire, ou la course animée des territoires.
//
// La course était une vue à part, avec SON PROPRE menu de produit — un second
// sélecteur pour la même chose, neuf onglets plus loin. Elle devient un mode
// de lecture : on choisit un produit une fois, on le regarde comme on veut.
//
// Ce que remplace le catalogue : un menu déroulant. Un menu ne dit ni ce qui
// existe, ni ce qui compte, ni combien de territoires produisent quoi — on y
// choisissait parmi des dizaines d'intitulés sans rien savoir d'eux. La liste
// est donc devenue un graphique : le classement, la miniature et le décompte
// répondent avant qu'on ait cliqué.
//
// Le filtre de territoire, lui, a quitté ce composant : il vit dans la
// colonne de lecture de l'escale, comme sur toutes les autres vues.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchAgriProduction } from "../../services/agriApi";
import TrendLines from "../TrendLines/TrendLines";
import BarRace from "../BarRace/BarRace";
import VizSwitch from "../VizSwitch/VizSwitch";
import useThemeTokens from "../../hooks/UseThemeTokens";
import CropIcon from "../CropIcons/CropIcons";
import { fmt } from "../charts/apexBase";
import "./CropExplorer.scss";

function pictAreas(d) {
  return d ? d.areas.filter(isPict) : [];
}
function areaHasData(d, geo) {
  return !!d && (d.byArea[geo] || []).some((p) => Number.isFinite(p.value));
}
function median(a) {
  const v = [...a].sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Format court pour la liste : « 380k » tient dans une colonne étroite là où
// « 380 571 » la ferait déborder.
function fmtCompact(v) {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace(".0", "")}M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}k`;
  return fmt(v);
}

// MINIATURE DU PRODUIT : la médiane régionale dans le temps, tracée sur une
// échelle COMMUNE à toute la liste. Mise à son propre maximum, chaque courbe
// aurait la même amplitude et deux produits de niveaux très différents se
// ressembleraient — la miniature ne dirait plus rien du niveau.
function Spark({ values, max }) {
  const pts = (values || []).map((v, i) => ({ v, i }));
  const known = pts.filter((p) => Number.isFinite(p.v));
  if (known.length < 2) return <span className="cropx__spark" aria-hidden="true" />;
  const W = 64;
  const H = 20;
  const n = pts.length - 1 || 1;
  const d = known
    .map((p, k) => {
      const x = (p.i / n) * W;
      const y = H - (p.v / (max || 1)) * H;
      return `${k ? "L" : "M"}${x.toFixed(1)},${Math.max(1, y).toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      className="cropx__spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="none" />
    </svg>
  );
}

function stateFrom(res) {
  const ok =
    res && res.source === "live" && res.commodities && res.commodities.length;
  return { status: ok ? "ready" : "empty", data: ok ? res : null };
}

export default function CropExplorer({
  data: dataProp = null,
  kind = "crop",
  // Filtre de SOUS-RÉGION de l'escale, sous forme de prédicat. C'était un
  // second menu propre à ce composant ; il vit maintenant dans la colonne de
  // lecture, et il porte ici sur la même dimension que sur toutes les autres
  // vues — la sous-région, pas un territoire isolé.
  areaVisible = null,
  labels = {},
}) {
  const { t, lang } = useLang();
  const [state, setState] = useState(() =>
    dataProp ? stateFrom(dataProp) : { status: "loading", data: null },
  );
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  // « trend » : la trajectoire. « race » : la course animée. Deux lectures
  // d'un même produit, pas deux vues à choisir dans la barre.
  const [mode, setMode] = useState("trend");
  const tk = useThemeTokens();

  useEffect(() => {
    if (dataProp) {
      setState(stateFrom(dataProp));
      return undefined;
    }
    let alive = true;
    const ctrl = new AbortController();
    fetchAgriProduction({ signal: ctrl.signal, lang }).then((res) => {
      if (alive) setState(stateFrom(res));
    });
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [dataProp, lang]);

  // Tous les produits du type (indépendant du territoire → pas d'état impossible).
  const allCrops = useMemo(() => {
    if (!state.data) return [];
    return state.data.commodities
      .filter((c) => c.kind === kind)
      .filter((c) => pictAreas(state.data.byCommodity[c.code]).length >= 2);
  }, [state.data, kind]);

  useEffect(() => {
    if (
      allCrops.length &&
      (selected == null || !allCrops.some((c) => c.code === selected))
    ) {
      setSelected(allCrops[0].code);
    }
  }, [allCrops, selected]);

  const cur = selected && state.data ? state.data.byCommodity[selected] : null;
  const curMeta = allCrops.find((c) => c.code === selected);
  const unit = curMeta?.unit || "";

  // Territoires qui PRODUISENT le produit choisi (liste dynamique).
  const prodAreas = useMemo(
    () => (cur ? pictAreas(cur).filter((a) => areaHasData(cur, a)) : []),
    [cur],
  );

  const allSeries = useMemo(
    () =>
      cur
        ? prodAreas.map((a) => ({
            area: a,
            name: pictName(a, lang),
            values: (cur.byArea[a] || []).filter((p) =>
              Number.isFinite(p.value),
            ),
          }))
        : [],
    [cur, prodAreas, lang],
  );

  // Le filtre est celui de l'escale : il arrive en prop plutôt que d'être un
  // second menu propre à cette vue.
  const trendSeries = useMemo(
    () =>
      typeof areaVisible === "function"
        ? allSeries.filter((s) => areaVisible(s.area))
        : allSeries,
    [allSeries, areaVisible],
  );

  // SÉRIES DE COURSE. La course a besoin d'une valeur à CHAQUE année : une
  // barre qui disparaît puis revient donnerait un classement qui saute. On
  // reporte donc la dernière valeur connue sur les années manquantes — c'est
  // du remplissage d'affichage, jamais une donnée inventée : la trajectoire,
  // elle, montre les trous tels quels.
  const raceSeries = useMemo(() => {
    if (!cur) return [];
    return trendSeries
      .map((s) => {
        const known = [...s.values].sort((a, b) => a.year - b.year);
        let last = null;
        const values = (cur.years || []).map((y) => {
          const ex = known.find((p) => p.year === y);
          if (ex) last = ex.value;
          return { year: y, value: last == null ? 0 : last };
        });
        return { ...s, values };
      })
      .filter((s) => s.values.some((v) => v.value > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, trendSeries]);

  // ---- LE CATALOGUE ----------------------------------------------------
  // Chaque produit est décrit par ce qu'on a besoin de savoir AVANT de le
  // choisir : combien de territoires en produisent, à quel niveau, et quelle
  // allure a la médiane régionale dans le temps. Un menu déroulant ne disait
  // rien de tout cela — on choisissait à l'aveugle parmi des dizaines
  // d'intitulés.
  const catalogue = useMemo(() => {
    if (!state.data) return [];
    return allCrops
      .map((c) => {
        const d = state.data.byCommodity[c.code];
        const areas = d ? pictAreas(d).filter((a) => areaHasData(d, a)) : [];
        // Médiane régionale par année : une courbe par produit, pas une par
        // territoire — c'est l'allure du produit qu'on résume ici.
        const byYear = (d?.years || []).map((y) => {
          const vs = areas
            .map((a) => (d.byArea[a] || []).find((p) => p.year === y)?.value)
            .filter(Number.isFinite);
          return vs.length ? median(vs) : null;
        });
        const known = byYear.filter(Number.isFinite);
        return {
          code: c.code,
          label: c.label,
          unit: c.unit || "",
          areas: areas.length,
          last: known.length ? known[known.length - 1] : null,
          spark: byYear,
        };
      })
      // Classement par niveau du dernier point connu : le catalogue est
      // lui-même un graphique, pas une liste alphabétique.
      .sort((a, b) => (b.last ?? -Infinity) - (a.last ?? -Infinity));
  }, [state.data, allCrops]);

  // Bornes communes à toutes les miniatures : sans elles, chaque courbe
  // serait mise à son propre maximum et deux produits de niveaux très
  // différents auraient la même allure.
  const sparkMax = useMemo(() => {
    const all = catalogue.flatMap((c) => c.spark).filter(Number.isFinite);
    return all.length ? Math.max(...all) : 1;
  }, [catalogue]);

  if (state.status === "loading")
    return <p className="cropx__state">{t("scene.loading")}</p>;
  if (state.status === "empty" || !allCrops.length)
    return (
      <p className="cropx__state cropx__state--empty">
        {t("act6.explorer_empty")}
      </p>
    );

  const query = search.trim().toLowerCase();
  const shown = query
    ? catalogue.filter((c) => c.label.toLowerCase().includes(query))
    : catalogue;


  return (
    <div className="cropx">
      {/* ---------- VOLET GAUCHE : LE CATALOGUE ----------
          Il remplace le menu déroulant. Un menu ne dit ni ce qui existe, ni
          ce qui compte, ni combien de territoires produisent quoi : on y
          choisissait à l'aveugle. Ici la liste EST un graphique — produits
          classés par rendement, courbe miniature, nombre de territoires. */}
      <aside className="cropx__cat" aria-label={labels.pick || t("act6.explorer_pick")}>
        <div className="cropx__search">
          <span className="cropx__search-ic" aria-hidden="true">
            {"⌕"}
          </span>
          <input
            className="cropx__search-in"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${labels.pick || t("act6.explorer_pick")} · ${catalogue.length}`}
            aria-label={labels.pick || t("act6.explorer_pick")}
          />
        </div>

        <ul className="cropx__list">
          {shown.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className={`cropx__item ${c.code === selected ? "is-on" : ""}`}
                onClick={() => setSelected(c.code)}
                aria-pressed={c.code === selected}
              >
                <CropIcon label={c.label} className="cropx__item-ic" />
                <span className="cropx__item-body">
                  <span className="cropx__item-name">{c.label}</span>
                  <span className="cropx__item-meta">
                    {c.last != null ? fmtCompact(c.last) : "—"}
                    <i aria-hidden="true"> · </i>
                    {c.areas} {t("act2.coverage")}
                  </span>
                </span>
                <Spark values={c.spark} max={sparkMax} />
              </button>
            </li>
          ))}
          {!shown.length ? (
            <li className="cropx__empty">{t("act6.explorer_empty")}</li>
          ) : null}
        </ul>
      </aside>

      {/* ---------- VOLET DROIT : LA TRAJECTOIRE ----------
          Plus de carte interne ni de grand titre : la colonne de lecture de
          l'escale porte déjà le titre de la vue. Il ne reste que la ligne qui
          situe la mesure — unité, période, nombre de territoires. */}
      {cur ? (
        <div className="cropx__view">
          <div className="cropx__view-head">
            <p className="cropx__view-sub">
              <strong>{curMeta?.label}</strong>
              <i aria-hidden="true"> · </i>
              {unit}
              <i aria-hidden="true"> · </i>
              {cur.firstYear}–{cur.lastYear}
              <i aria-hidden="true"> · </i>
              {prodAreas.length} {t("act2.coverage")}
            </p>

            {/* DEUX LECTURES D'UN MÊME PRODUIT.
                La course était une vue à part, neuf onglets plus loin, avec
                son propre menu de produit : on refaisait le choix qu'on venait
                de faire. Elle devient un mode — la trajectoire montre le
                niveau et les trous, la course montre le classement qui
                bouge. */}
            <VizSwitch
              items={[
                { id: "trend", label: labels.trend || t("act6.board.tab_land_traj") },
                { id: "race", label: labels.race || t("act6.board.tab_race") },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>

          <div className="cropx__chart">
            {mode === "race" ? (
              <BarRace
                series={raceSeries}
                years={cur.years}
                unit={unit}
                decimals={0}
                tk={tk}
                labels={labels.race_ctl}
              />
            ) : (
              <TrendLines
                series={trendSeries}
                years={cur.years}
                currentYear={cur.lastYear}
                unit={unit}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
