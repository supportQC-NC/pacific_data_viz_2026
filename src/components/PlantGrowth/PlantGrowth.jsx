// src/components/PlantGrowth/PlantGrowth.jsx
// ============================================================
// SECTION SIGNATURE #5 — « La plante qui pousse » (Home). Mécanisme organique :
// une plante GRANDIT (tige + feuilles + petite fleur) jusqu'au RENDEMENT
// AGRICOLE réel du territoire (kg/ha), via le dataset live `cropYield`
// (CPS — DF_CLIMATE_CHANGE, indicateur CROP_YIELD).
//
// v2 : feuillage plus fourni (8 feuilles + nervures), léger flutter des
// feuilles, touffes d'herbe à la base, petite fleur TOUJOURS présente, et un
// MINIMUM garanti (hauteur + 1-2 feuilles) pour que les faibles rendements
// ressemblent à une pousse, pas à un trait.
//
// Lecture honnête : grand nombre = rendement réel (kg/ha) ; la HAUTEUR encode
// le rendement NORMALISÉ sur l'amplitude du Pacifique (dit sous le visuel) ;
// tendance « depuis {année} » = évolution réelle. Seuls les territoires avec
// donnée sont proposés. Animation rAF + GSAP, prefers-reduced-motion respecté.
// La <section> (ref useInView) est TOUJOURS montée. Tokens, FR/EN, zéro inline.
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
import "./PlantGrowth.scss";

const BASE_X = 120;
const BASE_Y = 268;

/* ============================================================
   LA PLANTE POUSSE LE LONG DE SA TIGE
   ------------------------------------------------------------
   Auparavant, tout le dessin était mis à l'échelle : 46 % à 100 % en hauteur,
   80 % à 100 % en largeur — DEUX facteurs différents. Un rendement faible ne
   donnait donc pas une jeune pousse mais une plante ÉCRASÉE : tige aplatie,
   feuilles restées longues et devenues plates, fleur ovale. C'est ce que
   voulait dire « les proportions sont bizarres » : rien n'était faux, tout
   était déformé.

   Une plante ne se déforme pas, elle s'allonge. On dessine donc une tige de
   longueur fixe et l'on n'en RÉVÈLE qu'une partie, avec le tracé en pointillé
   (`stroke-dasharray`). La donnée pilote la longueur poussée, jamais l'échelle.

   Tout le reste suit cette tige :
     • les feuilles se posent SUR elle, à une fraction donnée de sa longueur,
       et n'apparaissent que lorsque la pousse les a dépassées ;
     • leur inclinaison suit la TANGENTE de la tige à cet endroit, comme une
       vraie feuille sur une vraie pousse ;
     • la fleur voyage sur la pointe : elle est toujours au sommet de ce qui a
       poussé, jamais suspendue dans le vide.

   Les proportions ne bougent plus : une jeune pousse est une petite plante
   entière, pas une grande plante compressée.
   ============================================================ */

/* Tige : deux courbes douces, un léger contre-galbe — une tige rectiligne
   fait mât, pas plante. */
const STEM_D = "M120,268 C110,222 130,178 118,140 C108,108 124,84 120,58";

/* Feuilles : `at` = position le long de la tige, de 0 (au sol) à 1 (pointe).
   `dir` = côté. Elles alternent en montant, comme une phyllotaxie simple. */
const LEAVES = [
  { at: 0.14, dir: 1, size: 1.0, cls: "plant__leaf-a" },
  { at: 0.24, dir: -1, size: 1.05, cls: "plant__leaf-b" },
  { at: 0.36, dir: 1, size: 1.0, cls: "plant__leaf-b" },
  { at: 0.47, dir: -1, size: 0.92, cls: "plant__leaf-a" },
  { at: 0.58, dir: 1, size: 0.86, cls: "plant__leaf-a" },
  { at: 0.69, dir: -1, size: 0.78, cls: "plant__leaf-b" },
  { at: 0.79, dir: 1, size: 0.7, cls: "plant__leaf-b" },
  { at: 0.88, dir: -1, size: 0.62, cls: "plant__leaf-a" },
];

/* La feuille est dessinée UNE fois, pointant vers la droite, ancrée en (0,0).
   C'est la transformation qui la place, l'oriente et la dimensionne — donc
   une seule forme à soigner, et huit feuilles cohérentes. */
const LEAF_D = "M0,0 C13,-12 34,-13 48,0 C34,13 13,12 0,0 Z";
const VEIN_D = "M3,0 C16,-4 32,-4 44,0";

/* Touffes d'herbe à la base (statiques). */
const GRASS = [
  "M92,268 Q89,254 95,247",
  "M104,269 Q102,257 106,249",
  "M134,269 Q133,256 138,248",
  "M148,268 Q150,254 145,246",
];

