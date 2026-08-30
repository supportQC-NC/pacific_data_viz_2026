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

// ---------------------------------------------------------------------------
// LA FOULE, ET NON PLUS LA GRILLE.
//
// C'étaient quarante-huit pictogrammes identiques rangés en 8 × 6, à
// intervalles rigoureusement égaux. Une grille de cette régularité ne se lit
// pas comme une foule : elle se lit comme un tableau, et c'est bien ce qu'elle
// était — un graphique en unités déguisé en dessin.
//
// Ce qui fait une foule : des tailles inégales, des écarts irréguliers, des
// gens qui se chevauchent, et de la PROFONDEUR — les rangs du fond sont plus
// petits et plus serrés. Quatre silhouettes différentes suffisent à ce que
// l'œil cesse de voir un motif répété.
//
// L'encodage ne change pas : une part des silhouettes s'illumine, et cette
// part suit le total normalisé sur l'amplitude du Pacifique. Le seuil reste
// une suite à faible discordance, pour que les personnes touchées se
// répartissent dans la foule au lieu de s'allumer par blocs.
// ---------------------------------------------------------------------------

const PHI = 0.61803398875;
const GROUND_Y = 220;

// Rangs, du plus lointain au plus proche. `s` porte la perspective : au fond
// on est plus petit, plus haut, et plus serré.
const ROWS_DEF = [
  { y: 122, s: 0.58, n: 12 },
  { y: 143, s: 0.71, n: 11 },
  { y: 166, s: 0.85, n: 10 },
  { y: 191, s: 1.0, n: 9 },
  { y: 216, s: 1.16, n: 8 },
];

// Écarts irréguliers, mais FIGÉS : une foule qui se réorganise à chaque image
// serait pire qu'une grille.
const JITTER = [
  0.0, 3.1, -2.4, 1.8, -3.6, 2.2, -1.2, 3.8, -2.9, 1.1, -3.2,
  2.7, -1.7, 3.4, -2.1, 0.8, -3.9, 2.5, -0.6, 3.0,
];

const FIGS = [];
let _k = 0;
ROWS_DEF.forEach((row, r) => {
  const span = 244 - row.s * 10;
  const step = span / row.n;
  for (let c = 0; c < row.n; c += 1) {
    const j = JITTER[(r * 7 + c) % JITTER.length];
    FIGS.push({
      x: +(10 + row.s * 5 + step * (c + 0.5) + j).toFixed(2),
      y: row.y,
      s: row.s,
      // Quatre silhouettes, distribuées sans régularité apparente.
      kind: ["adult", "carry", "child", "adult", "arm", "adult", "child"][
        (r * 3 + c) % 7
      ],
      t: ((_k++ + 0.5) * PHI) % 1,
    });
  }
});

// Silhouettes en coordonnées locales : les pieds sont en (0, 0).
// ORDRE D'ARRIVÉE. Les silhouettes n'apparaissent pas rang par rang — la
// foule se remplirait par tranches, ce qui ne ressemble à rien. Elles suivent
// la suite à faible discordance déjà utilisée pour le seuil : la foule
// s'épaissit uniformément, du fond au premier plan comme de gauche à droite.
FIGS.sort((a, b) => a.t - b.t).forEach((f, i) => {
  f.rank = i;
});

const ADULT_BODY =
  "M-4.6,0 C-4.6,-8.4 -2.7,-11.8 0,-11.8 C2.7,-11.8 4.6,-8.4 4.6,0 Z";
const ADULT_HEAD = { cy: -15.6, r: 3.4 };
const CHILD_BODY =
  "M-3.3,0 C-3.3,-5.8 -1.9,-8.2 0,-8.2 C1.9,-8.2 3.3,-5.8 3.3,0 Z";
const CHILD_HEAD = { cy: -11, r: 2.6 };
// Un ballot porté à l'épaule, et un bras levé : deux gestes, et la foule
// cesse d'être une rangée de bornes.
const CARRY_EXTRA =
  "M3.4,-13.4 q3.6,-2.2 6.4,0 q1.8,1.6 0,3.2 q-3.2,2 -6.4,0 q-1.6,-1.4 0,-3.2 Z";
const ARM_EXTRA = "M3.6,-10.4 L7.4,-17.2";

