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
// Eau basse. À 266 il ne restait que 6 px entre la surface et le fond : ni
// assez pour qu'un poisson y tienne, ni assez pour que ça ressemble à de
// l'eau. La course encode toujours la même chose — une hauteur normalisée sur
// l'amplitude du Pacifique, dit sous le visuel — sur 74 px au lieu de 108.
const LOW_Y = 232;
const SEABED_Y = 272;
const STILTS = [100, 150, 210, 260];
// LES BULLES SONT REMPLACÉES PAR DES POISSONS.
// Cinq points noirs qui remontaient en boucle : ça ne ressemblait ni à des
// bulles (elles seraient claires) ni à rien d'autre. Sous une maison sur
// pilotis il y a un fond et des poissons — et ils disent quelque chose de
// plus : plus l'eau monte, plus il y a de place pour eux.
//
// `depth` est la profondeur de croisière ; un poisson ne s'affiche que lorsque
// la surface est passée au-dessus de lui.
// `depth` est RELATIVE à la colonne d'eau : 0 = juste sous la surface,
// 1 = juste au-dessus du fond. Les poissons suivent donc le niveau au lieu
// d'attendre qu'il les atteigne.
const FISH = [
  { x: 118, depth: 0.32, amp: 26, sp: 0.34, off: 0.0, s: 1.0 },
  { x: 196, depth: 0.74, amp: 34, sp: 0.26, off: 1.6, s: 0.82 },
  { x: 236, depth: 0.2, amp: 22, sp: 0.42, off: 2.7, s: 0.7 },
  { x: 152, depth: 0.88, amp: 30, sp: 0.3, off: 0.9, s: 0.9 },
  { x: 262, depth: 0.55, amp: 24, sp: 0.38, off: 2.1, s: 0.76 },
];

// Un poisson simple : corps, caudale, œil. À cette taille, l'œil est ce qui
// fait la différence entre un animal et une virgule.
const FISH_BODY = "M8,0 Q3,-5 -4,-4 L-11,-7 L-9,0 L-11,7 L-4,4 Q3,5 8,0 Z";

// Fond marin : un banc de sable et quelques massifs, très sourds. Ils ne
// portent aucune donnée — ils donnent une échelle et un bas à l'image.
const SEABED_D =
  "M-10,272 Q40,264 92,269 Q150,275 208,268 Q272,261 370,268 L370,300 L-10,300 Z";
