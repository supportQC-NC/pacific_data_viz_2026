// src/components/PlantGrowth/PlantGrowth.jsx
// ============================================================
// SECTION SIGNATURE #5 — « La plante qui pousse » (Home). Mécanisme organique :
// une plante GRANDIT (tige + feuilles + fruit) jusqu'au RENDEMENT AGRICOLE réel
// du territoire (kg/ha), via le dataset live `cropYield` (CPS — DF_CLIMATE_CHANGE,
// indicateur CROP_YIELD).
//
// Lecture honnête :
//   • grand nombre = rendement réel (kg/ha, dernière année connue) ;
//   • la HAUTEUR de la plante encode le rendement NORMALISÉ sur l'amplitude
//     observée du Pacifique (le plus productif = plante haute et feuillue, le
//     moins productif = pousse rabougrie) — c'est dit sous le visuel ;
//   • tendance « depuis {année} » = évolution réelle du rendement.
//
// Seuls les territoires AYANT une donnée sont proposés. Balancement + feuilles
// pilotés par rAF (attributs SVG) ; croissance animée par GSAP. prefers-reduced-
// motion respecté. La <section> (donc le ref useInView) est TOUJOURS montée.
// Tokens, FR/EN, zéro inline.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import useInView from "../../hooks/UseInView";
import "./PlantGrowth.scss";

const BASE_X = 120;
const BASE_Y = 268;

/* Feuilles le long de la tige : hauteur + côté + classe couleur. */
const LEAVES = [
  { y: 228, dir: -1, cls: "plant__leaf-a" },
  { y: 206, dir: 1, cls: "plant__leaf-b" },
  { y: 182, dir: -1, cls: "plant__leaf-b" },
  { y: 158, dir: 1, cls: "plant__leaf-a" },
  { y: 134, dir: -1, cls: "plant__leaf-a" },
  { y: 112, dir: 1, cls: "plant__leaf-b" },
];
function leafPath({ y, dir }) {
  const x = BASE_X;
  const tip = x + dir * 46;
  const c1 = x + dir * 28;
  const c2 = x + dir * 26;
  return `M${x},${y} Q${c1},${y - 16} ${tip},${y} Q${c2},${y + 10} ${x},${y} Z`;
}

