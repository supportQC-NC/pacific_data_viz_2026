// src/components/PopGrowth/PopGrowth.jsx
// ============================================================
// SECTION SIGNATURE — « La colonne : la croissance démographique » (Home). Une
// COLONNE DE SILHOUETTES s'élève au-dessus d'une ligne de base quand la
// population CROÎT (+), s'enfonce en-dessous quand elle DÉCLINE (−), selon le
// TAUX DE CROISSANCE DÉMOGRAPHIQUE réel du territoire (% annuel, signé), via le
// dataset live `population` (CPS — DF_NMDI_POP · NMDI0002).
//
// Honnête : grand nombre = taux RÉEL (%, signé, dernière année) ; la HAUTEUR de
// la colonne encode ce taux normalisé sur l'amplitude du Pacifique (dit sous le
// visuel) ; lecture NEUTRE (croissance pleine / déclin évidé, sans jugement) ;
// tendance « depuis {année} » en ton neutre. Léger souffle (rAF) ; montée animée
// par GSAP. prefers-reduced-motion respecté. <section>/ref toujours montés.
// Tokens, FR/EN, zéro inline.
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
import "./PopGrowth.scss";

// ---------------------------------------------------------------------------
// LE VILLAGE QUI SE PEUPLE OU QUI SE VIDE.
//
// C'était une colonne unique de cinq pictogrammes empilés au-dessus d'un
// pointillé : un graphique en unités, pas un dessin — et il occupait cinq pour
// cent du panneau. Les deux autres visuels de l'escale sont des SCÈNES (le fale
// sur ses pieux, la plage vue du ciel) ; celui-ci rompait la famille.
//
// Un village sur la grève dit la même chose et appartient au même monde : des
// cases s'allument et s'ajoutent quand la population croît, les volets se
// ferment quand elle décline.
//
// Ce qu'il NE dit pas, et c'est délibéré : la cause. L'indicateur agrège la
// croissance naturelle et les migrations ; dessiner des bateaux ou des berceaux
// aurait tranché une question que la donnée ne tranche pas. Une maison éclairée
// dit « on y habite », rien de plus.
//
// Lecture : cinq cases ÉTABLIES, toujours debout, plus trois emplacements de
// croissance à droite. Croissance positive → les trois se construisent, l'une
// après l'autre. Croissance négative → les cases établies se ferment, en
// partant de la droite. Zéro → le village tel qu'il est, entier et habité.
// ---------------------------------------------------------------------------

const HORIZON_Y = 104; // la ligne de mer, au loin
const BASE_Y = 182; // la grève, au premier plan

// UNE CASE EST LÀ, OU ELLE N'EST PAS.
//
// Le dessin distinguait d'abord les cases « allumées » des cases « éteintes »,
// avec des volets qui se fermaient. Cette nuance n'existe pas dans la donnée :
// l'indicateur est un taux, il ne dit rien de qui dort où. Et une case à demi
// éclairée demandait au lecteur de comparer des intensités lumineuses — la
// chose la plus difficile à comparer qui soit.
//
// Le village COMPTE désormais. Le nombre de cases suit le taux ; la fraction
// restante devient une case plus petite, ce qui rend la décimale lisible sans
// écrire un chiffre.
//
//   taux le plus bas du Pacifique  → 1 case
//   croissance nulle               → 5 cases
//   taux le plus haut              → 9 cases
//
// Ce n'est PAS un décompte de maisons : c'est une échelle normalisée sur
// l'amplitude du Pacifique, et la légende sous le dessin le dit.
const HOUSES = [
  { x: 20, s: 0.84 },
  { x: 47, s: 0.94 },
  { x: 74, s: 0.86 },
  { x: 101, s: 0.98 },
  { x: 128, s: 0.9 },
  { x: 155, s: 0.82 },
  { x: 182, s: 0.92 },
  { x: 209, s: 0.86 },
  { x: 236, s: 0.9 },
];
const MID_HOUSES = 5; // le village à croissance nulle
const SPAN_HOUSES = 4; // ce que la croissance ajoute ou retire, au maximum
// Échelle commune. Le toit couvre 38 px de large pour un pas de 28 : les cases
// se chevauchaient et le village se lisait comme une frise de chevrons.
const HOUSE_SCALE = 0.7;

