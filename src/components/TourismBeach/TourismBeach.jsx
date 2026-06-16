// src/components/TourismBeach/TourismBeach.jsx
// ============================================================
// SECTION SIGNATURE — « La plage : les arrivées touristiques » (Home). Une plage
// se GARNIT DE PARASOLS selon le nombre d'ARRIVÉES DE VISITEURS du territoire,
// via le dataset live `tourism` (ONU Tourisme — DF_CLIMATE_CHANGE · TRSM_ARR).
//
// Le jeu distingue total / touristes / excursionnistes : on collapse chaque
// année sur son MAXIMUM (= total des arrivées) pour ne jamais sous-compter.
//
// Honnête : grand nombre = arrivées RÉELLES (dernière année, format compact) ;
// l'affluence (nombre de parasols) est normalisée sur l'amplitude du Pacifique
// en ÉCHELLE LOG (dit sous le visuel) ; lecture NEUTRE (ni bien ni mal) ;
// tendance « depuis {année} » en ton neutre. Parasols qui ondulent (rAF) ;
// remplissage animé par GSAP. prefers-reduced-motion respecté.
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
import "./TourismBeach.scss";

const N = 14;
const PHI = 0.61803398875;
// disposition en 3 bandes de profondeur (arrière petit/haut → avant grand/bas)
const PARASOLS = Array.from({ length: N }, (_, i) => {
  const band = i % 3; // 0 arrière, 1 milieu, 2 avant
  const baseY = 158 + band * 17;
  const s = 0.74 + band * 0.16;
  const col = Math.floor(i / 3);
  const jitter = ((i * 53) % 13) - 6;
  const x = 36 + col * 52 + band * 16 + jitter;
  return {
    x: +x.toFixed(1),
    baseY,
    s: +s.toFixed(3),
    t: ((i + 0.5) * PHI) % 1,
    alt: i % 2 === 0,
    ph: (i * 37) % 100,
  };
}).sort((a, b) => a.baseY - b.baseY); // arrière dessiné avant l'avant

