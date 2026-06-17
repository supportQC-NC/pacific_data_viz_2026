// src/components/StiltHouse/StiltHouse.jsx
// ============================================================
// SECTION SIGNATURE — « La maison sur pilotis : le niveau de la mer » (Home).
// Une case pacifique sur pilotis ; l'OCÉAN MONTE le long des pieux selon
// l'ANOMALIE DU NIVEAU DE LA MER réelle du territoire (écart à la moyenne
// 1993–2012), via le dataset live `seaLevel` (Copernicus C3S / DUACS — jeu
// officiel du Challenge, DF_CLIMATE_CHANGE · SEA_LVL). Brut en mètres → affiché
// en mm.
//
// Honnête : grand nombre = anomalie RÉELLE (mm signés, dernière année) ; la
// HAUTEUR d'eau est normalisée sur l'amplitude du Pacifique (dit sous le
// visuel) ; pas de médiane (référence = niveau 1993–2012) ; tendance « depuis
// {année} » réelle (hausse = pire, corail ; baisse = mieux, vert). Houle animée
// (rAF) ; montée animée par GSAP. prefers-reduced-motion respecté.
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
import "./StiltHouse.scss";

const HIGH_Y = 158; // eau haute (juste sous le plancher)
const LOW_Y = 266; // eau basse (près du fond)
const SEABED_Y = 272;
const STILTS = [100, 150, 210, 260];
const BUBBLES = [118, 150, 196, 232, 168];

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

