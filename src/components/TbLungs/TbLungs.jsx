// src/components/TbLungs/TbLungs.jsx
// ============================================================
// SECTION SIGNATURE — « Les poumons : la tuberculose » (Home). Une paire de
// poumons respire ; une OMBRE les gagne de bas en haut selon l'INCIDENCE DE LA
// TUBERCULOSE réelle du territoire (cas pour 100 000 hab.), via le dataset live
// `tuberculosis` (OMS — ODD 3.3.2 · DF_SDG_03 · SH_TBS_INCD).
//
// Honnête : grand nombre = incidence RÉELLE (pour 100 000, dernière année) ;
// la part ombrée encode l'incidence NORMALISÉE sur l'amplitude du Pacifique
// (dit sous le visuel) ; tendance « depuis {année} » réelle (hausse = pire, en
// corail ; baisse = mieux, en vert). Respiration animée (rAF) ; ombre animée
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
import "./TbLungs.scss";

const TOP = 94;
const BOT = 246;
const LOBE_L =
  "M148,96 C120,90 92,104 78,134 C64,164 66,206 88,232 C104,250 132,250 140,228 C146,210 146,150 148,120 Z";
const LOBE_R =
  "M172,96 C200,90 228,104 242,134 C256,164 254,206 232,232 C216,250 188,250 180,228 C174,210 174,150 172,120 Z";

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
const levelY = (v) => BOT - v * (BOT - TOP);

export default function TbLungs() {
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

  const tb = useSelector(selectDataset("tuberculosis"));

  useEffect(() => {
    dispatch(loadDataset("tuberculosis"));
  }, [dispatch]);

  const status = tb.status;
  const ready = status === "succeeded" && tb.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(tb.data.byArea)
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
  }, [ready, tb.data, lang]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianVal = useMemo(() => median(list.map((o) => o.val)), [list]);
  const medianV = useMemo(() => median(list.map((o) => o.v)) ?? 0.5, [list]);
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

  // Défaut : l'incidence la plus forte (poumons les plus voilés).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.high.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;

  /* ----------- Respiration + ombre ----------- */
  const breatheRef = useRef(null);
  const hazeRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nf.format(
          Math.round(animObj.current.val),
        );

      const ly = levelY(v);
      if (hazeRef.current) {
        hazeRef.current.setAttribute("y", ly.toFixed(1));
        hazeRef.current.setAttribute("height", (BOT + 10 - ly).toFixed(1));
      }

      if (breatheRef.current) {
        const sy = reduced ? 1 : 1 + 0.022 * Math.sin(phase * 1.1);
        const sx = reduced ? 1 : 1 + 0.012 * Math.sin(phase * 1.1);
        breatheRef.current.setAttribute(
          "transform",
          `translate(160 168) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-160 -168)`,
        );
      }
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

  const valText = sel ? nf.format(Math.round(sel.val)) : "0";
  const medY = levelY(medianV);

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.5)
      return (
        <span className="tb__trend tb__trend--flat">
          {fillTpl(t("home.tb.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="tb__trend tb__trend--up">
          {fillTpl(t("home.tb.trend_up"), {
            n: nf.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="tb__trend tb__trend--down">
        {fillTpl(t("home.tb.trend_down"), {
          n: nf.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.tb.aria"), { area: sel.name, n: valText, year: sel.year })
    : t("home.tb.title");

  return (
    <section className="tb" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="tb__inner container">
        <header className="tb__head">
          <p className="eyebrow tb__kicker">{t("home.tb.kicker")}</p>
          <h2 className="tb__title">{t("home.tb.title")}</h2>
          <p className="tb__lead">{t("home.tb.lead")}</p>
        </header>

        {loading && <p className="tb__state">{t("home.tb.loading")}</p>}
        {(failed || empty) && (
          <p className="tb__state tb__state--err">{t("home.tb.unavailable")}</p>
        )}

        {ready && sel && (
          <div className="tb__stage">
            {/* Colonne 1 — contrôles */}
            <div className="tb__controls">
              <label className="tb__field">
                <span className="tb__field-label">
                  {t("home.tb.select_label")}
                </span>
                <span className="tb__select">
                  <img
                    className="tb__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="tb__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.tb.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="tb__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="tb__chips">
                  <button
                    type="button"
                    className="tb__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.tb.highest")}
                    <em>{nf.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="tb__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.tb.lowest")}
                    <em>{nf.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — les poumons */}
            <figure className="tb__viz">
              <svg
                className="tb__svg"
                viewBox="0 0 320 280"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="lungs-clip">
                    <path d={LOBE_L} />
                    <path d={LOBE_R} />
                  </clipPath>
                </defs>

                <g ref={breatheRef}>
                  {/* Trachée + bronches */}
                  <g className="tb__airway" fill="none">
                    <path d="M160,30 L160,94" />
                    <path d="M160,84 C152,92 146,98 142,108" />
                    <path d="M160,84 C168,92 174,98 178,108" />
                    <ellipse
                      className="tb__larynx"
                      cx="160"
                      cy="30"
                      rx="9"
                      ry="6"
                    />
                  </g>

                  {/* Poumons « sains » (fond) */}
                  <path className="tb__lung" d={LOBE_L} />
                  <path className="tb__lung" d={LOBE_R} />

                  {/* Ombre (incidence) */}
                  <g clipPath="url(#lungs-clip)">
                    <rect
                      ref={hazeRef}
                      className="tb__haze"
                      x="60"
                      y="160"
                      width="200"
                      height="90"
                    />
                  </g>

                  {/* Médiane du Pacifique */}
                  <g clipPath="url(#lungs-clip)">
                    <line
                      className="tb__median"
                      x1="60"
                      x2="260"
                      y1={medY}
                      y2={medY}
                    />
                  </g>

                  {/* Bronchioles (déco) */}
                  <g className="tb__bronchi" fill="none">
                    <path d="M142,108 C130,128 118,150 110,176" />
                    <path d="M126,150 C118,158 110,162 102,164" />
                    <path d="M178,108 C190,128 202,150 210,176" />
                    <path d="M194,150 C202,158 210,162 218,164" />
                  </g>

                  {/* Contour */}
                  <path className="tb__outline" d={LOBE_L} fill="none" />
                  <path className="tb__outline" d={LOBE_R} fill="none" />
                </g>
              </svg>
              <figcaption className="tb__viz-cap">
                {t("home.tb.intensity_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="tb__readout">
              <p className="tb__val">
                <span ref={numberRef} className="tb__val-num">
                  {valText}
                </span>
                <span className="tb__val-unit">{t("home.tb.unit")}</span>
              </p>
              <p className="tb__val-cap">{t("home.tb.value_caption")}</p>
              <p className="tb__name">
                <img
                  className="tb__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="tb__year">
                {fillTpl(t("home.tb.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="tb__legend">
                  <span className="tb__legend-dash" aria-hidden="true" />
                  {fillTpl(t("home.tb.median_label"), {
                    n: nf.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="tb__source">{t("home.tb.source")}</p>
      </div>
    </section>
  );
}
