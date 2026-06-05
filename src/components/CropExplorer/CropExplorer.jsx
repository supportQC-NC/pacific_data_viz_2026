// src/components/CropExplorer/CropExplorer.jsx
// ============================================================
// Explorateur par culture / animal :
//   • menu PRODUIT (indépendant) — tous les produits du type ;
//   • menu TERRITOIRE (dynamique) — territoires qui PRODUISENT le produit,
//     filtre la trajectoire ;
//   • TrendLines (trajectoire du rendement par territoire).
// Les deux menus sont robustes : la sélection est revalidée à chaque
// changement (fonctionne dans n'importe quel ordre).
// Menus stylés via les classes globales .act1f* (chargées par la page).
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { useLang } from "../../store/context/langContext";
import { pictName, isPict } from "../../i18n/pictNames";
import { fetchAgriProduction } from "../../services/agriApi";
import TrendLines from "../TrendLines/TrendLines";
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

function Drop({ label, value, onChange, options }) {
  return (
    <div className="act1f act1f--select cropx__drop">
      <span className="act1f__lbl">{label}</span>
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

export default function CropExplorer({ data: dataProp = null, kind = "crop", labels = {} }) {
  const { t, lang } = useLang();
  const [state, setState] = useState(() => (dataProp ? stateFrom(dataProp) : { status: "loading", data: null }));
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

  // Tous les produits du type (indépendant du territoire → pas d'état impossible).
  const allCrops = useMemo(() => {
    if (!state.data) return [];
    return state.data.commodities
      .filter((c) => c.kind === kind)
      .filter((c) => pictAreas(state.data.byCommodity[c.code]).length >= 2);
  }, [state.data, kind]);

  useEffect(() => {
    if (allCrops.length && (selected == null || !allCrops.some((c) => c.code === selected))) {
      setSelected(allCrops[0].code);
    }
  }, [allCrops, selected]);

  const cur = selected && state.data ? state.data.byCommodity[selected] : null;
  const curMeta = allCrops.find((c) => c.code === selected);
  const unit = curMeta?.unit || "";

  // Territoires qui PRODUISENT le produit choisi (liste dynamique).
  const prodAreas = useMemo(() => (cur ? pictAreas(cur).filter((a) => areaHasData(cur, a)) : []), [cur]);
  const territories = useMemo(
    () => prodAreas.map((a) => ({ code: a, name: pictName(a, lang) })).sort((x, y) => x.name.localeCompare(y.name)),
    [prodAreas, lang],
  );

  useEffect(() => {
    if (country !== "all" && !prodAreas.includes(country)) setCountry("all");
  }, [prodAreas, country]);

  const allSeries = useMemo(
    () => (cur ? prodAreas.map((a) => ({ area: a, name: pictName(a, lang), values: (cur.byArea[a] || []).filter((p) => Number.isFinite(p.value)) })) : []),
    [cur, prodAreas, lang],
  );

  const trendSeries = useMemo(() => (country === "all" ? allSeries : allSeries.filter((s) => s.area === country)), [allSeries, country]);

  if (state.status === "loading") return <p className="cropx__state">{t("scene.loading")}</p>;
  if (state.status === "empty" || !allCrops.length) return <p className="cropx__state cropx__state--empty">{t("act6.explorer_empty")}</p>;

  const cropOpts = allCrops.map((c) => ({ v: c.code, label: c.label }));
  const countryOpts = [{ v: "all", label: t("act6.explorer_all") }, ...territories.map((c) => ({ v: c.code, label: c.name }))];

  return (
    <div className="cropx">
      <div className="cropx__drops">
        <Drop label={`${labels.pick || t("act6.explorer_pick")} · ${allCrops.length}`} value={selected ?? ""} onChange={setSelected} options={cropOpts} />
        <Drop label={t("act6.explorer_country")} value={country} onChange={setCountry} options={countryOpts} />
      </div>

      {cur && (
        <div className="cropx__panel">
          <div className="cropx__panel-head">
            <CropIcon label={curMeta?.label} className="cropx__panel-ic" />
            <div>
              <h3 className="cropx__panel-title">{curMeta?.label}</h3>
              <span className="cropx__panel-sub">
                {unit} · {cur.firstYear}–{cur.lastYear} · {prodAreas.length} {t("act2.coverage")}
              </span>
            </div>
          </div>

          <div className="cropx__chart">
            <h4 className="cropx__chart-title">{t("act6.explorer_trend")}</h4>
            <TrendLines series={trendSeries} years={cur.years} currentYear={cur.lastYear} unit={unit} />
          </div>
        </div>
      )}
    </div>
  );
}