// src/components/PopGrowth/PopGrowth.jsx
// ============================================================
// SECTION SIGNATURE — « La colonne : la croissance démographique » (Home). Une
// COLONNE DE SILHOUETTES s'élève au-dessus d'une ligne de base quand la
// population CROÎT (+), s'enfonce en-dessous quand elle DÉCLINE (−), selon le
// TAUX DE CROISSANCE DÉMOGRAPHIQUE réel du territoire (% annuel, signé), via le
// dataset live `population` (CPS — DF_NMDI_POP · NMDI0002).
//
// Honnête : grand nombre = taux RÉEL (%, signé, dernière année) ; la HAUTEUR de
// la colonne encode ce taux normalisé sur l'amplitude du Pacifique (dit sous le
// visuel) ; lecture NEUTRE (croissance pleine / déclin évidé, sans jugement) ;
// tendance « depuis {année} » en ton neutre. Léger souffle (rAF) ; montée animée
// par GSAP. prefers-reduced-motion respecté. <section>/ref toujours montés.
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
import "./PopGrowth.scss";

const N = 5;
const COL_X = 120;
const BASE_Y = 128;
const GAP = 22;
const HEAD_R = 5.6;
const HEAD_CY = -8;
const BODY = "M-7.2,11 C-7.2,0 -4.3,-2.6 0,-2.6 C4.3,-2.6 7.2,0 7.2,11 Z";
const ABOVE = Array.from({ length: N }, (_, i) => BASE_Y - 16 - i * GAP);
const BELOW = Array.from({ length: N }, (_, i) => BASE_Y + 20 + i * GAP);

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

export default function PopGrowth() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.2 });
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [lang],
  );
  const signed = useCallback(
    (val) => (val < 0 ? "\u2212" : "+") + nf.format(Math.abs(val)),
    [nf],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ds = useSelector(selectDataset("population"));

  useEffect(() => {
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const status = ds.status;
  const ready = status === "succeeded" && ds.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(ds.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !Number.isFinite(pt.value)) return null;
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
    const amp = Math.max(...raw.map((o) => Math.abs(o.val))) || 1;
    return raw
      .map((o) => ({ ...o, w: Math.max(-1, Math.min(1, o.val / amp)) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, ds.data, lang]);

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

  /* ----------- Colonne ----------- */
  const aboveRefs = useRef([]);
  const belowRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ w: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const w = animObj.current.w;
      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.val);

      const up = clamp01(w) * N;
      const down = clamp01(-w) * N;

      aboveRefs.current.forEach((node, i) => {
        if (!node) return;
        const aff = clamp01(up - i);
        const bob = reduced ? 0 : 1.1 * Math.sin(phase * 1.4 + i);
        node.setAttribute("opacity", aff.toFixed(3));
        node.setAttribute("transform", `translate(0 ${bob.toFixed(2)})`);
      });
      belowRefs.current.forEach((node, i) => {
        if (!node) return;
        const aff = clamp01(down - i);
        const bob = reduced ? 0 : 1.1 * Math.sin(phase * 1.4 + i + 3);
        node.setAttribute("opacity", aff.toFixed(3));
        node.setAttribute("transform", `translate(0 ${bob.toFixed(2)})`);
      });
    },
    [reduced, signed],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;

    if (reduced || !startedRef.current) {
      animObj.current.w = sel.w;
      animObj.current.val = sel.val;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      w: sel.w,
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

  const valText = sel ? signed(sel.val) : "+0,0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.05)
      return (
        <span className="pop__trend">
          {fillTpl(t("home.pop.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="pop__trend">
          {fillTpl(t("home.pop.trend_up"), {
            n: nf.format(d),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="pop__trend">
        {fillTpl(t("home.pop.trend_down"), {
          n: nf.format(Math.abs(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.pop.aria"), { area: sel.name, n: valText, year: sel.year })
    : t("home.pop.title");

  return (
    <section className="pop" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="pop__inner container">
        <header className="pop__head">
          <p className="eyebrow pop__kicker">{t("home.pop.kicker")}</p>
          <h2 className="pop__title">{t("home.pop.title")}</h2>
          <p className="pop__lead">{t("home.pop.lead")}</p>
        </header>

        {loading && <p className="pop__state">{t("home.pop.loading")}</p>}
        {(failed || empty) && (
          <p className="pop__state pop__state--err">{t("home.pop.unavailable")}</p>
        )}

        {ready && sel && (
          <div className="pop__stage">
            {/* Colonne 1 — contrôles */}
            <div className="pop__controls">
              <label className="pop__field">
                <span className="pop__field-label">
                  {t("home.pop.select_label")}
                </span>
                <span className="pop__select">
                  <img
                    className="pop__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="pop__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.pop.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="pop__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="pop__chips">
                  <button
                    type="button"
                    className="pop__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.pop.highest")}
                    <em>{signed(extremes.high.val)}</em>
                  </button>
                  <button
                    type="button"
                    className="pop__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.pop.lowest")}
                    <em>{signed(extremes.low.val)}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la colonne de silhouettes */}
            <figure className="pop__viz">
              <svg
                className="pop__svg"
                viewBox="0 0 240 256"
                role="img"
                aria-label={svgLabel}
              >
                {/* silhouettes au-dessus (croissance) */}
                {ABOVE.map((y, i) => (
                  <g key={`a${i}`} transform={`translate(${COL_X} ${y})`}>
                    <g
                      ref={(n) => {
                        aboveRefs.current[i] = n;
                      }}
                      className="pop__fig pop__fig--up"
                      opacity="0"
                    >
                      <circle cx="0" cy={HEAD_CY} r={HEAD_R} />
                      <path d={BODY} />
                    </g>
                  </g>
                ))}

                {/* silhouettes en-dessous (déclin, évidées) */}
                {BELOW.map((y, i) => (
                  <g key={`b${i}`} transform={`translate(${COL_X} ${y})`}>
                    <g
                      ref={(n) => {
                        belowRefs.current[i] = n;
                      }}
                      className="pop__fig pop__fig--down"
                      opacity="0"
                    >
                      <circle cx="0" cy={HEAD_CY} r={HEAD_R} />
                      <path d={BODY} />
                    </g>
                  </g>
                ))}

                {/* ligne de base (zéro) */}
                <line
                  className="pop__baseline"
                  x1="44"
                  y1={BASE_Y}
                  x2="196"
                  y2={BASE_Y}
                />
                <text className="pop__zero" x="40" y={BASE_Y + 4}>
                  {t("home.pop.baseline_label")}
                </text>
              </svg>
              <figcaption className="pop__viz-cap">
                {t("home.pop.size_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="pop__readout">
              <p className={`pop__val ${sel.val < 0 ? "pop__val--neg" : ""}`}>
                <span ref={numberRef} className="pop__val-num">
                  {valText}
                </span>
                <span className="pop__val-unit">{t("home.pop.unit")}</span>
              </p>
              <p className="pop__val-cap">{t("home.pop.value_caption")}</p>
              <p className="pop__name">
                <img
                  className="pop__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="pop__year">
                {fillTpl(t("home.pop.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="pop__legend">
                  {fillTpl(t("home.pop.median_label"), { n: signed(medianVal) })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="pop__source">{t("home.pop.source")}</p>
      </div>
    </section>
  );
}