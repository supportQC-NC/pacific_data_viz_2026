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

// UNE CÔTE N'EST PAS UNE SINUSOÏDE.
// Le trait était une seule onde régulière : lisse, périodique, reconnaissable
// comme une formule. Un rivage réel est irrégulier à plusieurs échelles. Ce
// bruit est FIGÉ (et non tiré à chaque image) : une côte qui frétillerait
// serait pire que lisse.
const SHORE_NOISE = [
  0.0, -2.1, 1.4, 3.2, 0.6, -1.8, -3.4, -1.1, 1.9, 3.8, 2.2, -0.4, -2.6,
  -3.9, -1.7, 0.9, 2.8, 4.1, 2.3, 0.2, -1.5, -3.1, -2.2, 0.4, 2.6, 3.3,
  1.2, -0.8, -2.9, -3.6, -1.4, 0.7, 2.4, 3.9, 1.8, -0.3, -2.2, -3.4,
];

// Massifs coralliens vus du ciel. En ellipses grises ils passaient pour des
// galets : un récif se repère à ce qu'il est plus CLAIR que le fond, et à ce
// qu'aucun de ses contours n'est régulier.
const REEFS = [
  "M32,84 q14,-9 27,-2 q10,7 1,13 q-16,7 -27,1 q-7,-6 -1,-12 Z",
  "M84,162 q11,-7 20,-1 q7,5 0,10 q-12,5 -20,0 q-5,-4 0,-9 Z",
  "M52,202 q9,-6 16,-1 q6,4 0,8 q-10,4 -16,0 q-4,-3 0,-7 Z",
  "M112,56 q8,-5 15,-1 q5,4 0,7 q-9,4 -15,0 q-4,-3 0,-6 Z",
];

// Bosquets côté terre. En cercles de rayon voisin et régulièrement espacés,
// ils faisaient des pois. Ils sont maintenant de tailles très inégales et
// serrés près du rivage, clairsemés en s'enfonçant dans les terres — c'est
// ainsi que pousse la végétation littorale.
// Bosquets côté terre. En cercles parfaits ils faisaient des pois : un couvert
// végétal vu du ciel n'a ni bord net ni forme répétée. Chaque tache a donc son
// propre contour, et les tailles restent très inégales.
const SCRUB = [
  ["M292,46 q13,-8 24,-1 q9,7 -1,12 q-15,7 -25,0 q-7,-6 2,-11 Z", 0],
  ["M316,72 q8,-5 14,0 q5,4 -1,7 q-9,4 -14,0 q-4,-4 1,-7 Z", 1],
  ["M300,92 q11,-7 20,-1 q8,6 -1,10 q-13,6 -20,0 q-6,-5 1,-9 Z", 0],
  ["M334,84 q6,-4 11,0 q4,3 -1,5 q-7,3 -11,0 q-3,-3 1,-5 Z", 1],
  ["M296,124 q14,-9 26,-1 q10,7 -1,13 q-16,7 -26,0 q-8,-6 1,-12 Z", 0],
  ["M326,140 q8,-5 15,0 q5,4 -1,7 q-10,4 -15,0 q-4,-4 1,-7 Z", 1],
  ["M300,166 q10,-6 18,-1 q7,5 -1,9 q-12,5 -18,0 q-5,-4 1,-8 Z", 0],
  ["M330,180 q11,-7 20,-1 q8,6 -1,10 q-13,5 -20,0 q-6,-5 1,-9 Z", 0],
  ["M340,158 q6,-4 11,0 q4,3 -1,5 q-7,3 -11,0 q-3,-3 1,-5 Z", 1],
  ["M294,202 q12,-8 22,-1 q9,6 -1,11 q-14,6 -22,0 q-7,-5 1,-10 Z", 0],
  ["M322,218 q7,-5 13,0 q5,4 -1,6 q-9,4 -13,0 q-4,-3 1,-6 Z", 1],
  ["M338,206 q8,-5 15,0 q6,4 -1,7 q-10,4 -15,0 q-4,-4 1,-7 Z", 0],
  ["M300,236 q10,-6 18,-1 q7,5 -1,9 q-12,4 -18,0 q-5,-4 1,-8 Z", 0],
];

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

