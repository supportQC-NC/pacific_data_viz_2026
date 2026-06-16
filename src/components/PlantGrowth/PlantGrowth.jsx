// src/components/PlantGrowth/PlantGrowth.jsx
// ============================================================
// SECTION SIGNATURE #5 — « La plante qui pousse » (Home). Mécanisme organique :
// une plante GRANDIT (tige + feuilles + petite fleur) jusqu'au RENDEMENT
// AGRICOLE réel du territoire (kg/ha), via le dataset live `cropYield`
// (CPS — DF_CLIMATE_CHANGE, indicateur CROP_YIELD).
//
// v2 : feuillage plus fourni (8 feuilles + nervures), léger flutter des
// feuilles, touffes d'herbe à la base, petite fleur TOUJOURS présente, et un
// MINIMUM garanti (hauteur + 1-2 feuilles) pour que les faibles rendements
// ressemblent à une pousse, pas à un trait.
//
// Lecture honnête : grand nombre = rendement réel (kg/ha) ; la HAUTEUR encode
// le rendement NORMALISÉ sur l'amplitude du Pacifique (dit sous le visuel) ;
// tendance « depuis {année} » = évolution réelle. Seuls les territoires avec
// donnée sont proposés. Animation rAF + GSAP, prefers-reduced-motion respecté.
// La <section> (ref useInView) est TOUJOURS montée. Tokens, FR/EN, zéro inline.
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
const STEM_TOP = 84;

/* Feuilles le long de la tige : hauteur + côté + classe couleur. */
const LEAVES = [
  { y: 240, dir: -1, cls: "plant__leaf-a" },
  { y: 222, dir: 1, cls: "plant__leaf-b" },
  { y: 202, dir: -1, cls: "plant__leaf-b" },
  { y: 182, dir: 1, cls: "plant__leaf-a" },
  { y: 162, dir: -1, cls: "plant__leaf-a" },
  { y: 142, dir: 1, cls: "plant__leaf-b" },
  { y: 122, dir: -1, cls: "plant__leaf-b" },
  { y: 104, dir: 1, cls: "plant__leaf-a" },
];
function leafPath({ y, dir }) {
  const x = BASE_X;
  const tip = x + dir * 52;
  return `M${x},${y} Q${x + dir * 30},${y - 20} ${tip},${y - 4} Q${x + dir * 34},${y + 14} ${x},${y} Z`;
}
function veinPath({ y, dir }) {
  const x = BASE_X;
  const tip = x + dir * 48;
  return `M${x},${y} Q${x + dir * 28},${y - 7} ${tip},${y - 3}`;
}

/* Touffes d'herbe à la base (statiques). */
const GRASS = [
  "M92,268 Q89,254 95,247",
  "M104,269 Q102,257 106,249",
  "M134,269 Q133,256 138,248",
  "M148,268 Q150,254 145,246",
];

/* Petite fleur : 6 pétales (radius 6,5 autour du sommet de tige). */
const FLOWER_R = 6.5;
const PETALS = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3;
  return [
    +(BASE_X + FLOWER_R * Math.cos(a)).toFixed(2),
    +(STEM_TOP + FLOWER_R * Math.sin(a)).toFixed(2),
  ];
});

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
  const [ref, inView, visible] = useInView({ threshold: 0.25 });
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
      const sway = 2.4 * (0.5 + 0.5 * v) * swing * Math.sin(phase * 0.8);
      const sy = 0.46 + 0.54 * v; // minimum garanti : 46 % de hauteur
      const sx = 0.8 + 0.2 * v;
      if (plantRef.current)
        plantRef.current.setAttribute(
          "transform",
          `translate(${BASE_X} ${BASE_Y}) rotate(${sway.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-BASE_X} ${-BASE_Y})`,
        );

      leafRefs.current.forEach((node, i) => {
        if (!node) return;
        const flutter = reduced
          ? 0
          : 3 * (0.4 + 0.6 * v) * Math.sin(phase * 1.7 + i * 0.9);
        // Les 1-2 feuilles basses restent visibles même à v=0 (vraie pousse).
        const appear = clamp01((v - (i - 1.5) / LEAVES.length) * 1.8);
        node.setAttribute(
          "transform",
          `rotate(${flutter.toFixed(2)} ${BASE_X} ${LEAVES[i].y})`,
        );
        node.setAttribute("opacity", appear.toFixed(3));
      });

      // Fleur : toujours présente, petite, grandit un peu avec le rendement.
      if (budRef.current) {
        const fs = 0.78 + 0.32 * v;
        const fsw = reduced ? 0 : 2 * Math.sin(phase * 0.8 + 0.4);
        budRef.current.setAttribute(
          "transform",
          `translate(${BASE_X} ${STEM_TOP}) rotate(${fsw.toFixed(2)}) scale(${fs.toFixed(3)}) translate(${-BASE_X} ${-STEM_TOP})`,
        );
      }
    },
    [reduced, nf],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = sel ? sel.v : 0;
    const tval = sel ? sel.val : 0;
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
    if (!visible) return undefined;
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
  }, [reduced, visible, draw]);

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
    <section className="plant" ref={ref} data-inview={inView ? "true" : "false"}>
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
                {/* Sol + herbe */}
                <ellipse
                  className="plant__soil"
                  cx={BASE_X}
                  cy="270"
                  rx="78"
                  ry="12"
                />
                <g className="plant__grass" aria-hidden="true">
                  {GRASS.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>

                {/* Plante (mise à l'échelle selon le rendement) */}
                <g ref={plantRef}>
                  <path
                    className="plant__stem"
                    d="M120,268 C115,208 125,146 120,84"
                    fill="none"
                  />

                  {LEAVES.map((lf, i) => (
                    <g
                      key={i}
                      ref={(n) => {
                        leafRefs.current[i] = n;
                      }}
                      opacity="0"
                    >
                      <path className={`plant__leaf ${lf.cls}`} d={leafPath(lf)} />
                      <path className="plant__vein" d={veinPath(lf)} fill="none" />
                    </g>
                  ))}

                  {/* Petite fleur, toujours présente */}
                  <g ref={budRef} className="plant__bud">
                    {PETALS.map(([cx, cy], i) => (
                      <circle
                        key={i}
                        className="plant__petal"
                        cx={cx}
                        cy={cy}
                        r="4.4"
                      />
                    ))}
                    <circle
                      className="plant__core"
                      cx={BASE_X}
                      cy={STEM_TOP}
                      r="4.2"
                    />
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