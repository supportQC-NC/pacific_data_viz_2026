// src/components/ForestCover/ForestCover.jsx
// ============================================================
// SECTION SIGNATURE — « La forêt : couverture des sols » (Home). Un bosquet se
// GARNIT ou s'ÉCLAIRCIT selon l'INDICE DE COUVERTURE DES SOLS modifiant le
// climat (CALCI, base 2015 = 100) du territoire, via le dataset live
// `landCover` (FMI d'après FAO — DF_CLIMATE_CHANGE · ALT_LAND_COVER).
//
// Lecture NEUTRE (polarité neutre) : l'indice se lit comme un ÉCART à 2015
// (=100), pas comme une superficie ni un « bien/mal ». Grand nombre = indice
// RÉEL ; la densité du bosquet est normalisée sur l'amplitude du Pacifique (dit
// sous le visuel) ; tendance « depuis {année} » en ton neutre. Feuillage animé
// (rAF) ; densité animée par GSAP. prefers-reduced-motion respecté.
// <section>/ref toujours montés. Tokens, FR/EN, zéro inline.
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
import "./ForestCover.scss";

const TREES = [
  { x: 44, s: 1.0, cls: "forest__canopy-a" },
  { x: 96, s: 0.86, cls: "forest__canopy-b" },
  { x: 150, s: 1.1, cls: "forest__canopy-a" },
  { x: 206, s: 0.92, cls: "forest__canopy-b" },
  { x: 262, s: 1.02, cls: "forest__canopy-a" },
  { x: 316, s: 0.84, cls: "forest__canopy-b" },
];
const PIVOT_Y = 156;
const CANOPY = [
  [0, -12, 22],
  [-18, 2, 16],
  [18, 2, 16],
  [0, 10, 18],
];

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

export default function ForestCover() {
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

  const land = useSelector(selectDataset("landCover"));

  useEffect(() => {
    dispatch(loadDataset("landCover"));
  }, [dispatch]);

  const status = land.status;
  const ready = status === "succeeded" && land.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(land.data.byArea)
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
  }, [ready, land.data, lang]);

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
    let high = list[0];
    let low = list[0];
    list.forEach((o) => {
      if (o.val > high.val) high = o;
      if (o.val < low.val) low = o;
    });
    return { high, low };
  }, [list]);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.high.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;

  /* ----------- Feuillage ----------- */
  const canopyRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nf.format(Math.round(animObj.current.val));

      const scaleV = 0.32 + 0.68 * v;
      canopyRefs.current.forEach((node, i) => {
        if (!node) return;
        const tree = TREES[i];
        const sway = reduced ? 0 : 2.4 * (0.4 + 0.6 * v) * Math.sin(phase * 1.2 + i);
        const sc = (tree.s * scaleV).toFixed(3);
        node.setAttribute(
          "transform",
          `translate(${tree.x} ${PIVOT_Y}) rotate(${sway.toFixed(2)}) scale(${sc}) translate(${-tree.x} ${-PIVOT_Y})`,
        );
        const appear = clamp01(0.18 + (v - i / (TREES.length + 1)) * 1.7);
        node.setAttribute("opacity", appear.toFixed(3));
      });
    },
    [reduced, nf],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;

    if (reduced || !startedRef.current) {
      animObj.current.v = sel.v;
      animObj.current.val = sel.val;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: sel.v,
      val: sel.val,
      duration: 1.2,
      ease: "power2.out",
    });
    return () => tw.kill();
  }, [inView, sel, reduced, draw]);

  useEffect(() => {
    if (reduced) {
      draw(0);
      return undefined;
    }
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
        <span className="forest__trend">
          {fillTpl(t("home.forest.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="forest__trend">
          {fillTpl(t("home.forest.trend_up"), {
            n: nf.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="forest__trend">
        {fillTpl(t("home.forest.trend_down"), {
          n: nf.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.forest.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.forest.title");

  return (
    <section className="forest" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="forest__inner container">
        <header className="forest__head">
          <p className="eyebrow forest__kicker">{t("home.forest.kicker")}</p>
          <h2 className="forest__title">{t("home.forest.title")}</h2>
          <p className="forest__lead">{t("home.forest.lead")}</p>
        </header>

        {loading && <p className="forest__state">{t("home.forest.loading")}</p>}
        {(failed || empty) && (
          <p className="forest__state forest__state--err">
            {t("home.forest.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="forest__stage">
            {/* Colonne 1 — contrôles */}
            <div className="forest__controls">
              <label className="forest__field">
                <span className="forest__field-label">
                  {t("home.forest.select_label")}
                </span>
                <span className="forest__select">
                  <img
                    className="forest__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="forest__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.forest.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="forest__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="forest__chips">
                  <button
                    type="button"
                    className="forest__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.forest.highest")}
                    <em>{nf.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="forest__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.forest.lowest")}
                    <em>{nf.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — le bosquet */}
            <figure className="forest__viz">
              <svg
                className="forest__svg"
                viewBox="0 0 360 240"
                role="img"
                aria-label={svgLabel}
              >
                {/* Sol */}
                <ellipse
                  className="forest__soil"
                  cx="180"
                  cy="214"
                  rx="172"
                  ry="13"
                />

                {/* Arbres */}
                {TREES.map((tree, i) => (
                  <g key={i}>
                    <path
                      className="forest__trunk"
                      d={`M${tree.x},210 L${tree.x},${PIVOT_Y}`}
                      fill="none"
                    />
                    <g
                      ref={(n) => {
                        canopyRefs.current[i] = n;
                      }}
                      className={`forest__canopy ${tree.cls}`}
                      opacity="0"
                    >
                      {CANOPY.map(([dx, dy, r], k) => (
                        <circle
                          key={k}
                          cx={tree.x + dx}
                          cy={140 + dy}
                          r={r}
                        />
                      ))}
                    </g>
                  </g>
                ))}

                {/* Touffes d'herbe */}
                <g className="forest__grass" aria-hidden="true">
                  <path d="M70,212 Q67,202 73,196" fill="none" />
                  <path d="M132,213 Q130,203 135,197" fill="none" />
                  <path d="M240,213 Q238,203 243,197" fill="none" />
                  <path d="M300,212 Q302,202 297,196" fill="none" />
                </g>
              </svg>
              <figcaption className="forest__viz-cap">
                {t("home.forest.density_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="forest__readout">
              <p className="forest__val">
                <span ref={numberRef} className="forest__val-num">
                  {valText}
                </span>
                <span className="forest__val-unit">{t("home.forest.unit")}</span>
              </p>
              <p className="forest__val-cap">{t("home.forest.value_caption")}</p>
              <p className="forest__name">
                <img
                  className="forest__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="forest__year">
                {fillTpl(t("home.forest.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="forest__legend">
                  {fillTpl(t("home.forest.median_label"), {
                    n: nf.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="forest__source">{t("home.forest.source")}</p>
      </div>
    </section>
  );
}