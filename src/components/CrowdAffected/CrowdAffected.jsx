// src/components/CrowdAffected/CrowdAffected.jsx
// ============================================================
// SECTION SIGNATURE — « La foule touchée : les catastrophes » (Home). Une foule
// de silhouettes ; une PART s'illumine en corail selon le NOMBRE DE PERSONNES
// AFFECTÉES par les catastrophes du territoire, via le dataset live
// `disastersAffected` (UNDRR — Cadre de Sendai · ODD 11.5.1 · VC_DSR_AFFCT).
//
// Honnête : grand nombre = total RÉEL de personnes affectées (dernière année,
// format compact) ; la PART illuminée encode ce total NORMALISÉ sur l'amplitude
// du Pacifique (dit sous le visuel) ; tendance « depuis {année} » réelle
// (hausse = pire, corail ; baisse = mieux, vert). Foule respirante (rAF) ;
// illumination animée par GSAP. prefers-reduced-motion respecté.
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
import "./CrowdAffected.scss";

const COLS = 8;
const ROWS = 6;
const N = COLS * ROWS;
const X0 = 18;
const Y0 = 18;
const CW = 29;
const CH = 33;
const PHI = 0.61803398875;
const FIGS = Array.from({ length: N }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  // seuil d'illumination en suite à faible discordance → la foule s'allume
  // de façon régulière et dispersée (≈ v×N silhouettes allumées).
  const t = ((i + 0.5) * PHI) % 1;
  return {
    x: +(X0 + col * CW + CW / 2).toFixed(2),
    y: +(Y0 + row * CH + CH / 2).toFixed(2),
    t,
  };
});
const HEAD = { cy: -5, r: 3.4 };
const BODY = "M-4.5,7 C-4.5,0 -2.6,-1.5 0,-1.5 C2.6,-1.5 4.5,0 4.5,7 Z";

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

export default function CrowdAffected({ embed = false, code = null } = {}) {
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

  const ds = useSelector(selectDataset("disastersAffected"));

  useEffect(() => {
    dispatch(loadDataset("disastersAffected"));
  }, [dispatch]);

  const status = ds.status;
  const ready = status === "succeeded" && ds.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(ds.data.byArea)
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
    // Échelle LOG : les personnes affectées s'étalent sur plusieurs ordres de
    // grandeur ; une normalisation linéaire écraserait tout le monde sous le
    // territoire le plus touché. Le log rend les écarts lisibles.
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

  // Défaut : la plus touchée (foule la plus illuminée).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.high.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Illumination de la foule ----------- */
  const crowdRef = useRef(null);
  const hitRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nfC.format(Math.round(animObj.current.val));

      if (crowdRef.current) {
        const s = reduced ? 1 : 1 + 0.005 * Math.sin(phase * 1.1);
        crowdRef.current.setAttribute(
          "transform",
          `translate(130 121) scale(${s.toFixed(4)}) translate(-130 -121)`,
        );
      }

      hitRefs.current.forEach((node, i) => {
        if (!node) return;
        const aff = clamp01((v - FIGS[i].t) * 6);
        node.setAttribute("opacity", aff.toFixed(3));
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
        <span className="crowd__trend crowd__trend--flat">
          {fillTpl(t("home.crowd.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="crowd__trend crowd__trend--up">
          {fillTpl(t("home.crowd.trend_up"), {
            n: nfC.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="crowd__trend crowd__trend--down">
        {fillTpl(t("home.crowd.trend_down"), {
          n: nfC.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.crowd.aria"), {
        area: sel.name,
        n: nf.format(Math.round(sel.val)),
        year: sel.year,
      })
    : t("home.crowd.title");

  return (
    <section
      className={`crowd ${embed ? "crowd--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="crowd__inner container">
        <header className="crowd__head">
          <p className="eyebrow crowd__kicker">{t("home.crowd.kicker")}</p>
          <h2 className="crowd__title">{t("home.crowd.title")}</h2>
          <p className="crowd__lead">{t("home.crowd.lead")}</p>
        </header>

        {loading && <p className="crowd__state">{t("home.crowd.loading")}</p>}
        {(failed || empty) && (
          <p className="crowd__state crowd__state--err">
            {t("home.crowd.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="crowd__stage">
            {/* Colonne 1 — contrôles */}
            <div className="crowd__controls">
              <label className="crowd__field">
                <span className="crowd__field-label">
                  {t("home.crowd.select_label")}
                </span>
                <span className="crowd__select">
                  <img
                    className="crowd__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="crowd__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.crowd.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="crowd__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="crowd__chips">
                  <button
                    type="button"
                    className="crowd__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.crowd.highest")}
                    <em>{nfC.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="crowd__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.crowd.lowest")}
                    <em>{nfC.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la foule */}
            <figure className="crowd__viz">
              <svg
                className="crowd__svg"
                viewBox="0 0 260 230"
                role="img"
                aria-label={svgLabel}
              >
                <g ref={crowdRef}>
                  {FIGS.map((fig, i) => (
                    <g key={i} transform={`translate(${fig.x} ${fig.y})`}>
                      {/* silhouette neutre (fond) */}
                      <g className="crowd__person crowd__person--base">
                        <circle cx="0" cy={HEAD.cy} r={HEAD.r} />
                        <path d={BODY} />
                      </g>
                      {/* silhouette touchée (corail, opacité animée) */}
                      <g
                        ref={(n) => {
                          hitRefs.current[i] = n;
                        }}
                        className="crowd__person crowd__person--hit"
                        opacity="0"
                      >
                        <circle cx="0" cy={HEAD.cy} r={HEAD.r} />
                        <path d={BODY} />
                      </g>
                    </g>
                  ))}
                </g>
              </svg>
              <figcaption className="crowd__viz-cap">
                {t("home.crowd.share_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="crowd__readout">
              <p className="crowd__val">
                <span ref={numberRef} className="crowd__val-num">
                  {valText}
                </span>
                <span className="crowd__val-unit">{t("home.crowd.unit")}</span>
              </p>
              <p className="crowd__val-cap">{t("home.crowd.value_caption")}</p>
              <p className="crowd__name">
                <img
                  className="crowd__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="crowd__year">
                {fillTpl(t("home.crowd.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="crowd__legend">
                  {fillTpl(t("home.crowd.median_label"), {
                    n: nfC.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="crowd__source">{t("home.crowd.source")}</p>
      </div>
    </section>
  );
}