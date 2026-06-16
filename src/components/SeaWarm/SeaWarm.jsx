// src/components/SeaWarm/SeaWarm.jsx
// ============================================================
// SECTION SIGNATURE #9 — « La mer qui chauffe » (Home). Un océan à HOULE
// animée (couleur constante) dans lequel est planté un THERMOMÈTRE — le cœur
// du visuel. Le mercure MONTE / DESCEND selon l'ANOMALIE DE TEMPÉRATURE DE LA
// MER réelle du territoire (°C vs normale 1971–2000), via le dataset live
// `sst` (NOAA — DF_CLIMATE_CHANGE · SST_ANOM).
//
// Le « 0 » du thermomètre = la normale ; au-dessus = plus chaud (mercure
// corail), en-dessous = plus frais (mercure cyan). L'EAU NE CHANGE PAS DE
// COULEUR.
//
// Honnête : grand nombre = anomalie RÉELLE (°C, signée) ; la hauteur du mercure
// encode l'anomalie sur une échelle symétrique relative à l'amplitude du
// Pacifique (dit sous le visuel) ; tendance « depuis {année} » réelle. Houle
// animée (rAF) ; mercure animé par GSAP. prefers-reduced-motion respecté.
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
import "./SeaWarm.scss";

const SURFACE_Y = 138;
const HIGH_Y = 58; // mercure au plus haut
const LOW_Y = 232; // mercure au plus bas
const BULB_Y = 252;
const TICKS = [72, 100, 128, 156, 184, 212];
const BUBBLES = [120, 142, 178, 198, 150];

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

