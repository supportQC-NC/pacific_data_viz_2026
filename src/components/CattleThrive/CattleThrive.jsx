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

/* ============================================================
   LA BÊTE — une silhouette bovine dont la CORPULENCE porte la donnée
   ------------------------------------------------------------
   Ce que faisait le dessin précédent : la valeur remplissait la silhouette de
   gauche à droite, comme une jauge. À 173 kg/animal on voyait un TIERS DE
   VACHE — ce qui se lit « animal incomplet », pas « moins productif ». Le sens
   du remplissage était arbitraire (pourquoi la tête en dernier ?), les taches
   ne codaient rien tout en étant l'élément le plus visible, et la médiane
   était un trait pointillé de graphique planté dans une illustration.

   Ici, la donnée fait ce qu'elle fait sur un vrai troupeau : elle change
   l'ÉTAT DE CHAIR de l'animal. Le squelette ne bouge pas — garrot, hanche,
   aplombs restent où ils sont, comme chez toute bête de la même race. Ce qui
   varie, c'est ce qu'il y a autour :

     • la profondeur du corps (le tour de poitrine, la mesure que l'on prend
       réellement pour juger une bête) ;
     • la ligne de dos, creusée et anguleuse chez la maigre, droite et pleine
       chez l'autre ;
     • la pointe de hanche, saillante quand la bête est maigre ;
     • le fanon sous l'encolure, plein quand elle est en état.

   Et la MÉDIANE du Pacifique n'est plus un trait : c'est la même bête, tracée
   en contour derrière. On compare deux animaux, pas une valeur à une règle.

   Repère : viewBox 0 0 380 250, tête à droite.
   ============================================================ */

const lerp = (a, b, t) => a + (b - a) * t;

/* ---- LES PROPORTIONS, ÉTABLIES AVANT DE DESSINER ----
   Deux rapports décident si une silhouette se lit « bovin » ou « animal
   indéterminé », et les deux étaient faux :

     • LONGUEUR / PROFONDEUR DU TRONC. Un bovin tient dans un rapport voisin
       de 2. Le tracé précédent en était à 3,7 : d'où la impression de planche
       sur pattes, avant même qu'on regarde le détail.
     • PROFONDEUR DU CORPS / HAUTEUR SOUS LE VENTRE. Elles sont du même ordre
       sur une bête réelle. On était à 52 contre 70 : la bête montait sur
       échasses.

   Les repères ci-dessous tiennent ces deux rapports. Ils forment le SQUELETTE
   et ne dépendent jamais de la donnée — un animal maigre et un animal en état
   ont les mêmes os. */
const RUMP_X = 104; // pointe de la croupe
const WITHERS_X = 236; // garrot
const BACK_Y = 70; // ligne de dos
const GROUND_Y = 216; // les sabots la touchent

/* Le tronc et l'encolure. `f` = état de chair, de 0 (maigre) à 1 (en état). */
function cowBody(f) {
  // Ligne de dos : creusée chez la maigre, tendue chez l'autre.
  const backMid = lerp(BACK_Y + 9, BACK_Y, f);
  const withers = lerp(BACK_Y + 3, BACK_Y - 2, f);
  // Pointe de hanche : saillante quand il n'y a plus de gras dessus.
  const hip = lerp(7, 1.5, f);
  // PROFONDEUR DU CORPS — le tour de poitrine, la mesure que l'on prend
  // réellement pour juger une bête. C'est l'encodage.
  const belly = lerp(140, 160, f);
  const brisket = lerp(132, 148, f);
  // Fanon : le repli sous l'encolure, plein chez la bête en état.
  const dewlap = lerp(112, 124, f);

  return [
    `M${RUMP_X - 16},98`,
    // Croupe, puis ligne de dos vers l'avant.
    `C${RUMP_X - 18},${82 - hip} ${RUMP_X - 6},${72 - hip} ${RUMP_X + 8},${74 - hip * 0.6}`,
    `C${RUMP_X + 40},${backMid} ${WITHERS_X - 50},${backMid + 3} ${WITHERS_X - 14},${backMid - 1}`,
    `C${WITHERS_X - 2},${withers + 3} ${WITHERS_X + 8},${withers} ${WITHERS_X + 18},${withers - 3}`,
    // ENCOLURE. Elle se rétrécit vers la nuque : c'est ce rétrécissement qui
    // détache la tête du tronc.
    `C266,${lerp(62, 58, f)} 280,54 292,50`,
    `C300,54 304,62 304,72`,
    // Auge, gorge, fanon.
    `C302,${dewlap - 6} 292,${dewlap + 6} 276,${dewlap + 2}`,
    `C266,${brisket - 8} 258,${brisket} 250,${brisket + 4}`,
    // Ligne du dessous : poitrail, ventre, flanc.
    `C236,${belly - 4} 206,${belly} 172,${belly}`,
    `C144,${belly} 116,${belly - 8} ${RUMP_X - 2},${belly - 22}`,
    // Remontée vers la croupe.
    `C${RUMP_X - 14},${belly - 38} ${RUMP_X - 20},120 ${RUMP_X - 16},98`,
    `Z`,
  ].join(" ");
}

