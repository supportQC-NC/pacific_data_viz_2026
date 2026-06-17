// src/components/TbBacilli/TbBacilli.jsx
// ============================================================
// SECTION SIGNATURE — « Le bacille : la tuberculose » (Home). Un champ de
// microscope rond où des BACILLES (bâtonnets façon coloration de Ziehl-Neelsen,
// corail sur fond froid) SE MULTIPLIENT selon l'INCIDENCE DE LA TUBERCULOSE
// réelle du territoire (cas pour 100 000 hab.), via le dataset live
// `tuberculosis` (OMS — ODD 3.3.2 · DF_SDG_03 · SH_TBS_INCD).
//
// Sélection par CHIPS (pays) + filtres SOUS-RÉGION (un clic d'onglet affiche
// l'AGRÉGAT — moyenne — de tous les territoires de la sous-région). Pour la
// tuberculose, une incidence FORTE est mauvaise (rouge) et FAIBLE est bonne
// (vert) — l'inverse de l'eau.
//
// Honnête : grand nombre = incidence RÉELLE (pour 100 000, dernière année) ;
// le NOMBRE de bacilles encode l'incidence NORMALISÉE sur l'amplitude du
// Pacifique (dit sous le visuel) ; tendance « depuis {année} » réelle (hausse =
// pire, corail ; baisse = mieux, vert). Dérive lente (rAF) ; multiplication
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
import "./TbBacilli.scss";

/* Sous-régions du Pacifique (mêmes regroupements que l'Acte Santé). */
const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = {};
Object.entries(SUBREGIONS).forEach(([k, arr]) =>
  arr.forEach((c) => {
    REGION_OF[c] = k;
  }),
);
const REGION_TABS = ["all", "melanesia", "polynesia", "micronesia"];

const N = 30;
const FIELD_R = 116;
const CX = 150;
const CY = 150;
const BACILLI = Array.from({ length: N }, (_, i) => {
  const r = FIELD_R * 0.94 * Math.sqrt((i + 0.5) / N);
  const th = i * 2.399963; // angle d'or → répartition régulière dans le disque
  return {
    x: +(CX + r * Math.cos(th)).toFixed(2),
    y: +(CY + r * Math.sin(th)).toFixed(2),
    ang: (i * 47) % 180,
    len: 13 + (i % 5) * 2.6,
    w: 4.4 + (i % 3) * 0.7,
    sp: 0.5 + (i % 5) * 0.12,
  };
});

