// src/components/CattleThrive/CattleThrive.jsx
// ============================================================
// SECTION SIGNATURE #6 — « La vache qui se remplit » (Home), pendant ÉLEVAGE.
// Une vache Holstein se REMPLIT de GAUCHE À DROITE selon le RENDEMENT par
// animal réel (kg/animal), via le dataset live `livestockYield`
// (FAO/FAOSTAT — DF_CLIMATE_CHANGE, LVST_YIELD).
//
// • La PART REMPLIE = la donnée (rendement normalisé sur l'amplitude du
//   Pacifique). Vide = faible, pleine = élevé.
// • Les TACHES sont purement décoratives (elles n'encodent rien).
// • La MÉDIANE du Pacifique = trait pointillé vertical discret.
// • Robe automatique selon le thème : corps = var(--c-text), taches =
//   var(--c-bg) → blanche à taches noires en sombre, inversée en clair.
//
// Remplissage à bord net (pas d'effet « eau »), animé par GSAP (onUpdate).
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
import "./CattleThrive.scss";

/* Silhouette Holstein (viewBox 0 0 380 250), tête à droite. */
const COW_D =
  "M70,86 C74,70 100,64 150,62 C200,60 240,62 268,74 C276,62 292,56 308,62 C320,58 334,64 338,80 C342,96 336,112 322,118 C328,126 322,138 308,136 C300,142 288,138 284,128 C276,134 268,138 262,140 L262,150 L262,218 L250,218 L250,150 L228,150 L228,218 L218,218 L218,150 L120,150 L120,218 L110,218 L110,150 L92,150 L92,218 L82,218 L82,150 L66,150 C56,144 52,108 70,86 Z";

/* Taches décoratives (n'encodent rien). */
const SPOTS = [
  [115, 96, 22, 16],
  [176, 112, 26, 18],
  [150, 80, 16, 11],
  [206, 102, 20, 14],
  [96, 128, 15, 11],
  [246, 92, 16, 12],
];

/* Domaine horizontal du remplissage (gauche → droite). */
const FX0 = 52;
const FX1 = 338;
const fillX = (v) => FX0 + v * (FX1 - FX0);

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