export default function StiltHouse({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });
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

  const sea = useSelector(selectDataset("seaLevel"));

  useEffect(() => {
    dispatch(loadDataset("seaLevel"));
  }, [dispatch]);

  const status = sea.status;
  const ready = status === "succeeded" && sea.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const rawEntries = Object.entries(sea.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !Number.isFinite(pt.value)) return null;
        const f = firstFinite(serie);
        return { code, serie, pt, f };
      })
      .filter(Boolean);
    if (!rawEntries.length) return [];

    // Auto-échelle mètres → mm : si l'amplitude est < 5, c'est en mètres.
    const maxAbs = Math.max(...rawEntries.map((o) => Math.abs(o.pt.value)));
    const factor = maxAbs < 5 ? 1000 : 1;

    const raw = rawEntries.map(({ code, pt, f }) => ({
      code,
      name: pictName(code, lang),
      val: pt.value * factor,
      year: pt.year,
      delta: f ? (pt.value - f.value) * factor : null,
      fromYear: f ? f.year : null,
    }));

    const vals = raw.map((o) => o.val);
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const span = vMax - vMin || 1;
    return raw
      .map((o) => ({ ...o, v: clamp01((o.val - vMin) / span) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, sea.data, lang]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

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

  // Défaut : l'anomalie la plus forte (le plus menacé).
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

  /* ----------- Houle + montée ----------- */
  const backRef = useRef(null);
  const frontRef = useRef(null);
  const bubbleRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.val);

      const ly = LOW_Y + v * (HIGH_Y - LOW_Y);

      const build = (baseY, amp, k, sp, off) => {
        let d = `M-10,${baseY.toFixed(1)}`;
        for (let x = -10; x <= 370; x += 16) {
          const yy = reduced
            ? baseY
            : baseY + amp * Math.sin(x * k + phase * sp + off);
          d += ` L${x},${yy.toFixed(2)}`;
        }
        return `${d} L370,300 L-10,300 Z`;
      };
      if (backRef.current)
        backRef.current.setAttribute("d", build(ly - 5, 4, 0.05, 1.1, 1.4));
      if (frontRef.current)
        frontRef.current.setAttribute("d", build(ly, 4.5, 0.06, 1.5, 0));

      bubbleRefs.current.forEach((node, i) => {
        if (!node) return;
        const sp = 24 + (i % 3) * 8;
        const span = SEABED_Y - ly;
        if (span <= 6) {
          node.setAttribute("opacity", "0");
          return;
        }
        const yb = reduced
          ? SEABED_Y - ((i + 1) / 6) * span
          : SEABED_Y - ((phase * sp + i * 24) % span);
        const op = clamp01((yb - ly) / 40) * 0.5;
        node.setAttribute("cy", yb.toFixed(1));
        node.setAttribute("opacity", op.toFixed(3));
      });
    },
    [reduced, signed],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;

    // Pas encore révélé (ou reduced-motion) → on affiche directement la valeur.
    if (reduced || !startedRef.current) {
      animObj.current.v = sel.v;
      animObj.current.val = sel.val;
      draw(0);
      return undefined;
    }
    // Révélé → on anime vers la valeur sélectionnée (toujours à jour).
    const tw = gsap.to(animObj.current, {
      v: sel.v,
      val: sel.val,
      duration: 1.3,
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

  const valText = sel ? signed(sel.val) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 1)
      return (
        <span className="stilt__trend stilt__trend--flat">
          {fillTpl(t("home.stilt.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="stilt__trend stilt__trend--up">
          {fillTpl(t("home.stilt.trend_up"), {
            n: nf.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="stilt__trend stilt__trend--down">
        {fillTpl(t("home.stilt.trend_down"), {
          n: nf.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.stilt.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.stilt.title");

  return (
    <section
      className={`stilt ${embed ? "stilt--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="stilt__inner container">
        <header className="stilt__head">
          <p className="eyebrow stilt__kicker">{t("home.stilt.kicker")}</p>
          <h2 className="stilt__title">{t("home.stilt.title")}</h2>
          <p className="stilt__lead">{t("home.stilt.lead")}</p>
        </header>

        {loading && <p className="stilt__state">{t("home.stilt.loading")}</p>}
        {(failed || empty) && (
          <p className="stilt__state stilt__state--err">
            {t("home.stilt.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="stilt__stage">
            {/* Colonne 1 — contrôles */}
            <div className="stilt__controls">
              <label className="stilt__field">
                <span className="stilt__field-label">
                  {t("home.stilt.select_label")}
                </span>
                <span className="stilt__select">
                  <img
                    className="stilt__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="stilt__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.stilt.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="stilt__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="stilt__chips">
                  <button
                    type="button"
                    className="stilt__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.stilt.highest")}
                    <em>{signed(extremes.high.val)}</em>
                  </button>
                  <button
                    type="button"
                    className="stilt__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.stilt.lowest")}
                    <em>{signed(extremes.low.val)}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la maison sur pilotis */}
            <figure className="stilt__viz">
              <svg
                className="stilt__svg"
                viewBox="0 0 360 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="stilt-frame">
                    <rect x="0" y="0" width="360" height="300" rx="16" />
                  </clipPath>
                </defs>

                <g clipPath="url(#stilt-frame)">
                  <rect className="stilt__sky" x="0" y="0" width="360" height="300" />

                  {/* Pilotis */}
                  <g className="stilt__posts">
                    {STILTS.map((x, i) => (
                      <line key={i} x1={x} y1="150" x2={x} y2={SEABED_Y} />
                    ))}
                    {/* entretoises */}
                    <line x1="100" y1="206" x2="260" y2="206" />
                  </g>

                  {/* Échelle */}
                  <g className="stilt__ladder">
                    <line x1="118" y1="152" x2="96" y2={SEABED_Y} />
                    <line x1="130" y1="152" x2="108" y2={SEABED_Y} />
                    <line x1="124" y1="170" x2="112" y2="170" />
                    <line x1="120" y1="192" x2="108" y2="192" />
                    <line x1="116" y1="214" x2="104" y2="214" />
                    <line x1="112" y1="236" x2="100" y2="236" />
                  </g>

                  {/* Eau (semi-transparente : pilotis submergés visibles) */}
                  <path ref={backRef} className="stilt__water-back" d="" />
                  <path ref={frontRef} className="stilt__water-front" d="" />
                  {BUBBLES.map((x, i) => (
                    <circle
                      key={i}
                      ref={(n) => {
                        bubbleRefs.current[i] = n;
                      }}
                      className="stilt__bubble"
                      cx={x}
                      cy="260"
                      r={2 + (i % 3)}
                      opacity="0"
                    />
                  ))}

                  {/* Maison (toujours au-dessus de l'eau) */}
                  <g className="stilt__house">
                    {/* plancher */}
                    <rect className="stilt__floor" x="78" y="144" width="204" height="8" rx="2" />
                    {/* corps */}
                    <rect className="stilt__wall" x="104" y="104" width="152" height="42" rx="2" />
                    {/* porte + fenêtre */}
                    <rect className="stilt__door" x="170" y="116" width="22" height="30" rx="2" />
                    <rect className="stilt__window" x="120" y="116" width="26" height="18" rx="2" />
                    {/* toit (chaume arrondi) */}
                    <path className="stilt__roof" d="M66,110 Q180,52 294,110 Z" />
                    <path className="stilt__roof-ridge" d="M84,104 Q180,66 276,104" fill="none" />
                  </g>
                </g>

                <rect
                  className="stilt__frame"
                  x="1"
                  y="1"
                  width="358"
                  height="298"
                  rx="16"
                  fill="none"
                />
              </svg>
              <figcaption className="stilt__viz-cap">
                {t("home.stilt.level_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="stilt__readout">
              <p className="stilt__val">
                <span ref={numberRef} className="stilt__val-num">
                  {valText}
                </span>
                <span className="stilt__val-unit">{t("home.stilt.unit")}</span>
              </p>
              <p className="stilt__val-cap">{t("home.stilt.value_caption")}</p>
              <p className="stilt__name">
                <img
                  className="stilt__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="stilt__year">
                {fillTpl(t("home.stilt.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>
            </div>
          </div>
        )}

        <p className="stilt__source">{t("home.stilt.source")}</p>
      </div>
    </section>
  );
}