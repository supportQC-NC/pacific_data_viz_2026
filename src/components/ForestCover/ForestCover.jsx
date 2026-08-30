// src/components/ForestCover/ForestCover.jsx
// ============================================================
// SECTION SIGNATURE — « La forêt : couverture des sols » (Home). Un bosquet se
// GARNIT ou s'ÉCLAIRCIT selon l'INDICE DE COUVERTURE DES SOLS modifiant le
// climat (CALCI, base 2015 = 100) du territoire, via le dataset live
// `landCover` (FMI d'après FAO — DF_CLIMATE_CHANGE · ALT_LAND_COVER).
//
// Lecture NEUTRE (polarité neutre) : l'indice se lit comme un ÉCART à 2015
// (=100), pas comme une superficie ni un « bien/mal ». Grand nombre = indice
// RÉEL ; la densité du bosquet est normalisée sur l'amplitude du Pacifique (dit
// sous le visuel) ; tendance « depuis {année} » en ton neutre. Feuillage animé
// (rAF) ; densité animée par GSAP. prefers-reduced-motion respecté.
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
import "./ForestCover.scss";

// ---------------------------------------------------------------------------
// LE BOSQUET, REDESSINÉ.
//
// Il portait six arbres RIGOUREUSEMENT identiques : un trait vertical pour le
// tronc, quatre cercles pour la couronne, la même chose six fois de suite. Ce
// n'est pas une forêt, c'est une frise de sucettes.
//
// Deuxième défaut, plus gênant : seule la COURONNE était mise à l'échelle, le
// tronc gardait sa taille. À densité faible (facteur 0,32) le feuillage se
// rétractait et se décrochait du tronc, qui restait planté sous lui.
//
// Ici : trois silhouettes, des hauteurs différentes, et le tronc vit DANS le
// groupe animé — l'arbre grandit d'un bloc, depuis son pied.
//
// Le pin colonnaire (Araucaria columnaris) n'est pas un choix décoratif : il
// est l'emblème de la Nouvelle-Calédonie et se reconnaît à sa silhouette. Un
// bosquet du Pacifique dessiné en chênes serait joli et faux.
// ---------------------------------------------------------------------------

const GROUND_Y = 210;

// x = position au sol · s = échelle propre · kind = silhouette
// Les deux derniers sont des SEMIS : l'animation révèle les arbres dans
// l'ordre du tableau, ils n'apparaissent donc qu'aux densités hautes — le
// bosquet se regarnit par le bas, ce qui est l'idée même de l'indice.
// Le COCOTIER domine le bosquet : c'est l'arbre du Pacifique, celui qu'on
// reconnaît avant d'avoir lu la légende. Le pin colonnaire et le feuillu
// l'accompagnent — trois silhouettes suffisent à faire une forêt, une seule
// fait une frise.
const TREES = [
  { x: 40, s: 1.0, kind: "palm", cls: "forest__canopy-a" },
  { x: 94, s: 0.86, kind: "pine", cls: "forest__canopy-b" },
  { x: 148, s: 1.04, kind: "palm", cls: "forest__canopy-a" },
  { x: 206, s: 0.9, kind: "broad", cls: "forest__canopy-b" },
  { x: 262, s: 0.96, kind: "palm", cls: "forest__canopy-a" },
  { x: 318, s: 0.82, kind: "pine", cls: "forest__canopy-b" },
  { x: 124, s: 0.32, kind: "palm", cls: "forest__canopy-b" },
  { x: 238, s: 0.3, kind: "broad", cls: "forest__canopy-a" },
];

// Étages du pin colonnaire : ils se resserrent vers la cime, ce qui donne à
// l'arbre son profil de colonne plutôt que de sapin.
const PINE_TIERS = [
  [-20, 17],
  [-32, 15.5],
  [-44, 14],
  [-55, 12],
  [-66, 9.5],
  [-76, 7],
  [-85, 4.5],
];

// Couronne du feuillu : cinq masses décentrées. Aucune n'est concentrique —
// c'est ce qui évite le nuage de bande dessinée.
const BROAD_CROWN = [
  [0, -64, 19],
  [-16, -55, 14.5],
  [16, -55, 14],
  [-8, -76, 12],
  [10, -74, 11],
];

