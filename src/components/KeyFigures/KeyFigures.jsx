// src/components/KeyFigures/KeyFigures.jsx
// ============================================================
// Bandeau de chiffres-clés RÉELS (Pacific Data Hub), juste sous le hero —
// le « chiffre-choc » qui ancre l'enjeu. Compteur animé au défilement, source
// visible. Aucune valeur inventée : tout est calculé depuis les données live ;
// une figure dont la donnée manque n'est pas affichée.
// Tokens only, FR/EN, zéro inline.
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict } from "../../i18n/pictNames";
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
const avgRise = (data) => {
  const xs = [];
  Object.keys(data.byArea).forEach((g) => {
    if (!isPict(g)) return;
    const fl = firstLast(data.byArea[g]);
    if (fl && fl.first.year !== fl.last.year) xs.push(fl.last.value - fl.first.value);
  });
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
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
      {prefix}{txt}{suffix ? <span className="keyfig__unit"> {suffix}</span> : null}
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
      const rise = avgRise(sea.data);
      if (rise != null) out.push({ key: "sea", target: Math.round(rise), decimals: 0, prefix: rise >= 0 ? "+" : "", suffix: "mm" });
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
  }, [sea, renew, sst]);

  return (
    <section className="keyfigs" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="keyfigs__inner container">
        <p className="eyebrow keyfigs__kicker">{t("home.keyfigures.kicker")}</p>
        <ul className="keyfigs__grid">
          {figures.length === 0 && (
            <li className="keyfig keyfig--empty">{t("home.keyfigures.loading")}</li>
          )}
          {figures.map((f) => (
            <li className="keyfig" key={f.key}>
              <CountUp
                target={f.target}
                decimals={f.decimals}
                prefix={f.prefix || ""}
                suffix={f.suffix || ""}
                run={inView}
                lang={lang}
              />
              <span className="keyfig__label">{t(`home.keyfigures.${f.key}_label`)}</span>
            </li>
          ))}
        </ul>
        <p className="keyfigs__source">{t("home.keyfigures.source")}</p>
      </div>
    </section>
  );
}