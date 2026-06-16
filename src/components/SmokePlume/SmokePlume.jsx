// src/components/SmokePlume/SmokePlume.jsx
// ============================================================
// SECTION SIGNATURE #8 — « Le panache : ce que l'on rejette » (Home). LA CAUSE.
// Une cheminée fume selon les ÉMISSIONS de GES par habitant réelles du
// territoire (t CO₂e/hab.), via le dataset live `emissions`
// (Banque mondiale — DF_CLIMATE_CHANGE · GHG_EMI_CAPITA).
//
// Plus le territoire émet par habitant, plus le panache est DENSE, HAUT et
// SOMBRE, et plus le ciel se voile ; faible émetteur = fumée ténue, ciel clair.
//
// Honnête : grand nombre = émissions RÉELLES (t CO₂e/hab., dernière année) ;
// l'épaisseur du panache est normalisée sur l'amplitude du Pacifique (dit sous
// le visuel) ; tendance « depuis {année} » réelle (hausse = pire, en corail ;
// baisse = mieux, en vert). Fumée animée (rAF) ; bascule animée par GSAP.
// prefers-reduced-motion respecté. <section>/ref toujours montés. Tokens,
// FR/EN, zéro inline.
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
import "./SmokePlume.scss";

const MOUTH_X = 160;
const MOUTH_Y = 176;
const RISE = 150;
const N_PUFF = 40;
const PUFFS = Array.from({ length: N_PUFF }, (_, i) => ({
  off: (i * 0.137) % 1,
  sp: 0.05 + (i % 5) * 0.011,
  amp: 8 + (i % 7) * 3.2,
  fr: 2.4 + (i % 4) * 0.5,
  rj: (i % 4) * 1.6,
}));

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

