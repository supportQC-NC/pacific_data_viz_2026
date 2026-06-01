// src/components/CropExplorer/CropExplorer.jsx
// ============================================================
// Explorateur par culture :
//   • rangée de chips PAYS (Tous + chaque territoire) qui filtre la grille
//     pour ne montrer que les cultures présentes dans ce territoire ;
//   • grille d'icônes par culture ; au clic, trajectoire du rendement par
//     territoire (TrendLines) + classement de la dernière année (RankBars).
// Données réelles via agriApi. Peut recevoir la donnée déjà chargée par
// l'acte (prop `data`) pour éviter un second appel ; sinon il charge
// lui-même. État honnête si indisponible.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchAgriProduction } from "../../services/agriApi";
import TrendLines from "../TrendLines/TrendLines";
import RankBars from "../RankBars/RankBars";
import CropIcon from "../CropIcons/CropIcons";
import "./CropExplorer.scss";

function pictAreas(d) {
  return d ? d.areas.filter(isPict) : [];
}
function areaHasData(d, geo) {
  return !!d && (d.byArea[geo] || []).some((p) => Number.isFinite(p.value));
}
function stateFrom(res) {
  const ok = res && res.source === "live" && res.commodities && res.commodities.length;
  return { status: ok ? "ready" : "empty", data: ok ? res : null };
}

export default function CropExplorer({ data: dataProp = null }) {
  const { t, lang } = useLang();
  const [state, setState] = useState(() =>
    dataProp ? stateFrom(dataProp) : { status: "loading", data: null },
  );
  const [selected, setSelected] = useState(null);
  const [country, setCountry] = useState("all");

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

  // Cultures (hors bétail) ayant au moins 2 territoires PICT avec données.
  const allCrops = useMemo(() => {
    if (!state.data) return [];
    return state.data.commodities
      .filter((c) => c.kind === "crop")
      .filter((c) => pictAreas(state.data.byCommodity[c.code]).length >= 2);
  }, [state.data]);

  // Liste des pays présents (sur l'ensemble des cultures), triée par nom.
  const countries = useMemo(() => {
    if (!state.data) return [];
    const set = new Set();
    allCrops.forEach((c) => {
      pictAreas(state.data.byCommodity[c.code]).forEach((a) => {
        if (areaHasData(state.data.byCommodity[c.code], a)) set.add(a);
      });
    });
    return [...set]
      .map((a) => ({ code: a, name: pictName(a, lang) }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [state.data, allCrops, lang]);

  // Grille filtrée par pays sélectionné.
  const crops = useMemo(() => {
    if (country === "all") return allCrops;
    return allCrops.filter((c) => areaHasData(state.data.byCommodity[c.code], country));
  }, [allCrops, country, state.data]);

  useEffect(() => {
    if (crops.length && (selected == null || !crops.some((c) => c.code === selected))) {
      setSelected(crops[0].code);
    }
  }, [crops, selected]);

  const cur = selected && state.data ? state.data.byCommodity[selected] : null;
  const curMeta = crops.find((c) => c.code === selected) || allCrops.find((c) => c.code === selected);

  const series = useMemo(() => {
    if (!cur) return [];
    return pictAreas(cur).map((a) => ({
      area: a,
      name: pictName(a, lang),
      values: (cur.byArea[a] || []).filter((p) => Number.isFinite(p.value)),
    }));
  }, [cur, lang]);

  const points = useMemo(() => {
    if (!cur) return [];
    return pictAreas(cur)
      .map((a) => {
        const p = (cur.byArea[a] || []).find((q) => q.year === cur.lastYear);
        return p && Number.isFinite(p.value)
          ? { area: a, name: pictName(a, lang), value: p.value, year: cur.lastYear }
          : null;
      })
      .filter(Boolean);
  }, [cur, lang]);

  const median = useMemo(() => {
    if (!points.length) return 0;
    const v = points.map((p) => p.value).sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }, [points]);

  if (state.status === "loading")
    return <p className="cropx__state">{t("scene.loading")}</p>;
  if (state.status === "empty" || !allCrops.length)
    return <p className="cropx__state cropx__state--empty">{t("act6.explorer_empty")}</p>;

  return (
    <div className="cropx">
      <div className="cropx__pickbar">
        <span className="cropx__pick-lbl">{t("act6.explorer_country")}</span>
        <div className="cropx__countrybar">
          <button
            className={`cropx__country ${country === "all" ? "is-active" : ""}`}
            onClick={() => setCountry("all")}
            aria-pressed={country === "all"}
          >
            {t("act6.explorer_all")}
          </button>
          {countries.map((c) => (
            <button
              key={c.code}
              className={`cropx__country ${country === c.code ? "is-active" : ""}`}
              onClick={() => setCountry(c.code)}
              aria-pressed={country === c.code}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="cropx__pickbar">
        <span className="cropx__pick-lbl">
          {t("act6.explorer_pick")} · {crops.length}
        </span>
        <div className="cropx__grid">
          {crops.map((c) => (
            <button
              key={c.code}
              className={`cropx__chip ${selected === c.code ? "is-active" : ""}`}
              onClick={() => setSelected(c.code)}
              title={c.label}
              aria-pressed={selected === c.code}
            >
              <CropIcon label={c.label} className="cropx__chip-ic" />
              <span className="cropx__chip-lbl">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {cur && (
        <div className="cropx__panel">
          <div className="cropx__panel-head">
            <CropIcon label={curMeta?.label} className="cropx__panel-ic" />
            <div>
              <h3 className="cropx__panel-title">{curMeta?.label}</h3>
              <span className="cropx__panel-sub">
                {curMeta?.unit} · {cur.firstYear}–{cur.lastYear} · {series.length}{" "}
                {t("act2.coverage")}
              </span>
            </div>
          </div>

          <div className="cropx__chart">
            <h4 className="cropx__chart-title">{t("act6.explorer_trend")}</h4>
            <TrendLines
              series={series}
              years={cur.years}
              currentYear={cur.lastYear}
              unit={curMeta?.unit || ""}
            />
          </div>

          <div className="cropx__chart">
            <h4 className="cropx__chart-title">
              {t("act6.explorer_rank")} · {cur.lastYear}
            </h4>
            <RankBars
              data={points}
              unit={curMeta?.unit || ""}
              worldAvg={median}
              refLabel={t("act6.pac_ref")}
            />
          </div>
        </div>
      )}
    </div>
  );
}