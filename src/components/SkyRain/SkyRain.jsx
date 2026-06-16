// src/components/SkyRain/SkyRain.jsx
// ============================================================
// SECTION SIGNATURE #7 — « Le ciel : pluie ou sécheresse » (Home). Une scène
// météo réagit à l'ANOMALIE DE PRÉCIPITATIONS réelle du territoire (mm vs
// normale 1991–2020), via le dataset live `rain` (NOAA GPCP v2.3 — jeu
// officiel du Challenge, DF_CLIMATE_CHANGE · RAIN_ANOM).
//
// Signé : + = plus humide → il PLEUT (gouttes denses, nuages) ; − = plus sec
// → SÉCHERESSE (soleil dur, sol qui se craquèle, air qui tremble).
//
// Honnête : grand nombre = anomalie RÉELLE (mm, signée, dernière année) ;
// l'INTENSITÉ visuelle (densité de pluie / sévérité de sécheresse) est
// normalisée sur l'amplitude |anomalie| du Pacifique (dit sous le visuel) ;
// tendance « depuis {année} » réelle. Pluie/soleil animés (rAF) ; bascule
// animée par GSAP. prefers-reduced-motion respecté. <section>/ref toujours
// montés. Tokens, FR/EN, zéro inline.
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
import "./SkyRain.scss";

const SKY_TOP = 8;
const GROUND_Y = 210;
const CYCLE = GROUND_Y + 20 - SKY_TOP;
const N_DROPS = 46;
const DROPS = Array.from({ length: N_DROPS }, (_, i) => ({
  x: 14 + ((i * 61) % 332),
  sp: 150 + (i % 5) * 16,
  off: (i * 37) % CYCLE,
}));
const SUN = [292, 58, 24];
const RAYS = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  return [
    +(SUN[0] + 30 * Math.cos(a)).toFixed(2),
    +(SUN[1] + 30 * Math.sin(a)).toFixed(2),
    +(SUN[0] + 44 * Math.cos(a)).toFixed(2),
    +(SUN[1] + 44 * Math.sin(a)).toFixed(2),
  ];
});
const CRACKS = [
  "M58,214 L78,240 L70,272 M78,240 L96,258",
  "M150,212 L150,242 L132,272 M150,242 L172,264",
  "M244,214 L236,244 L252,274 M236,244 L214,260",
  "M308,214 L320,242 L312,270",
];
const GRASS = [40, 96, 168, 232, 300];

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

