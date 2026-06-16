// src/components/PowerMix/PowerMix.jsx
// ============================================================
// SECTION SIGNATURE — « L'anneau : le mix électrique » (Home). Un DONUT se
// recompose par territoire : chaque segment = une SOURCE de production
// électrique (hydro, solaire, éolien, géothermie, biomasse, fossile…), taillé
// par sa part réelle en GWh, via le service dédié `powerApi` (fetchPowerMix —
// IRENA/DF_POWER_GEN, raccordement « Total »).
//
// 100 % RÉEL : le donut montre la composition réelle du mix (parts de GWh) de la
// dernière année disponible — aucune normalisation. Chiffre clé = PART
// RENOUVELABLE réelle (%). Légende = sources et leurs parts. Lueur en rotation
// (rAF) ; recomposition + comptage animés (GSAP/CSS). prefers-reduced-motion
// respecté. <section>/ref toujours montés. Tokens, FR/EN, zéro inline.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import gsap from "gsap";
import { fetchPowerMix } from "../../services/powerApi";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import useInView from "../../hooks/UseInView";
import "./PowerMix.scss";

const CX = 120;
const CY = 120;
const R1 = 54;
const R2 = 92;

function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function donutArc(a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [xo0, yo0] = polar(CX, CY, R2, a0);
  const [xo1, yo1] = polar(CX, CY, R2, a1);
  const [xi1, yi1] = polar(CX, CY, R1, a1);
  const [xi0, yi0] = polar(CX, CY, R1, a0);
  return `M${xo0.toFixed(2)},${yo0.toFixed(2)} A${R2},${R2} 0 ${large} 1 ${xo1.toFixed(2)},${yo1.toFixed(2)} L${xi1.toFixed(2)},${yi1.toFixed(2)} A${R1},${R1} 0 ${large} 0 ${xi0.toFixed(2)},${yi0.toFixed(2)} Z`;
}
function colorClass(kind, idx) {
  return kind === "renew"
    ? `power__c-r${idx % 4}`
    : `power__c-f${idx % 2}`;
}
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}