// Palmes : six nervures partant du même point, longueurs et courbures
// dissemblables. Symétriques, elles feraient une étoile.
// Huit palmes, longueurs et courbures toutes différentes. Symétriques ou de
// longueur égale, elles feraient une étoile ; ce qui fait la couronne d'un
// cocotier, c'est qu'aucune ne retombe comme sa voisine.
const PALM_FRONDS = [
  "M3,-70 Q-16,-82 -30,-73",
  "M3,-70 Q-13,-90 -22,-99",
  "M3,-70 Q-4,-94 -6,-104",
  "M3,-70 Q8,-93 6,-103",
  "M3,-70 Q19,-90 27,-98",
  "M3,-70 Q23,-80 35,-72",
  "M3,-70 Q-8,-78 -17,-62",
  "M3,-70 Q16,-76 27,-60",
];

// Géométrie en coordonnées LOCALES : le pied de l'arbre est en (0, 0) et le
// tronc monte vers les y négatifs. Le placement et l'échelle sont portés par
// les groupes parents — l'arbre lui-même ne sait pas où il pousse.
function TreeShape({ kind }) {
  if (kind === "pine") {
    return (
      <>
        <path className="forest__trunk forest__trunk--thin" d="M0,0 L0,-88" fill="none" />
        {PINE_TIERS.map(([y, w], k) => (
          <path
            key={k}
            d={`M${-w},${y} Q0,${y - 9} ${w},${y} Q0,${y + 4} ${-w},${y} Z`}
          />
        ))}
      </>
    );
  }
  if (kind === "palm") {
    return (
      <>
        {/* Le stipe se courbe : un palmier droit ne ressemble à rien. */}
        <path className="forest__trunk" d="M0,0 C2,-26 7,-50 3,-70" fill="none" />
        {PALM_FRONDS.map((d, k) => (
          <path key={k} className="forest__frond" d={d} fill="none" />
        ))}
        {/* Le régime : trois noix groupées sous la couronne, jamais alignées. */}
        <circle className="forest__nut" cx="-2" cy="-66" r="2.3" />
        <circle className="forest__nut" cx="4" cy="-64" r="2" />
        <circle className="forest__nut" cx="8" cy="-67" r="1.8" />
      </>
    );
  }
  return (
    <>
      <path className="forest__trunk" d="M0,0 C-1,-18 1,-32 0,-46" fill="none" />
      <path className="forest__trunk forest__trunk--thin" d="M0,-34 L-11,-46" fill="none" />
      <path className="forest__trunk forest__trunk--thin" d="M0,-40 L10,-50" fill="none" />
      {BROAD_CROWN.map(([cx, cy, r], k) => (
        <circle key={k} cx={cx} cy={cy} r={r} />
      ))}
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

export default function ForestCover({ embed = false, code = null } = {}) {
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

  const land = useSelector(selectDataset("landCover"));

  useEffect(() => {
    dispatch(loadDataset("landCover"));
  }, [dispatch]);

  const status = land.status;
  const ready = status === "succeeded" && land.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(land.data.byArea)
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
  }, [ready, land.data, lang]);

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

  /* ----------- Feuillage ----------- */
  const canopyRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nf.format(Math.round(animObj.current.val));

      // CHAQUE ARBRE POUSSE, LE BOSQUET NE SE FOND PAS.
      //
      // Avant : une seule échelle pour tous (0,32 → 1) et une opacité décalée
      // par arbre. Les huit arbres changeaient donc de taille ENSEMBLE pendant
      // que les derniers se dissolvaient — un fondu, pas une croissance. Un
      // fondu dit « il y a moins d'arbres » ; il ne dit pas qu'un couvert se
      // regarnit.
      //
      // Maintenant chaque arbre a SA propre progression, décalée : quand
      // l'indice monte, le premier atteint sa taille, puis le deuxième, et les
      // semis sortent en dernier. On voit une reprise, pas un réglage
      // d'opacité.
      const n = TREES.length;
      canopyRefs.current.forEach((node, i) => {
        if (!node) return;
        const tree = TREES[i];

        // Progression propre à cet arbre : il ne démarre qu'une fois le
        // précédent bien engagé, d'où le décalage `i / (n + 1)`.
        const p = clamp01((v - i / (n + 1)) * 1.9);
        // Décélération : une croissance linéaire fait sortir l'arbre comme un
        // ressort. Il ralentit en approchant de sa taille adulte.
        const grow = 1 - (1 - p) * (1 - p);

        // 0,05 et non 0 : à l'échelle nulle le navigateur cesse de composer le
        // groupe, et l'arbre réapparaîtrait d'un bloc au lieu de sortir de terre.
        const sc = (tree.s * (0.05 + 0.95 * grow)).toFixed(3);

        // Le vent se lève avec l'arbre : un semis ne se balance pas comme un
        // adulte, et un tronc absent ne se balance pas du tout.
        const sway = reduced ? 0 : 2.4 * grow * Math.sin(phase * 1.2 + i);
        node.setAttribute(
          "transform",
          `rotate(${sway.toFixed(2)}) scale(${sc})`,
        );

        // L'opacité ne sert plus qu'à masquer la pousse tant qu'elle est trop
        // petite pour se lire — elle n'encode plus rien : c'est la TAILLE qui
        // porte la densité.
        node.setAttribute("opacity", clamp01(p * 7).toFixed(3));
      });
    },
    [reduced, nf],
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

  const valText = sel ? nf.format(Math.round(sel.val)) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.5)
      return (
        <span className="forest__trend">
          {fillTpl(t("home.forest.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="forest__trend">
          {fillTpl(t("home.forest.trend_up"), {
            n: nf.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="forest__trend">
        {fillTpl(t("home.forest.trend_down"), {
          n: nf.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.forest.aria"), {
        area: sel.name,
        n: valText,
        year: sel.year,
      })
    : t("home.forest.title");

  return (
    <section
      className={`forest ${embed ? "forest--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="forest__inner container">
        <header className="forest__head">
          <p className="eyebrow forest__kicker">{t("home.forest.kicker")}</p>
          <h2 className="forest__title">{t("home.forest.title")}</h2>
          <p className="forest__lead">{t("home.forest.lead")}</p>
        </header>

        {loading && <p className="forest__state">{t("home.forest.loading")}</p>}
        {(failed || empty) && (
          <p className="forest__state forest__state--err">
            {t("home.forest.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="forest__stage">
            {/* Colonne 1 — contrôles */}
            <div className="forest__controls">
              <label className="forest__field">
                <span className="forest__field-label">
                  {t("home.forest.select_label")}
                </span>
                <span className="forest__select">
                  <img
                    className="forest__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="forest__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.forest.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="forest__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="forest__chips">
                  <button
                    type="button"
                    className="forest__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.forest.highest")}
                    <em>{nf.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="forest__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.forest.lowest")}
                    <em>{nf.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — le bosquet */}
            <figure className="forest__viz">
              <svg
                className="forest__svg"
                viewBox="0 0 360 240"
                role="img"
                aria-label={svgLabel}
              >
                {/* Sol */}
                <ellipse
                  className="forest__soil"
                  cx="180"
                  cy="214"
                  rx="172"
                  ry="13"
                />

                {/* Arbres. Deux groupes emboîtés : le premier POSE l'arbre au
                    sol, le second l'anime autour de son pied. Séparer les deux
                    évite la double translation qu'il fallait sinon écrire à
                    chaque image. */}
                {TREES.map((tree, i) => (
                  <g key={i} transform={`translate(${tree.x} ${GROUND_Y})`}>
                    <g
                      ref={(n) => {
                        canopyRefs.current[i] = n;
                      }}
                      className={`forest__canopy ${tree.cls}`}
                      opacity="0"
                    >
                      <TreeShape kind={tree.kind} />
                    </g>
                  </g>
                ))}

                {/* Touffes d'herbe */}
                <g className="forest__grass" aria-hidden="true">
                  <path d="M70,212 Q67,202 73,196" fill="none" />
                  <path d="M132,213 Q130,203 135,197" fill="none" />
                  <path d="M240,213 Q238,203 243,197" fill="none" />
                  <path d="M300,212 Q302,202 297,196" fill="none" />
                </g>
              </svg>
              <figcaption className="forest__viz-cap">
                {t("home.forest.density_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="forest__readout">
              <p className="forest__val">
                <span ref={numberRef} className="forest__val-num">
                  {valText}
                </span>
                <span className="forest__val-unit">{t("home.forest.unit")}</span>
              </p>
              <p className="forest__val-cap">{t("home.forest.value_caption")}</p>
              <p className="forest__name">
                <img
                  className="forest__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="forest__year">
                {fillTpl(t("home.forest.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="forest__legend">
                  {fillTpl(t("home.forest.median_label"), {
                    n: nf.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="forest__source">{t("home.forest.source")}</p>
      </div>
    </section>
  );
}