/* ---- LA TÊTE, PIÈCE À PART ----
   Dessinée dans le même tracé que le tronc, elle s'y confondait : la bête
   n'avait qu'une bosse à l'avant. Détachée, elle se règle seule — et elle
   porte ce qui fait reconnaître un bovin : un front large, un chanfrein droit
   et un MUFLE CARRÉ. C'est le mufle qui distingue une vache d'un cheval, bien
   plus que les cornes. Cinquante-six de long sur quarante-quatre de haut :
   le rapport d'une tête vue de profil. */
const HEAD_D = [
  "M292,50",
  "C304,42 320,42 330,50", // front
  "C340,58 346,70 348,80", // chanfrein
  "C350,88 344,95 334,96", // haut du mufle
  "C324,97 314,93 308,86", // mufle, bout franc
  "C302,78 296,64 292,50", // auge
  "Z",
].join(" ");

/* Les membres sont TRACÉS, pas remplis : un trait à bouts ronds donne le
   coude et le jarret là où ils sont sur une bête, ce que quatre rectangles
   identiques ne pouvaient pas faire. Leur haut part de l'intérieur du corps,
   donc il est masqué par lui. */
const LEGS = [
  { d: `M226,118 C230,146 228,${GROUND_Y - 44} 226,${GROUND_Y - 12}`, hx: 226, near: true },
  { d: `M208,122 C212,148 210,${GROUND_Y - 42} 208,${GROUND_Y - 12}`, hx: 208, near: false },
  // Postérieurs : le jarret casse la ligne vers l'arrière, c'est sa signature.
  { d: `M118,112 C108,142 122,${GROUND_Y - 50} 116,${GROUND_Y - 12}`, hx: 116, near: true },
  { d: `M102,116 C92,146 106,${GROUND_Y - 48} 100,${GROUND_Y - 12}`, hx: 100, near: false },
];
const HOOF_Y = GROUND_Y - 14;

/* Taches : décoratives, et rien d'autre. Elles étaient l'élément le plus
   contrasté du dessin alors qu'elles ne codent aucune valeur ; elles passent
   en arrière-plan, comme une robe. */