// Îles au loin : deux silhouettes basses posées sur l'horizon. Elles donnent
// une profondeur au fond sans rien encoder.
const FAR_ISLES = [
  "M14,104 q16,-13 34,-9 q22,4 30,9 Z",
  "M148,104 q22,-16 44,-11 q26,5 36,11 Z",
];

// Cocotiers de la grève, derrière les cases. Même famille que le bosquet de
// l'escale 05 : stipe courbé, palmes en nervures — un palmier droit et plein
// ne ressemble à rien.
const PALMS = [
  { x: 34, s: 1.0 },
  { x: 126, s: 0.86 },
  { x: 208, s: 0.94 },
];
const PALM_TRUNK = "M0,0 C2,-18 6,-34 3,-48";
const PALM_FRONDS = [
  "M3,-48 Q-11,-56 -21,-49",
  "M3,-48 Q-9,-62 -15,-69",
  "M3,-48 Q4,-64 1,-71",
  "M3,-48 Q14,-62 20,-68",
  "M3,-48 Q17,-55 26,-48",
  "M3,-48 Q-5,-54 -12,-42",
];

// Une case : toit à deux pans débordant, corps, poteaux, et une fenêtre qui
// s'allume. Coordonnées locales, pied en (0, 0).
const HOUSE_ROOF = "M-19,-16 L0,-31 L19,-16 L15,-13 L0,-27 L-15,-13 Z";
const HOUSE_BODY = "M-13,-14 L13,-14 L13,0 L-13,0 Z";
const HOUSE_LEGS = "M-9,0 L-9,7 M9,0 L9,7";
const HOUSE_WIN = "M-5,-11 L5,-11 L5,-3 L-5,-3 Z";

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