export default function CoastlineShift({ embed = false, code = null } = {}) {
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
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);
  const targetOff = sel ? -(sel.med / maxMag) * RANGE : 0;

  /* ----------- Animation : vagues + glissement du trait ----------- */
  const svgRef = useRef(null);
  const seaRef = useRef(null);
  const sandRef = useRef(null);
  const foamRef = useRef(null);
  // Bandes de déferlement et de sable mouillé : elles suivent le trait,
  // c'est ce qui fait lire une plage plutôt qu'une frontière.
  const surfRef = useRef(null);
  const wetRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ off: 0, med: 0 });
  const startedRef = useRef(false);


  const draw = useCallback(
    (phase) => {
      const off = animObj.current.off;
      const shoreX = BASE_X + off;
      const lap = reduced ? 0 : 2.6;
      const erosion = animObj.current.med < 0;
      const jagAmp = erosion ? 2.2 * Math.min(1, Math.abs(off) / RANGE) : 0;

      // DEUX TRACÉS, ET C'EST TOUTE LA DIFFÉRENCE.
      //
      // Un seul servait à la mer ET à la terre : la houle déplaçait donc le
      // SABLE autant que l'eau, et la plage entière frétillait. Or le rivage
      // ne bouge pas à l'échelle d'une vague — c'est l'eau qui vient le lécher
      // et se retire.
      //
      //   `shorePts` : le rivage. Fixe, avec son irrégularité figée. Il ne se
      //                déplace qu'avec la DONNÉE, quand le territoire change.
      //   `waterPts` : la lisière de l'eau. C'est elle, et elle seule, que la
      //                houle fait aller et venir par-dessus le sable.
      const shorePts = [];
      const waterPts = [];
      for (let y = YTOP, k = 0; y <= YBOT; y += 6, k += 1) {
        const base = shoreX + SHORE_NOISE[k % SHORE_NOISE.length];
        shorePts.push([base, y]);
        waterPts.push([
          base +
            (reduced ? 0 : lap * Math.sin(y * 0.05 + phase * 1.5)) +
            (reduced ? 0 : jagAmp * Math.sin(y * 0.7 + phase * 4)),
          y,
        ]);
      }
      const seg = (arr) =>
        arr.map(([x, y]) => `L${x.toFixed(1)},${y}`).join(" ");
      // Une bande entre deux copies d'un tracé, décalées : elle épouse la côte
      // au lieu d'être un rectangle posé à côté.
      const band = (src, dxA, dxB) => {
        const a = src.map(([x, y]) => [x + dxA, y]);
        const b = src.map(([x, y]) => [x + dxB, y]).reverse();
        return `M${a[0][0].toFixed(1)},${a[0][1]} ${seg(a)} ${seg(b)} Z`;
      };

      // L'eau : sa lisière ondule.
      if (seaRef.current)
        seaRef.current.setAttribute(
          "d",
          `M0,${YTOP} ${seg(waterPts)} L0,${YBOT} Z`,
        );
      // LE SABLE PASSE SOUS L'EAU.
      // Son bord s'arrêtait exactement au rivage : quand la vague se retirait
      // au-delà, il ne restait entre les deux qu'une fente de fond, une
      // déchirure noire le long de la côte. Le sable déborde donc d'un peu plus
      // que l'amplitude de la houle, et la mer, dessinée par-dessus, le
      // recouvre. Ce qui se découvre au reflux est du sable mouillé — ce qui
      // est exactement ce qu'on voit sur une plage.
      const under = -(lap + jagAmp + 2);
      if (sandRef.current)
        sandRef.current.setAttribute(
          "d",
          `M${VBW},${YTOP} ${seg(shorePts.map(([x, y]) => [x + under, y]))} L${VBW},${YBOT} Z`,
        );
      // Le déferlement suit l'eau ; le sable mouillé reste au sol.
      if (surfRef.current)
        surfRef.current.setAttribute("d", band(waterPts, -15, 1));
      if (wetRef.current)
        wetRef.current.setAttribute("d", band(shorePts, under, 20));
      if (foamRef.current)
        foamRef.current.setAttribute(
          "d",
          `M${waterPts[0][0].toFixed(1)},${YTOP} ${seg(waterPts)}`,
        );

      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.med, 2);

    },
    [reduced],
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
    <section
      className={`coast ${embed ? "coast--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
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

                {/* Massifs coralliens dans le petit fond. Trois taches grises
                    flottaient auparavant dans l'eau sans rien signifier ; ceux-ci
                    posent une profondeur et rompent l'aplat. */}
                <g className="coast__reefs" aria-hidden="true">
                  {REEFS.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>

                {/* Sable mouillé, puis déferlement : les deux suivent le trait. */}
                <path ref={wetRef} className="coast__wet" d="" />
                <path ref={surfRef} className="coast__surf" d="" />

                {/* Les crêtes en ellipses claires ont été retirées : à cette
                    échelle elles se lisaient comme des objets flottants, et
                    elles doublaient ce que la lisière ondulante dit déjà. */}

                <path ref={foamRef} className="coast__foam" fill="none" d="" />

                <line
                  className="coast__ref"
                  x1={BASE_X}
                  x2={BASE_X}
                  y1={YTOP}
                  y2={YBOT}
                />

                {/* Végétation côté terre : ce qui borde une plage vue du ciel,
                    c'est un liseré de bosquets, pas une arête franche. */}
                <g className="coast__scrub" aria-hidden="true">
                  {SCRUB.map(([d, tone], i) => (
                    <path key={i} className={tone ? "coast__scrub--pale" : ""} d={d} />
                  ))}
                </g>

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