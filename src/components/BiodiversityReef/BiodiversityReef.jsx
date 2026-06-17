// src/components/BiodiversityReef/BiodiversityReef.jsx
// ============================================================
// SECTION SIGNATURE #3 — « Le récif » (Home), pendant vivant du verre d'eau
// et de la cellule d'énergie. Même ESPRIT (un objet réel qui répond à une
// donnée), animation différente : un RÉCIF qui REPREND VIE — couleurs +
// poissons — selon l'INDICE LISTE ROUGE (risque d'extinction des espèces,
// ODD 15.5.1, indicateur ER_RSK_LST, UICN), via le dataset live `redList`.
//
// Lecture honnête :
//   • grand nombre = indice réel (0 → 1 ; 1 = aucun risque) ;
//   • le récif encode la VITALITÉ relative au Pacifique, NORMALISÉE sur
//     l'amplitude observée : le territoire le plus préservé = récif pleinement
//     vivant, le plus menacé = totalement blanchi — l'écart est maximal et
//     lisible. Coraux + poissons quand l'indice est haut ; squelettes blanchis
//     et coraux rabougris quand il baisse (blanchissement rendu visible) ;
//   • une tendance « depuis {année} » montre le sens réel de l'évolution.
//
// Aucune valeur inventée : seuls les territoires AYANT une donnée (dernière
// année connue) sont proposés ; vitalité et tendance dérivées de la série
// officielle. Houle + taille des coraux + dérive des poissons pilotées par rAF
// (attributs SVG + une custom property --v pour l'opacité) ; transition GSAP.
// prefers-reduced-motion respecté. Tokens uniquement, FR/EN, zéro inline.
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
import "./BiodiversityReef.scss";

/* Coraux : silhouette + classe de couleur + base x (pivot houle/échelle). */
const CORALS = [
  { d: "M38,196 Q33,166 50,154 Q67,166 62,196 Z", cls: "reef__c1", x: 50 },
  { d: "M100,196 L100,170 M100,178 L88,160 M100,176 L113,158 M88,160 L84,148 M113,158 L117,148", cls: "reef__c2", x: 100 },
  { d: "M132,196 Q129,170 150,168 Q171,170 168,196 Z", cls: "reef__c3", x: 150 },
  { d: "M200,196 L200,166 M210,196 L210,154 M220,196 L220,164", cls: "reef__c4", x: 210 },
  { d: "M256,196 Q249,164 270,150 Q291,164 284,196 Z", cls: "reef__c5", x: 270 },
  { d: "M320,196 L320,174 M320,182 L309,166 M320,182 L331,166 M320,178 L323,160", cls: "reef__c6", x: 320 },
];

const FISH_D = "M9,0 Q3,-6 -6,-4 L-14,-8 L-11,0 L-14,8 L-6,4 Q3,6 9,0 Z";
const FISH = [
  { x: 96, y: 88, cls: "reef__f1", sp: 0.5, off: 0.0 },
  { x: 158, y: 70, cls: "reef__f2", sp: 0.42, off: 1.1 },
  { x: 224, y: 96, cls: "reef__f3", sp: 0.55, off: 2.0 },
  { x: 284, y: 78, cls: "reef__f1", sp: 0.46, off: 0.7 },
  { x: 126, y: 120, cls: "reef__f2", sp: 0.6, off: 1.7 },
  { x: 250, y: 128, cls: "reef__f3", sp: 0.5, off: 2.6 },
];

const BASE_Y = 196;

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