/* ============================================================
   LA FLEUR — un bourgeon qui s'ouvre, pas une pastille fixe
   ------------------------------------------------------------
   Elle était faite de six petits disques posés à distance fixe du centre :
   toujours la même forme, toujours la même taille, et bien trop menue à côté
   de feuilles de cinquante pixels. Elle ne racontait rien de la croissance.

   Un pétale est maintenant une vraie forme, dessinée pointant vers le haut
   depuis le centre. C'est son ANGLE qui fait tout le travail :

     • rendement bas  → les six pétales restent presque superposés à la
       verticale, resserrés et étroits : un bourgeon, pas une fleur ratée ;
     • rendement haut → ils s'écartent jusqu'à 60° les uns des autres, se
       rempliss et s'élargissent : la corolle s'ouvre.

   Deux sépales verts enveloppent le bourgeon et s'effacent à mesure qu'il
   s'ouvre, comme sur une vraie plante — c'est ce détail qui fait lire
   « bourgeon » plutôt que « fleur mal dessinée ».
   ============================================================ */

/* Pétale dessiné depuis le centre (0,0), pointant vers le haut. */
const PETAL_D = "M0,0 C-6.5,-4 -7,-12 0,-17 C7,-12 6.5,-4 0,0 Z";
/* Sépale : plus court, plus étroit, il coiffe le bourgeon. */
const SEPAL_D = "M0,0 C-4.5,-3 -5,-9 0,-13 C5,-9 4.5,-3 0,0 Z";

const PETAL_COUNT = 6;
const PETALS = Array.from({ length: PETAL_COUNT }, (_, i) => i);
/* Trois sépales, répartis pour envelopper le bourgeon fermé. */
const SEPALS = [-38, 0, 38];

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