function collapseMaxByYear(serie) {
  const m = new Map();
  serie.forEach(({ year, value }) => {
    if (!Number.isFinite(value)) return;
    if (!m.has(year) || value > m.get(year)) m.set(year, value);
  });
  return [...m.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);
}
function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function TourismBeach() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.2 });
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );
  const nfC = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [lang],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ds = useSelector(selectDataset("tourism"));

  useEffect(() => {
    dispatch(loadDataset("tourism"));
  }, [dispatch]);

  const status = ds.status;
  const ready = status === "succeeded" && ds.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(ds.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const s = collapseMaxByYear(serie);
        if (!s.length) return null;
        const pt = s[s.length - 1];
        const f = s[0];
        if (!(pt.value >= 0)) return null;
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
    // Échelle LOG : les arrivées s'étalent sur plusieurs ordres de grandeur.
    const denom = Math.log1p(vMax - vMin) || 1;
    return raw
      .map((o) => ({ ...o, v: clamp01(Math.log1p(o.val - vMin) / denom) }))
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

  /* ----------- Parasols ----------- */
  const paraRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nfC.format(Math.round(animObj.current.val));

      paraRefs.current.forEach((node, i) => {
        if (!node) return;
        const p = PARASOLS[i];
        const aff = clamp01((v - p.t) * 6);
        if (aff <= 0) {
          node.setAttribute("opacity", "0");
          return;
        }
        const sway = reduced ? 0 : 2.4 * Math.sin(phase * 1.2 + p.ph);
        const sc = (p.s * (0.55 + 0.45 * aff)).toFixed(3);
        node.setAttribute("opacity", aff.toFixed(3));
        node.setAttribute(
          "transform",
          `translate(${p.x} ${p.baseY}) rotate(${sway.toFixed(2)}) scale(${sc}) translate(${-p.x} ${-p.baseY})`,
        );
      });
    },
    [reduced, nfC],
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

  const valText = sel ? nfC.format(Math.round(sel.val)) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (d === 0)
      return (
        <span className="beach__trend">
          {fillTpl(t("home.tourism.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="beach__trend">
          {fillTpl(t("home.tourism.trend_up"), {
            n: nfC.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="beach__trend">
        {fillTpl(t("home.tourism.trend_down"), {
          n: nfC.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.tourism.aria"), {
        area: sel.name,
        n: nf.format(Math.round(sel.val)),
        year: sel.year,
      })
    : t("home.tourism.title");

  return (
    <section className="beach" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="beach__inner container">
        <header className="beach__head">
          <p className="eyebrow beach__kicker">{t("home.tourism.kicker")}</p>
          <h2 className="beach__title">{t("home.tourism.title")}</h2>
          <p className="beach__lead">{t("home.tourism.lead")}</p>
        </header>

        {loading && <p className="beach__state">{t("home.tourism.loading")}</p>}
        {(failed || empty) && (
          <p className="beach__state beach__state--err">
            {t("home.tourism.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="beach__stage">
            {/* Colonne 1 — contrôles */}
            <div className="beach__controls">
              <label className="beach__field">
                <span className="beach__field-label">
                  {t("home.tourism.select_label")}
                </span>
                <span className="beach__select">
                  <img
                    className="beach__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="beach__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.tourism.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="beach__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="beach__chips">
                  <button
                    type="button"
                    className="beach__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.tourism.highest")}
                    <em>{nfC.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="beach__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.tourism.lowest")}
                    <em>{nfC.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la plage */}
            <figure className="beach__viz">
              <svg
                className="beach__svg"
                viewBox="0 0 320 220"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="beach-frame">
                    <rect x="0" y="0" width="320" height="220" rx="16" />
                  </clipPath>
                </defs>

                <g clipPath="url(#beach-frame)">
                  <rect className="beach__sky" x="0" y="0" width="320" height="220" />
                  <rect className="beach__sea" x="0" y="78" width="320" height="40" />
                  <path
                    className="beach__shore"
                    d="M0,118 C60,126 120,112 180,120 C240,128 290,114 320,120 L320,220 L0,220 Z"
                  />
                  {/* soleil discret */}
                  <circle className="beach__sun" cx="276" cy="44" r="16" />

                  {/* Parasols */}
                  {PARASOLS.map((p, i) => (
                    <g
                      key={i}
                      ref={(n) => {
                        paraRefs.current[i] = n;
                      }}
                      className="beach__parasol"
                      opacity="0"
                    >
                      <line
                        className="beach__pole"
                        x1={p.x}
                        y1={p.baseY}
                        x2={p.x}
                        y2={p.baseY - 30}
                      />
                      <path
                        className={
                          p.alt
                            ? "beach__canopy"
                            : "beach__canopy beach__canopy--alt"
                        }
                        d={`M${p.x - 17},${p.baseY - 30} A 17 13 0 0 1 ${p.x + 17},${p.baseY - 30} Z`}
                      />
                      <line
                        className="beach__rib"
                        x1={p.x}
                        y1={p.baseY - 30}
                        x2={p.x}
                        y2={p.baseY - 44}
                      />
                    </g>
                  ))}
                </g>

                <rect
                  className="beach__frame"
                  x="1"
                  y="1"
                  width="318"
                  height="218"
                  rx="16"
                  fill="none"
                />
              </svg>
              <figcaption className="beach__viz-cap">
                {t("home.tourism.fill_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="beach__readout">
              <p className="beach__val">
                <span ref={numberRef} className="beach__val-num">
                  {valText}
                </span>
                <span className="beach__val-unit">{t("home.tourism.unit")}</span>
              </p>
              <p className="beach__val-cap">{t("home.tourism.value_caption")}</p>
              <p className="beach__name">
                <img
                  className="beach__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="beach__year">
                {fillTpl(t("home.tourism.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="beach__legend">
                  {fillTpl(t("home.tourism.median_label"), {
                    n: nfC.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="beach__source">{t("home.tourism.source")}</p>
      </div>
    </section>
  );
}