function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function firstFinite(serie) {
  for (let i = 0; i < serie.length; i += 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function PlantGrowth() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView] = useInView({ threshold: 0.25 });
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const crop = useSelector(selectDataset("cropYield"));

  useEffect(() => {
    dispatch(loadDataset("cropYield"));
  }, [dispatch]);

  const status = crop.status;
  const ready = status === "succeeded" && crop.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(crop.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !(pt.value > 0)) return null;
        const f = firstFinite(serie);
        return {
          code,
          name: pictName(code, lang),
          val: pt.value,
          year: pt.year,
          delta: f ? pt.value - f.value : null,
          fromYear: f ? f.year : null,
        };
      })
      .filter(Boolean);
    if (!raw.length) return [];
    const vals = raw.map((o) => o.val);
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const span = vMax - vMin || 1;
    return raw
      .map((o) => ({ ...o, v: clamp01((o.val - vMin) / span) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, crop.data, lang]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianVal = useMemo(() => median(list.map((o) => o.val)), [list]);
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let best = list[0];
    let least = list[0];
    list.forEach((o) => {
      if (o.val > best.val) best = o;
      if (o.val < least.val) least = o;
    });
    return { best, least };
  }, [list]);

  // Défaut : le plus productif (plante luxuriante d'accueil).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.best.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;

  /* ----------- Animation : croissance ----------- */
  const plantRef = useRef(null);
  const numberRef = useRef(null);
  const leafRefs = useRef([]);
  const budRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nf.format(
          Math.round(animObj.current.val),
        );

      const swing = reduced ? 0 : 1;
      const sway = 2.6 * v * swing * Math.sin(phase * 0.8);
      const sy = 0.28 + 0.72 * v;
      const sx = 0.72 + 0.28 * v;
      if (plantRef.current)
        plantRef.current.setAttribute(
          "transform",
          `translate(${BASE_X} ${BASE_Y}) rotate(${sway.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-BASE_X} ${-BASE_Y})`,
        );

      leafRefs.current.forEach((node, i) => {
        if (!node) return;
        const appear = clamp01((v - i / LEAVES.length) * 2.2);
        node.setAttribute("opacity", appear.toFixed(3));
      });
      if (budRef.current)
        budRef.current.setAttribute(
          "opacity",
          clamp01((v - 0.55) / 0.3).toFixed(3),
        );
    },
    [reduced, nf],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = startedRef.current && sel ? sel.v : 0;
    const tval = startedRef.current && sel ? sel.val : 0;
    if (reduced) {
      animObj.current.v = tv;
      animObj.current.val = tval;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: tv,
      val: tval,
      duration: 1.25,
      ease: "power2.out",
    });
    return () => tw.kill();
  }, [inView, sel, reduced, draw]);

  useEffect(() => {
    if (reduced) return undefined;
    let raf = 0;
    let phase = 0;
    let last = performance.now();
    const loop = (now) => {
      phase += (now - last) / 1000;
      last = now;
      draw(phase);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, draw]);

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const valText = sel ? nf.format(Math.round(sel.val)) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.5)
      return (
        <span className="plant__trend plant__trend--flat">
          {fillTpl(t("home.plant.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d < 0)
      return (
        <span className="plant__trend plant__trend--down">
          {fillTpl(t("home.plant.trend_down"), {
            n: nf.format(Math.abs(Math.round(d))),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="plant__trend plant__trend--up">
        {fillTpl(t("home.plant.trend_up"), {
          n: nf.format(Math.round(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.plant.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.plant.title");

  return (
    <section
      className="plant"
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="plant__inner container">
        <header className="plant__head">
          <p className="eyebrow plant__kicker">{t("home.plant.kicker")}</p>
          <h2 className="plant__title">{t("home.plant.title")}</h2>
          <p className="plant__lead">{t("home.plant.lead")}</p>
        </header>

        {loading && <p className="plant__state">{t("home.plant.loading")}</p>}
        {(failed || empty) && (
          <p className="plant__state plant__state--err">
            {t("home.plant.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="plant__stage">
            {/* Colonne 1 — contrôles */}
            <div className="plant__controls">
              <label className="plant__field">
                <span className="plant__field-label">
                  {t("home.plant.select_label")}
                </span>
                <span className="plant__select">
                  <img
                    className="plant__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="plant__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.plant.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="plant__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="plant__chips">
                  <button
                    type="button"
                    className="plant__chip"
                    onClick={() => setSelected(extremes.best.code)}
                  >
                    {t("home.plant.highest")}
                    <em>{nf.format(Math.round(extremes.best.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="plant__chip"
                    onClick={() => setSelected(extremes.least.code)}
                  >
                    {t("home.plant.lowest")}
                    <em>{nf.format(Math.round(extremes.least.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la plante */}
            <figure className="plant__viz">
              <svg
                className="plant__svg"
                viewBox="0 0 240 300"
                role="img"
                aria-label={svgLabel}
              >
                {/* Sol */}
                <ellipse
                  className="plant__soil"
                  cx={BASE_X}
                  cy="270"
                  rx="74"
                  ry="11"
                />

                {/* Plante (mise à l'échelle selon le rendement) */}
                <g ref={plantRef}>
                  <path
                    className="plant__stem"
                    d="M120,268 C116,210 124,150 120,86"
                    fill="none"
                  />
                  {LEAVES.map((lf, i) => (
                    <path
                      key={i}
                      ref={(n) => {
                        leafRefs.current[i] = n;
                      }}
                      className={`plant__leaf ${lf.cls}`}
                      d={leafPath(lf)}
                      opacity="0"
                    />
                  ))}
                  {/* Fruit / fleur (éclôt quand le rendement est haut) */}
                  <g ref={budRef} className="plant__bud" opacity="0">
                    <circle className="plant__petal" cx="120" cy="74" r="6" />
                    <circle className="plant__petal" cx="112" cy="82" r="6" />
                    <circle className="plant__petal" cx="128" cy="82" r="6" />
                    <circle className="plant__petal" cx="120" cy="90" r="6" />
                    <circle className="plant__core" cx="120" cy="82" r="5" />
                  </g>
                </g>
              </svg>
              <figcaption className="plant__viz-cap">
                {t("home.plant.height_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="plant__readout">
              <p className="plant__val">
                <span ref={numberRef} className="plant__val-num">
                  {valText}
                </span>
                <span className="plant__val-unit">{t("home.plant.unit")}</span>
              </p>
              <p className="plant__val-cap">{t("home.plant.value_caption")}</p>
              <p className="plant__name">
                <img
                  className="plant__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="plant__year">
                {fillTpl(t("home.plant.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="plant__legend">
                  {fillTpl(t("home.plant.median_label"), {
                    n: nf.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="plant__source">{t("home.plant.source")}</p>
      </div>
    </section>
  );
}