export default function CattleThrive({ embed = false, code = null } = {}) {
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

  const live = useSelector(selectDataset("livestockYield"));

  useEffect(() => {
    dispatch(loadDataset("livestockYield"));
  }, [dispatch]);

  const status = live.status;
  const ready = status === "succeeded" && live.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(live.data.byArea)
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
  }, [ready, live.data, lang]);

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
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Remplissage gauche → droite ----------- */
  const fillRectRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(() => {
    const v = animObj.current.v;
    if (numberRef.current)
      numberRef.current.textContent = nf.format(
        Math.round(animObj.current.val),
      );
    if (fillRectRef.current)
      fillRectRef.current.setAttribute("width", fillX(v).toFixed(2));
  }, [nf]);

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = sel ? sel.v : 0;
    const tval = sel ? sel.val : 0;
    if (reduced) {
      animObj.current.v = tv;
      animObj.current.val = tval;
      draw();
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: tv,
      val: tval,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: draw,
    });
    draw();
    return () => tw.kill();
  }, [inView, sel, reduced, draw]);

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const valText = sel ? nf.format(Math.round(sel.val)) : "0";
  const medX = fillX(medianV);

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 2)
      return (
        <span className="cattle__trend cattle__trend--flat">
          {fillTpl(t("home.cattle.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d < 0)
      return (
        <span className="cattle__trend cattle__trend--down">
          {fillTpl(t("home.cattle.trend_down"), {
            n: nf.format(Math.abs(Math.round(d))),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="cattle__trend cattle__trend--up">
        {fillTpl(t("home.cattle.trend_up"), {
          n: nf.format(Math.round(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.cattle.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.cattle.title");

  return (
    <section
      className={`cattle ${embed ? "cattle--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="cattle__inner container">
        <header className="cattle__head">
          <p className="eyebrow cattle__kicker">{t("home.cattle.kicker")}</p>
          <h2 className="cattle__title">{t("home.cattle.title")}</h2>
          <p className="cattle__lead">{t("home.cattle.lead")}</p>
        </header>

        {loading && <p className="cattle__state">{t("home.cattle.loading")}</p>}
        {(failed || empty) && (
          <p className="cattle__state cattle__state--err">
            {t("home.cattle.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="cattle__stage">
            {/* Colonne 1 — contrôles */}
            <div className="cattle__controls">
              <label className="cattle__field">
                <span className="cattle__field-label">
                  {t("home.cattle.select_label")}
                </span>
                <span className="cattle__select">
                  <img
                    className="cattle__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="cattle__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.cattle.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="cattle__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="cattle__chips">
                  <button
                    type="button"
                    className="cattle__chip"
                    onClick={() => setSelected(extremes.best.code)}
                  >
                    {t("home.cattle.highest")}
                    <em>{nf.format(Math.round(extremes.best.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="cattle__chip"
                    onClick={() => setSelected(extremes.least.code)}
                  >
                    {t("home.cattle.lowest")}
                    <em>{nf.format(Math.round(extremes.least.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la vache */}
            <figure className="cattle__viz">
              <svg
                className="cattle__svg"
                viewBox="0 0 380 250"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="cow-body">
                    <path d={COW_D} />
                  </clipPath>
                  <clipPath id="cow-fill">
                    <rect ref={fillRectRef} x="0" y="0" width="0" height="250" />
                  </clipPath>
                </defs>

                {/* Sol */}
                <ellipse
                  className="cattle__soil"
                  cx="185"
                  cy="230"
                  rx="160"
                  ry="12"
                />

                {/* Queue (déco) */}
                <path
                  className="cattle__decor"
                  d="M66,92 C48,108 46,150 58,176 M58,176 C52,182 54,190 60,190"
                  fill="none"
                />

                {/* Vache « vide » (fond léger) */}
                <path className="cattle__bodyfill" d={COW_D} />

                {/* Robe qui se remplit (silhouette ∩ niveau gauche→droite) */}
                <g clipPath="url(#cow-body)">
                  <g clipPath="url(#cow-fill)">
                    <rect className="cattle__coat" x="0" y="0" width="380" height="250" />
                    {SPOTS.map(([cx, cy, rx, ry], i) => (
                      <ellipse
                        key={i}
                        className="cattle__spot"
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                      />
                    ))}
                  </g>
                </g>

                {/* Mamelle (déco, toujours visible) */}
                <g className="cattle__udder-g">
                  <ellipse className="cattle__udder" cx="150" cy="160" rx="16" ry="12" />
                  <line className="cattle__teat" x1="143" y1="170" x2="143" y2="176" />
                  <line className="cattle__teat" x1="157" y1="170" x2="157" y2="176" />
                </g>

                {/* Médiane du Pacifique (trait pointillé discret) */}
                <g clipPath="url(#cow-body)">
                  <line
                    className="cattle__median"
                    x1={medX}
                    x2={medX}
                    y1="48"
                    y2="220"
                  />
                </g>

                {/* Contour */}
                <path className="cattle__outline" d={COW_D} fill="none" />

                {/* Cornes + oreilles + œil + naseau (déco) */}
                <g className="cattle__decor" fill="none">
                  <path d="M300,56 Q298,46 306,46" />
                  <path d="M316,58 Q324,48 330,54" />
                  <path d="M288,60 Q278,56 274,64" />
                </g>
                <circle className="cattle__eye" cx="318" cy="92" r="3" />
                <circle className="cattle__nostril2" cx="320" cy="120" r="2.4" />
              </svg>
              <figcaption className="cattle__viz-cap">
                {t("home.cattle.vitality_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="cattle__readout">
              <p className="cattle__val">
                <span ref={numberRef} className="cattle__val-num">
                  {valText}
                </span>
                <span className="cattle__val-unit">{t("home.cattle.unit")}</span>
              </p>
              <p className="cattle__val-cap">{t("home.cattle.value_caption")}</p>
              <p className="cattle__name">
                <img
                  className="cattle__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="cattle__year">
                {fillTpl(t("home.cattle.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="cattle__legend">
                  <span className="cattle__legend-dash" aria-hidden="true" />
                  {fillTpl(t("home.cattle.median_label"), {
                    n: nf.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="cattle__source">{t("home.cattle.source")}</p>
      </div>
    </section>
  );
}