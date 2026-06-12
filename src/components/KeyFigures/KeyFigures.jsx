// src/components/KeyFigures/KeyFigures.jsx
// ============================================================
// Bandeau de chiffres-clés RÉELS (Pacific Data Hub), juste sous le hero —
// le « chiffre-choc » qui ancre l'enjeu. Compteur animé au défilement, source
// visible. Aucune valeur inventée : tout est calculé depuis les données live ;
// une figure dont la donnée manque n'est pas affichée.
//
// MAJ : le niveau de la mer est une ANOMALIE (certains territoires montent,
// d'autres descendent) → la moyenne s'annule (« +0 mm »). On affiche désormais
// la HAUSSE MAXIMALE (territoire le plus exposé), un chiffre réel et parlant.
// Tokens only, FR/EN, zéro inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import useInView from "../../hooks/UseInView";
import "./KeyFigures.scss";

const DS = ["seaLevel", "renewables", "sst"];

const firstLast = (serie) => {
  const v = serie.filter((d) => Number.isFinite(d.value));
  return v.length ? { first: v[0], last: v[v.length - 1] } : null;
};
const avgLast = (data) => {
  const xs = [];
  Object.keys(data.byArea).forEach((g) => {
    if (!isPict(g)) return;
    const fl = firstLast(data.byArea[g]);
    if (fl) xs.push(fl.last.value);
  });
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
};
// Hausse MAXIMALE sur la période (territoire le plus exposé) — la moyenne
// d'une anomalie s'annule, l'extrême reste signifiant. Renvoie aussi le
// code du territoire concerné, pour pouvoir le nommer.
const maxRise = (data) => {
  let best = null; // { rise, code }
  Object.keys(data.byArea).forEach((g) => {
    if (!isPict(g)) return;
    const fl = firstLast(data.byArea[g]);
    if (fl && fl.first.year !== fl.last.year) {
      const r = fl.last.value - fl.first.value;
      if (best == null || r > best.rise) best = { rise: r, code: g };
    }
  });
  return best;
};
const countAreas = (data) => Object.keys(data.byArea).filter(isPict).length;

function CountUp({ target, decimals, prefix, suffix, run, lang }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return undefined;
    let raf = 0;
    const dur = 1200;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target]);
  const loc = lang === "fr" ? "fr-FR" : "en-US";
  const txt = new Intl.NumberFormat(loc, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
  return (
    <span className="keyfig__value">
      {prefix}
      {txt}
      {suffix ? <span className="keyfig__unit"> {suffix}</span> : null}
    </span>
  );
}

export default function KeyFigures() {
  const dispatch = useDispatch();
  const { lang, t } = useLang();
  const [ref, inView] = useInView({ threshold: 0.3 });

  useEffect(() => {
    DS.forEach((id) => dispatch(loadDataset(id)));
  }, [dispatch]);

  const sea = useSelector(selectDataset("seaLevel"));
  const renew = useSelector(selectDataset("renewables"));
  const sst = useSelector(selectDataset("sst"));

  const figures = useMemo(() => {
    const out = [];
    if (sea.status === "succeeded" && sea.data) {
      const n = countAreas(sea.data);
      if (n) out.push({ key: "territories", target: n, decimals: 0 });
      const top = maxRise(sea.data);
      // Les valeurs SLA sont en MÈTRES (anomalie vs réf. 1993–2012) → on
      // convertit en mm pour un chiffre lisible, comme l'acte Territoire
      // (Math.round(rise) seul donnait « +0 mm » : ~0,08 m arrondi à 0).
      // On joint le nom du territoire le plus exposé (area).
      if (top != null) {
        const riseMm = top.rise * 1000;
        out.push({
          key: "sea",
          target: Math.round(riseMm),
          decimals: 0,
          prefix: riseMm >= 0 ? "+" : "",
          suffix: "mm",
          area: pictName(top.code, lang),
        });
      }
    }
    if (renew.status === "succeeded" && renew.data) {
      const r = avgLast(renew.data);
      if (r != null) out.push({ key: "renew", target: Math.round(r), decimals: 0, suffix: "%" });
    }
    if (sst.status === "succeeded" && sst.data) {
      const s = avgLast(sst.data);
      if (s != null) out.push({ key: "sst", target: s, decimals: 1, prefix: s >= 0 ? "+" : "", suffix: "°C" });
    }
    return out;
  }, [sea, renew, sst, lang]);

  return (
    <section className="keyfigs" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="keyfigs__inner container">
        <p className="eyebrow keyfigs__kicker">{t("home.keyfigures.kicker")}</p>
        <ul className="keyfigs__grid">
          {figures.length === 0 && (
            <li className="keyfig keyfig--empty">{t("home.keyfigures.loading")}</li>
          )}
          {figures.map((f) => {
            // Label i18n + nom du territoire le plus exposé (figure « mer ») :
            // si la chaîne contient {area} on le remplace, sinon on l'ajoute —
            // robuste, que le JSON ait été mis à jour ou non.
            const rawLabel = t(`home.keyfigures.${f.key}_label`);
            const label = f.area
              ? rawLabel.includes("{area}")
                ? rawLabel.replace("{area}", f.area)
                : `${rawLabel} · ${f.area}`
              : rawLabel;
            return (
              <li className="keyfig" key={f.key}>
                <CountUp
                  target={f.target}
                  decimals={f.decimals}
                  prefix={f.prefix || ""}
                  suffix={f.suffix || ""}
                  run={inView}
                  lang={lang}
                />
                <span className="keyfig__label">{label}</span>
              </li>
            );
          })}
        </ul>
        <p className="keyfigs__source">{t("home.keyfigures.source")}</p>
      </div>
    </section>
  );
}