export default function SmokePlume() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView] = useInView({ threshold: 0.25 });
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [lang],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const emis = useSelector(selectDataset("emissions"));

  useEffect(() => {
    dispatch(loadDataset("emissions"));
  }, [dispatch]);

  const status = emis.status;
  const ready = status === "succeeded" && emis.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(emis.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !(pt.value >= 0)) return null;
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
  }, [ready, emis.data, lang]);

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

  // Défaut : le plus gros émetteur par habitant (panache marquant).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.high.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;

  /* ----------- Fumée ----------- */
  const puffRefs = useRef([]);
  const hazeRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nf.format(animObj.current.val);
      if (hazeRef.current)
        hazeRef.current.setAttribute("opacity", (0.3 * v).toFixed(3));

      puffRefs.current.forEach((node, i) => {
        if (!node) return;
        const gate = clamp01(v * N_PUFF - i);
        if (gate <= 0) {
          node.setAttribute("opacity", "0");
          return;
        }
        const p = PUFFS[i];
        const tt = reduced ? p.off : (phase * p.sp + p.off) % 1;
        const y = MOUTH_Y - tt * RISE;
        const x =
          MOUTH_X + p.amp * Math.sin(tt * p.fr + p.off * 6) * (0.35 + tt);
        const r = 3 + tt * 9 + p.rj;
        const op = (1 - tt) * (0.22 + 0.5 * v) * gate;
        node.setAttribute("cx", x.toFixed(1));
        node.setAttribute("cy", y.toFixed(1));
        node.setAttribute("r", r.toFixed(1));
        node.setAttribute("opacity", op.toFixed(3));
      });
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

  const valText = sel ? nf.format(sel.val) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.05)
      return (
        <span className="smoke__trend smoke__trend--flat">
          {fillTpl(t("home.smoke.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="smoke__trend smoke__trend--up">
          {fillTpl(t("home.smoke.trend_up"), {
            n: nf.format(d),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="smoke__trend smoke__trend--down">
        {fillTpl(t("home.smoke.trend_down"), {
          n: nf.format(Math.abs(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.smoke.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.smoke.title");

  return (
    <section
      className="smoke"
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="smoke__inner container">
        <header className="smoke__head">
          <p className="eyebrow smoke__kicker">{t("home.smoke.kicker")}</p>
          <h2 className="smoke__title">{t("home.smoke.title")}</h2>
          <p className="smoke__lead">{t("home.smoke.lead")}</p>
        </header>

        {loading && <p className="smoke__state">{t("home.smoke.loading")}</p>}
        {(failed || empty) && (
          <p className="smoke__state smoke__state--err">
            {t("home.smoke.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="smoke__stage">
            {/* Colonne 1 — contrôles */}
            <div className="smoke__controls">
              <label className="smoke__field">
                <span className="smoke__field-label">
                  {t("home.smoke.select_label")}
                </span>
                <span className="smoke__select">
                  <img
                    className="smoke__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="smoke__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.smoke.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="smoke__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="smoke__chips">
                  <button
                    type="button"
                    className="smoke__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.smoke.highest")}
                    <em>{nf.format(extremes.high.val)}</em>
                  </button>
                  <button
                    type="button"
                    className="smoke__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.smoke.lowest")}
                    <em>{nf.format(extremes.low.val)}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — le panache */}
            <figure className="smoke__viz">
              <svg
                className="smoke__svg"
                viewBox="0 0 320 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="smoke-frame">
                    <rect x="0" y="0" width="320" height="300" rx="16" />
                  </clipPath>
                </defs>

                <g clipPath="url(#smoke-frame)">
                  <rect
                    className="smoke__bg"
                    x="0"
                    y="0"
                    width="320"
                    height="300"
                  />
                  <rect
                    ref={hazeRef}
                    className="smoke__haze"
                    x="0"
                    y="0"
                    width="320"
                    height="170"
                    opacity="0"
                  />

                  {/* Fumée */}
                  <g className="smoke__puffs">
                    {PUFFS.map((p, i) => (
                      <circle
                        key={i}
                        ref={(n) => {
                          puffRefs.current[i] = n;
                        }}
                        className="smoke__puff"
                        cx={MOUTH_X}
                        cy={MOUTH_Y}
                        r="4"
                        opacity="0"
                      />
                    ))}
                  </g>

                  {/* Sol */}
                  <ellipse
                    className="smoke__ground"
                    cx="160"
                    cy="258"
                    rx="120"
                    ry="14"
                  />

                  {/* Cheminée */}
                  <g className="smoke__stack">
                    <rect
                      className="smoke__base"
                      x="118"
                      y="226"
                      width="84"
                      height="34"
                      rx="3"
                    />
                    <polygon
                      className="smoke__chimney"
                      points="150,176 170,176 176,236 144,236"
                    />
                    <rect
                      className="smoke__band"
                      x="146"
                      y="186"
                      width="28"
                      height="6"
                    />
                    <rect
                      className="smoke__band"
                      x="145"
                      y="200"
                      width="30"
                      height="6"
                    />
                    <ellipse
                      className="smoke__mouth"
                      cx="160"
                      cy="176"
                      rx="10"
                      ry="3.4"
                    />
                  </g>
                </g>

                <rect
                  className="smoke__frame"
                  x="1"
                  y="1"
                  width="318"
                  height="298"
                  rx="16"
                  fill="none"
                />
              </svg>
              <figcaption className="smoke__viz-cap">
                {t("home.smoke.intensity_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="smoke__readout">
              <p className="smoke__val">
                <span ref={numberRef} className="smoke__val-num">
                  {valText}
                </span>
                <span className="smoke__val-unit">{t("home.smoke.unit")}</span>
              </p>
              <p className="smoke__val-cap">{t("home.smoke.value_caption")}</p>
              <p className="smoke__name">
                <img
                  className="smoke__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="smoke__year">
                {fillTpl(t("home.smoke.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="smoke__legend">
                  {fillTpl(t("home.smoke.median_label"), {
                    n: nf.format(medianVal),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="smoke__source">{t("home.smoke.source")}</p>
      </div>
    </section>
  );
}