/* Poussières statiques (réalisme microscope) — déterministes. */
const DUST = Array.from({ length: 9 }, (_, i) => {
  const r = FIELD_R * 0.9 * Math.sqrt(((i + 0.3) * 1.7) % 1);
  const th = i * 1.7 + 0.6;
  return {
    x: +(CX + r * Math.cos(th)).toFixed(2),
    y: +(CY + r * Math.sin(th)).toFixed(2),
    rr: 0.8 + (i % 3) * 0.5,
  };
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

export default function TbBacilli({ embed = false, code = null } = {}) {
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

  /* Amplitude (min / span) pour normaliser aussi les agrégats sous-région. */
  const range = useMemo(() => {
    if (!list.length) return { min: 0, span: 1 };
    const vals = list.map((o) => o.val);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, span: max - min || 1 };
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

  /* Sélection : un PAYS ou une SOUS-RÉGION (agrégat de tous ses pays). */
  const [region, setRegion] = useState("all");
  const [view, setView] = useState(null); // {kind:"country",code} | {kind:"region",key}
  useEffect(() => {
    if (embed) return;
    if (!list.length) return;
    if (!view || (view.kind === "country" && !byCode[view.code])) {
      // défaut : l'incidence la plus forte (champ le plus chargé)
      setView({
        kind: "country",
        code: extremes ? extremes.high.code : list[0].code,
      });
    }
  }, [list, view, byCode, extremes, embed]);
  useEffect(() => {
    if (embed && code) setView({ kind: "country", code });
  }, [embed, code]);

  const selectCountry = (code) => setView({ kind: "country", code });
  const selectRegion = (key) => {
    setRegion(key);
    setView({ kind: "region", key });
  };

  const visibleList = useMemo(
    () =>
      region === "all"
        ? list
        : list.filter((o) => REGION_OF[o.code] === region),
    [list, region],
  );

  const sel = useMemo(() => {
    if (!view) return null;
    if (view.kind === "country") {
      const o = byCode[view.code];
      return o ? { ...o, isRegion: false } : null;
    }
    const members =
      view.key === "all"
        ? list
        : list.filter((o) => REGION_OF[o.code] === view.key);
    if (!members.length) return null;
    const avgVal = members.reduce((s, o) => s + o.val, 0) / members.length;
    const year = Math.max(...members.map((o) => o.year));
    const name =
      view.key === "all"
        ? t("home.tb.region_pacific")
        : t(`home.tb.region_${view.key}`);
    return {
      code: null,
      name,
      val: avgVal,
      v: clamp01((avgVal - range.min) / range.span),
      year,
      delta: null,
      fromYear: null,
      isRegion: true,
      count: members.length,
    };
  }, [view, byCode, list, range, t]);

  /* ----------- Bacilles ----------- */
  const rodRefs = useRef([]);
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

      const shown = v * N;
      rodRefs.current.forEach((node, i) => {
        if (!node) return;
        const op = clamp01(shown - i);
        if (op <= 0) {
          node.setAttribute("opacity", "0");
          return;
        }
        const b = BACILLI[i];
        const dx = reduced ? 0 : 3 * Math.sin(phase * b.sp + i);
        const dy = reduced ? 0 : 3 * Math.cos(phase * b.sp * 0.8 + i * 1.3);
        const wob = reduced ? 0 : 8 * Math.sin(phase * 0.6 + i);
        node.setAttribute(
          "transform",
          `translate(${(b.x + dx).toFixed(2)} ${(b.y + dy).toFixed(2)}) rotate(${(b.ang + wob).toFixed(1)})`,
        );
        node.setAttribute("opacity", (op * 0.94).toFixed(3));
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
        <span className="bac__trend bac__trend--flat">
          {fillTpl(t("home.tb.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="bac__trend bac__trend--up">
          {fillTpl(t("home.tb.trend_up"), {
            n: nf.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="bac__trend bac__trend--down">
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
    <section
      className={`bac ${embed ? "bac--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="bac__inner container">
        {!embed && (
          <header className="bac__head">
            <h2 className="bac__title">{t("home.tb.title")}</h2>
            <p className="bac__lead">{t("home.tb.lead")}</p>
          </header>
        )}

        {loading && <p className="bac__state">{t("home.tb.loading")}</p>}
        {(failed || empty) && (
          <p className="bac__state bac__state--err">
            {t("home.tb.unavailable")}
          </p>
        )}

        {ready && sel && (
          <>
            {!embed && (
            <div className="bac__toolbar">
              <span className="bac__field-label">
                {t("home.tb.select_label")}
              </span>
              <div className="bac__regions" role="tablist">
                {REGION_TABS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={region === r}
                    className={`bac__region ${region === r ? "is-on" : ""}`}
                    onClick={() => selectRegion(r)}
                  >
                    {t(`home.tb.region_${r}`)}
                  </button>
                ))}
              </div>
              {extremes && (
                <div className="bac__chips">
                  <button
                    type="button"
                    className="bac__chip bac__chip--bad"
                    onClick={() => selectCountry(extremes.high.code)}
                  >
                    {t("home.tb.highest")}
                    <em>{nf.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="bac__chip bac__chip--good"
                    onClick={() => selectCountry(extremes.low.code)}
                  >
                    {t("home.tb.lowest")}
                    <em>{nf.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>
            )}

            <div className={`bac__stage ${embed ? "bac__stage--embed" : ""}`}>
              {/* Le champ de microscope */}
              <figure className="bac__viz">
                <svg
                  className="bac__svg"
                  viewBox="0 0 300 300"
                  role="img"
                  aria-label={svgLabel}
                >
                  <defs>
                    <radialGradient id="bac-field" cx="50%" cy="42%" r="64%">
                      <stop offset="0%" className="bac-field-in" />
                      <stop offset="58%" className="bac-field-mid" />
                      <stop offset="100%" className="bac-field-out" />
                    </radialGradient>
                    <radialGradient id="bac-vignette" cx="50%" cy="50%" r="50%">
                      <stop offset="62%" className="bac-vig-0" />
                      <stop offset="100%" className="bac-vig-1" />
                    </radialGradient>
                    <linearGradient
                      id="bac-rod"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" className="bac-rod-a" />
                      <stop offset="100%" className="bac-rod-b" />
                    </linearGradient>
                    <filter
                      id="bac-glow"
                      x="-30%"
                      y="-30%"
                      width="160%"
                      height="160%"
                    >
                      <feGaussianBlur stdDeviation="1.1" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <clipPath id="bac-clip">
                      <circle cx={CX} cy={CY} r={FIELD_R + 6} />
                    </clipPath>
                  </defs>

                  {/* Champ de vision */}
                  <circle
                    cx={CX}
                    cy={CY}
                    r={FIELD_R + 6}
                    fill="url(#bac-field)"
                  />

                  <g clipPath="url(#bac-clip)">
                    {/* Anneaux de mise au point */}
                    <circle
                      className="bac__focus-ring"
                      cx={CX}
                      cy={CY}
                      r="92"
                      fill="none"
                    />
                    <circle
                      className="bac__focus-ring bac__focus-ring--soft"
                      cx={CX}
                      cy={CY}
                      r="64"
                      fill="none"
                    />

                    {/* Réticule + graduations */}
                    <g className="bac__reticle">
                      <line x1={CX} y1="42" x2={CX} y2="258" />
                      <line x1="42" y1={CY} x2="258" y2={CY} />
                      <circle cx={CX} cy={CY} r="44" fill="none" />
                      {[-30, -15, 15, 30].map((d) => (
                        <line
                          key={`tx${d}`}
                          x1={CX + d}
                          y1={CY - 4}
                          x2={CX + d}
                          y2={CY + 4}
                        />
                      ))}
                      {[-30, -15, 15, 30].map((d) => (
                        <line
                          key={`ty${d}`}
                          x1={CX - 4}
                          y1={CY + d}
                          x2={CX + 4}
                          y2={CY + d}
                        />
                      ))}
                    </g>

                    {/* Poussières (profondeur) */}
                    {DUST.map((p, i) => (
                      <circle
                        key={`d${i}`}
                        className="bac__dust"
                        cx={p.x}
                        cy={p.y}
                        r={p.rr}
                      />
                    ))}

                    {/* Bacilles */}
                    <g filter="url(#bac-glow)">
                      {BACILLI.map((b, i) => (
                        <g
                          key={i}
                          ref={(n) => {
                            rodRefs.current[i] = n;
                          }}
                          className="bac__rod"
                          opacity="0"
                        >
                          <rect
                            x={-b.len / 2}
                            y={-b.w / 2}
                            width={b.len}
                            height={b.w}
                            rx={b.w / 2}
                            fill="url(#bac-rod)"
                          />
                          <rect
                            className="bac__rod-hi"
                            x={-b.len / 2 + 1.5}
                            y={-b.w / 2 + 0.7}
                            width={b.len - 3}
                            height={b.w * 0.32}
                            rx={b.w * 0.16}
                          />
                        </g>
                      ))}
                    </g>

                    {/* Vignette interne */}
                    <circle
                      cx={CX}
                      cy={CY}
                      r={FIELD_R + 6}
                      fill="url(#bac-vignette)"
                    />
                  </g>

                  {/* Oculaire */}
                  <circle
                    className="bac__eyepiece"
                    cx={CX}
                    cy={CY}
                    r={FIELD_R + 6}
                    fill="none"
                  />
                  <circle
                    className="bac__eyepiece-inner"
                    cx={CX}
                    cy={CY}
                    r={FIELD_R + 1}
                    fill="none"
                  />
                  <circle
                    className="bac__eyepiece-glow"
                    cx={CX}
                    cy={CY}
                    r={FIELD_R + 12}
                    fill="none"
                  />
                </svg>
                <figcaption className="bac__viz-cap">
                  {t("home.tb.intensity_caption")}
                </figcaption>
              </figure>

              {/* Lecture */}
              <div className="bac__readout">
                <p className="bac__val">
                  <span ref={numberRef} className="bac__val-num">
                    {valText}
                  </span>
                  <span className="bac__val-unit">{t("home.tb.unit")}</span>
                </p>
                <p className="bac__val-cap">{t("home.tb.value_caption")}</p>
                <p className="bac__name">
                  {sel.code && (
                    <img
                      className="bac__name-flag"
                      src={flagUrl(sel.code)}
                      alt=""
                      aria-hidden="true"
                    />
                  )}
                  {sel.name}
                  {sel.isRegion && (
                    <span className="bac__name-tag">
                      {fillTpl(t("home.tb.region_avg"), { n: sel.count })}
                    </span>
                  )}
                </p>
                <p className="bac__year">
                  {fillTpl(t("home.tb.year_label"), { year: sel.year })}
                  {trendEl ? <> · {trendEl}</> : null}
                </p>

                {medianVal != null && (
                  <p className="bac__legend">
                    {fillTpl(t("home.tb.median_label"), {
                      n: nf.format(Math.round(medianVal)),
                    })}
                  </p>
                )}
              </div>
            </div>

            {!embed && (
            <div className="bac__countrybar">
              <div className="bac__countries">
                {visibleList.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    className={`bac__country ${
                      view && view.kind === "country" && view.code === o.code
                        ? "is-on"
                        : ""
                    }`}
                    aria-pressed={
                      view && view.kind === "country" && view.code === o.code
                    }
                    onClick={() => selectCountry(o.code)}
                  >
                    <img
                      className="bac__country-flag"
                      src={flagUrl(o.code)}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="bac__country-name">{o.name}</span>
                    <em className="bac__country-val">
                      {nf.format(Math.round(o.val))}
                    </em>
                  </button>
                ))}
              </div>
            </div>
            )}
          </>
        )}

        {!embed && (
          <p className="bac__source">{t("home.tb.source")}</p>
        )}
      </div>
    </section>
  );
}