export default function PlantGrowth({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const crop = useSelector(selectDataset("cropYield"));

  useEffect(() => {
    dispatch(loadDataset("cropYield"));
  }, [dispatch]);

  const status = crop.status;
  const ready = status === "succeeded" && crop.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(crop.data.byArea)
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
  }, [ready, crop.data, lang]);

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
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Animation : croissance ----------- */
  const plantRef = useRef(null);
  // La tige et sa longueur de tracé, mesurée une seule fois : c'est elle qui
  // porte toute la croissance.
  const stemRef = useRef(null);
  const stemLenRef = useRef(0);
  const numberRef = useRef(null);
  const leafRefs = useRef([]);
  const budRef = useRef(null);
  // Pétales, sépales et cœur : la fleur s'ouvre en faisant tourner ses
  // pétales, il faut donc les atteindre un par un.
  const petalRefs = useRef([]);
  const sepalGroupRef = useRef(null);
  const coreRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nf.format(
          Math.round(animObj.current.val),
        );

      const swing = reduced ? 0 : 1;

      // LA POUSSE — une fraction de la tige révélée, pas une mise à l'échelle.
      // Un plancher de 26 % garantit qu'il y a toujours une pousse à regarder :
      // le rendement le plus faible du Pacifique reste une plante, pas un
      // moignon.
      const grow = 0.26 + 0.74 * v;

      const stem = stemRef.current;
      if (stem) {
        // La longueur du tracé est demandée au navigateur une seule fois : le
        // chemin ne change jamais, seule la part révélée bouge.
        if (!stemLenRef.current) stemLenRef.current = stem.getTotalLength();
        const L = stemLenRef.current;
        stem.style.strokeDasharray = `${L}`;
        // Le tracé part du sol : décaler le pointillé révèle donc du BAS vers
        // le haut, dans le sens où pousse une plante.
        stem.style.strokeDashoffset = `${(L * (1 - grow)).toFixed(2)}`;
      }

      // Balancement : une rotation de quelques degrés au pied, appliquée à
      // l'ensemble. C'est le seul mouvement d'ensemble — et il ne déforme rien,
      // contrairement à l'ancienne mise à l'échelle à deux facteurs.
      const sway = 2.2 * (0.45 + 0.55 * v) * swing * Math.sin(phase * 0.8);
      if (plantRef.current)
        plantRef.current.setAttribute(
          "transform",
          `rotate(${sway.toFixed(2)} ${BASE_X} ${BASE_Y})`,
        );

      // Point et tangente à une fraction donnée de la tige. La tangente est
      // prise sur un court segment autour du point : c'est ce qui permet aux
      // feuilles de s'incliner comme la tige, au lieu de rester horizontales.
      const at = (f) => {
        if (!stem || !stemLenRef.current) return null;
        const L = stemLenRef.current;
        const d = Math.max(0.5, Math.min(L - 0.5, L * f));
        const p0 = stem.getPointAtLength(d - 0.5);
        const p1 = stem.getPointAtLength(d + 0.5);
        return {
          x: (p0.x + p1.x) / 2,
          y: (p0.y + p1.y) / 2,
          // Angle de la tangente, en degrés. Vers le haut ≈ −90.
          a: (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI,
        };
      };

      leafRefs.current.forEach((node, i) => {
        if (!node) return;
        const lf = LEAVES[i];
        const pt = at(lf.at);
        if (!pt) return;

        // Une feuille ne sort que lorsque la pousse a dépassé son point
        // d'attache, et met un court instant à se déployer. C'est ce décalage
        // qui donne la sensation de croissance : elles ne s'allument pas
        // toutes ensemble.
        const open = clamp01((grow - lf.at) / 0.1);
        if (open <= 0) {
          node.setAttribute("opacity", "0");
          return;
        }
        // Frémissement propre à chaque feuille, jamais synchrone.
        const flutter = reduced ? 0 : 4 * open * Math.sin(phase * 1.6 + i * 1.1);
        // La feuille s'écarte de la tige de 58° ; le côté est donné par `dir`.
        const angle = pt.a + lf.dir * 58 + flutter * lf.dir;
        const sc = (0.62 + 0.38 * v) * lf.size * open;
        node.setAttribute(
          "transform",
          `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${sc.toFixed(3)})`,
        );
        node.setAttribute("opacity", open.toFixed(3));
      });

      // LA FLEUR VOYAGE SUR LA POINTE, ET ELLE S'OUVRE.
      //
      // Elle était clouée au sommet du dessin — donc suspendue au-dessus du
      // vide dès que la plante était petite — et gardée identique du plus
      // faible au plus fort rendement. Elle est maintenant toujours présente,
      // mais sous la forme que son rendement mérite : un bourgeon fermé en
      // bas, une corolle ouverte en haut.
      if (budRef.current) {
        const tip = at(grow);
        if (tip) {
          // Ouverture ADOUCIE aux deux bouts : le bourgeon reste bourgeon un
          // moment, la fleur s'épanouit franchement à la fin. Une progression
          // linéaire donnait une corolle à moitié ouverte sur toute la plage,
          // c'est-à-dire ni l'un ni l'autre.
          const open = v * v * (3 - 2 * v);
          // Assez grande pour tenir tête aux feuilles : à pleine ouverture,
          // la corolle fait environ la longueur d'une feuille.
          const fs = 0.8 + 0.65 * open;
          const fsw = reduced ? 0 : 3 * Math.sin(phase * 0.8 + 0.4);
          budRef.current.setAttribute(
            "transform",
            `translate(${tip.x.toFixed(2)} ${tip.y.toFixed(2)}) rotate(${fsw.toFixed(2)}) scale(${fs.toFixed(3)})`,
          );
          budRef.current.setAttribute("opacity", "1");

          // L'OUVERTURE. Fermés, les six pétales se superposent à la verticale
          // et restent étroits ; ouverts, ils s'écartent de 60° et
          // s'élargissent. Un seul paramètre, deux états lisibles.
          const spread = (360 / PETAL_COUNT) * open;
          petalRefs.current.forEach((node, i) => {
            if (!node) return;
            const a = (i - (PETAL_COUNT - 1) / 2) * spread;
            const px = 0.62 + 0.38 * open;
            const py = 0.72 + 0.28 * open;
            node.setAttribute(
              "transform",
              `rotate(${a.toFixed(2)}) scale(${px.toFixed(3)} ${py.toFixed(3)})`,
            );
          });

          // Les sépales enveloppent le bourgeon puis s'effacent derrière la
          // corolle — c'est ce détail qui fait lire « bourgeon » plutôt que
          // « fleur mal dessinée ».
          if (sepalGroupRef.current)
            sepalGroupRef.current.setAttribute(
              "opacity",
              (1 - clamp01(open * 1.5)).toFixed(3),
            );

          // Le cœur n'apparaît qu'une fois la corolle ouverte : sur un
          // bourgeon fermé, il n'est pas visible.
          if (coreRef.current)
            coreRef.current.setAttribute(
              "opacity",
              clamp01((open - 0.35) / 0.4).toFixed(3),
            );
        }
      }
    },
    [reduced, nf],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = sel ? sel.v : 0;
    const tval = sel ? sel.val : 0;
    if (reduced) {
      animObj.current.v = tv;
      animObj.current.val = tval;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: tv,
      val: tval,
      duration: 1.25,
      ease: "power2.out",
    });
    return () => tw.kill();
  }, [inView, sel, reduced, draw]);

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

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const valText = sel ? nf.format(Math.round(sel.val)) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.5)
      return (
        <span className="plant__trend plant__trend--flat">
          {fillTpl(t("home.plant.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d < 0)
      return (
        <span className="plant__trend plant__trend--down">
          {fillTpl(t("home.plant.trend_down"), {
            n: nf.format(Math.abs(Math.round(d))),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="plant__trend plant__trend--up">
        {fillTpl(t("home.plant.trend_up"), {
          n: nf.format(Math.round(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.plant.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.plant.title");

  return (
    <section
      className={`plant ${embed ? "plant--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="plant__inner container">
        <header className="plant__head">
          <p className="eyebrow plant__kicker">{t("home.plant.kicker")}</p>
          <h2 className="plant__title">{t("home.plant.title")}</h2>
          <p className="plant__lead">{t("home.plant.lead")}</p>
        </header>

        {loading && <p className="plant__state">{t("home.plant.loading")}</p>}
        {(failed || empty) && (
          <p className="plant__state plant__state--err">
            {t("home.plant.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="plant__stage">
            {/* Colonne 1 — contrôles */}
            <div className="plant__controls">
              <label className="plant__field">
                <span className="plant__field-label">
                  {t("home.plant.select_label")}
                </span>
                <span className="plant__select">
                  <img
                    className="plant__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="plant__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.plant.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="plant__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="plant__chips">
                  <button
                    type="button"
                    className="plant__chip"
                    onClick={() => setSelected(extremes.best.code)}
                  >
                    {t("home.plant.highest")}
                    <em>{nf.format(Math.round(extremes.best.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="plant__chip"
                    onClick={() => setSelected(extremes.least.code)}
                  >
                    {t("home.plant.lowest")}
                    <em>{nf.format(Math.round(extremes.least.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la plante */}
            <figure className="plant__viz">
              <svg
                className="plant__svg"
                viewBox="0 0 240 300"
                role="img"
                aria-label={svgLabel}
              >
                {/* Sol + herbe */}
                <ellipse
                  className="plant__soil"
                  cx={BASE_X}
                  cy="270"
                  rx="78"
                  ry="12"
                />
                <g className="plant__grass" aria-hidden="true">
                  {GRASS.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>

                {/* LA PLANTE. Le groupe ne porte QU'UNE ROTATION de
                    balancement : plus aucune mise à l'échelle d'ensemble, donc
                    plus aucune déformation. La croissance vit dans la tige. */}
                <g ref={plantRef}>
                  {/* La tige, révélée du sol vers la pointe. */}
                  <path
                    ref={stemRef}
                    className="plant__stem"
                    d={STEM_D}
                    fill="none"
                  />

                  {/* Les feuilles. Chacune est la MÊME forme, placée et
                      orientée par sa transformation — une seule silhouette à
                      soigner, huit feuilles cohérentes. */}
                  {LEAVES.map((lf, i) => (
                    <g
                      key={i}
                      ref={(n) => {
                        leafRefs.current[i] = n;
                      }}
                      opacity="0"
                    >
                      <path className={`plant__leaf ${lf.cls}`} d={LEAF_D} />
                      <path className="plant__vein" d={VEIN_D} fill="none" />
                    </g>
                  ))}

                  {/* La fleur, portée par la pointe de ce qui a poussé.
                      Les sépales sont dessinés AVANT les pétales : sur un
                      bourgeon fermé, ce sont eux qu'on voit, et ils passent
                      derrière la corolle quand elle s'ouvre. */}
                  <g ref={budRef} className="plant__bud">
                    <g ref={sepalGroupRef} className="plant__sepals">
                      {SEPALS.map((a, i) => (
                        <path
                          key={i}
                          className="plant__sepal"
                          d={SEPAL_D}
                          transform={`rotate(${a})`}
                        />
                      ))}
                    </g>
                    {PETALS.map((i) => (
                      <path
                        key={i}
                        ref={(n) => {
                          petalRefs.current[i] = n;
                        }}
                        className="plant__petal"
                        d={PETAL_D}
                      />
                    ))}
                    <circle ref={coreRef} className="plant__core" cx="0" cy="0" r="3.6" />
                  </g>
                </g>
              </svg>
              <figcaption className="plant__viz-cap">
                {t("home.plant.height_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="plant__readout">
              <p className="plant__val">
                <span ref={numberRef} className="plant__val-num">
                  {valText}
                </span>
                <span className="plant__val-unit">{t("home.plant.unit")}</span>
              </p>
              <p className="plant__val-cap">{t("home.plant.value_caption")}</p>
              <p className="plant__name">
                <img
                  className="plant__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="plant__year">
                {fillTpl(t("home.plant.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="plant__legend">
                  {fillTpl(t("home.plant.median_label"), {
                    n: nf.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="plant__source">{t("home.plant.source")}</p>
      </div>
    </section>
  );
}