// Une silhouette. Le contour est le même pour la version neutre et la version
// touchée : seule la couleur change, jamais la forme — sinon la part
// illuminée se lirait comme une population différente.
function Silhouette({ kind }) {
  if (kind === "child") {
    return (
      <>
        <circle cx="0" cy={CHILD_HEAD.cy} r={CHILD_HEAD.r} />
        <path d={CHILD_BODY} />
      </>
    );
  }
  return (
    <>
      <circle cx="0" cy={ADULT_HEAD.cy} r={ADULT_HEAD.r} />
      <path d={ADULT_BODY} />
      {kind === "carry" ? <path d={CARRY_EXTRA} /> : null}
      {kind === "arm" ? (
        <path className="crowd__arm" d={ARM_EXTRA} fill="none" />
      ) : null}
    </>
  );
}

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
  // Deux silhouettes par emplacement : la personne, et l'enfant qui
  // porte la décimale. On bascule l'une pour l'autre.
  const adultRefs = useRef([]);
  const babyRefs = useRef([]);
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

      // LA FOULE COMPTE, ELLE NE S'ALLUME PLUS.
      //
      // Une part des silhouettes se colorait en corail, le reste restait gris.
      // Deux défauts : le dessin SAUTAIT — les mêmes cinquante personnes
      // changeaient de couleur d'un territoire à l'autre, sans que rien ne
      // bouge — et il fallait estimer une proportion de teinte, ce que l'œil
      // fait très mal.
      //
      // Le nombre de personnes présentes porte maintenant la valeur. Et la
      // décimale devient un ENFANT : plus petit que les autres, à la taille de
      // ce qui reste. Un demi-adulte ne veut rien dire ; un enfant, si.
      const count = 1 + v * (FIGS.length - 1);

      // TOUT EST CONTINU : AUCUNE BASCULE.
      //
      // L'opacité passait de 0 à 1 sur un dixième de `part` (×12), et l'enfant
      // cédait la place à l'adulte d'un coup dès que `part` atteignait 1. Deux
      // marches, donc deux sauts — et comme `count` traverse plusieurs rangs
      // pendant une transition de territoire, la foule sursautait.
      //
      // Ici tout est une rampe : la silhouette paraît doucement, grandit, puis
      // l'enfant se FOND dans l'adulte sur le dernier quart. Un seul individu
      // est en mouvement à la fois, et son mouvement ne comporte aucun palier.
      hitRefs.current.forEach((node, i) => {
        if (!node) return;
        const part = clamp01(count - FIGS[i].rank);
        const eased = 1 - (1 - part) * (1 - part);

        node.setAttribute(
          "transform",
          `translate(${FIGS[i].x} ${FIGS[i].y}) scale(${FIGS[i].s.toFixed(3)})`,
        );
        // Une rampe large : la personne entre en scène au lieu d'y clignoter.
        node.setAttribute("opacity", clamp01(part / 0.35).toFixed(3));

        // Le fondu enfant → adulte occupe le dernier quart de la venue.
        const grown = clamp01((part - 0.72) / 0.28);
        if (adultRefs.current[i])
          adultRefs.current[i].setAttribute("opacity", grown.toFixed(3));
        if (babyRefs.current[i]) {
          babyRefs.current[i].setAttribute("opacity", (1 - grown).toFixed(3));
          // L'enfant grandit lui aussi : c'est lui qui porte la décimale.
          const bs = 0.55 + 0.45 * eased;
          babyRefs.current[i].setAttribute("transform", `scale(${bs.toFixed(3)})`);
        }
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
      duration: 1.6,
      ease: "power2.inOut",
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
                {/* Le sol : sans lui la foule flotte. Une simple courbe, très
                    sourde — elle ne porte aucune donnée. */}
                <path
                  className="crowd__ground"
                  d={`M6,${GROUND_Y - 2} Q70,${GROUND_Y - 7} 132,${GROUND_Y - 2} Q194,${GROUND_Y + 3} 254,${GROUND_Y - 3}`}
                  fill="none"
                />

                <g ref={crowdRef}>
                  {/* Dessinées dans l'ordre du tableau, c'est-à-dire du rang le
                      plus LOINTAIN au plus proche : les silhouettes du premier
                      plan recouvrent celles du fond, et le léger chevauchement
                      est ce qui fait lire une foule plutôt qu'un alignement. */}
                  {/* Une seule couleur : les gens présents. Les silhouettes
                      grises « non touchées » ont disparu — elles laissaient
                      croire à une population de référence qui n'existe pas
                      dans la donnée. */}
                  {FIGS.map((fig, i) => (
                    <g
                      key={i}
                      ref={(n) => {
                        hitRefs.current[i] = n;
                      }}
                      className="crowd__person crowd__person--hit"
                      opacity="0"
                    >
                      <g
                        ref={(n) => {
                          adultRefs.current[i] = n;
                        }}
                      >
                        <Silhouette kind={fig.kind} />
                      </g>
                      <g
                        ref={(n) => {
                          babyRefs.current[i] = n;
                        }}
                        opacity="0"
                      >
                        <Silhouette kind="child" />
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