const SEABED_CLUMPS = [
  "M56,268 q4,-11 9,-3 q5,-9 8,3 Z",
  "M138,266 q3,-9 7,-2 q4,-7 6,2 Z",
  "M228,265 q5,-13 10,-4 q6,-10 9,4 Z",
  "M300,269 q3,-8 7,-2 q4,-6 6,2 Z",
];

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

      // LES POISSONS NE SONT PAS UNE DONNÉE.
      //
      // Ils n'apparaissaient qu'une fois la surface passée au-dessus d'eux : au
      // territoire le plus bas, l'eau ne montait pas assez et le dessin n'en
      // comptait aucun. Or ils ne mesurent rien — c'est la hauteur d'eau qui
      // porte l'anomalie. Faire dépendre le vivant d'un chiffre qu'il n'encode
      // pas, c'est laisser croire à une lecture qui n'existe pas.
      //
      // Ils nagent donc dans la colonne d'eau QUELLE QU'ELLE SOIT : leur
      // profondeur est relative, entre la surface et le fond. Ils sont toujours
      // là, ils sont seulement plus ou moins au large.
      const top = ly + 7;
      const floor = SEABED_Y - 4;
      const column = Math.max(0, floor - top);
      bubbleRefs.current.forEach((node, i) => {
        if (!node) return;
        const f = FISH[i];
        const fx = f.x + (reduced ? 0 : f.amp * Math.sin(phase * f.sp + f.off));
        const fy = top + f.depth * column;
        const dir = Math.cos(phase * f.sp + f.off) >= 0 ? 1 : -1;
        // Dans une lame d'eau étroite, ils rapetissent plutôt que de disparaître.
        const fit = clamp01(column / 60);
        const sc = f.s * (0.55 + 0.45 * fit);
        node.setAttribute(
          "transform",
          `translate(${fx.toFixed(1)} ${fy.toFixed(1)}) scale(${(dir * sc).toFixed(3)} ${sc.toFixed(3)})`,
        );
        node.setAttribute("opacity", column > 14 ? "1" : "0");
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

                  {/* Pilotis. Une seule entretoise horizontale les faisait
                      lire comme un échafaudage : ce qui tient une maison sur
                      pieux, ce sont des CROIX de contreventement entre pieux
                      voisins, plus une lisse basse. */}
                  <g className="stilt__posts">
                    {STILTS.map((x, i) => (
                      <line key={i} x1={x} y1="150" x2={x} y2={SEABED_Y} />
                    ))}
                  </g>
                  <g className="stilt__braces">
                    {STILTS.slice(0, -1).map((x, i) => (
                      <g key={i}>
                        <line x1={x} y1="186" x2={STILTS[i + 1]} y2="228" />
                        <line x1={STILTS[i + 1]} y1="186" x2={x} y2="228" />
                      </g>
                    ))}
                    <line x1={STILTS[0]} y1="228" x2={STILTS[STILTS.length - 1]} y2="228" />
                  </g>

                  {/* Échelle : elle partait dans le vide, sans appui sur le
                      plancher. Elle s'accroche maintenant sous le débord. */}
                  <g className="stilt__ladder">
                    <line x1="112" y1="150" x2="92" y2={SEABED_Y} />
                    <line x1="126" y1="150" x2="106" y2={SEABED_Y} />
                    <line x1="123" y1="166" x2="109" y2="166" />
                    <line x1="119" y1="188" x2="105" y2="188" />
                    <line x1="115" y1="210" x2="101" y2="210" />
                    <line x1="111" y1="232" x2="97" y2="232" />
                  </g>

                  {/* Fond marin, très sourd : il donne un bas à l'image et une
                      échelle aux pilotis. Il ne porte aucune donnée. */}
                  <g className="stilt__seabed" aria-hidden="true">
                    <path className="stilt__sand" d={SEABED_D} />
                    {SEABED_CLUMPS.map((d, i) => (
                      <path key={i} className="stilt__clump" d={d} />
                    ))}
                  </g>

                  {/* Eau (semi-transparente : pilotis submergés visibles) */}
                  <path ref={backRef} className="stilt__water-back" d="" />
                  <path ref={frontRef} className="stilt__water-front" d="" />
                  {FISH.map((f, i) => (
                    <g
                      key={i}
                      ref={(n) => {
                        bubbleRefs.current[i] = n;
                      }}
                      className="stilt__fish"
                      opacity="0"
                    >
                      <path d={FISH_BODY} />
                      <circle className="stilt__fish-eye" cx="4.6" cy="-1.4" r="1" />
                    </g>
                  ))}

                  {/* LA MAISON, REDESSINÉE EN FALE.
                      Elle était : un toit en LENTILLE posé sur rien, une boîte
                      pleine pour corps, et une porte flottant à côté d'une
                      fenêtre. Le toit ne touchait pas les murs.
                      Un fale est ouvert : des poteaux d'angle, une lisse à
                      hauteur d'appui, un intérieur sombre entre les poteaux, et
                      un toit de chaume à quatre pans qui DÉBORDE largement —
                      c'est le débord qui abrite, et c'est lui qu'on reconnaît. */}
                  <g className="stilt__house">
                    {/* Plancher : une planche et ses solives, pas un trait. */}
                    <rect className="stilt__joist" x="80" y="150" width="200" height="5" rx="1" />
                    <rect className="stilt__floor" x="72" y="142" width="216" height="9" rx="2" />

                    {/* L'intérieur, dans l'ombre du toit : c'est ce vide qui
                        fait lire une maison ouverte plutôt qu'un cube. */}
                    <rect className="stilt__inside" x="98" y="96" width="164" height="46" />

                    {/* Poteaux d'angle et poteaux intermédiaires. */}
                    <g className="stilt__cols">
                      <line x1="102" y1="96" x2="102" y2="142" />
                      <line x1="142" y1="96" x2="142" y2="142" />
                      <line x1="218" y1="96" x2="218" y2="142" />
                      <line x1="258" y1="96" x2="258" y2="142" />
                    </g>

                    {/* Lisse basse, ouverte au centre : l'entrée. */}
                    <rect className="stilt__rail" x="98" y="124" width="52" height="12" rx="2" />
                    <rect className="stilt__rail" x="210" y="124" width="52" height="12" rx="2" />

                    {/* Toit de chaume à quatre pans : un faîtage horizontal,
                        deux croupes, un débord franc de part et d'autre. */}
                    <path
                      className="stilt__roof"
                      d="M52,100 Q88,96 124,58 L236,58 Q272,96 308,100 Q296,106 268,104 L92,104 Q64,106 52,100 Z"
                    />
                    {/* Faîtage */}
                    <path className="stilt__ridge" d="M120,57 L240,57" fill="none" />
                    {/* Rangs de chaume : ce qui distingue un toit d'un aplat. */}
                    <g className="stilt__thatch">
                      <path d="M70,99 Q104,94 131,68" fill="none" />
                      <path d="M82,101 Q112,97 137,72" fill="none" />
                      <path d="M290,99 Q256,94 229,68" fill="none" />
                      <path d="M278,101 Q248,97 223,72" fill="none" />
                      <path d="M150,58 L150,104" fill="none" />
                      <path d="M180,58 L180,104" fill="none" />
                      <path d="M210,58 L210,104" fill="none" />
                    </g>
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