export default function SeaWarm() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView] = useInView({ threshold: 0.25 });
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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

  const sst = useSelector(selectDataset("sst"));

  useEffect(() => {
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const status = sst.status;
  const ready = status === "succeeded" && sst.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(sst.data.byArea)
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
  }, [ready, sst.data, lang]);

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
    let warm = list[0];
    let cool = list[0];
    list.forEach((o) => {
      if (o.val > warm.val) warm = o;
      if (o.val < cool.val) cool = o;
    });
    return { warm, cool };
  }, [list]);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.warm.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;

  /* ----------- Houle + mercure ----------- */
  const seaRef = useRef(null);
  const crestRef = useRef(null);
  const bubbleRefs = useRef([]);
  const mercuryRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ w: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const w = animObj.current.w;
      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.val);

      // Mercure : 0 (normale) au milieu, + monte, − descend.
      const f = 0.5 + 0.5 * w;
      const my = LOW_Y + (HIGH_Y - LOW_Y) * f;
      if (mercuryRef.current) {
        mercuryRef.current.setAttribute("y", my.toFixed(1));
        mercuryRef.current.setAttribute("height", (BULB_Y + 6 - my).toFixed(1));
      }

      // Houle (surface ondulante, couleur constante)
      const build = (amp, k, sp, off) => {
        let d = `M-10,${SURFACE_Y}`;
        for (let x = -10; x <= 330; x += 16) {
          const yy = reduced
            ? SURFACE_Y
            : SURFACE_Y + amp * Math.sin(x * k + phase * sp + off);
          d += ` L${x},${yy.toFixed(2)}`;
        }
        return d;
      };
      if (seaRef.current)
        seaRef.current.setAttribute(
          "d",
          `${build(5, 0.05, 1.3, 0)} L330,300 L-10,300 Z`,
        );
      if (crestRef.current)
        crestRef.current.setAttribute("d", build(4, 0.06, 1.7, 1.2));

      // Bulles qui montent
      bubbleRefs.current.forEach((node, i) => {
        if (!node) return;
        const sp = 26 + (i % 3) * 9;
        const yb = reduced ? 220 - i * 14 : 272 - ((phase * sp + i * 30) % 130);
        const op = clamp01((yb - SURFACE_Y) / 60) * 0.5;
        node.setAttribute("cy", yb.toFixed(1));
        node.setAttribute("opacity", op.toFixed(3));
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
      duration: 1.3,
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
  const warm = sel ? sel.val >= 0 : true;

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.01)
      return (
        <span className="sea__trend sea__trend--flat">
          {fillTpl(t("home.sea.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="sea__trend sea__trend--up">
          {fillTpl(t("home.sea.trend_up"), {
            n: nf.format(d),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="sea__trend sea__trend--down">
        {fillTpl(t("home.sea.trend_down"), {
          n: nf.format(Math.abs(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.sea.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.sea.title");

  return (
    <section className="sea" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="sea__inner container">
        <header className="sea__head">
          <p className="eyebrow sea__kicker">{t("home.sea.kicker")}</p>
          <h2 className="sea__title">{t("home.sea.title")}</h2>
          <p className="sea__lead">{t("home.sea.lead")}</p>
        </header>

        {loading && <p className="sea__state">{t("home.sea.loading")}</p>}
        {(failed || empty) && (
          <p className="sea__state sea__state--err">
            {t("home.sea.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="sea__stage">
            {/* Colonne 1 — contrôles */}
            <div className="sea__controls">
              <label className="sea__field">
                <span className="sea__field-label">
                  {t("home.sea.select_label")}
                </span>
                <span className="sea__select">
                  <img
                    className="sea__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="sea__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.sea.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="sea__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="sea__chips">
                  <button
                    type="button"
                    className="sea__chip"
                    onClick={() => setSelected(extremes.warm.code)}
                  >
                    {t("home.sea.warmest")}
                    <em>{signed(extremes.warm.val)}</em>
                  </button>
                  <button
                    type="button"
                    className="sea__chip"
                    onClick={() => setSelected(extremes.cool.code)}
                  >
                    {t("home.sea.coolest")}
                    <em>{signed(extremes.cool.val)}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — l'océan + thermomètre */}
            <figure className="sea__viz">
              <svg
                className="sea__svg"
                viewBox="0 0 320 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="sea-frame">
                    <rect x="0" y="0" width="320" height="300" rx="16" />
                  </clipPath>
                </defs>

                <g clipPath="url(#sea-frame)">
                  <rect
                    className="sea__sky"
                    x="0"
                    y="0"
                    width="320"
                    height="300"
                  />
                  {/* Mer (houle, couleur constante) */}
                  <path ref={seaRef} className="sea__water" d="" />
                  <path
                    ref={crestRef}
                    className="sea__crest"
                    d=""
                    fill="none"
                  />
                  {/* Bulles */}
                  {BUBBLES.map((x, i) => (
                    <circle
                      key={i}
                      ref={(n) => {
                        bubbleRefs.current[i] = n;
                      }}
                      className="sea__bubble"
                      cx={x}
                      cy="260"
                      r={2 + (i % 3)}
                      opacity="0"
                    />
                  ))}

                  {/* Thermomètre — cœur du visuel */}
                  <g className="sea__thermo">
                    {/* Verre (fond) */}
                    <rect
                      className="sea__glass-fill"
                      x="150"
                      y="50"
                      width="20"
                      height="208"
                      rx="10"
                    />
                    <circle
                      className="sea__glass-fill"
                      cx="160"
                      cy={BULB_Y}
                      r="20"
                    />

                    {/* Mercure */}
                    <g
                      className={
                        warm
                          ? "sea__merc sea__merc--warm"
                          : "sea__merc sea__merc--cool"
                      }
                    >
                      <rect
                        ref={mercuryRef}
                        x="153"
                        y="150"
                        width="14"
                        height="100"
                        rx="7"
                      />
                      <circle cx="160" cy={BULB_Y} r="16" />
                    </g>

                    {/* Verre (contour) */}
                    <rect
                      className="sea__glass"
                      x="150"
                      y="50"
                      width="20"
                      height="208"
                      rx="10"
                      fill="none"
                    />
                    <circle
                      className="sea__glass"
                      cx="160"
                      cy={BULB_Y}
                      r="20"
                      fill="none"
                    />
                    <line
                      className="sea__shine"
                      x1="156"
                      y1="60"
                      x2="156"
                      y2="232"
                    />

                    {/* Graduations */}
                    <g className="sea__ticks">
                      {TICKS.map((y, i) => (
                        <line key={i} x1="171" y1={y} x2="178" y2={y} />
                      ))}
                    </g>
                    {/* Repère 0 = normale */}
                    <line
                      className="sea__zero"
                      x1="171"
                      y1="145"
                      x2="184"
                      y2="145"
                    />
                    <text className="sea__zero-tag" x="188" y="149">
                      {t("home.sea.normal_tag")}
                    </text>
                  </g>
                </g>

                <rect
                  className="sea__frame"
                  x="1"
                  y="1"
                  width="318"
                  height="298"
                  rx="16"
                  fill="none"
                />
              </svg>
              <figcaption className="sea__viz-cap">
                {t("home.sea.intensity_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="sea__readout">
              <p
                className={`sea__val ${warm ? "sea__val--warm" : "sea__val--cool"}`}
              >
                <span ref={numberRef} className="sea__val-num">
                  {valText}
                </span>
                <span className="sea__val-unit">{t("home.sea.unit")}</span>
              </p>
              <p className="sea__val-cap">{t("home.sea.value_caption")}</p>
              <p className="sea__name">
                <img
                  className="sea__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="sea__year">
                {fillTpl(t("home.sea.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="sea__legend">
                  {fillTpl(t("home.sea.median_label"), {
                    n: signed(medianVal),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="sea__source">{t("home.sea.source")}</p>
      </div>
    </section>
  );
}
