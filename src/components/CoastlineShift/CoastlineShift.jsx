// src/components/CoastlineShift/CoastlineShift.jsx
// ============================================================
// SECTION SIGNATURE #4 — « Le trait de côte » (Home). Nouveau mécanisme : une
// FRONTIÈRE horizontale qui bouge. Vue de dessus d'une plage — mer à gauche,
// sable à droite — et le TRAIT DE CÔTE glisse selon le BILAN RÉEL mesuré par
// satellite (Digital Earth Pacific — Landsat Coastlines), agrégé par territoire
// dans coastlineByTerritory.js (même source que l'Acte 3).
//
// Donnée par territoire :
//   • med  : variation médiane en MÈTRES PAR AN (négatif = recul/érosion,
//            positif = avancée/accrétion) → grand nombre + déplacement ;
//   • ero/acc : part du littoral qui recule / avance (%).
//
// Lecture honnête : déplacement NORMALISÉ sur l'amplitude observée du Pacifique
// (même mètre = même pixel des deux côtés). Repère pointillé « sans changement »
// pour mesurer le glissement. Projection « à ce rythme, sur 50 ans » =
// extrapolation linéaire transparente du taux réel. Vagues + clapot pilotés par
// rAF ; glissement animé par GSAP. prefers-reduced-motion respecté.
//
// NB IMPORTANT : la <section> (et donc le ref de useInView) est TOUJOURS rendue ;
// seul le contenu interne est conditionné par la sélection. Sinon l'observateur
// d'intersection ne s'accroche jamais et l'animation reste figée à 0.
// Tokens, FR/EN, zéro inline.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import gsap from "gsap";
import COASTLINE from "../../data/coastlineByTerritory";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import useInView from "../../hooks/UseInView";
import "./CoastlineShift.scss";