export default function PowerMix() {
  const { t, lang } = useLang();
  const [ref, inView] = useInView({ threshold: 0.2 });
  const nf0 = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        maximumFractionDigits: 0,
      }),
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

  /* ----------- Chargement (powerApi) ----------- */
  const [power, setPower] = useState({ status: "loading", data: null });
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setPower({ status: "loading", data: null });
    fetchPowerMix({ lang, signal: ctrl.signal })
      .then((res) => {
        if (!alive) return;
        if (res && res.source === "live")
          setPower({ status: "done", data: res });
        else setPower({ status: "error", data: null });
      })
      .catch(() => alive && setPower({ status: "error", data: null }));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [lang]);

  const ready = power.status === "done" && power.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const { byArea, detailSources } = power.data;
    const out = Object.entries(byArea)
      .filter(([code]) => isPict(code))
      .map(([code, a]) => {
        const years = new Set();
        detailSources.forEach((s) => {
          const d = a.detail[s.label];
          if (d) Object.keys(d).forEach((y) => years.add(+y));
        });
        if (!years.size) return null;
        const year = Math.max(...years);
        let ri = 0;
        let fi = 0;
        const sources = detailSources
          .map((s) => {
            const gwh = (a.detail[s.label] && a.detail[s.label][year]) || 0;
            return { label: s.label, kind: s.kind, gwh };
          })
          .filter((s) => s.gwh > 0)
          .map((s) => {
            const idx = s.kind === "renew" ? ri++ : fi++;
            return { ...s, cls: colorClass(s.kind, idx) };
          });
        const total = sources.reduce((x, s) => x + s.gwh, 0);
        if (total <= 0) return null;
        const renewGwh = sources
          .filter((s) => s.kind === "renew")
          .reduce((x, s) => x + s.gwh, 0);
        const withShare = sources.map((s) => ({
          ...s,
          share: (s.gwh / total) * 100,
        }));
        return {
          code,
          name: pictName(code, lang),
          year,
          total,
          sources: withShare,
          renewShare: (renewGwh / total) * 100,
        };
      })
      .filter(Boolean);
    return out.sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, power.data, lang]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const extremes = useMemo(() => {
    if (!list.length) return null;
    let green = list[0];
    let fossil = list[0];
    let big = list[0];
    list.forEach((o) => {
      if (o.renewShare > green.renewShare) green = o;
      if (o.renewShare < fossil.renewShare) fossil = o;
      if (o.total > big.total) big = o;
    });
    return { green, fossil, big };
  }, [list]);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.big.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;

  // Segments du donut pour la sélection.
  const segs = useMemo(() => {
    if (!sel) return [];
    if (sel.sources.length === 1) {
      return [{ cls: sel.sources[0].cls, full: true }];
    }
    let acc = 0;
    return sel.sources.map((s) => {
      const a0 = acc * 3.6;
      acc += s.share;
      const a1 = Math.min(acc, 99.999) * 3.6;
      return { cls: s.cls, d: donutArc(a0, a1) };
    });
  }, [sel]);

  /* ----------- Animation ----------- */
  const glowRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      if (numberRef.current)
        numberRef.current.textContent = nf0.format(Math.round(animObj.current.val));
      if (glowRef.current) {
        const rot = reduced ? 0 : (phase * 12) % 360;
        glowRef.current.setAttribute(
          "transform",
          `rotate(${rot.toFixed(1)} ${CX} ${CY})`,
        );
      }
    },
    [reduced, nf0],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;
    if (reduced || !startedRef.current) {
      animObj.current.val = sel.renewShare;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      val: sel.renewShare,
      duration: 1.1,
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

  const loading = power.status === "loading";
  const failed = power.status === "error";
  const empty = ready && list.length === 0;

  const valText = sel ? nf0.format(Math.round(sel.renewShare)) : "0";

  const svgLabel = sel
    ? fillTpl(t("home.power.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.power.title");

  return (
    <section className="power" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="power__inner container">
        <header className="power__head">
          <p className="eyebrow power__kicker">{t("home.power.kicker")}</p>
          <h2 className="power__title">{t("home.power.title")}</h2>
          <p className="power__lead">{t("home.power.lead")}</p>
        </header>

        {loading && <p className="power__state">{t("home.power.loading")}</p>}
        {(failed || empty) && (
          <p className="power__state power__state--err">
            {t("home.power.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="power__stage">
            {/* Colonne 1 — contrôles */}
            <div className="power__controls">
              <label className="power__field">
                <span className="power__field-label">
                  {t("home.power.select_label")}
                </span>
                <span className="power__select">
                  <img
                    className="power__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="power__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.power.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="power__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="power__chips">
                  <button
                    type="button"
                    className="power__chip"
                    onClick={() => setSelected(extremes.green.code)}
                  >
                    {t("home.power.greenest")}
                    <em>{nf0.format(Math.round(extremes.green.renewShare))} %</em>
                  </button>
                  <button
                    type="button"
                    className="power__chip"
                    onClick={() => setSelected(extremes.fossil.code)}
                  >
                    {t("home.power.fossilest")}
                    <em>{nf0.format(Math.round(extremes.fossil.renewShare))} %</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — l'anneau */}
            <figure className="power__viz">
              <svg
                className="power__svg"
                viewBox="0 0 240 240"
                role="img"
                aria-label={svgLabel}
              >
                {/* lueur en rotation */}
                <g ref={glowRef}>
                  <circle
                    className="power__glow"
                    cx={CX}
                    cy={CY}
                    r={R2 + 12}
                    fill="none"
                  />
                </g>

                {/* segments du mix (re-montés à chaque sélection) */}
                <g className="power__segs" key={sel.code}>
                  {segs.map((s, i) =>
                    s.full ? (
                      <g key={i}>
                        <circle
                          className={`power__seg ${s.cls}`}
                          cx={CX}
                          cy={CY}
                          r={(R1 + R2) / 2}
                          fill="none"
                          strokeWidth={R2 - R1}
                        />
                      </g>
                    ) : (
                      <path key={i} className={`power__seg ${s.cls}`} d={s.d} />
                    ),
                  )}
                </g>

                {/* éclair central */}
                <path
                  className="power__bolt"
                  d={`M${CX + 6},${CY - 22} L${CX - 10},${CY + 3} L${CX - 1},${CY + 3} L${CX - 6},${CY + 22} L${CX + 11},${CY - 4} L${CX + 1},${CY - 4} Z`}
                />
              </svg>
              <figcaption className="power__viz-cap">
                {fillTpl(t("home.power.mix_caption"), { year: sel.year })}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture + légende */}
            <div className="power__readout">
              <p className="power__val">
                <span ref={numberRef} className="power__val-num">
                  {valText}
                </span>
                <span className="power__val-unit">%</span>
              </p>
              <p className="power__val-cap">{t("home.power.value_caption")}</p>
              <p className="power__name">
                <img
                  className="power__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="power__year">
                {fillTpl(t("home.power.year_label"), {
                  year: sel.year,
                  total: nfC.format(Math.round(sel.total)),
                })}
              </p>

              <ul className="power__legend">
                {sel.sources.map((s, i) => (
                  <li key={i} className="power__legend-row">
                    <span className={`power__sw ${s.cls}`} aria-hidden="true" />
                    <span className="power__legend-label">{s.label}</span>
                    <em className="power__legend-share">
                      {nf0.format(Math.round(s.share))} %
                    </em>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <p className="power__source">{t("home.power.source")}</p>
      </div>
    </section>
  );
}