const SPOTS = [
  [136, 98, 19, 13],
  [180, 112, 22, 15],
  [160, 84, 13, 9],
  [210, 102, 15, 11],
  [118, 124, 12, 8],
];

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
  // Les trois tracés qui portent le corps — remplissage, contour, détourage
  // des taches — sont recalculés ensemble à chaque image.
  const bodyRef = useRef(null);
  const outlineRef = useRef(null);
  const clipRef = useRef(null);
  const udderRef = useRef(null);
  const legsRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(() => {
    const v = animObj.current.v;
    if (numberRef.current)
      numberRef.current.textContent = nf.format(
        Math.round(animObj.current.val),
      );
    // Le corps est REDESSINÉ, pas mis à l'échelle : c'est la seule façon
    // d'épaissir un flanc sans allonger une patte.
    const d = cowBody(v);
    [bodyRef, outlineRef, clipRef].forEach((r) => {
      if (r.current) r.current.setAttribute("d", d);
    });
    // La mamelle est ACCROCHÉE à la ligne du ventre : elle descend avec elle
    // quand la bête s'étoffe, au lieu de flotter à hauteur fixe. Le décalage
    // de six pixels la fait mordre dans le corps — c'est ce qui la rattache.
    if (udderRef.current) {
      const bellyY = 140 + v * 20 - 6;
      const us = 0.82 + 0.24 * v;
      udderRef.current.setAttribute(
        "transform",
        `translate(146 ${bellyY.toFixed(1)}) scale(${us.toFixed(3)})`,
      );
    }
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
                viewBox="0 0 380 260"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  {/* Le détourage suit le corps courant : les taches
                      s'épaississent avec lui au lieu de flotter. */}
                  <clipPath id="cow-body">
                    <path ref={clipRef} d={cowBody(0.5)} />
                  </clipPath>
                </defs>

                {/* Sol */}
                <ellipse
                  className="cattle__soil"
                  cx="180"
                  cy={GROUND_Y + 4}
                  rx="150"
                  ry="10"
                />

                {/* ---- L'ANIMAL MÉDIAN, EN CONTOUR, DERRIÈRE ----
                    La médiane du Pacifique était un trait pointillé vertical
                    posé sur la vache : un repère de graphique planté dans une
                    illustration, qui ne disait rien de ce qu'il fallait
                    comparer. C'est maintenant la MÊME BÊTE, à l'état de chair
                    médian, tracée en filigrane. On compare deux animaux — et
                    l'écart se voit à l'endroit exact où il existe : le tour de
                    poitrine. */}
                {medianV != null ? (
                  <g className="cattle__ghost" aria-hidden="true">
                    <path d={cowBody(medianV)} fill="none" />
                    {LEGS.map((lg, i) => (
                      <path key={i} d={lg.d} fill="none" />
                    ))}
                  </g>
                ) : null}

                {/* Queue, avec son toupet. Elle passe DERRIÈRE la croupe. */}
                <g className="cattle__tail">
                  <path d="M90,92 C74,112 72,150 82,172" fill="none" />
                  <path
                    className="cattle__tuft"
                    d="M82,172 C75,181 77,194 86,196 C93,192 91,179 82,172 Z"
                  />
                </g>

                {/* ---- LES PATTES ----
                    Tracées et non remplies : un trait à bouts ronds donne des
                    membres nets, avec le coude et le jarret là où ils sont sur
                    une bête. Les quatre rectangles identiques d'avant ne
                    pouvaient pas faire ça. Les membres du fond sont plus
                    sombres : c'est ce qui donne la profondeur. */}
                <g ref={legsRef}>
                  {LEGS.map((lg, i) => (
                    <g key={i} className={lg.near ? "cattle__leg" : "cattle__leg cattle__leg--far"}>
                      <path d={lg.d} fill="none" />
                      <rect
                        className="cattle__hoof"
                        x={lg.hx - 6}
                        y={HOOF_Y}
                        width="12"
                        height="10"
                        rx="2.5"
                      />
                    </g>
                  ))}
                </g>

                {/* ---- LE CORPS ----
                    Une seule forme, recalculée à chaque image depuis l'état de
                    chair. Les taches sont détourées par le corps : elles le
                    suivent quand il s'épaissit, au lieu de flotter. */}
                <path ref={bodyRef} className="cattle__body" d={cowBody(0.5)} />

                <g clipPath="url(#cow-body)">
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

                <path ref={outlineRef} className="cattle__outline" d={cowBody(0.5)} fill="none" />

                {/* ---- LA MAMELLE ----
                    C'était un ovale ROSE posé au milieu du ventre : la seule
                    couleur du dessin, sur une bête en noir et blanc, et rien
                    ne la rattachait au corps — elle flottait.

                    Elle est maintenant accrochée à la ligne du ventre, dont
                    elle suit la descente quand la bête s'étoffe, placée devant
                    les postérieurs comme sur l'animal, et peinte dans la même
                    famille que le reste du dessin. Deux trayons courts
                    suffisent à la faire lire — sans eux, ce n'est qu'une
                    bosse. */}
                <g ref={udderRef} className="cattle__udder">
                  <path d="M-19,0 C-20,13 -12,20 0,20 C12,20 20,13 19,0 Z" />
                  <line className="cattle__teat" x1="-8" y1="19" x2="-9" y2="26" />
                  <line className="cattle__teat" x1="8" y1="19" x2="9" y2="26" />
                </g>

                {/* Oreille, corne, œil, naseau. */}
                {/* La tête, posée sur l'encolure. Corne et oreille sont
                    dessinées AVANT elle : elles se glissent derrière, comme
                    sur l'animal. */}
                <path className="cattle__horn" d="M300,46 C294,34 304,26 314,30" fill="none" />
                <path className="cattle__ear" d="M296,56 C284,46 268,48 264,60 C274,70 290,68 296,56 Z" />
                <path className="cattle__face" d={HEAD_D} />
                <path className="cattle__outline cattle__outline--head" d={HEAD_D} fill="none" />
                <circle className="cattle__eye" cx="320" cy="66" r="3.4" />
                <ellipse className="cattle__nostril" cx="334" cy="86" rx="3.8" ry="2.6" />
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