const VBW = 360;
const YTOP = 38;
const YBOT = 240;
const BASE_X = 184; // trait de côte « sans changement »
const RANGE = 84; // amplitude max de glissement (px) pour le plus fort taux
const PROJ_YEARS = 50;

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
const signed = (x, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;

export default function CoastlineShift() {
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const list = useMemo(
    () =>
      COASTLINE.filter((d) => isPict(d.area))
        .map((d) => ({
          code: d.area,
          name: pictName(d.area, lang),
          med: d.med,
          ero: d.ero,
          acc: d.acc,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, lang)),
    [lang],
  );

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const maxMag = useMemo(
    () => Math.max(0.0001, ...list.map((o) => Math.abs(o.med))),
    [list],
  );
  const medianMed = useMemo(() => median(list.map((o) => o.med)), [list]);
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let gain = list[0];
    let loss = list[0];
    list.forEach((o) => {
      if (o.med > gain.med) gain = o;
      if (o.med < loss.med) loss = o;
    });
    return { gain, loss };
  }, [list]);

  // Défaut : le territoire qui recule le plus (le sujet : la terre qui disparaît).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.loss.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;
  const targetOff = sel ? -(sel.med / maxMag) * RANGE : 0;

  /* ----------- Animation : vagues + glissement du trait ----------- */
  const svgRef = useRef(null);
  const seaRef = useRef(null);
  const sandRef = useRef(null);
  const foamRef = useRef(null);
  const numberRef = useRef(null);
  const crestRefs = useRef([]);
  const animObj = useRef({ off: 0, med: 0 });
  const startedRef = useRef(false);

  const crests = useMemo(
    () => [
      { y: 70, sp: 0.4, off: 0.0 },
      { y: 110, sp: 0.5, off: 0.4 },
      { y: 150, sp: 0.34, off: 0.7 },
      { y: 196, sp: 0.46, off: 0.2 },
    ],
    [],
  );

  const draw = useCallback(
    (phase) => {
      const off = animObj.current.off;
      const shoreX = BASE_X + off;
      const lap = reduced ? 0 : 2.6;
      const erosion = animObj.current.med < 0;
      const jagAmp = erosion ? 2.2 * Math.min(1, Math.abs(off) / RANGE) : 0;

      const pts = [];
      for (let y = YTOP; y <= YBOT; y += 10) {
        const x =
          shoreX +
          (reduced ? 0 : lap * Math.sin(y * 0.05 + phase * 1.5)) +
          (reduced ? 0 : jagAmp * Math.sin(y * 0.7 + phase * 4));
        pts.push([x, y]);
      }
      const line = pts.map(([x, y]) => `L${x.toFixed(1)},${y}`).join(" ");
      if (seaRef.current)
        seaRef.current.setAttribute("d", `M0,${YTOP} ${line} L0,${YBOT} Z`);
      if (sandRef.current)
        sandRef.current.setAttribute(
          "d",
          `M${VBW},${YTOP} ${line} L${VBW},${YBOT} Z`,
        );
      if (foamRef.current)
        foamRef.current.setAttribute(
          "d",
          `M${pts[0][0].toFixed(1)},${YTOP} ${line}`,
        );

      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.med, 2);

      crestRefs.current.forEach((node, i) => {
        if (!node) return;
        const c = crests[i];
        if (reduced) {
          node.setAttribute("opacity", "0.28");
          node.setAttribute("cx", String(shoreX - 30));
          node.setAttribute("cy", String(c.y));
          return;
        }
        const p = (phase * c.sp + c.off) % 1;
        const cx = 14 + p * (shoreX - 22);
        node.setAttribute("cx", cx.toFixed(1));
        node.setAttribute("cy", String(c.y));
        node.setAttribute("opacity", (0.45 * Math.sin(Math.PI * p)).toFixed(3));
      });
    },
    [reduced, crests],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const toff = startedRef.current ? targetOff : 0;
    const tmed = sel ? sel.med : 0;
    if (reduced) {
      animObj.current.off = toff;
      animObj.current.med = tmed;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      off: toff,
      med: tmed,
      duration: 1.2,
      ease: "power2.out",
    });
    return () => tw.kill();
  }, [inView, targetOff, sel, reduced, draw]);

  useEffect(() => {
    if (reduced) return undefined;
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

  const medText = sel ? signed(sel.med, 2) : "+0.00";
  const projText = sel ? signed(sel.med * PROJ_YEARS, 1) : "+0.0";
  const tone = !sel
    ? "flat"
    : Math.abs(sel.med) < 0.005
      ? "flat"
      : sel.med < 0
        ? "loss"
        : "gain";

  return (
    <section className="coast" ref={ref} data-inview={inView ? "true" : "false"}>
      <div className="coast__inner container">
        <header className="coast__head">
          <p className="eyebrow coast__kicker">{t("home.coast.kicker")}</p>
          <h2 className="coast__title">{t("home.coast.title")}</h2>
          <p className="coast__lead">{t("home.coast.lead")}</p>
        </header>

        {sel && (
          <div className="coast__stage">
            {/* Texte : contrôles + lecture */}
            <aside className="coast__aside">
              <div className="coast__controls">
                <label className="coast__field">
                  <span className="coast__field-label">
                    {t("home.coast.select_label")}
                  </span>
                  <span className="coast__select">
                    <img
                      className="coast__flag"
                      src={flagUrl(sel.code)}
                      alt=""
                      aria-hidden="true"
                    />
                    <select
                      className="coast__native"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      aria-label={t("home.coast.select_label")}
                    >
                      {list.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <span className="coast__chevron" aria-hidden="true">
                      ▾
                    </span>
                  </span>
                </label>

                {extremes && (
                  <div className="coast__chips">
                    <button
                      type="button"
                      className="coast__chip"
                      onClick={() => setSelected(extremes.loss.code)}
                    >
                      {t("home.coast.lowest")}
                      <em>{signed(extremes.loss.med, 2)}</em>
                    </button>
                    <button
                      type="button"
                      className="coast__chip"
                      onClick={() => setSelected(extremes.gain.code)}
                    >
                      {t("home.coast.highest")}
                      <em>{signed(extremes.gain.med, 2)}</em>
                    </button>
                  </div>
                )}
              </div>

              <div className="coast__readout">
                <p className={`coast__rate coast__rate--${tone}`}>
                  <span ref={numberRef} className="coast__rate-num">
                    {medText}
                  </span>
                  <span className="coast__rate-unit">m/an</span>
                </p>
                <p className="coast__rate-cap">{t("home.coast.rate_caption")}</p>
                <p className="coast__name">
                  <img
                    className="coast__name-flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  {sel.name}
                </p>

                <p className="coast__note coast__note--loss">
                  {fillTpl(t("home.coast.erosion_line"), {
                    n: Math.round(sel.ero),
                  })}
                </p>
                <p className="coast__note coast__note--gain">
                  {fillTpl(t("home.coast.accretion_line"), {
                    n: Math.round(sel.acc),
                  })}
                </p>
                <p className={`coast__proj coast__proj--${tone}`}>
                  {fillTpl(t("home.coast.projection"), { n: projText })}
                </p>

                {medianMed != null && (
                  <p className="coast__legend">
                    {fillTpl(t("home.coast.median_label"), {
                      n: signed(medianMed, 2),
                    })}
                  </p>
                )}
              </div>
            </aside>

            {/* La plage (vue de dessus) */}
            <figure className="coast__viz">
              <svg
                className="coast__svg"
                ref={svgRef}
                viewBox="0 0 360 240"
                role="img"
                aria-label={fillTpl(t("home.coast.aria"), {
                  area: sel.name,
                  n: medText,
                })}
              >
                <defs>
                  <linearGradient id="coast-sea" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" className="coast__sea-deep" />
                    <stop offset="1" className="coast__sea-shallow" />
                  </linearGradient>
                  <linearGradient id="coast-sand" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" className="coast__sand-wet" />
                    <stop offset="1" className="coast__sand-dry" />
                  </linearGradient>
                </defs>

                <path
                  ref={sandRef}
                  className="coast__sand"
                  fill="url(#coast-sand)"
                  d=""
                />
                <path
                  ref={seaRef}
                  className="coast__sea"
                  fill="url(#coast-sea)"
                  d=""
                />

                {crests.map((c, i) => (
                  <ellipse
                    key={i}
                    ref={(n) => {
                      crestRefs.current[i] = n;
                    }}
                    className="coast__crest"
                    cx="14"
                    cy={c.y}
                    rx="14"
                    ry="2.4"
                    opacity="0"
                  />
                ))}

                <path ref={foamRef} className="coast__foam" fill="none" d="" />

                <line
                  className="coast__ref"
                  x1={BASE_X}
                  x2={BASE_X}
                  y1={YTOP}
                  y2={YBOT}
                />

                <text className="coast__tag" x="16" y="30">
                  {t("home.coast.sea_label")}
                </text>
                <text className="coast__tag" x="344" y="30" textAnchor="end">
                  {t("home.coast.land_label")}
                </text>
              </svg>
              <figcaption className="coast__viz-cap">
                {t("home.coast.viz_caption")}
              </figcaption>
            </figure>
          </div>
        )}

        <p className="coast__source">{t("home.coast.source")}</p>
      </div>
    </section>
  );
}