export default function BiodiversityReef({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const bio = useSelector(selectDataset("redList"));

  useEffect(() => {
    dispatch(loadDataset("redList"));
  }, [dispatch]);

  const status = bio.status;
  const ready = status === "succeeded" && bio.data;

  /* L'Indice Liste Rouge est 0–1 ; on tolère un flux en %. */
  const indexMode = useMemo(() => {
    if (!ready) return true;
    let max = 0;
    Object.values(bio.data.byArea).forEach((s) =>
      s.forEach((p) => {
        if (Number.isFinite(p.value) && p.value > max) max = p.value;
      }),
    );
    return max <= 1.5;
  }, [ready, bio.data]);

  const norm = useCallback(
    (value) => clamp01(indexMode ? value : value / 100),
    [indexMode],
  );

  /* Liste : index réel + tendance, puis VITALITÉ normalisée sur l'amplitude
     observée (min..max du Pacifique) → écart maximal entre préservé et menacé. */
  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(bio.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt) return null;
        const f = firstFinite(serie);
        return {
          code,
          name: pictName(code, lang),
          index: norm(pt.value),
          year: pt.year,
          delta: f ? norm(pt.value) - norm(f.value) : null,
          fromYear: f ? f.year : null,
        };
      })
      .filter(Boolean);
    if (!raw.length) return [];
    const idxs = raw.map((o) => o.index);
    const vMin = Math.min(...idxs);
    const vMax = Math.max(...idxs);
    const span = vMax - vMin || 1;
    return raw
      .map((o) => ({ ...o, v: clamp01((o.index - vMin) / span) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, bio.data, lang, norm]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianIndex = useMemo(() => median(list.map((o) => o.index)), [list]);
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let best = list[0];
    let least = list[0];
    list.forEach((o) => {
      if (o.index > best.index) best = o;
      if (o.index < least.index) least = o;
    });
    return { best, least };
  }, [list]);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(byCode.FJ ? "FJ" : list[0].code);
    }
  }, [list, selected, byCode]);

  const sel = selected ? byCode[selected] : null;
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Animation : vitalité du récif ----------- */
  const svgRef = useRef(null);
  const numberRef = useRef(null);
  const coralRefs = useRef([]);
  const fishRefs = useRef([]);
  const animObj = useRef({ v: 0, idx: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (svgRef.current) svgRef.current.style.setProperty("--v", v.toFixed(3));
      if (numberRef.current)
        numberRef.current.textContent = animObj.current.idx.toFixed(2);

      const swing = reduced ? 0 : 1;
      // Coraux : houle (rotation) + TAILLE selon la vitalité (rabougris si bas).
      const sy = 0.4 + 0.6 * v;
      const sx = 0.72 + 0.28 * v;
      coralRefs.current.forEach((node, i) => {
        if (!node) return;
        const x = CORALS[i].x;
        const a = 3.6 * v * swing * Math.sin(phase * 0.9 + i * 1.3);
        node.setAttribute(
          "transform",
          `translate(${x} ${BASE_Y}) rotate(${a.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-x} ${-BASE_Y})`,
        );
      });

      // Poissons : dérive + apparition progressive selon la vitalité.
      fishRefs.current.forEach((node, i) => {
        if (!node) return;
        const f = FISH[i];
        const tx = f.x + (reduced ? 0 : 20 * Math.sin(phase * f.sp + f.off));
        const ty = f.y + (reduced ? 0 : 6 * Math.sin(phase * 0.8 + f.off));
        const dir = Math.cos(phase * f.sp + f.off) >= 0 ? 1 : -1;
        node.setAttribute(
          "transform",
          `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${dir} 1)`,
        );
        const appear = clamp01((v - i / FISH.length) * 2.2);
        node.setAttribute("opacity", appear.toFixed(3));
      });
    },
    [reduced],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = sel ? sel.v : 0;
    const ti = sel ? sel.index : 0;
    if (reduced) {
      animObj.current.v = tv;
      animObj.current.idx = ti;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: tv,
      idx: ti,
      duration: 1.2,
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

  const idxText = sel ? sel.index.toFixed(2) : "0.00";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.0005)
      return (
        <span className="reef__trend reef__trend--flat">
          {fillTpl(t("home.biodiv.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d < 0)
      return (
        <span className="reef__trend reef__trend--down">
          {fillTpl(t("home.biodiv.trend_down"), {
            n: d.toFixed(3),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="reef__trend reef__trend--up">
        {fillTpl(t("home.biodiv.trend_up"), {
          n: d.toFixed(3),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.biodiv.aria"), {
        area: sel.name,
        n: idxText,
        year: sel.year,
      })
    : t("home.biodiv.title");

  return (
    <section
      className={`reef ${embed ? "reef--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="reef__inner container">
        <header className="reef__head">
          <p className="eyebrow reef__kicker">{t("home.biodiv.kicker")}</p>
          <h2 className="reef__title">{t("home.biodiv.title")}</h2>
          <p className="reef__lead">{t("home.biodiv.lead")}</p>
        </header>

        {loading && <p className="reef__state">{t("home.biodiv.loading")}</p>}
        {(failed || empty) && (
          <p className="reef__state reef__state--err">
            {t("home.biodiv.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="reef__stage">
            {/* Texte : contrôles + lecture */}
            <aside className="reef__aside">
              <div className="reef__controls">
                <label className="reef__field">
                  <span className="reef__field-label">
                    {t("home.biodiv.select_label")}
                  </span>
                  <span className="reef__select">
                    <img
                      className="reef__flag"
                      src={flagUrl(sel.code)}
                      alt=""
                      aria-hidden="true"
                    />
                    <select
                      className="reef__native"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      aria-label={t("home.biodiv.select_label")}
                    >
                      {list.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <span className="reef__chevron" aria-hidden="true">
                      ▾
                    </span>
                  </span>
                </label>

                {extremes && (
                  <div className="reef__chips">
                    <button
                      type="button"
                      className="reef__chip"
                      onClick={() => setSelected(extremes.best.code)}
                    >
                      {t("home.biodiv.highest")}
                      <em>{extremes.best.index.toFixed(2)}</em>
                    </button>
                    <button
                      type="button"
                      className="reef__chip"
                      onClick={() => setSelected(extremes.least.code)}
                    >
                      {t("home.biodiv.lowest")}
                      <em>{extremes.least.index.toFixed(2)}</em>
                    </button>
                  </div>
                )}
              </div>

              <div className="reef__readout">
                <p className="reef__index">
                  <span ref={numberRef} className="reef__index-num">
                    {idxText}
                  </span>
                </p>
                <p className="reef__index-cap">
                  {t("home.biodiv.index_caption")}
                </p>
                <p className="reef__name">
                  <img
                    className="reef__name-flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  {sel.name}
                </p>
                <p className="reef__year">
                  {fillTpl(t("home.biodiv.year_label"), { year: sel.year })}
                  {trendEl ? <> · {trendEl}</> : null}
                </p>

                {medianIndex != null && (
                  <p className="reef__legend">
                    {fillTpl(t("home.biodiv.median_label"), {
                      n: medianIndex.toFixed(2),
                    })}
                  </p>
                )}
              </div>
            </aside>

            {/* Le récif */}
            <figure className="reef__viz">
              <svg
                className="reef__svg"
                ref={svgRef}
                viewBox="0 0 360 240"
                role="img"
                aria-label={svgLabel}
              >
                {/* Rais de lumière */}
                <g className="reef__rays" aria-hidden="true">
                  <polygon points="70,0 110,0 90,200 78,200" />
                  <polygon points="180,0 210,0 198,200 188,200" />
                  <polygon points="280,0 312,0 300,200 290,200" />
                </g>

                {/* Sol */}
                <path
                  className="reef__bed"
                  d="M0,200 Q90,188 180,198 T360,196 L360,240 L0,240 Z"
                />

                {/* Coraux : squelette blanchi + version vivante colorée */}
                {CORALS.map((c, i) => (
                  <g
                    key={i}
                    ref={(n) => {
                      coralRefs.current[i] = n;
                    }}
                  >
                    <path className="reef__ghost" d={c.d} />
                    <path className={`reef__alive ${c.cls}`} d={c.d} />
                  </g>
                ))}

                {/* Poissons */}
                {FISH.map((f, i) => (
                  <g
                    key={i}
                    ref={(n) => {
                      fishRefs.current[i] = n;
                    }}
                    opacity="0"
                  >
                    <path className={`reef__fish ${f.cls}`} d={FISH_D} />
                  </g>
                ))}
              </svg>
              <figcaption className="reef__viz-cap">
                {t("home.biodiv.vitality_caption")}
              </figcaption>
            </figure>
          </div>
        )}

        <p className="reef__source">{t("home.biodiv.source")}</p>
      </div>
    </section>
  );
}