export default function PopGrowth({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.2 });
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [lang],
  );
  const signed = useCallback(
    (val) => (val < 0 ? "\u2212" : "+") + nf.format(Math.abs(val)),
    [nf],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ds = useSelector(selectDataset("population"));

  useEffect(() => {
    dispatch(loadDataset("population"));
  }, [dispatch]);

  const status = ds.status;
  const ready = status === "succeeded" && ds.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(ds.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !Number.isFinite(pt.value)) return null;
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
    const amp = Math.max(...raw.map((o) => Math.abs(o.val))) || 1;
    return raw
      .map((o) => ({ ...o, w: Math.max(-1, Math.min(1, o.val / amp)) }))
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
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Colonne ----------- */
  // Une ref par case : son groupe, dont on pilote la taille.
  const houseRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ w: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const w = animObj.current.w;
      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.val);

      // Combien de cases, décimale comprise.
      const count = MID_HOUSES + w * SPAN_HOUSES;

      HOUSES.forEach((h, i) => {
        const node = houseRefs.current[i];
        if (!node) return;

        // Pleine si son rang est entièrement atteint ; réduite pour la
        // fraction restante ; absente au-delà. C'est la TAILLE qui porte la
        // décimale — un demi-village se voit, un « 4,5 » se lit.
        const part = clamp01(count - i);
        const eased = 1 - (1 - part) * (1 - part);
        const scale = h.s * HOUSE_SCALE * eased;

        const bob = reduced ? 0 : 0.7 * Math.sin(phase * 1.1 + i);
        node.setAttribute(
          "transform",
          `translate(0 ${bob.toFixed(2)}) scale(${scale.toFixed(3)})`,
        );
        // L'opacité ne sert qu'à effacer une case trop petite pour se lire :
        // la présence, elle, se voit à la taille.
        node.setAttribute("opacity", clamp01(part * 12).toFixed(3));
      });
    },
    [reduced, signed],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;

    if (reduced || !startedRef.current) {
      animObj.current.w = sel.w;
      animObj.current.val = sel.val;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      w: sel.w,
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

  const valText = sel ? signed(sel.val) : "+0,0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.05)
      return (
        <span className="pop__trend">
          {fillTpl(t("home.pop.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="pop__trend">
          {fillTpl(t("home.pop.trend_up"), {
            n: nf.format(d),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="pop__trend">
        {fillTpl(t("home.pop.trend_down"), {
          n: nf.format(Math.abs(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.pop.aria"), { area: sel.name, n: valText, year: sel.year })
    : t("home.pop.title");

  return (
    <section
      className={`pop ${embed ? "pop--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="pop__inner container">
        <header className="pop__head">
          <p className="eyebrow pop__kicker">{t("home.pop.kicker")}</p>
          <h2 className="pop__title">{t("home.pop.title")}</h2>
          <p className="pop__lead">{t("home.pop.lead")}</p>
        </header>

        {loading && <p className="pop__state">{t("home.pop.loading")}</p>}
        {(failed || empty) && (
          <p className="pop__state pop__state--err">{t("home.pop.unavailable")}</p>
        )}

        {ready && sel && (
          <div className="pop__stage">
            {/* Colonne 1 — contrôles */}
            <div className="pop__controls">
              <label className="pop__field">
                <span className="pop__field-label">
                  {t("home.pop.select_label")}
                </span>
                <span className="pop__select">
                  <img
                    className="pop__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="pop__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.pop.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="pop__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="pop__chips">
                  <button
                    type="button"
                    className="pop__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.pop.highest")}
                    <em>{signed(extremes.high.val)}</em>
                  </button>
                  <button
                    type="button"
                    className="pop__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.pop.lowest")}
                    <em>{signed(extremes.low.val)}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la colonne de silhouettes */}
            <figure className="pop__viz">
              <svg
                className="pop__svg"
                viewBox="0 0 240 256"
                role="img"
                aria-label={svgLabel}
              >
                {/* LE DÉCOR, EN TROIS PLANS.
                    Le village flottait sur un fond vide : rien ne disait où il
                    se tenait. Mer au loin, grève au premier plan, et deux îles
                    posées sur l'horizon pour la profondeur. Aucun de ces
                    éléments ne porte de donnée — ils donnent un LIEU. */}
                <rect className="pop__sea" x="0" y="72" width="256" height={BASE_Y - 88} />
                <g className="pop__isles" aria-hidden="true">
                  {FAR_ISLES.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
                <line
                  className="pop__horizon"
                  x1="0"
                  y1={HORIZON_Y}
                  x2="256"
                  y2={HORIZON_Y}
                />
                <path
                  className="pop__shore"
                  d={`M0,${BASE_Y - 18} Q64,${BASE_Y - 24} 128,${BASE_Y - 18} Q192,${BASE_Y - 12} 256,${BASE_Y - 17} L256,256 L0,256 Z`}
                />

                {/* Cocotiers, derrière les cases : ils cadrent le village. */}
                {PALMS.map((pm, i) => (
                  <g
                    key={`p${i}`}
                    className="pop__palm"
                    transform={`translate(${pm.x} ${BASE_Y}) scale(${pm.s})`}
                  >
                    <path className="pop__palm-trunk" d={PALM_TRUNK} fill="none" />
                    {PALM_FRONDS.map((d, k) => (
                      <path key={k} className="pop__palm-frond" d={d} fill="none" />
                    ))}
                  </g>
                ))}

                <path
                  className="pop__ground"
                  d={`M4,${BASE_Y + 2} Q60,${BASE_Y - 3} 124,${BASE_Y + 1} Q186,${BASE_Y + 5} 254,${BASE_Y}`}
                  fill="none"
                />

                {HOUSES.map((h, i) => (
                  <g key={i} transform={`translate(${h.x} ${BASE_Y})`}>
                    <g
                      ref={(n) => {
                        houseRefs.current[i] = n;
                      }}
                      className="pop__house"
                    >
                      <path className="pop__legs" d={HOUSE_LEGS} fill="none" />
                      <path className="pop__body" d={HOUSE_BODY} />
                      <path className="pop__roof" d={HOUSE_ROOF} />
                      {/* L'ouverture : un simple vide sombre. Elle ne
                          s'allume plus — l'éclairage suggérait une occupation
                          que la donnée ne mesure pas. */}
                      <path className="pop__win" d={HOUSE_WIN} />
                    </g>
                  </g>
                ))}

              </svg>
              <figcaption className="pop__viz-cap">
                {t("home.pop.size_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="pop__readout">
              <p className={`pop__val ${sel.val < 0 ? "pop__val--neg" : ""}`}>
                <span ref={numberRef} className="pop__val-num">
                  {valText}
                </span>
                <span className="pop__val-unit">{t("home.pop.unit")}</span>
              </p>
              <p className="pop__val-cap">{t("home.pop.value_caption")}</p>
              <p className="pop__name">
                <img
                  className="pop__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="pop__year">
                {fillTpl(t("home.pop.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="pop__legend">
                  {fillTpl(t("home.pop.median_label"), { n: signed(medianVal) })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="pop__source">{t("home.pop.source")}</p>
      </div>
    </section>
  );
}