export default function SkyRain() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView] = useInView({ threshold: 0.25 });
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );
  const signed = useCallback(
    (val) => (val < 0 ? "\u2212" : "+") + nf.format(Math.abs(Math.round(val))),
    [nf],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rain = useSelector(selectDataset("rain"));

  useEffect(() => {
    dispatch(loadDataset("rain"));
  }, [dispatch]);

  const status = rain.status;
  const ready = status === "succeeded" && rain.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(rain.data.byArea)
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
  }, [ready, rain.data, lang]);

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
    let wet = list[0];
    let dry = list[0];
    list.forEach((o) => {
      if (o.val > wet.val) wet = o;
      if (o.val < dry.val) dry = o;
    });
    return { wet, dry };
  }, [list]);

  // Défaut : l'anomalie la plus marquée (|val| max).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      const strong = list.reduce(
        (a, b) => (Math.abs(b.val) > Math.abs(a.val) ? b : a),
        list[0],
      );
      setSelected(strong.code);
    }
  }, [list, selected, byCode]);

  const sel = selected ? byCode[selected] : null;

  /* ----------- Animation météo ----------- */
  const rainRefs = useRef([]);
  const sunRef = useRef(null);
  const cloudRef = useRef(null);
  const cracksRef = useRef(null);
  const grassRef = useRef(null);
  const skyWetRef = useRef(null);
  const skyDryRef = useRef(null);
  const shimmerRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ w: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const w = animObj.current.w;
      const rainI = clamp01(w);
      const dryI = clamp01(-w);
      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.val);

      if (skyWetRef.current)
        skyWetRef.current.setAttribute("opacity", (0.2 * rainI).toFixed(3));
      if (skyDryRef.current)
        skyDryRef.current.setAttribute("opacity", (0.24 * dryI).toFixed(3));
      if (cloudRef.current)
        cloudRef.current.setAttribute(
          "opacity",
          (0.18 + 0.72 * rainI).toFixed(3),
        );
      if (grassRef.current)
        grassRef.current.setAttribute("opacity", rainI.toFixed(3));
      if (cracksRef.current)
        cracksRef.current.setAttribute("opacity", dryI.toFixed(3));

      // Pluie
      rainRefs.current.forEach((node, i) => {
        if (!node) return;
        const op = clamp01((rainI - i / N_DROPS) * 3);
        if (op <= 0) {
          node.setAttribute("opacity", "0");
          return;
        }
        const d = DROPS[i];
        const y = reduced
          ? SKY_TOP + (d.off % CYCLE)
          : SKY_TOP + ((phase * d.sp + d.off) % CYCLE);
        node.setAttribute("x1", d.x);
        node.setAttribute("x2", d.x);
        node.setAttribute("y1", y.toFixed(1));
        node.setAttribute("y2", (y + 12).toFixed(1));
        node.setAttribute("opacity", (op * 0.85).toFixed(3));
      });

      // Soleil
      if (sunRef.current) {
        sunRef.current.setAttribute("opacity", dryI.toFixed(3));
        const a = reduced ? 0 : phase * 10;
        sunRef.current.setAttribute(
          "transform",
          `rotate(${a.toFixed(1)} ${SUN[0]} ${SUN[1]})`,
        );
      }

      // Air qui tremble (sécheresse)
      shimmerRefs.current.forEach((node, i) => {
        if (!node) return;
        const baseY = 188 + i * 7;
        let d = "";
        for (let x = 20; x <= 340; x += 20) {
          const yy = reduced
            ? baseY
            : baseY + 2.2 * Math.sin(x * 0.06 + phase * 2 + i);
          d += `${d ? " L" : "M"}${x},${yy.toFixed(2)}`;
        }
        node.setAttribute("d", d);
        node.setAttribute("opacity", (dryI * 0.55).toFixed(3));
      });
    },
    [reduced, signed],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tw = startedRef.current && sel ? sel.w : 0;
    const tval = startedRef.current && sel ? sel.val : 0;
    if (reduced) {
      animObj.current.w = tw;
      animObj.current.val = tval;
      draw(0);
      return undefined;
    }
    const tween = gsap.to(animObj.current, {
      w: tw,
      val: tval,
      duration: 1.2,
      ease: "power2.out",
    });
    return () => tween.kill();
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

  const valText = sel ? signed(sel.val) : "0";
  const wet = sel ? sel.val >= 0 : true;

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 1)
      return (
        <span className="sky__trend sky__trend--flat">
          {fillTpl(t("home.sky.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="sky__trend sky__trend--wet">
          {fillTpl(t("home.sky.trend_wet"), {
            n: nf.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="sky__trend sky__trend--dry">
        {fillTpl(t("home.sky.trend_dry"), {
          n: nf.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.sky.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.sky.title");

  return (
    <section className="sky" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="sky__inner container">
        <header className="sky__head">
          <p className="eyebrow sky__kicker">{t("home.sky.kicker")}</p>
          <h2 className="sky__title">{t("home.sky.title")}</h2>
          <p className="sky__lead">{t("home.sky.lead")}</p>
        </header>

        {loading && <p className="sky__state">{t("home.sky.loading")}</p>}
        {(failed || empty) && (
          <p className="sky__state sky__state--err">
            {t("home.sky.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="sky__stage">
            {/* Colonne 1 — contrôles */}
            <div className="sky__controls">
              <label className="sky__field">
                <span className="sky__field-label">
                  {t("home.sky.select_label")}
                </span>
                <span className="sky__select">
                  <img
                    className="sky__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="sky__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.sky.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="sky__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="sky__chips">
                  <button
                    type="button"
                    className="sky__chip"
                    onClick={() => setSelected(extremes.wet.code)}
                  >
                    {t("home.sky.wettest")}
                    <em>{signed(extremes.wet.val)}</em>
                  </button>
                  <button
                    type="button"
                    className="sky__chip"
                    onClick={() => setSelected(extremes.dry.code)}
                  >
                    {t("home.sky.driest")}
                    <em>{signed(extremes.dry.val)}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la scène */}
            <figure className="sky__viz">
              <svg
                className="sky__svg"
                viewBox="0 0 360 280"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="sky-frame">
                    <rect x="0" y="0" width="360" height="280" rx="16" />
                  </clipPath>
                </defs>

                <g clipPath="url(#sky-frame)">
                  <rect
                    className="sky__bg"
                    x="0"
                    y="0"
                    width="360"
                    height="280"
                  />
                  <rect
                    ref={skyWetRef}
                    className="sky__wash sky__wash--wet"
                    x="0"
                    y="0"
                    width="360"
                    height="210"
                    opacity="0"
                  />
                  <rect
                    ref={skyDryRef}
                    className="sky__wash sky__wash--dry"
                    x="0"
                    y="0"
                    width="360"
                    height="210"
                    opacity="0"
                  />

                  {/* Soleil */}
                  <g ref={sunRef} className="sky__sun" opacity="0">
                    {RAYS.map(([x1, y1, x2, y2], i) => (
                      <line
                        key={i}
                        className="sky__ray"
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                      />
                    ))}
                    <circle
                      cx={SUN[0]}
                      cy={SUN[1]}
                      r={SUN[2]}
                      className="sky__sun-core"
                    />
                  </g>

                  {/* Nuages */}
                  <g ref={cloudRef} className="sky__clouds">
                    <g className="sky__cloud">
                      <ellipse cx="80" cy="56" rx="34" ry="20" />
                      <ellipse cx="108" cy="50" rx="26" ry="20" />
                      <ellipse cx="56" cy="50" rx="22" ry="16" />
                    </g>
                    <g className="sky__cloud">
                      <ellipse cx="180" cy="40" rx="30" ry="17" />
                      <ellipse cx="205" cy="36" rx="22" ry="16" />
                    </g>
                  </g>

                  {/* Pluie */}
                  <g className="sky__rain">
                    {DROPS.map((d, i) => (
                      <line
                        key={i}
                        ref={(n) => {
                          rainRefs.current[i] = n;
                        }}
                        className="sky__drop"
                        x1={d.x}
                        y1={SKY_TOP}
                        x2={d.x}
                        y2={SKY_TOP + 12}
                        opacity="0"
                      />
                    ))}
                  </g>

                  {/* Air qui tremble (sécheresse) */}
                  {[0, 1, 2].map((i) => (
                    <path
                      key={i}
                      ref={(n) => {
                        shimmerRefs.current[i] = n;
                      }}
                      className="sky__shimmer"
                      d=""
                      fill="none"
                      opacity="0"
                    />
                  ))}

                  {/* Sol */}
                  <rect
                    className="sky__ground"
                    x="0"
                    y={GROUND_Y}
                    width="360"
                    height="70"
                  />
                  <g ref={cracksRef} className="sky__cracks" opacity="0">
                    {CRACKS.map((d, i) => (
                      <path key={i} d={d} fill="none" />
                    ))}
                  </g>
                  <g ref={grassRef} className="sky__grass" opacity="0">
                    {GRASS.map((x, i) => (
                      <g key={i}>
                        <path
                          d={`M${x},${GROUND_Y + 2} Q${x - 3},${GROUND_Y - 8} ${x - 6},${GROUND_Y - 12}`}
                          fill="none"
                        />
                        <path
                          d={`M${x},${GROUND_Y + 2} Q${x + 3},${GROUND_Y - 8} ${x + 6},${GROUND_Y - 12}`}
                          fill="none"
                        />
                      </g>
                    ))}
                  </g>
                </g>

                <rect
                  className="sky__frame"
                  x="1"
                  y="1"
                  width="358"
                  height="278"
                  rx="16"
                  fill="none"
                />
              </svg>
              <figcaption className="sky__viz-cap">
                {t("home.sky.intensity_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="sky__readout">
              <p
                className={`sky__val ${wet ? "sky__val--wet" : "sky__val--dry"}`}
              >
                <span ref={numberRef} className="sky__val-num">
                  {valText}
                </span>
                <span className="sky__val-unit">{t("home.sky.unit")}</span>
              </p>
              <p className="sky__val-cap">{t("home.sky.value_caption")}</p>
              <p className="sky__name">
                <img
                  className="sky__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="sky__year">
                {fillTpl(t("home.sky.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="sky__legend">
                  {fillTpl(t("home.sky.median_label"), {
                    n: signed(medianVal),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="sky__source">{t("home.sky.source")}</p>
      </div>
    </section>
  );
}
