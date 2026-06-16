// src/components/CattleThrive/CattleThrive.jsx
// ============================================================
// SECTION SIGNATURE #6 — « Le bœuf qui se remplit » (Home), pendant ÉLEVAGE.
// Un BŒUF en schéma de boucher (silhouette + découpes pointillées, SANS les
// noms) se REMPLIT morceau par morceau selon le RENDEMENT par animal réel
// (kg/animal), via le dataset live `livestockYield`
// (FAO/FAOSTAT — DF_CLIMATE_CHANGE, LVST_YIELD).
//
// Lecture : bœuf presque vide = rendement faible ; bœuf entièrement garni de
// rouge = rendement élevé. Le grand nombre = rendement RÉEL ; la part remplie
// encode le rendement NORMALISÉ sur l'amplitude du Pacifique (dit sous le
// visuel) ; tendance « depuis {année} » réelle.
//
// Remplissage animé par GSAP (onUpdate → draw), pas de boucle permanente.
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

/* Découpes (grille 6×2 sur le torse, rognée par la silhouette).
   Remplissage du bas vers le haut, de l'arrière vers l'avant. */
const COL_X = [66, 106, 146, 186, 226, 266, 306];
const ROW_Y = [96, 153, 210];
const CUTS = [];
for (let c = 0; c < 6; c += 1) {
  for (let r = 0; r < 2; r += 1) {
    CUTS.push({
      x: COL_X[c],
      y: ROW_Y[r],
      w: COL_X[c + 1] - COL_X[c],
      h: ROW_Y[r + 1] - ROW_Y[r],
      order: c * 2 + (r === 1 ? 0 : 1), // bas (r=1) avant haut (r=0)
      alt: (c + r) % 2 === 0,
    });
  }
}
const N_CUTS = CUTS.length;

/* Silhouette du torse (sert de masque pour la grille). */
const BODY_D =
  "M70,100 C150,92 210,92 252,96 C278,98 296,104 304,120 L308,150 L306,196 C306,205 300,208 290,208 L120,210 C95,210 78,206 72,198 L66,150 Z";

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

export default function CattleThrive() {
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

  /* ----------- Remplissage ----------- */
  const cutRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(() => {
    const v = animObj.current.v;
    if (numberRef.current)
      numberRef.current.textContent = nf.format(
        Math.round(animObj.current.val),
      );
    const filled = v * N_CUTS;
    cutRefs.current.forEach((node, i) => {
      if (!node) return;
      const op = clamp01(filled - CUTS[i].order);
      node.setAttribute("fill-opacity", op.toFixed(3));
    });
  }, [nf]);

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = startedRef.current && sel ? sel.v : 0;
    const tval = startedRef.current && sel ? sel.val : 0;
    if (reduced) {
      animObj.current.v = tv;
      animObj.current.val = tval;
      draw();
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: tv,
      val: tval,
      duration: 1.25,
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
      className="cattle"
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

            {/* Colonne 2 — le bœuf de boucher */}
            <figure className="cattle__viz">
              <svg
                className="cattle__svg"
                viewBox="0 0 420 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="ox-body">
                    <path d={BODY_D} />
                  </clipPath>
                </defs>

                {/* Sol */}
                <ellipse
                  className="cattle__soil"
                  cx="210"
                  cy="270"
                  rx="190"
                  ry="12"
                />

                {/* Queue */}
                <path
                  className="cattle__line"
                  d="M70,104 C44,120 40,170 52,200 M52,200 C46,206 48,214 54,214"
                  fill="none"
                />

                {/* Pattes */}
                <g className="cattle__line">
                  <path d="M96,206 L88,260" fill="none" />
                  <path d="M132,208 L130,260" fill="none" />
                  <path d="M276,206 L284,260" fill="none" />
                  <path d="M300,202 L312,258" fill="none" />
                </g>
                <g className="cattle__hoof">
                  <rect x="82" y="258" width="14" height="8" rx="2" />
                  <rect x="124" y="258" width="14" height="8" rx="2" />
                  <rect x="278" y="258" width="14" height="8" rx="2" />
                  <rect x="306" y="256" width="14" height="8" rx="2" />
                </g>

                {/* Fond du torse (bœuf « vide ») */}
                <path className="cattle__bodyfill" d={BODY_D} />

                {/* Découpes qui se remplissent (rognées par la silhouette) */}
                <g clipPath="url(#ox-body)">
                  {CUTS.map((c, i) => (
                    <rect
                      key={i}
                      ref={(n) => {
                        cutRefs.current[i] = n;
                      }}
                      className={`cattle__cut ${c.alt ? "cattle__cut--a" : "cattle__cut--b"}`}
                      x={c.x}
                      y={c.y}
                      width={c.w}
                      height={c.h}
                      fillOpacity="0"
                    />
                  ))}
                </g>

                {/* Contour du torse + découpes (schéma de boucher) */}
                <path className="cattle__outline" d={BODY_D} fill="none" />
                <g className="cattle__cutlines" clipPath="url(#ox-body)">
                  <line x1="106" y1="96" x2="106" y2="210" />
                  <line x1="146" y1="96" x2="146" y2="210" />
                  <line x1="186" y1="96" x2="186" y2="210" />
                  <line x1="226" y1="96" x2="226" y2="210" />
                  <line x1="266" y1="96" x2="266" y2="210" />
                  <line x1="66" y1="153" x2="306" y2="153" />
                </g>

                {/* Tête + cou + corne + oreille (contour) */}
                <g className="cattle__line" fill="none">
                  <path d="M304,120 C326,108 348,104 366,112 C384,104 398,108 402,124 C406,142 398,158 382,162 C376,176 358,182 346,174 C332,180 316,172 308,156" />
                  <path d="M352,112 Q356,98 366,98" />
                  <path d="M372,110 Q382,98 392,102" />
                  <path d="M340,118 Q330,112 326,120" />
                </g>
                <circle className="cattle__eye" cx="372" cy="138" r="3" />
                <circle className="cattle__eye" cx="392" cy="156" r="1.6" />
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
                <span className="cattle__val-unit">
                  {t("home.cattle.unit")}
                </span>
              </p>
              <p className="cattle__val-cap">
                {t("home.cattle.value_caption")}
              </p>
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
